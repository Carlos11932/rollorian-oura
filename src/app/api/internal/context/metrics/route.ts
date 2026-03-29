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

interface MetricsResponse {
  day: string
  restingHeartRate: number | null  // from OuraSleepDaily.lowestHeartRate
  hrv: number | null               // from OuraSleepDaily.averageHrv
  spo2Percentage: number | null    // from OuraSpo2Daily.spo2Average
  cardiovascularAge: number | null // from OuraCardiovascularAge.vascularAge
  vo2Max: number | null            // from OuraVo2Max.vo2Max
  readinessScore: number | null    // from OuraReadinessDaily.score
  sleepScore: number | null        // from OuraSleepDaily.score
  stressHigh: number | null        // from OuraStressDaily (minutes)
  recoveryHigh: number | null      // from OuraStressDaily (minutes)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secondsToMinutes(seconds: number | null | undefined): number | null {
  if (seconds == null) return null
  return Math.round(seconds / 60)
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

  const response: MetricsResponse = {
    day,
    restingHeartRate: sleep?.lowestHeartRate ?? null,
    hrv: sleep?.averageHrv ?? null,
    spo2Percentage: spo2?.spo2Average ?? null,
    cardiovascularAge: cardioAge?.vascularAge ?? null,
    vo2Max: vo2Max?.vo2Max ?? null,
    readinessScore: readiness?.score ?? null,
    sleepScore: sleep?.score ?? null,
    stressHigh: secondsToMinutes(stress?.stressHighSeconds),
    recoveryHigh: secondsToMinutes(stress?.recoveryHighSeconds),
  }

  return NextResponse.json(response)
}
