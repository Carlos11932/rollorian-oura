export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { format, subDays } from "date-fns"
import { syncEndpoints } from "@/features/oura/server/sync-engine"
import { ALL_SYNCABLE_ENDPOINTS } from "@/lib/oura/endpoints"

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date()
  const startDate = format(subDays(today, 1), "yyyy-MM-dd")
  const endDate = format(today, "yyyy-MM-dd")

  try {
    const result = await syncEndpoints({
      endpoints: ALL_SYNCABLE_ENDPOINTS,
      startDate,
      endDate,
      force: false,
      source: "cron",
    })

    return NextResponse.json(result, { status: result.status === "error" ? 500 : 200 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    )
  }
}
