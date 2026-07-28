/**
 * Pure signing/verification for the family session cookie — no database,
 * no next/headers, so this same code works from both a Route
 * Handler/Server Component (Node.js runtime) and middleware.ts (Edge
 * runtime), which can't use next/headers' cookie store or reach the
 * database directly. Web Crypto (globalThis.crypto.subtle) is available
 * in both runtimes, unlike node:crypto.
 */

export const SESSION_COOKIE_NAME = "hearthlight_session";

let processSecret: string | null = null;

/** Falls back to a secret generated once per process rather than a
 * hardcoded value — sessions just won't survive a restart/redeploy until
 * HEARTHLIGHT_SESSION_SECRET is set, which is far safer than ever
 * shipping a real secret in source. */
function getSessionSecret(): string {
  if (process.env.HEARTHLIGHT_SESSION_SECRET) return process.env.HEARTHLIGHT_SESSION_SECRET;
  if (!processSecret) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    processSecret = toHex(bytes.buffer);
    console.warn(
      "HEARTHLIGHT_SESSION_SECRET is not set — using a random per-process secret, so every family will be logged out on the next restart/redeploy. Set HEARTHLIGHT_SESSION_SECRET to keep sessions across restarts.",
    );
  }
  return processSecret;
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
