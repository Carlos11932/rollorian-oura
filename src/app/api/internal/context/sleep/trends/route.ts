export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { validateInternalApiKey } from "@/lib/auth"
import { getRawSleepTrend } from "@/features/oura/server/data"

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_DAYS = [7, 14, 30] as const
type AllowedDays = (typeof ALLOWED_DAYS)[number]

// ─── Response Shape ───────────────────────────────────────────────────────────

interface SleepTrendPoint {
  day: string
  totalSleepHours: number | null
  efficiency: number | null
  score: number | null
  averageHrv: number | null
  averageBreath: number | null
  lowestHeartRate: number | null
}

interface SleepTrendsAverages {
  totalSleepHours: number | null
  efficiency: number | null
  score: number | null
  averageHrv: number | null
}

interface SleepTrendsResponse {
  days: AllowedDays
  points: SleepTrendPoint[]
  averages: SleepTrendsAverages
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secondsToHours(seconds: number | null | undefined): number | null {
  if (seconds == null) return null
  return Math.round((seconds / 3600) * 100) / 100
}

function average(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  const sum = valid.reduce((acc, v) => acc + v, 0)
  return Math.round((sum / valid.length) * 100) / 100
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const daysParam = searchParams.get("days")

  if (!daysParam) {
    return NextResponse.json(
      {
        error: "Missing required parameter: days",
        allowedValues: ALLOWED_DAYS,
      },
      { status: 400 },
    )
  }

  const parsedDays = parseInt(daysParam, 10)

  if (!ALLOWED_DAYS.includes(parsedDays as AllowedDays)) {
    return NextResponse.json(
      {
        error: `Invalid days value: ${daysParam}. Must be one of: ${ALLOWED_DAYS.join(", ")}`,
        allowedValues: ALLOWED_DAYS,
      },
      { status: 400 },
    )
  }

  const days = parsedDays as AllowedDays

  const rawRows = await getRawSleepTrend(days).catch(() => [])

  const points: SleepTrendPoint[] = rawRows.map((row) => ({
    day: row.day,
    totalSleepHours: secondsToHours(row.totalSleepSeconds),
    efficiency: row.efficiency ?? null,
    score: row.score ?? null,
    averageHrv: row.averageHrv ?? null,
    averageBreath: row.averageBreath ?? null,
    lowestHeartRate: row.lowestHeartRate ?? null,
  }))

  const averages: SleepTrendsAverages = {
    totalSleepHours: average(points.map((p) => p.totalSleepHours)),
    efficiency: average(points.map((p) => p.efficiency)),
    score: average(points.map((p) => p.score)),
    averageHrv: average(points.map((p) => p.averageHrv)),
  }

  const response: SleepTrendsResponse = {
    days,
    points,
    averages,
  }

  return NextResponse.json(response)
}
