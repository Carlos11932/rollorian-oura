"use server"
import { syncEndpoints } from "./sync-engine"
import { ALL_SYNCABLE_ENDPOINTS } from "@/lib/oura/endpoints"
import { format, subDays } from "date-fns"

export async function triggerManualSync() {
  const today = new Date()
  const startDate = format(subDays(today, 1), "yyyy-MM-dd")
  const endDate = format(today, "yyyy-MM-dd")

  return syncEndpoints({
    endpoints: ALL_SYNCABLE_ENDPOINTS,
    startDate,
    endDate,
    force: true,
    source: "manual",
  })
}
