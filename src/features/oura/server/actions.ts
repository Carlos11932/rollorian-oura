"use server";

import { format, subDays } from "date-fns";

interface SyncResult {
  success: boolean;
  message: string;
}

export async function triggerManualSync(): Promise<SyncResult> {
  const today = new Date();
  const endDate = format(today, "yyyy-MM-dd");
  const startDate = format(subDays(today, 1), "yyyy-MM-dd");

  const baseUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  const apiKey = process.env["INTERNAL_API_KEY"];

  if (!apiKey) {
    return { success: false, message: "INTERNAL_API_KEY not configured" };
  }

  try {
    const response = await fetch(`${baseUrl}/api/internal/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ startDate, endDate }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as Record<string, unknown>;
      const errorMsg = typeof data["error"] === "string" ? data["error"] : "Sync failed";
      return { success: false, message: errorMsg };
    }

    return { success: true, message: "Sync completed" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return { success: false, message };
  }
}
