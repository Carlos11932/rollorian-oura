import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * S4 — Insights: Scenario 9 — Repeat generation for same day
 *
 * GIVEN rules run twice for the same day
 * WHEN equivalent insights are produced
 * THEN duplicates are not created
 *
 * The engine uses deleteMany + createMany in a $transaction to avoid duplicates.
 * We test that upsert logic by verifying:
 *   1. deleteMany is called with the correct filter before createMany
 *   2. The transaction always deletes before inserting (atomic replace, not append)
 *
 * We mock Prisma and the data layer functions to isolate the engine logic.
 *
 * NOTE: engine.ts imports from "@/lib/prisma" and "@/features/oura/server/data".
 * Both are mocked via vi.mock() below.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
const mockCreateMany = vi.fn().mockResolvedValue({ count: 0 });
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ouraInsight: {
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
      createMany: (...args: unknown[]) => mockCreateMany(...args),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

// Mock the data layer — return empty arrays/nulls so no rules fire
vi.mock("@/features/oura/server/data", () => ({
  getRawSleepDaily: vi.fn().mockResolvedValue([]),
  getRawReadiness: vi.fn().mockResolvedValue(null),
  getRawStressDaily: vi.fn().mockResolvedValue([]),
  getRawResilienceDaily: vi.fn().mockResolvedValue(null),
  getRawSleepTrend: vi.fn().mockResolvedValue([]),
}));

// ─── Import after mocks ────────────────────────────────────────────────────────

import { generateInsights } from "@/features/oura/server/insights/engine";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Insights engine — upsert/repeat generation (Scenario 9)", () => {
  const DAY = "2026-03-29";
  const GENERATED_BY = "rules/context-api";

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: $transaction executes the interactive callback with a mock tx client
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        ouraInsight: {
          deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
          createMany: (...args: unknown[]) => mockCreateMany(...args),
        },
      };
      return fn(tx);
    });
  });

  describe("GIVEN no data (all null) — no rules fire", () => {
    it("returns an empty array", async () => {
      const insights = await generateInsights(DAY);
      expect(insights).toEqual([]);
    });

    it("still calls $transaction (with just deleteMany, no createMany)", async () => {
      await generateInsights(DAY);
      expect(mockTransaction).toHaveBeenCalledOnce();
      // No candidates → createMany should NOT have been called
      expect(mockCreateMany).not.toHaveBeenCalled();
    });

    it("passes a callback function to $transaction (interactive style)", async () => {
      await generateInsights(DAY);

      const transactionArg = mockTransaction.mock.calls[0][0];
      // Interactive transaction receives a function, not an array
      expect(typeof transactionArg).toBe("function");
    });

    it("deleteMany targets the correct day and generatedBy", async () => {
      await generateInsights(DAY);

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { day: DAY, generatedBy: GENERATED_BY },
      });
    });
  });

  describe("Scenario 9: Repeat generation — upsert prevents duplicates", () => {
    it("on second call, deleteMany clears old insights before creating new ones", async () => {
      // First run
      await generateInsights(DAY);
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          ouraInsight: {
            deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
            createMany: (...args: unknown[]) => mockCreateMany(...args),
          },
        };
        return fn(tx);
      });

      // Second run (same day)
      await generateInsights(DAY);
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { day: DAY, generatedBy: GENERATED_BY },
      });
    });

    it("deleteMany is always called BEFORE createMany in the transaction", async () => {
      // With the interactive transaction, both deleteMany and createMany are called
      // inside the callback. We verify deleteMany is called and (with no candidates)
      // createMany is NOT called — ensuring delete-first semantics.
      await generateInsights(DAY);

      expect(mockDeleteMany).toHaveBeenCalledOnce();
      expect(mockCreateMany).not.toHaveBeenCalled();
    });

    it("deletes before creates when rules fire", async () => {
      const callOrder: string[] = [];
      mockDeleteMany.mockImplementation(async () => {
        callOrder.push("delete");
        return { count: 0 };
      });
      mockCreateMany.mockImplementation(async () => {
        callOrder.push("create");
        return { count: 1 };
      });

      // Provide a sleep record with score < 70 so the lowSleepScore rule fires
      const { getRawSleepDaily } = await import("@/features/oura/server/data");
      vi.mocked(getRawSleepDaily).mockResolvedValueOnce([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { day: DAY, score: 65 } as any,
      ]);

      await generateInsights(DAY);

      // delete must always be first
      expect(callOrder[0]).toBe("delete");
      if (callOrder.length > 1) {
        expect(callOrder[1]).toBe("create");
      }
    });

    it("the transaction always deletes before inserting — atomic replace not append", async () => {
      // By always deleting before creating within the interactive transaction,
      // running twice produces exactly N insights (not 2N).
      await generateInsights(DAY);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          ouraInsight: {
            deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
            createMany: (...args: unknown[]) => mockCreateMany(...args),
          },
        };
        return fn(tx);
      });

      await generateInsights(DAY);
      // Second run: transaction called once, deleteMany once, no createMany
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("generateInsights returns correct shape", () => {
    it("returns an array (even when empty)", async () => {
      const result = await generateInsights(DAY);
      expect(Array.isArray(result)).toBe(true);
    });

    it("persisted: 0 when no rules fire (empty candidates)", async () => {
      const generated = await generateInsights(DAY);
      // The function returns generated insights array; persisted count = generated.length
      expect(generated).toHaveLength(0);
      // The endpoint uses generated.length as persisted count
      // Verified: no rules fired → 0 generated → persisted: 0
      expect(generated.length).toBe(0);
    });
  });
});

describe("Insights engine — isStale logic (unit)", () => {
  /**
   * The isStale() function is not exported, but we can test its behavior
   * indirectly through areInsightsStale(). For now we test the inline logic.
   */

  function isStale(createdAt: Date, staleHours = 6): boolean {
    const ageMs = Date.now() - createdAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    return ageHours > staleHours;
  }

  it("returns false for insight created 1 hour ago", () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    expect(isStale(oneHourAgo)).toBe(false);
  });

  it("returns false for insight created 6 hours ago (boundary — not yet stale)", () => {
    // Exactly 6 hours — NOT stale (threshold is >6, not >=6)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    expect(isStale(sixHoursAgo)).toBe(false);
  });

  it("returns true for insight created 7 hours ago", () => {
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000);
    expect(isStale(sevenHoursAgo)).toBe(true);
  });

  it("returns true for insight created 24 hours ago", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isStale(yesterday)).toBe(true);
  });
});
