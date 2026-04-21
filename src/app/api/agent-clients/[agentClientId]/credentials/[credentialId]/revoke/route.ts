import { revokeAgentCredential } from "@/lib/agents"
import { getErrorStatus, getPublicErrorMessage } from "@/lib/agents/errors"
import { validateInternalApiKey } from "@/lib/auth"

export async function POST(
  request: Request,
  context: { params: Promise<{ agentClientId: string; credentialId: string }> },
): Promise<Response> {
  if (!validateInternalApiKey(request as never)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { agentClientId, credentialId } = await context.params
    const client = await revokeAgentCredential(agentClientId, credentialId)

    return Response.json({ client })
  } catch (error) {
    const status = getErrorStatus(error)

    if (status >= 500) {
      console.error("[POST /api/agent-clients/[agentClientId]/credentials/[credentialId]/revoke]", error)
    }

    return Response.json({ error: getPublicErrorMessage(error) }, { status })
  }
}
