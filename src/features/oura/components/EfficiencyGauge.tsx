"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

interface EfficiencyGaugeProps {
  efficiency: number | null;
}

function getEfficiencyColor(value: number): string {
  if (value >= 85) return "var(--color-emerald-500)";
  if (value >= 70) return "var(--color-yellow-400)";
  return "var(--color-red-500)";
}

export function EfficiencyGauge({ efficiency }: EfficiencyGaugeProps) {
  const value = efficiency ?? 0;
  const color = getEfficiencyColor(value);
  const data = [{ value, fill: color }];

  return (
    <div className="relative flex items-center justify-center">
      <RadialBarChart
        width={140}
        height={140}
        innerRadius={50}
        outerRadius={65}
        data={data}
        startAngle={225}
        endAngle={-45}
      >
        <PolarAngleAxis
          type="number"
          domain={[0, 100]}
          angleAxisId={0}
          tick={false}
        />
        <RadialBar
          dataKey="value"
          cornerRadius={6}
          background={{ fill: "var(--color-emerald-950)" }}
          angleAxisId={0}
        />
      </RadialBarChart>
      <div className="absolute flex flex-col items-center">
        <span
          className="text-3xl font-bold leading-none"
          style={{ color }}
        >
          {efficiency != null ? `${efficiency}%` : "–"}
        </span>
        <span className="mt-1 text-xs text-emerald-500">eficiencia</span>
      </div>
    </div>
  );
}
