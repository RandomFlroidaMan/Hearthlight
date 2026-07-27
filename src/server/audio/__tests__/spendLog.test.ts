import { describe, expect, it, vi } from "vitest";

const spendLogCreate = vi.fn().mockResolvedValue({});

vi.mock("@/server/db", () => ({
  db: { spendLog: { create: spendLogCreate } },
}));

const { logTtsSpend } = await import("../spendLog");

describe("logTtsSpend", () => {
  it("writes a spend log row with kind 'tts' keyed on character count", async () => {
    await logTtsSpend({ campaignId: "camp-1", characters: 2000 });

    expect(spendLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        campaignId: "camp-1",
        kind: "tts",
        amount: 2000,
      }),
    });
    const costUsd = spendLogCreate.mock.calls[0][0].data.costUsd;
    expect(costUsd).toBeGreaterThan(0);
  });

  it("omits campaignId when not provided", async () => {
    spendLogCreate.mockClear();
    await logTtsSpend({ characters: 100 });
    expect(spendLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ campaignId: undefined }),
    });
  });
});
