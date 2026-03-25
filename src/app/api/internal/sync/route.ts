import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { syncEndpoints } from "@/features/oura/server/sync-engine"
import { ALL_SYNCABLE_ENDPOINTS, type EndpointKey } from "@/lib/oura/endpoints"
import { validateInternalApiKey } from "@/lib/auth"

const syncRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endpoints: z
    .array(z.enum(ALL_SYNCABLE_ENDPOINTS as [EndpointKey, ...EndpointKey[]]))
    .optional(),
  force: z.boolean().optional().default(false),
})

export async function POST(request: NextRequest) {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = syncRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const { startDate, endDate, endpoints, force } = parsed.data

  try {
    const result = await syncEndpoints({
      endpoints: endpoints ?? ALL_SYNCABLE_ENDPOINTS,
      startDate,
      endDate,
      force,
      source: "donna",
    })

    return NextResponse.json(
      result,
      { status: result.status === "error" ? 500 : 200 },
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    )
  }
}
