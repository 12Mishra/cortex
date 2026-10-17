// Run against a local dev server: node --env-file=.env --test tests/guest-workspace.integration.mjs
// Creates isolated synthetic fixtures and deletes only those fixtures afterward.
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

function samplePdf() {
  const text = "BT /F1 12 Tf 40 200 Td (Cortex guest upload verification.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

function client() {
  const cookies = new Map();
  return async (path, body) => {
    const response = await fetch(`${base}${path}`, {
      method: body ? "POST" : "GET",
      headers: { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    });
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(";")[0];
      const index = pair.indexOf("=");
      cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  };
}

test("guest sessions isolate documents, conversations, uploads and processing", async () => {
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
  const userIds = [];
  let documentId;
  let conversationId;
  let uploadedKey;
  try {
    const anonymous = client();
    assert.equal((await anonymous("/api/documents")).status, 401);
    assert.equal((await anonymous("/api/file/status/not-owned")).status, 401);
    const guests = [client(), client()];
    for (const guest of guests) {
      const { csrfToken } = await (await guest("/api/auth/csrf")).json();
      await guest("/api/auth/callback/guest", { csrfToken, callbackUrl: `${base}/test` });
      const session = await (await guest("/api/auth/session")).json();
      assert.equal(session.user.isGuest, true);
      assert.equal(session.user.name, "Guest");
      userIds.push(session.user.id);
    }
    assert.notEqual(userIds[0], userIds[1]);
    const [owner, other] = guests;
    const pdf = samplePdf();
    const metadata = { fileName: "guest-isolation-test.pdf", fileSize: pdf.length, mimeType: "application/pdf" };
    const presign = await owner("/api/upload", { action: "presign", ...metadata });
    assert.equal(presign.status, 200);
    const { presignedUrl, s3Key } = await presign.json();
    uploadedKey = s3Key;
    assert.equal((await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: pdf })).status, 200);
    const confirm = await owner("/api/upload", { action: "confirm", s3Key, ...metadata });
    assert.equal(confirm.status, 201);
    const { document: doc } = await confirm.json();
    documentId = doc.id;
    assert.equal(doc.userId, userIds[0]);
    assert.equal(doc.status, "uploaded");
    // Use ready status solely to exercise chat ownership without invoking AI.
    await prisma.document.update({ where: { id: documentId }, data: { status: "ready" } });
    const conversation = await prisma.conversation.create({ data: { userId: userIds[0], documentId } });
    conversationId = conversation.id;
    assert.equal((await owner(`/api/documents/${documentId}`)).status, 200);
    assert.equal((await other(`/api/documents/${documentId}`)).status, 404);
    assert.equal((await other("/api/documents")).status, 200);
    assert.deepEqual((await (await other("/api/documents")).json()).data, []);
    assert.equal((await owner(`/api/conversations/${conversationId}/messages`)).status, 200);
    assert.equal((await other(`/api/conversations/${conversationId}/messages`)).status, 404);
    assert.equal((await other("/api/file/process", { fileId: documentId })).status, 404);
    assert.equal((await other(`/api/file/status/${documentId}`)).status, 404);
    assert.equal((await other(`/api/documents/${documentId}/reprocess`, {})).status, 404);
    assert.equal((await other("/api/chat", { documentId, query: "Private document?" })).status, 404);
    assert.equal((await owner("/api/chat", { documentId, conversationId: randomUUID(), query: "Wrong conversation?" })).status, 404);
    assert.equal((await other("/api/upload", { action: "confirm", s3Key: doc.s3Key, fileName: "test.pdf", fileSize: 100, mimeType: "application/pdf" })).status, 403);
    for (const body of [
      { fileName: "test.txt", fileSize: 100, mimeType: "text/plain" },
      { fileName: "test.pdf", fileSize: 50 * 1024 * 1024 + 1, mimeType: "application/pdf" },
      { fileName: "test.pdf", fileSize: -1, mimeType: "application/pdf" },
    ]) assert.equal((await owner("/api/upload", { action: "presign", ...body })).status, 400);
    const { csrfToken } = await (await owner("/api/auth/csrf")).json();
    await owner("/api/auth/signout", { csrfToken, callbackUrl: base });
    assert.equal((await owner("/api/documents")).status, 401);
  } finally {
    if (conversationId) await prisma.conversation.delete({ where: { id: conversationId } });
    if (documentId) await prisma.document.delete({ where: { id: documentId } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds }, provider: "guest" } });
    await prisma.$disconnect();
    if (uploadedKey) {
      const s3 = new S3Client({ region: process.env.AWS_S3_REGION, credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY, secretAccessKey: process.env.AWS_S3_SECRET_KEY,
      } });
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET_NAME, Key: uploadedKey }));
      s3.destroy();
    }
  }
});
