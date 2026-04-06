import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EXPRESS_API_URL = process.env.EXPRESS_API_URL ?? "http://localhost:3001";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const document = await prisma.document.findUnique({
      where: { id, userId: session.user.id },
      select: { id: true, status: true },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const expressRes = await fetch(`${EXPRESS_API_URL}/file/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId: id }),
    });

    if (!expressRes.ok) {
      return NextResponse.json({ error: "Failed to trigger reprocessing" }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[documents/id/reprocess] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
