export const EMBEDDING_MODEL = "jina-embeddings-v3";
const OUTPUT_DIMENSIONALITY = 768;
const EMBEDDING_URL = "https://api.jina.ai/v1/embeddings";

interface JinaEmbeddingResponse {
  data?: Array<{ index?: number; embedding?: number[] }>;
}

async function embed(texts: string[], task: "retrieval.passage" | "retrieval.query"): Promise<number[][]> {
  if (texts.length === 0) return [];
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) throw new Error("JINA_API_KEY is not configured");

  const response = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      task,
      dimensions: OUTPUT_DIMENSIONALITY,
      embedding_type: "float",
      input: texts,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`Jina embedding request failed (${response.status}): ${detail}`);
  }

  const payload = await response.json() as JinaEmbeddingResponse;
  if (!Array.isArray(payload.data) || payload.data.length !== texts.length) {
    throw new Error("Jina returned an incomplete embedding response");
  }
  const ordered = new Array<number[]>(texts.length);
  for (const item of payload.data) {
    if (!Number.isInteger(item.index) || item.index! < 0 || item.index! >= texts.length ||
        !Array.isArray(item.embedding) || item.embedding.length !== OUTPUT_DIMENSIONALITY ||
        !item.embedding.every(Number.isFinite) || ordered[item.index!]) {
      throw new Error("Jina returned invalid embedding data");
    }
    ordered[item.index!] = item.embedding;
  }
  if (ordered.some((vector) => !vector)) throw new Error("Jina omitted an embedding");
  return ordered;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return (await embed([text], "retrieval.passage"))[0];
}

export async function generateQueryEmbedding(text: string): Promise<number[]> {
  return (await embed([text], "retrieval.query"))[0];
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 10;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    results.push(...await embed(texts.slice(i, i + BATCH_SIZE), "retrieval.passage"));
  }
  return results;
}
