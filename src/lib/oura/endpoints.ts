export type EndpointKey =
  | "personal_info"
  | "daily_activity"
  | "daily_readiness"
  | "daily_sleep"
  | "daily_spo2"
  | "daily_stress"
  | "daily_resilience"
  | "daily_cardiovascular_age"
  | "vo2_max"
  | "sleep"
  | "sleep_time"
  | "heartrate"
  | "session"
  | "workout"
  | "tag"
  | "enhanced_tag"
  | "rest_mode_period"
  | "ring_configuration"

export type DateParamType = "date" | "datetime" | "none"

export interface EndpointConfig {
  path: string
  dateParamType: DateParamType
  scope: string
  requiresChunking: boolean
  chunkDays?: number
  isPaginated: boolean
}

export const OURA_ENDPOINTS: Record<EndpointKey, EndpointConfig> = {
  personal_info: {
    path: "personal_info",
    dateParamType: "none",
    scope: "personal",
    requiresChunking: false,
    isPaginated: false,
  },
  daily_activity: {
    path: "daily_activity",
    dateParamType: "date",
    scope: "daily",
    requiresChunking: false,
    isPaginated: true,
  },
  daily_readiness: {
    path: "daily_readiness",
    dateParamType: "date",
    scope: "daily",
    requiresChunking: false,
    isPaginated: true,
  },
  daily_sleep: {
    path: "daily_sleep",
    dateParamType: "date",
    scope: "daily",
    requiresChunking: false,
    isPaginated: true,
  },
  daily_spo2: {
    path: "daily_spo2",
    dateParamType: "date",
    scope: "spo2",
    requiresChunking: false,
    isPaginated: true,
  },
  daily_stress: {
    path: "daily_stress",
    dateParamType: "date",
    scope: "daily",
    requiresChunking: false,
    isPaginated: true,
  },
  daily_resilience: {
    path: "daily_resilience",
    dateParamType: "date",
    scope: "stress",
    requiresChunking: false,
    isPaginated: true,
  },
  daily_cardiovascular_age: {
    path: "daily_cardiovascular_age",
    dateParamType: "date",
    scope: "heart_health",
    requiresChunking: false,
    isPaginated: true,
  },
  vo2_max: {
    path: "vo2_max",
    dateParamType: "date",
    scope: "daily",
    requiresChunking: false,
    isPaginated: true,
  },
  sleep: {
    path: "sleep",
    dateParamType: "date",
    scope: "daily",
    requiresChunking: false,
    isPaginated: true,
  },
  sleep_time: {
    path: "sleep_time",
    dateParamType: "date",
    scope: "daily",
    requiresChunking: false,
    isPaginated: true,
  },
  heartrate: {
    path: "heartrate",
    dateParamType: "datetime",
    scope: "heartrate",
    requiresChunking: true,
    chunkDays: 30,
    isPaginated: true,
  },
  session: {
    path: "session",
    dateParamType: "date",
    scope: "session",
    requiresChunking: false,
    isPaginated: true,
  },
  workout: {
    path: "workout",
    dateParamType: "date",
    scope: "workout",
    requiresChunking: false,
    isPaginated: true,
  },
  tag: {
    path: "tag",
    dateParamType: "date",
    scope: "tag",
    requiresChunking: false,
    isPaginated: true,
  },
  enhanced_tag: {
    path: "enhanced_tag",
    dateParamType: "date",
    scope: "tag",
    requiresChunking: false,
    isPaginated: true,
  },
  rest_mode_period: {
    path: "rest_mode_period",
    dateParamType: "date",
    scope: "daily",
    requiresChunking: false,
    isPaginated: true,
  },
  ring_configuration: {
    path: "ring_configuration",
    dateParamType: "none",
    scope: "ring_configuration",
    requiresChunking: false,
    isPaginated: false,
  },
}

export const ALL_SYNCABLE_ENDPOINTS: EndpointKey[] = Object.keys(
  OURA_ENDPOINTS,
) as EndpointKey[]

export const DAILY_SYNC_ENDPOINTS: EndpointKey[] = [
  "daily_sleep",
  "daily_readiness",
  "daily_activity",
  "daily_stress",
  "daily_resilience",
  "daily_spo2",
  "daily_cardiovascular_age",
  "sleep",
  "sleep_time",
  "heartrate",
  "workout",
  "session",
  "tag",
  "enhanced_tag",
  "rest_mode_period",
]
