import { db } from "@/server/db";
import { requireFamilyId } from "@/server/auth/session";

/** Resolves a room code to a campaign id — used by the story screen's
 * join-by-code flow. Requires a logged-in family (any family — this is the
 * intentional cross-family "join by code" trust model), so an anonymous
 * script can't enumerate the small 4-character room-code space without
 * even having a family account on this deployment. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  const auth = await requireFamilyId();
  if (!auth.ok) return auth.response;

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
