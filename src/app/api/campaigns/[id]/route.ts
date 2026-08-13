import { db } from "@/server/db";
import { requireFamilyId } from "@/server/auth/session";

/** Used by clients to refetch current state after a WebSocket reconnect —
 * a dropped connection must never leave a screen stuck on stale data.
 * Requires a logged-in family (any family), matching every other
 * campaign-touching route now that campaign ids/room codes are reachable
 * over the open internet. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireFamilyId();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: { scenes: { orderBy: { order: "desc" }, take: 1 } },
  });

  if (!campaign) {
    return Response.json({ error: "campaign_not_found" }, { status: 404 });
  }

  // No scene yet is a real, expected state right after creation — the
  // opening beat now generates in the background (see POST /api/campaigns)
  // — not an error. Callers waiting on the first scene check `scene` for
  // null and `campaign.status` for "failed" rather than an HTTP error.
  const latestScene = campaign.scenes[0] ?? null;

  return Response.json({ campaign, scene: latestScene });
}

/** Owner-family-only, like the other "this is my story" actions — deleting
 * someone else's campaign just because you're in its room isn't something
 * a room-code guest should ever be able to do. Doesn't touch image/audio
 * files on disk: those are content-hashed and may still be referenced by
 * other scenes or a WorldSetting's lastSceneImage, so only the DB rows for
 * this campaign are removed. */
export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireFamilyId();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.familyId !== auth.familyId) {
    return Response.json({ error: "campaign_not_found" }, { status: 404 });
  }

  await db.$transaction([
    db.item.deleteMany({ where: { campaignId: id } }),
    db.spendLog.deleteMany({ where: { campaignId: id } }),
    db.scene.deleteMany({ where: { campaignId: id } }),
    db.campaignCharacter.deleteMany({ where: { campaignId: id } }),
    db.campaign.delete({ where: { id } }),
  ]);

  return new Response(null, { status: 204 });
}
