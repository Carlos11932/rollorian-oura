"use client";

interface BreathingRateDisplayProps {
  averageBreath: number | null;
}

export function BreathingRateDisplay({
  averageBreath,
}: BreathingRateDisplayProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
        Resp. durante el sueño
      </p>
      {averageBreath != null ? (
        <p className="text-2xl font-bold text-emerald-300">
          {averageBreath.toFixed(1)}{" "}
          <span className="text-sm font-normal text-emerald-500">rpm</span>
        </p>
      ) : (
        <p className="text-sm text-emerald-700">Sin datos</p>
      )}
    </div>
  );
}
