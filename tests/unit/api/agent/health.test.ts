import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  handleAgentRouteMock,
  getDonnaHealthMock,
} = vi.hoisted(() => ({
  handleAgentRouteMock: vi.fn(),
  getDonnaHealthMock: vi.fn(),
}))

vi.mock("@/lib/agents", () => ({
  handleAgentRoute: handleAgentRouteMock,
}))

vi.mock("@/features/oura/server/donna", () => ({
  getDonnaHealth: getDonnaHealthMock,
}))

import { GET } from "@/app/api/agent/v1/health/route"

describe("GET /api/agent/v1/health", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getDonnaHealthMock.mockResolvedValue({ day: "2026-04-18" })
    handleAgentRouteMock.mockImplementation(async (_request, _config, handler) => {
      try {
        const result = await handler({
          agentClientId: "agent-1",
          credentialId: "credential-1",
          agentName: "Donna",
          agentKind: "PRIVATE_COMPANION",
          owner: { appId: "rollorian-oura", name: "Rollorian Oura" },
          scopes: ["health:read"],
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

  it("validates the day and returns health context", async () => {
    const response = await GET(new Request("http://localhost/api/agent/v1/health?day=2026-04-18") as never)

    expect(response.status).toBe(200)
    expect(getDonnaHealthMock).toHaveBeenCalledWith("2026-04-18")
  })

  it("returns 400 for an invalid day", async () => {
    const response = await GET(new Request("http://localhost/api/agent/v1/health?day=today") as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Invalid day format. Expected YYYY-MM-DD",
    })
  })
})
