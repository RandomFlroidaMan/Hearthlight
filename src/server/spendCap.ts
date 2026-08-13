import { db } from "@/server/db";

const SETTINGS_ID = "default";

/** Sum of every SpendLog row's costUsd since the start of the current
 * calendar month — the unit "monthly cap" is denominated in. */
export async function getMonthSpendUsd(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const result = await db.spendLog.aggregate({
    where: { createdAt: { gte: startOfMonth } },
    _sum: { costUsd: true },
  });
  return result._sum.costUsd ?? 0;
}

/** `Settings.monthlyCapUsd` (set via the Preferences page) is the primary
 * cap; HEARTHLIGHT_MONTHLY_CAP_USD is only a deployment-time default that
 * applies until someone explicitly sets (or explicitly clears) a cap in
 * Preferences — it does not stack with, and is never added to, the DB
 * value. Both unset means no cap. */
export function envDefaultCapUsd(): number | null {
  const raw = process.env.HEARTHLIGHT_MONTHLY_CAP_USD;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function isMonthlyCapExceeded(): Promise<boolean> {
  const settings = await db.settings.findUnique({ where: { id: SETTINGS_ID } });
  const cap = settings?.monthlyCapUsd ?? envDefaultCapUsd();
  if (cap === null || cap === undefined) return false;
  const spent = await getMonthSpendUsd();
  return spent >= cap;
}
