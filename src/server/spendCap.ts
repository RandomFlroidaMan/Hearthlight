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

/** `Settings.monthlyCapUsd` is nullable — null/unset means no cap. */
export async function isMonthlyCapExceeded(): Promise<boolean> {
  const settings = await db.settings.findUnique({ where: { id: SETTINGS_ID } });
  const cap = settings?.monthlyCapUsd;
  if (cap === null || cap === undefined) return false;
  const spent = await getMonthSpendUsd();
  return spent >= cap;
}
