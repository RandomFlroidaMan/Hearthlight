import { z } from "zod";
import { db } from "@/server/db";
import { parseFormData } from "@/server/http";
import { requireFamilyId } from "@/server/auth/session";
import { transport } from "@/server/sync/transport";
import { saveUploadedImage } from "@/server/art/imageStore";
import { generateSceneImage } from "@/server/art/generateSceneImage";
import { isMonthlyCapExceeded } from "@/server/spendCap";
import { skillNames } from "@/server/storyEngine/beatSchema";
import { updateDigestIfNeeded } from "@/server/storyEngine/digest";
import { triggerPrefetch } from "@/server/storyEngine/prefetch";
import type { Choice } from "@/server/storyEngine/beatSchema";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const choiceFieldSchema = z.object({
  text: z.string().min(1),
  skill: z.enum(skillNames).nullable(),
  dc: z.coerce.number().int().min(1).max(30).nullable(),
});

/**
 * "Full story creation edit powers": author the next beat by hand —
 * your own prose and choices — instead of only nudging the AI with a
 * direction. No content-policy validation runs against this text since
 * it's the DM's own editorial content, the same trust already extended by
 * the DM-fudge roll override. Owner-family-only, like the scene-image
 * replace route — this rewrites the story wholesale, not a cooperative
 * "everyone can advance" action.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFamilyId();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const campaign = await db.campaign.findUnique({
    where: { id },
    include: { worldSetting: true, characters: { include: { character: true } } },
  });
  if (!campaign || campaign.familyId !== auth.familyId) {
    return Response.json({ error: "campaign_not_found" }, { status: 404 });
  }

  const formDataResult = await parseFormData(request);
  if (!formDataResult.ok) return formDataResult.response;
  const form = formDataResult.data;

  const prose = form.get("prose");
  if (typeof prose !== "string" || prose.trim().length === 0) {
    return Response.json({ error: "prose_required" }, { status: 400 });
  }

  const rawChoices = [1, 2, 3]
    .map((n) => ({
      text: form.get(`choice${n}Text`),
      skill: form.get(`choice${n}Skill`) || null,
      dc: form.get(`choice${n}Dc`) || null,
    }))
    .filter((c) => typeof c.text === "string" && c.text.trim().length > 0);

  const isEnding = form.get("isEnding") === "true";
  let choices: Choice[] = [];
  if (!isEnding) {
    const parsedChoices = z.array(choiceFieldSchema).min(2).max(3).safeParse(rawChoices);
    if (!parsedChoices.success) {
      return Response.json(
        { error: "choices_required", message: "A non-ending beat needs at least 2 choices." },
        { status: 400 },
      );
    }
    choices = parsedChoices.data.map((c) => ({
      text: c.text,
      skill: c.skill,
      dc: c.skill ? c.dc : null,
      successHint: null,
      failureHint: null,
    }));
  }

  const [latestScene, settings] = await Promise.all([
    db.scene.findFirst({ where: { campaignId: id }, orderBy: { order: "desc" } }),
    db.settings.findUnique({ where: { id: "default" } }),
  ]);
  const matureCombatAllowed = (settings?.matureCombatEnabled ?? false) && campaign.readingAge >= 10;

  let imagePath: string | null = campaign.worldSetting.lastSceneImage;
  const upload = form.get("image");
  const imagePrompt = form.get("imagePrompt");

  if (upload instanceof File) {
    if (upload.size > MAX_IMAGE_BYTES) {
      return Response.json({ error: "image_too_large", message: "That image is over 20MB." }, { status: 400 });
    }
    try {
      imagePath = await saveUploadedImage(Buffer.from(await upload.arrayBuffer()), upload.type);
    } catch (err) {
      return Response.json({ error: "unsupported_image", message: (err as Error).message }, { status: 400 });
    }
  } else if (typeof imagePrompt === "string" && imagePrompt.trim().length > 0) {
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
      sceneDescription: imagePrompt,
      campaignId: campaign.id,
    });
    imagePath = filename;
  }

  const act = isEnding ? "resolution" : campaign.act;
  const scene = await db.scene.create({
    data: {
      campaignId: id,
      order: (latestScene?.order ?? 0) + 1,
      act,
      prose: prose.trim(),
      imagePath,
      imagePrompt: typeof imagePrompt === "string" ? imagePrompt : null,
      dmNotes: "Hand-authored by the DM.",
      choices,
      isEnding,
    },
  });

  await db.campaign.update({ where: { id }, data: { act, status: isEnding ? "ended" : "active" } });
  await updateDigestIfNeeded(id);

  transport.broadcast(campaign.roomCode, { type: "scene", scene });

  if (!isEnding) {
    const priorScenes = await db.scene.findMany({
      where: { campaignId: id, id: { not: scene.id } },
      orderBy: { order: "asc" },
    });
    void triggerPrefetch({
      campaign: { ...campaign, act },
      characters: campaign.characters.map((link) => link.character),
      matureCombatAllowed,
      scene,
      priorScenes,
    });
  }

  return Response.json({ scene }, { status: 201 });
}
