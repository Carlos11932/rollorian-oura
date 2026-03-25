import { addDays, format, parseISO } from "date-fns"
import { OURA_ENDPOINTS, type EndpointKey } from "./endpoints"
import { fetchAllPages, OuraApiError } from "./pagination"

const OURA_BASE_URL = "https://api.ouraring.com/v2/usercollection"

export interface FetchEndpointOptions {
  accessToken: string
  endpoint: EndpointKey
  startDate?: string
  endDate?: string
}

export interface FetchEndpointResult<T = unknown> {
  data: T[]
  endpoint: EndpointKey
}

export async function fetchEndpoint<T>(
  options: FetchEndpointOptions,
): Promise<FetchEndpointResult<T>> {
  const config = OURA_ENDPOINTS[options.endpoint]

  if (config.dateParamType === "none") {
    const res = await fetch(`${OURA_BASE_URL}/${config.path}`, {
      headers: { Authorization: `Bearer ${options.accessToken}` },
    })
    if (!res.ok) {
      throw new OuraApiError(res.status, await res.text(), config.path)
    }
    const data = (await res.json()) as T
    return { data: [data], endpoint: options.endpoint }
  }

  if (config.requiresChunking && options.startDate && options.endDate) {
    return fetchHeartRateChunked<T>(options)
  }

  const url = new URL(`${OURA_BASE_URL}/${config.path}`)
  if (options.startDate) url.searchParams.set("start_date", options.startDate)
  if (options.endDate) url.searchParams.set("end_date", options.endDate)

  const data = await fetchWithRetry<T>(url.toString(), options.accessToken)
  return { data, endpoint: options.endpoint }
}

async function fetchHeartRateChunked<T>(
  options: FetchEndpointOptions,
): Promise<FetchEndpointResult<T>> {
  if (!options.startDate || !options.endDate) {
    return { data: [], endpoint: options.endpoint }
  }

  const allData: T[] = []
  const config = OURA_ENDPOINTS[options.endpoint]
  const chunkDays = config.chunkDays ?? 30

  let current = parseISO(options.startDate)
  const end = parseISO(options.endDate)

  while (current <= end) {
    const chunkEnd = addDays(current, chunkDays - 1)
    const actualEnd = chunkEnd > end ? end : chunkEnd

    const startDatetime = `${format(current, "yyyy-MM-dd")}T00:00:00+00:00`
    const endDatetime = `${format(actualEnd, "yyyy-MM-dd")}T23:59:59+00:00`

    const url = new URL(`${OURA_BASE_URL}/${config.path}`)
    url.searchParams.set("start_datetime", startDatetime)
    url.searchParams.set("end_datetime", endDatetime)

    const chunkData = await fetchWithRetry<T>(url.toString(), options.accessToken)
    allData.push(...chunkData)

    current = addDays(actualEnd, 1)
  }

  return { data: allData, endpoint: options.endpoint }
}

async function fetchWithRetry<T>(
  url: string,
  accessToken: string,
  maxRetries = 3,
): Promise<T[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchAllPages<T>(url, accessToken)
    } catch (err) {
      if (err instanceof OuraApiError && err.status === 429) {
        const waitMs = Math.pow(2, attempt) * 1000
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      throw err
    }
  }
  throw new Error(`Max retries exceeded for ${url}`)
}
