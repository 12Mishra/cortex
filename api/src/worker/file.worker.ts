import "dotenv/config";
import { Worker } from "bullmq";
import crypto from "crypto";
import pdfParse from "pdf-parse";
import { redisConnection } from "../config/redis";
import type { FileRecord } from "../types/file";
import { getFileFromS3 } from "../lib/download-file";
import { streamToBuffer } from "../lib/buffer";
import { prisma } from "../lib/prisma";
import { chunkText } from "../lib/chunk";
import { generateEmbeddings } from "../lib/embed";
import { publishProgress } from "../lib/redis-pub";

const worker = new Worker(
  "file-queue",
  async (job) => {
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

      const pdfData = await pdfParse(buffer);
      const text = pdfData.text;
      console.log(
        `[worker] Extracted ${text.length} chars across ${pdfData.numpages} pages`,
      );

      if (!text.trim()) {
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

      const chunks = chunkText(text);
      console.log(`[worker] ${chunks.length} chunks created`);

      const BATCH_SIZE = 10;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
      const allEmbeddings: number[][] = [];

      for (let b = 0; b < totalBatches; b++) {
        const batch = chunks.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        const batchEmbeddings = await generateEmbeddings(batch);
        allEmbeddings.push(...batchEmbeddings);

        const progress = 40 + Math.floor(((b + 1) / totalBatches) * 45); // 40 → 85
        await publishProgress(fileId, {
          step: "embedding",
          progress,
          message: `Generating embeddings… batch ${b + 1}/${totalBatches}`,
        });
      }

      console.log(`[worker] Embeddings ready for ${chunks.length} chunks`);
      await publishProgress(fileId, {
        step: "storing",
        progress: 90,
        message: "Storing chunks in vector database…",
      });

      await prisma.documentChunk.deleteMany({ where: { documentId: fileId } });

      for (let i = 0; i < chunks.length; i++) {
        const id = crypto.randomUUID();
        const vectorLiteral = `[${allEmbeddings[i].join(",")}]`;
        const tokenCount = Math.ceil(chunks[i].length / 4);

        await prisma.$executeRaw`
          INSERT INTO "DocumentChunk" (id, "documentId", "chunkIndex", content, embedding, "tokenCount", "createdAt")
          VALUES (
            ${id}::uuid,
            ${fileId}::uuid,
            ${i},
            ${chunks[i]},
            ${vectorLiteral}::vector,
            ${tokenCount},
            NOW()
          )
        `;
      }

      console.log(`[worker] Stored ${chunks.length} chunks`);

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
  },
  { connection: redisConnection },
);

worker.on("completed", (job) => console.log(`[worker] Job ${job.id} completed`));
worker.on("failed", (job, err) => console.error(`[worker] Job ${job?.id} failed:`, err));

console.log("[worker] Ready and waiting for jobs on queue: file-queue");
