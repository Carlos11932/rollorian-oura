"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { StressIntradayPoint } from "@/features/oura/server/queries";

interface IntradayHRChartProps {
  data: StressIntradayPoint[];
}

const COLORS = {
  area: "var(--color-emerald-500)",
  gridLine: "var(--color-emerald-900)",
  text: "var(--color-emerald-400)",
};

const HOUR_LABELS: Record<number, string> = {
  0: "0h",
  6: "6h",
  12: "12h",
  18: "18h",
  23: "23h",
};

interface TooltipPayloadEntry {
  value: number;
  payload: StressIntradayPoint;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const { hour, bpm } = payload[0].payload;
  const hourStr = String(hour).padStart(2, "0");

  return (
    <div className="rounded-lg border border-emerald-800 bg-emerald-950 p-3 text-xs shadow-lg">
      <p className="font-medium text-emerald-300">
        {hourStr}:00 — {bpm} bpm
      </p>
    </div>
  );
}

function formatHourTick(value: number): string {
  return HOUR_LABELS[value] ?? "";
}

export function IntradayHRChart({ data }: IntradayHRChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-emerald-600">
        Sin datos para este día
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.area} stopOpacity={0.7} />
            <stop offset="95%" stopColor={COLORS.area} stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={COLORS.gridLine}
          vertical={false}
        />
        <XAxis
          dataKey="hour"
          tick={{ fill: COLORS.text, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatHourTick}
          ticks={[0, 6, 12, 18, 23]}
        />
        <YAxis
          tick={{ fill: COLORS.text, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          domain={[40, 120]}
          tickFormatter={(val: number) => `${val}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="bpm"
          stroke={COLORS.area}
          fill="url(#hrGrad)"
          strokeWidth={1.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
