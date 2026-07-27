import { db } from "@/server/db";

/** Resolves a room code to a campaign id — used by the story screen's
 * join-by-code flow. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;

  const campaign = await db.campaign.findUnique({
    where: { roomCode: code.toUpperCase() },
    select: { id: true },
  });

  if (!campaign) {
    return Response.json({ error: "room_not_found" }, { status: 404 });
  }

  return Response.json({ campaignId: campaign.id });
}
