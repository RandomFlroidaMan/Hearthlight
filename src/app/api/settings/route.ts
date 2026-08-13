import { z } from "zod";
import { db } from "@/server/db";
import { parseJsonBody } from "@/server/http";
import { envDefaultCapUsd } from "@/server/spendCap";

const SETTINGS_ID = "default";

const DEFAULTS = {
  narrationMuted: false,
  ambienceMuted: false,
  effectsMuted: false,
  dmFudgeEnabled: false,
  matureCombatEnabled: false,
  monthlyCapUsd: null as number | null,
};

const patchSchema = z.object({
  narrationMuted: z.boolean().optional(),
  ambienceMuted: z.boolean().optional(),
  effectsMuted: z.boolean().optional(),
  dmFudgeEnabled: z.boolean().optional(),
  matureCombatEnabled: z.boolean().optional(),
  monthlyCapUsd: z.number().positive().nullable().optional(),
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
    matureCombatEnabled: settings?.matureCombatEnabled ?? DEFAULTS.matureCombatEnabled,
    // Reflects the same fallback isMonthlyCapExceeded uses — Preferences
    // shows the deployment-time HEARTHLIGHT_MONTHLY_CAP_USD default until
    // someone explicitly sets (or explicitly clears) a cap here.
    monthlyCapUsd: settings?.monthlyCapUsd ?? envDefaultCapUsd() ?? DEFAULTS.monthlyCapUsd,
  });
}

export async function PATCH(request: Request) {
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = patchSchema.safeParse(bodyResult.data);
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
