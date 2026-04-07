import { NextRequest } from "next/server";

const EXPRESS_API_URL = process.env.EXPRESS_API_URL ?? "http://localhost:3001";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await params;

  const expressRes = await fetch(`${EXPRESS_API_URL}/file/status/${fileId}`, {
    headers: { Accept: "text/event-stream" },
  });

  return new Response(expressRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
