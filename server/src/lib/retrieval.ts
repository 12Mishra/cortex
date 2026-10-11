import { prisma } from "./prisma";

const SIMILARITY_FLOOR = 0.5;
const VECTOR_LIMIT = 10;
const KEYWORD_LIMIT = 10;
const TOP_K = 6;
const RRF_K = 60;


interface RawChunk {
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

  const [vectorChunks, keywordChunks] = await Promise.all([
    prisma.$queryRawUnsafe<RawChunk[]>(
      `SELECT id, content, "chunkIndex", "pageNumber",
              1 - (embedding <=> $1::vector) AS score
       FROM "DocumentChunk"
       WHERE "documentId" = $2
         AND 1 - (embedding <=> $1::vector) > $3
       ORDER BY score DESC
       LIMIT ${VECTOR_LIMIT}`,
      vectorLiteral,
      documentId,
      SIMILARITY_FLOOR,
    ),

    prisma.$queryRawUnsafe<RawChunk[]>(
      `SELECT id, content, "chunkIndex", "pageNumber",
              ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) AS score
       FROM "DocumentChunk"
       WHERE "documentId" = $2
         AND to_tsvector('english', content) @@ plainto_tsquery('english', $1)
       ORDER BY score DESC
       LIMIT ${KEYWORD_LIMIT}`,
      query,
      documentId,
    ),
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

function mergeWithRRF(
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
