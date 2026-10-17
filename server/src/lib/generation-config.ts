export const GENERATION_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-pro-preview";
export const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? "1024");

if (!Number.isInteger(MAX_OUTPUT_TOKENS) || MAX_OUTPUT_TOKENS <= 0) {
  throw new Error("GEMINI_MAX_OUTPUT_TOKENS must be a positive integer");
}

export const SYSTEM_INSTRUCTION = `You are Cortex, an AI assistant that answers questions strictly based on provided document context.
Answer only from the context given. If the answer cannot be found in the context, say so clearly.
Be concise, accurate, and cite relevant details from the context when appropriate.
When referring to a source, use the bracketed reference numbers provided (e.g. [1], [2]).`;
