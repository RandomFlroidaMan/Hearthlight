import { describe, expect, it } from "vitest";
import { crossoverGuidance, GENRE_FLAVOR } from "../genreFlavor";

describe("crossoverGuidance", () => {
  it("returns null when the whole party matches the world's genre", () => {
    const party = [
      { name: "Quinn", universe: "fantasy" },
      { name: "Sam", universe: "fantasy" },
    ];
    expect(crossoverGuidance("fantasy", party)).toBeNull();
  });

  it("flags a Star Trek character dropped into a fantasy party", () => {
    const party = [
      { name: "Quinn", universe: "fantasy" },
      { name: "Korg", universe: "star-trek" },
    ];
    const guidance = crossoverGuidance("fantasy", party);
    expect(guidance).toContain("Korg");
    expect(guidance).not.toContain("Quinn");
    expect(guidance).toContain("starship crew");
    expect(guidance).toContain("portal");
  });

  it("flags a fantasy character dropped into a Star Trek party", () => {
    const party = [
      { name: "Ensign Vex", universe: "star-trek" },
      { name: "Sir Bramble", universe: "fantasy" },
    ];
    const guidance = crossoverGuidance("star-trek", party);
    expect(guidance).toContain("Sir Bramble");
    expect(guidance).toContain("fantasy-world adventurers");
  });
});

describe("GENRE_FLAVOR", () => {
  it("has no extra flavor text for fantasy (the existing default tone already covers it)", () => {
    expect(GENRE_FLAVOR.fantasy).toBe("");
  });

  it("gives Star Trek genre-specific vocabulary guidance", () => {
    expect(GENRE_FLAVOR["star-trek"]).toContain("phaser");
    expect(GENRE_FLAVOR["star-trek"]).toContain("STAR TREK FLAVOR");
  });
});
