import express from "express";
import { fileQueue } from "../queue/file.queue";
import { prisma } from "../lib/prisma";
import { subscribeToFileProgress } from "../lib/redis-sub";

export const fileRouter = express.Router();

// ── POST /file/process ──────────────────────────────────────────────
fileRouter.post("/process", async (req, res) => {
  const { fileId } = req.body;

  const file = await prisma.document.findUnique({ where: { id: fileId } });

  if (!file) {
    return res.status(404).json({ success: false, message: "Document not found" });
  }

  await fileQueue.add("process-file-job", { file });

  return res.status(200).json({ success: true, message: "Processing started" });
});

// ── GET /file/status/:fileId  (Server-Sent Events) ─────────────────
fileRouter.get("/status/:fileId", async (req, res) => {
  const { fileId } = req.params;

  // If already finished, return immediately without opening a stream
  const doc = await prisma.document.findUnique({
    where: { id: fileId },
    select: { status: true },
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // Already done — emit terminal event and close
  if (doc?.status === "ready") {
    send({ step: "done", progress: 100, message: "Document is ready!", done: true });
    return res.end();
  }
  if (doc?.status === "failed") {
    send({ step: "failed", progress: 0, message: doc.status, error: true });
    return res.end();
  }

  // Keep connection alive with a heartbeat every 15 s
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 15_000);

  const unsubscribe = subscribeToFileProgress(fileId, (raw) => {
    send(JSON.parse(raw));
    const parsed = JSON.parse(raw);
    if (parsed.done || parsed.error) {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    }
  });

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});
