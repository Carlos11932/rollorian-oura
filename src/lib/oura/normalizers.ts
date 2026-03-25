import type { Prisma } from "@/generated/prisma"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function toInt(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return isNaN(n) ? null : Math.round(n)
}

function toFloat(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return isNaN(n) ? null : n
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined
  return value as Prisma.InputJsonValue
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

export function normalizeSleepDaily(
  raw: Record<string, unknown>,
): Prisma.OuraSleepDailyCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  const contrib = (raw["contributors"] as Record<string, unknown>) ?? {}
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    score: toInt(raw["score"]),
    totalSleepSeconds: toInt(raw["total_sleep_duration"]),
    timeInBedSeconds: toInt(raw["time_in_bed"]),
    efficiency: toInt(raw["efficiency"]),
    latencySeconds: toInt(raw["latency"]),
    remSleepSeconds: toInt(raw["rem_sleep_duration"]),
    deepSleepSeconds: toInt(raw["deep_sleep_duration"]),
    lightSleepSeconds: toInt(raw["light_sleep_duration"]),
    awakeSeconds: toInt(raw["awake_time"]),
    restlessPeriods: toInt(raw["restless_periods"]),
    averageHeartRate: toFloat(raw["average_heart_rate"]),
    averageHrv: toFloat(raw["average_hrv"]),
    lowestHeartRate: toInt(raw["lowest_heart_rate"]),
    averageBreath: toFloat(raw["average_breath"]),
    bedtimeStart: parseDate(raw["bedtime_start"] as string),
    bedtimeEnd: parseDate(raw["bedtime_end"] as string),
    sleepType: raw["type"] ? String(raw["type"]) : null,
    contribDeepSleep: toInt(contrib["deep_sleep"]),
    contribEfficiency: toInt(contrib["efficiency"]),
    contribLatency: toInt(contrib["latency"]),
    contribRemSleep: toInt(contrib["rem_sleep"]),
    contribRestfulness: toInt(contrib["restfulness"]),
    contribTiming: toInt(contrib["timing"]),
    contribTotalSleep: toInt(contrib["total_sleep"]),
    confidence: "high",
  }
}

export function normalizeSleepPeriod(
  raw: Record<string, unknown>,
): Prisma.OuraSleepPeriodCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  const readiness = (raw["readiness"] as Record<string, unknown>) ?? {}
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    period: toInt(raw["period_id"]) ?? 0,
    bedtimeStart: parseDate(raw["bedtime_start"] as string) ?? new Date(),
    bedtimeEnd: parseDate(raw["bedtime_end"] as string) ?? new Date(),
    sleepType: raw["type"] ? String(raw["type"]) : "unknown",
    heartRateData: toJsonValue(raw["heart_rate"]),
    hrvData: toJsonValue(raw["hrv"]),
    movementData: raw["movement_30_sec"]
      ? String(raw["movement_30_sec"])
      : null,
    sleepPhaseData: raw["sleep_phase_5_min"]
      ? String(raw["sleep_phase_5_min"])
      : null,
    readinessScore: toInt(readiness["score"]),
    tempDeviation: toFloat(readiness["temperature_deviation"]),
    tempTrendDeviation: toFloat(readiness["temperature_trend_deviation"]),
  }
}

export function normalizeReadinessDaily(
  raw: Record<string, unknown>,
): Prisma.OuraReadinessDailyCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  const contrib = (raw["contributors"] as Record<string, unknown>) ?? {}
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    score: toInt(raw["score"]),
    temperatureDeviation: toFloat(raw["temperature_deviation"]),
    temperatureTrendDev: toFloat(raw["temperature_trend_deviation"]),
    contribActivityBalance: toInt(contrib["activity_balance"]),
    contribBodyTemperature: toInt(contrib["body_temperature"]),
    contribHrvBalance: toInt(contrib["hrv_balance"]),
    contribPrevDayActivity: toInt(contrib["previous_day_activity"]),
    contribPreviousNight: toInt(contrib["previous_night"]),
    contribRecoveryIndex: toInt(contrib["recovery_index"]),
    contribRestingHeartRate: toInt(contrib["resting_heart_rate"]),
    contribSleepBalance: toInt(contrib["sleep_balance"]),
    confidence: "high",
  }
}

