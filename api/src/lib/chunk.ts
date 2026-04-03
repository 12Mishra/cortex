const CHUNK_SIZE = 800;   
const CHUNK_OVERLAP = 150; 

export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + CHUNK_SIZE;

    if (end < cleaned.length) {
      const searchFrom = start + Math.floor(CHUNK_SIZE * 0.7);
      const sentenceEnd = cleaned.search(
        new RegExp(`[.!?](?=\\s)`, "g"),
      );

      let breakAt = -1;
      for (let i = end; i >= searchFrom; i--) {
        if (".!?".includes(cleaned[i]) && cleaned[i + 1] === " ") {
          breakAt = i + 1;
          break;
        }
      }

      if (breakAt !== -1) end = breakAt;
    }

    const chunk = cleaned.slice(start, Math.min(end, cleaned.length)).trim();
    if (chunk.length > 0) chunks.push(chunk);

    start = end - CHUNK_OVERLAP;
  }

  return chunks;
}
