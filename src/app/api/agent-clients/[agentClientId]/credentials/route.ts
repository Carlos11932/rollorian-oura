import type { NextRequest } from "next/server"
import { issueAgentCredential, issueAgentCredentialSchema } from "@/lib/agents"
import { AgentInputError, getErrorStatus, getPublicErrorMessage } from "@/lib/agents/errors"
import { validateInternalApiKey } from "@/lib/auth"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agentClientId: string }> },
): Promise<Response> {
  if (!validateInternalApiKey(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { agentClientId } = await context.params
    const body = await request.json().catch(() => null)
    const parsed = issueAgentCredentialSchema.safeParse(body)

    if (!parsed.success) {
      throw new AgentInputError(parsed.error.issues.map((issue) => issue.message).join(", "))
    }

    const result = await issueAgentCredential(agentClientId, parsed.data)
    return Response.json(result, { status: 201 })
  } catch (error) {
    const status = getErrorStatus(error)

    if (status >= 500) {
      console.error("[POST /api/agent-clients/[agentClientId]/credentials]", error)
    }

    return Response.json({ error: getPublicErrorMessage(error) }, { status })
  }
}
