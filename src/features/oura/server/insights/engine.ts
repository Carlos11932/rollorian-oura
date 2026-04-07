import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { OuraInsight } from "@prisma/client"
import { getRawResilienceDaily } from "@/features/oura/server/data"
import {
  getDailyHealthSnapshot,
  getDailyHealthTrend,
} from "@/features/oura/server/health-snapshot"
import { insightRules } from "./rules"
import type { DayContext } from "./rules"

const GENERATED_BY = "rules/context-api"
const STALE_HOURS = 6

export interface GeneratedInsight {
  insightType: string
  severity: "info" | "warning" | "alert"
  title: string
  message: string
  metadata?: Record<string, unknown>
}

export type StoredInsight = OuraInsight

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

function byGeneratedSeverity(a: GeneratedInsight, b: GeneratedInsight): number {
  const aOrder = SEVERITY_ORDER[a.severity] ?? 99
  const bOrder = SEVERITY_ORDER[b.severity] ?? 99
  return aOrder - bOrder
}

function isStale(insight: OuraInsight): boolean {
  const ageMs = Date.now() - insight.createdAt.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  return ageHours > STALE_HOURS
}

function dedupeInsights(insights: GeneratedInsight[]): GeneratedInsight[] {
  const deduped = new Map<string, GeneratedInsight>()
  for (const insight of insights) {
    deduped.set(`${insight.insightType}:${insight.title}`, insight)
  }
  return Array.from(deduped.values()).sort(byGeneratedSeverity)
}

export async function generateInsights(day: string): Promise<GeneratedInsight[]> {
  const [snapshot, trend14d, resilience] = await Promise.all([
    getDailyHealthSnapshot(day),
    getDailyHealthTrend(14),
    getRawResilienceDaily(day).catch(() => null),
  ])

  const context: DayContext = {
    day,
    snapshot,
    trend14d,
    resilience,
  }

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
    } catch (error) {
      console.error(`[insights] Rule ${rule.id} failed:`, error)
    }
  }

  const insights = dedupeInsights(candidates)

  await prisma.$transaction(async (tx) => {
    await tx.ouraInsight.deleteMany({ where: { day, generatedBy: GENERATED_BY } })
    if (insights.length > 0) {
      await tx.ouraInsight.createMany({
        data: insights.map((insight) => ({
          day,
          insightType: insight.insightType,
          severity: insight.severity,
          title: insight.title,
          message: insight.message,
          metadata:
            insight.metadata != null
              ? (insight.metadata as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          generatedBy: GENERATED_BY,
          acknowledged: false,
        })),
      })
    }
  })

  return insights
}

export async function getStoredInsights(day: string): Promise<StoredInsight[]> {
  const rows = await prisma.ouraInsight.findMany({
    where: { day, generatedBy: GENERATED_BY },
  })
  return rows.sort(bySeverity)
}

export async function areInsightsStale(day: string): Promise<boolean> {
  const latest = await prisma.ouraInsight.findFirst({
    where: { day, generatedBy: GENERATED_BY },
    orderBy: { createdAt: "desc" },
  })

  if (latest == null) return true
  return isStale(latest)
}
