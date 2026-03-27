"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

interface SleepScoreGaugeProps {
  score: number | null;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "var(--color-emerald-500)";
  if (score >= 60) return "var(--color-yellow-400)";
  return "var(--color-red-500)";
}

export function SleepScoreGauge({ score }: SleepScoreGaugeProps) {
  const value = score ?? 0;
  const color = getScoreColor(value);
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
          {score ?? "–"}
        </span>
        <span className="mt-1 text-xs text-emerald-500">sleep</span>
      </div>
    </div>
  );
}
