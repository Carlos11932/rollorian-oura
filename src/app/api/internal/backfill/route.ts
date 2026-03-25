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

  const { startDate, endDate, chunkDays } = parsed.data

  // Run backfill in the background — do not block the response
  // In production this should be a queue job; for personal use this is sufficient
  runBackfillAsync(startDate, endDate, chunkDays).catch(console.error)

  return NextResponse.json({
    message: "Backfill started",
    startDate,
    endDate,
    chunkDays,
    estimatedChunks: Math.ceil(
      (parseISO(endDate).getTime() - parseISO(startDate).getTime()) /
        (chunkDays * 24 * 60 * 60 * 1000),
    ),
  })
}

async function runBackfillAsync(
  startDate: string,
  endDate: string,
  chunkDays: number,
): Promise<void> {
  let current = parseISO(startDate)
  const end = parseISO(endDate)

  while (current <= end) {
    const chunkEnd = addDays(current, chunkDays - 1)
    const actualEnd = chunkEnd > end ? end : chunkEnd

    await syncEndpoints({
      endpoints: DAILY_SYNC_ENDPOINTS,
      startDate: format(current, "yyyy-MM-dd"),
      endDate: format(actualEnd, "yyyy-MM-dd"),
      force: false,
      source: "backfill",
    })

    current = addDays(actualEnd, 1)
  }
}
