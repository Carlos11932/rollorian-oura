"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Period } from "@/features/oura/server/queries";

const PERIODS: { label: string; value: Period }[] = [
  { label: "7d", value: "7d" },
  { label: "14d", value: "14d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
];

interface PeriodSelectorProps {
  current: Period;
}

export function PeriodSelector({ current }: PeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(period: Period) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-emerald-800 bg-emerald-950 p-1">
      {PERIODS.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => handleChange(value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            current === value
              ? "bg-emerald-600 text-white"
              : "text-emerald-400 hover:bg-emerald-900 hover:text-emerald-200",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
