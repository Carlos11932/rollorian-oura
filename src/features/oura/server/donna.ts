import { format, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { OURA_ENDPOINTS } from "@/lib/oura/endpoints";
import type { EndpointKey } from "@/lib/oura/endpoints";
import {
  getRawActivityDaily,
  getRawCardiovascularAge,
  getRawReadiness,
  getRawSleepDaily,
  getRawSleepPeriods,
  getRawSleepTrend,
  getRawSpo2,
  getRawStressDaily,
  getRawVo2Max,
} from "@/features/oura/server/data";
import {
  areInsightsStale,
  generateInsights,
  getStoredInsights,
} from "@/features/oura/server/insights/engine";
import type { OuraSleepPeriod } from "@prisma/client";

function secondsToHours(seconds: number | null | undefined): number | null {
  if (seconds == null) return null;
  return Math.round((seconds / 3600) * 100) / 100;
}

function secondsToMinutes(seconds: number | null | undefined): number | null {
  if (seconds == null) return null;
  return Math.round(seconds / 60);
}

function average(values: (number | null)[]): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / valid.length) * 100) / 100;
}

function extractFromSleepPeriods(periods: OuraSleepPeriod[]) {
  const INTERVAL_SECONDS = 300;
  let deep = 0;
  let light = 0;
  let rem = 0;
  let hasPhaseData = false;

  for (const period of periods) {
    if (!period.sleepPhaseData) continue;
    hasPhaseData = true;
    for (const char of period.sleepPhaseData) {
      if (char === "1") deep += 1;
      else if (char === "2") light += 1;
      else if (char === "3") rem += 1;
    }
  }

  return {
    totalSleepSeconds: hasPhaseData ? (deep + light + rem) * INTERVAL_SECONDS : undefined,
    deepSleepSeconds: hasPhaseData ? deep * INTERVAL_SECONDS : undefined,
    remSleepSeconds: hasPhaseData ? rem * INTERVAL_SECONDS : undefined,
    lightSleepSeconds: hasPhaseData ? light * INTERVAL_SECONDS : undefined,
  };
}

function computeSyncStatus(lastSyncSession: { unavailableEndpoints: unknown } | null) {
  const allEndpointKeys = Object.keys(OURA_ENDPOINTS) as EndpointKey[];

  if (!lastSyncSession) {
    return { available: allEndpointKeys, unavailable: [] as EndpointKey[] };
  }

  const unavailableSet = new Set(lastSyncSession.unavailableEndpoints as string[]);
  const unavailable = allEndpointKeys.filter((key) => unavailableSet.has(key));
  const available = allEndpointKeys.filter((key) => !unavailableSet.has(key));

  return { available, unavailable };
}

function computeHeadline(state: "good" | "mixed" | "attention" | "insufficient_data") {
  switch (state) {
    case "good":
      return "Buen descanso y buena disposición";
    case "attention":
      return "Hay señales que requieren atención";
    case "insufficient_data":
      return "Datos insuficientes para hoy";
    default:
      return "Día con señales mixtas";
  }
}

function computeSummaryState(input: {
  sleepScore: number | null;
  efficiency: number | null;
  stressHighMinutes: number | null;
  recoveryHighMinutes: number | null;
  readinessScore: number | null;
}) {
  const factors = [
    input.sleepScore == null ? "missing" : input.sleepScore >= 85 ? "positive" : input.sleepScore >= 70 ? "neutral" : "negative",
    input.efficiency == null ? "missing" : input.efficiency >= 85 ? "positive" : input.efficiency >= 75 ? "neutral" : "negative",
    input.stressHighMinutes == null ? "missing" : input.stressHighMinutes < 30 ? "positive" : input.stressHighMinutes <= 60 ? "neutral" : "negative",
    input.recoveryHighMinutes == null ? "missing" : input.recoveryHighMinutes > 60 ? "positive" : input.recoveryHighMinutes >= 30 ? "neutral" : "negative",
    input.readinessScore == null ? "missing" : input.readinessScore >= 85 ? "positive" : input.readinessScore >= 70 ? "neutral" : "negative",
  ] as const;

  const missing = factors.filter((factor) => factor === "missing").length;
  const negative = factors.filter((factor) => factor === "negative").length;
  const positive = factors.filter((factor) => factor === "positive").length;

  if (missing / factors.length > 0.5) return "insufficient_data" as const;
  if (negative > 0) return "attention" as const;
  if (positive === factors.length - missing) return "good" as const;
  return "mixed" as const;
}

async function loadInsights(day: string) {
  const stale = await areInsightsStale(day);
  const rows = stale ? await generateInsights(day) : await getStoredInsights(day);

  return rows.map((row) => ({
    insightType: row.insightType,
    severity: row.severity,
    title: row.title,
    message: row.message,
    metadata: row.metadata ?? null,
  }));
}

export async function getDonnaStatus() {
  const [lastSync, connected, insightCount] = await Promise.all([
    prisma.ouraSyncSession.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.ouraOAuthToken.findUnique({ where: { id: "singleton" } }).then(Boolean),
    prisma.ouraInsight.count(),
  ]);

  return {
    connected,
    lastSync: lastSync
      ? {
          id: lastSync.id,
          status: lastSync.status,
          startedAt: lastSync.startedAt.toISOString(),
          finishedAt: lastSync.finishedAt?.toISOString() ?? null,
          recordsInserted: lastSync.recordsInserted,
          recordsUpdated: lastSync.recordsUpdated,
          source: lastSync.source,
        }
      : null,
    insightCount,
    generatedAt: new Date().toISOString(),
  };
}

