"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { MetricsPoint } from "@/features/oura/server/queries";

interface StressBarChartProps {
  data: MetricsPoint[];
}

const COLORS = {
  stress: "var(--color-red-500)",
  recovery: "var(--color-emerald-500)",
  gridLine: "var(--color-emerald-900)",
  text: "var(--color-emerald-400)",
};

interface TooltipEntry {
  value: number | null;
  name: string;
  color: string;
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
      <p className="mb-2 font-medium text-emerald-300">
        {format(parseISO(label), "d MMM")}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4"
        >
          <span className="capitalize" style={{ color: entry.color }}>
            {entry.name}
          </span>
          <span className="font-mono text-white">
            {entry.value != null ? `${Math.round(entry.value)}min` : "–"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function StressBarChart({ data }: StressBarChartProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
        Estrés diario
      </p>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={COLORS.gridLine}
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{ fill: COLORS.text, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val: string) => format(parseISO(val), "d/M")}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: COLORS.text, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val: number) => `${val}m`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar
            dataKey="stressHigh"
            name="Estrés"
            fill={COLORS.stress}
            radius={[2, 2, 0, 0]}
            maxBarSize={12}
          />
          <Bar
            dataKey="recoveryHigh"
            name="Recuperación"
            fill={COLORS.recovery}
            radius={[2, 2, 0, 0]}
            maxBarSize={12}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
