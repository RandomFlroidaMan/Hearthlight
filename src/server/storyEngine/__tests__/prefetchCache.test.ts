import { describe, expect, it } from "vitest";
import { clearPrefetchForScene, getPrefetch, setPrefetch } from "../prefetchCache";
import type { BeatContent } from "../generateBeatContent";

function fakeContent(marker: string): BeatContent {
  return {
    beat: {
      prose: marker,
      choices: [],
      dmNotes: "",
      imagePrompt: "",
      ambientTrack: null,
      itemReward: null,
      npcIntroduced: null,
      isEnding: false,
    },
    imageFilename: `${marker}.png`,
    narrationFilename: null,
  };
}

const PARTY = ["char-1", "char-2"];

describe("prefetchCache", () => {
  it("returns undefined for a key that was never set", () => {
    expect(getPrefetch("scene-never-set", 0, true, PARTY)).toBeUndefined();
  });

  it("returns the entry set for an exact (sceneId, choiceIndex, outcome, party) key", async () => {
    const entry = Promise.resolve(fakeContent("hit"));
    setPrefetch("scene-a", 0, true, PARTY, entry);
    const result = await getPrefetch("scene-a", 0, true, PARTY);
    expect(result?.beat.prose).toBe("hit");
  });

  it("does not match a different outcome for the same scene/choice", () => {
    setPrefetch("scene-b", 0, true, PARTY, Promise.resolve(fakeContent("success-branch")));
    expect(getPrefetch("scene-b", 0, false, PARTY)).toBeUndefined();
  });

  it("does not match a different choiceIndex for the same scene", () => {
    setPrefetch("scene-c", 0, true, PARTY, Promise.resolve(fakeContent("choice-0")));
    expect(getPrefetch("scene-c", 1, true, PARTY)).toBeUndefined();
  });

  it("does not match once the party changes (a mid-campaign join misses stale cache)", () => {
    setPrefetch("scene-f", 0, true, ["char-1"], Promise.resolve(fakeContent("solo")));
    expect(getPrefetch("scene-f", 0, true, ["char-1", "char-2"])).toBeUndefined();
  });

  it("matches regardless of party array order", async () => {
    setPrefetch("scene-g", 0, true, ["char-2", "char-1"], Promise.resolve(fakeContent("order-independent")));
    const result = await getPrefetch("scene-g", 0, true, ["char-1", "char-2"]);
    expect(result?.beat.prose).toBe("order-independent");
  });

  it("clearPrefetchForScene removes only that scene's entries", async () => {
    setPrefetch("scene-d", 0, true, PARTY, Promise.resolve(fakeContent("d0")));
    setPrefetch("scene-d", 1, true, PARTY, Promise.resolve(fakeContent("d1")));
    setPrefetch("scene-e", 0, true, PARTY, Promise.resolve(fakeContent("e0")));

    clearPrefetchForScene("scene-d");

    expect(getPrefetch("scene-d", 0, true, PARTY)).toBeUndefined();
    expect(getPrefetch("scene-d", 1, true, PARTY)).toBeUndefined();
    const untouched = await getPrefetch("scene-e", 0, true, PARTY);
    expect(untouched?.beat.prose).toBe("e0");
  });
});
