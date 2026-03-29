export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { validateInternalApiKey } from "@/lib/auth"
import {
  generateInsights,
  getStoredInsights,
  areInsightsStale,
} from "@/features/oura/server/insights/engine"

// ─── Response Shape ───────────────────────────────────────────────────────────

interface InsightItem {
  insightType: string
  severity: "info" | "warning" | "alert"
  title: string
  message: string
  metadata?: Record<string, unknown>
}

interface InsightsResponse {
  day: string
  generated: InsightItem[]
  persisted: number
  stale: boolean
  regenerated: boolean
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dayParam = searchParams.get("day")
  const forceParam = searchParams.get("force")

  // Validate ISO date format if provided
  const dayRegex = /^\d{4}-\d{2}-\d{2}$/
  if (dayParam && !dayRegex.test(dayParam)) {
    return NextResponse.json(
      { error: "Invalid day format. Expected YYYY-MM-DD" },
      { status: 400 },
    )
  }

  const day = dayParam ?? new Date().toISOString().slice(0, 10)
  const force = forceParam === "true"

  // Check staleness
  const stale = await areInsightsStale(day)
  const shouldRegenerate = stale || force

  let insights: InsightItem[]
  let regenerated: boolean

  let persistedCount: number

  if (shouldRegenerate) {
    // Re-evaluate rules and upsert into DB — use return value directly (no extra DB query)
    const generated = await generateInsights(day)
    insights = generated.map((g) => ({
      insightType: g.insightType,
      severity: g.severity as "info" | "warning" | "alert",
      title: g.title,
      message: g.message,
      ...(g.metadata != null
        ? { metadata: g.metadata as Record<string, unknown> }
        : {}),
    }))
    persistedCount = generated.length
    regenerated = true
  } else {
    // Serve cached insights from DB
    const stored = await getStoredInsights(day)
    insights = stored.map((s) => ({
      insightType: s.insightType,
      severity: s.severity as "info" | "warning" | "alert",
      title: s.title,
      message: s.message,
      ...(s.metadata != null
        ? { metadata: s.metadata as Record<string, unknown> }
        : {}),
    }))
    persistedCount = stored.length
    regenerated = false
  }

  const response: InsightsResponse = {
    day,
    generated: insights,
    persisted: persistedCount,
    stale,
    regenerated,
  }

  return NextResponse.json(response)
}
