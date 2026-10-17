import { prisma } from "./prisma";

export const VECTOR_LIMIT = 10;
export const KEYWORD_LIMIT = 10;
export const TOP_K = 6;
export const RRF_K = 60;
const MAX_KEYWORD_TERMS = 24;

// Candidate generation needs to match a chunk covering any part of a broad
// question. PostgreSQL's plainto_tsquery joins all terms with AND, which can
// exclude every section of a multi-part document question.
const QUERY_STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "by", "can",
  "describe", "described", "distinguish", "do", "does", "document", "for",
  "from", "how", "in", "is", "it", "its", "many", "mention", "mentions",
  "multiple", "of", "on", "or", "our", "the", "their", "these", "this",
  "to", "what", "when", "where", "which", "who", "with",
]);

export function buildKeywordQuery(query: string): string {
  const terms = Array.from(new Set(
    (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((word) => (word.length >= 3 || word === "ai") && !QUERY_STOP_WORDS.has(word)),
  ));
  return terms.slice(0, MAX_KEYWORD_TERMS).join(" | ");
}

export interface RawChunk {
  id: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  score: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  vectorScore: number;
  keywordScore: number;
  hybridScore: number;
}

export interface SearchTimings {
  bm25?: number;
  vector?: number;
  rrf?: number;
}

export interface SearchOptions {
  /** Evaluation keeps score order and can inspect all ten candidates. */
  evaluation?: boolean;
  limit?: number;
  timings?: SearchTimings;
  quiet?: boolean;
}

export async function vectorSearch(queryEmbedding: number[], documentId: string, timings?: SearchTimings): Promise<RawChunk[]> {
  const started = performance.now();
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const chunks = await prisma.$queryRawUnsafe<RawChunk[]>(
    `SELECT id, content, "chunkIndex", "pageNumber",
            1 - (embedding <=> $1::vector) AS score
     FROM "DocumentChunk"
     WHERE "documentId" = $2
     ORDER BY score DESC
     LIMIT ${VECTOR_LIMIT}`,
    vectorLiteral,
    documentId,
  );
  if (timings) timings.vector = performance.now() - started;
  return chunks;
}

export async function keywordSearch(query: string, documentId: string, timings?: SearchTimings): Promise<RawChunk[]> {
  const keywordQuery = buildKeywordQuery(query);
  if (!keywordQuery) {
    if (timings) timings.bm25 = 0;
    return [];
  }
  const started = performance.now();
  const chunks = await prisma.$queryRawUnsafe<RawChunk[]>(
    `SELECT id, content, "chunkIndex", "pageNumber",
            ts_rank_cd(to_tsvector('english', content), to_tsquery('english', $1)) AS score
     FROM "DocumentChunk"
     WHERE "documentId" = $2
       AND to_tsvector('english', content) @@ to_tsquery('english', $1)
     ORDER BY score DESC
     LIMIT ${KEYWORD_LIMIT}`,
    keywordQuery,
    documentId,
  );
  if (timings) timings.bm25 = performance.now() - started;
  return chunks;
}

export async function hybridSearch(
  query: string,
  queryEmbedding: number[],
  documentId: string,
  options: SearchOptions = {},
): Promise<RetrievedChunk[]> {
  const [vectorChunks, keywordChunks] = await Promise.all([
    vectorSearch(queryEmbedding, documentId, options.timings),
    keywordSearch(query, documentId, options.timings),
  ]);

  if (!options.evaluation && !options.quiet) console.log(
    `[retrieval] vector=${vectorChunks.length} keyword=${keywordChunks.length}`,
  );
  if (!options.evaluation && !options.quiet) console.log(
    "[retrieval] vector results:",
    vectorChunks.map((c) => ({
      idx: c.chunkIndex,
      page: c.pageNumber,
      score: Number(c.score).toFixed(4),
      preview: c.content.substring(0, 70),
    })),
  );
  if (!options.evaluation && !options.quiet) console.log(
    "[retrieval] keyword results:",
    keywordChunks.map((c) => ({
      idx: c.chunkIndex,
      page: c.pageNumber,
      score: Number(c.score).toFixed(6),
      preview: c.content.substring(0, 70),
    })),
  );

  const started = options.timings ? performance.now() : 0;
  const merged = mergeWithRRF(vectorChunks, keywordChunks, options);
  if (options.timings) options.timings.rrf = performance.now() - started;
  return merged;
}

export function mergeWithRRF(
  vectorChunks: RawChunk[],
  keywordChunks: RawChunk[],
  options: SearchOptions = {},
): RetrievedChunk[] {
  const map = new Map<string, RetrievedChunk>();

  vectorChunks.forEach((chunk, rank) => {
    map.set(chunk.id, {
      id: chunk.id,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      vectorScore: Number(chunk.score),
      keywordScore: 0,
      hybridScore: 1 / (RRF_K + rank + 1),
    });
  });

  keywordChunks.forEach((chunk, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = map.get(chunk.id);
    if (existing) {
      existing.hybridScore += rrfScore;
      existing.keywordScore = Number(chunk.score);
    } else {
      map.set(chunk.id, {
        id: chunk.id,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        vectorScore: 0,
        keywordScore: Number(chunk.score),
        hybridScore: rrfScore,
      });
    }
  });

  const topK = Array.from(map.values())
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, options.evaluation ? (options.limit ?? VECTOR_LIMIT) : TOP_K);
  if (!options.evaluation) topK.sort((a, b) => a.chunkIndex - b.chunkIndex);

  if (!options.evaluation && !options.quiet) console.log(
    "[retrieval] final context (doc order):",
    topK.map((c) => ({
      idx: c.chunkIndex,
      page: c.pageNumber,
      hybrid: c.hybridScore.toFixed(6),
      vector: c.vectorScore.toFixed(4),
      keyword: c.keywordScore.toFixed(6),
      preview: c.content.substring(0, 70),
    })),
  );

  return topK;
}