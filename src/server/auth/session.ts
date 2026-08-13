import { cookies } from "next/headers";
import { db } from "@/server/db";
import { signFamilyId, verifySignedFamilyId, SESSION_COOKIE_NAME } from "./token";
import type { Family } from "@/generated/prisma/client";

export { SESSION_COOKIE_NAME };
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function createSession(familyId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, await signFamilyId(familyId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentFamilyId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) return null;
  return verifySignedFamilyId(raw);
}

export async function getCurrentFamily(): Promise<Family | null> {
  const familyId = await getCurrentFamilyId();
  if (!familyId) return null;
  return db.family.findUnique({ where: { id: familyId } });
}

/** The ok/response-union pattern src/server/http.ts already uses for body
 * parsing — every family-scoped API route starts with this instead of
 * repeating the same 401 check. */
export async function requireFamilyId(): Promise<
  { ok: true; familyId: string } | { ok: false; response: Response }
> {
  const familyId = await getCurrentFamilyId();
  if (!familyId) {
    return { ok: false, response: Response.json({ error: "not_authenticated" }, { status: 401 }) };
  }
  return { ok: true, familyId };
}
