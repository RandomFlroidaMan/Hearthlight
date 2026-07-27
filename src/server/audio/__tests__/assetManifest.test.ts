import { describe, expect, it, vi } from "vitest";

const readdir = vi.fn();

vi.mock("node:fs/promises", () => ({ readdir }));

const { getAudioManifest } = await import("../assetManifest");

describe("getAudioManifest", () => {
  it("resolves keys to null when no files are present", async () => {
    readdir.mockResolvedValue([]);
    const manifest = await getAudioManifest();
    expect(manifest.ambient.forest).toBeNull();
    expect(manifest.ambient.danger).toBeNull();
    expect(manifest.sfx["choice-select"]).toBeNull();
  });

  it("prefers mp3 over wav when both exist for the same key", async () => {
    readdir.mockResolvedValue(["forest.wav", "forest.mp3", "cave.flac"]);
    const manifest = await getAudioManifest();
    expect(manifest.ambient.forest).toBe("/audio/ambient/forest.mp3");
    expect(manifest.ambient.cave).toBe("/audio/ambient/cave.flac");
  });

  it("does not include a key for the 'none' ambient track", async () => {
    readdir.mockResolvedValue([]);
    const manifest = await getAudioManifest();
    expect("none" in manifest.ambient).toBe(false);
  });

  it("resolves sfx files independently of ambient files", async () => {
    readdir.mockImplementation(async (dir: string) => {
      if (dir.includes("sfx")) return ["success.mp3", "natural20.wav"];
      return [];
    });
    const manifest = await getAudioManifest();
    expect(manifest.sfx.success).toBe("/audio/sfx/success.mp3");
    expect(manifest.sfx.natural20).toBe("/audio/sfx/natural20.wav");
    expect(manifest.sfx["item-reward"]).toBeNull();
    expect(manifest.ambient.forest).toBeNull();
  });

  it("degrades to null for every key when the directory doesn't exist", async () => {
    readdir.mockRejectedValue(new Error("ENOENT"));
    const manifest = await getAudioManifest();
    expect(manifest.ambient.forest).toBeNull();
    expect(manifest.sfx.success).toBeNull();
  });
});
