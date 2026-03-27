"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SleepIntradayPoint } from "@/features/oura/server/queries";

interface SleepIntradayChartProps {
  data: SleepIntradayPoint[];
}

const CHART_COLORS = {
  line: "#818cf8",
  gridLine: "#064e3b",
  text: "#34d399",
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
  return (
    <div className="rounded-lg border border-emerald-800 bg-emerald-950 p-3 text-xs shadow-lg">
      <p className="mb-1 font-medium text-emerald-300">{label}</p>
      <p className="font-mono text-white">
        {payload[0]?.value != null ? `${payload[0].value} bpm` : "–"}
      </p>
    </div>
  );
}

function formatTick(value: string): string {
  return value.endsWith(":00") ? value : "";
}

export function SleepIntradayChart({ data }: SleepIntradayChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[160px] items-center justify-center text-sm text-emerald-600">
        Sin datos de sueño para este día
      </div>
    );
  }

  const bpms = data.map((d) => d.bpm);
  const minBpm = Math.max(0, Math.min(...bpms) - 10);
  const maxBpm = Math.max(...bpms) + 10;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
        FC durante el sueño
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.gridLine}
            vertical={false}
          />
          <XAxis
            dataKey="time"
            tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatTick}
            interval={3}
          />
          <YAxis
            tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            domain={[minBpm, maxBpm]}
            tickFormatter={(val: number) => `${val}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="bpm"
            stroke={CHART_COLORS.line}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
