import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const EXPRESS_API_URL = process.env.EXPRESS_API_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  if (typeof body.fileId !== "string" || !body.fileId) {
    return NextResponse.json({ error: "Missing file ID" }, { status: 400 });
  }
  const document = await prisma.document.findUnique({
    where: { id: body.fileId, userId: session.user.id },
    select: { id: true },
  });
  if (!document) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const expressRes = await fetch(`${EXPRESS_API_URL}/file/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": process.env.INTERNAL_API_SECRET!,
      "X-User-Id": session.user.id,
    },
    body: JSON.stringify(body),
  });

  const data = await expressRes.json();
  return NextResponse.json(data, { status: expressRes.status });
}
