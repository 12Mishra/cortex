export interface StructuredChunk {
  content: string;
  pageNumber: number | null;
  chunkIndex: number;
  tokenCount: number | null;
  docItems: string[];
}

export interface ExportedPicture {
  ref: string;
  pageNumber: number | null;
  mimeType: string;
  bytes: Buffer;
}

interface DoclingResponse {
  chunks?: Array<{
    text?: string;
    chunk_index?: number;
    num_tokens?: number;
    page_numbers?: number[];
    doc_items?: string[];
  }>;
  documents?: Array<{
    status?: string;
    content?: {
      json_content?: {
        pictures?: Array<{
          self_ref?: string;
          prov?: Array<{ page_no?: number }>;
          image?: { mimetype?: string; uri?: string };
        }>;
      };
    };
  }>;
}

export function parseDoclingResponse(data: DoclingResponse): {
  chunks: StructuredChunk[];
  pictures: ExportedPicture[];
} {
  if (!Array.isArray(data.chunks) || !Array.isArray(data.documents) || data.documents.length !== 1) {
    throw new Error("Docling returned an invalid chunk response");
  }
  if (data.documents.some((document) => document.status !== "success")) {
    throw new Error("Docling could not fully convert the PDF");
  }
  if (!data.documents[0].content?.json_content) {
    throw new Error("Docling did not return structured document data");
  }

  const chunks = data.chunks.map((chunk, chunkIndex) => ({
    content: (chunk.text ?? "").trim(),
    pageNumber: chunk.page_numbers?.find((n) => Number.isInteger(n) && n > 0) ?? null,
    chunkIndex,
    tokenCount: Number.isInteger(chunk.num_tokens) ? chunk.num_tokens! : null,
    docItems: Array.isArray(chunk.doc_items) ? chunk.doc_items : [],
  })).filter((chunk) => chunk.content.length > 0);

  const pictures: ExportedPicture[] = [];
  for (const picture of data.documents[0]?.content?.json_content?.pictures ?? []) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(picture.image?.uri ?? "");
    if (!picture.self_ref || !match) {
      throw new Error("Docling detected a picture but did not export its image bytes");
    }
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length) throw new Error("Docling returned an empty picture");
    pictures.push({
      ref: picture.self_ref,
      pageNumber: picture.prov?.[0]?.page_no ?? null,
      mimeType: match[1],
      bytes,
    });
  }
  return { chunks, pictures };
}

export async function chunkPdfWithDocling(buffer: Buffer, fileName: string) {
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), fileName);
  form.append("convert_from_formats", "pdf");
  form.append("convert_image_export_mode", "embedded");
  form.append("convert_include_images", "true");
  form.append("convert_do_ocr", "true");
  form.append("convert_do_table_structure", "true");
  form.append("convert_do_pdf_heading_hierarchy", "true");
  form.append("chunking_use_markdown_tables", "true");
  form.append("chunking_max_tokens", "512");
  form.append("include_converted_doc", "true");

  const baseUrl = (process.env.DOCLING_SERVE_URL ?? "http://localhost:5001").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/v1/chunk/hybrid/file`, {
    method: "POST",
    body: form,
    headers: process.env.DOCLING_SERVE_API_KEY
      ? { "X-Api-Key": process.env.DOCLING_SERVE_API_KEY }
      : undefined,
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });
  if (!response.ok) {
    throw new Error(`Docling request failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
  return parseDoclingResponse(await response.json() as DoclingResponse);
}
