import { db } from "@/server/db";

/**
 * Rough placeholder rate — OpenAI's pricing docs weren't fetchable to
 * confirm an exact per-token image cost (platform.openai.com blocks
 * scraping in this environment), so this is deliberately conservative and
 * clearly not authoritative. Good enough for a directional running total;
 * replace with a confirmed rate before trusting it for real budgeting.
 */
const PLACEHOLDER_USD_PER_1K_IMAGE_TOKENS = 0.04;

export async function logImageSpend(params: {
  campaignId?: string | null;
  totalTokens: number;
}): Promise<void> {
  await db.spendLog.create({
    data: {
      campaignId: params.campaignId ?? undefined,
      kind: "image",
      amount: params.totalTokens,
      costUsd: (params.totalTokens / 1000) * PLACEHOLDER_USD_PER_1K_IMAGE_TOKENS,
    },
  });
}
