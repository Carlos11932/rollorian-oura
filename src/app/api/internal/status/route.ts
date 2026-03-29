export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateInternalApiKey } from "@/lib/auth"

// ─── In-memory cache (30 seconds) ────────────────────────────────────────────

interface CacheEntry {
  data: unknown
  expiresAt: number
}

let statusCache: CacheEntry | null = null

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Return cached result if still fresh
  if (statusCache !== null && Date.now() < statusCache.expiresAt) {
    return NextResponse.json(statusCache.data)
  }

  const [lastSession, tokenExists, totalCounts] = await Promise.all([
    prisma.ouraSyncSession.findFirst({
      orderBy: { startedAt: "desc" },
    }),
    prisma.ouraOAuthToken
      .findUnique({ where: { id: "singleton" } })
      .then(Boolean),
    Promise.all([
      prisma.ouraSleepDaily.count(),
      prisma.ouraSleepPeriod.count(),
      prisma.ouraReadinessDaily.count(),
      prisma.ouraActivityDaily.count(),
      prisma.ouraStressDaily.count(),
      prisma.ouraResilienceDaily.count(),
      prisma.ouraHeartRateEntry.count(),
      prisma.ouraSpo2Daily.count(),
      prisma.ouraCardiovascularAge.count(),
      prisma.ouraVo2Max.count(),
      prisma.ouraWorkout.count(),
      prisma.ouraSession.count(),
      prisma.ouraTag.count(),
      prisma.ouraEnhancedTag.count(),
      prisma.ouraSleepTime.count(),
      prisma.ouraRestModePeriod.count(),
      prisma.ouraRingConfig.count(),
      prisma.ouraSyncSession.count(),
      prisma.ouraInsight.count(),
      prisma.ouraOAuthToken.count(),
      prisma.ouraPersonalInfo.count(),
      prisma.gapPattern.count(),
      prisma.activityGap.count(),
    ]),
  ])

  const responseData = {
    connected: tokenExists,
    lastSync: lastSession
      ? {
          id: lastSession.id,
          status: lastSession.status,
          startedAt: lastSession.startedAt,
          finishedAt: lastSession.finishedAt,
          recordsInserted: lastSession.recordsInserted,
          recordsUpdated: lastSession.recordsUpdated,
          source: lastSession.source,
        }
      : null,
    recordCounts: {
      sleepDaily: totalCounts[0],
      sleepPeriods: totalCounts[1],
      readinessDaily: totalCounts[2],
      activityDaily: totalCounts[3],
      stressDaily: totalCounts[4],
      resilienceDaily: totalCounts[5],
      heartRateEntries: totalCounts[6],
      spo2Daily: totalCounts[7],
      cardiovascularAge: totalCounts[8],
      vo2Max: totalCounts[9],
      workouts: totalCounts[10],
      sessions: totalCounts[11],
      tags: totalCounts[12],
      enhancedTags: totalCounts[13],
      sleepTime: totalCounts[14],
      restModePeriods: totalCounts[15],
      ringConfigs: totalCounts[16],
      syncSessions: totalCounts[17],
      insights: totalCounts[18],
      oauthTokens: totalCounts[19],
      personalInfo: totalCounts[20],
      gapPatterns: totalCounts[21],
      activityGaps: totalCounts[22],
    },
  }

  // Store in cache for 30 seconds
  statusCache = { data: responseData, expiresAt: Date.now() + 30_000 }

  return NextResponse.json(responseData)
}
