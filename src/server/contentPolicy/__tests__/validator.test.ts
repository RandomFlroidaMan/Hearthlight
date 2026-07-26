import { describe, expect, it } from "vitest";
import { validateBeat, type BeatLike } from "../validator";
import { FALLBACK_BEATS } from "../fallbackBeats";

function beat(overrides: Partial<BeatLike>): BeatLike {
  return {
    prose: "A pleasant afternoon in the meadow.",
    dmNotes: "Nothing special.",
    choices: [
      { text: "Walk ahead", successHint: "You continue on.", failureHint: null },
      { text: "Look around", successHint: "You spot something interesting.", failureHint: null },
    ],
    ...overrides,
  };
}

describe("validateBeat", () => {
  it("passes a clean, safe beat", () => {
    const result = validateBeat(
      beat({
        prose: "A wobbly slime blocks the path, blinking and bouncing happily.",
        choices: [
          { text: "Tickle it aside", successHint: "It giggles and rolls out of the way.", failureHint: "It just wobbles and stays put." },
          { text: "Offer it a snack", successHint: "It slurps the snack and lets you by.", failureHint: null },
        ],
      }),
    );
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it.each(["kill", "killed", "die", "dead", "blood", "wound", "murder", "hurt"])(
    "rejects the banned word %s in prose",
    (word) => {
      const result = validateBeat(beat({ prose: `The hero ${word} something today.` }));
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    },
  );

  it("rejects a banned word hidden in a choice's failure hint", () => {
    const result = validateBeat(
      beat({
        choices: [
          { text: "Push forward", successHint: null, failureHint: "You get hurt trying." },
          { text: "Wait", successHint: null, failureHint: null },
        ],
      }),
    );
    expect(result.valid).toBe(false);
  });

  it("does not false-positive on a substring of a banned word", () => {
    // "class" contains no banned substrings, but this guards the word-boundary
    // regex against something like "assassin" not accidentally matching "ass"
    // or "scared" not matching a shorter banned root.
    const result = validateBeat(beat({ prose: "The classy scarecrow waved from the deadline-free field." }));
    expect(result.valid).toBe(true);
  });

  it("flags a human combined with conflict language", () => {
    const result = validateBeat(beat({ prose: "You fight the bandit blocking the road." }));
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.includes("human"))).toBe(true);
  });

  it("does not flag a human word alone without conflict language", () => {
    const result = validateBeat(beat({ prose: "A friendly villager waves hello from her doorway." }));
    expect(result.valid).toBe(true);
  });

  it("does not flag conflict language alone without a human present", () => {
    const result = validateBeat(beat({ prose: "You battle a wobbly slime blocking the path." }));
    expect(result.valid).toBe(true);
  });
});

describe("FALLBACK_BEATS", () => {
  it("every fallback beat passes its own validator", () => {
    for (const [act, fallback] of Object.entries(FALLBACK_BEATS)) {
      const result = validateBeat(fallback);
      expect(result.valid, `${act} fallback beat: ${result.violations.join("; ")}`).toBe(true);
    }
  });

  it("has a fallback for every act", () => {
    expect(Object.keys(FALLBACK_BEATS).sort()).toEqual(
      ["climax", "complication", "journey", "resolution", "setup"].sort(),
    );
  });
});
