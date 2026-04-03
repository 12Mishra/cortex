import { Worker } from "bullmq";
import { redisConnection } from "../queue/connection.js";

const worker = new Worker(
  "file-queue",
  async (f) => {
    const { file } = f.data;

    console.log(file);
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
