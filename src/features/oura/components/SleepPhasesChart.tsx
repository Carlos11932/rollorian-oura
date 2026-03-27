"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { SleepPhasePoint } from "@/features/oura/server/queries";

interface SleepPhasesChartProps {
  data: SleepPhasePoint[];
}

const PHASE_COLORS: Record<number, string> = {
  1: "#065f46", // deep — dark emerald
  2: "#a7f3d0", // light — light emerald
  3: "#10b981", // rem — emerald
  4: "#374151", // awake — gray
};

const PHASE_LABELS: Record<number, string> = {
  1: "Profundo",
  2: "Ligero",
  3: "REM",
  4: "Despierto",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: SleepPhasePoint }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const phase = payload[0]?.payload?.phase;
  return (
    <div className="rounded-lg border border-emerald-800 bg-emerald-950 p-3 text-xs shadow-lg">
      <p className="mb-1 font-medium text-emerald-300">{label}</p>
      <p className="font-mono" style={{ color: phase ? PHASE_COLORS[phase] : "#fff" }}>
        {phase != null ? PHASE_LABELS[phase] ?? "–" : "–"}
      </p>
    </div>
  );
}

export function SleepPhasesChart({ data }: SleepPhasesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-emerald-600">
        Sin datos de fases del sueño
      </div>
    );
  }

  // Explicit ticks only at whole hours present in the data
  const hourTicks = data
    .filter((d) => d.time.endsWith(":00"))
    .map((d) => d.time);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
        Sueño — fases
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -10, bottom: 0 }}
          barCategoryGap={0}
          barGap={0}
        >
          <XAxis
            dataKey="time"
            tick={{ fill: "#34d399", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            ticks={hourTicks}
          />
          <YAxis hide />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(16,185,129,0.08)" }}
          />
          <Bar dataKey="phase" maxBarSize={8} radius={0}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={PHASE_COLORS[entry.phase] ?? "#374151"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
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
