import { db } from "@/server/db";
import { saveUploadedImage } from "@/server/art/imageStore";

const MAX_REFERENCE_IMAGES = 5;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB per image

export async function GET() {
  const worldSettings = await db.worldSetting.findMany({
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ worldSettings });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const name = formData.get("name");
  const description = formData.get("description");
  const paletteKey = formData.get("paletteKey");

  if (typeof name !== "string" || name.trim().length === 0) {
    return Response.json({ error: "name_required" }, { status: 400 });
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    return Response.json({ error: "description_required" }, { status: 400 });
  }

  const files = formData.getAll("referenceImages").filter((f): f is File => f instanceof File);
  if (files.length > MAX_REFERENCE_IMAGES) {
    return Response.json(
      { error: "too_many_images", message: `Up to ${MAX_REFERENCE_IMAGES} reference images.` },
      { status: 400 },
    );
  }

  const referenceImages: string[] = [];
  for (const file of files) {
    if (file.size > MAX_IMAGE_BYTES) {
      return Response.json(
        { error: "image_too_large", message: `${file.name} is over 20MB.` },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      referenceImages.push(await saveUploadedImage(buffer, file.type));
    } catch (err) {
      return Response.json(
        { error: "unsupported_image", message: (err as Error).message },
        { status: 400 },
      );
    }
  }

  const worldSetting = await db.worldSetting.create({
    data: {
      name: name.trim(),
      description: description.trim(),
      paletteKey: typeof paletteKey === "string" && paletteKey.length > 0 ? paletteKey : null,
      referenceImages,
    },
  });

  return Response.json({ worldSetting }, { status: 201 });
}
