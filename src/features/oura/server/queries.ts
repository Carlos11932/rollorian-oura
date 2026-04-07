import "server-only"
import { isToday, parseISO } from "date-fns"
import { getDateRange } from "@/lib/utils/date-range"
import {
  BUSINESS_TIME_ZONE,
  formatTimeInZone,
  getBucketTimeInZone,
  getLocalDayString,
} from "@/lib/utils/day"
import {
  getRawHeartRateEntriesInRange,
  getRawSleepPeriods,
  getRawSleepPhaseData,
} from "@/features/oura/server/data"
import {
  getDailyHealthSnapshot,
  getDailyHealthTrend,
  secondsToHours,
  secondsToMinutes,
} from "@/features/oura/server/health-snapshot"

export type Period = "1d" | "7d" | "14d" | "30d" | "90d"

export interface SleepChartPoint {
  day: string
  totalHours: number | null
  deep: number | null
  light: number | null
  rem: number | null
  efficiency: number | null
  score: number | null
  averageBreath: number | null
  averageHrv: number | null
  source: "daily_sleep" | "sleep_period" | "mixed" | null
  isPartial: boolean
}

export async function getSleepChartData(
  period: Period,
  selectedDate?: string,
): Promise<SleepChartPoint[]> {
  if (period === "1d") {
    const day =
      selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
        ? selectedDate
        : getLocalDayString()
    const snapshot = await getDailyHealthSnapshot(day)

    return [
      {
        day,
        totalHours: secondsToHours(snapshot.sleep?.totalSleepSeconds),
        deep: secondsToHours(snapshot.sleep?.deepSleepSeconds),
        light: secondsToHours(snapshot.sleep?.lightSleepSeconds),
        rem: secondsToHours(snapshot.sleep?.remSleepSeconds),
        efficiency: snapshot.sleep?.efficiency ?? null,
        score: snapshot.sleep?.score ?? null,
        averageBreath: snapshot.sleep?.averageBreath ?? null,
        averageHrv: snapshot.sleep?.averageHrv ?? null,
        source: snapshot.sleep?.source ?? null,
        isPartial: snapshot.freshness.isPartial,
      },
    ]
  }

  const { startDate, endDate } = getDateRange(period, selectedDate)
  const dayCount =
    Math.round(
      (parseISO(endDate).getTime() - parseISO(startDate).getTime()) / (24 * 60 * 60 * 1000),
    ) + 1

  const snapshots = await getDailyHealthTrend(dayCount)

  return snapshots.map((snapshot) => ({
    day: snapshot.day,
    totalHours: secondsToHours(snapshot.sleep?.totalSleepSeconds),
    deep: secondsToHours(snapshot.sleep?.deepSleepSeconds),
    light: secondsToHours(snapshot.sleep?.lightSleepSeconds),
    rem: secondsToHours(snapshot.sleep?.remSleepSeconds),
    efficiency: snapshot.sleep?.efficiency ?? null,
    score: snapshot.sleep?.score ?? null,
    averageBreath: snapshot.sleep?.averageBreath ?? null,
    averageHrv: snapshot.sleep?.averageHrv ?? null,
    source: snapshot.sleep?.source ?? null,
    isPartial: snapshot.freshness.isPartial,
  }))
}

export interface MetricsPoint {
  day: string
  lowestHeartRate: number | null
  cardioAge: number | null
  stressHigh: number | null
  recoveryHigh: number | null
  readinessScore: number | null
  sleepScore: number | null
  steps: number | null
  activeCalories: number | null
  isPartial: boolean
  [key: string]: string | number | null | boolean
}

export async function getMetricsData(
  period: Period,
  selectedDate?: string,
): Promise<MetricsPoint[]> {
  if (period === "1d") {
    const day =
      selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
        ? selectedDate
        : getLocalDayString()
    const snapshot = await getDailyHealthSnapshot(day)

    return [
      {
        day,
        lowestHeartRate: snapshot.sleep?.lowestHeartRate ?? null,
        cardioAge: snapshot.vitals?.cardiovascularAge ?? null,
        stressHigh: secondsToMinutes(snapshot.stress?.stressHighSeconds ?? null),
        recoveryHigh: secondsToMinutes(snapshot.stress?.recoveryHighSeconds ?? null),
        readinessScore: snapshot.readiness?.score ?? null,
        sleepScore: snapshot.sleep?.score ?? null,
        steps: snapshot.activity?.steps ?? null,
        activeCalories: snapshot.activity?.activeCalories ?? null,
        isPartial: snapshot.freshness.isPartial,
      },
    ]
  }

  const { startDate, endDate } = getDateRange(period, selectedDate)
  const dayCount =
    Math.round(
      (parseISO(endDate).getTime() - parseISO(startDate).getTime()) / (24 * 60 * 60 * 1000),
    ) + 1

  const snapshots = await getDailyHealthTrend(dayCount)

  return snapshots.map((snapshot) => ({
    day: snapshot.day,
    lowestHeartRate: snapshot.sleep?.lowestHeartRate ?? null,
    cardioAge: snapshot.vitals?.cardiovascularAge ?? null,
    stressHigh: secondsToMinutes(snapshot.stress?.stressHighSeconds ?? null),
    recoveryHigh: secondsToMinutes(snapshot.stress?.recoveryHighSeconds ?? null),
    readinessScore: snapshot.readiness?.score ?? null,
    sleepScore: snapshot.sleep?.score ?? null,
    steps: snapshot.activity?.steps ?? null,
    activeCalories: snapshot.activity?.activeCalories ?? null,
    isPartial: snapshot.freshness.isPartial,
  }))
}

