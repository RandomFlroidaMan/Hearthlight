import { z } from "zod";
import { db } from "@/server/db";
import { parseJsonBody } from "@/server/http";
import { requireFamilyId } from "@/server/auth/session";
import { transport } from "@/server/sync/transport";

const joinSchema = z.object({
  characterIds: z.array(z.string()).min(1),
});

// Bringing a character into someone else's game — the counterpart to
// POST /api/campaigns, which only ever draws on the creating family's own
// characters. Anyone who knows the room code can join with any of their
// own characters; nothing here is restricted to the campaign's own family.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFamilyId();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = joinSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return Response.json({ error: "campaign_not_found" }, { status: 404 });
  }
  if (campaign.status !== "active") {
    return Response.json(
      { error: "campaign_not_joinable", message: "This adventure isn't active anymore." },
      { status: 409 },
    );
  }

  const characters = await db.character.findMany({
    where: { id: { in: parsed.data.characterIds }, familyId: auth.familyId },
  });
  if (characters.length !== parsed.data.characterIds.length) {
    return Response.json({ error: "character_not_found" }, { status: 404 });
  }

  await Promise.all(
    characters.map((character) =>
      db.campaignCharacter.upsert({
        where: { campaignId_characterId: { campaignId: campaign.id, characterId: character.id } },
        update: {},
        create: { campaignId: campaign.id, characterId: character.id },
      }),
    ),
  );

  transport.broadcast(campaign.roomCode, { type: "party_changed" });

  return Response.json({ ok: true }, { status: 200 });
}
