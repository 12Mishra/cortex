import express from "express";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "../lib/prisma";
import { generateQueryEmbedding } from "../lib/embed";
import { hybridSearch } from "../lib/retrieval";

export const chatRouter = express.Router();

const genai = new GoogleGenAI({});

const GENERATION_MODEL = "gemini-3.1-pro-preview";
const HISTORY_LIMIT = 10;

const SYSTEM_INSTRUCTION = `You are Cortex, an AI assistant that answers questions strictly based on provided document context.
Answer only from the context given. If the answer cannot be found in the context, say so clearly.
Be concise, accurate, and cite relevant details from the context when appropriate.
When referring to a source, use the bracketed reference numbers provided (e.g. [1], [2]).`;

chatRouter.post("/", async (req, res) => {
  const secret = req.headers["x-internal-secret"];
  if (secret !== process.env.INTERNAL_API_SECRET) {
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

  if (!query?.trim() || !documentId) {
    return res.status(400).json({ error: "Missing query or documentId" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

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

    console.log(`[chat] query="${query.substring(0, 120)}" doc=${documentId}`);

    const queryEmbedding = await generateQueryEmbedding(query.trim());
    const chunks = await hybridSearch(query.trim(), queryEmbedding, documentId);

    if (chunks.length === 0) {
      send({
        type: "not_found",
        message: "No relevant content found in this document for your query.",
      });
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

    console.log(`[chat] context: ${chunks.length} chunks, ~${contextText.length} chars`);

    const contents = [
      ...history.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      {
        role: "user",
        parts: [
          {
            text: `Context from the document:\n\n${contextText}\n\nQuestion: ${query.trim()}`,
          },
        ],
      },
    ];

    const stream = await genai.models.generateContentStream({
      model: GENERATION_MODEL,
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        send({ type: "delta", text });
      }
    }

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
