export const dynamic = "force-dynamic"
export const maxDuration = 60

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { syncEndpoints } from "@/features/oura/server/sync-engine"
import { DAILY_SYNC_ENDPOINTS } from "@/lib/oura/endpoints"
import { addDays, format, parseISO } from "date-fns"
import { validateInternalApiKey } from "@/lib/auth"

const backfillSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  chunkDays: z.number().int().min(1).max(90).optional().default(30),
  cursorStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  force: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = backfillSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { startDate, endDate, chunkDays, cursorStartDate, force } = parsed.data
  const currentStart = cursorStartDate ?? startDate

  if (parseISO(currentStart) > parseISO(endDate)) {
    return NextResponse.json({
      message: "Backfill already complete",
      done: true,
      nextStartDate: null,
    })
  }

  const chunkEnd = addDays(parseISO(currentStart), chunkDays - 1)
  const actualEnd = chunkEnd > parseISO(endDate) ? parseISO(endDate) : chunkEnd
  const actualEndDate = format(actualEnd, "yyyy-MM-dd")

  const result = await syncEndpoints({
    endpoints: DAILY_SYNC_ENDPOINTS,
    startDate: currentStart,
    endDate: actualEndDate,
    force,
    source: "backfill",
  })

  const nextStart = addDays(actualEnd, 1)
  const nextStartDate =
    nextStart <= parseISO(endDate) ? format(nextStart, "yyyy-MM-dd") : null

  return NextResponse.json({
    message: "Backfill chunk processed",
    done: nextStartDate == null,
    nextStartDate,
    processedWindow: {
      startDate: currentStart,
      endDate: actualEndDate,
    },
    result,
  })
}
