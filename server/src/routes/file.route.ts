import express from "express";
import { fileQueue } from "../queue/file.queue";
import { prisma } from "../lib/prisma";
import { subscribeToFileProgress } from "../lib/redis-sub";

export const fileRouter = express.Router();

fileRouter.post("/process", async (req, res) => {
  const { fileId } = req.body;

  if (typeof fileId !== "string" || !fileId) {
    return res.status(400).json({ success: false, message: "Missing file ID" });
  }

  const file = await prisma.document.findUnique({ where: { id: fileId } });

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

  const doc = await prisma.document.findUnique({
    where: { id: fileId },
    select: { status: true },
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  if (doc?.status === "ready") {
    send({ step: "done", progress: 100, message: "Document is ready!", done: true });
    return res.end();
  }
  if (doc?.status === "failed") {
    send({ step: "failed", progress: 0, message: doc.status, error: true });
    return res.end();
  }

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
