import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Family "codes" are simple, short, and typed by kids — scrypt is still
 * used (not plaintext) so the database itself never holds a usable
 * credential, but this is deliberately not hardened against a determined
 * attacker with database access the way a real per-user auth system would
 * be. That tradeoff matches what this actually is: a shared household
 * code, not an individual password.
 */
const KEY_LENGTH = 64;

export function hashCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(code, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyCode(code: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const hash = scryptSync(code, salt, KEY_LENGTH);
  const storedBuf = Buffer.from(hashHex, "hex");
  if (hash.length !== storedBuf.length) return false;
  return timingSafeEqual(hash, storedBuf);
}
