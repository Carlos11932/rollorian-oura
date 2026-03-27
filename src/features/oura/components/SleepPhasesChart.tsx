"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
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

interface TooltipEntry {
  value: number | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;
  const phase = payload[0]?.value;
  return (
    <div className="rounded-lg border border-emerald-800 bg-emerald-950 p-3 text-xs shadow-lg">
      <p className="mb-1 font-medium text-emerald-300">{label}</p>
      <p className="font-mono text-white">
        {phase != null ? PHASE_LABELS[phase] ?? "–" : "–"}
      </p>
    </div>
  );
}

function formatXTick(value: string): string {
  return value.endsWith(":00") ? value : "";
}

function formatYTick(value: number): string {
  return PHASE_LABELS[value] ?? "";
}

export function SleepPhasesChart({ data }: SleepPhasesChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-emerald-600">
        Sin datos de fases del sueño
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
        Sueño — fases
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, left: 10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="phaseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#065f46" stopOpacity={0.8} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#064e3b"
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: "#34d399", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatXTick}
            interval={5}
          />
          <YAxis
            domain={[0.5, 4.5]}
            ticks={[1, 2, 3, 4]}
            tick={{ fill: "#34d399", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYTick}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="stepAfter"
            dataKey="phase"
            stroke="#10b981"
            strokeWidth={1.5}
            fill="url(#phaseGradient)"
            dot={(props) => {
              const { cx, cy, payload } = props as {
                cx: number;
                cy: number;
                payload: SleepPhasePoint;
              };
              return (
                <circle
                  key={`dot-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={0}
                  fill={PHASE_COLORS[payload.phase]}
                />
              );
            }}
            activeDot={{ r: 3, fill: "#10b981" }}
          />
        </AreaChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-emerald-500">
        {([4, 3, 2, 1] as const).map((phase) => (
          <span key={phase} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-3 rounded-sm"
              style={{ backgroundColor: PHASE_COLORS[phase] }}
            />
            {PHASE_LABELS[phase]}
          </span>
        ))}
      </div>
    </div>
  );
}
