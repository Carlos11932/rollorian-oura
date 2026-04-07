import { prisma } from "@/lib/prisma"
import { OURA_ENDPOINTS } from "@/lib/oura/endpoints"
import type { EndpointKey } from "@/lib/oura/endpoints"
import {
  getRawActivityDaily,
  getRawCardiovascularAge,
  getRawReadiness,
  getRawSleepDaily,
  getRawSleepPeriods,
  getRawSleepPeriodsInRange,
  getRawSpo2,
  getRawStressDaily,
  getRawVo2Max,
} from "@/features/oura/server/data"
import { getInclusiveDayWindow, listDayStrings } from "@/lib/utils/day"
import type { OuraSleepDaily, OuraSleepPeriod } from "@prisma/client"

export interface SleepSnapshot {
  score: number | null
  totalSleepSeconds: number | null
  timeInBedSeconds: number | null
  efficiency: number | null
  averageHrv: number | null
  averageHeartRate: number | null
  averageBreath: number | null
  lowestHeartRate: number | null
  deepSleepSeconds: number | null
  remSleepSeconds: number | null
  lightSleepSeconds: number | null
  awakeSeconds: number | null
  bedtimeStart: Date | null
  bedtimeEnd: Date | null
  source: "daily_sleep" | "sleep_period" | "mixed"
}

export interface ReadinessSnapshot {
  score: number | null
  temperatureDeviation: number | null
  temperatureTrendDeviation: number | null
  contributors: {
    activityBalance: number | null
    bodyTemperature: number | null
    hrvBalance: number | null
    previousDayActivity: number | null
    previousNight: number | null
    recoveryIndex: number | null
    restingHeartRateContribution: number | null
    sleepBalance: number | null
  }
}

export interface ActivitySnapshot {
  score: number | null
  steps: number | null
  activeCalories: number | null
  totalCalories: number | null
  equivalentWalkingDistance: number | null
}

export interface StressSnapshot {
  stressHighSeconds: number | null
  recoveryHighSeconds: number | null
  daySummary: string | null
}

export interface VitalsSnapshot {
  cardiovascularAge: number | null
  spo2Percentage: number | null
  vo2Max: number | null
}

export interface SyncStatusSnapshot {
  available: EndpointKey[]
  unavailable: EndpointKey[]
}

export interface FreshnessSnapshot {
  lastSuccessfulSync: string | null
  isPartial: boolean
  missingBlocks: string[]
  missingMetrics: string[]
}

export interface DailyHealthSnapshot {
  day: string
  sleep: SleepSnapshot | null
  readiness: ReadinessSnapshot | null
  activity: ActivitySnapshot | null
  stress: StressSnapshot | null
  vitals: VitalsSnapshot | null
  syncStatus: SyncStatusSnapshot
  freshness: FreshnessSnapshot
}

interface SleepPeriodDerivedMetrics {
  totalSleepSeconds: number | null
  timeInBedSeconds: number | null
  efficiency: number | null
  averageHrv: number | null
  averageHeartRate: number | null
  lowestHeartRate: number | null
  deepSleepSeconds: number | null
  remSleepSeconds: number | null
  lightSleepSeconds: number | null
  awakeSeconds: number | null
  bedtimeStart: Date | null
  bedtimeEnd: Date | null
}

export function secondsToHours(seconds: number | null | undefined): number | null {
  if (seconds == null) return null
  return Math.round((seconds / 3600) * 100) / 100
}

export function secondsToMinutes(seconds: number | null | undefined): number | null {
  if (seconds == null) return null
  return Math.round(seconds / 60)
}

export function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => value != null)
  if (valid.length === 0) return null
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 100) / 100
}

export function computeSyncStatus(
  lastSyncSession: { unavailableEndpoints: unknown } | null,
): SyncStatusSnapshot {
  const allEndpointKeys = Object.keys(OURA_ENDPOINTS) as EndpointKey[]

  if (!lastSyncSession) {
    return { available: allEndpointKeys, unavailable: [] }
  }

  const unavailableSet = new Set(lastSyncSession.unavailableEndpoints as string[])
  const unavailable = allEndpointKeys.filter((key) => unavailableSet.has(key))
  const available = allEndpointKeys.filter((key) => !unavailableSet.has(key))

  return { available, unavailable }
}

