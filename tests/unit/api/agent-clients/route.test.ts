import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  validateInternalApiKeyMock,
  listAgentClientsMock,
  listRecentAgentAuditEventsMock,
  createAgentClientMock,
} = vi.hoisted(() => ({
  validateInternalApiKeyMock: vi.fn(),
  listAgentClientsMock: vi.fn(),
  listRecentAgentAuditEventsMock: vi.fn(),
  createAgentClientMock: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  validateInternalApiKey: validateInternalApiKeyMock,
}))

vi.mock("@/lib/agents", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agents")>("@/lib/agents")
  return {
    ...actual,
    listAgentClients: listAgentClientsMock,
    listRecentAgentAuditEvents: listRecentAgentAuditEventsMock,
    createAgentClient: createAgentClientMock,
  }
})

import { GET, POST } from "@/app/api/agent-clients/route"

describe("agent client management routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    validateInternalApiKeyMock.mockReturnValue(true)
    listAgentClientsMock.mockResolvedValue([{ id: "agent-1" }])
    listRecentAgentAuditEventsMock.mockResolvedValue([{ id: "event-1" }])
    createAgentClientMock.mockResolvedValue({
      client: { id: "agent-1" },
      plainToken: "plain-token",
    })
  })

  it("returns the management payload when the internal key is valid", async () => {
    const response = await GET(new Request("http://localhost/api/agent-clients", {
      headers: { "x-api-key": "secret" },
    }) as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      clients: [{ id: "agent-1" }],
      recentEvents: [{ id: "event-1" }],
    })
  })

  it("returns 401 when the internal key is invalid", async () => {
    validateInternalApiKeyMock.mockReturnValueOnce(false)

    const response = await GET(new Request("http://localhost/api/agent-clients") as never)

    expect(response.status).toBe(401)
  })

  it("creates a client and returns the issued token", async () => {
    const response = await POST(new Request("http://localhost/api/agent-clients", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": "secret",
      },
      body: JSON.stringify({
        name: "Donna",
        kind: "PRIVATE_COMPANION",
        scopes: ["status:read"],
      }),
    }) as never)

    expect(response.status).toBe(201)
    expect(createAgentClientMock).toHaveBeenCalledWith({
      name: "Donna",
      kind: "PRIVATE_COMPANION",
      scopes: ["status:read"],
    })
  })
})
