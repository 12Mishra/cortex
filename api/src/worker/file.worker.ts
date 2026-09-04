import "dotenv/config";
import { Queue, Worker, type Job } from "bullmq";
import crypto from "crypto";
import pdfParse from "pdf-parse";
import { redisConnection } from "../config/redis";
import type { FileRecord } from "../types/file";
import { getFileFromS3 } from "../lib/download-file";
import { streamToBuffer } from "../lib/buffer";
import { prisma } from "../lib/prisma";
import { chunkPageTexts } from "../lib/chunk";
import { generateEmbeddings } from "../lib/embed";
import { publishProgress } from "../lib/redis-pub";

const QUEUE_NAME = "file-queue";

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const MIN_WORKERS = readPositiveInteger(process.env.FILE_WORKER_MIN, 3);
const MAX_WORKERS = Math.max(
  MIN_WORKERS,
  readPositiveInteger(process.env.FILE_WORKER_MAX, 10),
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
        message: "Extracting text from PDF…",
      });

      const pageTexts: { pageNumber: number; text: string }[] = [];

      await pdfParse(buffer, {
        pagerender: (pageData: any): Promise<string> =>
          pageData.getTextContent().then((tc: any) => {
            const text: string = tc.items
              .map((item: any) => (typeof item.str === "string" ? item.str : ""))
              .join(" ");
            pageTexts.push({ pageNumber: pageData.pageIndex + 1, text });
            return text;
          }),
      });

      const totalText = pageTexts.map((p) => p.text).join("").trim();
      console.log(
        `[worker] Extracted ${totalText.length} chars across ${pageTexts.length} pages`,
      );

      if (!totalText) {
        await prisma.document.update({
          where: { id: fileId },
          data: { status: "failed", errorMessage: "PDF contains no extractable text" },
        });
        await publishProgress(fileId, {
          step: "failed",
          progress: 0,
          message: "PDF contains no extractable text",
          error: true,
        });
        return;
      }

      await publishProgress(fileId, {
        step: "chunking",
        progress: 40,
        message: "Splitting text into chunks…",
      });

      const pageChunks = chunkPageTexts(pageTexts);
      console.log(`[worker] ${pageChunks.length} chunks created across ${pageTexts.length} pages`);

      const BATCH_SIZE = 10;
      const totalBatches = Math.ceil(pageChunks.length / BATCH_SIZE);
      const allEmbeddings: number[][] = [];

      for (let b = 0; b < totalBatches; b++) {
        const batch = pageChunks.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batchEmbeddings = await generateEmbeddings(batch.map((c) => c.content));
        allEmbeddings.push(...batchEmbeddings);

        const progress = 40 + Math.floor(((b + 1) / totalBatches) * 45);
        await publishProgress(fileId, {
          step: "embedding",
          progress,
          message: `Generating embeddings… batch ${b + 1}/${totalBatches}`,
        });
      }

      console.log(`[worker] Embeddings ready for ${pageChunks.length} chunks`);
      await publishProgress(fileId, {
        step: "storing",
        progress: 90,
        message: "Storing chunks in vector database…",
      });

      await prisma.documentChunk.deleteMany({ where: { documentId: fileId } });

      for (let i = 0; i < pageChunks.length; i++) {
        const { content, pageNumber, chunkIndex } = pageChunks[i];
        const id = crypto.randomUUID();
        const vectorLiteral = `[${allEmbeddings[i].join(",")}]`;
        const tokenCount = Math.ceil(content.length / 4);

        await prisma.$executeRaw`
          INSERT INTO "DocumentChunk" (id, "documentId", "chunkIndex", "pageNumber", content, embedding, "tokenCount", "createdAt")
          VALUES (
            ${id}::uuid,
            ${fileId}::uuid,
            ${chunkIndex},
            ${pageNumber},
            ${content},
            ${vectorLiteral}::vector,
            ${tokenCount},
            NOW()
          )
        `;
      }

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
