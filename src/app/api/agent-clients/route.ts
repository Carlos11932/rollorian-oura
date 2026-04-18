import type { NextRequest } from "next/server"
import {
  createAgentClient,
  createAgentClientSchema,
  listAgentClients,
  listRecentAgentAuditEvents,
} from "@/lib/agents"
import { AgentInputError, getErrorStatus, getPublicErrorMessage } from "@/lib/agents/errors"
import { validateInternalApiKey } from "@/lib/auth"

export async function GET(request: NextRequest): Promise<Response> {
  if (!validateInternalApiKey(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const [clients, recentEvents] = await Promise.all([
      listAgentClients(),
      listRecentAgentAuditEvents(),
    ])

    return Response.json({ clients, recentEvents })
  } catch (error) {
    console.error("[GET /api/agent-clients]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!validateInternalApiKey(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json().catch(() => null)
    const parsed = createAgentClientSchema.safeParse(body)

    if (!parsed.success) {
      throw new AgentInputError(parsed.error.issues.map((issue) => issue.message).join(", "))
    }

    const result = await createAgentClient(parsed.data)
    return Response.json(result, { status: 201 })
  } catch (error) {
    const status = getErrorStatus(error)

    if (status >= 500) {
      console.error("[POST /api/agent-clients]", error)
    }

    return Response.json({ error: getPublicErrorMessage(error) }, { status })
  }
}
