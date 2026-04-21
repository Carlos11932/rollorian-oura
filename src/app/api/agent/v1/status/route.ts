import type { NextRequest } from "next/server"
import { getDonnaStatus } from "@/features/oura/server/donna"
import { handleAgentRoute } from "@/lib/agents"

export async function GET(request: NextRequest): Promise<Response> {
  return handleAgentRoute(
    request,
    {
      action: "status.read",
      scope: "status:read",
      resourceType: "status",
    },
    async () => ({
      body: await getDonnaStatus(),
    }),
  )
}
