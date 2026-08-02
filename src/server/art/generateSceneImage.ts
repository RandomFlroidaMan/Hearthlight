import { db } from "@/server/db";
import { openai } from "@/server/openaiClient";
import { modelConfig } from "@/server/config/models";
import { buildImagePrompt, SCENE_QUALITY, SIZES } from "./artDirection";
import { getCachedImage, hashCacheKey, mimeTypeForFilename, readImageBytes, saveImage } from "./imageStore";
import { logImageSpend } from "./spendLog";
import { toStringArray } from "@/lib/json";
import type { Character, WorldSetting } from "@/generated/prisma/client";

async function toUploadableFile(filename: string): Promise<File> {
  const bytes = await readImageBytes(filename);
  return new File([new Uint8Array(bytes)], filename, { type: mimeTypeForFilename(filename) });
}

async function generateOnce(params: {
  prompt: string;
  referenceFilenames: string[];
}): Promise<{ filename: string; totalTokens: number }> {
  const hash = hashCacheKey([params.prompt, modelConfig.image.model, SIZES.scene, ...params.referenceFilenames]);

  const cached = getCachedImage(hash);
  if (cached) {
    return { filename: cached, totalTokens: 0 };
  }

  const referenceImages = await Promise.all(params.referenceFilenames.map(toUploadableFile));

  const response =
    referenceImages.length > 0
      ? await openai.images.edit({
          model: modelConfig.image.model,
          image: referenceImages,
          prompt: params.prompt,
          size: SIZES.scene,
          quality: SCENE_QUALITY,
          // input_fidelity is gpt-image-1/1.5 only; gpt-image-2 rejects it
          // with a 400 (confirmed live, not assumed from the SDK's docstring,
          // which reads ambiguously on this point).
          output_format: "png",
        })
      : await openai.images.generate({
          model: modelConfig.image.model,
          prompt: params.prompt,
          size: SIZES.scene,
          quality: SCENE_QUALITY,
          output_format: "png",
        });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Scene image generation returned no image data.");
  }

  const filename = await saveImage(hash, Buffer.from(b64, "base64"));
  return { filename, totalTokens: response.usage?.total_tokens ?? 0 };
}

/**
 * Generates a scene illustration combining the character's reference
 * portrait and the setting's reference images as inputs, for consistency
 * across every scene. Retries once on failure, then falls back to the most
 * recent successfully generated image for the same setting — per the
 * brief, a failure must never show a placeholder box.
 */
export async function generateSceneImage(params: {
  /** The whole party — every character with a reference portrait gets used
   * as a reference image, so a group scene stays visually consistent with
   * everyone, not just one hero. */
  characters: Array<Pick<Character, "portraitPath">>;
  worldSetting: WorldSetting;
  sceneDescription: string;
  campaignId?: string | null;
}): Promise<{ filename: string; fromFallback: boolean }> {
  const referenceImages = toStringArray(params.worldSetting.referenceImages);
  const referenceFilenames = [
    ...params.characters.flatMap((c) => (c.portraitPath ? [c.portraitPath] : [])),
    ...referenceImages,
  ];

  const prompt = buildImagePrompt({
    subject: params.sceneDescription,
    paletteKey: params.worldSetting.paletteKey,
    extra: params.worldSetting.description,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { filename, totalTokens } = await generateOnce({ prompt, referenceFilenames });
      if (totalTokens > 0) {
        await logImageSpend({ campaignId: params.campaignId, totalTokens });
      }
      await db.worldSetting.update({
        where: { id: params.worldSetting.id },
        data: { lastSceneImage: filename },
      });
      return { filename, fromFallback: false };
    } catch (err) {
      if (attempt === 1) {
        if (params.worldSetting.lastSceneImage) {
          return { filename: params.worldSetting.lastSceneImage, fromFallback: true };
        }
        throw err;
      }
    }
  }

  // Unreachable, but keeps TypeScript happy about the loop's exhaustiveness.
  throw new Error("Scene image generation failed.");
}
