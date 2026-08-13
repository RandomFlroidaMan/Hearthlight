import type { Beat } from "./beatSchema";
import type { BeatMedia } from "./generateBeatContent";

/**
 * In-memory cache of speculatively-generated beat content, keyed by which
 * scene it was guessed from, which choice, and which outcome was assumed.
 * Deliberately NOT persisted to the Scene table — multiple simultaneous
 * candidates for "the next scene" would collide on Scene's
 * @@unique([campaignId, order]), and a lost cache on server restart is a
 * harmless degrade (just slower once), not a correctness issue.
 *
 * Split into a text half and a media (art+narration) half — rather than
 * one combined promise — so a consumer that hits this cache mid-flight
 * (prefetch started, but hasn't finished) can still reveal the text the
 * moment it resolves instead of waiting on the slower media half too.
 * Neither promise ever rejects: a failure inside generateBeatText/
 * generateBeatMedia resolves to null instead, so a failed prefetch always
 * reads as a clean cache miss rather than an unhandled rejection sitting
 * in the cache.
 */
export interface PrefetchEntry {
  textPromise: Promise<Beat | null>;
  mediaPromise: Promise<BeatMedia | null>;
}

/** Sorted so join order never affects the key — only *which* characters
 * are present matters. */
function partyKey(characterIds: string[]): string {
  return [...characterIds].sort().join(",");
}

/** Includes the party's character ids so a mid-campaign join (see
 * /api/campaigns/[id]/join) can never cause a beat prefetched for the old
 * party to be served for the new one — a stale cache entry simply misses
 * and falls back to a fresh generation instead of silently omitting
 * whoever just joined. */
function keyFor(sceneId: string, choiceIndex: number, assumedSuccess: boolean, characterIds: string[]): string {
  return `${sceneId}:${choiceIndex}:${assumedSuccess}:${partyKey(characterIds)}`;
}

const globalForPrefetch = globalThis as unknown as {
  beatPrefetchCache: Map<string, PrefetchEntry> | undefined;
};

const cache: Map<string, PrefetchEntry> = globalForPrefetch.beatPrefetchCache ?? new Map();

if (process.env.NODE_ENV !== "production") {
  globalForPrefetch.beatPrefetchCache = cache;
}

export function setPrefetch(
  sceneId: string,
  choiceIndex: number,
  assumedSuccess: boolean,
  characterIds: string[],
  entry: PrefetchEntry,
): void {
  cache.set(keyFor(sceneId, choiceIndex, assumedSuccess, characterIds), entry);
}

export function getPrefetch(
  sceneId: string,
  choiceIndex: number,
  assumedSuccess: boolean,
  characterIds: string[],
): PrefetchEntry | undefined {
  return cache.get(keyFor(sceneId, choiceIndex, assumedSuccess, characterIds));
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
