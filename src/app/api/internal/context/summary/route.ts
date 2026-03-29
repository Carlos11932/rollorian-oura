export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { validateInternalApiKey } from "@/lib/auth"
import {
  getRawSleepDaily,
  getRawReadiness,
  getRawStressDaily,
  getRawSpo2,
  getRawCardiovascularAge,
  getRawVo2Max,
} from "@/features/oura/server/data"

// ─── Response Shape ───────────────────────────────────────────────────────────

type FactorStatus = "positive" | "neutral" | "negative" | "missing"
type OverallState = "good" | "mixed" | "attention" | "insufficient_data"

interface Factor {
  key: string
  status: FactorStatus
  value?: number | string
  label: string
}

interface SummaryResponse {
  day: string
  state: OverallState
  headline: string
  factors: Factor[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secondsToMinutes(seconds: number | null | undefined): number | null {
  if (seconds == null) return null
  return Math.round(seconds / 60)
}

// ─── Factor Evaluators ────────────────────────────────────────────────────────

function evalSleepScore(score: number | null): Factor {
  if (score == null) {
    return { key: "sleep_score", status: "missing", label: "Puntuación de sueño: sin datos" }
  }
  const status: FactorStatus = score >= 85 ? "positive" : score >= 70 ? "neutral" : "negative"
  return { key: "sleep_score", status, value: score, label: `Puntuación de sueño: ${score}` }
}

function evalHrv(hrv: number | null): Factor {
  if (hrv == null) {
    return { key: "hrv", status: "missing", label: "HRV: sin datos" }
  }
  // No personal baseline available → report as neutral (value is informative)
  return {
    key: "hrv",
    status: "neutral",
    value: Math.round(hrv),
    label: `HRV promedio: ${Math.round(hrv)} ms`,
  }
}

function evalEfficiency(efficiency: number | null): Factor {
  if (efficiency == null) {
    return { key: "efficiency", status: "missing", label: "Eficiencia de sueño: sin datos" }
  }
  const status: FactorStatus =
    efficiency >= 85 ? "positive" : efficiency >= 75 ? "neutral" : "negative"
  return {
    key: "efficiency",
    status,
    value: efficiency,
    label: `Eficiencia de sueño: ${efficiency}%`,
  }
}

function evalStressHigh(minutes: number | null): Factor {
  if (minutes == null) {
    return { key: "stress_high", status: "missing", label: "Estrés alto: sin datos" }
  }
  const status: FactorStatus = minutes < 30 ? "positive" : minutes <= 60 ? "neutral" : "negative"
  return {
    key: "stress_high",
    status,
    value: minutes,
    label: `Estrés alto: ${minutes} min`,
  }
}

function evalRecoveryHigh(minutes: number | null): Factor {
  if (minutes == null) {
    return { key: "recovery_high", status: "missing", label: "Recuperación alta: sin datos" }
  }
  const status: FactorStatus = minutes > 60 ? "positive" : minutes >= 30 ? "neutral" : "negative"
  return {
    key: "recovery_high",
    status,
    value: minutes,
    label: `Recuperación alta: ${minutes} min`,
  }
}

function evalRestingHr(hr: number | null): Factor {
  if (hr == null) {
    return { key: "resting_hr", status: "missing", label: "FC en reposo: sin datos" }
  }
  // No personal baseline → always neutral (informative only)
  return {
    key: "resting_hr",
    status: "neutral",
    value: hr,
    label: `FC en reposo: ${hr} bpm`,
  }
}

function evalReadinessScore(score: number | null): Factor {
  if (score == null) {
    return { key: "readiness_score", status: "missing", label: "Puntuación de disposición: sin datos" }
  }
  const status: FactorStatus = score >= 85 ? "positive" : score >= 70 ? "neutral" : "negative"
  return {
    key: "readiness_score",
    status,
    value: score,
    label: `Puntuación de disposición: ${score}`,
  }
}

// ─── State Computation ────────────────────────────────────────────────────────

function computeState(factors: Factor[]): OverallState {
  const total = factors.length
  const missing = factors.filter((f) => f.status === "missing").length
  const negative = factors.filter((f) => f.status === "negative").length
  const positive = factors.filter((f) => f.status === "positive").length

  if (missing / total > 0.5) return "insufficient_data"
  if (negative > 0) return "attention"
  if (positive === total - missing) return "good"
  return "mixed"
}

// ─── Headline Generation ──────────────────────────────────────────────────────

function generateHeadline(state: OverallState, factors: Factor[]): string {
  if (state === "insufficient_data") {
    return "Datos insuficientes para hoy"
  }

  const sleepFactor = factors.find((f) => f.key === "sleep_score")
  const stressFactor = factors.find((f) => f.key === "stress_high")
  const readinessFactor = factors.find((f) => f.key === "readiness_score")
  const recoveryFactor = factors.find((f) => f.key === "recovery_high")

  if (state === "good") {
    if (sleepFactor?.status === "positive" && recoveryFactor?.status === "positive") {
      return "Buen descanso y recuperación alta"
    }
    if (readinessFactor?.status === "positive") {
      return "Excelente disposición y recuperación"
    }
    return "Todo en orden — buen día para rendir"
  }

  if (state === "attention") {
    const negativeFactors = factors.filter((f) => f.status === "negative")
    const labels = negativeFactors.map((f) => {
      switch (f.key) {
        case "sleep_score":
          return "sueño bajo"
        case "efficiency":
          return "eficiencia baja"
        case "stress_high":
          return "estrés alto"
        case "recovery_high":
          return "recuperación baja"
        case "readiness_score":
          return "disposición baja"
        default:
          return f.key
      }
    })
    return `Atención: ${labels.join(", ")}`
  }

  // mixed
  if (sleepFactor?.status === "positive" && stressFactor?.status === "negative") {
    return "Buen sueño, pero estrés elevado"
  }
  if (sleepFactor?.status === "negative" && stressFactor?.status !== "negative") {
    return "Sueño bajo, pero estrés controlado"
  }
  if (readinessFactor?.status === "positive") {
    return "Buena disposición con algunos factores moderados"
  }
  return "Día con factores mixtos — revisa los detalles"
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dayParam = searchParams.get("day")

  const dayRegex = /^\d{4}-\d{2}-\d{2}$/
  if (dayParam && !dayRegex.test(dayParam)) {
    return NextResponse.json(
      { error: "Invalid day format. Expected YYYY-MM-DD" },
      { status: 400 },
    )
  }

  const day = dayParam ?? new Date().toISOString().slice(0, 10)

  const [sleepRows, readiness, stressRows, spo2, cardioAge, vo2Max] =
    await Promise.all([
      getRawSleepDaily(day, day).catch(() => []),
      getRawReadiness(day).catch(() => null),
      getRawStressDaily(day, day).catch(() => []),
      getRawSpo2(day).catch(() => null),
      getRawCardiovascularAge(day).catch(() => null),
      getRawVo2Max(day).catch(() => null),
    ])

  const sleep = sleepRows[0] ?? null
  const stress = stressRows[0] ?? null

  // Derived values
  const stressHighMinutes = secondsToMinutes(stress?.stressHighSeconds)
  const recoveryHighMinutes = secondsToMinutes(stress?.recoveryHighSeconds)

  // Evaluate all factors
  const factors: Factor[] = [
    evalSleepScore(sleep?.score ?? null),
    evalHrv(sleep?.averageHrv ?? null),
    evalEfficiency(sleep?.efficiency ?? null),
    evalStressHigh(stressHighMinutes),
    evalRecoveryHigh(recoveryHighMinutes),
    evalRestingHr(sleep?.lowestHeartRate ?? null),
    evalReadinessScore(readiness?.score ?? null),
  ]

  const state = computeState(factors)
  const headline = generateHeadline(state, factors)

  // Include optional vitals as informational neutral factors if available
  if (spo2?.spo2Average != null) {
    factors.push({
      key: "spo2",
      status: "neutral",
      value: Math.round(spo2.spo2Average * 10) / 10,
      label: `SpO2: ${Math.round(spo2.spo2Average * 10) / 10}%`,
    })
  }

  if (cardioAge?.vascularAge != null) {
    factors.push({
      key: "cardiovascular_age",
      status: "neutral",
      value: cardioAge.vascularAge,
      label: `Edad cardiovascular: ${cardioAge.vascularAge}`,
    })
  }

  if (vo2Max?.vo2Max != null) {
    factors.push({
      key: "vo2_max",
      status: "neutral",
      value: Math.round(vo2Max.vo2Max * 10) / 10,
      label: `VO2 máx: ${Math.round(vo2Max.vo2Max * 10) / 10}`,
    })
  }

  const response: SummaryResponse = {
    day,
    state,
    headline,
    factors,
  }

  return NextResponse.json(response)
}
