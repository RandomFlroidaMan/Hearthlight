import { z } from "zod";
import {
  resolveChoiceOutcome,
  completeBeatAdvance,
  CampaignNotFoundError,
  MonthlyCapExceededError,
  RollRequiredError,
} from "@/server/storyEngine/generateBeat";
import { transport } from "@/server/sync/transport";
import { parseJsonBody } from "@/server/http";

const rollSchema = z.object({
  characterId: z.string(),
  raw: z.number().int().min(1).max(20),
  raw2: z.number().int().min(1).max(20).optional(),
  mode: z.enum(["normal", "advantage", "disadvantage"]).optional(),
});

const advanceSchema = z.object({
  choiceIndex: z.number().int().min(0).optional(),
  roll: z.array(rollSchema).optional(),
  fudge: z.enum(["success", "failure"]).optional(),
  direction: z.string().nullable().optional(),
  forceEnding: z.boolean().optional(),
  regenerate: z.boolean().optional(),
});

/**
 * Single action endpoint: advancing on a choice, injecting a DM direction,
 * forcing an ending, and regenerating the latest beat are all "generate a
 * beat under different constraints," not different operations.
 *
 * A skill-check choice (choiceIndex pointing at a choice with skill+dc)
 * requires either `roll` (the physical d20 result(s)) or `fudge` (a DM
 * override) — resolveChoiceOutcome throws RollRequiredError otherwise,
 * reported here as a 400, not a generation failure.
 *
 * Roll/fudge validation runs synchronously (fast — no OpenAI call), then
 * responds 202 immediately and finishes the actual generation in the
 * background, broadcasting the new scene over the same WebSocket every
 * connected screen already listens on. An inline wait on the full
 * generation here (a story-text call, then art and narration together)
 * was long enough to trip a host's own proxy timeout — the same issue
 * fixed for POST /api/campaigns, now fixed here too.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = advanceSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const beatContext = await resolveChoiceOutcome({ campaignId: id, ...parsed.data });

    void completeBeatAdvance(beatContext).catch((err) => {
      console.error(`Failed to generate the next beat for campaign ${id}:`, err);
      const message =
        err instanceof MonthlyCapExceededError
          ? err.message
          : "Something went wrong continuing this adventure.";
      transport.broadcast(beatContext.campaign.roomCode, { type: "generation_failed", message });
    });

    return Response.json({ accepted: true }, { status: 202 });
  } catch (err) {
    if (err instanceof RollRequiredError) {
      return Response.json({ error: "roll_required", message: err.message }, { status: 400 });
    }
    if (err instanceof CampaignNotFoundError) {
      return Response.json({ error: "campaign_not_found" }, { status: 404 });
    }
    return Response.json(
      { error: "beat_generation_failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
