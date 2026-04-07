import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  closeStaleRunningSessions,
  syncEndpoints,
} from "@/features/oura/server/sync-engine"

const {
  updateManyMock,
  createSessionMock,
  updateSessionMock,
  createSleepDailyMock,
} = vi.hoisted(() => ({
  updateManyMock: vi.fn(),
  createSessionMock: vi.fn(),
  updateSessionMock: vi.fn(),
  createSleepDailyMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ouraSyncSession: {
      updateMany: updateManyMock,
      create: createSessionMock,
      update: updateSessionMock,
    },
    ouraSleepDaily: {
      create: createSleepDailyMock,
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock("@/lib/oura/oauth", () => ({
  getValidAccessToken: vi.fn().mockResolvedValue("access-token"),
}))

vi.mock("@/lib/oura/client", () => ({
  fetchEndpoint: vi.fn().mockResolvedValue({
    endpoint: "daily_sleep",
    data: [{ id: "sleep-1", day: "2026-04-06", score: 88 }],
  }),
}))

vi.mock("@/lib/oura/normalizers", () => ({
  NORMALIZERS: {
    daily_sleep: (raw: Record<string, unknown>) => ({
      ouraId: String(raw["id"]),
      day: String(raw["day"]),
      score: raw["score"],
    }),
  },
}))

describe("sync-engine runtime safeguards", () => {
  beforeEach(() => {
    updateManyMock.mockReset()
    createSessionMock.mockReset()
    updateSessionMock.mockReset()
    createSleepDailyMock.mockReset()
  })

  it("closes stale running sessions before starting a new sync", async () => {
    updateManyMock.mockResolvedValue({ count: 2 })
    const now = new Date("2026-04-07T12:00:00.000Z")

    const count = await closeStaleRunningSessions(now)

    expect(count).toBe(2)
    expect(updateManyMock).toHaveBeenCalledWith({
      where: {
        status: "running",
        finishedAt: null,
        startedAt: { lt: new Date("2026-04-07T11:45:00.000Z") },
      },
      data: {
        status: "error",
        finishedAt: now,
        errorMessage: "Sync session abandoned before completion",
      },
    })
  })

  it("surfaces persistence failures as endpoint errors instead of skipped rows", async () => {
    updateManyMock.mockResolvedValue({ count: 0 })
    createSessionMock.mockResolvedValue({ id: "session-1" })
    updateSessionMock.mockResolvedValue(undefined)
    createSleepDailyMock.mockRejectedValue(new Error("write failed"))

    const result = await syncEndpoints({
      endpoints: ["daily_sleep"],
      startDate: "2026-04-06",
      endDate: "2026-04-06",
      force: false,
      source: "manual",
    })

    expect(result.status).toBe("error")
    expect(result.recordsSkipped).toBe(0)
    expect(result.errors).toEqual([
      { endpoint: "daily_sleep", message: "write failed" },
    ])
    expect(updateSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "session-1" },
        data: expect.objectContaining({
          status: "error",
          errorMessage: "daily_sleep: write failed",
        }),
      }),
    )
  })
})
