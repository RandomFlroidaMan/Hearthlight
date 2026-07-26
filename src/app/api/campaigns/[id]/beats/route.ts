import { z } from "zod";
import { generateBeat } from "@/server/storyEngine/generateBeat";

const advanceSchema = z.object({
  choiceIndex: z.number().int().min(0).optional(),
  direction: z.string().nullable().optional(),
  forceEnding: z.boolean().optional(),
  regenerate: z.boolean().optional(),
});

/**
 * Single action endpoint: advancing on a choice, injecting a DM direction,
 * forcing an ending, and regenerating the latest beat are all "generate a
 * beat under different constraints," not different operations.
 *
 * Note: choiceIndex resolution is currently a stub — every choice is
 * treated as succeeding, regardless of its skill/DC. Real dice resolution
 * is Phase 5; this lets the story engine be built and verified now without
 * scope-creeping the rules engine in early.
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
    const scene = await generateBeat({ campaignId: id, ...parsed.data });
    return Response.json({ scene });
  } catch (err) {
    return Response.json(
      { error: "beat_generation_failed", message: (err as Error).message },
      { status: 502 },
    );
  }
}
