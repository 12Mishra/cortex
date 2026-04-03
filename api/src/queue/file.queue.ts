import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const fileQueue = new Queue("file-queue", {
  connection: redisConnection,
});