export function normalizeActivityDaily(
  raw: Record<string, unknown>,
): Prisma.OuraActivityDailyCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  const contrib = (raw["contributors"] as Record<string, unknown>) ?? {}
  const nonWear = toInt(raw["non_wear_time"])
  const wearDuration = nonWear !== null ? 86400 - nonWear : null
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    score: toInt(raw["score"]),
    steps: toInt(raw["steps"]),
    activeCalories: toInt(raw["active_calories"]),
    totalCalories: toInt(raw["total_calories"]),
    targetCalories: toInt(raw["target_calories"]),
    equivalentWalkingDistance: toInt(raw["equivalent_walking_distance"]),
    highActivitySeconds: toInt(raw["high_activity_time"]),
    mediumActivitySeconds: toInt(raw["medium_activity_time"]),
    lowActivitySeconds: toInt(raw["low_activity_time"]),
    sedentarySeconds: toInt(raw["sedentary_time"]),
    restingSeconds: toInt(raw["resting_time"]),
    nonWearSeconds: nonWear,
    inactivityAlerts: toInt(raw["inactivity_alerts"]),
    highActivityMet: toFloat(raw["high_activity_met_minutes"]),
    mediumActivityMet: toFloat(raw["medium_activity_met_minutes"]),
    lowActivityMet: toFloat(raw["low_activity_met_minutes"]),
    contribMeetTargets: toInt(contrib["meet_daily_targets"]),
    contribMoveEveryHour: toInt(contrib["move_every_hour"]),
    contribRecoveryTime: toInt(contrib["recovery_time"]),
    contribStayActive: toInt(contrib["stay_active"]),
    contribTrainingFrequency: toInt(contrib["training_frequency"]),
    contribTrainingVolume: toInt(contrib["training_volume"]),
    metData: toJsonValue(raw["met"]),
    classData: raw["class_5_min"] ? String(raw["class_5_min"]) : null,
    wearDurationSeconds: wearDuration,
    confidence: "low",
  }
}

export function normalizeStressDaily(
  raw: Record<string, unknown>,
): Prisma.OuraStressDailyCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    stressHighSeconds: toInt(raw["stress_high"]),
    recoveryHighSeconds: toInt(raw["recovery_high"]),
    daySummary: raw["day_summary"] ? String(raw["day_summary"]) : null,
    confidence: "medium",
  }
}

export function normalizeResilienceDaily(
  raw: Record<string, unknown>,
): Prisma.OuraResilienceDailyCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  const contrib = (raw["contributors"] as Record<string, unknown>) ?? {}
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    level: raw["level"] ? String(raw["level"]) : null,
    contribSleepRecovery: toInt(contrib["sleep_recovery"]),
    contribDaytimeRecovery: toInt(contrib["daytime_recovery"]),
    contribStress: toInt(contrib["stress"]),
  }
}

export function normalizeHeartRateEntry(
  raw: Record<string, unknown>,
): Prisma.OuraHeartRateEntryCreateInput | null {
  if (!raw["timestamp"] || !raw["bpm"]) return null
  const timestamp = parseDate(raw["timestamp"] as string)
  if (!timestamp) return null
  const day = (raw["timestamp"] as string).substring(0, 10)
  return {
    timestamp,
    bpm: toInt(raw["bpm"]) ?? 0,
    source: raw["source"] ? String(raw["source"]) : null,
    day,
  }
}

export function normalizeSpo2Daily(
  raw: Record<string, unknown>,
): Prisma.OuraSpo2DailyCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  const spo2 = raw["spo2_percentage"] as Record<string, unknown> | null
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    spo2Average: toFloat(spo2?.["average"] ?? raw["average"]),
  }
}

export function normalizeCardiovascularAge(
  raw: Record<string, unknown>,
): Prisma.OuraCardiovascularAgeCreateInput | null {
  if (!raw["day"]) return null
  return {
    day: String(raw["day"]),
    vascularAge: toInt(raw["vascular_age"]),
  }
}

export function normalizeVo2Max(
  raw: Record<string, unknown>,
): Prisma.OuraVo2MaxCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    vo2Max: toFloat(raw["vo2_max"]),
  }
}

export function normalizeWorkout(
  raw: Record<string, unknown>,
): Prisma.OuraWorkoutCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    activity: raw["activity"] ? String(raw["activity"]) : null,
    calories: toFloat(raw["calories"]),
    distance: toFloat(raw["distance"]),
    startDatetime: parseDate(raw["start_datetime"] as string),
    endDatetime: parseDate(raw["end_datetime"] as string),
    intensity: raw["intensity"] ? String(raw["intensity"]) : null,
    label: raw["label"] ? String(raw["label"]) : null,
    source: raw["source"] ? String(raw["source"]) : null,
  }
}

export function normalizeSession(
  raw: Record<string, unknown>,
): Prisma.OuraSessionCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    sessionType: raw["type"] ? String(raw["type"]) : null,
    startDatetime: parseDate(raw["start_datetime"] as string),
    endDatetime: parseDate(raw["end_datetime"] as string),
    mood: raw["mood"] ? String(raw["mood"]) : null,
    heartRateData: toJsonValue(raw["heart_rate"]),
    hrvData: toJsonValue(raw["hrv"]),
    motionCountData: toJsonValue(raw["motion_count"]),
  }
}

