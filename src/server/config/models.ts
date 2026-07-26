/**
 * Single source of truth for every OpenAI model ID Hearthlight uses.
 * Nothing outside this file should reference a raw model string.
 *
 * `text` is pinned to the current frontier GPT-5.x snapshot, confirmed live
 * against /v1/models and real /v1/responses calls (2026-07-26) — both plain
 * text and image input (sheet-scan parsing) verified with real extractions.
 *
 * `image` is pinned to gpt-image-2's current dated snapshot, confirmed in
 * /v1/models and against the installed SDK's own type definitions (docs
 * site blocks scraping). Used for both from-scratch generation
 * (`images.generate`) and reference-guided generation (`images.edit`, up to
 * 16 input images) for character/setting consistency.
 *
 * `tts` is still a placeholder — pinned for real in Phase 7.
 */

export const modelConfig = {
  text: {
    // `||` on purpose, not `??`: an env var present but set to "" (as
    // .env.example ships them) must still fall back to the default.
    model: process.env.HEARTHLIGHT_TEXT_MODEL || "gpt-5.5-2026-04-23",
  },
  image: {
    model: process.env.HEARTHLIGHT_IMAGE_MODEL || "gpt-image-2-2026-04-21",
  },
  tts: {
    model: process.env.HEARTHLIGHT_TTS_MODEL || "TBD-verify-in-phase-7",
  },
} as const;

export type ModelRole = keyof typeof modelConfig;
