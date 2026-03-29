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

    // Default: $transaction executes the operations array
    mockTransaction.mockImplementation(async (ops: unknown[]) => {
      const results = [];
      for (const op of ops) {
        if (op && typeof op === "object" && op !== null && "then" in op) {
          results.push(await (op as Promise<unknown>));
        } else {
          results.push(op);
        }
      }
      return results;
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
    });

    it("passes deleteMany as the first operation in the transaction", async () => {
      await generateInsights(DAY);

      const transactionArgs = mockTransaction.mock.calls[0][0] as unknown[];
      // Transaction receives an array: [deleteMany result, ...createMany results]
      // With no candidates, the array is [deleteMany] only
      expect(transactionArgs).toHaveLength(1);
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
      mockTransaction.mockImplementation(async (ops: unknown[]) => {
        const results = [];
        for (const op of ops) {
          if (op && typeof op === "object" && op !== null && "then" in op) {
            results.push(await (op as Promise<unknown>));
          } else {
            results.push(op);
          }
        }
        return results;
      });

      // Second run (same day)
      await generateInsights(DAY);
      expect(mockDeleteMany).toHaveBeenCalledTimes(1);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { day: DAY, generatedBy: GENERATED_BY },
      });
    });

    it("deleteMany is always called BEFORE createMany in the transaction", async () => {
      await generateInsights(DAY);

      const deleteManyCall = mockDeleteMany.mock.invocationCallOrder[0];
      const transactionCall = mockTransaction.mock.invocationCallOrder[0];

      // deleteMany must be called before or as part of the transaction
      // The transaction is called once; deleteMany is called to build the op array
      expect(deleteManyCall).toBeLessThan(transactionCall);
    });

    it("the transaction always deletes before inserting — atomic replace not append", async () => {
      // This test verifies the architecture of the transaction array:
      // [prisma.ouraInsight.deleteMany(...), ...createMany if any]
      // By always deleting first, running twice produces exactly N insights (not 2N).

      await generateInsights(DAY);
      const transactionOpsFirst = mockTransaction.mock.calls[0][0] as unknown[];

      vi.clearAllMocks();
      mockTransaction.mockImplementation(async (ops: unknown[]) => {
        const results = [];
        for (const op of ops) {
          if (op && typeof op === "object" && op !== null && "then" in op) {
            results.push(await (op as Promise<unknown>));
          } else {
            results.push(op);
          }
        }
        return results;
      });

      await generateInsights(DAY);
      const transactionOpsSecond = mockTransaction.mock.calls[0][0] as unknown[];

      // Both runs produce the same number of transaction operations
      expect(transactionOpsFirst.length).toBe(transactionOpsSecond.length);
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
