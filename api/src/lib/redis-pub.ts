import { Redis } from "ioredis";

const publisher = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export type ProcessingStep =
  | "downloading"
  | "extracting"
  | "chunking"
  | "embedding"
  | "storing"
  | "done"
  | "failed";

export interface ProgressEvent {
  step: ProcessingStep;
  progress: number;
  message: string;
  done?: boolean;
  error?: boolean;
}

export async function publishProgress(fileId: string, event: ProgressEvent) {
  await publisher.publish(`file-progress:${fileId}`, JSON.stringify(event));
}
