import { Redis } from "ioredis";

// Separate connection – pub/sub requires a dedicated client
const publisher = new Redis({
  host: "localhost",
  port: 6379,
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
  progress: number; // 0-100
  message: string;
  done?: boolean;
  error?: boolean;
}

export async function publishProgress(fileId: string, event: ProgressEvent) {
  await publisher.publish(`file-progress:${fileId}`, JSON.stringify(event));
}
