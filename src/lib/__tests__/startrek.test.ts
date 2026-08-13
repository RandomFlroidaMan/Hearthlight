import { describe, expect, it } from "vitest";
import { findClassInfo, findRank, RANKS, SPECIES } from "../startrek";

describe("startrek", () => {
  it("lists species and ranks with kid-facing names", () => {
    expect(SPECIES).toContain("Klingon");
    expect(SPECIES).toContain("Vulcan");
    expect(RANKS.map((r) => r.name)).toContain("Command Officer");
  });

  it("findRank looks up a Star Trek rank case-insensitively", () => {
    expect(findRank("chief engineer")?.kidName).toBe("Master Builder");
    expect(findRank("Nonexistent Rank")).toBeUndefined();
  });

  it("findClassInfo resolves both D&D classes and Star Trek ranks", () => {
    expect(findClassInfo("Fighter")?.kidName).toBe("Brave Knight");
    expect(findClassInfo("Science Officer")?.kidName).toBe("Curious Scientist");
    expect(findClassInfo("Not A Real Class")).toBeUndefined();
  });
});
