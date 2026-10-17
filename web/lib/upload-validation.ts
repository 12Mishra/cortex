export const MAX_PDF_BYTES = 50 * 1024 * 1024;

export function validPdfUpload(fileName: unknown, fileSize: unknown, mimeType: unknown): boolean {
  return typeof fileName === "string" && fileName.length <= 255 && /\.pdf$/i.test(fileName)
    && typeof fileSize === "number" && Number.isInteger(fileSize)
    && fileSize > 0 && fileSize <= MAX_PDF_BYTES && mimeType === "application/pdf";
}

export function ownsUploadKey(key: unknown, userId: string): key is string {
  if (typeof key !== "string") return false;
  const prefix = `uploads/${userId}/`;
  return key.startsWith(prefix) && /^[0-9a-f-]{36}\.pdf$/i.test(key.slice(prefix.length));
}
