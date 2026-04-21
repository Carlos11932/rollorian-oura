import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { AgentAuthError, AgentScopeError } from "@/lib/agents/errors"

const {
  resolveAgentRequestContextMock,
  requireAgentScopeMock,
  recordAgentAuditEventMock,
} = vi.hoisted(() => ({
  resolveAgentRequestContextMock: vi.fn(),
  requireAgentScopeMock: vi.fn(),
  recordAgentAuditEventMock: vi.fn(),
}))

vi.mock("@/lib/agents/context", () => ({
  resolveAgentRequestContext: resolveAgentRequestContextMock,
  requireAgentScope: requireAgentScopeMock,
}))

vi.mock("@/lib/agents/audit", () => ({
  recordAgentAuditEvent: recordAgentAuditEventMock,
  getAuditOutcomeFromStatus: (status: number) => status >= 500 ? "FAILURE" : status >= 400 ? "REJECTED" : "SUCCESS",
}))

import { handleAgentRoute } from "@/lib/agents/http"

const context = {
  owner: {
    appId: "rollorian-oura",
    name: "Rollorian Oura",
  },
  agentClientId: "agent-1",
  credentialId: "credential-1",
  agentName: "Donna",
  agentKind: "PRIVATE_COMPANION" as const,
  scopes: ["status:read"] as const,
  tokenPrefix: "roa_test",
}

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/agent/v1/status")
}

describe("handleAgentRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveAgentRequestContextMock.mockResolvedValue(context)
    requireAgentScopeMock.mockReturnValue(undefined)
    recordAgentAuditEventMock.mockResolvedValue(undefined)
  })

  it("returns handler JSON and records success audits", async () => {
    const response = await handleAgentRoute(
      makeRequest(),
      { action: "status.read", scope: "status:read", resourceType: "status" },
      async () => ({
        body: { ok: true },
        status: 200,
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(recordAgentAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      agentClientId: "agent-1",
      action: "status.read",
      outcome: "SUCCESS",
    }))
  })

  it("returns 403 and records a rejected audit when the scope is missing", async () => {
    requireAgentScopeMock.mockImplementation(() => {
      throw new AgentScopeError("Missing required scope: status:read")
    })

    const response = await handleAgentRoute(
      makeRequest(),
      { action: "status.read", scope: "status:read", resourceType: "status" },
      async () => ({ body: { ok: true } }),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "Missing required scope: status:read" })
    expect(recordAgentAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      action: "status.read",
      outcome: "REJECTED",
    }))
  })

  it("returns 401 without recording an audit when auth fails before context resolution", async () => {
    resolveAgentRequestContextMock.mockRejectedValue(new AgentAuthError("Invalid token"))

    const response = await handleAgentRoute(
      makeRequest(),
      { action: "status.read", scope: "status:read", resourceType: "status" },
      async () => ({ body: { ok: true } }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "Invalid token" })
    expect(recordAgentAuditEventMock).not.toHaveBeenCalled()
  })
})
