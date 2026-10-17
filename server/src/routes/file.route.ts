import express from "express";
import { fileQueue } from "../queue/file.queue";
import { prisma } from "../lib/prisma";
import { subscribeToFileProgress } from "../lib/redis-sub";

export const fileRouter = express.Router();

// Only the web server may reach processing and progress endpoints. Resolve the
// owner from its authenticated session, never from a browser-supplied user ID.
fileRouter.use(async (req, res, next) => {
  if (!process.env.INTERNAL_API_SECRET || req.headers["x-internal-secret"] !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = req.headers["x-user-id"];
  if (typeof userId !== "string" || !userId) return res.status(401).json({ error: "Unauthorized" });
  next();
});

fileRouter.post("/process", async (req, res) => {
  const { fileId } = req.body;

  if (typeof fileId !== "string" || !fileId) {
    return res.status(400).json({ success: false, message: "Missing file ID" });
  }

  const file = await prisma.document.findUnique({ where: { id: fileId, userId: req.headers["x-user-id"] as string } });

  if (!file) {
    return res.status(404).json({ success: false, message: "Document not found" });
  }

  if (file.status === "ready" || file.status === "processing") {
    return res.status(200).json({ success: true, message: "Document is already processing or ready" });
  }

  const claimed = await prisma.document.updateMany({
    where: { id: fileId, status: file.status },
    data: { status: "processing", errorMessage: null },
  });

  if (claimed.count === 0) {
    return res.status(200).json({ success: true, message: "Document is already queued" });
  }

  try {
    await fileQueue.add("process-file-job", { file });
  } catch (error) {
    await prisma.document.updateMany({
      where: { id: fileId, status: "processing" },
      data: { status: file.status, errorMessage: file.errorMessage },
    });
    throw error;
  }

  return res.status(200).json({ success: true, message: "Processing started" });
});

fileRouter.get("/status/:fileId", async (req, res) => {
  const { fileId } = req.params;
  const owned = await prisma.document.findUnique({
    where: { id: fileId, userId: req.headers["x-user-id"] as string },
    select: { id: true },
  });
  if (!owned) return res.status(404).json({ error: "Document not found" });
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);
  let unsubscribe: (() => void) | undefined;
  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe?.();
  };
  const finish = (event: object) => {
    if (closed) return;
    send(event);
    cleanup();
    res.end();
  };
  res.on("close", cleanup);

  try {
    unsubscribe = await subscribeToFileProgress(fileId, (raw) => {
      if (closed) return;
      const event = JSON.parse(raw);
      if (event.done || event.error) finish(event);
      else send(event);
    });
    if (closed) {
      unsubscribe();
      return;
    }

    // Subscribe first, then read the durable status. This covers terminal events
    // published before the browser opened (or reconnected to) the stream.
    const doc = await prisma.document.findUnique({
      where: { id: fileId },
      select: { status: true, errorMessage: true },
    });
    if (closed) return;
    if (doc?.status === "ready") {
      finish({ step: "done", progress: 100, message: "Document is ready!", done: true });
    } else if (doc?.status === "failed") {
      finish({ step: "failed", progress: 0, message: doc.errorMessage ?? "Processing failed", error: true });
    } else if (!doc) {
      finish({ step: "failed", progress: 0, message: "Document not found", error: true });
    }
  } catch (error) {
    console.error(`[status] Could not subscribe to ${fileId}:`, error);
    finish({ step: "failed", progress: 0, message: "Could not read processing status", error: true });
  }
});
