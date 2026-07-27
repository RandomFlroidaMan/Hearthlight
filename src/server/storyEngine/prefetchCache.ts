import type { BeatContent } from "./generateBeatContent";

/**
 * In-memory cache of speculatively-generated beat content, keyed by which
 * scene it was guessed from, which choice, and which outcome was assumed.
 * Deliberately NOT persisted to the Scene table — multiple simultaneous
 * candidates for "the next scene" would collide on Scene's
 * @@unique([campaignId, order]), and a lost cache on server restart is a
 * harmless degrade (just slower once), not a correctness issue.
 */
type CacheEntry = Promise<BeatContent | null>;

function keyFor(sceneId: string, choiceIndex: number, assumedSuccess: boolean): string {
  return `${sceneId}:${choiceIndex}:${assumedSuccess}`;
}

const globalForPrefetch = globalThis as unknown as {
  beatPrefetchCache: Map<string, CacheEntry> | undefined;
};

const cache: Map<string, CacheEntry> = globalForPrefetch.beatPrefetchCache ?? new Map();

if (process.env.NODE_ENV !== "production") {
  globalForPrefetch.beatPrefetchCache = cache;
}

export function setPrefetch(sceneId: string, choiceIndex: number, assumedSuccess: boolean, entry: CacheEntry): void {
  cache.set(keyFor(sceneId, choiceIndex, assumedSuccess), entry);
}

export function getPrefetch(sceneId: string, choiceIndex: number, assumedSuccess: boolean): CacheEntry | undefined {
  return cache.get(keyFor(sceneId, choiceIndex, assumedSuccess));
}

/** Called before re-seeding a scene's prefetch entries (including on
 * regenerate, which reuses the same scene id with different choices) so a
 * stale entry can never be served against choices it no longer matches. */
export function clearPrefetchForScene(sceneId: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${sceneId}:`)) {
      cache.delete(key);
    }
  }
}
