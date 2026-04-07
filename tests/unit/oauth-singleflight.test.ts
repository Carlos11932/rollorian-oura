import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { findUniqueMock, upsertMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  upsertMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ouraOAuthToken: {
      findUnique: findUniqueMock,
      upsert: upsertMock,
    },
  },
}))

describe("Oura OAuth single-flight", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.resetModules()
    findUniqueMock.mockReset()
    upsertMock.mockReset()
    process.env["OURA_CLIENT_ID"] = "client-id"
    process.env["OURA_CLIENT_SECRET"] = "client-secret"
  })

  afterEach(() => {
    global.fetch = originalFetch
    delete process.env["OURA_CLIENT_ID"]
    delete process.env["OURA_CLIENT_SECRET"]
  })

  it("reuses one refresh request for concurrent callers", async () => {
    findUniqueMock.mockResolvedValue({
      id: "singleton",
      accessToken: "expired-access-token",
      refreshToken: "refresh-token",
      expiresAt: new Date(Date.now() - 60_000),
    })
    upsertMock.mockResolvedValue(undefined)

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
        token_type: "Bearer",
        scope: "daily",
      }),
    })
    global.fetch = fetchMock as typeof fetch

    const { getValidAccessToken } = await import("@/lib/oura/oauth")

    const [first, second] = await Promise.all([
      getValidAccessToken(),
      getValidAccessToken(),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(upsertMock).toHaveBeenCalledTimes(1)
    expect(first).toBe("new-access-token")
    expect(second).toBe("new-access-token")
  })
})
