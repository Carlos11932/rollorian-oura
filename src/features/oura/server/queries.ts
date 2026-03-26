import { prisma } from "@/lib/prisma";

// ─── Period types ─────────────────────────────────────────────────────────────

const PERIOD = {
  ONE_DAY: "1d",
  SEVEN_DAYS: "7d",
  ONE_MONTH: "1m",
  ONE_YEAR: "1a",
} as const;

export type Period = (typeof PERIOD)[keyof typeof PERIOD];

// ─── Date range helper ────────────────────────────────────────────────────────

export function getDateRange(period: Period): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);

  const start = new Date(now);
  if (period === "1d") {
    start.setDate(start.getDate() - 1);
  } else if (period === "7d") {
    start.setDate(start.getDate() - 7);
  } else if (period === "1m") {
    start.setMonth(start.getMonth() - 1);
  } else if (period === "1a") {
    start.setFullYear(start.getFullYear() - 1);
  }

  const startDate = start.toISOString().slice(0, 10);
  return { startDate, endDate };
}

function avg(values: (number | null | undefined)[]): number | null {
  const filtered = values.filter((v): v is number => v != null);
  if (filtered.length === 0) return null;
  return Math.round(filtered.reduce((a, b) => a + b, 0) / filtered.length);
}

// ─── Sleep data ───────────────────────────────────────────────────────────────

export interface SleepTrendPoint {
  date: string;
  value: number;
}

export interface SleepData {
  score: number | null;
  hrv: number | null;
  hours: number | null;
  efficiency: number | null;
  deepSleep: number | null;
  rem: number | null;
  trend: SleepTrendPoint[];
}

export async function getSleepData(period: Period): Promise<SleepData> {
  const { startDate, endDate } = getDateRange(period);

  const records = await prisma.ouraSleepDaily.findMany({
    where: {
      day: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { day: "asc" },
    select: {
      day: true,
      score: true,
      totalSleepSeconds: true,
      efficiency: true,
      remSleepSeconds: true,
      deepSleepSeconds: true,
      averageHrv: true,
    },
  });

  const trend: SleepTrendPoint[] = records
    .filter((r) => r.score != null)
    .map((r) => ({ date: r.day, value: r.score as number }));

  const score = avg(records.map((r) => r.score));
  const hrv = avg(records.map((r) => r.averageHrv));
  const hoursRaw = avg(records.map((r) => r.totalSleepSeconds));
  const hours = hoursRaw != null ? Math.round((hoursRaw / 3600) * 10) / 10 : null;
  const efficiency = avg(records.map((r) => r.efficiency));
  const deepSleep = avg(records.map((r) =>
    r.deepSleepSeconds != null ? Math.round(r.deepSleepSeconds / 60) : null,
  ));
  const rem = avg(records.map((r) =>
    r.remSleepSeconds != null ? Math.round(r.remSleepSeconds / 60) : null,
  ));

  return { score, hrv, hours, efficiency, deepSleep, rem, trend };
}

// ─── Recovery data ────────────────────────────────────────────────────────────

export interface RecoveryTrendPoint {
  date: string;
  value: number;
}

export interface RecoveryData {
  readiness: number | null;
  restingHR: number | null;
  resilience: string | null;
  trend: RecoveryTrendPoint[];
}

export async function getRecoveryData(period: Period): Promise<RecoveryData> {
  const { startDate, endDate } = getDateRange(period);

  const [readinessRecords, sleepRecords, resilienceRecords] = await Promise.all([
    prisma.ouraReadinessDaily.findMany({
      where: { day: { gte: startDate, lte: endDate } },
      orderBy: { day: "asc" },
      select: { day: true, score: true },
    }),
    prisma.ouraSleepDaily.findMany({
      where: { day: { gte: startDate, lte: endDate } },
      orderBy: { day: "desc" },
      select: { lowestHeartRate: true },
      take: 1,
    }),
    prisma.ouraResilienceDaily.findMany({
      where: { day: { gte: startDate, lte: endDate } },
      orderBy: { day: "desc" },
      select: { level: true },
      take: 1,
    }),
  ]);

  const trend: RecoveryTrendPoint[] = readinessRecords
    .filter((r) => r.score != null)
    .map((r) => ({ date: r.day, value: r.score as number }));

  const readiness = avg(readinessRecords.map((r) => r.score));
  const restingHR = sleepRecords[0]?.lowestHeartRate ?? null;
  const resilience = resilienceRecords[0]?.level ?? null;

  return { readiness, restingHR, resilience, trend };
}