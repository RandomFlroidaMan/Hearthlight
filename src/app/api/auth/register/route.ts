import { z } from "zod";
import { db } from "@/server/db";
import { parseJsonBody } from "@/server/http";
import { hashCode } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";

const registerSchema = z.object({
  bootstrapCode: z.string().min(1),
  familyName: z.string().trim().min(2).max(60),
  familyCode: z.string().min(4).max(60),
});

/**
 * Creates a brand-new family. Requires the deployment-wide bootstrap code
 * (HEARTHLIGHT_BOOTSTRAP_CODE) on top of the new family's own name+code —
 * that's what keeps this one Hearthlight instance from being an open
 * sign-up for strangers while still letting it host more than one real
 * family (you, your brother, ...).
 */
export async function POST(request: Request) {
  const bootstrapCode = process.env.HEARTHLIGHT_BOOTSTRAP_CODE;
  if (!bootstrapCode) {
    return Response.json(
      {
        error: "registration_disabled",
        message: "New families can't be created until HEARTHLIGHT_BOOTSTRAP_CODE is configured on this deployment.",
      },
      { status: 503 },
    );
  }

  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = registerSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { bootstrapCode: submittedCode, familyName, familyCode } = parsed.data;

  if (submittedCode !== bootstrapCode) {
    return Response.json({ error: "invalid_bootstrap_code", message: "That code isn't right." }, { status: 401 });
  }

  const existing = await db.family.findUnique({ where: { name: familyName } });
  if (existing) {
    return Response.json(
      { error: "family_name_taken", message: "A family with that name already exists — try logging in instead, or pick a different name." },
      { status: 409 },
    );
  }

  const family = await db.family.create({
    data: { name: familyName, codeHash: hashCode(familyCode) },
  });

  await createSession(family.id);

  return Response.json({ family: { id: family.id, name: family.name } }, { status: 201 });
}
