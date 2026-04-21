import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  handleAgentRouteMock,
  getDonnaStatusMock,
} = vi.hoisted(() => ({
  handleAgentRouteMock: vi.fn(),
  getDonnaStatusMock: vi.fn(),
}))

vi.mock("@/lib/agents", () => ({
  handleAgentRoute: handleAgentRouteMock,
}))

vi.mock("@/features/oura/server/donna", () => ({
  getDonnaStatus: getDonnaStatusMock,
}))

import { GET } from "@/app/api/agent/v1/status/route"

describe("GET /api/agent/v1/status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDonnaStatusMock.mockResolvedValue({ connected: true })
    handleAgentRouteMock.mockImplementation(async (_request, _config, handler) => {
      const result = await handler({
        agentClientId: "agent-1",
        credentialId: "credential-1",
        agentName: "Donna",
        agentKind: "PRIVATE_COMPANION",
        owner: { appId: "rollorian-oura", name: "Rollorian Oura" },
        scopes: ["status:read"],
        tokenPrefix: "roa_test",
      }, { idempotencyKey: null })

      return Response.json(result.body, { status: result.status ?? 200 })
    })
  })

  it("delegates to the shared status service", async () => {
    const response = await GET(new Request("http://localhost/api/agent/v1/status") as never)

    expect(response.status).toBe(200)
    expect(handleAgentRouteMock).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        action: "status.read",
        scope: "status:read",
        resourceType: "status",
      }),
      expect.any(Function),
    )
    expect(getDonnaStatusMock).toHaveBeenCalledTimes(1)
  })
})
