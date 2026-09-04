
ALTER TABLE "DocumentChunk" ADD COLUMN "pageNumber" INTEGER;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "DocumentChunk_content_fts_idx"
ON "DocumentChunk" USING gin(to_tsvector('english', content));
