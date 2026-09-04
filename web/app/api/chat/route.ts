import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EXPRESS_API_URL = process.env.EXPRESS_API_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query, documentId, conversationId } = (await req.json()) as {
    query: string;
    documentId: string;
    conversationId?: string;
  };

  if (!query?.trim() || !documentId) {
    return NextResponse.json(
      { error: "Missing query or documentId" },
      { status: 400 },
    );
  }

  const doc = await prisma.document.findUnique({
    where: { id: documentId, userId: session.user.id },
    select: { id: true, status: true },
  });

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.status !== "ready") {
    return NextResponse.json(
      { error: "Document is not ready" },
      { status: 400 },
    );
  }

  const expressRes = await fetch(`${EXPRESS_API_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": process.env.INTERNAL_API_SECRET!,
      "X-User-Id": session.user.id,
    },
    body: JSON.stringify({ query, documentId, conversationId }),
  });

  if (!expressRes.ok) {
    const errorBody = await expressRes.text();

    console.error("Express /chat failed:", {
      status: expressRes.status,
      statusText: expressRes.statusText,
      body: errorBody,
    });

    if (expressRes.status === 429) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. You can send up to 15 messages per minute.",
        },
        { status: 429 },
      );
    }

    return NextResponse.json(
      {
        error: "Chat service unavailable",
        upstreamStatus: expressRes.status,
        upstreamError: errorBody,
      },
      { status: 502 },
    );
  }

  if (!expressRes.body) {
    console.error("Express returned success but no response body");

    return NextResponse.json(
      { error: "Chat service returned no response body" },
      { status: 502 },
    );
  }

  return new NextResponse(expressRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
