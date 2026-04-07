import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const EXPRESS_API_URL = process.env.EXPRESS_API_URL ?? "http://localhost:3001";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const expressRes = await fetch(`${EXPRESS_API_URL}/file/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await expressRes.json();
  return NextResponse.json(data, { status: expressRes.status });
}
