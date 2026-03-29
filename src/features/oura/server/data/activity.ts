import { prisma } from "@/lib/prisma";
import type {
  OuraActivityDaily,
  OuraWorkout,
  OuraSession,
} from "@prisma/client";

// ─── Activity Daily ───────────────────────────────────────────────────────────

export async function getRawActivityDaily(
  startDay: string,
  endDay: string,
): Promise<OuraActivityDaily[]> {
  return prisma.ouraActivityDaily.findMany({
    where: {
      day: { gte: startDay, lte: endDay },
    },
    orderBy: { day: "asc" },
  });
}

// ─── Workouts ─────────────────────────────────────────────────────────────────

export async function getRawWorkouts(day: string): Promise<OuraWorkout[]> {
  return prisma.ouraWorkout.findMany({
    where: { day },
    orderBy: { startDatetime: "asc" },
  });
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function getRawSessions(day: string): Promise<OuraSession[]> {
  return prisma.ouraSession.findMany({
    where: { day },
    orderBy: { startDatetime: "asc" },
  });
}
