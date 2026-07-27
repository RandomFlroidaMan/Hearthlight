import { z } from "zod";
import { db } from "@/server/db";
import { generateBeat } from "@/server/storyEngine/generateBeat";
import { generateUniqueRoomCode } from "@/server/sync/roomCode";

const createCampaignSchema = z.object({
  characterId: z.string(),
  worldSettingId: z.string(),
  tone: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = createCampaignSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { characterId, worldSettingId, tone } = parsed.data;

  const [character, worldSetting] = await Promise.all([
    db.character.findUnique({ where: { id: characterId } }),
    db.worldSetting.findUnique({ where: { id: worldSettingId } }),
  ]);
  if (!character) return Response.json({ error: "character_not_found" }, { status: 404 });
  if (!worldSetting) return Response.json({ error: "world_setting_not_found" }, { status: 404 });

  const roomCode = await generateUniqueRoomCode();
  const campaign = await db.campaign.create({
    data: { characterId, worldSettingId, tone: tone ?? null, roomCode },
  });

  const firstScene = await generateBeat({ campaignId: campaign.id });

  return Response.json({ campaign, firstScene }, { status: 201 });
}
