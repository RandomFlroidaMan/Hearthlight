import { db } from "@/server/db";
import { parseFormData } from "@/server/http";
import { requireFamilyId } from "@/server/auth/session";
import { generatePortraitFromPhoto, PhotoPortraitRejectedError } from "@/server/art/generatePortrait";
import { isMonthlyCapExceeded } from "@/server/spendCap";

const MAX_PHOTO_BYTES = 20 * 1024 * 1024; // 20MB, same ceiling as world-setting reference uploads

/** Generates (or regenerates) a character's portrait from an uploaded photo
 * of a real kid or pet, restyled into the app's painterly art style. A
 * deliberate, one-off action a family clicks and waits on — unlike the
 * background-generation pattern used for beats, this stays a simple
 * synchronous request/response so a rejected photo can be explained and
 * retried immediately. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFamilyId();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const character = await db.character.findUnique({ where: { id } });
  if (!character || character.familyId !== auth.familyId) {
    return Response.json({ error: "character_not_found" }, { status: 404 });
  }

  if (await isMonthlyCapExceeded()) {
    return Response.json(
      {
        error: "monthly_cap_exceeded",
        message: "This month's spending cap has been reached — raise it in Preferences to generate more art.",
      },
      { status: 402 },
    );
  }

  const formDataResult = await parseFormData(request);
  if (!formDataResult.ok) return formDataResult.response;
  const photo = formDataResult.data.get("photo");
  if (!(photo instanceof File)) {
    return Response.json({ error: "photo_required" }, { status: 400 });
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return Response.json(
      { error: "photo_too_large", message: "That photo is over 20MB." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await photo.arrayBuffer());

  try {
    const filename = await generatePortraitFromPhoto(id, { bytes, mimeType: photo.type });
    return Response.json({ portraitPath: filename }, { status: 200 });
  } catch (err) {
    if (err instanceof PhotoPortraitRejectedError) {
      return Response.json({ error: "photo_rejected", message: err.message }, { status: 422 });
    }
    console.error(`Photo portrait generation failed for character ${id}:`, err);
    return Response.json(
      { error: "portrait_generation_failed", message: "Something went wrong making that portrait." },
      { status: 502 },
    );
  }
}
