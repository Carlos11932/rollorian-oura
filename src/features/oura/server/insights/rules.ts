import type { OuraResilienceDaily } from "@prisma/client"
import type { DailyHealthSnapshot } from "@/features/oura/server/health-snapshot"

export interface DayContext {
  day: string
  snapshot: DailyHealthSnapshot
  trend14d: DailyHealthSnapshot[]
  resilience: OuraResilienceDaily | null
}

export interface InsightResult {
  title: string
  message: string
  metadata?: Record<string, unknown>
}

export interface InsightRule {
  id: string
  insightType: string
  severity: "info" | "warning" | "alert"
  evaluate: (data: DayContext) => InsightResult | null
}

const lowSleepScore: InsightRule = {
  id: "low-sleep-score",
  insightType: "sleep_quality",
  severity: "warning",
  evaluate: ({ snapshot }) => {
    const score = snapshot.sleep?.score
    if (score == null || score >= 70) return null

    return {
      title: "Sleep score is below target",
      message: `Today's sleep score was ${score}, below the target threshold of 70.`,
      metadata: { score, threshold: 70 },
    }
  },
}

const highStress: InsightRule = {
  id: "high-stress",
  insightType: "stress",
  severity: "warning",
  evaluate: ({ snapshot }) => {
    const stressHighSeconds = snapshot.stress?.stressHighSeconds
    if (stressHighSeconds == null) return null

    const stressHighMinutes = Math.round(stressHighSeconds / 60)
    if (stressHighMinutes <= 60) return null

    return {
      title: "High stress accumulated for too long",
      message: `You accumulated ${stressHighMinutes} minutes of high stress today.`,
      metadata: { stressHighMinutes, threshold: 60 },
    }
  },
}

const lowHrv: InsightRule = {
  id: "low-hrv",
  insightType: "hrv",
  severity: "warning",
  evaluate: ({ snapshot, trend14d }) => {
    const currentHrv = snapshot.sleep?.averageHrv
    if (currentHrv == null) return null

    const baseline = trend14d
      .filter((item) => item.day !== snapshot.day)
      .map((item) => item.sleep?.averageHrv ?? null)
      .filter((value): value is number => value != null)

    if (baseline.length === 0) return null

    const averageBaseline =
      baseline.reduce((sum, value) => sum + value, 0) / baseline.length
    const dropPercent = ((averageBaseline - currentHrv) / averageBaseline) * 100
    if (dropPercent <= 20) return null

    return {
      title: "HRV is well below your recent baseline",
      message: `Average HRV is ${currentHrv.toFixed(1)} ms, ${dropPercent.toFixed(0)}% below your 14-day average of ${averageBaseline.toFixed(1)} ms.`,
      metadata: {
        currentHrv,
        averageBaseline: Math.round(averageBaseline * 10) / 10,
        dropPercent: Math.round(dropPercent),
      },
    }
  },
}

const poorEfficiency: InsightRule = {
  id: "poor-efficiency",
  insightType: "sleep_efficiency",
  severity: "info",
  evaluate: ({ snapshot }) => {
    const efficiency = snapshot.sleep?.efficiency
    if (efficiency == null || efficiency >= 75) return null

    return {
      title: "Sleep efficiency dipped",
      message: `Sleep efficiency landed at ${efficiency}%, below the 75% threshold.`,
      metadata: { efficiency, threshold: 75 },
    }
  },
}

const excellentRecovery: InsightRule = {
  id: "excellent-recovery",
  insightType: "recovery",
  severity: "info",
  evaluate: ({ snapshot }) => {
    const recoveryHighSeconds = snapshot.stress?.recoveryHighSeconds
    if (recoveryHighSeconds == null) return null

    const recoveryHighMinutes = Math.round(recoveryHighSeconds / 60)
    if (recoveryHighMinutes <= 90) return null

    return {
      title: "Recovery time is notably strong",
      message: `You logged ${recoveryHighMinutes} minutes of high recovery today.`,
      metadata: { recoveryHighMinutes, threshold: 90 },
    }
  },
}

const shortSleep: InsightRule = {
  id: "short-sleep",
  insightType: "sleep_duration",
  severity: "alert",
  evaluate: ({ snapshot }) => {
    const totalSleepSeconds = snapshot.sleep?.totalSleepSeconds
    if (totalSleepSeconds == null || totalSleepSeconds >= 21_600) return null

    const totalSleepHours = Number((totalSleepSeconds / 3600).toFixed(1))
    return {
      title: "Sleep duration is too short",
      message: `You slept ${totalSleepHours.toFixed(1)} hours, below the 6-hour minimum.`,
      metadata: { totalSleepSeconds, totalSleepHours, threshold: 6 },
    }
  },
}

const partialSync: InsightRule = {
  id: "partial-sync",
  insightType: "data_freshness",
  severity: "info",
  evaluate: ({ snapshot }) => {
    if (!snapshot.freshness.isPartial) return null

    return {
      title: "Today's snapshot is still partial",
      message:
        "Some core blocks or sleep metrics are still missing, so today's picture may update after the next sync.",
      metadata: {
        missingBlocks: snapshot.freshness.missingBlocks,
        missingMetrics: snapshot.freshness.missingMetrics,
      },
    }
  },
}

export const insightRules: InsightRule[] = [
  shortSleep,
  lowSleepScore,
  lowHrv,
  highStress,
  poorEfficiency,
  excellentRecovery,
  partialSync,
]
