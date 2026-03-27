"use server";

import { format, subDays } from "date-fns";
import { syncEndpoints } from "./sync-engine";
import { ALL_SYNCABLE_ENDPOINTS } from "@/lib/oura/endpoints";

interface SyncResult {
  success: boolean;
  message: string;
}

export async function triggerManualSync(): Promise<SyncResult> {
  const today = new Date();
  const endDate = format(today, "yyyy-MM-dd");
  const startDate = format(subDays(today, 1), "yyyy-MM-dd");

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

    return { success: true, message: "Sync completed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, message };
  }
}
