import { describe, it, expect } from "vitest";

/**
 * S0 — Sync Infrastructure
 *
 * Scenario 1: Optional endpoint unavailable (404 → warning, not error)
 * Scenario 2: Required endpoint unavailable (404 → error, not warning)
 *
 * The real syncEndpoints() function requires Prisma + OAuth tokens to run.
 * We test the error-categorization LOGIC extracted from sync-engine.ts:
 *
 *   if (err instanceof OuraApiError && err.status === 404
 *       && OURA_ENDPOINTS[endpoint]?.availabilityPolicy === "optional") {
 *     warnings.push(...)
 *     unavailableEndpoints.push(endpoint)
 *   } else {
 *     errors.push(...)
 *   }
 *
 * This logic is deterministic and needs no DB/network.
 */

// ─── Inline the types and classes we need ────────────────────────────────────

class OuraApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly url: string,
  ) {
    super(`Oura API error ${status}: ${body}`);
    this.name = "OuraApiError";
  }
}

type AvailabilityPolicy = "required" | "optional";
type SyncWarning = { endpoint: string; code: "unavailable"; message: string };

interface EndpointConfig {
  availabilityPolicy: AvailabilityPolicy;
}

// ─── The categorization logic under test ─────────────────────────────────────
//
// Mirrors the catch block in syncEndpoints() from sync-engine.ts.

function categorizeEndpointError(
  endpoint: string,
  err: unknown,
  config: EndpointConfig | undefined,
  warnings: SyncWarning[],
  unavailableEndpoints: string[],
  errors: Array<{ endpoint: string; message: string }>,
): void {
  const isOptional404 =
    err instanceof OuraApiError &&
    err.status === 404 &&
    config?.availabilityPolicy === "optional";

  if (isOptional404) {
    warnings.push({
      endpoint,
      code: "unavailable",
      message: err instanceof Error ? err.message : String(err),
    });
    unavailableEndpoints.push(endpoint);
  } else {
    errors.push({
      endpoint,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── finalStatus logic (mirrors sync-engine.ts lines 99-104) ─────────────────

function computeFinalStatus(
  errors: unknown[],
  endpointCount: number,
): "success" | "partial" | "error" {
  if (errors.length === 0) return "success";
  if (errors.length < endpointCount) return "partial";
  return "error";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Sync engine — error categorization", () => {
  describe("Scenario 1: Optional endpoint returns 404", () => {
    it("adds the endpoint to warnings and unavailableEndpoints, not errors", () => {
      const warnings: SyncWarning[] = [];
      const unavailableEndpoints: string[] = [];
      const errors: Array<{ endpoint: string; message: string }> = [];

      const err = new OuraApiError(404, "Not Found", "https://api.ouraring.com/v2/usercollection/daily_spo2");
      const config: EndpointConfig = { availabilityPolicy: "optional" };

      categorizeEndpointError("daily_spo2", err, config, warnings, unavailableEndpoints, errors);

      expect(warnings).toHaveLength(1);
      expect(warnings[0].endpoint).toBe("daily_spo2");
      expect(warnings[0].code).toBe("unavailable");
      expect(unavailableEndpoints).toContain("daily_spo2");
      expect(errors).toHaveLength(0);
    });

    it("sync status is 'success' when only optional endpoints are unavailable", () => {
      const errors: unknown[] = [];
      const status = computeFinalStatus(errors, 3);
      expect(status).toBe("success");
    });

    it("handles multiple optional 404s — all go to warnings", () => {
      const warnings: SyncWarning[] = [];
      const unavailableEndpoints: string[] = [];
      const errors: Array<{ endpoint: string; message: string }> = [];

      const optionalEndpoints = ["daily_spo2", "vo2_max", "daily_resilience"] as const;

      for (const endpoint of optionalEndpoints) {
        const err = new OuraApiError(404, "Not Found", `https://api.ouraring.com/${endpoint}`);
        categorizeEndpointError(endpoint, err, { availabilityPolicy: "optional" }, warnings, unavailableEndpoints, errors);
      }

      expect(warnings).toHaveLength(3);
      expect(errors).toHaveLength(0);
      expect(unavailableEndpoints).toEqual(optionalEndpoints);
      expect(computeFinalStatus(errors, 5)).toBe("success");
    });
  });

  describe("Scenario 2: Required endpoint returns 404", () => {
    it("adds the endpoint to errors, not warnings", () => {
      const warnings: SyncWarning[] = [];
      const unavailableEndpoints: string[] = [];
      const errors: Array<{ endpoint: string; message: string }> = [];

      const err = new OuraApiError(404, "Not Found", "https://api.ouraring.com/v2/usercollection/daily_sleep");
      const config: EndpointConfig = { availabilityPolicy: "required" };

      categorizeEndpointError("daily_sleep", err, config, warnings, unavailableEndpoints, errors);

      expect(errors).toHaveLength(1);
      expect(errors[0].endpoint).toBe("daily_sleep");
      expect(warnings).toHaveLength(0);
      expect(unavailableEndpoints).toHaveLength(0);
    });

    it("sync status becomes 'partial' when some required endpoints fail", () => {
      const status = computeFinalStatus([{ endpoint: "daily_sleep", message: "404" }], 3);
      expect(status).toBe("partial");
    });

    it("sync status becomes 'error' when ALL endpoints fail", () => {
      const errors = [
        { endpoint: "daily_sleep", message: "404" },
        { endpoint: "daily_readiness", message: "404" },
        { endpoint: "heartrate", message: "404" },
      ];
      const status = computeFinalStatus(errors, 3);
      expect(status).toBe("error");
    });
  });

  describe("Edge cases", () => {
    it("a non-404 OuraApiError goes to errors regardless of availability policy", () => {
      const warnings: SyncWarning[] = [];
      const unavailableEndpoints: string[] = [];
      const errors: Array<{ endpoint: string; message: string }> = [];

      const err = new OuraApiError(500, "Internal Server Error", "https://api.ouraring.com/...");
      const config: EndpointConfig = { availabilityPolicy: "optional" };

      categorizeEndpointError("daily_spo2", err, config, warnings, unavailableEndpoints, errors);

      // 500 is a real error, even for optional endpoints
      expect(errors).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    });

    it("a network Error (not OuraApiError) goes to errors", () => {
      const warnings: SyncWarning[] = [];
      const unavailableEndpoints: string[] = [];
      const errors: Array<{ endpoint: string; message: string }> = [];

      const err = new Error("Network timeout");
      const config: EndpointConfig = { availabilityPolicy: "optional" };

      categorizeEndpointError("daily_spo2", err, config, warnings, unavailableEndpoints, errors);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe("Network timeout");
      expect(warnings).toHaveLength(0);
    });

    it("undefined endpoint config (no availabilityPolicy) goes to errors", () => {
      const warnings: SyncWarning[] = [];
      const unavailableEndpoints: string[] = [];
      const errors: Array<{ endpoint: string; message: string }> = [];

      const err = new OuraApiError(404, "Not Found", "https://api.ouraring.com/unknown");

      categorizeEndpointError("unknown_endpoint", err, undefined, warnings, unavailableEndpoints, errors);

      expect(errors).toHaveLength(1);
      expect(warnings).toHaveLength(0);
    });
  });
});
