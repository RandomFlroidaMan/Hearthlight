import { mimeTypeForFilename, readImageBytes } from "@/server/art/imageStore";

// Filenames are always a sha256 hex hash + extension (see imageStore.ts) —
// this also rejects any path-traversal attempt via the route param.
const VALID_FILENAME = /^[a-f0-9]{64}\.(png|jpe?g|webp)$/;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;

  if (!VALID_FILENAME.test(filename)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const bytes = await readImageBytes(filename);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": mimeTypeForFilename(filename),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
