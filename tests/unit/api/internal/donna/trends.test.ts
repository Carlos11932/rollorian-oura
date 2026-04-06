import { beforeEach, describe, expect, it, vi } from "vitest";

const { validateInternalApiKeyMock, getDonnaTrendsMock } = vi.hoisted(() => ({
  validateInternalApiKeyMock: vi.fn(),
  getDonnaTrendsMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  validateInternalApiKey: validateInternalApiKeyMock,
}));

vi.mock("@/features/oura/server/donna", () => ({
  getDonnaTrends: getDonnaTrendsMock,
}));

import { GET } from "@/app/api/internal/donna/context/trends/route";

describe("GET /api/internal/donna/context/trends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInternalApiKeyMock.mockReturnValue(true);
  });

  it("returns the trend payload for a valid window", async () => {
    getDonnaTrendsMock.mockResolvedValueOnce({ window: "7d" });

    const response = await GET(new Request("http://localhost/api/internal/donna/context/trends?window=7d", {
      headers: { "x-api-key": "secret" },
    }) as never);

    expect(response.status).toBe(200);
    expect(getDonnaTrendsMock).toHaveBeenCalledWith("7d");
  });

  it("returns 400 for an invalid window", async () => {
    const response = await GET(new Request("http://localhost/api/internal/donna/context/trends?window=14d", {
      headers: { "x-api-key": "secret" },
    }) as never);

    expect(response.status).toBe(400);
  });
});
