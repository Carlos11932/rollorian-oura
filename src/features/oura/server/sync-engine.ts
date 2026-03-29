import { prisma } from "@/lib/prisma"
import { fetchEndpoint } from "@/lib/oura/client"
import { getValidAccessToken } from "@/lib/oura/oauth"
import { NORMALIZERS } from "@/lib/oura/normalizers"
import { OURA_ENDPOINTS } from "@/lib/oura/endpoints"
import type { EndpointKey } from "@/lib/oura/endpoints"
import { OuraApiError } from "@/lib/oura/pagination"

export const NON_WEAR_THRESHOLD_SECONDS = 28_800 // 8 hours

export interface SyncOptions {
  endpoints: EndpointKey[]
  startDate: string
  endDate: string
  force?: boolean
  source?: string
}

export type SyncWarning = { endpoint: string; code: "unavailable"; message: string }

export interface SyncResult {
  sessionId: string
  status: "success" | "partial" | "error"
  recordsInserted: number
  recordsUpdated: number
  recordsSkipped: number
  warnings: SyncWarning[]
  unavailableEndpoints: string[]
  errors: Array<{ endpoint: string; message: string }>
}

export async function syncEndpoints(options: SyncOptions): Promise<SyncResult> {
  const session = await prisma.ouraSyncSession.create({
    data: {
      status: "running",
      source: options.source ?? "manual",
      endpoints: options.endpoints,
      windowStart: options.startDate,
      windowEnd: options.endDate,
    },
  })

  let totalInserted = 0
  let totalUpdated = 0
  let totalSkipped = 0
  const errors: Array<{ endpoint: string; message: string }> = []
  const warnings: SyncWarning[] = []
  const unavailableEndpoints: string[] = []

  try {
    const accessToken = await getValidAccessToken()

    for (const endpoint of options.endpoints) {
      try {
        const { data } = await fetchEndpoint({
          accessToken,
          endpoint,
          startDate: options.startDate,
          endDate: options.endDate,
        })

        const normalizer = NORMALIZERS[endpoint]
        if (!normalizer) {
          errors.push({ endpoint, message: "No normalizer found" })
          continue
        }

        const result = await upsertEndpointData(
          endpoint,
          data,
          normalizer,
          options.force,
        )
        totalInserted += result.inserted
        totalUpdated += result.updated
        totalSkipped += result.skipped
      } catch (err) {
        const isOptional404 =
          err instanceof OuraApiError &&
          err.status === 404 &&
          OURA_ENDPOINTS[endpoint]?.availabilityPolicy === "optional"

        if (isOptional404) {
          warnings.push({
            endpoint,
            code: "unavailable",
            message: err instanceof Error ? err.message : String(err),
          })
          unavailableEndpoints.push(endpoint)
        } else {
          errors.push({
            endpoint,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    }

    const finalStatus =
      errors.length === 0
        ? "success"
        : errors.length < options.endpoints.length
          ? "partial"
          : "error"

    await prisma.ouraSyncSession.update({
      where: { id: session.id },
      data: {
        status: finalStatus,
        finishedAt: new Date(),
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        recordsSkipped: totalSkipped,
        errorMessage:
          errors.length > 0
            ? errors.map((e) => `${e.endpoint}: ${e.message}`).join("; ")
            : null,
        errorDetails:
          errors.length > 0
            ? (errors as unknown as import("@prisma/client").Prisma.InputJsonValue)
            : undefined,
        unavailableEndpoints: unavailableEndpoints,
      },
    })

    return {
      sessionId: session.id,
      status: finalStatus,
      recordsInserted: totalInserted,
      recordsUpdated: totalUpdated,
      recordsSkipped: totalSkipped,
      warnings,
      unavailableEndpoints,
      errors,
    }
  } catch (err) {
    await prisma.ouraSyncSession.update({
      where: { id: session.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    })
    throw err
  }
}

interface UpsertResult {
  inserted: number
  updated: number
  skipped: number
}

async function upsertEndpointData(
  endpoint: string,
  rawData: unknown[],
  normalizer: (raw: Record<string, unknown>) => Record<string, unknown> | null,
  force = false,
): Promise<UpsertResult> {
  let inserted = 0
  let updated = 0
  let skipped = 0

  for (const raw of rawData) {
    const normalized = normalizer(raw as Record<string, unknown>)
    if (!normalized) {
      skipped++
      continue
    }

    try {
      const result = await upsertRecord(endpoint, normalized, force)
      if (result === "inserted") inserted++
      else if (result === "updated") updated++
      else skipped++
    } catch {
      skipped++
    }
  }

  return { inserted, updated, skipped }
}

type UpsertOutcome = "inserted" | "updated" | "skipped"

async function upsertRecord(
  endpoint: string,
  data: Record<string, unknown>,
  force: boolean,
): Promise<UpsertOutcome> {
  const ouraId = data["ouraId"] as string | undefined
  const day = data["day"] as string | undefined
  const timestamp = data["timestamp"] as Date | undefined

  switch (endpoint) {
    case "personal_info":
      if (!ouraId) return "skipped"
      await prisma.ouraPersonalInfo.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraPersonalInfoCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraPersonalInfoUpdateInput)
          : {},
      })
      return force ? "updated" : "inserted"

    case "daily_sleep":
      if (!ouraId) return "skipped"
      await prisma.ouraSleepDaily.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraSleepDailyCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraSleepDailyUpdateInput)
          : {},
      })
      return force ? "updated" : "inserted"

    case "sleep":
      if (!ouraId) return "skipped"
      await prisma.ouraSleepPeriod.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraSleepPeriodCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraSleepPeriodUpdateInput)
          : {},
      })
      return "inserted"

    case "daily_readiness":
      if (!ouraId) return "skipped"
      await prisma.ouraReadinessDaily.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraReadinessDailyCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraReadinessDailyUpdateInput)
          : {},
      })
      return "inserted"

    case "daily_activity":
      if (!ouraId) return "skipped"
      await prisma.ouraActivityDaily.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraActivityDailyCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraActivityDailyUpdateInput)
          : {},
      })
      return "inserted"

    case "daily_stress":
      if (!ouraId) return "skipped"
      await prisma.ouraStressDaily.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraStressDailyCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraStressDailyUpdateInput)
          : {},
      })
      return "inserted"

    case "daily_resilience":
      if (!ouraId) return "skipped"
      await prisma.ouraResilienceDaily.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraResilienceDailyCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraResilienceDailyUpdateInput)
          : {},
      })
      return "inserted"

    case "heartrate":
      if (!timestamp) return "skipped"
      await prisma.ouraHeartRateEntry.upsert({
        where: { timestamp },
        create: data as import("@prisma/client").Prisma.OuraHeartRateEntryCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraHeartRateEntryUpdateInput)
          : {},
      })
      return "inserted"

    case "daily_spo2":
      if (!ouraId) return "skipped"
      await prisma.ouraSpo2Daily.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraSpo2DailyCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraSpo2DailyUpdateInput)
          : {},
      })
      return "inserted"

    case "daily_cardiovascular_age":
      if (!day) return "skipped"
      await prisma.ouraCardiovascularAge.upsert({
        where: { day },
        create: data as import("@prisma/client").Prisma.OuraCardiovascularAgeCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraCardiovascularAgeUpdateInput)
          : {},
      })
      return "inserted"

    case "vo2_max":
      if (!ouraId) return "skipped"
      await prisma.ouraVo2Max.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraVo2MaxCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraVo2MaxUpdateInput)
          : {},
      })
      return "inserted"

    case "workout":
      if (!ouraId) return "skipped"
      await prisma.ouraWorkout.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraWorkoutCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraWorkoutUpdateInput)
          : {},
      })
      return "inserted"

    case "session":
      if (!ouraId) return "skipped"
      await prisma.ouraSession.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraSessionCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraSessionUpdateInput)
          : {},
      })
      return "inserted"

    case "tag":
      if (!ouraId) return "skipped"
      await prisma.ouraTag.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraTagCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraTagUpdateInput)
          : {},
      })
      return "inserted"

    case "enhanced_tag":
      if (!ouraId) return "skipped"
      await prisma.ouraEnhancedTag.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraEnhancedTagCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraEnhancedTagUpdateInput)
          : {},
      })
      return "inserted"

    case "sleep_time":
      if (!ouraId) return "skipped"
      await prisma.ouraSleepTime.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraSleepTimeCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraSleepTimeUpdateInput)
          : {},
      })
      return "inserted"

    case "rest_mode_period":
      if (!ouraId) return "skipped"
      await prisma.ouraRestModePeriod.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraRestModePeriodCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraRestModePeriodUpdateInput)
          : {},
      })
      return "inserted"

    case "ring_configuration":
      if (!ouraId) return "skipped"
      await prisma.ouraRingConfig.upsert({
        where: { ouraId },
        create: data as import("@prisma/client").Prisma.OuraRingConfigCreateInput,
        update: force
          ? (data as import("@prisma/client").Prisma.OuraRingConfigUpdateInput)
          : {},
      })
      return "inserted"

    default:
      return "skipped"
  }
}
