
import { cn } from "@/lib/cn";

const RESILIENCE_MAP: Record<string, { label: string; classes: string }> = {
  exceptional: {
    label: "Excepcional",
    classes: "bg-green-950 text-green-400 border border-green-800",
  },
  strong: {
    label: "Fuerte",
    classes: "bg-green-950 text-green-400 border border-green-800",
  },
  adequate: {
    label: "Adecuado",
    classes: "bg-amber-950 text-amber-400 border border-amber-800",
  },
  pay_attention: {
    label: "Atención",
    classes: "bg-red-950 text-red-400 border border-red-800",
  },
  restorative: {
    label: "Restaurador",
    classes: "bg-blue-950 text-blue-400 border border-blue-800",
  },
};

interface ResilienceBadgeProps {
  level: string | null;
}

export function ResilienceBadge({ level }: ResilienceBadgeProps) {
  if (!level) return null;

  const config = RESILIENCE_MAP[level] ?? {
    label: level,
    classes: "bg-surface-container-high text-on-surface-variant border border-outline-variant",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider",
        config.classes,
      )}
    >
      {config.label}
    </span>
  );
}