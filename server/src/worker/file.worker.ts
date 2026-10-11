import "dotenv/config";
import { Queue, Worker, type Job } from "bullmq";
import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { redisConnection } from "../config/redis";
import type { FileRecord } from "../types/file";
import { getFileFromS3 } from "../lib/download-file";
import { streamToBuffer } from "../lib/buffer";
import { prisma } from "../lib/prisma";
import { chunkPdfWithDocling } from "../lib/docling";
import { s3 } from "../config/s3";
import { generateEmbeddings } from "../lib/embed";
import { publishProgress } from "../lib/redis-pub";

const QUEUE_NAME = "file-queue";

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

// Process uploads one at a time by default so a batch does not burst the
// embedding API. Deployments with a higher quota can opt into more workers.
const MIN_WORKERS = readPositiveInteger(process.env.FILE_WORKER_MIN, 1);
const MAX_WORKERS = Math.max(
  MIN_WORKERS,
  readPositiveInteger(process.env.FILE_WORKER_MAX, 1),
);
const SCALE_INTERVAL_MS = readPositiveInteger(process.env.FILE_WORKER_SCALE_INTERVAL_MS, 5_000);

const scalerQueue = new Queue(QUEUE_NAME, { connection: redisConnection });
const workers: Worker[] = [];
let nextWorkerId = 1;
let isScaling = false;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function processFileJob(job: Job<{ file: FileRecord }>) {
    const { file }: { file: FileRecord } = job.data;
    const fileId = file.id;

    try {
      await prisma.document.update({
        where: { id: fileId },
        data: { status: "processing" },
      });
      await publishProgress(fileId, {
        step: "downloading",
        progress: 10,
        message: "Downloading file from S3…",
      });

      const stream = await getFileFromS3(file.s3Key);
      const buffer = await streamToBuffer(stream);
      console.log(`[worker] Downloaded ${buffer.byteLength} bytes`);
      await publishProgress(fileId, {
        step: "extracting",
        progress: 25,
        message: "Reading document structure with Docling…",
      });
      const doclingStartedAt = Date.now();
      const { chunks: pageChunks, pictures } = await chunkPdfWithDocling(buffer, file.fileName);
      if (!pageChunks.length) {
        throw new Error("Docling found no indexable content");
      }

      await publishProgress(fileId, {
        step: "chunking",
        progress: 40,
        message: "Preparing structured chunks and pictures…",
      });
      console.log(`[worker] Docling returned ${pageChunks.length} chunks and ${pictures.length} pictures in ${((Date.now() - doclingStartedAt) / 1000).toFixed(1)}s`);

      const BATCH_SIZE = 10;
      const totalBatches = Math.ceil(pageChunks.length / BATCH_SIZE);
      const allEmbeddings: number[][] = [];

      for (let b = 0; b < totalBatches; b++) {
        const batch = pageChunks.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        await publishProgress(fileId, {
          step: "embedding",
          progress: 40 + Math.floor((b / totalBatches) * 45),
          message: `Generating embeddings… batch ${b + 1}/${totalBatches}`,
        });
        const batchEmbeddings = await generateEmbeddings(batch.map((c) => c.content));
        allEmbeddings.push(...batchEmbeddings);
      }

      console.log(`[worker] Embeddings ready for ${pageChunks.length} chunks`);
      await publishProgress(fileId, {
        step: "storing",
        progress: 90,
        message: "Storing chunks in vector database…",
      });

      const pictureKeys = new Map<string, string>();
      for (let i = 0; i < pictures.length; i++) {
        const picture = pictures[i];
        const extension = picture.mimeType === "image/jpeg" ? "jpg" : picture.mimeType.split("/")[1];
        const key = `pictures/${file.userId}/${fileId}/${i}.${extension}`;
        await s3.send(new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME!,
          Key: key,
          Body: picture.bytes,
          ContentType: picture.mimeType,
        }));
        pictureKeys.set(picture.ref, key);
      }

      await prisma.$transaction(async (tx) => {
        await tx.documentPicture.deleteMany({ where: { documentId: fileId } });
        await tx.documentChunk.deleteMany({ where: { documentId: fileId } });
        const chunkIds = new Map<string, string>();
        const pageIds = new Map<number, string>();

        for (let i = 0; i < pageChunks.length; i++) {
          const { content, pageNumber, chunkIndex, tokenCount, docItems } = pageChunks[i];
          const id = crypto.randomUUID();
          const vectorLiteral = `[${allEmbeddings[i].join(",")}]`;
          await tx.$executeRaw`
            INSERT INTO "DocumentChunk" (id, "documentId", "chunkIndex", "pageNumber", content, embedding, "tokenCount", "createdAt")
            VALUES (${id}::uuid, ${fileId}::uuid, ${chunkIndex}, ${pageNumber}, ${content}, ${vectorLiteral}::vector, ${tokenCount ?? Math.ceil(content.length / 4)}, NOW())
          `;
          for (const ref of docItems) chunkIds.set(ref, id);
          if (pageNumber != null && !pageIds.has(pageNumber)) pageIds.set(pageNumber, id);
        }

        for (const picture of pictures) {
          await tx.documentPicture.create({
            data: {
              documentId: fileId,
              chunkId: chunkIds.get(picture.ref) ?? (picture.pageNumber != null ? pageIds.get(picture.pageNumber) : undefined),
              doclingRef: picture.ref,
              pageNumber: picture.pageNumber,
              s3Key: pictureKeys.get(picture.ref)!,
              mimeType: picture.mimeType,
            },
          });
        }
      }, { timeout: 120_000 });

      console.log(`[worker] Stored ${pageChunks.length} chunks`);

      await prisma.document.update({
        where: { id: fileId },
        data: { status: "ready", processedAt: new Date() },
      });

      await publishProgress(fileId, {
        step: "done",
        progress: 100,
        message: "Document is ready!",
        done: true,
      });

      console.log(`[worker] Document ${fileId} ready`);
    } catch (err) {
      const message = (err as Error).message;
      console.error(`[worker] Error processing ${fileId}:`, err);

      await prisma.document
        .update({ where: { id: fileId }, data: { status: "failed", errorMessage: message } })
        .catch(() => {});

      await publishProgress(fileId, {
        step: "failed",
        progress: 0,
        message,
        error: true,
      }).catch(() => {});
      throw err;
    }
}

