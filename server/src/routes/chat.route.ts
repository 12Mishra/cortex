import express from "express";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "../lib/prisma";
import { generateQueryEmbedding } from "../lib/embed";
import { hybridSearch, type SearchTimings } from "../lib/retrieval";
import { getFileFromS3 } from "../lib/download-file";
import { streamToBuffer } from "../lib/buffer";
import { GENERATION_MODEL, MAX_OUTPUT_TOKENS, SYSTEM_INSTRUCTION } from "../lib/generation-config";
import { estimateGeminiCostUsd, GEMINI_MONTHLY_BUDGET_USD, reserveGeminiBudget } from "../lib/gemini-budget";

export const chatRouter = express.Router();

const genai = new GoogleGenAI({});

const HISTORY_LIMIT = 10;

chatRouter.post("/", async (req, res) => {
  const secret = req.headers["x-internal-secret"];
  if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = req.headers["x-user-id"] as string;
  if (!userId) {
    return res.status(400).json({ error: "Missing user id" });
  }

  const { query, documentId, conversationId } = req.body as {
    query: string;
    documentId: string;
    conversationId?: string;
  };

  if (typeof query !== "string" || !query.trim() || typeof documentId !== "string" || !documentId || (conversationId !== undefined && typeof conversationId !== "string")) {
    return res.status(400).json({ error: "Missing query or documentId" });
  }

  if (conversationId) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId, userId, documentId },
      select: { id: true },
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const measure = req.headers["x-eval-timings"] === "1";
  const requestStarted = measure ? performance.now() : 0;
  const timings: SearchTimings & { embed?: number; llm_ttft?: number; llm_total?: number; end_to_end?: number } = {};

  let activeConversationId: string | undefined = conversationId;
  let createdConversation = false;
  let messagesSaved = false;

  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId, userId },
      select: { id: true, status: true, fileName: true },
    });

    if (!doc || doc.status !== "ready") {
      send({ type: "error", message: "Document not found or not ready" });
      return res.end();
    }

    if (!measure) console.log(`[chat] query="${query.substring(0, 120)}" doc=${documentId}`);

    const embedStarted = measure ? performance.now() : 0;
    const queryEmbedding = await generateQueryEmbedding(query.trim());
    if (measure) timings.embed = performance.now() - embedStarted;
    const chunks = await hybridSearch(query.trim(), queryEmbedding, documentId, measure ? { timings, quiet: true } : undefined);

    if (chunks.length === 0) {
      send({
        type: "not_found",
        message: "No relevant content found in this document for your query.",
      });
      if (measure) {
        timings.end_to_end = performance.now() - requestStarted;
        send({ type: "eval_timings", timings });
      }
      return res.end();
    }

    if (!activeConversationId) {
      const conversation = await prisma.conversation.create({
        data: { userId, documentId },
        select: { id: true },
      });
      activeConversationId = conversation.id;
      createdConversation = true;
    }

    const history = await prisma.message.findMany({
      where: { conversationId: activeConversationId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { role: true, content: true },
    });
    history.reverse();

    const contextText = chunks
      .map(
        (c, i) =>
          `[${i + 1}]${c.pageNumber != null ? ` (Page ${c.pageNumber})` : ""} ${c.content}`,
      )
      .join("\n\n");

    if (!measure) console.log(`[chat] context: ${chunks.length} chunks, ~${contextText.length} chars`);

    const pictures = await prisma.documentPicture.findMany({
      where: { documentId, chunkId: { in: chunks.map((chunk) => chunk.id) } },
      take: 4,
    });
    const userParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{
      text: `Context from the document:\n\n${contextText}\n\nQuestion: ${query.trim()}`,
    }];
    for (const picture of pictures) {
      const bytes = await streamToBuffer(await getFileFromS3(picture.s3Key));
      userParts.push({ text: `Document picture on page ${picture.pageNumber ?? "unknown"}:` });
      userParts.push({ inlineData: { mimeType: picture.mimeType, data: bytes.toString("base64") } });
    }

    const contents = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      {
        role: "user",
        parts: userParts,
      },
    ];

    const llmStarted = measure ? performance.now() : 0;
    const tokenCount = await genai.models.countTokens({
      model: GENERATION_MODEL,
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });
    if (!Number.isInteger(tokenCount.totalTokens) || tokenCount.totalTokens! <= 0) {
      throw new Error("Gemini did not return a token count, so Cortex could not check its monthly budget.");
    }
    const reserved = await reserveGeminiBudget(tokenCount.totalTokens!, MAX_OUTPUT_TOKENS);
    if (!reserved) {
      send({
        type: "error",
        message: `Cortex reached its monthly Gemini budget of $${GEMINI_MONTHLY_BUDGET_USD.toFixed(2)}. Ask the administrator to review the budget before continuing.`,
      });
      return res.end();
    }

    const stream = await genai.models.generateContentStream({
      model: GENERATION_MODEL,
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION, maxOutputTokens: MAX_OUTPUT_TOKENS },
    });

    let fullResponse = "";
    let sawFirstToken = false;
    let usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number } | undefined;

    for await (const chunk of stream) {
      if (chunk.usageMetadata) usage = chunk.usageMetadata;
      const text = chunk.text;
      if (text) {
        if (measure && !sawFirstToken) {
          timings.llm_ttft = performance.now() - llmStarted;
          sawFirstToken = true;
        }
        fullResponse += text;
        send({ type: "delta", text });
      }
    }
    if (usage) {
      const actualUsd = estimateGeminiCostUsd(
        usage.promptTokenCount ?? tokenCount.totalTokens ?? 0,
        (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
      );
      await reserved.adjust(actualUsd);
    }
    if (measure) timings.llm_total = performance.now() - llmStarted;

    await prisma.message.createMany({
      data: [
        {
          conversationId: activeConversationId,
          role: "user",
          content: query.trim(),
        },
        {
          conversationId: activeConversationId,
          role: "assistant",
          content: fullResponse,
        },
      ],
    });

    messagesSaved = true;

    const citations = chunks
      .map((c, i) => ({
        index: i + 1,
        pageNumber: c.pageNumber,
        preview: c.content.substring(0, 160),
      }))
      .filter((c) => c.pageNumber != null);

    send({ type: "done", conversationId: activeConversationId, citations });
    if (measure) {
      timings.end_to_end = performance.now() - requestStarted;
      send({ type: "eval_timings", timings });
    }
    res.end();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    console.error("[chat] error:", err);

    if (createdConversation && !messagesSaved && activeConversationId) {
      await prisma.conversation
        .delete({ where: { id: activeConversationId } })
        .catch(() => {});
    }

    send({ type: "error", message });
    res.end();
  }
});
