import { describe, expect, it } from "vitest";
import { complexityForAge, resolveRoll } from "../rollResolution";

describe("complexityForAge", () => {
  it("age 3 ignores the modifier and disallows advantage", () => {
    expect(complexityForAge(3)).toEqual({ useModifier: false, allowAdvantage: false });
  });

  it("age 5 applies the modifier but disallows advantage", () => {
    expect(complexityForAge(5)).toEqual({ useModifier: true, allowAdvantage: false });
  });

  it("ages 7 and 10 apply the modifier and allow advantage", () => {
    expect(complexityForAge(7)).toEqual({ useModifier: true, allowAdvantage: true });
    expect(complexityForAge(10)).toEqual({ useModifier: true, allowAdvantage: true });
  });
});

describe("resolveRoll", () => {
  it("succeeds when total meets the DC", () => {
    const result = resolveRoll({ raw: 10, modifier: 2, dc: 12, useModifier: true });
    expect(result.total).toBe(12);
    expect(result.success).toBe(true);
  });

  it("fails when total is below the DC", () => {
    const result = resolveRoll({ raw: 5, modifier: 2, dc: 12, useModifier: true });
    expect(result.total).toBe(7);
    expect(result.success).toBe(false);
  });

  it("ignores the modifier when useModifier is false (age 3)", () => {
    const result = resolveRoll({ raw: 10, modifier: 5, dc: 12, useModifier: false });
    expect(result.total).toBe(10);
    expect(result.modifier).toBe(0);
    expect(result.success).toBe(false);
  });

  it("a natural 20 always succeeds, even against an unreachable DC", () => {
    const result = resolveRoll({ raw: 20, modifier: -5, dc: 30, useModifier: true });
    expect(result.isNatural20).toBe(true);
    expect(result.success).toBe(true);
  });

  it("a natural 1 always fails, even with a total that would otherwise clear the DC", () => {
    const result = resolveRoll({ raw: 1, modifier: 15, dc: 10, useModifier: true });
    expect(result.isNatural1).toBe(true);
    expect(result.success).toBe(false);
  });

  it("advantage takes the higher of two rolls", () => {
    const result = resolveRoll({ raw: 6, raw2: 14, mode: "advantage", modifier: 0, dc: 10, useModifier: true });
    expect(result.effectiveRaw).toBe(14);
    expect(result.success).toBe(true);
  });

  it("disadvantage takes the lower of two rolls", () => {
    const result = resolveRoll({ raw: 6, raw2: 14, mode: "disadvantage", modifier: 0, dc: 10, useModifier: true });
    expect(result.effectiveRaw).toBe(6);
    expect(result.success).toBe(false);
  });

  it("ignores raw2 in normal mode", () => {
    const result = resolveRoll({ raw: 6, raw2: 20, mode: "normal", modifier: 0, dc: 10, useModifier: true });
    expect(result.effectiveRaw).toBe(6);
  });
});
