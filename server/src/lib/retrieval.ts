import { prisma } from "./prisma";

const VECTOR_LIMIT = 10;
const KEYWORD_LIMIT = 10;
const TOP_K = 6;
const RRF_K = 60;
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

export async function hybridSearch(
  query: string,
  queryEmbedding: number[],
  documentId: string,
): Promise<RetrievedChunk[]> {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const keywordQuery = buildKeywordQuery(query);

  const [vectorChunks, keywordChunks] = await Promise.all([
    prisma.$queryRawUnsafe<RawChunk[]>(
      `SELECT id, content, "chunkIndex", "pageNumber",
              1 - (embedding <=> $1::vector) AS score
       FROM "DocumentChunk"
       WHERE "documentId" = $2
       ORDER BY score DESC
       LIMIT ${VECTOR_LIMIT}`,
      vectorLiteral,
      documentId,
    ),

    keywordQuery ? prisma.$queryRawUnsafe<RawChunk[]>(
      `SELECT id, content, "chunkIndex", "pageNumber",
              ts_rank_cd(to_tsvector('english', content), to_tsquery('english', $1)) AS score
       FROM "DocumentChunk"
       WHERE "documentId" = $2
         AND to_tsvector('english', content) @@ to_tsquery('english', $1)
       ORDER BY score DESC
       LIMIT ${KEYWORD_LIMIT}`,
      keywordQuery,
      documentId,
    ) : Promise.resolve([]),
  ]);

  console.log(
    `[retrieval] vector=${vectorChunks.length} keyword=${keywordChunks.length}`,
  );
  console.log(
    "[retrieval] vector results:",
    vectorChunks.map((c) => ({
      idx: c.chunkIndex,
      page: c.pageNumber,
      score: Number(c.score).toFixed(4),
      preview: c.content.substring(0, 70),
    })),
  );
  console.log(
    "[retrieval] keyword results:",
    keywordChunks.map((c) => ({
      idx: c.chunkIndex,
      page: c.pageNumber,
      score: Number(c.score).toFixed(6),
      preview: c.content.substring(0, 70),
    })),
  );

  return mergeWithRRF(vectorChunks, keywordChunks);
}

export function mergeWithRRF(
  vectorChunks: RawChunk[],
  keywordChunks: RawChunk[],
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
    .slice(0, TOP_K)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);

  console.log(
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
