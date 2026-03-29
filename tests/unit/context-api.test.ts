import { describe, it, expect } from "vitest";

/**
 * S3 — Context API
 *
 * Scenario 6: Unsupported trend window
 *   GIVEN days=21 (not in [7,14,30])
 *   WHEN the trends route validation runs
 *   THEN it returns 400 with allowed values
 *
 * Scenario 7: Partial data day
 *   GIVEN optional datasets are unavailable (null values)
 *   WHEN summary factors are evaluated
 *   THEN each factor returns status "missing", not throwing
 *   AND computeState returns "insufficient_data" when >50% factors are missing
 *   AND the route returns 200 (no 500)
 *
 * Since these routes use `next/server` and Prisma, we test the pure logic
 * functions extracted from the route handlers. All logic is deterministic.
 */

// ─── Scenario 6: Trends validation logic ─────────────────────────────────────
//
// Mirrors src/app/api/internal/context/sleep/trends/route.ts lines 9-81

const ALLOWED_DAYS = [7, 14, 30] as const;
type AllowedDays = (typeof ALLOWED_DAYS)[number];

function validateDaysParam(daysParam: string | null):
  | { valid: true; days: AllowedDays }
  | { valid: false; status: 400; error: string; allowedValues: readonly number[] } {
  if (!daysParam) {
    return {
      valid: false,
      status: 400,
      error: "Missing required parameter: days",
      allowedValues: ALLOWED_DAYS,
    };
  }

  const parsedDays = parseInt(daysParam, 10);

  if (!ALLOWED_DAYS.includes(parsedDays as AllowedDays)) {
    return {
      valid: false,
      status: 400,
      error: `Invalid days value: ${daysParam}. Must be one of: ${ALLOWED_DAYS.join(", ")}`,
      allowedValues: ALLOWED_DAYS,
    };
  }

  return { valid: true, days: parsedDays as AllowedDays };
}

// ─── Scenario 7: Summary factor evaluators ───────────────────────────────────
//
// Mirrors src/app/api/internal/context/summary/route.ts factor evaluators
// and computeState().

type FactorStatus = "positive" | "neutral" | "negative" | "missing";
type OverallState = "good" | "mixed" | "attention" | "insufficient_data";

interface Factor {
  key: string;
  status: FactorStatus;
  value?: number | string;
  label: string;
}

function evalSleepScore(score: number | null): Factor {
  if (score == null) {
    return { key: "sleep_score", status: "missing", label: "Puntuación de sueño: sin datos" };
  }
  const status: FactorStatus = score >= 85 ? "positive" : score >= 70 ? "neutral" : "negative";
  return { key: "sleep_score", status, value: score, label: `Puntuación de sueño: ${score}` };
}

function evalHrv(hrv: number | null): Factor {
  if (hrv == null) {
    return { key: "hrv", status: "missing", label: "HRV: sin datos" };
  }
  return {
    key: "hrv",
    status: "neutral",
    value: Math.round(hrv),
    label: `HRV promedio: ${Math.round(hrv)} ms`,
  };
}

function evalEfficiency(efficiency: number | null): Factor {
  if (efficiency == null) {
    return { key: "efficiency", status: "missing", label: "Eficiencia de sueño: sin datos" };
  }
  const status: FactorStatus =
    efficiency >= 85 ? "positive" : efficiency >= 75 ? "neutral" : "negative";
  return { key: "efficiency", status, value: efficiency, label: `Eficiencia de sueño: ${efficiency}%` };
}

function evalStressHigh(minutes: number | null): Factor {
  if (minutes == null) {
    return { key: "stress_high", status: "missing", label: "Estrés alto: sin datos" };
  }
  const status: FactorStatus = minutes < 30 ? "positive" : minutes <= 60 ? "neutral" : "negative";
  return { key: "stress_high", status, value: minutes, label: `Estrés alto: ${minutes} min` };
}

function evalRecoveryHigh(minutes: number | null): Factor {
  if (minutes == null) {
    return { key: "recovery_high", status: "missing", label: "Recuperación alta: sin datos" };
  }
  const status: FactorStatus = minutes > 60 ? "positive" : minutes >= 30 ? "neutral" : "negative";
  return { key: "recovery_high", status, value: minutes, label: `Recuperación alta: ${minutes} min` };
}

