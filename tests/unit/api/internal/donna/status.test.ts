import { beforeEach, describe, expect, it, vi } from "vitest";

const { validateInternalApiKeyMock, getDonnaStatusMock } = vi.hoisted(() => ({
  validateInternalApiKeyMock: vi.fn(),
  getDonnaStatusMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  validateInternalApiKey: validateInternalApiKeyMock,
}));

vi.mock("@/features/oura/server/donna", () => ({
  getDonnaStatus: getDonnaStatusMock,
}));

import { GET } from "@/app/api/internal/donna/status/route";

describe("GET /api/internal/donna/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateInternalApiKeyMock.mockReturnValue(true);
  });

  it("returns the adapter payload", async () => {
    getDonnaStatusMock.mockResolvedValueOnce({ connected: true });

    const response = await GET(new Request("http://localhost/api/internal/donna/status", {
      headers: { "x-api-key": "secret" },
    }) as never);

    expect(response.status).toBe(200);
  });

  it("returns 401 when the key is invalid", async () => {
    validateInternalApiKeyMock.mockReturnValueOnce(false);

    const response = await GET(new Request("http://localhost/api/internal/donna/status") as never);

    expect(response.status).toBe(401);
  });
});
