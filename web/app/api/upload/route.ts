import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { auth } from "@/lib/auth";
import { s3, S3_BUCKET } from "@/lib/s3";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { ownsUploadKey, validPdfUpload } from "@/lib/upload-validation";


export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    if (!validPdfUpload(body.fileName, body.fileSize, body.mimeType)) {
      return NextResponse.json({ error: "Upload a PDF between 1 byte and 50 MB." }, { status: 400 });
    }

    if (body.action === "presign") {
      const { fileName, fileSize, mimeType } = body as {
        fileName: string;
        fileSize: number;
        mimeType: string;
      };

      if (!fileName || !mimeType) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }

      const s3Key = `uploads/${session.user.id}/${randomUUID()}.pdf`;

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        ContentType: mimeType,
        ContentLength: fileSize,
      });

      const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

      return NextResponse.json({ presignedUrl, s3Key });
    }

    if (body.action === "confirm") {
      const { s3Key, fileName, fileSize, mimeType } = body as {
        s3Key: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
      };

      if (!s3Key || !fileName) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }

      if (!ownsUploadKey(s3Key, session.user.id)) {
        return NextResponse.json({ error: "Invalid upload key" }, { status: 403 });
      }
      const uploaded = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: s3Key }));
      if (uploaded.ContentLength !== fileSize || uploaded.ContentType !== "application/pdf") {
        return NextResponse.json({ error: "Uploaded file does not match the declared PDF." }, { status: 400 });
      }
      const existing = await prisma.document.findFirst({ where: { userId: session.user.id, s3Key } });
      if (existing) return NextResponse.json({ document: existing });

      const document = await prisma.document.create({
        data: {
          userId: session.user.id,
          fileName,
          s3Key,
          fileSize: fileSize ?? null,
          mimeType: mimeType ?? null,
          status: "uploaded",
        },
      });

      return NextResponse.json({ document }, { status: 201 });
    }
    return NextResponse.json({ error: "Invalid upload action" }, { status: 400 });
  } catch (error) {
    console.error("[upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
