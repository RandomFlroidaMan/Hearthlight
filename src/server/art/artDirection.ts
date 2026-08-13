import { PALETTE_KEYS } from "@/lib/worldSettingPalettes";

/**
 * The style bible — one file, easy to read and A/B test, per the brief.
 * Every generated image (character portrait or scene) is built from this.
 *
 * gpt-image models don't have a separate negative-prompt channel, so the
 * "never do X" directions are folded directly into the prompt text instead
 * of a distinct param.
 */

export const STYLE_BASE =
  "Painterly children's-book illustration in the golden-age tradition. " +
  "Watercolor and gouache texture, visible brushwork, warm rim lighting, " +
  "deep atmospheric perspective, rich saturated color, soft volumetric " +
  "light through mist or trees. Detailed, immersive environments with a " +
  "clear focal subject. Wondrous and adventurous — never cutesy, never " +
  "flat vector, never corporate-illustration, never 3D-render, never " +
  "clip-art, never photorealistic.";

export const SIZES = {
  /** 16:9, for the story screen on a TV. */
  scene: "1536x864",
  /** Square headshot/portrait framing for the character reference image. */
  portrait: "1024x1024",
} as const;

/** Character portraits are generated once at creation time and then reused
 * as a reference image for every future scene, so it's worth spending the
 * extra generation time on a better-quality anchor. Scene art regenerates
 * on every single beat and directly gates how long a family waits to see
 * the next part of the story — "high" was measurably slower there (often
 * 2x+) for a difference that barely reads once the scene is composited
 * with the rest of the illustration and shown on a TV/phone screen. */
export const PORTRAIT_QUALITY = "high" as const;
export const SCENE_QUALITY = "medium" as const;

/** Preset biomes from the brief. A WorldSetting with one of these keys gets
 * this palette folded in; a fully custom setting relies on its own
 * description + reference images instead. Keys must match PALETTE_KEYS. */
export const PRESET_PALETTES: Record<(typeof PALETTE_KEYS)[number], string> = {
  forest:
    "Deep greens and dappled gold sunlight filtering through a leafy canopy, mossy undergrowth, warm honeyed light.",
  mountain:
    "Cool violet-blue peaks, crisp thin air, distant snow, dramatic pink-orange alpenglow.",
  coast:
    "Turquoise and sandy gold, salt-misted air, warm late-afternoon coastal light.",
  night:
    "Deep indigo and midnight blue, silver moonlight, warm scattered lantern glow.",
};

export function buildImagePrompt(parts: {
  subject: string;
  paletteKey?: string | null;
  extra?: string | null;
}): string {
  const palette =
    parts.paletteKey && parts.paletteKey in PRESET_PALETTES
      ? PRESET_PALETTES[parts.paletteKey as keyof typeof PRESET_PALETTES]
      : undefined;
  return [STYLE_BASE, palette, parts.subject, parts.extra].filter(Boolean).join(" ");
}
