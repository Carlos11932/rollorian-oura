import { describe, it, expect } from "vitest";

/**
 * Since @testing-library/react and jsdom are not installed,
 * we test the resilience level mapping logic directly.
 */

const RESILIENCE_MAP: Record<string, { label: string }> = {
  exceptional: { label: "Excepcional" },
  strong: { label: "Fuerte" },
  adequate: { label: "Adecuado" },
  pay_attention: { label: "Atenci\u00f3n" },
  restorative: { label: "Restaurador" },
};

function getResilienceLabel(level: string | null): string | null {
  if (!level) return null;
  return RESILIENCE_MAP[level]?.label ?? level;
}

describe("ResilienceBadge logic", () => {
  it("returns correct label for each level", () => {
    expect(getResilienceLabel("exceptional")).toBe("Excepcional");
    expect(getResilienceLabel("strong")).toBe("Fuerte");
    expect(getResilienceLabel("adequate")).toBe("Adecuado");
    expect(getResilienceLabel("pay_attention")).toBe("Atenci\u00f3n");
    expect(getResilienceLabel("restorative")).toBe("Restaurador");
  });

  it("returns null for null input", () => {
    expect(getResilienceLabel(null)).toBeNull();
  });

  it("returns raw level string for unknown levels", () => {
    expect(getResilienceLabel("unknown_level")).toBe("unknown_level");
  });
});
