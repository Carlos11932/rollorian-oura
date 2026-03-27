import { getValidAccessToken } from "../src/lib/oura/oauth"
import { fetchEndpoint } from "../src/lib/oura/client"

async function main() {
  const token = await getValidAccessToken()
  console.log("Token OK")

  const result = await fetchEndpoint({
    accessToken: token,
    endpoint: "daily_sleep",
    startDate: "2026-02-01",
    endDate: "2026-03-25",
  })
  console.log("daily_sleep records (Feb-Mar 2026):", result.data.length)

  const result2 = await fetchEndpoint({
    accessToken: token,
    endpoint: "daily_sleep",
    startDate: "2024-06-01",
    endDate: "2024-06-30",
  })
  console.log("daily_sleep records (Jun 2024):", result2.data.length)
}

main().catch(console.error).finally(() => process.exit(0))
