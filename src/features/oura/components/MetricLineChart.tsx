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

interface TooltipEntry {
  value: number | null;
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
  color = "#34d399",
}: MetricLineChartProps) {
  const values = data
    .map((d) => d[dataKey])
    .filter((v): v is number => typeof v === "number");

  const hasData = values.length > 0;

  // Y-axis domain with padding to avoid repeated ticks
  const min = hasData ? Math.min(...values) : 0;
  const max = hasData ? Math.max(...values) : 100;
  const padding = Math.max((max - min) * 0.2, 5);
  const domain: [number, number] = [
    Math.floor(min - padding),
    Math.ceil(max + padding),
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide">
        {label}
      </p>
      {!hasData ? (
        <div className="flex h-[100px] items-center justify-center text-xs text-emerald-700">
          Sin datos
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#064e3b"
              vertical={false}
            />
            <XAxis
              dataKey="day"
              tick={{ fill: "#34d399", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(val: string) => format(parseISO(val), "d/M")}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#34d399", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              domain={domain}
              tickCount={4}
              tickFormatter={(val: number) => `${Math.round(val)}${unit}`}
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
      )}
    </div>
  );
}
