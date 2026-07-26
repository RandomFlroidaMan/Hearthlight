import { BANNED_WORDS, CONFLICT_WORDS, HUMAN_WORDS } from "./wordList";

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

const BANNED_PATTERN = new RegExp(
  `\\b(${BANNED_WORDS.map(escapeRegExp).join("|")})\\b`,
  "i",
);

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
 *    triggers a regeneration, not a bad beat reaching the screen.
 */
export function validateBeat(beat: BeatLike): ValidationResult {
  const violations: string[] = [];
  const texts = allText(beat);

  for (const text of texts) {
    const match = text.match(BANNED_PATTERN);
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
