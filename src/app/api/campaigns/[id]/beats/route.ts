import { z } from "zod";
import { generateBeat, RollRequiredError } from "@/server/storyEngine/generateBeat";

const rollSchema = z.object({
  raw: z.number().int().min(1).max(20),
  raw2: z.number().int().min(1).max(20).optional(),
  mode: z.enum(["normal", "advantage", "disadvantage"]).optional(),
});

const advanceSchema = z.object({
  choiceIndex: z.number().int().min(0).optional(),
  roll: rollSchema.optional(),
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
 * override) — generateBeat throws RollRequiredError otherwise, reported
 * here as a 400, not a generation failure.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = advanceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const { scene, outcome } = await generateBeat({ campaignId: id, ...parsed.data });
    return Response.json({ scene, outcome });
  } catch (err) {
    if (err instanceof RollRequiredError) {
      return Response.json({ error: "roll_required", message: err.message }, { status: 400 });
    }
    return Response.json(
      { error: "beat_generation_failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
