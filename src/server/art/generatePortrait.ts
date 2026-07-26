import { db } from "@/server/db";
import { openai } from "@/server/openaiClient";
import { modelConfig } from "@/server/config/models";
import { buildImagePrompt, QUALITY, SIZES } from "./artDirection";
import { getCachedImage, hashCacheKey, saveImage } from "./imageStore";
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
      quality: QUALITY,
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
