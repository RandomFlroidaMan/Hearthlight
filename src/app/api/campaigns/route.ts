import { z } from "zod";
import { db } from "@/server/db";
import { generateBeat } from "@/server/storyEngine/generateBeat";
import { generateUniqueRoomCode } from "@/server/sync/roomCode";
import { parseJsonBody } from "@/server/http";
import { isMonthlyCapExceeded } from "@/server/spendCap";
import { findAdventure } from "@/lib/adventures";

const createCampaignSchema = z
  .object({
    characterIds: z.array(z.string()).min(1),
    worldSettingId: z.string().optional(),
    adventureId: z.string().optional(),
    tone: z.string().nullable().optional(),
  })
  .refine((v) => Boolean(v.worldSettingId) !== Boolean(v.adventureId), {
    message: "Provide exactly one of worldSettingId or adventureId.",
  });

export async function POST(request: Request) {
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = createCampaignSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { characterIds, worldSettingId, adventureId, tone } = parsed.data;

  const characters = await db.character.findMany({ where: { id: { in: characterIds } } });
  if (characters.length !== characterIds.length) {
    return Response.json({ error: "character_not_found" }, { status: 404 });
  }

  let worldSetting;
  let resolvedTone = tone ?? null;
  if (adventureId) {
    const adventure = findAdventure(adventureId);
    if (!adventure) return Response.json({ error: "adventure_not_found" }, { status: 404 });
    worldSetting =
      (await db.worldSetting.findFirst({ where: { name: adventure.worldSettingName } })) ??
      (await db.worldSetting.create({
        data: {
          name: adventure.worldSettingName,
          description: adventure.worldSettingDescription,
          paletteKey: adventure.paletteKey,
        },
      }));
    resolvedTone = tone ?? adventure.tone;
  } else {
    worldSetting = await db.worldSetting.findUnique({ where: { id: worldSettingId } });
    if (!worldSetting) return Response.json({ error: "world_setting_not_found" }, { status: 404 });
  }

  // Checked before creating anything — a cap-exceeded campaign with no
  // scenes would violate the "every campaign has at least one scene"
  // invariant every other page relies on.
  if (await isMonthlyCapExceeded()) {
    return Response.json(
      {
        error: "monthly_cap_exceeded",
        message: "This month's spending cap has been reached — raise it in Preferences to start a new adventure.",
      },
      { status: 402 },
    );
  }

  // The youngest party member's age drives prose difficulty and roll
  // complexity for the whole campaign — snapshotted so it can't shift if
  // characters are edited later.
  const readingAge = Math.min(...characters.map((c) => c.readingAge));

  const roomCode = await generateUniqueRoomCode();
  const campaign = await db.campaign.create({
    data: {
      worldSettingId: worldSetting.id,
      tone: resolvedTone,
      readingAge,
      roomCode,
      characters: { create: characterIds.map((characterId) => ({ characterId })) },
    },
  });

  const { scene: firstScene } = await generateBeat({ campaignId: campaign.id });

  return Response.json({ campaign, firstScene }, { status: 201 });
}
