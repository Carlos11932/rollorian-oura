"use client";

import type { SleepPhasePoint } from "@/features/oura/server/queries";

interface SleepPhasesChartProps {
  data: SleepPhasePoint[];
}

// Height of each phase block as fraction of total chart height
// deep = full height (most restorative), awake = very short
const PHASE_HEIGHT: Record<number, number> = {
  1: 1.0,   // deep
  2: 0.55,  // light
  3: 0.75,  // rem
  4: 0.2,   // awake
};

const PHASE_COLORS: Record<number, string> = {
  1: "#065f46",
  2: "#6ee7b7",
  3: "#10b981",
  4: "#4b5563",
};

const PHASE_LABELS: Record<number, string> = {
  1: "Profundo",
  2: "Ligero",
  3: "REM",
  4: "Despierto",
};

const CHART_HEIGHT = 80;

export function SleepPhasesChart({ data }: SleepPhasesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center text-sm text-emerald-600">
        Sin datos de fases del sueño
      </div>
    );
  }

  const total = data.length;

  // Hour tick positions: index of every :00 point
  const hourTicks = data
    .map((d, i) => ({ i, time: d.time }))
    .filter(({ time }) => time.endsWith(":00"));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
        Sueño — fases
      </p>

      {/* Hypnogram strip */}
      <div className="relative w-full" style={{ height: CHART_HEIGHT + 20 }}>
        <svg
          width="100%"
          height={CHART_HEIGHT}
          preserveAspectRatio="none"
          viewBox={`0 0 ${total} ${CHART_HEIGHT}`}
        >
          {data.map((point, i) => {
            const h = Math.round(PHASE_HEIGHT[point.phase] * CHART_HEIGHT);
            return (
              <rect
                key={i}
                x={i}
                y={CHART_HEIGHT - h}
                width={1.2}
                height={h}
                fill={PHASE_COLORS[point.phase] ?? "#4b5563"}
              />
            );
          })}
        </svg>

        {/* Time axis labels */}
        <div className="relative" style={{ height: 20 }}>
          {hourTicks.map(({ i, time }) => (
            <span
              key={time}
              className="absolute text-[10px] text-emerald-500 -translate-x-1/2"
              style={{ left: `${(i / total) * 100}%`, top: 2 }}
            >
              {time}
            </span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-500">
        {([1, 3, 2, 4] as const).map((phase) => (
          <span key={phase} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: PHASE_COLORS[phase] }}
            />
            {PHASE_LABELS[phase]}
          </span>
        ))}
      </div>
    </div>
  );
}
