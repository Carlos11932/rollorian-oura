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
  if (efficiency == null) {
    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: 140, height: 140 }}
      >
        <div className="flex h-[130px] w-[130px] flex-col items-center justify-center rounded-full border-4 border-emerald-900">
          <span className="text-2xl font-bold leading-none text-emerald-700">
            –
          </span>
          <span className="mt-1 text-xs text-emerald-700">Sin datos</span>
        </div>
      </div>
    );
  }

  const color = getEfficiencyColor(efficiency);
  const data = [{ value: efficiency, fill: color }];

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
          {`${efficiency}%`}
        </span>
        <span className="mt-1 text-xs text-emerald-500">eficiencia</span>
      </div>
    </div>
  );
}
