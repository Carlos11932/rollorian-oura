import type { DailyHealthSnapshot } from "@/features/oura/server/health-snapshot"

export type FactorStatus = "positive" | "neutral" | "negative" | "missing"
export type OverallState = "good" | "mixed" | "attention" | "insufficient_data"

export interface HealthFactor {
  key: string
  status: FactorStatus
  value?: number | string
  label: string
}

export interface DailyHealthSummary {
  state: OverallState
  headline: string
  factors: HealthFactor[]
}

function secondsToHours(seconds: number | null | undefined): number | null {
  if (seconds == null) return null
  return Math.round((seconds / 3600) * 10) / 10
}

function secondsToMinutes(seconds: number | null | undefined): number | null {
  if (seconds == null) return null
  return Math.round(seconds / 60)
}

function evaluateSleepScore(score: number | null): HealthFactor {
  if (score == null) {
    return { key: "sleep_score", status: "missing", label: "Sleep score unavailable" }
  }

  return {
    key: "sleep_score",
    status: score >= 85 ? "positive" : score >= 70 ? "neutral" : "negative",
    value: score,
    label: `Sleep score ${score}`,
  }
}

function evaluateSleepDuration(totalSleepSeconds: number | null): HealthFactor {
  const totalSleepHours = secondsToHours(totalSleepSeconds)
  if (totalSleepHours == null) {
    return { key: "sleep_duration", status: "missing", label: "Sleep duration unavailable" }
  }

  return {
    key: "sleep_duration",
    status:
      totalSleepHours >= 7 ? "positive" : totalSleepHours >= 6 ? "neutral" : "negative",
    value: totalSleepHours,
    label: `${totalSleepHours.toFixed(1)}h asleep`,
  }
}

function evaluateEfficiency(efficiency: number | null): HealthFactor {
  if (efficiency == null) {
    return { key: "efficiency", status: "missing", label: "Sleep efficiency unavailable" }
  }

  return {
    key: "efficiency",
    status: efficiency >= 85 ? "positive" : efficiency >= 75 ? "neutral" : "negative",
    value: efficiency,
    label: `Sleep efficiency ${efficiency}%`,
  }
}

function evaluateStress(stressHighSeconds: number | null): HealthFactor {
  const stressHighMinutes = secondsToMinutes(stressHighSeconds)
  if (stressHighMinutes == null) {
    return { key: "stress_high", status: "missing", label: "High-stress time unavailable" }
  }

  return {
    key: "stress_high",
    status:
      stressHighMinutes < 30 ? "positive" : stressHighMinutes <= 60 ? "neutral" : "negative",
    value: stressHighMinutes,
    label: `${stressHighMinutes}m high stress`,
  }
}

function evaluateRecovery(recoveryHighSeconds: number | null): HealthFactor {
  const recoveryHighMinutes = secondsToMinutes(recoveryHighSeconds)
  if (recoveryHighMinutes == null) {
    return { key: "recovery_high", status: "missing", label: "Recovery time unavailable" }
  }

  return {
    key: "recovery_high",
    status:
      recoveryHighMinutes > 60 ? "positive" : recoveryHighMinutes >= 30 ? "neutral" : "negative",
    value: recoveryHighMinutes,
    label: `${recoveryHighMinutes}m high recovery`,
  }
}

function evaluateReadiness(score: number | null): HealthFactor {
  if (score == null) {
    return { key: "readiness_score", status: "missing", label: "Readiness score unavailable" }
  }

  return {
    key: "readiness_score",
    status: score >= 85 ? "positive" : score >= 70 ? "neutral" : "negative",
    value: score,
    label: `Readiness score ${score}`,
  }
}

function evaluateHrv(hrv: number | null): HealthFactor {
  if (hrv == null) {
    return { key: "hrv", status: "missing", label: "HRV unavailable" }
  }

  return {
    key: "hrv",
    status: "neutral",
    value: Math.round(hrv),
    label: `Average HRV ${Math.round(hrv)} ms`,
  }
}

function evaluateLowestHeartRate(heartRate: number | null): HealthFactor {
  if (heartRate == null) {
    return { key: "lowest_heart_rate", status: "missing", label: "Lowest sleep HR unavailable" }
  }

  return {
    key: "lowest_heart_rate",
    status: "neutral",
    value: heartRate,
    label: `Lowest sleep HR ${heartRate} bpm`,
  }
}

