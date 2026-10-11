export interface FileRecord {
  id: string;
  userId: string;
  fileName: string;
  s3Key: string;
  fileSize: number;
  mimeType: string;
  status: string;
  errorMessage: string | null;
  createdAt: Date;
  processedAt: Date | null;
}
