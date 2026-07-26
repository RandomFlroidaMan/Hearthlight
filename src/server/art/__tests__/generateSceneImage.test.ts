import { beforeEach, describe, expect, it, vi } from "vitest";

const imagesEdit = vi.fn();
const imagesGenerate = vi.fn();
const worldSettingUpdate = vi.fn().mockResolvedValue({});
const logImageSpend = vi.fn().mockResolvedValue(undefined);
const getCachedImage = vi.fn().mockReturnValue(null);
const saveImage = vi.fn().mockResolvedValue("generated-file.png");

vi.mock("@/server/openaiClient", () => ({
  openai: { images: { edit: imagesEdit, generate: imagesGenerate } },
}));
vi.mock("@/server/db", () => ({
  db: { worldSetting: { update: worldSettingUpdate } },
}));
vi.mock("../spendLog", () => ({ logImageSpend }));
vi.mock("../imageStore", () => ({
  getCachedImage,
  saveImage,
  hashCacheKey: () => "fixed-hash",
  readImageBytes: vi.fn().mockResolvedValue(Buffer.from("")),
  mimeTypeForFilename: () => "image/png",
}));

const { generateSceneImage } = await import("../generateSceneImage");

/**
 * The real end-to-end art-test run never exercised this failure path — all
 * 5 scenes succeeded on the first try. Without it, "retries once, then
 * falls back to the last successful image instead of a placeholder" (the
 * brief's own requirement) was unverified code, not a tested behavior.
 */
describe("generateSceneImage retry/fallback", () => {
  const baseParams = {
    character: { portraitPath: null },
    worldSetting: {
      id: "setting-1",
      referenceImages: [] as string[],
      paletteKey: null,
      description: "A test setting.",
      lastSceneImage: null as string | null,
    },
    sceneDescription: "A test scene.",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getCachedImage.mockReturnValue(null);
    saveImage.mockResolvedValue("generated-file.png");
    worldSettingUpdate.mockResolvedValue({});
  });

  it("succeeds on the first attempt without retrying", async () => {
    imagesGenerate.mockResolvedValueOnce({
      data: [{ b64_json: Buffer.from("img").toString("base64") }],
      usage: { total_tokens: 100 },
    });

    const result = await generateSceneImage(baseParams as never);

    expect(result).toEqual({ filename: "generated-file.png", fromFallback: false });
    expect(imagesGenerate).toHaveBeenCalledTimes(1);
    expect(worldSettingUpdate).toHaveBeenCalledWith({
      where: { id: "setting-1" },
      data: { lastSceneImage: "generated-file.png" },
    });
  });

  it("retries once and succeeds on the second attempt", async () => {
    imagesGenerate
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValueOnce({
        data: [{ b64_json: Buffer.from("img").toString("base64") }],
        usage: { total_tokens: 100 },
      });

    const result = await generateSceneImage(baseParams as never);

    expect(result).toEqual({ filename: "generated-file.png", fromFallback: false });
    expect(imagesGenerate).toHaveBeenCalledTimes(2);
  });

  it("falls back to the setting's last successful image after two failures", async () => {
    imagesGenerate.mockRejectedValue(new Error("persistent failure"));

    const result = await generateSceneImage({
      ...baseParams,
      worldSetting: { ...baseParams.worldSetting, lastSceneImage: "previous-scene.png" },
    } as never);

    expect(result).toEqual({ filename: "previous-scene.png", fromFallback: true });
    expect(imagesGenerate).toHaveBeenCalledTimes(2);
    // A fallback is not a new success — must not overwrite lastSceneImage.
    expect(worldSettingUpdate).not.toHaveBeenCalled();
  });

  it("throws if two failures occur and there is no previous image to fall back to", async () => {
    imagesGenerate.mockRejectedValue(new Error("persistent failure"));

    await expect(generateSceneImage(baseParams as never)).rejects.toThrow("persistent failure");
    expect(imagesGenerate).toHaveBeenCalledTimes(2);
  });
});
