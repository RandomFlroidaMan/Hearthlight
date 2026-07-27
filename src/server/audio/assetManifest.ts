import { readdir } from "node:fs/promises";
import path from "node:path";
import { ambientTracks } from "@/server/storyEngine/beatSchema";

// Preference order when more than one extension exists for the same key —
// smaller/faster-loading formats first, since a loop needs to start
// instantly and lossless formats (flac) can be large over a home LAN.
const EXTENSION_PREFERENCE = ["mp3", "m4a", "mp4", "wav", "flac", "ogg"] as const;

export const sfxKeys = ["choice-select", "success", "setback", "natural20", "item-reward"] as const;
export type SfxKey = (typeof sfxKeys)[number];

const AMBIENT_DIR = path.join(process.cwd(), "public", "audio", "ambient");
const SFX_DIR = path.join(process.cwd(), "public", "audio", "sfx");

async function resolveDir(dir: string, publicPrefix: string, keys: readonly string[]): Promise<Record<string, string | null>> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    entries = [];
  }

  const result: Record<string, string | null> = {};
  for (const key of keys) {
    let resolved: string | null = null;
    for (const ext of EXTENSION_PREFERENCE) {
      const filename = `${key}.${ext}`;
      if (entries.includes(filename)) {
        resolved = `${publicPrefix}/${filename}`;
        break;
      }
    }
    result[key] = resolved;
  }
  return result;
}

export type AmbientKey = Exclude<(typeof ambientTracks)[number], "none">;

export interface AudioManifest {
  ambient: Record<AmbientKey, string | null>;
  sfx: Record<SfxKey, string | null>;
}

/** Scans public/audio/{ambient,sfx} for user-supplied files and resolves
 * each known key to a public URL, or null if nothing's been added yet —
 * everything downstream must degrade to silence, never an error, same
 * resilience rule as scene art never showing a placeholder box. */
export async function getAudioManifest(): Promise<AudioManifest> {
  const ambientKeys = ambientTracks.filter((t) => t !== "none");
  const [ambient, sfx] = await Promise.all([
    resolveDir(AMBIENT_DIR, "/audio/ambient", ambientKeys),
    resolveDir(SFX_DIR, "/audio/sfx", sfxKeys),
  ]);
  return {
    ambient: ambient as AudioManifest["ambient"],
    sfx: sfx as AudioManifest["sfx"],
  };
}