export async function getDonnaHealth(day: string) {
  const [
    sleepRows,
    sleepPeriods,
    readiness,
    activityRows,
    stressRows,
    cardioAge,
    spo2,
    vo2Max,
    lastSyncSession,
    insights,
  ] = await Promise.all([
    getRawSleepDaily(day, day).catch(() => []),
    getRawSleepPeriods(day).catch(() => []),
    getRawReadiness(day).catch(() => null),
    getRawActivityDaily(day, day).catch(() => []),
    getRawStressDaily(day, day).catch(() => []),
    getRawCardiovascularAge(day).catch(() => null),
    getRawSpo2(day).catch(() => null),
    getRawVo2Max(day).catch(() => null),
    prisma.ouraSyncSession.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null),
    loadInsights(day).catch(() => []),
  ]);

  const sleep = sleepRows[0] ?? null;
  const activity = activityRows[0] ?? null;
  const stress = stressRows[0] ?? null;
  const periodMetrics = extractFromSleepPeriods(sleepPeriods);
  const stressHighMinutes = secondsToMinutes(stress?.stressHighSeconds);
  const recoveryHighMinutes = secondsToMinutes(stress?.recoveryHighSeconds);
  const summaryState = computeSummaryState({
    sleepScore: sleep?.score ?? null,
    efficiency: sleep?.efficiency ?? null,
    stressHighMinutes,
    recoveryHighMinutes,
    readinessScore: readiness?.score ?? null,
  });

  return {
    day,
    lastSync: lastSyncSession?.finishedAt?.toISOString() ?? null,
    todaySummary: {
      state: summaryState,
      headline: computeHeadline(summaryState),
    },
    todayMetrics: {
      sleep: sleep != null || sleepPeriods.length > 0 ? {
        score: sleep?.score ?? null,
        totalSleepHours: secondsToHours(sleep?.totalSleepSeconds ?? periodMetrics.totalSleepSeconds),
        efficiency: sleep?.efficiency ?? null,
        averageHrv: sleep?.averageHrv ?? null,
        averageBreath: sleep?.averageBreath ?? null,
        lowestHeartRate: sleep?.lowestHeartRate ?? null,
        deepSleepHours: secondsToHours(sleep?.deepSleepSeconds ?? periodMetrics.deepSleepSeconds),
        remSleepHours: secondsToHours(sleep?.remSleepSeconds ?? periodMetrics.remSleepSeconds),
        lightSleepHours: secondsToHours(sleep?.lightSleepSeconds ?? periodMetrics.lightSleepSeconds),
      } : null,
      readiness: readiness ? {
        score: readiness.score ?? null,
        temperatureDeviation: readiness.temperatureDeviation ?? null,
        restingHeartRate: readiness.contribRestingHeartRate ?? null,
        sleepBalance: readiness.contribSleepBalance ?? null,
      } : null,
      activity: activity ? {
        score: activity.score ?? null,
        steps: activity.steps ?? null,
        activeCalories: activity.activeCalories ?? null,
        totalCalories: activity.totalCalories ?? null,
      } : null,
      stress: stress ? {
        stressHighMinutes,
        recoveryHighMinutes,
        daytimeStress: stress.daySummary ?? null,
      } : null,
      vitals: cardioAge ?? spo2 ?? vo2Max ? {
        cardiovascularAge: cardioAge?.vascularAge ?? null,
        spo2Percentage: spo2?.spo2Average ?? null,
        vo2Max: vo2Max?.vo2Max ?? null,
      } : null,
    },
    insights,
    syncStatus: computeSyncStatus(lastSyncSession),
  };
}

export async function getDonnaTrends(window: "7d" | "30d") {
  const days = window === "30d" ? 30 : 7;
  const fromDay = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const toDay = format(new Date(), "yyyy-MM-dd");

  const [sleepRows, activityRows, stressRows, readinessRows] = await Promise.all([
    getRawSleepTrend(days).catch(() => []),
    getRawActivityDaily(fromDay, toDay).catch(() => []),
    getRawStressDaily(fromDay, toDay).catch(() => []),
    prisma.ouraReadinessDaily.findMany({
      where: { day: { gte: fromDay, lte: toDay } },
      orderBy: { day: "asc" },
    }).catch(() => []),
  ]);

  return {
    window,
    sleep: {
      points: sleepRows.map((row) => ({
        day: row.day,
        totalSleepHours: secondsToHours(row.totalSleepSeconds),
        efficiency: row.efficiency ?? null,
        score: row.score ?? null,
        averageHrv: row.averageHrv ?? null,
      })),
      averages: {
        totalSleepHours: average(sleepRows.map((row) => secondsToHours(row.totalSleepSeconds))),
        efficiency: average(sleepRows.map((row) => row.efficiency ?? null)),
        score: average(sleepRows.map((row) => row.score ?? null)),
        averageHrv: average(sleepRows.map((row) => row.averageHrv ?? null)),
      },
    },
    activity: activityRows.map((row) => ({
      day: row.day,
      score: row.score ?? null,
      steps: row.steps ?? null,
      activeCalories: row.activeCalories ?? null,
    })),
    stress: stressRows.map((row) => ({
      day: row.day,
      stressHighMinutes: secondsToMinutes(row.stressHighSeconds),
      recoveryHighMinutes: secondsToMinutes(row.recoveryHighSeconds),
      daySummary: row.daySummary ?? null,
    })),
    readiness: readinessRows.map((row) => ({
      day: row.day,
      score: row.score ?? null,
      temperatureDeviation: row.temperatureDeviation ?? null,
      recoveryIndex: row.contribRecoveryIndex ?? null,
    })),
    generatedAt: new Date().toISOString(),
  };
}
