import { NextResponse, type NextRequest } from "next/server";
import { verifySignedFamilyId, SESSION_COOKIE_NAME } from "@/server/auth/token";

/**
 * Redirect-to-login gate for page navigations. Verifies the session
 * signature (via Web Crypto, portable to this Edge middleware — see
 * token.ts) but deliberately doesn't touch the database here; that's not
 * a security gap, since every route that actually reads/writes
 * family-scoped data re-derives the family from the same cookie itself
 * (src/server/auth/session.ts's getCurrentFamily) rather than trusting
 * anything this middleware decided.
 *
 * API routes are excluded from the redirect (a JSON endpoint shouldn't
 * respond with an HTML redirect) — each one checks the session itself
 * and returns a real 401 if it's missing.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const familyId = cookie ? await verifySignedFamilyId(cookie) : null;

  if (!familyId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