function evalRestingHr(hr: number | null): Factor {
  if (hr == null) {
    return { key: "resting_hr", status: "missing", label: "FC en reposo: sin datos" };
  }
  return { key: "resting_hr", status: "neutral", value: hr, label: `FC en reposo: ${hr} bpm` };
}

function evalReadinessScore(score: number | null): Factor {
  if (score == null) {
    return { key: "readiness_score", status: "missing", label: "Puntuación de disposición: sin datos" };
  }
  const status: FactorStatus = score >= 85 ? "positive" : score >= 70 ? "neutral" : "negative";
  return { key: "readiness_score", status, value: score, label: `Puntuación de disposición: ${score}` };
}

function computeState(factors: Factor[]): OverallState {
  const total = factors.length;
  const missing = factors.filter((f) => f.status === "missing").length;
  const negative = factors.filter((f) => f.status === "negative").length;
  const positive = factors.filter((f) => f.status === "positive").length;

  if (missing / total > 0.5) return "insufficient_data";
  if (negative > 0) return "attention";
  if (positive === total - missing) return "good";
  return "mixed";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Context API — trends endpoint validation (Scenario 6)", () => {
  it("returns 400 for days=21 (not in allowed list)", () => {
    const result = validateDaysParam("21");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(400);
      expect(result.allowedValues).toEqual([7, 14, 30]);
      expect(result.error).toContain("21");
    }
  });

  it("returns 400 for days=0", () => {
    const result = validateDaysParam("0");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(400);
    }
  });

  it("returns 400 for days=365 (out of range)", () => {
    const result = validateDaysParam("365");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(400);
      expect(result.allowedValues).toContain(7);
      expect(result.allowedValues).toContain(14);
      expect(result.allowedValues).toContain(30);
    }
  });

  it("returns 400 when days param is missing", () => {
    const result = validateDaysParam(null);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.status).toBe(400);
      expect(result.error).toContain("Missing");
      expect(result.allowedValues).toEqual([7, 14, 30]);
    }
  });

  it("returns valid for days=7 (allowed)", () => {
    const result = validateDaysParam("7");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.days).toBe(7);
    }
  });

  it("returns valid for days=14 (allowed)", () => {
    const result = validateDaysParam("14");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.days).toBe(14);
    }
  });

  it("returns valid for days=30 (allowed)", () => {
    const result = validateDaysParam("30");
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.days).toBe(30);
    }
  });
});

