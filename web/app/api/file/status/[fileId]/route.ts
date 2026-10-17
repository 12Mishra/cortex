import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EXPRESS_API_URL = process.env.EXPRESS_API_URL ?? "http://localhost:3001";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { fileId } = await params;
  const document = await prisma.document.findUnique({
    where: { id: fileId, userId: session.user.id },
    select: { id: true },
  });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const expressRes = await fetch(`${EXPRESS_API_URL}/file/status/${fileId}`, {
    headers: {
      Accept: "text/event-stream",
      "X-Internal-Secret": process.env.INTERNAL_API_SECRET!,
      "X-User-Id": session.user.id,
    },
    signal: _req.signal,
  });

  if (!expressRes.ok) return NextResponse.json({ error: "Could not read processing status" }, { status: 502 });

  return new Response(expressRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
