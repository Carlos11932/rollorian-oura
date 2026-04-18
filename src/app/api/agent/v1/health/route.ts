import type { NextRequest } from "next/server"
import { getDonnaHealth } from "@/features/oura/server/donna"
import { handleAgentRoute } from "@/lib/agents"
import { AgentInputError } from "@/lib/agents/errors"
import { getLocalDayString } from "@/lib/utils/day"

export async function GET(request: NextRequest): Promise<Response> {
  return handleAgentRoute(
    request,
    {
      action: "health.read",
      scope: "health:read",
      resourceType: "health",
    },
    async () => {
      const { searchParams } = new URL(request.url)
      const day = searchParams.get("day") ?? getLocalDayString()

      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        throw new AgentInputError("Invalid day format. Expected YYYY-MM-DD")
      }

      return {
        body: await getDonnaHealth(day),
        resourceId: day,
      }
    },
  )
}
