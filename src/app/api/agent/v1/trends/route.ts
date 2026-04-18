import type { NextRequest } from "next/server"
import { getDonnaTrends } from "@/features/oura/server/donna"
import { handleAgentRoute } from "@/lib/agents"
import { AgentInputError } from "@/lib/agents/errors"

export async function GET(request: NextRequest): Promise<Response> {
  return handleAgentRoute(
    request,
    {
      action: "trends.read",
      scope: "trends:read",
      resourceType: "trends",
    },
    async () => {
      const { searchParams } = new URL(request.url)
      const window = searchParams.get("window") ?? "7d"

      if (window !== "7d" && window !== "30d") {
        throw new AgentInputError("Invalid window. Expected 7d or 30d")
      }

      return {
        body: await getDonnaTrends(window),
        resourceId: window,
      }
    },
  )
}
