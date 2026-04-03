import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import type { FileRecord } from "../types/file";
import { getFileFromS3 } from "../lib/download-file";
import { streamToBuffer } from "../lib/buffer";

const worker = new Worker(
  "file-queue",
  async (f) => {
    const { file }: { file: FileRecord } = f.data;

    console.log(file);

    const actualFile = await getFileFromS3(file.s3Key);

    console.log(actualFile);

    const buffer = await streamToBuffer(actualFile);

    console.log(buffer);
  },
  {
    connection: redisConnection,
  },
);

worker.on("completed", (f) => {
  console.log(`Job completed: ${f.id}`);
});

worker.on("failed", (f, err) => {
  console.error(`Job failed: ${f?.id}`, err);
});
