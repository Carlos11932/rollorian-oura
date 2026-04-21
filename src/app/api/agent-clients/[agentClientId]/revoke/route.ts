import { revokeAgentClient } from "@/lib/agents"
import { getErrorStatus, getPublicErrorMessage } from "@/lib/agents/errors"
import { validateInternalApiKey } from "@/lib/auth"

export async function POST(
  request: Request,
  context: { params: Promise<{ agentClientId: string }> },
): Promise<Response> {
  if (!validateInternalApiKey(request as never)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { agentClientId } = await context.params
    const client = await revokeAgentClient(agentClientId)

    return Response.json({ client })
  } catch (error) {
    const status = getErrorStatus(error)

    if (status >= 500) {
      console.error("[POST /api/agent-clients/[agentClientId]/revoke]", error)
    }

    return Response.json({ error: getPublicErrorMessage(error) }, { status })
  }
}
