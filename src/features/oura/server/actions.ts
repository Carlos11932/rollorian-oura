"use server";

import { subDays } from "date-fns";
import { syncEndpoints } from "./sync-engine";
import { ALL_SYNCABLE_ENDPOINTS } from "@/lib/oura/endpoints";
import { getLocalDayString } from "@/lib/utils/day";

interface SyncResult {
  success: boolean;
  message: string;
}

export async function triggerManualSync(): Promise<SyncResult> {
  const today = new Date();
  const endDate = getLocalDayString(today);
  const startDate = getLocalDayString(subDays(today, 2));

  try {
    const result = await syncEndpoints({
      endpoints: ALL_SYNCABLE_ENDPOINTS,
      startDate,
      endDate,
      force: true,
      source: "manual",
    });

    if (result.status === "error") {
      const firstError = result.errors?.[0]?.message ?? "Sync failed";
      return { success: false, message: firstError };
    }

    return {
      success: true,
      message: `Sync ${result.status}: ${result.recordsInserted} inserted, ${result.recordsUpdated} updated`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message };
  }
}
