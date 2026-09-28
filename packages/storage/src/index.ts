import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface PresignResult {
  uploadUrl: string;
  storageKey: string;
  method: "PUT";
  headers?: Record<string, string>;
  localDev?: boolean;
}

function useS3(): boolean {
  return Boolean(process.env.S3_BUCKET);
}

/** Repo root so API + worker share the same disk path when LOCAL_STORAGE_PATH is relative. */
function monorepoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../..");
}

function localRoot(): string {
  const configured = process.env.LOCAL_STORAGE_PATH;
  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.resolve(monorepoRoot(), configured);
  }
  return path.join(monorepoRoot(), "data", "uploads");
}

function s3Client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION ?? "auto",
    endpoint: process.env.S3_ENDPOINT,
    credentials: process.env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        }
      : undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  });
}

export async function presignUpload(
  storageKey: string,
  mimeType: string,
  apiBase?: string,
): Promise<PresignResult> {
  if (useS3()) {
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: storageKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(s3Client(), command, { expiresIn: 900 });
    return { uploadUrl, storageKey, method: "PUT", headers: { "Content-Type": mimeType } };
  }

  const base = apiBase ?? process.env.API_PUBLIC_URL ?? "http://localhost:3000/api/v1";
  return {
    uploadUrl: `${base}/files/upload/${encodeURIComponent(storageKey)}`,
    storageKey,
    method: "PUT",
    headers: { "Content-Type": mimeType },
    localDev: true,
  };
}

export async function putObject(storageKey: string, body: Buffer, mimeType: string) {
  if (useS3()) {
    await s3Client().send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: storageKey,
        Body: body,
        ContentType: mimeType,
      }),
    );
    return;
  }
  const filePath = path.join(localRoot(), storageKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}

export async function getObject(storageKey: string): Promise<Buffer> {
  if (useS3()) {
    const res = await s3Client().send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: storageKey,
      }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new Error("Empty S3 object");
    return Buffer.from(bytes);
  }
  return readFile(path.join(localRoot(), storageKey));
}

export function publicUrl(storageKey: string): string {
  if (process.env.CDN_BASE_URL) {
    return `${process.env.CDN_BASE_URL.replace(/\/$/, "")}/${storageKey}`;
  }
  const base = process.env.API_PUBLIC_URL ?? "http://localhost:3000/api/v1";
  return `${base}/files/download?key=${encodeURIComponent(storageKey)}`;
}
