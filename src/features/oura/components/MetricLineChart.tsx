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
import { format, parseISO } from "date-fns";

type DataPoint = Record<string, string | number | null>;

interface MetricLineChartProps {
  data: DataPoint[];
  dataKey: string;
  label: string;
  unit: string;
  color?: string;
}

const CHART_COLORS = {
  gridLine: "var(--color-emerald-900)",
  text: "var(--color-emerald-400)",
};

interface TooltipEntry {
  value: number | null;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  unit: string;
}

function CustomTooltip({ active, payload, label, unit }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-lg border border-emerald-800 bg-emerald-950 p-3 text-xs shadow-lg">
      <p className="mb-1 font-medium text-emerald-300">
        {format(parseISO(label), "d MMM")}
      </p>
      <p className="font-mono text-white">
        {payload[0]?.value != null ? `${payload[0].value}${unit}` : "–"}
      </p>
    </div>
  );
}

export function MetricLineChart({
  data,
  dataKey,
  label,
  unit,
  color = "var(--color-emerald-500)",
}: MetricLineChartProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
        {label}
      </p>
      <ResponsiveContainer width="100%" height={100}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={CHART_COLORS.gridLine}
            vertical={false}
          />
          <XAxis
            dataKey="day"
            tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val: string) => format(parseISO(val), "d/M")}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: CHART_COLORS.text, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val: number) => `${val}${unit}`}
          />
          <Tooltip content={<CustomTooltip unit={unit} />} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
