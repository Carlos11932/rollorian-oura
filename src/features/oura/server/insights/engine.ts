import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { OuraInsight } from "@prisma/client"
import {
  getRawSleepDaily,
  getRawSleepTrend,
  getRawReadiness,
  getRawStressDaily,
  getRawResilienceDaily,
} from "@/features/oura/server/data"
import { insightRules } from "./rules"
import type { DayContext } from "./rules"

// ─── Constants ────────────────────────────────────────────────────────────────

const GENERATED_BY = "rules/context-api"
const STALE_HOURS = 6

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedInsight {
  insightType: string
  severity: "info" | "warning" | "alert"
  title: string
  message: string
  metadata?: Record<string, unknown>
}

export type StoredInsight = OuraInsight

// ─── Severity ordering ────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  alert: 0,
  warning: 1,
  info: 2,
}

function bySeverity(a: OuraInsight, b: OuraInsight): number {
  const aOrder = SEVERITY_ORDER[a.severity] ?? 99
  const bOrder = SEVERITY_ORDER[b.severity] ?? 99
  return aOrder - bOrder
}

// ─── Staleness check ─────────────────────────────────────────────────────────

function isStale(insight: OuraInsight): boolean {
  const ageMs = Date.now() - insight.createdAt.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  return ageHours > STALE_HOURS
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Fetch all data needed for insight evaluation, evaluate all rules,
 * upsert results into DB (deleteMany + createMany for the day), and return the generated insights.
 */
export async function generateInsights(day: string): Promise<GeneratedInsight[]> {
  // Fetch all needed data in parallel
  const [sleepRows, readiness, stressRows, resilience, sleepTrend14d] =
    await Promise.all([
      getRawSleepDaily(day, day).catch(() => [] as Awaited<ReturnType<typeof getRawSleepDaily>>),
      getRawReadiness(day).catch(() => null),
      getRawStressDaily(day, day).catch(() => [] as Awaited<ReturnType<typeof getRawStressDaily>>),
      getRawResilienceDaily(day).catch(() => null),
      getRawSleepTrend(14).catch(() => [] as Awaited<ReturnType<typeof getRawSleepTrend>>),
    ])

  const sleep = sleepRows[0] ?? null
  const stress = stressRows[0] ?? null

  const context: DayContext = {
    day,
    sleep,
    readiness,
    stress,
    resilience,
    sleepTrend14d,
  }

  // Evaluate all rules — collect non-null results
  const candidates: GeneratedInsight[] = []
  for (const rule of insightRules) {
    try {
      const result = rule.evaluate(context)
      if (result != null) {
        candidates.push({
          insightType: rule.insightType,
          severity: rule.severity,
          title: result.title,
          message: result.message,
          metadata: result.metadata,
        })
      }
    } catch {
      // Rule evaluation must never crash the engine — skip silently
    }
  }

  // Upsert: delete all existing rule-generated insights for this day, then create new ones
  await prisma.$transaction([
    prisma.ouraInsight.deleteMany({
      where: { day, generatedBy: GENERATED_BY },
    }),
    ...(candidates.length > 0
      ? [
          prisma.ouraInsight.createMany({
            data: candidates.map((c) => ({
              day,
              insightType: c.insightType,
              severity: c.severity,
              title: c.title,
              message: c.message,
              metadata: c.metadata != null ? (c.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
              generatedBy: GENERATED_BY,
              acknowledged: false,
            })),
          }),
        ]
      : []),
  ])

  return candidates
}

/**
 * Retrieve stored insights for a given day from the database,
 * ordered by severity: alert > warning > info.
 */
export async function getStoredInsights(day: string): Promise<StoredInsight[]> {
  const rows = await prisma.ouraInsight.findMany({
    where: { day, generatedBy: GENERATED_BY },
  })
  return rows.sort(bySeverity)
}

/**
 * Check whether a day's stored insights are stale (older than 6 hours)
 * or missing entirely. Returns true if regeneration is needed.
 */
export async function areInsightsStale(day: string): Promise<boolean> {
  const latest = await prisma.ouraInsight.findFirst({
    where: { day, generatedBy: GENERATED_BY },
    orderBy: { createdAt: "desc" },
  })
  if (latest == null) return true
  return isStale(latest)
}
