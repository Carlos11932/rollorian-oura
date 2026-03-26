import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getDateRange } from "@/features/oura/server/queries";

describe("getDateRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("1d returns today only", () => {
    const { startDate, endDate } = getDateRange("1d");
    expect(startDate).toBe("2025-06-15");
    expect(endDate).toBe("2025-06-15");
  });

  it("7d returns last 7 days", () => {
    const { startDate, endDate } = getDateRange("7d");
    expect(startDate).toBe("2025-06-08");
    expect(endDate).toBe("2025-06-15");
  });

  it("1m returns last month", () => {
    const { startDate, endDate } = getDateRange("1m");
    expect(startDate).toBe("2025-05-15");
    expect(endDate).toBe("2025-06-15");
  });

  it("1a returns last year", () => {
    const { startDate, endDate } = getDateRange("1a");
    expect(startDate).toBe("2024-06-15");
    expect(endDate).toBe("2025-06-15");
  });
});