export function deriveSleepMetricsFromPeriods(
  periods: OuraSleepPeriod[],
): SleepPeriodDerivedMetrics {
  if (periods.length === 0) {
    return {
      totalSleepSeconds: null,
      timeInBedSeconds: null,
      efficiency: null,
      averageHrv: null,
      averageHeartRate: null,
      lowestHeartRate: null,
      deepSleepSeconds: null,
      remSleepSeconds: null,
      lightSleepSeconds: null,
      awakeSeconds: null,
      bedtimeStart: null,
      bedtimeEnd: null,
    }
  }

  const intervalSeconds = 300
  let deepCount = 0
  let lightCount = 0
  let remCount = 0
  let awakeCount = 0
  let hasPhaseData = false
  let timeInBedSeconds = 0
  const heartRateValues: number[] = []
  const hrvValues: number[] = []
  let bedtimeStart = periods[0]?.bedtimeStart ?? null
  let bedtimeEnd = periods[0]?.bedtimeEnd ?? null

  for (const period of periods) {
    if (bedtimeStart == null || period.bedtimeStart < bedtimeStart) {
      bedtimeStart = period.bedtimeStart
    }
    if (bedtimeEnd == null || period.bedtimeEnd > bedtimeEnd) {
      bedtimeEnd = period.bedtimeEnd
    }

    timeInBedSeconds += Math.max(
      0,
      Math.round((period.bedtimeEnd.getTime() - period.bedtimeStart.getTime()) / 1000),
    )

    if (period.sleepPhaseData) {
      hasPhaseData = true
      for (const phase of period.sleepPhaseData) {
        if (phase === "1") deepCount += 1
        else if (phase === "2") lightCount += 1
        else if (phase === "3") remCount += 1
        else if (phase === "4") awakeCount += 1
      }
    }

    const heartRateData = period.heartRateData as { items?: Array<number | null> } | null
    for (const value of heartRateData?.items ?? []) {
      if (value != null && value > 0) heartRateValues.push(value)
    }

    const hrvData = period.hrvData as { items?: Array<number | null> } | null
    for (const value of hrvData?.items ?? []) {
      if (value != null && value > 0) hrvValues.push(value)
    }
  }

  const deepSleepSeconds = hasPhaseData ? deepCount * intervalSeconds : null
  const remSleepSeconds = hasPhaseData ? remCount * intervalSeconds : null
  const lightSleepSeconds = hasPhaseData ? lightCount * intervalSeconds : null
  const awakeSeconds = hasPhaseData ? awakeCount * intervalSeconds : null
  const totalSleepSeconds = hasPhaseData
    ? (deepSleepSeconds ?? 0) + (remSleepSeconds ?? 0) + (lightSleepSeconds ?? 0)
    : null
  const efficiency =
    totalSleepSeconds != null && timeInBedSeconds > 0
      ? Math.round((totalSleepSeconds / timeInBedSeconds) * 100)
      : null

  return {
    totalSleepSeconds,
    timeInBedSeconds: timeInBedSeconds > 0 ? timeInBedSeconds : null,
    efficiency,
    averageHrv: average(hrvValues),
    averageHeartRate: average(heartRateValues),
    lowestHeartRate: heartRateValues.length > 0 ? Math.min(...heartRateValues) : null,
    deepSleepSeconds,
    remSleepSeconds,
    lightSleepSeconds,
    awakeSeconds,
    bedtimeStart,
    bedtimeEnd,
  }
}

export function buildSleepSnapshot(
  sleepDaily: OuraSleepDaily | null,
  periods: OuraSleepPeriod[],
): SleepSnapshot | null {
  const derived = deriveSleepMetricsFromPeriods(periods)

  if (sleepDaily == null && periods.length === 0) return null

  const usedDaily = sleepDaily != null
  const usedPeriods =
    periods.length > 0 &&
    [
      derived.totalSleepSeconds,
      derived.efficiency,
      derived.averageHrv,
      derived.averageHeartRate,
      derived.lowestHeartRate,
      derived.deepSleepSeconds,
      derived.remSleepSeconds,
      derived.lightSleepSeconds,
    ].some((value) => value != null)

  return {
    score: sleepDaily?.score ?? null,
    totalSleepSeconds: sleepDaily?.totalSleepSeconds ?? derived.totalSleepSeconds,
    timeInBedSeconds: sleepDaily?.timeInBedSeconds ?? derived.timeInBedSeconds,
    efficiency: sleepDaily?.efficiency ?? derived.efficiency,
    averageHrv: sleepDaily?.averageHrv ?? derived.averageHrv,
    averageHeartRate: sleepDaily?.averageHeartRate ?? derived.averageHeartRate,
    averageBreath: sleepDaily?.averageBreath ?? null,
    lowestHeartRate: sleepDaily?.lowestHeartRate ?? derived.lowestHeartRate,
    deepSleepSeconds: sleepDaily?.deepSleepSeconds ?? derived.deepSleepSeconds,
    remSleepSeconds: sleepDaily?.remSleepSeconds ?? derived.remSleepSeconds,
    lightSleepSeconds: sleepDaily?.lightSleepSeconds ?? derived.lightSleepSeconds,
    awakeSeconds: sleepDaily?.awakeSeconds ?? derived.awakeSeconds,
    bedtimeStart: sleepDaily?.bedtimeStart ?? derived.bedtimeStart,
    bedtimeEnd: sleepDaily?.bedtimeEnd ?? derived.bedtimeEnd,
    source: usedDaily && usedPeriods ? "mixed" : usedDaily ? "daily_sleep" : "sleep_period",
  }
}

