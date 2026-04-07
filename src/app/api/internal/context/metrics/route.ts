export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { validateInternalApiKey } from "@/lib/auth"
import {
  getDailyHealthSnapshot,
  secondsToMinutes,
} from "@/features/oura/server/health-snapshot"
import { getLocalDayString } from "@/lib/utils/day"

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dayParam = searchParams.get("day")

  if (dayParam && !/^\d{4}-\d{2}-\d{2}$/.test(dayParam)) {
    return NextResponse.json(
      { error: "Invalid day format. Expected YYYY-MM-DD" },
      { status: 400 },
    )
  }

  const day = dayParam ?? getLocalDayString()
  const snapshot = await getDailyHealthSnapshot(day)

  return NextResponse.json({
    day,
    sleepScore: snapshot.sleep?.score ?? null,
    lowestHeartRate: snapshot.sleep?.lowestHeartRate ?? null,
    averageHeartRate: snapshot.sleep?.averageHeartRate ?? null,
    averageHrv: snapshot.sleep?.averageHrv ?? null,
    averageBreath: snapshot.sleep?.averageBreath ?? null,
    spo2Percentage: snapshot.vitals?.spo2Percentage ?? null,
    cardiovascularAge: snapshot.vitals?.cardiovascularAge ?? null,
    vo2Max: snapshot.vitals?.vo2Max ?? null,
    readinessScore: snapshot.readiness?.score ?? null,
    restingHeartRateContribution:
      snapshot.readiness?.contributors.restingHeartRateContribution ?? null,
    stressHighMinutes: secondsToMinutes(snapshot.stress?.stressHighSeconds ?? null),
    recoveryHighMinutes: secondsToMinutes(snapshot.stress?.recoveryHighSeconds ?? null),
    freshness: snapshot.freshness,
  })
}
