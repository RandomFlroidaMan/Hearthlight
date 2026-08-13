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
 * `tts` is pinned to gpt-4o-mini-tts's current dated snapshot, confirmed
 * live in /v1/models and with a real `audio.speech.create` call (2026-07-27)
 * — non-empty, valid MP3 bytes came back. Voice is `fable`, steered via the
 * `instructions` field (supported on gpt-4o-mini-tts, not on tts-1/tts-1-hd)
 * toward a warm, gentle, unhurried bedtime-storyteller read.
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
    model: process.env.HEARTHLIGHT_TTS_MODEL || "gpt-4o-mini-tts-2025-12-15",
    voice: "fable" as const,
    instructions:
      "Warm, gentle, unhurried bedtime storyteller reading to a young child. Cozy and cheerful, never rushed, never flat.",
  },
} as const;

export type ModelRole = keyof typeof modelConfig;
