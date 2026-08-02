import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  sceneCreateMock,
  sceneUpdateMock,
  campaignUpdateMock,
  itemCreateMock,
  broadcastMock,
  generateBeatTextMock,
  generateBeatMediaMock,
} = vi.hoisted(() => ({
  sceneCreateMock: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "scene-new",
    order: 1,
    ...data,
  })),
  sceneUpdateMock: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
    id: where.id,
    ...data,
  })),
  campaignUpdateMock: vi.fn(async () => ({})),
  itemCreateMock: vi.fn(async () => ({})),
  broadcastMock: vi.fn(),
  generateBeatTextMock: vi.fn(),
  generateBeatMediaMock: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    scene: { create: sceneCreateMock, update: sceneUpdateMock },
    campaign: { update: campaignUpdateMock },
    item: { create: itemCreateMock },
  },
}));

vi.mock("@/server/sync/transport", () => ({
  transport: { broadcast: broadcastMock },
}));

vi.mock("@/server/spendCap", () => ({
  isMonthlyCapExceeded: vi.fn(async () => false),
}));

vi.mock("../digest", () => ({
  updateDigestIfNeeded: vi.fn(async () => {}),
  KEEP_RECENT_SCENES: 3,
}));

vi.mock("../prefetch", () => ({
  triggerPrefetch: vi.fn(async () => {}),
}));

vi.mock("../generateBeatContent", () => ({
  generateBeatText: generateBeatTextMock,
  generateBeatMedia: generateBeatMediaMock,
}));

import { completeBeatAdvance } from "../generateBeat";
import { setPrefetch } from "../prefetchCache";
import type { Beat } from "../beatSchema";

function beatFixture(prose: string): Beat {
  return {
    prose,
    choices: [{ text: "Go on", skill: null, dc: null, successHint: null, failureHint: null }],
    dmNotes: "",
    imagePrompt: "a scene",
    ambientTrack: null,
    itemReward: null,
    npcIntroduced: null,
    isEnding: false,
  };
}

function fakeCtx(overrides: Partial<Parameters<typeof completeBeatAdvance>[0]> = {}) {
  const worldSetting = {
    id: "world-1",
    name: "Test World",
    description: "A place",
    paletteKey: null,
    genre: "fantasy",
    referenceImages: "[]",
    lastSceneImage: null,
    createdByFamilyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const campaign = {
    id: "camp-1",
    familyId: "fam-1",
    worldSettingId: "world-1",
    roomCode: "ABCD",
    act: "setup",
    tone: null,
    readingAge: 7,
    digestSummary: null,
    unresolvedThreads: "[]",
    npcsMet: "[]",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    worldSetting,
  };
  const characters = [{ id: "char-1", name: "Testy", displayName: null }];

  return {
    campaign,
    characters,
    matureCombatAllowed: false,
    act: "setup",
    chosenChoice: undefined,
    chosenChoiceSucceeded: true,
    chosenChoiceOutcomeHint: null,
    hadCheck: false,
    anyNatural20: false,
    scenes: [],
    priorScenes: [],
    latestScene: undefined,
    params: { campaignId: "camp-1" },
    ...overrides,
  } as unknown as Parameters<typeof completeBeatAdvance>[0];
}

beforeEach(() => {
  sceneCreateMock.mockClear();
  sceneUpdateMock.mockClear();
  campaignUpdateMock.mockClear();
  itemCreateMock.mockClear();
  broadcastMock.mockClear();
  generateBeatTextMock.mockReset();
  generateBeatMediaMock.mockReset();
});

describe("completeBeatAdvance — progressive text-then-media reveal", () => {
  it("creates the scene and broadcasts it with text/choices as soon as text is ready, before media resolves", async () => {
    generateBeatTextMock.mockResolvedValue(beatFixture("Fresh text"));
    generateBeatMediaMock.mockResolvedValue({ imageFilename: "art.png", narrationFilename: "voice.mp3" });

    const result = await completeBeatAdvance(fakeCtx());

    expect(sceneCreateMock).toHaveBeenCalledTimes(1);
    expect(sceneCreateMock.mock.calls[0][0].data).toMatchObject({
      prose: "Fresh text",
      imagePath: null,
      narrationPath: null,
    });

    // Two broadcasts, in order: text-only "scene", then the media patch.
    expect(broadcastMock).toHaveBeenCalledTimes(2);
    const [, firstEvent] = broadcastMock.mock.calls[0];
    expect(firstEvent.type).toBe("scene");
    expect(firstEvent.scene.imagePath).toBeNull();

    const [, secondEvent] = broadcastMock.mock.calls[1];
    expect(secondEvent).toMatchObject({ type: "scene_media", imagePath: "art.png", narrationPath: "voice.mp3" });

    expect(sceneUpdateMock).toHaveBeenCalledWith({
      where: { id: "scene-new" },
      data: { imagePath: "art.png", narrationPath: "voice.mp3" },
    });
    expect(result.scene.imagePath).toBe("art.png");
  });

  it("falls back to a null image/narration (not a thrown error) when media generation fails after text already broadcast", async () => {
    generateBeatTextMock.mockResolvedValue(beatFixture("Text ok, art fails"));
    generateBeatMediaMock.mockRejectedValue(new Error("image generation exploded"));

    const result = await completeBeatAdvance(fakeCtx());

    expect(result.scene.imagePath).toBeNull();
    expect(broadcastMock).toHaveBeenCalledTimes(2);
    expect(broadcastMock.mock.calls[1][1]).toMatchObject({ type: "scene_media", imagePath: null, narrationPath: null });
  });

  it("reuses a cached prefetched beat's text without regenerating, and still patches media in as a second step", async () => {
    setPrefetch("scene-prev", 0, true, ["char-1"], {
      textPromise: Promise.resolve(beatFixture("Cached text")),
      mediaPromise: Promise.resolve({ imageFilename: "cached-art.png", narrationFilename: null }),
    });

    const ctx = fakeCtx({
      latestScene: { id: "scene-prev", order: 1, choices: [] } as unknown as Parameters<
        typeof completeBeatAdvance
      >[0]["latestScene"],
      params: { campaignId: "camp-1", choiceIndex: 0 },
      chosenChoiceSucceeded: true,
    });

    const result = await completeBeatAdvance(ctx);

    expect(generateBeatTextMock).not.toHaveBeenCalled();
    expect(generateBeatMediaMock).not.toHaveBeenCalled();
    expect(sceneCreateMock.mock.calls[0][0].data).toMatchObject({ prose: "Cached text", imagePath: null });
    expect(result.scene.imagePath).toBe("cached-art.png");
  });
});
