import { describe, it, expect } from "vitest";

/**
 * Test the sparkline path generation logic extracted from the component.
 * No DOM rendering since jsdom is not installed.
 */

function buildSparklinePath(data: number[]): string | null {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * 100,
    y: 40 - ((v - min) / range) * 36 - 2,
  }));

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` Q ${cpx} ${prev.y} ${curr.x} ${curr.y}`;
  }

  return d;
}

describe("Sparkline path generation", () => {
  it("returns null for empty array", () => {
    expect(buildSparklinePath([])).toBeNull();
  });

  it("returns null for single data point", () => {
    expect(buildSparklinePath([42])).toBeNull();
  });

  it("generates valid path for two points", () => {
    const path = buildSparklinePath([10, 20]);
    expect(path).not.toBeNull();
    expect(path).toMatch(/^M /);
    expect(path).toContain("Q ");
    // Should not contain NaN
    expect(path).not.toContain("NaN");
  });

  it("generates valid path for multiple points", () => {
    const path = buildSparklinePath([10, 20, 15, 30, 25]);
    expect(path).not.toBeNull();
    expect(path).not.toContain("NaN");
    // Should have 4 Q commands (one per point after the first)
    const qCount = (path!.match(/Q /g) || []).length;
    expect(qCount).toBe(4);
  });

  it("handles flat data (all same values) without NaN", () => {
    const path = buildSparklinePath([50, 50, 50]);
    expect(path).not.toBeNull();
    expect(path).not.toContain("NaN");
  });
});
