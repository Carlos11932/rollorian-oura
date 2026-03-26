import { Suspense } from "react";
import { getSleepData, getRecoveryData } from "@/features/oura/server/queries";
import { PeriodSelector } from "@/features/oura/components/PeriodSelector";
import { SyncNowButton } from "@/features/oura/components/SyncNowButton";
import { MetricCard } from "@/features/oura/components/MetricCard";
import { ResilienceBadge } from "@/features/oura/components/ResilienceBadge";
import type { Period } from "@/features/oura/server/queries";

const VALID_PERIODS = ["1d", "7d", "1m", "1a"] as const;

function isValidPeriod(value: string | undefined): value is Period {
  return VALID_PERIODS.includes(value as Period);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period: Period = isValidPeriod(rawPeriod) ? rawPeriod : "7d";

  const [sleep, recovery] = await Promise.all([
    getSleepData(period),
    getRecoveryData(period),
  ]);

  const deepSleepMinutes = sleep.deepSleep ?? 0;
  const remMinutes = sleep.rem ?? 0;
  const totalChartMinutes = deepSleepMinutes + remMinutes || 1;
  const deepPct = Math.round((deepSleepMinutes / totalChartMinutes) * 100);
  const remPct = 100 - deepPct;

  return (
    <div className="flex min-h-screen bg-surface">
      {/* ─── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 fixed inset-y-0 left-0 z-30 bg-[#00110c] border-r border-outline-variant">
        <div className="flex flex-col gap-1 px-6 py-8">
          <span className="text-primary font-bold text-xl tracking-tight">The Archive</span>
          <span className="text-on-surface-variant text-xs">Última sync: hace poco</span>
        </div>

        <nav className="flex flex-col gap-1 px-3 flex-1">
          {[
            { icon: "dashboard", label: "Resumen", active: true },
            { icon: "bedtime", label: "Sueño", active: false },
            { icon: "fitness_center", label: "Actividad", active: false },
            { icon: "favorite", label: "Recuperación", active: false },
          ].map(({ icon, label, active }) => (
            <button
              key={label}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary-container text-on-primary-container"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-outline-variant">
          <button className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface w-full transition-colors">
            <span className="material-symbols-outlined text-[20px]">settings</span>
            Ajustes
          </button>
        </div>
      </aside>

      {/* ─── Main content ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 md:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-[#031712] border-b border-outline-variant">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-on-surface">
              Rollorian Oura
            </h1>
            <div className="flex items-center gap-4">
              <SyncNowButton />
              <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px] text-on-primary-container">
                  person
                </span>
              </div>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center px-6 pb-2">
            <Suspense fallback={null}>
              <PeriodSelector activePeriod={period} />
            </Suspense>
          </div>
        </header>

        <main className="flex-1 px-6 py-8 pb-24 md:pb-8 space-y-8">
          {/* ─── Sleep Section ──────────────────────────────────────── */}
          <section>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Sueño
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Featured: Score */}
              <MetricCard
                label="Puntuación sueño"
                value={sleep.score}
                unit="/ 100"
                trend={sleep.trend.map((t) => t.value)}
                featured
                color="primary"
                className="col-span-2 md:col-span-2"
              />

              {/* HRV */}
              <MetricCard
                label="HRV Medio"
                value={sleep.hrv}
                unit="ms"
                trend={sleep.trend.map((t) => t.value)}
                color="secondary"
              />

              {/* Hours + Efficiency */}
              <div className="rounded-3xl bg-surface-container p-6 flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">
                    Horas dormidas
                  </p>
                  <p className="text-3xl font-bold text-on-surface tabular-nums">
                    {sleep.hours ?? "—"}
                    <span className="text-sm font-medium text-on-surface-variant ml-1">h</span>
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                      Eficiencia
                    </p>
                    <p className="text-xs font-bold text-on-surface tabular-nums">
                      {sleep.efficiency != null ? `${sleep.efficiency}%` : "—"}
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
                    <div
                      className="h-full rounded-full bg-secondary"
                      style={{ width: `${sleep.efficiency ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Sleep cycles */}
              <div className="rounded-3xl bg-surface-container p-6 flex flex-col gap-4 col-span-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Ciclos de sueño
                </p>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-on-surface-variant">Sueño profundo</span>
                      <span className="text-xs font-bold text-primary tabular-nums">
                        {deepSleepMinutes}m
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${deepPct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-on-surface-variant">REM</span>
                      <span className="text-xs font-bold text-secondary tabular-nums">
                        {remMinutes}m
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
                      <div
                        className="h-full rounded-full bg-secondary"
                        style={{ width: `${remPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ─── Recovery Section ───────────────────────────────────── */}
          <section>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Recuperación
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Readiness featured */}
              <div className="rounded-3xl bg-surface-container p-6 col-span-2 flex flex-col justify-between min-h-[200px] relative overflow-hidden">
                <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Preparación
                </p>
                <div className="flex flex-col gap-2 mt-2">
                  <span className="text-[5rem] font-bold leading-none tabular-nums text-primary">
                    {recovery.readiness ?? "—"}
                  </span>
                  <ResilienceBadge level={recovery.resilience} />
                </div>
                {recovery.trend.length >= 2 && (
                  <div className="absolute bottom-0 left-0 right-0 h-16 opacity-60">
                    <svg
                      viewBox="0 0 100 40"
                      preserveAspectRatio="none"
                      className="w-full h-full sparkline-glow"
                      aria-hidden="true"
                    >
                      {(() => {
                        const values = recovery.trend.map((t) => t.value);
                        const min = Math.min(...values);
                        const max = Math.max(...values);
                        const range = max - min || 1;
                        const pts = values.map((v, i) => ({
                          x: (i / (values.length - 1)) * 100,
                          y: 40 - ((v - min) / range) * 36 - 2,
                        }));
                        let d = `M ${pts[0].x} ${pts[0].y}`;
                        for (let i = 1; i < pts.length; i++) {
                          const cpx = (pts[i - 1].x + pts[i].x) / 2;
                          d += ` Q ${cpx} ${pts[i - 1].y} ${pts[i].x} ${pts[i].y}`;
                        }
                        return (
                          <path
                            d={d}
                            fill="none"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="stroke-primary"
                          />
                        );
                      })()}
                    </svg>
                  </div>
                )}
              </div>

              {/* Resting HR */}
              <MetricCard
                label="FC en reposo"
                value={recovery.restingHR}
                unit="bpm"
                color="tertiary"
              />

              {/* Resilience level card */}
              <div className="rounded-3xl bg-surface-container p-6 flex flex-col justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Resiliencia
                </p>
                <div className="flex flex-col items-center justify-center flex-1 py-4">
                  {recovery.resilience ? (
                    <ResilienceBadge level={recovery.resilience} />
                  ) : (
                    <span className="text-3xl font-bold text-on-surface-variant">—</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <footer className="hidden md:flex items-center justify-between px-8 py-4 border-t border-outline-variant">
          <SyncNowButton />
          <span className="text-xs text-on-surface-variant">
            The Archive v1.0.0 — Cifrado &amp; Privado
          </span>
        </footer>
      </div>

      {/* ─── Mobile bottom nav ────────────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 md:hidden glass-header border-t border-outline-variant">
        <div className="flex items-center justify-around px-4 py-3">
          {[
            { icon: "dashboard", label: "Inicio" },
            { icon: "bedtime", label: "Sueño" },
            { icon: "fitness_center", label: "Actividad" },
            { icon: "rebase_edit", label: "Notas" },
          ].map(({ icon, label }) => (
            <button
              key={label}
              className="flex flex-col items-center gap-1 text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">{icon}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}