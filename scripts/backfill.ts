import { config } from "dotenv"
config({ path: ".env.local" })

import { syncEndpoints } from "../src/features/oura/server/sync-engine"
import { addDays, format, parseISO } from "date-fns"
import type { EndpointKey } from "../src/lib/oura/endpoints"

// Skip heartrate for now — too many individual upserts, do separately
const FAST_ENDPOINTS: EndpointKey[] = [
  "daily_sleep",
  "daily_readiness",
  "daily_activity",
  "daily_stress",
  "daily_resilience",
  "daily_spo2",
  "daily_cardiovascular_age",
  "vo2_max",
  "sleep",
  "sleep_time",
  "workout",
  "session",
  "tag",
  "enhanced_tag",
  "rest_mode_period",
]

async function run() {
  const startDate = "2024-11-01"
  const endDate = "2026-03-25"
  const chunkDays = 30

  let current = parseISO(startDate)
  const end = parseISO(endDate)
  let chunk = 1
  let totalInserted = 0

  console.log(`Backfilling ${startDate} → ${endDate} (no heartrate)\n`)

  while (current <= end) {
    const chunkEnd = addDays(current, chunkDays - 1)
    const actualEnd = chunkEnd > end ? end : chunkEnd
    const from = format(current, "yyyy-MM-dd")
    const to = format(actualEnd, "yyyy-MM-dd")

    process.stdout.write(`[Chunk ${chunk}] ${from} → ${to} ... `)
    try {
      const result = await syncEndpoints({
        endpoints: FAST_ENDPOINTS,
        startDate: from,
        endDate: to,
        force: false,
        source: "backfill",
      })
      totalInserted += result.recordsInserted
      console.log(`✓ +${result.recordsInserted} inserted`)
    } catch (e) {
      console.log(`✗ ${e instanceof Error ? e.message : e}`)
    }

    current = addDays(actualEnd, 1)
    chunk++
  }

  console.log(`\nDone. Total inserted: ${totalInserted}`)
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
