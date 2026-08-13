import { z } from "zod";
import { db } from "@/server/db";
import { parseJsonBody } from "@/server/http";
import { verifyCode } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";

const loginSchema = z.object({
  familyName: z.string().trim().min(1),
  familyCode: z.string().min(1),
});

export async function POST(request: Request) {
  const bodyResult = await parseJsonBody(request);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = loginSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { familyName, familyCode } = parsed.data;
  const family = await db.family.findUnique({ where: { name: familyName } });

  // Same "invalid" message either way — not confirming whether a family
  // name exists is a small, easy safety margin for a code that's typed by
  // kids and might get shared more widely than intended.
  if (!family || !verifyCode(familyCode, family.codeHash)) {
    return Response.json(
      { error: "invalid_credentials", message: "That family name and code don't match." },
      { status: 401 },
    );
  }

  await createSession(family.id);

  return Response.json({ family: { id: family.id, name: family.name } });
}
