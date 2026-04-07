import { subMinutes } from "date-fns"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { fetchEndpoint } from "@/lib/oura/client"
import { getValidAccessToken } from "@/lib/oura/oauth"
import { NORMALIZERS } from "@/lib/oura/normalizers"
import { OURA_ENDPOINTS } from "@/lib/oura/endpoints"
import type { EndpointKey } from "@/lib/oura/endpoints"
import { OuraApiError } from "@/lib/oura/pagination"

export const NON_WEAR_THRESHOLD_SECONDS = 28_800 // 8 hours
export const STALE_SYNC_SESSION_MINUTES = 15

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
  recordsUnchanged: number
  recordsSkipped: number
  staleSessionsClosed: number
  warnings: SyncWarning[]
  unavailableEndpoints: string[]
  errors: Array<{ endpoint: string; message: string }>
}

interface UpsertResult {
  inserted: number
  updated: number
  unchanged: number
  skipped: number
}

type UpsertOutcome = "inserted" | "updated" | "unchanged" | "skipped"

type ModelDelegate = {
  findUnique(args: { where: Record<string, unknown> }): Promise<unknown>
  create(args: { data: unknown }): Promise<unknown>
  update(args: { where: Record<string, unknown>; data: unknown }): Promise<unknown>
}

export function categorizeEndpointError(
  endpoint: string,
  err: unknown,
  warnings: SyncWarning[],
  unavailableEndpoints: string[],
  errors: Array<{ endpoint: string; message: string }>,
): void {
  const isOptional404 =
    err instanceof OuraApiError &&
    err.status === 404 &&
    OURA_ENDPOINTS[endpoint as EndpointKey]?.availabilityPolicy === "optional"

  if (isOptional404) {
    warnings.push({
      endpoint,
      code: "unavailable",
      message: err instanceof Error ? err.message : String(err),
    })
    unavailableEndpoints.push(endpoint)
    return
  }

  errors.push({
    endpoint,
    message: err instanceof Error ? err.message : String(err),
  })
}

export function computeFinalStatus(
  errors: Array<{ endpoint: string; message: string }>,
  endpointCount: number,
): "success" | "partial" | "error" {
  if (errors.length === 0) return "success"
  if (errors.length < endpointCount) return "partial"
  return "error"
}

export async function closeStaleRunningSessions(now = new Date()): Promise<number> {
  const cutoff = subMinutes(now, STALE_SYNC_SESSION_MINUTES)
  const result = await prisma.ouraSyncSession.updateMany({
    where: {
      status: "running",
      finishedAt: null,
      startedAt: { lt: cutoff },
    },
    data: {
      status: "error",
      finishedAt: now,
      errorMessage: "Sync session abandoned before completion",
    },
  })

  return result.count
}

export async function syncEndpoints(options: SyncOptions): Promise<SyncResult> {
  const staleSessionsClosed = await closeStaleRunningSessions()

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
  let totalUnchanged = 0
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
        totalUnchanged += result.unchanged
        totalSkipped += result.skipped
      } catch (err) {
        categorizeEndpointError(
          endpoint,
          err,
          warnings,
          unavailableEndpoints,
          errors,
        )
      }
    }

    const finalStatus = computeFinalStatus(errors, options.endpoints.length)
    const detailPayload = buildSessionDetailPayload({
      errors,
      warnings,
      staleSessionsClosed,
      recordsUnchanged: totalUnchanged,
    })

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
        errorDetails: detailPayload,
        unavailableEndpoints,
      },
    })

    return {
      sessionId: session.id,
      status: finalStatus,
      recordsInserted: totalInserted,
      recordsUpdated: totalUpdated,
      recordsUnchanged: totalUnchanged,
      recordsSkipped: totalSkipped,
      staleSessionsClosed,
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
        errorDetails: buildSessionDetailPayload({
          errors: [{ endpoint: "session", message: err instanceof Error ? err.message : String(err) }],
          warnings,
          staleSessionsClosed,
          recordsUnchanged: totalUnchanged,
        }),
      },
    })
    throw err
  }
}

