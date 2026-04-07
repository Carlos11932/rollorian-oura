export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateInternalApiKey } from "@/lib/auth"
import { Prisma } from "@prisma/client"
import { subMinutes } from "date-fns"
import { STALE_SYNC_SESSION_MINUTES } from "@/features/oura/server/sync-engine"

// ─── In-memory cache + single-flight (stampede protection) ──────────────────
//
// NOTE: This cache is per-process. In a serverless environment (e.g. Vercel)
// each cold start gets a fresh instance — the cache only helps within the
// lifetime of a warm instance. That is acceptable: the goal is to coalesce
// concurrent requests hitting the same warm instance, not cross-instance
// sharing (which would require an external store like Redis/KV).
//
// Single-flight: if multiple requests arrive while a DB fetch is in progress,
// they all await the same Promise instead of firing N parallel queries.

interface CacheEntry {
  data: unknown
  expiresAt: number
}

let statusCache: CacheEntry | null = null
// Holds the in-flight DB query so concurrent requests can share it.
let inflight: Promise<unknown> | null = null

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Return cached result if still fresh (avoids DB entirely).
  if (statusCache !== null && Date.now() < statusCache.expiresAt) {
    return NextResponse.json(statusCache.data)
  }

  // Single-flight: reuse an already-running DB query if one is in progress.
  if (!inflight) {
    inflight = computeStatus().finally(() => {
      inflight = null
    })
  }

  const data = await inflight
  // Update cache — multiple concurrent waiters will each write the same value,
  // which is harmless (last writer wins, all values are identical).
  statusCache = { data, expiresAt: Date.now() + 30_000 }

  return NextResponse.json(data)
}

async function computeStatus() {
  const staleThreshold = subMinutes(new Date(), STALE_SYNC_SESSION_MINUTES)

  const [lastSession, lastFinishedSession, tokenExists, sessionCounts, coverageCounts, totalCounts] = await Promise.all([
    prisma.ouraSyncSession.findFirst({
      orderBy: { startedAt: "desc" },
    }),
    prisma.ouraSyncSession.findFirst({
      where: { finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
    }),
    prisma.ouraOAuthToken
      .findUnique({ where: { id: "singleton" } })
      .then(Boolean),
    Promise.all([
      prisma.ouraSyncSession.count({ where: { status: "success" } }),
      prisma.ouraSyncSession.count({ where: { status: "partial" } }),
      prisma.ouraSyncSession.count({ where: { status: "error" } }),
      prisma.ouraSyncSession.count({ where: { status: "running", finishedAt: null } }),
      prisma.ouraSyncSession.count({
        where: {
          status: "running",
          finishedAt: null,
          startedAt: { lt: staleThreshold },
        },
      }),
    ]),
    Promise.all([
      prisma.ouraSleepDaily.count({ where: { totalSleepSeconds: { not: null } } }),
      prisma.ouraSleepDaily.count({ where: { averageHrv: { not: null } } }),
      prisma.ouraSleepPeriod.count({ where: { heartRateData: { not: Prisma.JsonNull } } }),
      prisma.ouraSpo2Daily.count({ where: { spo2Average: { not: null } } }),
      prisma.ouraVo2Max.count({ where: { vo2Max: { not: null } } }),
    ]),
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
    lastSync: lastFinishedSession
      ? {
          id: lastFinishedSession.id,
          status: lastFinishedSession.status,
          startedAt: lastFinishedSession.startedAt,
          finishedAt: lastFinishedSession.finishedAt,
          recordsInserted: lastFinishedSession.recordsInserted,
          recordsUpdated: lastFinishedSession.recordsUpdated,
          source: lastFinishedSession.source,
        }
      : null,
    latestSession: lastSession
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
    sessionHealth: {
      success: sessionCounts[0],
      partial: sessionCounts[1],
      error: sessionCounts[2],
      running: sessionCounts[3],
      staleRunning: sessionCounts[4],
    },
    coverage: {
      sleepWithDuration: coverageCounts[0],
      sleepWithHrv: coverageCounts[1],
      sleepPeriodsWithHeartRate: coverageCounts[2],
      spo2Available: coverageCounts[3],
      vo2Available: coverageCounts[4],
    },
    featureAvailability: {
      gapTrackingActive: totalCounts[21] > 0 || totalCounts[22] > 0,
      restModeAvailable: totalCounts[15] > 0,
      ringConfigAvailable: totalCounts[16] > 0,
      vo2Available: coverageCounts[4] > 0,
      spo2Available: coverageCounts[3] > 0,
    },
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

  return responseData
}
