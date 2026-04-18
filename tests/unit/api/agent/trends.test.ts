import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  handleAgentRouteMock,
  getDonnaTrendsMock,
} = vi.hoisted(() => ({
  handleAgentRouteMock: vi.fn(),
  getDonnaTrendsMock: vi.fn(),
}))

vi.mock("@/lib/agents", () => ({
  handleAgentRoute: handleAgentRouteMock,
}))

vi.mock("@/features/oura/server/donna", () => ({
  getDonnaTrends: getDonnaTrendsMock,
}))

import { GET } from "@/app/api/agent/v1/trends/route"

describe("GET /api/agent/v1/trends", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDonnaTrendsMock.mockResolvedValue({ window: "7d" })
    handleAgentRouteMock.mockImplementation(async (_request, _config, handler) => {
      try {
        const result = await handler({
          agentClientId: "agent-1",
          credentialId: "credential-1",
          agentName: "Donna",
          agentKind: "PRIVATE_COMPANION",
          owner: { appId: "rollorian-oura", name: "Rollorian Oura" },
          scopes: ["trends:read"],
          tokenPrefix: "roa_test",
        }, { idempotencyKey: null })

        return Response.json(result.body, { status: result.status ?? 200 })
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : "Unexpected error" },
          { status: error instanceof Error && "status" in error ? Number(error.status) : 500 },
        )
      }
    })
  })

  it("returns the trend payload for a valid window", async () => {
    const response = await GET(new Request("http://localhost/api/agent/v1/trends?window=7d") as never)

    expect(response.status).toBe(200)
    expect(getDonnaTrendsMock).toHaveBeenCalledWith("7d")
  })

  it("returns 400 for an invalid window", async () => {
    const response = await GET(new Request("http://localhost/api/agent/v1/trends?window=14d") as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Invalid window. Expected 7d or 30d",
    })
  })
})
