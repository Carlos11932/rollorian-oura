export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { validateInternalApiKey } from "@/lib/auth"

export async function GET(request: NextRequest) {
  if (!validateInternalApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
      prisma.ouraReadinessDaily.count(),
      prisma.ouraActivityDaily.count(),
      prisma.ouraHeartRateEntry.count(),
    ]),
  ])

  return NextResponse.json({
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
      readinessDaily: totalCounts[1],
      activityDaily: totalCounts[2],
      heartRateEntries: totalCounts[3],
    },
  })
}
