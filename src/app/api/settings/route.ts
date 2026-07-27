import { z } from "zod";
import { db } from "@/server/db";

const SETTINGS_ID = "default";

const DEFAULTS = {
  narrationMuted: false,
  ambienceMuted: false,
  effectsMuted: false,
  dmFudgeEnabled: false,
};

const patchSchema = z.object({
  narrationMuted: z.boolean().optional(),
  ambienceMuted: z.boolean().optional(),
  effectsMuted: z.boolean().optional(),
  dmFudgeEnabled: z.boolean().optional(),
});

/** The Settings row is a lazily-created singleton — reads never create it,
 * so a GET before any preference has ever been touched just returns the
 * schema's own defaults rather than a row that doesn't exist yet. */
export async function GET() {
  const settings = await db.settings.findUnique({ where: { id: SETTINGS_ID } });
  return Response.json({
    narrationMuted: settings?.narrationMuted ?? DEFAULTS.narrationMuted,
    ambienceMuted: settings?.ambienceMuted ?? DEFAULTS.ambienceMuted,
    effectsMuted: settings?.effectsMuted ?? DEFAULTS.effectsMuted,
    dmFudgeEnabled: settings?.dmFudgeEnabled ?? DEFAULTS.dmFudgeEnabled,
  });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const settings = await db.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...DEFAULTS, ...parsed.data },
    update: parsed.data,
  });

  return Response.json({ settings });
}
