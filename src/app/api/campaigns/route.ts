import { z } from "zod";
import { db } from "@/server/db";
import { generateBeat } from "@/server/storyEngine/generateBeat";
import { generateUniqueRoomCode } from "@/server/sync/roomCode";
import { parseJsonBody } from "@/server/http";
import { isMonthlyCapExceeded } from "@/server/spendCap";

const createCampaignSchema = z.object({
  characterId: z.string(),
  worldSettingId: z.string(),
  tone: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = createCampaignSchema.safeParse(bodyResult.data);
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

  const roomCode = await generateUniqueRoomCode();
  const campaign = await db.campaign.create({
    data: { characterId, worldSettingId, tone: tone ?? null, roomCode },
  });

  const { scene: firstScene } = await generateBeat({ campaignId: campaign.id });

  return Response.json({ campaign, firstScene }, { status: 201 });
}
