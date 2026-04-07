import { addDays, parseISO, subDays, subMonths, subYears } from "date-fns"

export const BUSINESS_TIME_ZONE = process.env["APP_TIME_ZONE"] ?? "Europe/Madrid"

export function getLocalDayString(
  date = new Date(),
  timeZone = BUSINESS_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"

  return `${year}-${month}-${day}`
}

export function getInclusiveDayWindow(days: number, now = new Date()): {
  startDay: string
  endDay: string
} {
  return {
    startDay: getLocalDayString(subDays(now, days - 1)),
    endDay: getLocalDayString(now),
  }
}

export function getMonthWindow(now = new Date()): {
  startDay: string
  endDay: string
} {
  return {
    startDay: getLocalDayString(subMonths(now, 1)),
    endDay: getLocalDayString(now),
  }
}

export function getYearWindow(now = new Date()): {
  startDay: string
  endDay: string
} {
  return {
    startDay: getLocalDayString(subYears(now, 1)),
    endDay: getLocalDayString(now),
  }
}

export function listDayStrings(startDay: string, endDay: string): string[] {
  const days: string[] = []
  let cursor = parseISO(startDay)
  const end = parseISO(endDay)

  while (cursor <= end) {
    days.push(getLocalDayString(cursor))
    cursor = addDays(cursor, 1)
  }

  return days
}

function getTimeParts(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
}

export function formatTimeInZone(
  date: Date,
  timeZone = BUSINESS_TIME_ZONE,
): string {
  const parts = getTimeParts(date, timeZone)
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00"
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00"
  return `${hour}:${minute}`
}

export function getBucketTimeInZone(
  date: Date,
  bucketMinutes = 15,
  timeZone = BUSINESS_TIME_ZONE,
): string {
  const [hourText, minuteText] = formatTimeInZone(date, timeZone).split(":")
  const totalMinutes = Number(hourText) * 60 + Number(minuteText)
  const bucket = Math.floor(totalMinutes / bucketMinutes) * bucketMinutes
  const bucketHour = String(Math.floor(bucket / 60)).padStart(2, "0")
  const bucketMinute = String(bucket % 60).padStart(2, "0")
  return `${bucketHour}:${bucketMinute}`
}
