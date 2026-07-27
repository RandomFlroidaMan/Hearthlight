import { db } from "@/server/db";

// Excludes 0/O/1/I/L — easy to misread aloud or on a small screen, and this
// code is meant to be read out to whoever's holding the second device.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LENGTH = 4;

function randomCode(): string {
  let code = "";
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

/** Generates a room code guaranteed unique against existing campaigns.
 * Collisions are astronomically unlikely at this scale (a single family's
 * campaign list, not a public service) but checked anyway rather than
 * assumed. */
export async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomCode();
    const existing = await db.campaign.findUnique({ where: { roomCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique room code after 10 attempts.");
}
