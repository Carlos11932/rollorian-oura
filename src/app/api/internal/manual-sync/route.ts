export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { subDays } from "date-fns"
import { syncEndpoints } from "@/features/oura/server/sync-engine"
import { ALL_SYNCABLE_ENDPOINTS } from "@/lib/oura/endpoints"
import { validateInternalApiKey } from "@/lib/auth"
import { getLocalDayString } from "@/lib/utils/day"

export async function POST(request: NextRequest) {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  const startDate = getLocalDayString(subDays(today, 2))
  const endDate = getLocalDayString(today)

  try {
    const result = await syncEndpoints({
      endpoints: ALL_SYNCABLE_ENDPOINTS,
      startDate,
      endDate,
      force: true,
      source: "donna",
    })

    return NextResponse.json(result, { status: result.status === "error" ? 500 : 200 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    )
  }
}
