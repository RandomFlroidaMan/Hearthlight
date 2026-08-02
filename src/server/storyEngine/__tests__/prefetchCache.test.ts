import { describe, expect, it } from "vitest";
import { clearPrefetchForScene, getPrefetch, setPrefetch, type PrefetchEntry } from "../prefetchCache";
import type { Beat } from "../beatSchema";

function fakeBeat(marker: string): Beat {
  return {
    prose: marker,
    choices: [],
    dmNotes: "",
    imagePrompt: "",
    ambientTrack: null,
    itemReward: null,
    npcIntroduced: null,
    isEnding: false,
  };
}

function fakeEntry(marker: string): PrefetchEntry {
  return {
    textPromise: Promise.resolve(fakeBeat(marker)),
    mediaPromise: Promise.resolve({ imageFilename: `${marker}.png`, narrationFilename: null }),
  };
}

const PARTY = ["char-1", "char-2"];

describe("prefetchCache", () => {
  it("returns undefined for a key that was never set", () => {
    expect(getPrefetch("scene-never-set", 0, true, PARTY)).toBeUndefined();
  });

  it("returns the entry set for an exact (sceneId, choiceIndex, outcome, party) key", async () => {
    setPrefetch("scene-a", 0, true, PARTY, fakeEntry("hit"));
    const result = getPrefetch("scene-a", 0, true, PARTY);
    const beat = await result?.textPromise;
    expect(beat?.prose).toBe("hit");
  });

  it("resolves the media promise independently of the text promise", async () => {
    setPrefetch("scene-a2", 0, true, PARTY, fakeEntry("hit2"));
    const result = getPrefetch("scene-a2", 0, true, PARTY);
    const media = await result?.mediaPromise;
    expect(media?.imageFilename).toBe("hit2.png");
  });

  it("does not match a different outcome for the same scene/choice", () => {
    setPrefetch("scene-b", 0, true, PARTY, fakeEntry("success-branch"));
    expect(getPrefetch("scene-b", 0, false, PARTY)).toBeUndefined();
  });

  it("does not match a different choiceIndex for the same scene", () => {
    setPrefetch("scene-c", 0, true, PARTY, fakeEntry("choice-0"));
    expect(getPrefetch("scene-c", 1, true, PARTY)).toBeUndefined();
  });

  it("does not match once the party changes (a mid-campaign join misses stale cache)", () => {
    setPrefetch("scene-f", 0, true, ["char-1"], fakeEntry("solo"));
    expect(getPrefetch("scene-f", 0, true, ["char-1", "char-2"])).toBeUndefined();
  });

  it("matches regardless of party array order", async () => {
    setPrefetch("scene-g", 0, true, ["char-2", "char-1"], fakeEntry("order-independent"));
    const result = getPrefetch("scene-g", 0, true, ["char-1", "char-2"]);
    const beat = await result?.textPromise;
    expect(beat?.prose).toBe("order-independent");
  });

  it("clearPrefetchForScene removes only that scene's entries", async () => {
    setPrefetch("scene-d", 0, true, PARTY, fakeEntry("d0"));
    setPrefetch("scene-d", 1, true, PARTY, fakeEntry("d1"));
    setPrefetch("scene-e", 0, true, PARTY, fakeEntry("e0"));

    clearPrefetchForScene("scene-d");

    expect(getPrefetch("scene-d", 0, true, PARTY)).toBeUndefined();
    expect(getPrefetch("scene-d", 1, true, PARTY)).toBeUndefined();
    const untouched = getPrefetch("scene-e", 0, true, PARTY);
    const beat = await untouched?.textPromise;
    expect(beat?.prose).toBe("e0");
  });
});
