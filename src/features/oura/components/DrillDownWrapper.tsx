"use client";

import { useRouter } from "next/navigation";
import { SleepAreaChart } from "./SleepAreaChart";
import type { SleepChartPoint } from "@/features/oura/server/queries";

interface DrillDownWrapperProps {
  data: SleepChartPoint[];
}

export function DrillDownWrapper({ data }: DrillDownWrapperProps) {
  const router = useRouter();

  function handleDayClick(date: string) {
    router.push(`?period=1d&date=${date}`);
  }

  return <SleepAreaChart data={data} onDayClick={handleDayClick} />;
}