function mapReadiness(
  readiness: Awaited<ReturnType<typeof getRawReadiness>>,
): ReadinessSnapshot | null {
  if (!readiness) return null
  return {
    score: readiness.score ?? null,
    temperatureDeviation: readiness.temperatureDeviation ?? null,
    temperatureTrendDeviation: readiness.temperatureTrendDev ?? null,
    contributors: {
      activityBalance: readiness.contribActivityBalance ?? null,
      bodyTemperature: readiness.contribBodyTemperature ?? null,
      hrvBalance: readiness.contribHrvBalance ?? null,
      previousDayActivity: readiness.contribPrevDayActivity ?? null,
      previousNight: readiness.contribPreviousNight ?? null,
      recoveryIndex: readiness.contribRecoveryIndex ?? null,
      restingHeartRateContribution: readiness.contribRestingHeartRate ?? null,
      sleepBalance: readiness.contribSleepBalance ?? null,
    },
  }
}

function mapActivity(
  activity: Awaited<ReturnType<typeof getRawActivityDaily>>[number] | null,
): ActivitySnapshot | null {
  if (!activity) return null
  return {
    score: activity.score ?? null,
    steps: activity.steps ?? null,
    activeCalories: activity.activeCalories ?? null,
    totalCalories: activity.totalCalories ?? null,
    equivalentWalkingDistance: activity.equivalentWalkingDistance ?? null,
  }
}

function mapStress(
  stress: Awaited<ReturnType<typeof getRawStressDaily>>[number] | null,
): StressSnapshot | null {
  if (!stress) return null
  return {
    stressHighSeconds: stress.stressHighSeconds ?? null,
    recoveryHighSeconds: stress.recoveryHighSeconds ?? null,
    daySummary: stress.daySummary ?? null,
  }
}

function mapVitals(input: {
  cardiovascularAge: Awaited<ReturnType<typeof getRawCardiovascularAge>>
  spo2: Awaited<ReturnType<typeof getRawSpo2>>
  vo2Max: Awaited<ReturnType<typeof getRawVo2Max>>
}): VitalsSnapshot | null {
  if (input.cardiovascularAge == null && input.spo2 == null && input.vo2Max == null) {
    return null
  }

  return {
    cardiovascularAge: input.cardiovascularAge?.vascularAge ?? null,
    spo2Percentage: input.spo2?.spo2Average ?? null,
    vo2Max: input.vo2Max?.vo2Max ?? null,
  }
}

function buildFreshnessSnapshot(input: {
  sleep: SleepSnapshot | null
  readiness: ReadinessSnapshot | null
  activity: ActivitySnapshot | null
  stress: StressSnapshot | null
  syncStatus: SyncStatusSnapshot
  lastSuccessfulSync: string | null
}): FreshnessSnapshot {
  const missingBlocks = [
    input.sleep == null ? "sleep" : null,
    input.readiness == null ? "readiness" : null,
    input.activity == null ? "activity" : null,
    input.stress == null ? "stress" : null,
  ].filter((block): block is string => block != null)

  const missingMetrics = [
    input.sleep != null && input.sleep.totalSleepSeconds == null ? "sleep.totalSleepSeconds" : null,
    input.sleep != null && input.sleep.efficiency == null ? "sleep.efficiency" : null,
    input.sleep != null && input.sleep.averageHrv == null ? "sleep.averageHrv" : null,
    input.sleep != null && input.sleep.lowestHeartRate == null ? "sleep.lowestHeartRate" : null,
  ].filter((metric): metric is string => metric != null)

  return {
    lastSuccessfulSync: input.lastSuccessfulSync,
    isPartial:
      missingBlocks.length > 0 ||
      missingMetrics.length > 0 ||
      input.syncStatus.unavailable.length > 0,
    missingBlocks,
    missingMetrics,
  }
}

async function getLastFinishedSyncSession() {
  return prisma.ouraSyncSession.findFirst({
    where: { finishedAt: { not: null } },
    orderBy: { finishedAt: "desc" },
  })
}

