import { parseISO } from "date-fns"
import {
  getInclusiveDayWindow,
  getLocalDayString,
  getMonthWindow,
  getYearWindow,
} from "@/lib/utils/day"

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
  if (period === "1d") {
    const day =
      selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)
        ? selectedDate
        : getLocalDayString()
    return { startDate: day, endDate: day }
  }

  if (period === "1m") {
    const { startDay, endDay } = getMonthWindow()
    return { startDate: startDay, endDate: endDay }
  }

  if (period === "1a") {
    const { startDay, endDay } = getYearWindow()
    return { startDate: startDay, endDate: endDay }
  }

  const days = DATE_RANGE_PERIOD[period as keyof typeof DATE_RANGE_PERIOD]
  const anchorDate =
    selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? parseISO(selectedDate) : new Date()
  const { startDay, endDay } = getInclusiveDayWindow(days, anchorDate)
  return { startDate: startDay, endDate: endDay }
}
