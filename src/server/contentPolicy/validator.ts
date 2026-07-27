import { BANNED_WORDS, CONFLICT_WORDS, HUMAN_WORDS, MATURE_COMBAT_WORDS } from "./wordList";

/** The minimal shape validateBeat needs — kept local (not imported from
 * storyEngine) so this module stays self-contained and independently
 * testable, per the brief's "one file I can read and trust" request.
 * beatSchema.ts's Zod-inferred type satisfies this structurally. */
export interface BeatLike {
  prose: string;
  dmNotes: string;
  choices: Array<{
    text: string;
    successHint: string | null;
    failureHint: string | null;
  }>;
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bannedPattern(matureCombatAllowed: boolean): RegExp {
  const words = matureCombatAllowed
    ? BANNED_WORDS.filter((w) => !(MATURE_COMBAT_WORDS as readonly string[]).includes(w))
    : BANNED_WORDS;
  return new RegExp(`\\b(${words.map(escapeRegExp).join("|")})\\b`, "i");
}

function containsAny(text: string, words: string[]): boolean {
  const pattern = new RegExp(`\\b(${words.map(escapeRegExp).join("|")})\\b`, "i");
  return pattern.test(text);
}

function allText(beat: BeatLike): string[] {
  return [
    beat.prose,
    beat.dmNotes,
    ...beat.choices.flatMap((c) => [c.text, c.successHint ?? "", c.failureHint ?? ""]),
  ];
}

/**
 * Validates a generated beat against the brief's hard safety constraints
 * (§5). Two kinds of checks:
 *
 * 1. Banned words — a reliable, deterministic hard gate.
 * 2. Human-conflict heuristic — best-effort, not foolproof. A word list
 *    can't fully guarantee "never fight a person"; this flags the common
 *    case (a human word and a conflict word both present) and accepts
 *    over-flagging as the safe failure mode, since a false positive just
 *    triggers a regeneration, not a bad beat reaching the screen. This
 *    check is never relaxed by matureCombatAllowed — conflict is always
 *    only ever with fantastical monsters.
 *
 * `matureCombatAllowed` (the age-gated family setting) only exempts
 * MATURE_COMBAT_WORDS from check 1 — the bare vocabulary of a monster
 * being permanently defeated. Every other banned word (gore, distress,
 * cruelty) stays banned regardless.
 */
export function validateBeat(beat: BeatLike, options?: { matureCombatAllowed?: boolean }): ValidationResult {
  const violations: string[] = [];
  const texts = allText(beat);
  const pattern = bannedPattern(options?.matureCombatAllowed ?? false);

  for (const text of texts) {
    const match = text.match(pattern);
    if (match) {
      violations.push(`Banned word "${match[0]}" found in: "${text}"`);
    }
  }

  const combined = texts.join(" ");
  if (containsAny(combined, HUMAN_WORDS) && containsAny(combined, CONFLICT_WORDS)) {
    violations.push(
      "Possible conflict with a human/person detected — conflict must only ever be with fantastical monsters.",
    );
  }

  return { valid: violations.length === 0, violations };
}