async function upsertEndpointData(
  endpoint: string,
  rawData: unknown[],
  normalizer: (raw: Record<string, unknown>) => Record<string, unknown> | null,
  force = false,
): Promise<UpsertResult> {
  let inserted = 0
  let updated = 0
  let unchanged = 0
  let skipped = 0

  for (const raw of rawData) {
    const normalized = normalizer(raw as Record<string, unknown>)
    if (!normalized) {
      skipped++
      continue
    }

    const result = await upsertRecord(endpoint, normalized, force)
    if (result === "inserted") inserted++
    else if (result === "updated") updated++
    else if (result === "unchanged") unchanged++
    else skipped++
  }

  return { inserted, updated, unchanged, skipped }
}

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
      return persistByUnique(
        prisma.ouraPersonalInfo,
        { ouraId },
        data as Prisma.OuraPersonalInfoCreateInput,
        data as Prisma.OuraPersonalInfoUpdateInput,
        force,
      )

    case "daily_sleep":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraSleepDaily,
        { ouraId },
        data as Prisma.OuraSleepDailyCreateInput,
        data as Prisma.OuraSleepDailyUpdateInput,
        force,
      )

    case "sleep":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraSleepPeriod,
        { ouraId },
        data as Prisma.OuraSleepPeriodCreateInput,
        data as Prisma.OuraSleepPeriodUpdateInput,
        force,
      )

    case "daily_readiness":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraReadinessDaily,
        { ouraId },
        data as Prisma.OuraReadinessDailyCreateInput,
        data as Prisma.OuraReadinessDailyUpdateInput,
        force,
      )

    case "daily_activity":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraActivityDaily,
        { ouraId },
        data as Prisma.OuraActivityDailyCreateInput,
        data as Prisma.OuraActivityDailyUpdateInput,
        force,
      )

    case "daily_stress":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraStressDaily,
        { ouraId },
        data as Prisma.OuraStressDailyCreateInput,
        data as Prisma.OuraStressDailyUpdateInput,
        force,
      )

    case "daily_resilience":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraResilienceDaily,
        { ouraId },
        data as Prisma.OuraResilienceDailyCreateInput,
        data as Prisma.OuraResilienceDailyUpdateInput,
        force,
      )

    case "heartrate":
      if (!timestamp) return "skipped"
      return persistByUnique(
        prisma.ouraHeartRateEntry,
        { timestamp },
        data as Prisma.OuraHeartRateEntryCreateInput,
        data as Prisma.OuraHeartRateEntryUpdateInput,
        force,
      )

    case "daily_spo2":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraSpo2Daily,
        { ouraId },
        data as Prisma.OuraSpo2DailyCreateInput,
        data as Prisma.OuraSpo2DailyUpdateInput,
        force,
      )

    case "daily_cardiovascular_age":
      if (!day) return "skipped"
      return persistByUnique(
        prisma.ouraCardiovascularAge,
        { day },
        data as Prisma.OuraCardiovascularAgeCreateInput,
        data as Prisma.OuraCardiovascularAgeUpdateInput,
        force,
      )

    case "vo2_max":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraVo2Max,
        { ouraId },
        data as Prisma.OuraVo2MaxCreateInput,
        data as Prisma.OuraVo2MaxUpdateInput,
        force,
      )

    case "workout":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraWorkout,
        { ouraId },
        data as Prisma.OuraWorkoutCreateInput,
        data as Prisma.OuraWorkoutUpdateInput,
        force,
      )

    case "session":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraSession,
        { ouraId },
        data as Prisma.OuraSessionCreateInput,
        data as Prisma.OuraSessionUpdateInput,
        force,
      )

    case "tag":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraTag,
        { ouraId },
        data as Prisma.OuraTagCreateInput,
        data as Prisma.OuraTagUpdateInput,
        force,
      )

    case "enhanced_tag":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraEnhancedTag,
        { ouraId },
        data as Prisma.OuraEnhancedTagCreateInput,
        data as Prisma.OuraEnhancedTagUpdateInput,
        force,
      )

    case "sleep_time":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraSleepTime,
        { ouraId },
        data as Prisma.OuraSleepTimeCreateInput,
        data as Prisma.OuraSleepTimeUpdateInput,
        force,
      )

    case "rest_mode_period":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraRestModePeriod,
        { ouraId },
        data as Prisma.OuraRestModePeriodCreateInput,
        data as Prisma.OuraRestModePeriodUpdateInput,
        force,
      )

    case "ring_configuration":
      if (!ouraId) return "skipped"
      return persistByUnique(
        prisma.ouraRingConfig,
        { ouraId },
        data as Prisma.OuraRingConfigCreateInput,
        data as Prisma.OuraRingConfigUpdateInput,
        force,
      )

    default:
      return "skipped"
  }
}

async function persistByUnique(
  delegate: ModelDelegate,
  where: Record<string, unknown>,
  createData: unknown,
  updateData: unknown,
  force: boolean,
): Promise<UpsertOutcome> {
  if (!force) {
    try {
      await delegate.create({ data: createData })
      return "inserted"
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return "unchanged"
      }
      throw error
    }
  }

  const existing = await delegate.findUnique({ where })
  if (existing) {
    await delegate.update({ where, data: updateData })
    return "updated"
  }

  try {
    await delegate.create({ data: createData })
    return "inserted"
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error
    }

    await delegate.update({ where, data: updateData })
    return "updated"
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
}

function buildSessionDetailPayload({
  errors,
  warnings,
  staleSessionsClosed,
  recordsUnchanged,
}: {
  errors: Array<{ endpoint: string; message: string }>
  warnings: SyncWarning[]
  staleSessionsClosed: number
  recordsUnchanged: number
}): Prisma.InputJsonValue | undefined {
  const payload = {
    ...(errors.length > 0 ? { errors } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(staleSessionsClosed > 0 ? { staleSessionsClosed } : {}),
    ...(recordsUnchanged > 0 ? { recordsUnchanged } : {}),
  }

  return Object.keys(payload).length > 0
    ? (payload as Prisma.InputJsonValue)
    : undefined
}
