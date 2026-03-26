
import { cn } from "@/lib/cn";
import { Sparkline } from "./Sparkline";

const COLOR_MAP = {
  primary: {
    label: "text-on-surface-variant",
    value: "text-primary",
    unit: "text-on-surface-variant",
    sparklineColor: "stroke-primary",
  },
  secondary: {
    label: "text-on-surface-variant",
    value: "text-secondary",
    unit: "text-on-surface-variant",
    sparklineColor: "stroke-secondary",
  },
  tertiary: {
    label: "text-on-surface-variant",
    value: "text-tertiary",
    unit: "text-on-surface-variant",
    sparklineColor: "stroke-tertiary",
  },
} as const;

type CardColor = keyof typeof COLOR_MAP;

interface MetricCardProps {
  label: string;
  value: string | number | null;
  unit?: string;
  trend?: number[];
  featured?: boolean;
  color?: CardColor;
  className?: string;
}

export function MetricCard({
  label,
  value,
  unit,
  trend,
  featured = false,
  color = "primary",
  className,
}: MetricCardProps) {
  const colors = COLOR_MAP[color];
  const displayValue = value ?? "—";

  return (
    <div
      className={cn(
        "relative flex flex-col justify-between rounded-3xl bg-surface-container p-6 overflow-hidden",
        featured ? "min-h-[200px]" : "min-h-[120px]",
        className,
      )}
    >
      <p className={cn("text-xs font-semibold uppercase tracking-widest", colors.label)}>
        {label}
      </p>

      <div className="flex items-end gap-2 mt-2">
        <span
          className={cn(
            "font-bold leading-none tabular-nums",
            featured ? "text-[5rem]" : "text-4xl",
            colors.value,
          )}
        >
          {displayValue}
        </span>
        {unit && (
          <span className={cn("mb-1 text-sm font-medium", colors.unit)}>{unit}</span>
        )}
      </div>

      {trend && trend.length >= 2 && (
        <div className="absolute bottom-0 left-0 right-0 h-16 opacity-60">
          <Sparkline
            data={trend}
            color={colors.sparklineColor}
            className="w-full h-full"
          />
        </div>
      )}
    </div>
  );
}