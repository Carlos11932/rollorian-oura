import type {
  OuraSleepDaily,
  OuraReadinessDaily,
  OuraStressDaily,
  OuraResilienceDaily,
} from "@prisma/client"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayContext {
  day: string
  sleep: OuraSleepDaily | null
  readiness: OuraReadinessDaily | null
  stress: OuraStressDaily | null
  resilience: OuraResilienceDaily | null
  /** Last 14 days of sleep records (inclusive of today) for baseline comparisons */
  sleepTrend14d: OuraSleepDaily[]
}

export interface InsightResult {
  title: string
  /** Matches the Prisma field name: OuraInsight.message */
  message: string
  metadata?: Record<string, unknown>
}

export interface InsightRule {
  id: string
  insightType: string
  severity: "info" | "warning" | "alert"
  evaluate: (data: DayContext) => InsightResult | null
}

// ─── Rules ────────────────────────────────────────────────────────────────────

/**
 * Rule 1: low-sleep-score
 * Fires when the sleep score is below 70.
 */
const lowSleepScore: InsightRule = {
  id: "low-sleep-score",
  insightType: "sleep_quality",
  severity: "warning",
  evaluate: ({ sleep }) => {
    if (sleep == null || sleep.score == null) return null
    const score = sleep.score
    if (score >= 70) return null
    return {
      title: "Puntuación de sueño baja",
      message: `Tu puntuación de sueño fue ${score}, por debajo del umbral recomendado de 70.`,
      metadata: { score, threshold: 70 },
    }
  },
}

/**
 * Rule 2: high-stress
 * Fires when accumulated high-stress time exceeds 60 minutes.
 * OuraStressDaily.stressHighSeconds stores seconds.
 */
const highStress: InsightRule = {
  id: "high-stress",
  insightType: "stress",
  severity: "warning",
  evaluate: ({ stress }) => {
    if (stress == null || stress.stressHighSeconds == null) return null
    const minutes = Math.round(stress.stressHighSeconds / 60)
    if (minutes <= 60) return null
    return {
      title: "Estrés alto prolongado",
      message: `Acumulaste ${minutes} minutos de estrés elevado durante el día (umbral: 60 min).`,
      metadata: { stressHighMinutes: minutes, threshold: 60 },
    }
  },
}

/**
 * Rule 3: low-hrv
 * Fires when today's average HRV is more than 20% below the 14-day rolling average.
 */
const lowHrv: InsightRule = {
  id: "low-hrv",
  insightType: "hrv",
  severity: "warning",
  evaluate: ({ sleep, sleepTrend14d }) => {
    if (sleep == null || sleep.averageHrv == null) return null
    const currentHrv = sleep.averageHrv

    const trend = sleepTrend14d.filter(
      (s) => s.averageHrv != null && s.day !== sleep.day,
    )
    if (trend.length === 0) return null

    const avgHrv =
      trend.reduce((acc, s) => acc + s.averageHrv!, 0) / trend.length
    const dropPercent = ((avgHrv - currentHrv) / avgHrv) * 100

    if (dropPercent <= 20) return null

    return {
      title: "Variabilidad cardíaca por debajo de tu media",
      message: `Tu VFC hoy fue ${currentHrv.toFixed(1)} ms, un ${dropPercent.toFixed(0)}% por debajo de tu media de los últimos 14 días (${avgHrv.toFixed(1)} ms).`,
      metadata: {
        currentHrv,
        avg14dHrv: Math.round(avgHrv * 10) / 10,
        dropPercent: Math.round(dropPercent),
      },
    }
  },
}

/**
 * Rule 4: poor-efficiency
 * Fires when sleep efficiency is below 75%.
 */
const poorEfficiency: InsightRule = {
  id: "poor-efficiency",
  insightType: "sleep_efficiency",
  severity: "info",
  evaluate: ({ sleep }) => {
    if (sleep == null || sleep.efficiency == null) return null
    const efficiency = sleep.efficiency
    if (efficiency >= 75) return null
    return {
      title: "Eficiencia de sueño reducida",
      message: `Tu eficiencia de sueño fue del ${efficiency}%, por debajo del umbral recomendado del 75%.`,
      metadata: { efficiency, threshold: 75 },
    }
  },
}

/**
 * Rule 5: excellent-recovery
 * Fires when recovery high time exceeds 90 minutes — a positive signal.
 */
const excellentRecovery: InsightRule = {
  id: "excellent-recovery",
  insightType: "recovery",
  severity: "info",
  evaluate: ({ stress }) => {
    if (stress == null || stress.recoveryHighSeconds == null) return null
    const minutes = Math.round(stress.recoveryHighSeconds / 60)
    if (minutes <= 90) return null
    return {
      title: "Excelente recuperación",
      message: `Lograste ${minutes} minutos de recuperación alta durante el día. ¡Muy bien!`,
      metadata: { recoveryHighMinutes: minutes, threshold: 90 },
    }
  },
}

/**
 * Rule 6: short-sleep
 * Fires when total sleep is less than 6 hours (21600 seconds).
 */
const shortSleep: InsightRule = {
  id: "short-sleep",
  insightType: "sleep_duration",
  severity: "alert",
  evaluate: ({ sleep }) => {
    if (sleep == null || sleep.totalSleepSeconds == null) return null
    const totalSeconds = sleep.totalSleepSeconds
    if (totalSeconds >= 21600) return null
    const hours = (totalSeconds / 3600).toFixed(1)
    return {
      title: "Sueño insuficiente",
      message: `Dormiste ${hours} horas, por debajo del mínimo recomendado de 6 horas.`,
      metadata: { totalSleepSeconds: totalSeconds, totalSleepHours: parseFloat(hours), threshold: 6 },
    }
  },
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const insightRules: InsightRule[] = [
  lowSleepScore,
  highStress,
  lowHrv,
  poorEfficiency,
  excellentRecovery,
  shortSleep,
]
