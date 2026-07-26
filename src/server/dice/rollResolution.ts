/**
 * The dice mechanic decided before this build started: no animated 3D die —
 * a physical d20, typed in, plus the character's derived skill modifier
 * (src/lib/deriveSkills.ts) against a DC. This module is the pure math; the
 * UI collects the physical roll and generateBeat.ts wires it into the story.
 */

export interface RollComplexity {
  /** Age 3: raw roll vs DC only, per the brief's "one die and a target number." */
  useModifier: boolean;
  /** Advantage/disadvantage only offered at 7/10 — keeps younger ages simple. */
  allowAdvantage: boolean;
}

export function complexityForAge(readingAge: number): RollComplexity {
  if (readingAge <= 3) return { useModifier: false, allowAdvantage: false };
  if (readingAge <= 5) return { useModifier: true, allowAdvantage: false };
  return { useModifier: true, allowAdvantage: true };
}

export type RollMode = "normal" | "advantage" | "disadvantage";

export interface RollResult {
  raw: number;
  raw2: number | null;
  /** The die value actually used, after advantage/disadvantage picks the better/worse of two. */
  effectiveRaw: number;
  modifier: number;
  useModifier: boolean;
  total: number;
  dc: number;
  success: boolean;
  isNatural20: boolean;
  isNatural1: boolean;
}

/**
 * Natural 20 always succeeds and natural 1 always fails, regardless of the
 * total vs DC — not strict 5e RAW for ability checks, but a deliberate,
 * documented kid-friendly simplification: the physical die itself stays the
 * moment of delight the brief asks for, even without an animated version.
 */
export function resolveRoll(params: {
  raw: number;
  raw2?: number;
  mode?: RollMode;
  modifier: number;
  dc: number;
  useModifier: boolean;
}): RollResult {
  const mode = params.mode ?? "normal";

  let effectiveRaw = params.raw;
  if (params.raw2 !== undefined) {
    if (mode === "advantage") effectiveRaw = Math.max(params.raw, params.raw2);
    else if (mode === "disadvantage") effectiveRaw = Math.min(params.raw, params.raw2);
  }

  const isNatural20 = effectiveRaw === 20;
  const isNatural1 = effectiveRaw === 1;
  const modifier = params.useModifier ? params.modifier : 0;
  const total = effectiveRaw + modifier;
  const success = isNatural20 ? true : isNatural1 ? false : total >= params.dc;

  return {
    raw: params.raw,
    raw2: params.raw2 ?? null,
    effectiveRaw,
    modifier,
    useModifier: params.useModifier,
    total,
    dc: params.dc,
    success,
    isNatural20,
    isNatural1,
  };
}
