/**
 * Single source of truth for every OpenAI model ID Hearthlight uses.
 * Nothing outside this file should reference a raw model string.
 *
 * `text` is pinned to the current frontier GPT-5.x snapshot, confirmed live
 * against /v1/models and a real (billing-blocked but request-accepted)
 * /v1/responses call on 2026-07-26 — see Phase 2 notes. It's also used for
 * vision input (sheet-scan parsing): GPT-5.x is natively multimodal, but
 * that specific path is unverified until the account has billing, since
 * every live call so far has failed at the billing check before reaching
 * model execution.
 *
 * `image` and `tts` are still placeholders — pinned for real in the phase
 * that actually calls them (art pipeline = Phase 3, TTS = Phase 7).
 */

export const modelConfig = {
  text: {
    // `||` on purpose, not `??`: an env var present but set to "" (as
    // .env.example ships them) must still fall back to the default.
    model: process.env.HEARTHLIGHT_TEXT_MODEL || "gpt-5.5-2026-04-23",
  },
  image: {
    model: process.env.HEARTHLIGHT_IMAGE_MODEL || "TBD-verify-in-phase-3",
  },
  tts: {
    model: process.env.HEARTHLIGHT_TTS_MODEL || "TBD-verify-in-phase-7",
  },
} as const;

export type ModelRole = keyof typeof modelConfig;
