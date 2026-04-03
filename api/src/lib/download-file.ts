import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../config/s3";

export async function getFileFromS3(key: string) {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
  });

  const response = await s3.send(command);

  return response.Body;
}
