import { describe, it, expect } from "vitest";
import { insightRules } from "@/features/oura/server/insights/rules";
import type { DayContext } from "@/features/oura/server/insights/rules";
import type { DailyHealthSnapshot } from "@/features/oura/server/health-snapshot";

function makeSnapshot(
  overrides: Partial<DailyHealthSnapshot> = {},
): DailyHealthSnapshot {
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

function makeContext(overrides: Partial<DayContext> = {}): DayContext {
  return {
    day: "2026-03-29",
    snapshot: makeSnapshot(),
    trend14d: [],
    resilience: null,
    ...overrides,
  };
}

describe("Insight rules", () => {
  it("all rules return null with an empty snapshot", () => {
    const context = makeContext();
    for (const rule of insightRules) {
      expect(rule.evaluate(context), `Rule ${rule.id} should be null`).toBeNull();
    }
  });

  it("low-sleep-score fires for score below 70", () => {
    const rule = insightRules.find((item) => item.id === "low-sleep-score")!;
    const context = makeContext({
      snapshot: makeSnapshot({
        sleep: {
          score: 65,
          totalSleepSeconds: 24_000,
          timeInBedSeconds: 26_000,
          efficiency: 92,
          averageHrv: 45,
          averageHeartRate: 54,
          averageBreath: null,
          lowestHeartRate: 49,
          deepSleepSeconds: 4_000,
          remSleepSeconds: 5_000,
          lightSleepSeconds: 15_000,
          awakeSeconds: 2_000,
          bedtimeStart: null,
          bedtimeEnd: null,
          source: "mixed",
        },
      }),
    });

    expect(rule.evaluate(context)).not.toBeNull();
  });

  it("high-stress fires above 60 minutes", () => {
    const rule = insightRules.find((item) => item.id === "high-stress")!;
    const context = makeContext({
      snapshot: makeSnapshot({
        stress: {
          stressHighSeconds: 4_200,
          recoveryHighSeconds: 1_800,
          daySummary: "stressful",
        },
      }),
    });

    expect(rule.evaluate(context)?.metadata?.stressHighMinutes).toBe(70);
  });

  it("low-hrv compares against the 14-day baseline", () => {
    const rule = insightRules.find((item) => item.id === "low-hrv")!;
    const snapshot = makeSnapshot({
      sleep: {
        score: 82,
        totalSleepSeconds: 26_000,
        timeInBedSeconds: 28_000,
        efficiency: 88,
        averageHrv: 35,
        averageHeartRate: 55,
        averageBreath: null,
        lowestHeartRate: 48,
        deepSleepSeconds: 4_000,
        remSleepSeconds: 5_000,
        lightSleepSeconds: 17_000,
        awakeSeconds: 2_000,
        bedtimeStart: null,
        bedtimeEnd: null,
        source: "mixed",
      },
    });
    const trend14d = Array.from({ length: 7 }, (_, index) =>
      makeSnapshot({
        day: `2026-03-${String(22 + index).padStart(2, "0")}`,
        sleep: {
          score: 85,
          totalSleepSeconds: 27_000,
          timeInBedSeconds: 29_000,
          efficiency: 90,
          averageHrv: 50,
          averageHeartRate: 53,
          averageBreath: null,
          lowestHeartRate: 47,
          deepSleepSeconds: 4_200,
          remSleepSeconds: 5_100,
          lightSleepSeconds: 17_700,
          awakeSeconds: 1_000,
          bedtimeStart: null,
          bedtimeEnd: null,
          source: "mixed",
        },
      }),
    );

    const context = makeContext({ snapshot, trend14d });
    expect(rule.evaluate(context)?.metadata?.dropPercent).toBeGreaterThan(20);
  });

  it("short-sleep fires below six hours", () => {
    const rule = insightRules.find((item) => item.id === "short-sleep")!;
    const context = makeContext({
      snapshot: makeSnapshot({
        sleep: {
          score: 60,
          totalSleepSeconds: 18_000,
          timeInBedSeconds: 20_000,
          efficiency: 70,
          averageHrv: 40,
          averageHeartRate: 56,
          averageBreath: null,
          lowestHeartRate: 50,
          deepSleepSeconds: 3_000,
          remSleepSeconds: 3_000,
          lightSleepSeconds: 12_000,
          awakeSeconds: 2_000,
          bedtimeStart: null,
          bedtimeEnd: null,
          source: "mixed",
        },
      }),
    });

    expect(rule.evaluate(context)?.metadata?.totalSleepHours).toBe(5);
  });

  it("partial-sync fires when freshness says the day is partial", () => {
    const rule = insightRules.find((item) => item.id === "partial-sync")!;
    const context = makeContext({
      snapshot: makeSnapshot({
        freshness: {
          lastSuccessfulSync: null,
          isPartial: true,
          missingBlocks: ["activity"],
          missingMetrics: ["sleep.averageHrv"],
        },
      }),
    });

    expect(rule.evaluate(context)?.metadata?.missingBlocks).toEqual(["activity"]);
  });
});
