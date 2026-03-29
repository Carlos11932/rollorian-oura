import { subDays, subMonths, subYears, format } from "date-fns"

// ─── Period ───────────────────────────────────────────────────────────────────

export const DATE_RANGE_PERIOD = {
  "1d": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
} as const

export type DateRangePeriod = keyof typeof DATE_RANGE_PERIOD | "1m" | "1a"

/**
 * Returns a { startDate, endDate } pair (YYYY-MM-DD strings) for a given period.
 * - "1d"  → today only
 * - "7d"  → last 7 days
 * - "14d" → last 14 days
 * - "30d" → last 30 days
 * - "90d" → last 90 days
 * - "1m"  → last calendar month
 * - "1a"  → last calendar year
 */
export function getDateRange(
  period: DateRangePeriod,
  selectedDate?: string,
): { startDate: string; endDate: string } {
  const end = new Date()
  const endDate = format(end, "yyyy-MM-dd")

  if (period === "1d") {
    const day =
      selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
        ? selectedDate
        : endDate
    return { startDate: day, endDate: day }
  }

  if (period === "1m") {
    return {
      startDate: format(subMonths(end, 1), "yyyy-MM-dd"),
      endDate,
    }
  }

  if (period === "1a") {
    return {
      startDate: format(subYears(end, 1), "yyyy-MM-dd"),
      endDate,
    }
  }

  const days = DATE_RANGE_PERIOD[period as keyof typeof DATE_RANGE_PERIOD]
  return {
    startDate: format(subDays(end, days), "yyyy-MM-dd"),
    endDate,
  }
}