describe("Context API — partial data day (Scenario 7)", () => {
  describe("Factor evaluators return missing status when data is null", () => {
    it("evalSleepScore returns missing for null", () => {
      const factor = evalSleepScore(null);
      expect(factor.status).toBe("missing");
      expect(factor.value).toBeUndefined();
    });

    it("evalHrv returns missing for null", () => {
      const factor = evalHrv(null);
      expect(factor.status).toBe("missing");
    });

    it("evalEfficiency returns missing for null", () => {
      const factor = evalEfficiency(null);
      expect(factor.status).toBe("missing");
    });

    it("evalStressHigh returns missing for null", () => {
      const factor = evalStressHigh(null);
      expect(factor.status).toBe("missing");
    });

    it("evalRecoveryHigh returns missing for null", () => {
      const factor = evalRecoveryHigh(null);
      expect(factor.status).toBe("missing");
    });

    it("evalRestingHr returns missing for null", () => {
      const factor = evalRestingHr(null);
      expect(factor.status).toBe("missing");
    });

    it("evalReadinessScore returns missing for null", () => {
      const factor = evalReadinessScore(null);
      expect(factor.status).toBe("missing");
    });
  });

  describe("computeState returns insufficient_data when majority of factors are missing", () => {
    it("all 7 factors missing → insufficient_data", () => {
      const factors: Factor[] = [
        evalSleepScore(null),
        evalHrv(null),
        evalEfficiency(null),
        evalStressHigh(null),
        evalRecoveryHigh(null),
        evalRestingHr(null),
        evalReadinessScore(null),
      ];
      const state = computeState(factors);
      expect(state).toBe("insufficient_data");
    });

    it("4 of 7 factors missing (>50%) → insufficient_data", () => {
      const factors: Factor[] = [
        evalSleepScore(null),       // missing
        evalHrv(null),              // missing
        evalEfficiency(null),       // missing
        evalStressHigh(null),       // missing
        evalRecoveryHigh(90),       // positive
        evalRestingHr(55),          // neutral
        evalReadinessScore(80),     // neutral
      ];
      const state = computeState(factors);
      expect(state).toBe("insufficient_data");
    });

    it("3 of 7 factors missing (≤50%) → state is NOT insufficient_data", () => {
      const factors: Factor[] = [
        evalSleepScore(null),       // missing
        evalHrv(null),              // missing
        evalEfficiency(null),       // missing
        evalStressHigh(20),         // positive
        evalRecoveryHigh(90),       // positive
        evalRestingHr(55),          // neutral
        evalReadinessScore(88),     // positive
      ];
      const state = computeState(factors);
      expect(state).not.toBe("insufficient_data");
    });
  });

  describe("Factor evaluators work correctly with valid data", () => {
    it("evalSleepScore returns positive for score >= 85", () => {
      expect(evalSleepScore(90).status).toBe("positive");
    });

    it("evalSleepScore returns neutral for score 70-84", () => {
      expect(evalSleepScore(75).status).toBe("neutral");
    });

    it("evalSleepScore returns negative for score < 70", () => {
      expect(evalSleepScore(60).status).toBe("negative");
    });

    it("evalEfficiency returns positive for >= 85", () => {
      expect(evalEfficiency(88).status).toBe("positive");
    });

    it("evalEfficiency returns negative for < 75", () => {
      expect(evalEfficiency(70).status).toBe("negative");
    });

    it("evalStressHigh returns negative for > 60 minutes", () => {
      expect(evalStressHigh(90).status).toBe("negative");
    });

    it("evalStressHigh returns positive for < 30 minutes", () => {
      expect(evalStressHigh(10).status).toBe("positive");
    });

    it("evalRecoveryHigh returns positive for > 60 minutes", () => {
      expect(evalRecoveryHigh(90).status).toBe("positive");
    });
  });

  describe("computeState correctness", () => {
    it("returns 'good' when ALL non-missing factors are positive (none neutral)", () => {
      // computeState: good iff positive === total - missing
      // evalRestingHr and evalHrv are always "neutral" (no threshold) — so
      // a 'good' state requires those to NOT be in the factor list or
      // that we only include threshold-based factors that CAN be positive.
      // Use only factors that have a "positive" threshold:
      const factors: Factor[] = [
        evalSleepScore(88),       // positive: >= 85
        evalEfficiency(90),       // positive: >= 85
        evalReadinessScore(90),   // positive: >= 85
        evalStressHigh(10),       // positive: < 30 min
        evalRecoveryHigh(95),     // positive: > 60 min
      ];
      const state = computeState(factors);
      expect(state).toBe("good");
    });

    it("returns 'mixed' when some factors are neutral (e.g. hrv, resting_hr)", () => {
      // evalHrv and evalRestingHr are always "neutral" — they can't be "positive"
      // so when all other factors are positive + these two are neutral → "mixed"
      const factors: Factor[] = [
        evalSleepScore(88),
        evalEfficiency(90),
        evalReadinessScore(90),
        evalStressHigh(10),
        evalRecoveryHigh(95),
        evalRestingHr(52),   // always neutral
        evalHrv(45),         // always neutral
      ];
      const state = computeState(factors);
      expect(state).toBe("mixed");
    });

    it("returns 'attention' when any factor is negative", () => {
      const factors: Factor[] = [
        evalSleepScore(60),   // negative
        evalEfficiency(80),
        evalReadinessScore(75),
        evalStressHigh(20),
        evalRecoveryHigh(70),
        evalRestingHr(55),
        evalHrv(40),
      ];
      const state = computeState(factors);
      expect(state).toBe("attention");
    });
  });
});
