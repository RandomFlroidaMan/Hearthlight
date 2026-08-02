import { APIError } from "openai";
import { db } from "@/server/db";
import { openai } from "@/server/openaiClient";
import { modelConfig } from "@/server/config/models";
import { buildImagePrompt, PORTRAIT_QUALITY, SIZES } from "./artDirection";
import { EXTENSION_BY_MIME, getCachedImage, hashCacheKey, saveImage } from "./imageStore";
import { logImageSpend } from "./spendLog";
import type { Character } from "@/generated/prisma/client";

function portraitSubjectPrompt(
  character: Pick<Character, "name" | "race" | "className" | "appearance" | "personality">,
): string {
  return [
    `Reference portrait of ${character.race} ${character.className} named ${character.name}.`,
    character.appearance ? `Appearance: ${character.appearance}.` : null,
    character.personality
      ? `Their personality shows in their expression and pose: ${character.personality}.`
      : null,
    "Waist-up, three-quarter view, plain softly-lit background so the character reads clearly as a consistency reference for later illustrations.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Generates (or returns the cached) reference portrait for a character and
 * stores its filename on Character.portraitPath. This is the anchor image
 * every subsequent scene passes back in as an input for consistency. */
export async function generateCharacterPortrait(characterId: string): Promise<string> {
  const character = await db.character.findUniqueOrThrow({ where: { id: characterId } });

  const prompt = buildImagePrompt({ subject: portraitSubjectPrompt(character) });
  const hash = hashCacheKey([prompt, modelConfig.image.model, SIZES.portrait]);

  let filename = getCachedImage(hash);
  if (!filename) {
    const response = await openai.images.generate({
      model: modelConfig.image.model,
      prompt,
      size: SIZES.portrait,
      quality: PORTRAIT_QUALITY,
      output_format: "png",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error("Portrait generation returned no image data.");
    }

    filename = await saveImage(hash, Buffer.from(b64, "base64"));
    await logImageSpend({ totalTokens: response.usage?.total_tokens ?? 0 });
  }

  await db.character.update({
    where: { id: characterId },
    data: { portraitPath: filename },
  });

  return filename;
}

/** A photo couldn't be turned into a portrait — either OpenAI's own safety
 * systems declined it (real photos of real people/kids/pets can trip
 * moderation in ways a from-scratch description never does) or the
 * response otherwise came back empty. Distinct from a generic failure so
 * the route can show a message that suggests trying a different photo
 * rather than a bare "something went wrong." */
export class PhotoPortraitRejectedError extends Error {}

function photoSubjectPrompt(
  character: Pick<Character, "name" | "race" | "className" | "appearance">,
): string {
  return [
    `Reimagine the attached reference photo as a painterly children's-book illustration portrait of ${character.race} ${character.className} named ${character.name}.`,
    "Preserve the recognizable likeness of the subject in the photo — hair, coloring, distinguishing features, expression — but fully restyled into this illustrated look. Never a literal photo edit, never photorealistic retouching.",
    character.appearance ? `Appearance notes: ${character.appearance}.` : null,
    "Waist-up, three-quarter view, plain softly-lit background so the character reads clearly as a consistency reference for later illustrations.",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Same anchor-portrait role as generateCharacterPortrait, but built from a
 * family-uploaded photo (a kid, a pet) instead of a text description —
 * used as an images.edit reference so the result keeps the subject's
 * likeness while matching the app's existing painterly art style. */
export async function generatePortraitFromPhoto(
  characterId: string,
  photo: { bytes: Buffer; mimeType: string },
): Promise<string> {
  const character = await db.character.findUniqueOrThrow({ where: { id: characterId } });

  const extension = EXTENSION_BY_MIME[photo.mimeType];
  if (!extension) {
    throw new PhotoPortraitRejectedError(`Unsupported photo type: ${photo.mimeType}. Try a PNG, JPEG, or WebP.`);
  }

  const prompt = buildImagePrompt({ subject: photoSubjectPrompt(character) });
  const hash = hashCacheKey([prompt, modelConfig.image.model, SIZES.portrait, photo.bytes]);

  let filename = getCachedImage(hash);
  if (!filename) {
    const file = new File([new Uint8Array(photo.bytes)], `upload.${extension}`, { type: photo.mimeType });

    let response;
    try {
      response = await openai.images.edit({
        model: modelConfig.image.model,
        image: [file],
        prompt,
        size: SIZES.portrait,
        quality: PORTRAIT_QUALITY,
        output_format: "png",
      });
    } catch (err) {
      if (err instanceof APIError) {
        throw new PhotoPortraitRejectedError(
          "That photo couldn't be turned into a portrait — try a clearer photo, or a different one.",
        );
      }
      throw err;
    }

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new PhotoPortraitRejectedError("That photo couldn't be turned into a portrait — try a different one.");
    }

    filename = await saveImage(hash, Buffer.from(b64, "base64"));
    await logImageSpend({ totalTokens: response.usage?.total_tokens ?? 0 });
  }

  await db.character.update({
    where: { id: characterId },
    data: { portraitPath: filename },
  });

  return filename;
}
