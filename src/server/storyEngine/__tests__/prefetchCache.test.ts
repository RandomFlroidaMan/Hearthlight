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

describe("prefetchCache", () => {
  it("returns undefined for a key that was never set", () => {
    expect(getPrefetch("scene-never-set", 0, true)).toBeUndefined();
  });

  it("returns the entry set for an exact (sceneId, choiceIndex, outcome) key", async () => {
    const entry = Promise.resolve(fakeContent("hit"));
    setPrefetch("scene-a", 0, true, entry);
    const result = await getPrefetch("scene-a", 0, true);
    expect(result?.beat.prose).toBe("hit");
  });

  it("does not match a different outcome for the same scene/choice", () => {
    setPrefetch("scene-b", 0, true, Promise.resolve(fakeContent("success-branch")));
    expect(getPrefetch("scene-b", 0, false)).toBeUndefined();
  });

  it("does not match a different choiceIndex for the same scene", () => {
    setPrefetch("scene-c", 0, true, Promise.resolve(fakeContent("choice-0")));
    expect(getPrefetch("scene-c", 1, true)).toBeUndefined();
  });

  it("clearPrefetchForScene removes only that scene's entries", async () => {
    setPrefetch("scene-d", 0, true, Promise.resolve(fakeContent("d0")));
    setPrefetch("scene-d", 1, true, Promise.resolve(fakeContent("d1")));
    setPrefetch("scene-e", 0, true, Promise.resolve(fakeContent("e0")));

    clearPrefetchForScene("scene-d");

    expect(getPrefetch("scene-d", 0, true)).toBeUndefined();
    expect(getPrefetch("scene-d", 1, true)).toBeUndefined();
    const untouched = await getPrefetch("scene-e", 0, true);
    expect(untouched?.beat.prose).toBe("e0");
  });
});