export interface StressIntradayPoint {
  hour: string
  bpm: number
}

function getIntradayQueryBounds(date: string) {
  const dayStart = new Date(`${date}T00:00:00.000Z`)
  return {
    gte: new Date(dayStart.getTime() - 14 * 60 * 60 * 1000),
    lte: new Date(dayStart.getTime() + 38 * 60 * 60 * 1000),
  }
}

export async function getIntradayHeartRate(date: string): Promise<StressIntradayPoint[]> {
  const { gte, lte } = getIntradayQueryBounds(date)
  const entries = await getRawHeartRateEntriesInRange(gte, lte)

  if (entries.length === 0) return []

  const bucketMap = new Map<string, number[]>()
  for (const entry of entries) {
    if (getLocalDayString(entry.timestamp, BUSINESS_TIME_ZONE) !== date) continue
    const bucket = getBucketTimeInZone(entry.timestamp, 15, BUSINESS_TIME_ZONE)
    const values = bucketMap.get(bucket) ?? []
    values.push(entry.bpm)
    bucketMap.set(bucket, values)
  }

  const nowBucket = isToday(parseISO(date))
    ? getBucketTimeInZone(new Date(), 15, BUSINESS_TIME_ZONE)
    : null

  return Array.from(bucketMap.entries())
    .filter(([time]) => nowBucket == null || time <= nowBucket)
    .map(([time, values]) => ({
      hour: time,
      bpm: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((left, right) => left.hour.localeCompare(right.hour))
}

export interface SleepIntradayPoint {
  time: string
  bpm: number
}

interface OuraHeartRateData {
  interval: number
  items: Array<number | null>
  timestamp: string
}

export async function getSleepIntradayData(date: string): Promise<SleepIntradayPoint[]> {
  const records = await getRawSleepPeriods(date)
  const record =
    records.find((item) => item.sleepType === "long_sleep" && item.heartRateData) ??
    records.find((item) => item.heartRateData)

  if (!record?.heartRateData) return []

  const heartRateData = record.heartRateData as unknown as OuraHeartRateData
  if (!heartRateData.items?.length) return []

  const baseTime = new Date(heartRateData.timestamp)
  const intervalMs = heartRateData.interval * 1000
  const bucketMap = new Map<string, number[]>()

  heartRateData.items.forEach((value, index) => {
    if (value == null) return
    const sampleTime = new Date(baseTime.getTime() + index * intervalMs)
    const bucket = getBucketTimeInZone(sampleTime, 15, BUSINESS_TIME_ZONE)
    const values = bucketMap.get(bucket) ?? []
    values.push(value)
    bucketMap.set(bucket, values)
  })

  return Array.from(bucketMap.entries())
    .map(([time, values]) => ({
      time,
      bpm: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((left, right) => left.time.localeCompare(right.time))
}

export interface SleepPhasePoint {
  time: string
  phase: 1 | 2 | 3 | 4
}

export async function getSleepPhaseData(date: string): Promise<SleepPhasePoint[]> {
  const records = await getRawSleepPhaseData(date)
  const record =
    records.find((item) => item.sleepType === "long_sleep" && item.sleepPhaseData) ??
    records.find((item) => item.sleepPhaseData)

  if (!record?.sleepPhaseData) return []

  const phases = record.sleepPhaseData.split("")
  const baseTime = record.bedtimeStart.getTime()

  return phases
    .map((phase, index) => {
      if (phase !== "1" && phase !== "2" && phase !== "3" && phase !== "4") return null
      const sampleTime = new Date(baseTime + index * 5 * 60 * 1000)
      return {
        time: formatTimeInZone(sampleTime, BUSINESS_TIME_ZONE),
        phase: Number(phase) as 1 | 2 | 3 | 4,
      }
    })
    .filter((point): point is SleepPhasePoint => point != null)
}

export async function getStressIntradayData(date: string): Promise<StressIntradayPoint[]> {
  const { gte, lte } = getIntradayQueryBounds(date)
  const entries = await getRawHeartRateEntriesInRange(gte, lte, "sleep")

  if (entries.length === 0) return []

  const bucketMap = new Map<string, number[]>()
  for (const entry of entries) {
    if (getLocalDayString(entry.timestamp, BUSINESS_TIME_ZONE) !== date) continue
    const bucket = getBucketTimeInZone(entry.timestamp, 15, BUSINESS_TIME_ZONE)
    const values = bucketMap.get(bucket) ?? []
    values.push(entry.bpm)
    bucketMap.set(bucket, values)
  }

  const nowBucket = isToday(parseISO(date))
    ? getBucketTimeInZone(new Date(), 15, BUSINESS_TIME_ZONE)
    : null

  return Array.from(bucketMap.entries())
    .filter(([time]) => nowBucket == null || time <= nowBucket)
    .map(([time, values]) => ({
      hour: time,
      bpm: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    }))
    .sort((left, right) => left.hour.localeCompare(right.hour))
}
