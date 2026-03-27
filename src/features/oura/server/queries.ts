import "server-only";
import { prisma } from "@/lib/prisma";
import { subDays, format } from "date-fns";

// ─── Period ───────────────────────────────────────────────────────────────────

const PERIOD = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
} as const;

export type Period = keyof typeof PERIOD;

function getDateRange(period: Period): { start: string; end: string } {
  const end = new Date();
  const start = subDays(end, PERIOD[period]);
  return {
    start: format(start, "yyyy-MM-dd"),
    end: format(end, "yyyy-MM-dd"),
  };
}

// ─── Sleep Chart Data ─────────────────────────────────────────────────────────

export interface SleepChartPoint {
  day: string;
  totalHours: number;
  deep: number;
  light: number;
  rem: number;
  efficiency: number | null;
  score: number | null;
}

export async function getSleepChartData(
  period: Period,
): Promise<SleepChartPoint[]> {
  const { start, end } = getDateRange(period);

  const rows = await prisma.ouraSleepDaily.findMany({
    where: {
      day: { gte: start, lte: end },
    },
    select: {
      day: true,
      totalSleepSeconds: true,
      deepSleepSeconds: true,
      lightSleepSeconds: true,
      remSleepSeconds: true,
      efficiency: true,
      score: true,
    },
    orderBy: { day: "asc" },
  });

  return rows.map((row) => ({
    day: row.day,
    totalHours: row.totalSleepSeconds ? row.totalSleepSeconds / 3600 : 0,
    deep: row.deepSleepSeconds ? row.deepSleepSeconds / 3600 : 0,
    light: row.lightSleepSeconds ? row.lightSleepSeconds / 3600 : 0,
    rem: row.remSleepSeconds ? row.remSleepSeconds / 3600 : 0,
    efficiency: row.efficiency ?? null,
    score: row.score ?? null,
  }));
}

// ─── Metrics Data ─────────────────────────────────────────────────────────────

export interface MetricsPoint {
  day: string;
  restingHR: number | null;
  cardioAge: number | null;
  stressHigh: number | null;
  recoveryHigh: number | null;
  [key: string]: string | number | null;
}

export async function getMetricsData(period: Period): Promise<MetricsPoint[]> {
  const { start, end } = getDateRange(period);

  const [sleepRows, cardioRows, stressRows] = await Promise.all([
    prisma.ouraSleepDaily.findMany({
      where: { day: { gte: start, lte: end } },
      select: { day: true, lowestHeartRate: true },
      orderBy: { day: "asc" },
    }),
    prisma.ouraCardiovascularAge.findMany({
      where: { day: { gte: start, lte: end } },
      select: { day: true, vascularAge: true },
      orderBy: { day: "asc" },
    }),
    prisma.ouraStressDaily.findMany({
      where: { day: { gte: start, lte: end } },
      select: { day: true, stressHighSeconds: true, recoveryHighSeconds: true },
      orderBy: { day: "asc" },
    }),
  ]);

  // Build maps for fast lookups
  const cardioMap = new Map<string, number | null>(
    cardioRows.map((r) => [r.day, r.vascularAge ?? null]),
  );
  const stressMap = new Map<
    string,
    { stressHigh: number | null; recoveryHigh: number | null }
  >(
    stressRows.map((r) => [
      r.day,
      {
        stressHigh: r.stressHighSeconds ? r.stressHighSeconds / 60 : null,
        recoveryHigh: r.recoveryHighSeconds
          ? r.recoveryHighSeconds / 60
          : null,
      },
    ]),
  );

  // Collect all days from sleep (main driver)
  const allDays = new Set<string>(sleepRows.map((r) => r.day));
  cardioRows.forEach((r) => allDays.add(r.day));
  stressRows.forEach((r) => allDays.add(r.day));

  const sortedDays = Array.from(allDays).sort();

  const sleepMap = new Map<string, number | null>(
    sleepRows.map((r) => [r.day, r.lowestHeartRate ?? null]),
  );

  return sortedDays.map((day) => ({
    day,
    restingHR: sleepMap.get(day) ?? null,
    cardioAge: cardioMap.get(day) ?? null,
    stressHigh: stressMap.get(day)?.stressHigh ?? null,
    recoveryHigh: stressMap.get(day)?.recoveryHigh ?? null,
  }));
}