export function normalizeTag(
  raw: Record<string, unknown>,
): Prisma.OuraTagCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  const tags = Array.isArray(raw["tags"])
    ? raw["tags"].map(String)
    : raw["tag_type_code"]
      ? [String(raw["tag_type_code"])]
      : []
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    timestamp: parseDate(raw["timestamp"] as string),
    tags,
    text: raw["text"] ? String(raw["text"]) : null,
  }
}

export function normalizeEnhancedTag(
  raw: Record<string, unknown>,
): Prisma.OuraEnhancedTagCreateInput | null {
  if (!raw["id"] || !raw["start_day"]) return null
  return {
    ouraId: String(raw["id"]),
    tagTypeCode: raw["tag_type_code"] ? String(raw["tag_type_code"]) : null,
    customName: raw["custom_name"] ? String(raw["custom_name"]) : null,
    startDay: String(raw["start_day"]),
    endDay: raw["end_day"] ? String(raw["end_day"]) : null,
    startTime: parseDate(raw["start_time"] as string),
    endTime: parseDate(raw["end_time"] as string),
    comment: raw["comment"] ? String(raw["comment"]) : null,
  }
}

export function normalizeSleepTime(
  raw: Record<string, unknown>,
): Prisma.OuraSleepTimeCreateInput | null {
  if (!raw["id"] || !raw["day"]) return null
  const optimal = (raw["optimal_bedtime"] as Record<string, unknown>) ?? {}
  return {
    ouraId: String(raw["id"]),
    day: String(raw["day"]),
    optimalBedtimeStart: toInt(optimal["start_offset"]),
    optimalBedtimeEnd: toInt(optimal["end_offset"]),
    optimalBedtimeTz: toInt(optimal["day_tz"]),
    recommendation: raw["recommendation"] ? String(raw["recommendation"]) : null,
    status: raw["status"] ? String(raw["status"]) : null,
  }
}

export function normalizeRestModePeriod(
  raw: Record<string, unknown>,
): Prisma.OuraRestModePeriodCreateInput | null {
  if (!raw["id"] || !raw["start_day"]) return null
  return {
    ouraId: String(raw["id"]),
    startDay: String(raw["start_day"]),
    endDay: raw["end_day"] ? String(raw["end_day"]) : null,
    startTime: parseDate(raw["start_datetime"] as string),
    endTime: parseDate(raw["end_datetime"] as string),
    episodes: toJsonValue(raw["episodes"]),
  }
}

export function normalizeRingConfig(
  raw: Record<string, unknown>,
): Prisma.OuraRingConfigCreateInput | null {
  if (!raw["id"]) return null
  return {
    ouraId: String(raw["id"]),
    color: raw["color"] ? String(raw["color"]) : null,
    design: raw["design"] ? String(raw["design"]) : null,
    firmwareVersion: raw["firmware_version"]
      ? String(raw["firmware_version"])
      : null,
    hardwareType: raw["hardware_type"] ? String(raw["hardware_type"]) : null,
    setUpAt: parseDate(raw["set_up_at"] as string),
    size: toInt(raw["size"]),
  }
}

// ─── Normalizer Map ───────────────────────────────────────────────────────────

export type NormalizerFn = (
  raw: Record<string, unknown>,
) => Record<string, unknown> | null

export const NORMALIZERS: Partial<Record<string, NormalizerFn>> = {
  daily_sleep: normalizeSleepDaily as NormalizerFn,
  sleep: normalizeSleepPeriod as NormalizerFn,
  daily_readiness: normalizeReadinessDaily as NormalizerFn,
  daily_activity: normalizeActivityDaily as NormalizerFn,
  daily_stress: normalizeStressDaily as NormalizerFn,
  daily_resilience: normalizeResilienceDaily as NormalizerFn,
  heartrate: normalizeHeartRateEntry as NormalizerFn,
  daily_spo2: normalizeSpo2Daily as NormalizerFn,
  daily_cardiovascular_age: normalizeCardiovascularAge as NormalizerFn,
  vo2_max: normalizeVo2Max as NormalizerFn,
  workout: normalizeWorkout as NormalizerFn,
  session: normalizeSession as NormalizerFn,
  tag: normalizeTag as NormalizerFn,
  enhanced_tag: normalizeEnhancedTag as NormalizerFn,
  sleep_time: normalizeSleepTime as NormalizerFn,
  rest_mode_period: normalizeRestModePeriod as NormalizerFn,
  ring_configuration: normalizeRingConfig as NormalizerFn,
}
