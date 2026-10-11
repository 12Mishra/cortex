import { Queue } from "bullmq";
import { redisConnection } from "../config/redis";

export const fileQueue = new Queue("file-queue", {
  connection: redisConnection,
});
