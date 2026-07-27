import { openai } from "@/server/openaiClient";
import { modelConfig } from "@/server/config/models";
import { hashCacheKey } from "@/server/art/imageStore";
import { getCachedNarration, saveNarration } from "./audioStore";
import { logTtsSpend } from "./spendLog";

/**
 * Generates spoken narration for a scene's prose. Unlike scene art, there's
 * no sensible "fall back to the previous narration" for different text —
 * so on repeated failure this returns null rather than throwing. Narration
 * is an enhancement; the scene itself must never be blocked by it.
 */
export async function generateNarration(params: {
  prose: string;
  campaignId?: string | null;
}): Promise<string | null> {
  const hash = hashCacheKey([
    params.prose,
    modelConfig.tts.model,
    modelConfig.tts.voice,
    modelConfig.tts.instructions,
  ]);

  const cached = getCachedNarration(hash);
  if (cached) {
    return cached;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await openai.audio.speech.create({
        model: modelConfig.tts.model,
        voice: modelConfig.tts.voice,
        input: params.prose,
        instructions: modelConfig.tts.instructions,
        response_format: "mp3",
      });

      const bytes = Buffer.from(await response.arrayBuffer());
      const filename = await saveNarration(hash, bytes);
      await logTtsSpend({ campaignId: params.campaignId, characters: params.prose.length });
      return filename;
    } catch {
      if (attempt === 1) {
        return null;
      }
    }
  }

  return null;
}
