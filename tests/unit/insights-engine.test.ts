import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDeleteMany, mockCreateMany, mockTransaction } = vi.hoisted(() => ({
  mockDeleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockCreateMany: vi.fn().mockResolvedValue({ count: 0 }),
  mockTransaction: vi.fn(),
}));

const { getDailyHealthSnapshotMock, getDailyHealthTrendMock, getRawResilienceDailyMock } =
  vi.hoisted(() => ({
    getDailyHealthSnapshotMock: vi.fn(),
    getDailyHealthTrendMock: vi.fn(),
    getRawResilienceDailyMock: vi.fn(),
  }));

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

vi.mock("@/features/oura/server/health-snapshot", () => ({
  getDailyHealthSnapshot: getDailyHealthSnapshotMock,
  getDailyHealthTrend: getDailyHealthTrendMock,
}));

vi.mock("@/features/oura/server/data", () => ({
  getRawResilienceDaily: getRawResilienceDailyMock,
}));

import { generateInsights } from "@/features/oura/server/insights/engine";

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    day: "2026-03-29",
    sleep: null,
    readiness: null,
    activity: null,
    stress: null,
    vitals: null,
    syncStatus: { available: [], unavailable: [] },
    freshness: {
      lastSuccessfulSync: null,
      isPartial: false,
      missingBlocks: [],
      missingMetrics: [],
    },
    ...overrides,
  };
}

describe("Insights engine", () => {
  const DAY = "2026-03-29";
  const GENERATED_BY = "rules/context-api";

  beforeEach(() => {
    vi.clearAllMocks();
    getDailyHealthSnapshotMock.mockResolvedValue(makeSnapshot());
    getDailyHealthTrendMock.mockResolvedValue([]);
    getRawResilienceDailyMock.mockResolvedValue(null);

    mockTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          ouraInsight: {
            deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
            createMany: (...args: unknown[]) => mockCreateMany(...args),
          },
        }),
    );
  });

  it("returns an empty array when no rules fire", async () => {
    const insights = await generateInsights(DAY);
    expect(insights).toEqual([]);
  });

  it("always deletes previous insights for the day before inserting", async () => {
    await generateInsights(DAY);
    expect(mockDeleteMany).toHaveBeenCalledWith({
      where: { day: DAY, generatedBy: GENERATED_BY },
    });
  });

  it("does not create new rows when no rules fire", async () => {
    await generateInsights(DAY);
    expect(mockCreateMany).not.toHaveBeenCalled();
  });

  it("inserts generated insights when a rule fires", async () => {
    getDailyHealthSnapshotMock.mockResolvedValueOnce(
      makeSnapshot({
        sleep: {
          score: 65,
          totalSleepSeconds: 18_000,
          timeInBedSeconds: 20_000,
          efficiency: 70,
          averageHrv: 35,
          averageHeartRate: 55,
          averageBreath: null,
          lowestHeartRate: 48,
          deepSleepSeconds: 3_000,
          remSleepSeconds: 3_000,
          lightSleepSeconds: 12_000,
          awakeSeconds: 2_000,
          bedtimeStart: null,
          bedtimeEnd: null,
          source: "mixed",
        },
      }),
    );

    const insights = await generateInsights(DAY);

    expect(insights.length).toBeGreaterThan(0);
    expect(mockCreateMany).toHaveBeenCalledOnce();
  });
});
