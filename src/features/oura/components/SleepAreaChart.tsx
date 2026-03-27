"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type MouseHandlerDataParam,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { SleepChartPoint } from "@/features/oura/server/queries";

interface SleepAreaChartProps {
  data: SleepChartPoint[];
  onDayClick?: (date: string) => void;
}

const COLORS = {
  deep: "#065f46",
  rem: "#10b981",
  light: "#a7f3d0",
  gridLine: "#064e3b",
  text: "#34d399",
};

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length || !label) return null;

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0);

  return (
    <div className="rounded-lg border border-emerald-800 bg-emerald-950 p-3 text-xs shadow-lg">
      <p className="mb-2 font-medium text-emerald-300">
        {format(parseISO(label), "d MMM")}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="capitalize text-emerald-400">{entry.name}</span>
          <span className="font-mono text-white">
            {entry.value.toFixed(1)}h
          </span>
        </div>
      ))}
      <div className="mt-2 border-t border-emerald-800 pt-2 flex items-center justify-between gap-4">
        <span className="text-emerald-300">Total</span>
        <span className="font-mono font-semibold text-white">
          {total.toFixed(1)}h
        </span>
      </div>
    </div>
  );
}

export function SleepAreaChart({ data, onDayClick }: SleepAreaChartProps) {
  function handleClick(state: MouseHandlerDataParam) {
    const index = state.activeTooltipIndex;
    if (typeof index === "number") {
      const day = data[index]?.day;
      if (day) onDayClick?.(day);
    }
  }

  const hasBreakdown = data.some((d) => d.deep > 0 || d.rem > 0 || d.light > 0);
  const hasAnyData = data.some(
    (d) => d.totalHours > 0 || d.deep > 0 || d.rem > 0 || d.light > 0,
  );

  if (!hasAnyData) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-emerald-700">
        Sin datos de sueño
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart
        data={data}
        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
        onClick={handleClick}
        style={onDayClick ? { cursor: "pointer" } : undefined}
      >
        <defs>
          <linearGradient id="deepGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.deep} stopOpacity={0.9} />
            <stop offset="95%" stopColor={COLORS.deep} stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="remGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.rem} stopOpacity={0.9} />
            <stop offset="95%" stopColor={COLORS.rem} stopOpacity={0.4} />
          </linearGradient>
          <linearGradient id="lightGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.light} stopOpacity={0.7} />
            <stop offset="95%" stopColor={COLORS.light} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={COLORS.gridLine}
          vertical={false}
        />
        <XAxis
          dataKey="day"
          tick={{ fill: COLORS.text, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(val: string) => format(parseISO(val), "d/M")}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: COLORS.text, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          domain={[0, 10]}
          tickFormatter={(val: number) => `${val}h`}
        />
        <Tooltip content={<CustomTooltip />} />
        {hasBreakdown ? (
          <>
            <Area
              type="monotone"
              dataKey="deep"
              stackId="1"
              stroke={COLORS.deep}
              fill="url(#deepGrad)"
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="rem"
              stackId="1"
              stroke={COLORS.rem}
              fill="url(#remGrad)"
              strokeWidth={1.5}
            />
            <Area
              type="monotone"
              dataKey="light"
              stackId="1"
              stroke={COLORS.light}
              fill="url(#lightGrad)"
              strokeWidth={1.5}
            />
          </>
        ) : (
          <Area
            type="monotone"
            dataKey="totalHours"
            stroke={COLORS.rem}
            fill="url(#remGrad)"
            strokeWidth={1.5}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