function createWorker() {
  const workerIndex = nextWorkerId;
  nextWorkerId += 1;

  const worker = new Worker(QUEUE_NAME, processFileJob, { connection: redisConnection });

  worker.on("completed", (job) =>
    console.log(`[worker:${workerIndex}] Job ${job.id} completed`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[worker:${workerIndex}] Job ${job?.id} failed:`, err),
  );

  workers.push(worker);
  console.log(`[worker:${workerIndex}] Started. Active worker count: ${workers.length}`);
}

async function removeWorker() {
  const worker = workers.pop();

  if (!worker) {
    return;
  }

  await worker.close();
  console.log(`[worker] Stopped one worker. Active worker count: ${workers.length}`);
}

async function scaleWorkers() {
  if (isScaling) {
    return;
  }

  isScaling = true;

  try {
    const [waitingCount, activeCount] = await Promise.all([
      scalerQueue.getWaitingCount(),
      scalerQueue.getActiveCount(),
    ]);
    const desiredWorkers = clamp(waitingCount + activeCount, MIN_WORKERS, MAX_WORKERS);

    while (workers.length < desiredWorkers) {
      createWorker();
    }

    while (workers.length > desiredWorkers && workers.length > MIN_WORKERS) {
      await removeWorker();
    }
  } catch (err) {
    console.error("[worker] Failed to scale workers:", err);
  } finally {
    isScaling = false;
  }
}

for (let i = 0; i < MIN_WORKERS; i++) {
  createWorker();
}

const scaleTimer = setInterval(() => {
  void scaleWorkers();
}, SCALE_INTERVAL_MS);
void scaleWorkers();

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

async function shutdown() {
  clearInterval(scaleTimer);
  await Promise.all(workers.map((worker) => worker.close()));
  await scalerQueue.close();
  await redisConnection.quit();
  process.exit(0);
}

console.log(
  `[worker] Ready on queue: ${QUEUE_NAME}. min=${MIN_WORKERS}, max=${MAX_WORKERS}, scaleIntervalMs=${SCALE_INTERVAL_MS}`,
);
