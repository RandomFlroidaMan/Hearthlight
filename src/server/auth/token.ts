/**
 * Pure signing/verification for the family session cookie — no database,
 * no next/headers, so this same code works from both a Route
 * Handler/Server Component (Node.js runtime) and middleware.ts (Edge
 * runtime), which can't use next/headers' cookie store or reach the
 * database directly. Web Crypto (globalThis.crypto.subtle) is available
 * in both runtimes, unlike node:crypto.
 */

export const SESSION_COOKIE_NAME = "hearthlight_session";

/** Used only when HEARTHLIGHT_SESSION_SECRET is unset. Deliberately a fixed
 * value rather than one randomly generated per process: middleware.ts runs
 * in a separate Edge runtime sandbox from the Node.js Route Handlers even
 * under this app's custom server, so two independently-random fallbacks
 * would never agree — every session would fail verification in middleware
 * immediately after a successful login, an outright lockout with no
 * visible error. A fixed fallback at least works consistently. It is NOT a
 * substitute for a real secret (anyone who reads this source could forge a
 * session cookie against a deployment that never set its own) — that's
 * what the warning below is for. */
const INSECURE_DEFAULT_SECRET = "hearthlight-default-secret-set-HEARTHLIGHT_SESSION_SECRET-before-real-use";

let warned = false;

function getSessionSecret(): string {
  if (process.env.HEARTHLIGHT_SESSION_SECRET) return process.env.HEARTHLIGHT_SESSION_SECRET;
  if (!warned) {
    warned = true;
    console.warn(
      "HEARTHLIGHT_SESSION_SECRET is not set — falling back to a fixed, publicly-known default secret so logins keep working. This means anyone who reads this app's source could forge a session cookie. Set HEARTHLIGHT_SESSION_SECRET to a real random value before relying on this for anything but local development.",
    );
  }
  return INSECURE_DEFAULT_SECRET;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(Math.floor(hex.length / 2)));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signFamilyId(familyId: string): Promise<string> {
  const key = await getKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(familyId));
  return `${familyId}.${toHex(sig)}`;
}

export async function verifySignedFamilyId(value: string): Promise<string | null> {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return null;
  const familyId = value.slice(0, dot);
  const macHex = value.slice(dot + 1);
  if (!familyId || !macHex) return null;
  const key = await getKey();
  const valid = await crypto.subtle.verify("HMAC", key, fromHex(macHex), new TextEncoder().encode(familyId));
  return valid ? familyId : null;
}
