export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { validateInternalApiKey } from "@/lib/auth"
import { getDailyHealthSnapshot } from "@/features/oura/server/health-snapshot"
import { buildDailyHealthSummary } from "@/features/oura/server/health-summary"
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
  const summary = buildDailyHealthSummary(snapshot)

  return NextResponse.json({
    day,
    state: summary.state,
    headline: summary.headline,
    factors: summary.factors,
    freshness: snapshot.freshness,
  })
}
