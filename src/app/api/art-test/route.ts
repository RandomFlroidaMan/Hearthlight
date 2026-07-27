import { z } from "zod";
import { db } from "@/server/db";
import { generateCharacterPortrait } from "@/server/art/generatePortrait";
import { generateSceneImage } from "@/server/art/generateSceneImage";
import { parseJsonBody } from "@/server/http";

const requestSchema = z.object({
  characterId: z.string(),
  worldSettingId: z.string(),
  scenePrompts: z.array(z.string().min(1)).min(1).max(5),
});

/**
 * The brief-mandated verification tool: generate several scenes with the
 * same character reference and let the DM eyeball consistency before
 * anything (the story engine) gets built on top of the art pipeline. Not
 * part of the real game loop — that's Phase 4.
 */
export async function POST(request: Request) {
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = requestSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { characterId, worldSettingId, scenePrompts } = parsed.data;

  const [character, worldSetting] = await Promise.all([
    db.character.findUnique({ where: { id: characterId } }),
    db.worldSetting.findUnique({ where: { id: worldSettingId } }),
  ]);

  if (!character) return Response.json({ error: "character_not_found" }, { status: 404 });
  if (!worldSetting) return Response.json({ error: "world_setting_not_found" }, { status: 404 });

  const portraitFilename = character.portraitPath ?? (await generateCharacterPortrait(characterId));
  const refreshedCharacter = { ...character, portraitPath: portraitFilename };

  // Sequential on purpose: these are real, billed API calls, and running
  // them one at a time keeps behavior predictable under rate limits.
  const scenes: Array<{ prompt: string; filename: string; fromFallback: boolean }> = [];
  let currentWorldSetting = worldSetting;
  for (const prompt of scenePrompts) {
    const result = await generateSceneImage({
      character: refreshedCharacter,
      worldSetting: currentWorldSetting,
      sceneDescription: prompt,
    });
    scenes.push({ prompt, ...result });
    currentWorldSetting = { ...currentWorldSetting, lastSceneImage: result.filename };
  }

  return Response.json({ portraitFilename, scenes });
}
