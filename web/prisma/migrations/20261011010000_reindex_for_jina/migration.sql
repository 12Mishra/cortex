-- A 768-dimensional Jina vector cannot be compared meaningfully with a
-- 768-dimensional Gemini vector. Preserve old chunks, but require reindexing
-- before these documents can be used for chat again.
UPDATE "Document"
SET "status" = 'failed',
    "errorMessage" = 'Embedding model changed to Jina. Retry processing to rebuild this document index.'
WHERE "status" = 'ready';
