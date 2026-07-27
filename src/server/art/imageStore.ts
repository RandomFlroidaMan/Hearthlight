import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "@/server/config/dataDir";

/** Generated art lives on disk, outside `public/`, per the brief — served
 * through /api/images/[filename] rather than Next's static file convention. */
export const IMAGES_DIR = path.join(DATA_DIR, "images");

async function ensureImagesDir(): Promise<void> {
  await mkdir(IMAGES_DIR, { recursive: true });
}

/** Cache key = hash of the prompt plus every reference image's own bytes, so
 * an identical prompt + identical references never regenerates. */
export function hashCacheKey(parts: Array<string | Buffer>): string {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part);
  return hash.digest("hex");
}

function filenameForHash(hash: string, extension: string): string {
  return `${hash}.${extension}`;
}

/** Returns the filename if this hash is already cached on disk, else null.
 * Generated images are always PNG. */
export function getCachedImage(hash: string): string | null {
  const filename = filenameForHash(hash, "png");
  return existsSync(path.join(IMAGES_DIR, filename)) ? filename : null;
}

export async function saveImage(hash: string, bytes: Buffer): Promise<string> {
  await ensureImagesDir();
  const filename = filenameForHash(hash, "png");
  await writeFile(path.join(IMAGES_DIR, filename), bytes);
  return filename;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** For user-uploaded reference images, which may not be PNG. Deduped by the
 * hash of their own bytes, same as generated images. */
export async function saveUploadedImage(bytes: Buffer, mimeType: string): Promise<string> {
  const extension = EXTENSION_BY_MIME[mimeType];
  if (!extension) {
    throw new Error(`Unsupported reference image type: ${mimeType}`);
  }
  await ensureImagesDir();
  const hash = hashCacheKey([bytes]);
  const filename = filenameForHash(hash, extension);
  if (!existsSync(path.join(IMAGES_DIR, filename))) {
    await writeFile(path.join(IMAGES_DIR, filename), bytes);
  }
  return filename;
}

export async function readImageBytes(filename: string): Promise<Buffer> {
  return readFile(path.join(IMAGES_DIR, filename));
}

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function mimeTypeForFilename(filename: string): string {
  const extension = filename.split(".").pop() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
}

/** The URL the browser actually fetches. `filename` is what's stored in the DB. */
export function publicImageUrl(filename: string): string {
  return `/api/images/${filename}`;
}
