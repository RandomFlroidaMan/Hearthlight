import { z } from "zod";
import { db } from "@/server/db";

const editSceneSchema = z.object({
  prose: z.string().min(1),
});

/** DM override: edit prose before it's shown to the story screen. */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; sceneId: string }> },
) {
  const { id, sceneId } = await ctx.params;
  const body = await request.json();
  const parsed = editSceneSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const scene = await db.scene.findUnique({ where: { id: sceneId } });
  if (!scene || scene.campaignId !== id) {
    return Response.json({ error: "scene_not_found" }, { status: 404 });
  }

  const updated = await db.scene.update({
    where: { id: sceneId },
    data: { prose: parsed.data.prose },
  });

  return Response.json({ scene: updated });
}
