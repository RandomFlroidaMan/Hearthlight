/**
 * Single source of truth for every OpenAI model ID Hearthlight uses.
 * Nothing outside this file should reference a raw model string.
 *
 * Snapshot IDs below are placeholders — TBD means "not yet verified against
 * OpenAI's current docs." They get pinned for real in the phase that
 * actually calls the model (art pipeline = Phase 3, story engine = Phase 4,
 * TTS = Phase 7), since pinning now against a key we can't test with would
 * just be a guess.
 */

export const modelConfig = {
  text: {
    model: process.env.HEARTHLIGHT_TEXT_MODEL ?? "TBD-verify-in-phase-4",
  },
  image: {
    model: process.env.HEARTHLIGHT_IMAGE_MODEL ?? "TBD-verify-in-phase-3",
  },
  tts: {
    model: process.env.HEARTHLIGHT_TTS_MODEL ?? "TBD-verify-in-phase-7",
  },
} as const;

export type ModelRole = keyof typeof modelConfig;
