import { prisma } from "@/lib/prisma"
import {
  average,
  getDailyHealthSnapshot,
  getDailyHealthTrend,
  secondsToHours,
  secondsToMinutes,
} from "@/features/oura/server/health-snapshot"
import { buildDailyHealthSummary } from "@/features/oura/server/health-summary"
import {
  areInsightsStale,
  generateInsights,
  getStoredInsights,
} from "@/features/oura/server/insights/engine"

async function loadInsights(day: string) {
  const stale = await areInsightsStale(day)
  const rows = stale ? await generateInsights(day) : await getStoredInsights(day)

  return rows.map((row) => ({
    insightType: row.insightType,
    severity: row.severity,
    title: row.title,
    message: row.message,
    metadata: row.metadata ?? null,
  }))
}

export async function getDonnaStatus() {
  const [lastFinishedSync, connected, insightCount, staleRunningSessions] = await Promise.all([
    prisma.ouraSyncSession.findFirst({
      where: { finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.ouraOAuthToken.findUnique({ where: { id: "singleton" } }).then(Boolean),
    prisma.ouraInsight.count(),
    prisma.ouraSyncSession.count({
      where: {
        status: "running",
        finishedAt: null,
      },
    }),
  ])

  return {
    connected,
    lastSync: lastFinishedSync
      ? {
          id: lastFinishedSync.id,
          status: lastFinishedSync.status,
          startedAt: lastFinishedSync.startedAt.toISOString(),
          finishedAt: lastFinishedSync.finishedAt?.toISOString() ?? null,
          recordsInserted: lastFinishedSync.recordsInserted,
          recordsUpdated: lastFinishedSync.recordsUpdated,
          recordsSkipped: lastFinishedSync.recordsSkipped,
          source: lastFinishedSync.source,
        }
      : null,
    staleRunningSessions,
    insightCount,
    generatedAt: new Date().toISOString(),
  }
}

export async function getDonnaHealth(day: string) {
  const [snapshot, insights] = await Promise.all([
    getDailyHealthSnapshot(day),
    loadInsights(day).catch(() => []),
  ])

  const summary = buildDailyHealthSummary(snapshot)

  return {
    day,
    lastSync: snapshot.freshness.lastSuccessfulSync,
    syncStatus: snapshot.syncStatus,
    freshness: snapshot.freshness,
    todaySummary: {
      state: summary.state,
      headline: summary.headline,
      factors: summary.factors,
    },
    todayMetrics: {
      sleep: snapshot.sleep
        ? {
            score: snapshot.sleep.score,
            totalSleepHours: secondsToHours(snapshot.sleep.totalSleepSeconds),
            timeInBedHours: secondsToHours(snapshot.sleep.timeInBedSeconds),
            efficiency: snapshot.sleep.efficiency,
            averageHrv: snapshot.sleep.averageHrv,
            averageHeartRate: snapshot.sleep.averageHeartRate,
            averageBreath: snapshot.sleep.averageBreath,
            lowestHeartRate: snapshot.sleep.lowestHeartRate,
            deepSleepHours: secondsToHours(snapshot.sleep.deepSleepSeconds),
            remSleepHours: secondsToHours(snapshot.sleep.remSleepSeconds),
            lightSleepHours: secondsToHours(snapshot.sleep.lightSleepSeconds),
            awakeMinutes: secondsToMinutes(snapshot.sleep.awakeSeconds),
            source: snapshot.sleep.source,
          }
        : null,
      readiness: snapshot.readiness
        ? {
            score: snapshot.readiness.score,
            temperatureDeviation: snapshot.readiness.temperatureDeviation,
            temperatureTrendDeviation: snapshot.readiness.temperatureTrendDeviation,
            activityBalance: snapshot.readiness.contributors.activityBalance,
            bodyTemperature: snapshot.readiness.contributors.bodyTemperature,
            hrvBalance: snapshot.readiness.contributors.hrvBalance,
            previousDayActivity: snapshot.readiness.contributors.previousDayActivity,
            previousNight: snapshot.readiness.contributors.previousNight,
            recoveryIndex: snapshot.readiness.contributors.recoveryIndex,
            restingHeartRateContribution:
              snapshot.readiness.contributors.restingHeartRateContribution,
            sleepBalance: snapshot.readiness.contributors.sleepBalance,
          }
        : null,
      activity: snapshot.activity,
      stress: snapshot.stress
        ? {
            stressHighMinutes: secondsToMinutes(snapshot.stress.stressHighSeconds),
            recoveryHighMinutes: secondsToMinutes(snapshot.stress.recoveryHighSeconds),
            daytimeStress: snapshot.stress.daySummary,
          }
        : null,
      vitals: snapshot.vitals,
    },
    insights,
  }
}

export async function getDonnaTrends(window: "7d" | "30d") {
  const days = window === "30d" ? 30 : 7
  const snapshots = await getDailyHealthTrend(days)

  return {
    window,
    sleep: {
      points: snapshots.map((snapshot) => ({
        day: snapshot.day,
        totalSleepHours: secondsToHours(snapshot.sleep?.totalSleepSeconds),
        efficiency: snapshot.sleep?.efficiency ?? null,
        score: snapshot.sleep?.score ?? null,
        averageHrv: snapshot.sleep?.averageHrv ?? null,
        source: snapshot.sleep?.source ?? null,
        isPartial: snapshot.freshness.isPartial,
      })),
      averages: {
        totalSleepHours: average(
          snapshots.map((snapshot) => secondsToHours(snapshot.sleep?.totalSleepSeconds)),
        ),
        efficiency: average(snapshots.map((snapshot) => snapshot.sleep?.efficiency ?? null)),
        score: average(snapshots.map((snapshot) => snapshot.sleep?.score ?? null)),
        averageHrv: average(snapshots.map((snapshot) => snapshot.sleep?.averageHrv ?? null)),
      },
    },
    activity: snapshots.map((snapshot) => ({
      day: snapshot.day,
      score: snapshot.activity?.score ?? null,
      steps: snapshot.activity?.steps ?? null,
      activeCalories: snapshot.activity?.activeCalories ?? null,
      isPartial: snapshot.freshness.isPartial,
    })),
    stress: snapshots.map((snapshot) => ({
      day: snapshot.day,
      stressHighMinutes: secondsToMinutes(snapshot.stress?.stressHighSeconds ?? null),
      recoveryHighMinutes: secondsToMinutes(snapshot.stress?.recoveryHighSeconds ?? null),
      daySummary: snapshot.stress?.daySummary ?? null,
      isPartial: snapshot.freshness.isPartial,
    })),
    readiness: snapshots.map((snapshot) => ({
      day: snapshot.day,
      score: snapshot.readiness?.score ?? null,
      temperatureDeviation: snapshot.readiness?.temperatureDeviation ?? null,
      recoveryIndex: snapshot.readiness?.contributors.recoveryIndex ?? null,
      isPartial: snapshot.freshness.isPartial,
    })),
    generatedAt: new Date().toISOString(),
  }
}
