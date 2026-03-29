import { prisma } from "@/lib/prisma";
import type {
  OuraHeartRateEntry,
  OuraStressDaily,
  OuraResilienceDaily,
  OuraCardiovascularAge,
  OuraSpo2Daily,
  OuraVo2Max,
  OuraReadinessDaily,
} from "@prisma/client";

/** Safety cap: ~5 weeks at 5-min resolution to prevent runaway queries */
const HR_QUERY_CAP = 10_000

// ─── Heart Rate ───────────────────────────────────────────────────────────────

export async function getRawHeartRateEntries(
  day: string,
): Promise<OuraHeartRateEntry[]> {
  return prisma.ouraHeartRateEntry.findMany({
    where: { day },
    orderBy: { timestamp: "asc" },
  });
}

export async function getRawHeartRateEntriesInRange(
  gte: Date,
  lte: Date,
  excludeSource?: string,
): Promise<OuraHeartRateEntry[]> {
  return prisma.ouraHeartRateEntry.findMany({
    where: {
      timestamp: { gte, lte },
      ...(excludeSource ? { NOT: { source: excludeSource } } : {}),
    },
    orderBy: { timestamp: "asc" },
    take: HR_QUERY_CAP,
  });
}

// ─── Stress ───────────────────────────────────────────────────────────────────

export async function getRawStressDaily(
  startDay: string,
  endDay: string,
): Promise<OuraStressDaily[]> {
  return prisma.ouraStressDaily.findMany({
    where: {
      day: { gte: startDay, lte: endDay },
    },
    orderBy: { day: "asc" },
  });
}

// ─── Resilience ───────────────────────────────────────────────────────────────

export async function getRawResilienceDaily(
  day: string,
): Promise<OuraResilienceDaily | null> {
  return prisma.ouraResilienceDaily.findUnique({
    where: { day },
  });
}

// ─── Cardiovascular Age ───────────────────────────────────────────────────────

export async function getRawCardiovascularAge(
  day: string,
): Promise<OuraCardiovascularAge | null> {
  return prisma.ouraCardiovascularAge.findUnique({
    where: { day },
  });
}

export async function getRawCardiovascularAgeRange(
  startDay: string,
  endDay: string,
): Promise<OuraCardiovascularAge[]> {
  return prisma.ouraCardiovascularAge.findMany({
    where: { day: { gte: startDay, lte: endDay } },
    orderBy: { day: "asc" },
  });
}

// ─── SpO2 ─────────────────────────────────────────────────────────────────────

export async function getRawSpo2(day: string): Promise<OuraSpo2Daily | null> {
  return prisma.ouraSpo2Daily.findUnique({
    where: { day },
  });
}

// ─── VO2 Max ──────────────────────────────────────────────────────────────────

export async function getRawVo2Max(day: string): Promise<OuraVo2Max | null> {
  return prisma.ouraVo2Max.findUnique({
    where: { day },
  });
}

// ─── Readiness ────────────────────────────────────────────────────────────────

export async function getRawReadiness(
  day: string,
): Promise<OuraReadinessDaily | null> {
  return prisma.ouraReadinessDaily.findUnique({
    where: { day },
  });
}
