import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * S1 — Security: Scenario 4 — Invalid API key
 *
 * Tests the real validateInternalApiKey function from @/lib/auth.
 * The function uses HMAC-based timing-safe comparison and returns false for:
 *   - missing key
 *   - wrong key
 *   - missing env var
 *   - correct key (returns true)
 */

// ─── Mock next/server ────────────────────────────────────────────────────────
//
// We mock NextRequest so the real auth.ts can be imported in a test environment
// without needing the full Next.js server runtime.

vi.mock("next/server", () => {
  return {
    NextRequest: class MockNextRequest {
      headers: { get: (name: string) => string | null };
      constructor(_url: string, init?: { headers?: Record<string, string> }) {
        const headerMap = new Map(Object.entries(init?.headers ?? {}));
        this.headers = {
          get: (name: string) => headerMap.get(name) ?? null,
        };
      }
    },
    NextResponse: {
      json: (body: unknown, init?: { status?: number }) => ({ body, status: init?.status ?? 200 }),
    },
  };
});

// ─── Import the real function under test ─────────────────────────────────────

import { validateInternalApiKey } from "@/lib/auth";
import type { NextRequest } from "next/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRequest(key?: string): NextRequest {
  return {
    headers: {
      get: (name: string) => (name === "x-api-key" && key !== undefined ? key : null),
    },
  } as unknown as NextRequest;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("validateInternalApiKey", () => {
  const ORIGINAL_ENV = process.env["INTERNAL_API_KEY"];

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env["INTERNAL_API_KEY"];
    } else {
      process.env["INTERNAL_API_KEY"] = ORIGINAL_ENV;
    }
  });

  describe("Scenario 4: Invalid API key — GIVEN x-api-key is missing or differs", () => {
    it("returns false when INTERNAL_API_KEY env var is not set", () => {
      delete process.env["INTERNAL_API_KEY"];
      const request = buildRequest("some-key");
      expect(validateInternalApiKey(request)).toBe(false);
    });

    it("returns false when INTERNAL_API_KEY env var is empty string", () => {
      process.env["INTERNAL_API_KEY"] = "";
      const request = buildRequest("some-key");
      expect(validateInternalApiKey(request)).toBe(false);
    });

    it("returns false when x-api-key header is missing", () => {
      process.env["INTERNAL_API_KEY"] = "secret-key-12345";
      const request = buildRequest(); // no key → get() returns null
      expect(validateInternalApiKey(request)).toBe(false);
    });

    it("returns false when x-api-key is the wrong key", () => {
      process.env["INTERNAL_API_KEY"] = "correct-secret";
      const request = buildRequest("wrong-secret");
      expect(validateInternalApiKey(request)).toBe(false);
    });

    it("returns false when key has wrong length (shorter)", () => {
      process.env["INTERNAL_API_KEY"] = "correct-secret";
      const request = buildRequest("short");
      expect(validateInternalApiKey(request)).toBe(false);
    });

    it("returns false when key has wrong length (longer)", () => {
      process.env["INTERNAL_API_KEY"] = "secret";
      const request = buildRequest("secret-but-longer");
      expect(validateInternalApiKey(request)).toBe(false);
    });
  });

  describe("Scenario 4: Valid API key", () => {
    it("returns true when x-api-key matches INTERNAL_API_KEY exactly", () => {
      process.env["INTERNAL_API_KEY"] = "correct-secret-key";
      const request = buildRequest("correct-secret-key");
      expect(validateInternalApiKey(request)).toBe(true);
    });

    it("returns true for a different valid key value", () => {
      const key = "super-secret-token-abc123";
      process.env["INTERNAL_API_KEY"] = key;
      const request = buildRequest(key);
      expect(validateInternalApiKey(request)).toBe(true);
    });
  });
});
