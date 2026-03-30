export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { validateInternalApiKey } from "@/lib/auth"
import {
  getRawSleepDaily,
  getRawSleepPeriods,
  getRawReadiness,
  getRawActivityDaily,
  getRawStressDaily,
  getRawCardiovascularAge,
  getRawSpo2,
  getRawVo2Max,
} from "@/features/oura/server/data"
import type { OuraSleepPeriod } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { OURA_ENDPOINTS } from "@/lib/oura/endpoints"
import type { EndpointKey } from "@/lib/oura/endpoints"

// ─── Response Shape ───────────────────────────────────────────────────────────

interface SleepSection {
  score: number | null
  totalSleepHours: number | null
  efficiency: number | null
  averageHrv: number | null
  averageBreath: number | null
  lowestHeartRate: number | null
  deepSleepHours: number | null
  remSleepHours: number | null
  lightSleepHours: number | null
}

interface ReadinessSection {
  score: number | null
  temperatureDeviation: number | null
  temperatureTrendDev: number | null
  activityBalance: number | null
  bodyTemperature: number | null
  hrvBalance: number | null
  prevDayActivity: number | null
  previousNight: number | null
  recoveryIndex: number | null
  restingHeartRate: number | null
  sleepBalance: number | null
}

interface ActivitySection {
  score: number | null
  activeCalories: number | null
  totalCalories: number | null
  steps: number | null
  equivalentWalkingDistance: number | null
}

interface StressSection {
  stressHighMinutes: number | null
  recoveryHighMinutes: number | null
  daytimeStress: string | null
}

interface VitalsSection {
  cardiovascularAge: number | null
  spo2Percentage: number | null
  vo2Max: number | null
}

interface SyncStatus {
  available: EndpointKey[]
  unavailable: EndpointKey[]
}

interface ContextTodayResponse {
  day: string
  syncStatus: SyncStatus
  sleep: SleepSection | null
  readiness: ReadinessSection | null
  activity: ActivitySection | null
  stress: StressSection | null
  vitals: VitalsSection | null
  lastSync: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secondsToHours(seconds: number | null | undefined): number | null {
  if (seconds == null) return null
  return Math.round((seconds / 3600) * 100) / 100
}

interface PeriodMetrics {
  totalSleepSeconds: number | undefined
  deepSleepSeconds: number | undefined
  remSleepSeconds: number | undefined
  lightSleepSeconds: number | undefined
  averageHrv: number | undefined
  lowestHeartRate: number | undefined
}

function extractFromSleepPeriods(periods: OuraSleepPeriod[]): PeriodMetrics {
  const result: PeriodMetrics = {
    totalSleepSeconds: undefined,
    deepSleepSeconds: undefined,
    remSleepSeconds: undefined,
    lightSleepSeconds: undefined,
    averageHrv: undefined,
    lowestHeartRate: undefined,
  }

  if (periods.length === 0) return result

  // Phase durations from sleepPhaseData (5-min intervals: 1=deep, 2=light, 3=rem, 4=awake)
  const INTERVAL_SECONDS = 300
  let deep = 0, light = 0, rem = 0, hasPhaseData = false
  for (const period of periods) {
    if (!period.sleepPhaseData) continue
    hasPhaseData = true
    for (const char of period.sleepPhaseData) {
      if (char === "1") deep++
      else if (char === "2") light++
      else if (char === "3") rem++
    }
  }
  if (hasPhaseData) {
    result.deepSleepSeconds = deep * INTERVAL_SECONDS
    result.remSleepSeconds = rem * INTERVAL_SECONDS
    result.lightSleepSeconds = light * INTERVAL_SECONDS
    result.totalSleepSeconds = (deep + rem + light) * INTERVAL_SECONDS
  }

  // Average HRV from all period hrv items
  const hrvValues: number[] = []
  for (const period of periods) {
    const hrv = period.hrvData as { items?: (number | null)[] } | null
    if (hrv?.items) {
      for (const v of hrv.items) {
        if (v != null && v > 0) hrvValues.push(v)
      }
    }
  }
  if (hrvValues.length > 0) {
    result.averageHrv =
      Math.round((hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length) * 10) / 10
  }

  // Lowest heart rate across all period hr items
  const hrValues: number[] = []
  for (const period of periods) {
    const hr = period.heartRateData as { items?: (number | null)[] } | null
    if (hr?.items) {
      for (const v of hr.items) {
        if (v != null && v > 0) hrValues.push(v)
      }
    }
  }
  if (hrValues.length > 0) {
    result.lowestHeartRate = Math.min(...hrValues)
  }

  return result
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dayParam = searchParams.get("day")

  // Validate ISO date format if provided
  const dayRegex = /^\d{4}-\d{2}-\d{2}$/
  if (dayParam && !dayRegex.test(dayParam)) {
    return NextResponse.json(
      { error: "Invalid day format. Expected YYYY-MM-DD" },
      { status: 400 },
    )
  }

  const day = dayParam ?? new Date().toISOString().slice(0, 10)

  // Fetch all data in parallel — handle missing optional data gracefully
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
  ] = await Promise.all([
    getRawSleepDaily(day, day).catch(() => []),
    getRawSleepPeriods(day).catch(() => []),
    getRawReadiness(day).catch(() => null),
    getRawActivityDaily(day, day).catch(() => []),
    getRawStressDaily(day, day).catch(() => []),
    getRawCardiovascularAge(day).catch(() => null),
    getRawSpo2(day).catch(() => null),
    getRawVo2Max(day).catch(() => null),
    prisma.ouraSyncSession
      .findFirst({ orderBy: { startedAt: "desc" } })
      .catch(() => null),
  ])

