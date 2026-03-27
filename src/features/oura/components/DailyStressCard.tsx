"use client";

interface DailyStressCardProps {
  stressHighMin: number | null;
  recoveryHighMin: number | null;
}

export function DailyStressCard({
  stressHighMin,
  recoveryHighMin,
}: DailyStressCardProps) {
  if (stressHighMin == null && recoveryHighMin == null) {
    return (
      <div className="flex h-[80px] items-center justify-center text-sm text-emerald-600">
        Sin datos de estrés
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
        Estrés del día
      </p>
      <div className="flex items-center justify-around gap-2">
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold leading-none" style={{ color: "#f87171" }}>
            {stressHighMin != null ? Math.round(stressHighMin) : "–"}
          </span>
          <span className="text-xs text-emerald-500">min estrés</span>
        </div>
        <div className="h-8 w-px bg-emerald-800" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold leading-none" style={{ color: "#34d399" }}>
            {recoveryHighMin != null ? Math.round(recoveryHighMin) : "–"}
          </span>
          <span className="text-xs text-emerald-500">min recuperación</span>
        </div>
      </div>
    </div>
  );
}
