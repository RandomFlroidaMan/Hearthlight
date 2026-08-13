import { describe, expect, it, vi } from "vitest";

const settingsFindUnique = vi.fn();
const spendLogAggregate = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    settings: { findUnique: settingsFindUnique },
    spendLog: { aggregate: spendLogAggregate },
  },
}));

const { isMonthlyCapExceeded, getMonthSpendUsd } = await import("../spendCap");

describe("getMonthSpendUsd", () => {
  it("returns 0 when there's no spend yet", async () => {
    spendLogAggregate.mockResolvedValue({ _sum: { costUsd: null } });
    expect(await getMonthSpendUsd()).toBe(0);
  });

  it("returns the aggregated sum", async () => {
    spendLogAggregate.mockResolvedValue({ _sum: { costUsd: 4.5 } });
    expect(await getMonthSpendUsd()).toBe(4.5);
  });
});

describe("isMonthlyCapExceeded", () => {
  it("is never exceeded when no cap is set", async () => {
    settingsFindUnique.mockResolvedValue({ monthlyCapUsd: null });
    spendLogAggregate.mockResolvedValue({ _sum: { costUsd: 1000 } });
    expect(await isMonthlyCapExceeded()).toBe(false);
  });

  it("is never exceeded when no Settings row exists yet", async () => {
    settingsFindUnique.mockResolvedValue(null);
    spendLogAggregate.mockResolvedValue({ _sum: { costUsd: 1000 } });
    expect(await isMonthlyCapExceeded()).toBe(false);
  });

  it("is exceeded once spend reaches the cap", async () => {
    settingsFindUnique.mockResolvedValue({ monthlyCapUsd: 5 });
    spendLogAggregate.mockResolvedValue({ _sum: { costUsd: 5 } });
    expect(await isMonthlyCapExceeded()).toBe(true);
  });

  it("is not exceeded while spend is under the cap", async () => {
    settingsFindUnique.mockResolvedValue({ monthlyCapUsd: 5 });
    spendLogAggregate.mockResolvedValue({ _sum: { costUsd: 4.99 } });
    expect(await isMonthlyCapExceeded()).toBe(false);
  });
});
