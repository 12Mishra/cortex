CREATE TABLE "DocumentPicture" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkId" TEXT,
    "doclingRef" TEXT NOT NULL,
    "pageNumber" INTEGER,
    "s3Key" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    CONSTRAINT "DocumentPicture_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentPicture_documentId_doclingRef_key" ON "DocumentPicture"("documentId", "doclingRef");
CREATE INDEX "DocumentPicture_chunkId_idx" ON "DocumentPicture"("chunkId");
ALTER TABLE "DocumentPicture" ADD CONSTRAINT "DocumentPicture_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentPicture" ADD CONSTRAINT "DocumentPicture_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;
