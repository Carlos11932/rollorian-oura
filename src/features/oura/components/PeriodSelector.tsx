
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import type { Period } from "@/features/oura/server/queries";

interface PeriodSelectorProps {
  activePeriod: Period;
}

const PERIODS: { label: string; value: Period }[] = [
  { label: "1D", value: "1d" },
  { label: "7D", value: "7d" },
  { label: "1M", value: "1m" },
  { label: "1A", value: "1a" },
];

export function PeriodSelector({ activePeriod }: PeriodSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSelect(value: Period) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", value);
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1">
      {PERIODS.map(({ label, value }) => {
        const isActive = activePeriod === value;
        return (
          <button
            key={value}
            onClick={() => handleSelect(value)}
            className={cn(
              "relative flex flex-col items-center px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors",
              isActive ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {label}
            {isActive && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
}