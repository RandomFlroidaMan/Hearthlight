import { db } from "@/server/db";

/** Used by clients to refetch current state after a WebSocket reconnect —
 * a dropped connection must never leave a screen stuck on stale data. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
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
