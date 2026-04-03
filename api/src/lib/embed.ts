import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({});

const EMBEDDING_MODEL = "gemini-embedding-001";
const OUTPUT_DIMENSIONALITY = 768;

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await genai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: { outputDimensionality: OUTPUT_DIMENSIONALITY },
  });
  return response.embeddings![0].values!;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 10;
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await genai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: batch,
      config: { outputDimensionality: OUTPUT_DIMENSIONALITY },
    });
    results.push(...response.embeddings!.map((e) => e.values!));
  }

  return results;
}
