import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/** Generated narration lives on disk, outside `public/`, same as generated
 * art — served through /api/audio/[filename] rather than Next's static
 * file convention. Reuses the same hashCacheKey helper as images. */
export const AUDIO_DIR = path.join(process.cwd(), "data", "audio");

async function ensureAudioDir(): Promise<void> {
  await mkdir(AUDIO_DIR, { recursive: true });
}

function filenameForHash(hash: string): string {
  return `${hash}.mp3`;
}

/** Returns the filename if this hash is already cached on disk, else null.
 * Generated narration is always MP3. */
export function getCachedNarration(hash: string): string | null {
  const filename = filenameForHash(hash);
  return existsSync(path.join(AUDIO_DIR, filename)) ? filename : null;
}

export async function saveNarration(hash: string, bytes: Buffer): Promise<string> {
  await ensureAudioDir();
  const filename = filenameForHash(hash);
  await writeFile(path.join(AUDIO_DIR, filename), bytes);
  return filename;
}

export async function readNarrationBytes(filename: string): Promise<Buffer> {
  return readFile(path.join(AUDIO_DIR, filename));
}

/** The URL the browser actually fetches. `filename` is what's stored in the DB. */
export function publicNarrationUrl(filename: string): string {
  return `/api/audio/${filename}`;
}
