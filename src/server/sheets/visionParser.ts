import { zodTextFormat } from "openai/helpers/zod";
import { characterSheetSchema } from "@/lib/characterSchema";
import { modelConfig } from "@/server/config/models";
import { openai } from "@/server/openaiClient";
import type { ParsedSheet } from "./types";

const SYSTEM_PROMPT = `You extract structured data from a photo or scan of a Dungeons & Dragons 5th edition character sheet. Handwriting may be messy or partially illegible.

Fill in every field of the schema as best you can from the image. If a value genuinely isn't legible or present, use a reasonable default (10 for an unknown ability score, 1 for an unknown level, an empty array for unknown lists, null for unknown optional text) rather than guessing a plausible-sounding but fabricated value.`;

/**
 * Handles both a direct photo upload and a rasterized scanned-PDF page —
 * both arrive here as a data URL. This is the least verifiable parser in
 * Phase 2: it needs a live vision-capable call, and this account has no
 * billing yet, so every attempt so far has failed at the billing check
 * before the model ever saw an image. The request shape is confirmed
 * against the installed OpenAI SDK's types, not guessed, but the actual
 * extraction accuracy is unverified until billing is active.
 */
export async function parseSheetImage(imageDataUrl: string): Promise<ParsedSheet> {
  const response = await openai.responses.create({
    model: modelConfig.text.model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Extract this character sheet." },
          { type: "input_image", image_url: imageDataUrl, detail: "high" },
        ],
      },
    ],
    text: { format: zodTextFormat(characterSheetSchema, "character_sheet") },
  });

  const data = characterSheetSchema.parse(JSON.parse(response.output_text));

  return {
    data,
    warnings: [
      "This sheet was read by AI from a photo/scan — double-check every field, especially ability scores, before saving.",
    ],
  };
}
