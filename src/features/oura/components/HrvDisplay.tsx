"use client";

interface HrvDisplayProps {
  averageHrv: number | null;
}

export function HrvDisplay({ averageHrv }: HrvDisplayProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
        HRV medio
      </p>
      {averageHrv != null ? (
        <p className="text-2xl font-bold text-emerald-300">
          {averageHrv.toFixed(0)}{" "}
          <span className="text-sm font-normal text-emerald-500">ms</span>
        </p>
      ) : (
        <p className="text-sm text-emerald-700">Sin datos</p>
      )}
    </div>
  );
}
