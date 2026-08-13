import { db } from "@/server/db";
import { parseFormData } from "@/server/http";
import { requireFamilyId } from "@/server/auth/session";
import { transport } from "@/server/sync/transport";
import { saveUploadedImage } from "@/server/art/imageStore";
import { generateSceneImage } from "@/server/art/generateSceneImage";
import { isMonthlyCapExceeded } from "@/server/spendCap";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/**
 * DM "full editing power" over a scene's art: upload a replacement image
 * outright, or ask GPT to redraw it. Owner-family-only (unlike the beats
 * route, which any room-code guest can advance) — rewriting art wholesale
 * is an authorial power, not a cooperative-play one.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; sceneId: string }> }) {
  const auth = await requireFamilyId();
  if (!auth.ok) return auth.response;

  const { id, sceneId } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: { worldSetting: true, characters: { include: { character: true } } },
  });
  if (!campaign || campaign.familyId !== auth.familyId) {
    return Response.json({ error: "campaign_not_found" }, { status: 404 });
  }

  const scene = await db.scene.findUnique({ where: { id: sceneId } });
  if (!scene || scene.campaignId !== id) {
    return Response.json({ error: "scene_not_found" }, { status: 404 });
  }

  const formDataResult = await parseFormData(request);
  if (!formDataResult.ok) return formDataResult.response;
  const upload = formDataResult.data.get("image");

  let imagePath: string;

  if (upload instanceof File) {
    if (upload.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: "image_too_large", message: "That image is over 20MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await upload.arrayBuffer());
    try {
      imagePath = await saveUploadedImage(bytes, upload.type);
    } catch (err) {
      return Response.json({ error: "unsupported_image", message: (err as Error).message }, { status: 400 });
    }
  } else {
    if (await isMonthlyCapExceeded()) {
      return Response.json(
        {
          error: "monthly_cap_exceeded",
          message: "This month's spending cap has been reached — raise it in Preferences to generate more art.",
        },
        { status: 402 },
      );
    }
    const { filename } = await generateSceneImage({
      characters: campaign.characters.map((link) => link.character),
      worldSetting: campaign.worldSetting,
      sceneDescription: scene.imagePrompt ?? scene.prose,
      campaignId: campaign.id,
    });
    imagePath = filename;
  }

  const updated = await db.scene.update({ where: { id: sceneId }, data: { imagePath } });
  transport.broadcast(campaign.roomCode, { type: "scene", scene: updated });

  return Response.json({ scene: updated });
}