function evaluateSpo2(spo2Percentage: number | null): HealthFactor | null {
  if (spo2Percentage == null) return null
  return {
    key: "spo2",
    status: "neutral",
    value: Math.round(spo2Percentage * 10) / 10,
    label: `SpO2 ${Math.round(spo2Percentage * 10) / 10}%`,
  }
}

function evaluateCardioAge(cardiovascularAge: number | null): HealthFactor | null {
  if (cardiovascularAge == null) return null
  return {
    key: "cardiovascular_age",
    status: "neutral",
    value: cardiovascularAge,
    label: `Cardiovascular age ${cardiovascularAge}`,
  }
}

function evaluateVo2Max(vo2Max: number | null): HealthFactor | null {
  if (vo2Max == null) return null
  return {
    key: "vo2_max",
    status: "neutral",
    value: Math.round(vo2Max * 10) / 10,
    label: `VO2 max ${Math.round(vo2Max * 10) / 10}`,
  }
}

export function computeSummaryState(scoringFactors: HealthFactor[]): OverallState {
  const total = scoringFactors.length
  const missing = scoringFactors.filter((factor) => factor.status === "missing").length
  const negative = scoringFactors.filter((factor) => factor.status === "negative").length
  const positive = scoringFactors.filter((factor) => factor.status === "positive").length

  if (missing / total > 0.5) return "insufficient_data"
  if (negative > 0) return "attention"
  if (positive === total - missing) return "good"
  return "mixed"
}

export function generateSummaryHeadline(
  state: OverallState,
  factors: HealthFactor[],
  isPartial: boolean,
): string {
  if (state === "insufficient_data") {
    return "Not enough data for a reliable daily snapshot"
  }

  const sleepFactor = factors.find((factor) => factor.key === "sleep_score")
  const durationFactor = factors.find((factor) => factor.key === "sleep_duration")
  const stressFactor = factors.find((factor) => factor.key === "stress_high")
  const readinessFactor = factors.find((factor) => factor.key === "readiness_score")

  if (state === "good") {
    if (isPartial) return "Good signals so far, but the day is still partially synced"
    if (sleepFactor?.status === "positive" && readinessFactor?.status === "positive") {
      return "Sleep and readiness are aligned for a strong day"
    }
    return "Metrics look solid across the core recovery signals"
  }

  if (state === "attention") {
    if (durationFactor?.status === "negative") {
      return "Sleep duration is the main recovery bottleneck right now"
    }
    if (stressFactor?.status === "negative") {
      return "Stress load needs attention today"
    }
    return "One or more recovery signals need attention"
  }

  if (sleepFactor?.status === "positive" && stressFactor?.status === "negative") {
    return "Recovery looks good, but daytime stress is elevated"
  }

  if (readinessFactor?.status === "positive") {
    return "Readiness is holding up despite some mixed signals"
  }

  return isPartial
    ? "Mixed signals with a partially synced day"
    : "Mixed signals across sleep, stress, and readiness"
}

export function buildDailyHealthSummary(snapshot: DailyHealthSnapshot): DailyHealthSummary {
  const scoringFactors: HealthFactor[] = [
    evaluateSleepScore(snapshot.sleep?.score ?? null),
    evaluateSleepDuration(snapshot.sleep?.totalSleepSeconds ?? null),
    evaluateEfficiency(snapshot.sleep?.efficiency ?? null),
    evaluateStress(snapshot.stress?.stressHighSeconds ?? null),
    evaluateRecovery(snapshot.stress?.recoveryHighSeconds ?? null),
    evaluateReadiness(snapshot.readiness?.score ?? null),
  ]

  const state = computeSummaryState(scoringFactors)
  const factors: HealthFactor[] = [
    ...scoringFactors,
    evaluateHrv(snapshot.sleep?.averageHrv ?? null),
    evaluateLowestHeartRate(snapshot.sleep?.lowestHeartRate ?? null),
  ]

  const optionalFactors = [
    evaluateSpo2(snapshot.vitals?.spo2Percentage ?? null),
    evaluateCardioAge(snapshot.vitals?.cardiovascularAge ?? null),
    evaluateVo2Max(snapshot.vitals?.vo2Max ?? null),
  ].filter((factor): factor is HealthFactor => factor != null)

  factors.push(...optionalFactors)

  return {
    state,
    headline: generateSummaryHeadline(state, scoringFactors, snapshot.freshness.isPartial),
    factors,
  }
}
