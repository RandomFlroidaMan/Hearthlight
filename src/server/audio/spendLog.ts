import { db } from "@/server/db";

/**
 * Rough placeholder rate — same caveat as logImageSpend in
 * src/server/art/spendLog.ts: OpenAI's pricing docs weren't fetchable to
 * confirm an exact rate for gpt-4o-mini-tts, so this is deliberately
 * conservative and clearly not authoritative. Good enough for a directional
 * running total; replace with a confirmed rate before trusting it for real
 * budgeting. Priced per input character, since that's the natural unit for
 * a TTS request (unlike images, there's no token usage field on the
 * response to key off instead).
 */
const PLACEHOLDER_USD_PER_1K_CHARACTERS = 0.015;

export async function logTtsSpend(params: {
  campaignId?: string | null;
  characters: number;
}): Promise<void> {
  await db.spendLog.create({
    data: {
      campaignId: params.campaignId ?? undefined,
      kind: "tts",
      amount: params.characters,
      costUsd: (params.characters / 1000) * PLACEHOLDER_USD_PER_1K_CHARACTERS,
    },
  });
}
