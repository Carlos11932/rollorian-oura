export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { validateInternalApiKey } from "@/lib/auth"
import { average, getDailyHealthTrend, secondsToHours } from "@/features/oura/server/health-snapshot"

const ALLOWED_DAYS = [7, 14, 30] as const
type AllowedDays = (typeof ALLOWED_DAYS)[number]

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

  const parsedDays = Number.parseInt(daysParam, 10)
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
  const trend = await getDailyHealthTrend(days)
  const points = trend.map((snapshot) => ({
    day: snapshot.day,
    totalSleepHours: secondsToHours(snapshot.sleep?.totalSleepSeconds),
    efficiency: snapshot.sleep?.efficiency ?? null,
    score: snapshot.sleep?.score ?? null,
    averageHrv: snapshot.sleep?.averageHrv ?? null,
    averageBreath: snapshot.sleep?.averageBreath ?? null,
    lowestHeartRate: snapshot.sleep?.lowestHeartRate ?? null,
    source: snapshot.sleep?.source ?? null,
    isPartial: snapshot.freshness.isPartial,
  }))

  return NextResponse.json({
    days,
    points,
    averages: {
      totalSleepHours: average(points.map((point) => point.totalSleepHours)),
      efficiency: average(points.map((point) => point.efficiency)),
      score: average(points.map((point) => point.score)),
      averageHrv: average(points.map((point) => point.averageHrv)),
    },
  })
}
