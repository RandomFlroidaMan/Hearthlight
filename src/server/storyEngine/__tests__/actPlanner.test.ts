import { describe, expect, it } from "vitest";
import { planNextAct } from "../actPlanner";

describe("planNextAct", () => {
  it("stays in the current act until its scene budget is used up", () => {
    // reading age 5: journey gets 2 scenes
    expect(planNextAct("journey", 0, 5)).toBe("journey");
    expect(planNextAct("journey", 1, 5)).toBe("journey");
  });

  it("advances to the next act once the budget is exhausted", () => {
    expect(planNextAct("journey", 2, 5)).toBe("complication");
  });

  it("gives younger reading ages a shorter arc than older ones", () => {
    // age 3: journey only gets 1 scene before advancing
    expect(planNextAct("journey", 1, 3)).toBe("complication");
    // age 10: journey gets 3 scenes
    expect(planNextAct("journey", 1, 10)).toBe("journey");
  });

  it("never advances past resolution", () => {
    expect(planNextAct("resolution", 0, 5)).toBe("resolution");
    expect(planNextAct("resolution", 5, 5)).toBe("resolution");
  });

  it("falls back to the age-5 pacing for an unrecognized reading age", () => {
    expect(planNextAct("setup", 1, 6)).toBe(planNextAct("setup", 1, 5));
  });
});
