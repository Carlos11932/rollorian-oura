import { beforeEach, describe, expect, it, vi } from "vitest";

const { validateInternalApiKeyMock, getDonnaHealthMock } = vi.hoisted(() => ({
  validateInternalApiKeyMock: vi.fn(),
  getDonnaHealthMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  validateInternalApiKey: validateInternalApiKeyMock,
}));

vi.mock("@/features/oura/server/donna", () => ({
  getDonnaHealth: getDonnaHealthMock,
}));

import { GET } from "@/app/api/internal/donna/context/health/route";

describe("GET /api/internal/donna/context/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInternalApiKeyMock.mockReturnValue(true);
  });

  it("validates the day and returns health context", async () => {
    getDonnaHealthMock.mockResolvedValueOnce({ day: "2026-04-06" });

    const response = await GET(new Request("http://localhost/api/internal/donna/context/health?day=2026-04-06", {
      headers: { "x-api-key": "secret" },
    }) as never);

    expect(response.status).toBe(200);
    expect(getDonnaHealthMock).toHaveBeenCalledWith("2026-04-06");
  });

  it("returns 400 for an invalid day", async () => {
    const response = await GET(new Request("http://localhost/api/internal/donna/context/health?day=today", {
      headers: { "x-api-key": "secret" },
    }) as never);

    expect(response.status).toBe(400);
  });
});
