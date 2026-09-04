const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 150;

export interface PageChunk {
  content: string;
  pageNumber: number;
  chunkIndex: number;
}

export function chunkText(text: string): string[] {
  const cleaned = text.replace(/[^a-zA-Z0-9.,!?()\-\s]/g, "");
  if (!cleaned) return [];

  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);

  const chunks: string[] = [];
  let currentSentences: string[] = [];

  for (const sentence of sentences) {
    const joined = currentSentences.join(" ");

    if ((joined + " " + sentence).length <= CHUNK_SIZE) {
      currentSentences.push(sentence);
    } else {
      if (currentSentences.length > 0) {
        chunks.push(currentSentences.join(" ").trim());
      }

      const overlapSentences: string[] = [];
      let overlapLen = 0;
      for (let i = currentSentences.length - 1; i >= 0; i--) {
        const s = currentSentences[i];
        if (overlapLen + s.length + 1 > CHUNK_OVERLAP) break;
        overlapSentences.unshift(s);
        overlapLen += s.length + 1;
      }

      currentSentences = [...overlapSentences, sentence];
    }
  }

  if (currentSentences.length > 0) {
    chunks.push(currentSentences.join(" ").trim());
  }

  return chunks;
}

export function chunkPageTexts(
  pageTexts: { pageNumber: number; text: string }[],
): PageChunk[] {
  const result: PageChunk[] = [];
  let globalIndex = 0;

  for (const { pageNumber, text } of pageTexts) {
    const chunks = chunkText(text);
    for (const chunk of chunks) {
      result.push({ content: chunk, pageNumber, chunkIndex: globalIndex++ });
    }
  }

  return result;
}