  const sleep = sleepRows[0] ?? null
  const activity = activityRows[0] ?? null
  const stress = stressRows[0] ?? null
  const periodMetrics = extractFromSleepPeriods(sleepPeriods)

  // Compute syncStatus from persisted unavailableEndpoints in the latest session.
  // unavailableEndpoints contains only optional endpoints that returned 404 during
  // the last sync — an exact record of what was unavailable, not an approximation.
  const allEndpointKeys = Object.keys(OURA_ENDPOINTS) as EndpointKey[]
  let syncStatus: SyncStatus

  if (lastSyncSession) {
    const unavailableSet = new Set(
      lastSyncSession.unavailableEndpoints as string[],
    )
    const unavailable = allEndpointKeys.filter((key) => unavailableSet.has(key))
    const available = allEndpointKeys.filter((key) => !unavailableSet.has(key))

    syncStatus = { available, unavailable }
  } else {
    // Optimistic default: all endpoints available when no sync has run yet
    syncStatus = { available: allEndpointKeys, unavailable: [] }
  }

  const response: ContextTodayResponse = {
    day,
    syncStatus,

    sleep: sleep != null || sleepPeriods.length > 0
      ? {
          score: sleep?.score ?? null,
          totalSleepHours: secondsToHours(
            sleep?.totalSleepSeconds ?? periodMetrics.totalSleepSeconds,
          ),
          efficiency: sleep?.efficiency ?? null,
          averageHrv: sleep?.averageHrv ?? periodMetrics.averageHrv ?? null,
          averageBreath: sleep?.averageBreath ?? null,
          lowestHeartRate:
            sleep?.lowestHeartRate ?? periodMetrics.lowestHeartRate ?? null,
          deepSleepHours: secondsToHours(
            sleep?.deepSleepSeconds ?? periodMetrics.deepSleepSeconds,
          ),
          remSleepHours: secondsToHours(
            sleep?.remSleepSeconds ?? periodMetrics.remSleepSeconds,
          ),
          lightSleepHours: secondsToHours(
            sleep?.lightSleepSeconds ?? periodMetrics.lightSleepSeconds,
          ),
        }
      : null,

    readiness: readiness
      ? {
          score: readiness.score ?? null,
          temperatureDeviation: readiness.temperatureDeviation ?? null,
          temperatureTrendDev: readiness.temperatureTrendDev ?? null,
          activityBalance: readiness.contribActivityBalance ?? null,
          bodyTemperature: readiness.contribBodyTemperature ?? null,
          hrvBalance: readiness.contribHrvBalance ?? null,
          prevDayActivity: readiness.contribPrevDayActivity ?? null,
          previousNight: readiness.contribPreviousNight ?? null,
          recoveryIndex: readiness.contribRecoveryIndex ?? null,
          restingHeartRate: readiness.contribRestingHeartRate ?? null,
          sleepBalance: readiness.contribSleepBalance ?? null,
        }
      : null,

    activity: activity
      ? {
          score: activity.score ?? null,
          activeCalories: activity.activeCalories ?? null,
          totalCalories: activity.totalCalories ?? null,
          steps: activity.steps ?? null,
          equivalentWalkingDistance: activity.equivalentWalkingDistance ?? null,
        }
      : null,

    stress: stress
      ? {
          stressHighMinutes: stress.stressHighSeconds != null ? Math.round(stress.stressHighSeconds / 60) : null,
          recoveryHighMinutes: stress.recoveryHighSeconds != null ? Math.round(stress.recoveryHighSeconds / 60) : null,
          daytimeStress: stress.daySummary ?? null,
        }
      : null,

    vitals:
      cardioAge ?? spo2 ?? vo2Max
        ? {
            cardiovascularAge: cardioAge?.vascularAge ?? null,
            spo2Percentage: spo2?.spo2Average ?? null,
            vo2Max: vo2Max?.vo2Max ?? null,
          }
        : null,

    lastSync: lastSyncSession?.finishedAt?.toISOString() ?? null,
  }

  return NextResponse.json(response)
}
