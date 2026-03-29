import { prisma } from "@/lib/prisma";
import type { OuraSleepDaily, OuraSleepPeriod } from "@prisma/client";

// ─── Raw Sleep Daily ──────────────────────────────────────────────────────────

export async function getRawSleepDaily(
  startDay: string,
  endDay: string,
): Promise<OuraSleepDaily[]> {
  return prisma.ouraSleepDaily.findMany({
    where: {
      day: { gte: startDay, lte: endDay },
    },
    orderBy: { day: "asc" },
  });
}

// ─── Raw Sleep Periods ────────────────────────────────────────────────────────

export async function getRawSleepPeriods(
  day: string,
): Promise<OuraSleepPeriod[]> {
  return prisma.ouraSleepPeriod.findMany({
    where: { day },
    orderBy: { period: "asc" },
  });
}

// ─── Raw Sleep Phase Data ─────────────────────────────────────────────────────

export async function getRawSleepPhaseData(day: string): Promise<
  Array<{
    id: string;
    ouraId: string;
    day: string;
    period: number;
    bedtimeStart: Date;
    bedtimeEnd: Date;
    sleepType: string;
    sleepPhaseData: string | null;
  }>
> {
  return prisma.ouraSleepPeriod.findMany({
    where: { day },
    select: {
      id: true,
      ouraId: true,
      day: true,
      period: true,
      bedtimeStart: true,
      bedtimeEnd: true,
      sleepType: true,
      sleepPhaseData: true,
    },
    orderBy: { period: "asc" },
  });
}

// ─── Raw Sleep Trend ──────────────────────────────────────────────────────────

export async function getRawSleepTrend(days: number): Promise<OuraSleepDaily[]> {
  // Use offset to get last N records ordered by day desc, then re-sort asc
  const rows = await prisma.ouraSleepDaily.findMany({
    orderBy: { day: "desc" },
    take: days,
  });

  return rows.reverse();
}
