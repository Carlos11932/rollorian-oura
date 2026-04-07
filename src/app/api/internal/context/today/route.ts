export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { validateInternalApiKey } from "@/lib/auth"
import {
  getDailyHealthSnapshot,
  secondsToHours,
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
    day: snapshot.day,
    syncStatus: snapshot.syncStatus,
    lastSync: snapshot.freshness.lastSuccessfulSync,
    freshness: snapshot.freshness,
    sleep: snapshot.sleep
      ? {
          score: snapshot.sleep.score,
          totalSleepHours: secondsToHours(snapshot.sleep.totalSleepSeconds),
          timeInBedHours: secondsToHours(snapshot.sleep.timeInBedSeconds),
          efficiency: snapshot.sleep.efficiency,
          averageHrv: snapshot.sleep.averageHrv,
          averageHeartRate: snapshot.sleep.averageHeartRate,
          averageBreath: snapshot.sleep.averageBreath,
          lowestHeartRate: snapshot.sleep.lowestHeartRate,
          deepSleepHours: secondsToHours(snapshot.sleep.deepSleepSeconds),
          remSleepHours: secondsToHours(snapshot.sleep.remSleepSeconds),
          lightSleepHours: secondsToHours(snapshot.sleep.lightSleepSeconds),
          awakeMinutes: secondsToMinutes(snapshot.sleep.awakeSeconds),
          bedtimeStart: snapshot.sleep.bedtimeStart?.toISOString() ?? null,
          bedtimeEnd: snapshot.sleep.bedtimeEnd?.toISOString() ?? null,
          source: snapshot.sleep.source,
        }
      : null,
    readiness: snapshot.readiness
      ? {
          score: snapshot.readiness.score,
          temperatureDeviation: snapshot.readiness.temperatureDeviation,
          temperatureTrendDeviation: snapshot.readiness.temperatureTrendDeviation,
          activityBalance: snapshot.readiness.contributors.activityBalance,
          bodyTemperature: snapshot.readiness.contributors.bodyTemperature,
          hrvBalance: snapshot.readiness.contributors.hrvBalance,
          previousDayActivity: snapshot.readiness.contributors.previousDayActivity,
          previousNight: snapshot.readiness.contributors.previousNight,
          recoveryIndex: snapshot.readiness.contributors.recoveryIndex,
          restingHeartRateContribution:
            snapshot.readiness.contributors.restingHeartRateContribution,
          sleepBalance: snapshot.readiness.contributors.sleepBalance,
          contributors: snapshot.readiness.contributors,
        }
      : null,
    activity: snapshot.activity,
    stress: snapshot.stress
      ? {
          stressHighMinutes: secondsToMinutes(snapshot.stress.stressHighSeconds),
          recoveryHighMinutes: secondsToMinutes(snapshot.stress.recoveryHighSeconds),
          daytimeStress: snapshot.stress.daySummary,
        }
      : null,
    vitals: snapshot.vitals,
  })
}
