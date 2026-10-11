import { Redis } from "ioredis";

const subscriber = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

type Listener = (raw: string) => void;
const listeners = new Map<string, Set<Listener>>();

subscriber.on("message", (channel, message) => {
  listeners.get(channel)?.forEach((fn) => fn(message));
});


export function subscribeToFileProgress(
  fileId: string,
  onMessage: Listener,
): () => void {
  const channel = `file-progress:${fileId}`;

  if (!listeners.has(channel)) {
    listeners.set(channel, new Set());
    subscriber.subscribe(channel);
  }

  listeners.get(channel)!.add(onMessage);

  return () => {
    const fns = listeners.get(channel);
    if (!fns) return;
    fns.delete(onMessage);
    if (fns.size === 0) {
      subscriber.unsubscribe(channel);
      listeners.delete(channel);
    }
  };
}
