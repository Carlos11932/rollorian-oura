import { describe, it, expect } from "vitest";
import { insightRules } from "@/features/oura/server/insights/rules";
import type { DayContext } from "@/features/oura/server/insights/rules";

/**
 * S4 — Insights: Scenario 8 — No triggering rules
 *
 * GIVEN the day has data but no thresholds are crossed
 * WHEN insights are generated
 * THEN all rules return null (no triggered insights)
 *
 * We test the insightRules.evaluate() functions directly with mock DayContext.
 * No Prisma, no network — pure functional evaluation.
 */

// ─── Mock Data Builders ────────────────────────────────────────────────────────
//
// OuraSleepDaily and friends are Prisma types. In tests we cast them with
// the minimum required fields. We only need the fields used by the rules.

function makeSleepDaily(overrides: Partial<{
  score: number | null;
  averageHrv: number | null;
  efficiency: number | null;
  totalSleepSeconds: number | null;
  day: string;
}> = {}) {
  return {
    id: "test-id",
    ouraId: "oura-id",
    day: "2026-03-29",
    score: overrides.score ?? null,
    averageHrv: overrides.averageHrv ?? null,
    efficiency: overrides.efficiency ?? null,
    totalSleepSeconds: overrides.totalSleepSeconds ?? null,
    averageBreath: null,
    lowestHeartRate: null,
    deepSleepSeconds: null,
    lightSleepSeconds: null,
    remSleepSeconds: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as import("@prisma/client").OuraSleepDaily;
}

function makeStressDaily(overrides: Partial<{
  stressHighSeconds: number | null;
  recoveryHighSeconds: number | null;
}> = {}) {
  return {
    id: "test-id",
    ouraId: "oura-id",
    day: "2026-03-29",
    stressHighSeconds: overrides.stressHighSeconds ?? null,
    recoveryHighSeconds: overrides.recoveryHighSeconds ?? null,
    daySummary: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as import("@prisma/client").OuraStressDaily;
}

function makeContext(overrides: Partial<DayContext> = {}): DayContext {
  return {
    day: "2026-03-29",
    sleep: null,
    readiness: null,
    stress: null,
    resilience: null,
    sleepTrend14d: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Insight rules — Scenario 8: No triggering rules", () => {
  describe("GIVEN all data is null (no data for the day)", () => {
    it("all rules return null when context has no data", () => {
      const context = makeContext();

      for (const rule of insightRules) {
        const result = rule.evaluate(context);
        expect(result, `Rule ${rule.id} should return null with empty context`).toBeNull();
      }
    });
  });

  describe("GIVEN data is present but all within normal ranges (no thresholds crossed)", () => {
    it("low-sleep-score rule returns null for score >= 70", () => {
      const rule = insightRules.find((r) => r.id === "low-sleep-score")!;

      // Boundary: exactly 70 — should NOT fire
      const context70 = makeContext({ sleep: makeSleepDaily({ score: 70 }) });
      expect(rule.evaluate(context70)).toBeNull();

      // Well above threshold
      const context85 = makeContext({ sleep: makeSleepDaily({ score: 85 }) });
      expect(rule.evaluate(context85)).toBeNull();
    });

    it("high-stress rule returns null for stress <= 60 minutes (3600 seconds)", () => {
      const rule = insightRules.find((r) => r.id === "high-stress")!;

      // Exactly 60 minutes = 3600 seconds — boundary, should NOT fire
      const context60 = makeContext({ stress: makeStressDaily({ stressHighSeconds: 3600 }) });
      expect(rule.evaluate(context60)).toBeNull();

      // Below threshold
      const context30 = makeContext({ stress: makeStressDaily({ stressHighSeconds: 1800 }) });
      expect(rule.evaluate(context30)).toBeNull();
    });

    it("low-hrv rule returns null when HRV is within 20% of 14-day average", () => {
      const rule = insightRules.find((r) => r.id === "low-hrv")!;

      // 14-day average: 50 ms. Today: 42 ms → drop is (50-42)/50 = 16% < 20% → no fire
      const sleep = makeSleepDaily({ averageHrv: 42, day: "2026-03-29" });
      const trend = Array.from({ length: 7 }, (_, i) =>
        makeSleepDaily({ averageHrv: 50, day: `2026-03-${String(22 + i).padStart(2, "0")}` }),
      );

      const context = makeContext({ sleep, sleepTrend14d: trend });
      expect(rule.evaluate(context)).toBeNull();
    });

    it("low-hrv rule returns null when no 14-day trend data is available", () => {
      const rule = insightRules.find((r) => r.id === "low-hrv")!;
      const sleep = makeSleepDaily({ averageHrv: 30 }); // low but no trend to compare
      const context = makeContext({ sleep, sleepTrend14d: [] });
      expect(rule.evaluate(context)).toBeNull();
    });

    it("poor-efficiency rule returns null for efficiency >= 75", () => {
      const rule = insightRules.find((r) => r.id === "poor-efficiency")!;

      // Exactly at threshold
      const context75 = makeContext({ sleep: makeSleepDaily({ efficiency: 75 }) });
      expect(rule.evaluate(context75)).toBeNull();

      const context90 = makeContext({ sleep: makeSleepDaily({ efficiency: 90 }) });
      expect(rule.evaluate(context90)).toBeNull();
    });

    it("excellent-recovery rule returns null for recovery <= 90 minutes (5400 seconds)", () => {
      const rule = insightRules.find((r) => r.id === "excellent-recovery")!;

      // Exactly 90 minutes = 5400 seconds — boundary, should NOT fire
      const context90 = makeContext({ stress: makeStressDaily({ recoveryHighSeconds: 5400 }) });
      expect(rule.evaluate(context90)).toBeNull();

      const context60 = makeContext({ stress: makeStressDaily({ recoveryHighSeconds: 3600 }) });
      expect(rule.evaluate(context60)).toBeNull();
    });

    it("short-sleep rule returns null for total sleep >= 6 hours (21600 seconds)", () => {
      const rule = insightRules.find((r) => r.id === "short-sleep")!;

      // Exactly 6 hours = 21600 seconds — boundary, should NOT fire
      const context6h = makeContext({ sleep: makeSleepDaily({ totalSleepSeconds: 21600 }) });
      expect(rule.evaluate(context6h)).toBeNull();

      // 8 hours = 28800 seconds
      const context8h = makeContext({ sleep: makeSleepDaily({ totalSleepSeconds: 28800 }) });
      expect(rule.evaluate(context8h)).toBeNull();
    });

    it("all rules return null for a healthy day (all values in normal range)", () => {
      const sleep = makeSleepDaily({
        score: 82,
        averageHrv: 48,
        efficiency: 82,
        totalSleepSeconds: 25200, // 7 hours
      });
      const stress = makeStressDaily({
        stressHighSeconds: 1800,   // 30 min stress
        recoveryHighSeconds: 3600, // 60 min recovery (exactly at boundary → no fire)
      });
      // Trend HRV similar to today — no significant drop
      const trend = Array.from({ length: 7 }, (_, i) =>
        makeSleepDaily({ averageHrv: 50, day: `2026-03-${String(22 + i).padStart(2, "0")}` }),
      );

      const context = makeContext({ sleep, stress, sleepTrend14d: trend });

      const triggered = insightRules
        .map((r) => ({ id: r.id, result: r.evaluate(context) }))
        .filter((r) => r.result !== null);

      expect(triggered).toHaveLength(0);
    });
  });
});

describe("Insight rules — threshold verification (rules DO fire when thresholds crossed)", () => {
  it("low-sleep-score fires for score < 70", () => {
    const rule = insightRules.find((r) => r.id === "low-sleep-score")!;
    const context = makeContext({ sleep: makeSleepDaily({ score: 65 }) });
    const result = rule.evaluate(context);
    expect(result).not.toBeNull();
    expect(result?.metadata?.score).toBe(65);
  });

  it("high-stress fires for > 60 minutes of stress", () => {
    const rule = insightRules.find((r) => r.id === "high-stress")!;
    const context = makeContext({ stress: makeStressDaily({ stressHighSeconds: 4200 }) }); // 70 min
    const result = rule.evaluate(context);
    expect(result).not.toBeNull();
    expect(result?.metadata?.stressHighMinutes).toBe(70);
  });

  it("poor-efficiency fires for efficiency < 75", () => {
    const rule = insightRules.find((r) => r.id === "poor-efficiency")!;
    const context = makeContext({ sleep: makeSleepDaily({ efficiency: 65 }) });
    const result = rule.evaluate(context);
    expect(result).not.toBeNull();
    expect(result?.metadata?.efficiency).toBe(65);
  });

  it("short-sleep fires for < 6 hours (< 21600 seconds)", () => {
    const rule = insightRules.find((r) => r.id === "short-sleep")!;
    const context = makeContext({ sleep: makeSleepDaily({ totalSleepSeconds: 18000 }) }); // 5 hours
    const result = rule.evaluate(context);
    expect(result).not.toBeNull();
    expect(result?.metadata?.totalSleepHours).toBe(5.0);
  });

  it("excellent-recovery fires for > 90 minutes recovery", () => {
    const rule = insightRules.find((r) => r.id === "excellent-recovery")!;
    const context = makeContext({ stress: makeStressDaily({ recoveryHighSeconds: 6600 }) }); // 110 min
    const result = rule.evaluate(context);
    expect(result).not.toBeNull();
    expect(result?.metadata?.recoveryHighMinutes).toBe(110);
  });

  it("low-hrv fires when HRV drops > 20% below 14-day average", () => {
    const rule = insightRules.find((r) => r.id === "low-hrv")!;

    // Average: 50 ms. Today: 35 ms → drop = (50-35)/50 = 30% > 20% → fires
    const sleep = makeSleepDaily({ averageHrv: 35, day: "2026-03-29" });
    const trend = Array.from({ length: 7 }, (_, i) =>
      makeSleepDaily({ averageHrv: 50, day: `2026-03-${String(22 + i).padStart(2, "0")}` }),
    );

    const context = makeContext({ sleep, sleepTrend14d: trend });
    const result = rule.evaluate(context);
    expect(result).not.toBeNull();
    expect(result?.metadata?.dropPercent).toBeGreaterThan(20);
  });
});
