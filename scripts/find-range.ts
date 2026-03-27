import { getValidAccessToken } from "../src/lib/oura/oauth"
import { fetchEndpoint } from "../src/lib/oura/client"

async function check(token: string, start: string, end: string) {
  const r = await fetchEndpoint({ accessToken: token, endpoint: "daily_sleep", startDate: start, endDate: end })
  console.log(`  ${start} → ${end}: ${r.data.length} records`)
  return r.data.length
}

async function main() {
  const token = await getValidAccessToken()

  console.log("Finding available data range...")
  await check(token, "2026-01-01", "2026-03-25")
  await check(token, "2025-10-01", "2025-12-31")
  await check(token, "2025-07-01", "2025-09-30")
  await check(token, "2025-04-01", "2025-06-30")
  await check(token, "2025-01-01", "2025-03-31")
  await check(token, "2024-10-01", "2024-12-31")
  await check(token, "2024-07-01", "2024-09-30")
  await check(token, "2024-04-01", "2024-06-30")
  await check(token, "2024-01-01", "2024-03-31")
}

main().catch(console.error).finally(() => process.exit(0))
