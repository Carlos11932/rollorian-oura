import "server-only";
import { prisma } from "@/lib/prisma";
import { subDays, format, isToday, parseISO } from "date-fns";

// ─── Period ───────────────────────────────────────────────────────────────────

const PERIOD = {
  "1d": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
} as const;

export type Period = keyof typeof PERIOD;

function getDateRange(
  period: Period,
  selectedDate?: string,
): { start: string; end: string } {
  if (period === "1d") {
    const day =
      selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
        ? selectedDate
        : format(new Date(), "yyyy-MM-dd");
    return { start: day, end: day };
  }
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
  selectedDate?: string,
): Promise<SleepChartPoint[]> {
  const { start, end } = getDateRange(period, selectedDate);

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

export async function getMetricsData(
  period: Period,
  selectedDate?: string,
): Promise<MetricsPoint[]> {
  const { start, end } = getDateRange(period, selectedDate);

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

// ─── Intraday Heart Rate ───────────────────────────────────────────────────────

export interface StressIntradayPoint {
  hour: string; // "HH:MM"
  bpm: number;
}

export async function getIntradayHeartRate(
  date: string,
): Promise<StressIntradayPoint[]> {
  // Expand window ±14h around UTC midnight to handle any timezone offset
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const gte = new Date(dayStart.getTime() - 14 * 60 * 60 * 1000);
  const lte = new Date(dayStart.getTime() + 38 * 60 * 60 * 1000);

  const entries = await prisma.ouraHeartRateEntry.findMany({
    where: { timestamp: { gte, lte } },
    select: { bpm: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  if (entries.length === 0) return [];

  // Group into 15-min buckets
  const bucketMap = new Map<string, number[]>();
  for (const entry of entries) {
    const totalMinutes =
      entry.timestamp.getUTCHours() * 60 + entry.timestamp.getUTCMinutes();
    const bucketMinutes = Math.floor(totalMinutes / 15) * 15;
    const hh = String(Math.floor(bucketMinutes / 60)).padStart(2, "0");
    const mm = String(bucketMinutes % 60).padStart(2, "0");
    const key = `${hh}:${mm}`;
    if (!bucketMap.has(key)) bucketMap.set(key, []);
    bucketMap.get(key)!.push(entry.bpm);
  }

  const now = new Date();
  const nowBucket = isToday(parseISO(date))
    ? `${String(now.getUTCHours()).padStart(2, "0")}:${String(Math.floor(now.getUTCMinutes() / 15) * 15).padStart(2, "0")}`
    : null;

  return Array.from(bucketMap.entries())
    .filter(([time]) => nowBucket === null || time <= nowBucket)
    .map(([time, bpms]) => ({
      hour: time, // "HH:MM" string
      bpm: Math.round(bpms.reduce((sum, v) => sum + v, 0) / bpms.length),
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

// ─── Sleep Intraday Heart Rate ─────────────────────────────────────────────────

export interface SleepIntradayPoint {
  time: string; // "HH:MM"
  bpm: number;
}

interface OuraHeartRateData {
  interval: number;
  items: (number | null)[];
  timestamp: string;
}

export async function getSleepIntradayData(
  date: string,
): Promise<SleepIntradayPoint[]> {
  const records = await prisma.ouraSleepPeriod.findMany({
    where: { day: date },
    select: { heartRateData: true, sleepType: true },
  });

  // Prefer long_sleep period, fallback to any period with HR data
  const record =
    records.find((r) => r.sleepType === "long_sleep" && r.heartRateData) ??
    records.find((r) => r.heartRateData);

  if (!record?.heartRateData) return [];

  const hrData = record.heartRateData as unknown as OuraHeartRateData;
  if (!hrData?.items?.length) return [];

  const baseTime = new Date(hrData.timestamp);
  const intervalMs = hrData.interval * 1000;

  const bucketMap = new Map<string, number[]>();
  hrData.items.forEach((bpm, i) => {
    if (bpm == null) return;
    const t = new Date(baseTime.getTime() + i * intervalMs);
    const totalMin = t.getUTCHours() * 60 + t.getUTCMinutes();
    const bucket = Math.floor(totalMin / 15) * 15;
    const hh = String(Math.floor(bucket / 60)).padStart(2, "0");
    const mm = String(bucket % 60).padStart(2, "0");
    const key = `${hh}:${mm}`;
    if (!bucketMap.has(key)) bucketMap.set(key, []);
    bucketMap.get(key)!.push(bpm);
  });

  return Array.from(bucketMap.entries())
    .map(([time, bpms]) => ({
      time,
      bpm: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
    }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

// ─── Stress Intraday Heart Rate ────────────────────────────────────────────────

export async function getStressIntradayData(
  date: string,
): Promise<StressIntradayPoint[]> {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const gte = new Date(dayStart.getTime() - 14 * 60 * 60 * 1000);
  const lte = new Date(dayStart.getTime() + 38 * 60 * 60 * 1000);

  const entries = await prisma.ouraHeartRateEntry.findMany({
    where: {
      timestamp: { gte, lte },
      NOT: { source: "sleep" },
    },
    select: { bpm: true, timestamp: true },
    orderBy: { timestamp: "asc" },
  });

  if (entries.length === 0) return [];

  const bucketMap = new Map<string, number[]>();
  for (const entry of entries) {
    const totalMinutes =
      entry.timestamp.getUTCHours() * 60 + entry.timestamp.getUTCMinutes();
    const bucketMinutes = Math.floor(totalMinutes / 15) * 15;
    const hh = String(Math.floor(bucketMinutes / 60)).padStart(2, "0");
    const mm = String(bucketMinutes % 60).padStart(2, "0");
    const key = `${hh}:${mm}`;
    if (!bucketMap.has(key)) bucketMap.set(key, []);
    bucketMap.get(key)!.push(entry.bpm);
  }

  const now = new Date();
  const nowBucket = isToday(parseISO(date))
    ? `${String(now.getUTCHours()).padStart(2, "0")}:${String(Math.floor(now.getUTCMinutes() / 15) * 15).padStart(2, "0")}`
    : null;

  return Array.from(bucketMap.entries())
    .filter(([time]) => nowBucket === null || time <= nowBucket)
    .map(([time, bpms]) => ({
      hour: time,
      bpm: Math.round(bpms.reduce((sum, v) => sum + v, 0) / bpms.length),
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}