export async function getDailyHealthSnapshot(day: string): Promise<DailyHealthSnapshot> {
  const [
    sleepRows,
    sleepPeriods,
    readinessRow,
    activityRows,
    stressRows,
    cardiovascularAge,
    spo2,
    vo2Max,
    lastFinishedSyncSession,
  ] = await Promise.all([
    getRawSleepDaily(day, day).catch(() => []),
    getRawSleepPeriods(day).catch(() => []),
    getRawReadiness(day).catch(() => null),
    getRawActivityDaily(day, day).catch(() => []),
    getRawStressDaily(day, day).catch(() => []),
    getRawCardiovascularAge(day).catch(() => null),
    getRawSpo2(day).catch(() => null),
    getRawVo2Max(day).catch(() => null),
    getLastFinishedSyncSession().catch(() => null),
  ])

  const syncStatus = computeSyncStatus(lastFinishedSyncSession)
  const sleep = buildSleepSnapshot(sleepRows[0] ?? null, sleepPeriods)
  const readiness = mapReadiness(readinessRow)
  const activity = mapActivity(activityRows[0] ?? null)
  const stress = mapStress(stressRows[0] ?? null)
  const vitals = mapVitals({ cardiovascularAge, spo2, vo2Max })
  const lastSuccessfulSync = lastFinishedSyncSession?.finishedAt?.toISOString() ?? null

  return {
    day,
    sleep,
    readiness,
    activity,
    stress,
    vitals,
    syncStatus,
    freshness: buildFreshnessSnapshot({
      sleep,
      readiness,
      activity,
      stress,
      syncStatus,
      lastSuccessfulSync,
    }),
  }
}

export async function getDailyHealthTrend(days: number): Promise<DailyHealthSnapshot[]> {
  const { startDay, endDay } = getInclusiveDayWindow(days)
  const [
    sleepRows,
    sleepPeriods,
    readinessRows,
    activityRows,
    stressRows,
    cardiovascularAgeRows,
    spo2Rows,
    vo2Rows,
    lastFinishedSyncSession,
  ] = await Promise.all([
    getRawSleepDaily(startDay, endDay).catch(() => []),
    getRawSleepPeriodsInRange(startDay, endDay).catch(() => []),
    prisma.ouraReadinessDaily
      .findMany({
        where: { day: { gte: startDay, lte: endDay } },
        orderBy: { day: "asc" },
      })
      .catch(() => []),
    getRawActivityDaily(startDay, endDay).catch(() => []),
    getRawStressDaily(startDay, endDay).catch(() => []),
    prisma.ouraCardiovascularAge
      .findMany({
        where: { day: { gte: startDay, lte: endDay } },
        orderBy: { day: "asc" },
      })
      .catch(() => []),
    prisma.ouraSpo2Daily
      .findMany({
        where: { day: { gte: startDay, lte: endDay } },
        orderBy: { day: "asc" },
      })
      .catch(() => []),
    prisma.ouraVo2Max
      .findMany({
        where: { day: { gte: startDay, lte: endDay } },
        orderBy: { day: "asc" },
      })
      .catch(() => []),
    getLastFinishedSyncSession().catch(() => null),
  ])

  const sleepDailyByDay = new Map(sleepRows.map((row) => [row.day, row]))
  const periodsByDay = new Map<string, OuraSleepPeriod[]>()
  for (const period of sleepPeriods) {
    const existing = periodsByDay.get(period.day) ?? []
    existing.push(period)
    periodsByDay.set(period.day, existing)
  }
  const readinessByDay = new Map(readinessRows.map((row) => [row.day, row]))
  const activityByDay = new Map(activityRows.map((row) => [row.day, row]))
  const stressByDay = new Map(stressRows.map((row) => [row.day, row]))
  const cardiovascularAgeByDay = new Map(cardiovascularAgeRows.map((row) => [row.day, row]))
  const spo2ByDay = new Map(spo2Rows.map((row) => [row.day, row]))
  const vo2ByDay = new Map(vo2Rows.map((row) => [row.day, row]))
  const syncStatus = computeSyncStatus(lastFinishedSyncSession)
  const lastSuccessfulSync = lastFinishedSyncSession?.finishedAt?.toISOString() ?? null

  return listDayStrings(startDay, endDay).map((day) => {
    const sleep = buildSleepSnapshot(
      sleepDailyByDay.get(day) ?? null,
      periodsByDay.get(day) ?? [],
    )
    const readiness = mapReadiness(readinessByDay.get(day) ?? null)
    const activity = mapActivity(activityByDay.get(day) ?? null)
    const stress = mapStress(stressByDay.get(day) ?? null)
    const vitals = mapVitals({
      cardiovascularAge: cardiovascularAgeByDay.get(day) ?? null,
      spo2: spo2ByDay.get(day) ?? null,
      vo2Max: vo2ByDay.get(day) ?? null,
    })

    return {
      day,
      sleep,
      readiness,
      activity,
      stress,
      vitals,
      syncStatus,
      freshness: buildFreshnessSnapshot({
        sleep,
        readiness,
        activity,
        stress,
        syncStatus,
        lastSuccessfulSync,
      }),
    }
  })
}
