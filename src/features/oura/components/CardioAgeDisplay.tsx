"use client";

interface CardioAgeDisplayProps {
  age: number | null;
}

function getAgeColor(age: number): string {
  if (age <= 35) return "var(--color-emerald-500)";
  if (age <= 50) return "var(--color-yellow-400)";
  return "var(--color-red-500)";
}

export function CardioAgeDisplay({ age }: CardioAgeDisplayProps) {
  const color = age != null ? getAgeColor(age) : "var(--color-emerald-600)";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <div
        className="flex h-[130px] w-[130px] flex-col items-center justify-center rounded-full border-4"
        style={{ borderColor: color }}
      >
        <span
          className="text-3xl font-bold leading-none"
          style={{ color }}
        >
          {age ?? "–"}
        </span>
        <span className="mt-1 text-xs text-emerald-500">edad cardio</span>
      </div>
    </div>
  );
}
