export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  getDailyHealthSnapshot,
  getDailyHealthTrend,
  average,
  secondsToHours,
  secondsToMinutes,
} from "@/features/oura/server/health-snapshot";
import { buildDailyHealthSummary } from "@/features/oura/server/health-summary";
import {
  areInsightsStale,
  generateInsights,
  getStoredInsights,
} from "@/features/oura/server/insights/engine";
import {
  getIntradayHeartRate,
  getMetricsData,
  getSleepChartData,
  getSleepPhaseData,
  type Period,
} from "@/features/oura/server/queries";
import { getRawResilienceDaily } from "@/features/oura/server/data";
import { getRawSessions, getRawWorkouts } from "@/features/oura/server/data/activity";
import { DrillDownWrapper } from "@/features/oura/components/DrillDownWrapper";
import { SleepScoreGauge } from "@/features/oura/components/SleepScoreGauge";
import { EfficiencyGauge } from "@/features/oura/components/EfficiencyGauge";
import { CardioAgeDisplay } from "@/features/oura/components/CardioAgeDisplay";
import { MetricLineChart } from "@/features/oura/components/MetricLineChart";
import { IntradayHRChart } from "@/features/oura/components/IntradayHRChart";
import { SleepPhasesChart } from "@/features/oura/components/SleepPhasesChart";
import { BreathingRateDisplay } from "@/features/oura/components/BreathingRateDisplay";
import { HrvDisplay } from "@/features/oura/components/HrvDisplay";
import { DailyStressCard } from "@/features/oura/components/DailyStressCard";
import { PeriodSelector } from "@/features/oura/components/PeriodSelector";
import { SyncButton } from "@/features/oura/components/SyncButton";
import { StressBarChart } from "@/features/oura/components/StressBarChart";
import { ResilienceBadge } from "@/features/oura/components/ResilienceBadge";

const VALID_PERIODS = ["1d", "7d", "14d", "30d", "90d"] as const;
const PERIOD_DAY_COUNT: Record<Period, number> = {
  "1d": 1,
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
};

type ValidPeriod = (typeof VALID_PERIODS)[number];

function isValidPeriod(value: string | undefined): value is ValidPeriod {
  return VALID_PERIODS.includes(value as ValidPeriod);
}

function stateStyles(state: "good" | "mixed" | "attention" | "insufficient_data") {
  switch (state) {
    case "good":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
    case "attention":
      return "border-rose-500/30 bg-rose-500/10 text-rose-200";
    case "insufficient_data":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    default:
      return "border-emerald-300/20 bg-emerald-300/10 text-emerald-100";
  }
}

function formatDay(day: string) {
  return format(parseISO(day), "EEEE d MMM", { locale: es });
}

function formatLastSync(lastSync: string | null) {
  if (lastSync == null) return "Sin sync valido"
  return format(parseISO(lastSync), "d MMM HH:mm", { locale: es })
}

function formatMetric(value: number | null, unit = "", digits = 0) {
  if (value == null) return "n/a"
  return `${value.toFixed(digits)}${unit}`
}

function latestInsightList(
  insights: Array<{ title: string; message: string; severity: string }>,
) {
  if (insights.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-900/80 bg-emerald-950/40 p-4 text-sm text-emerald-500">
        Sin insights generados todavia.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {insights.slice(0, 4).map((insight) => (
        <div
          key={`${insight.severity}-${insight.title}`}
          className="rounded-2xl border border-emerald-900/80 bg-emerald-950/40 p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-emerald-100">{insight.title}</p>
            <span className="rounded-full border border-emerald-700/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              {insight.severity}
            </span>
          </div>
          <p className="text-sm leading-6 text-emerald-300/85">{insight.message}</p>
        </div>
      ))}
    </div>
  )
}

async function getInsightsForDay(day: string) {
  const stale = await areInsightsStale(day)
  const rows = stale ? await generateInsights(day) : await getStoredInsights(day)

  return rows.map((row) => ({
    title: row.title,
    message: row.message,
    severity: row.severity,
  }))
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawPeriod =
    typeof params["period"] === "string" ? params["period"] : undefined;
  const rawDate =
    typeof params["date"] === "string" ? params["date"] : undefined;

  const period: Period = isValidPeriod(rawPeriod) ? rawPeriod : "1d";
  const selectedDate: string | undefined =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;

  const today = format(new Date(), "yyyy-MM-dd");

  if (period === "1d") {
    const targetDate = selectedDate ?? today;
    const [
      snapshot,
      intradayHRData,
      sleepPhaseData,
      insights,
      resilience,
      workouts,
      sessions,
    ] = await Promise.all([
      getDailyHealthSnapshot(targetDate),
      getIntradayHeartRate(targetDate),
      getSleepPhaseData(targetDate),
      getInsightsForDay(targetDate),
      getRawResilienceDaily(targetDate),
      getRawWorkouts(targetDate),
      getRawSessions(targetDate),
    ]);

    const summary = buildDailyHealthSummary(snapshot);
    const sleep = snapshot.sleep;
    const activity = snapshot.activity;
    const stress = snapshot.stress;
    const vitals = snapshot.vitals;

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_40%),linear-gradient(180deg,_rgba(2,44,34,0.98),_rgba(2,24,20,1))] px-4 py-6 md:px-6">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-400/80">
              Rollorian Oura
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-emerald-50">
              Estado del dia
            </h1>
            <p className="text-sm text-emerald-300/80">{formatDay(targetDate)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Suspense>
              <PeriodSelector current={period} />
            </Suspense>
            <SyncButton />
          </div>
        </header>

        <section className="mb-6 grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
          <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${stateStyles(summary.state)}`}>
                  {summary.state}
                </span>
                <h2 className="max-w-2xl text-2xl font-bold leading-tight text-emerald-50">
                  {summary.headline}
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-emerald-300/85">
                  Fuente de sueno: {sleep?.source ?? "sin datos"}.
                  Ultimo sync valido: {formatLastSync(snapshot.freshness.lastSuccessfulSync)}.
                </p>
              </div>
              {resilience?.level ? <ResilienceBadge level={resilience.level} /> : null}
            </div>

            {snapshot.freshness.isPartial ? (
              <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                <p className="font-semibold uppercase tracking-[0.18em]">Dia parcial</p>
                <p className="mt-2 text-amber-100/85">
                  Bloques pendientes: {snapshot.freshness.missingBlocks.join(", ") || "ninguno"}.
                  Metricas pendientes: {snapshot.freshness.missingMetrics.join(", ") || "ninguna"}.
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-emerald-800/80 bg-emerald-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Sueno</p>
                <p className="mt-3 text-3xl font-bold text-emerald-50">
                  {formatMetric(secondsToHours(sleep?.totalSleepSeconds), "h", 1)}
                </p>
                <p className="mt-2 text-sm text-emerald-300/80">
                  {formatMetric(sleep?.efficiency ?? null, "%")} de eficiencia
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-800/80 bg-emerald-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Actividad</p>
                <p className="mt-3 text-3xl font-bold text-emerald-50">
                  {formatMetric(activity?.steps ?? null)}
                </p>
                <p className="mt-2 text-sm text-emerald-300/80">
                  {formatMetric(activity?.activeCalories ?? null)} kcal activas
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-800/80 bg-emerald-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Carga</p>
                <p className="mt-3 text-3xl font-bold text-emerald-50">
                  {formatMetric(secondsToMinutes(stress?.stressHighSeconds), "m")}
                </p>
                <p className="mt-2 text-sm text-emerald-300/80">
                  {formatMetric(secondsToMinutes(stress?.recoveryHighSeconds), "m")} de recuperacion alta
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-800/80 bg-emerald-950/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Contexto</p>
                <p className="mt-3 text-3xl font-bold text-emerald-50">{workouts.length}</p>
                <p className="mt-2 text-sm text-emerald-300/80">
                  {sessions.length} sesiones registradas
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-4 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-emerald-500">
                Sleep score
              </p>
              <SleepScoreGauge score={sleep?.score ?? null} />
            </div>
            <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-4 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-emerald-500">
                Eficiencia
              </p>
              <EfficiencyGauge efficiency={sleep?.efficiency ?? null} />
            </div>
            <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-4 text-center shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
              <p className="mb-3 text-xs uppercase tracking-[0.2em] text-emerald-500">
                Edad cardio
              </p>
              <CardioAgeDisplay age={vitals?.cardiovascularAge ?? null} />
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
              <SleepPhasesChart data={sleepPhaseData} />
            </div>
            <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
              <IntradayHRChart data={intradayHRData} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">
                  Insights
                </p>
                <span className="text-xs text-emerald-400/80">
                  {insights.length} activos
                </span>
              </div>
              {latestInsightList(insights)}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
                <HrvDisplay averageHrv={sleep?.averageHrv ?? null} />
              </div>
              <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
                <BreathingRateDisplay averageBreath={sleep?.averageBreath ?? null} />
              </div>
              <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
                <DailyStressCard
                  stressHighMin={secondsToMinutes(stress?.stressHighSeconds)}
                  recoveryHighMin={secondsToMinutes(stress?.recoveryHighSeconds)}
                />
              </div>
              <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">
                  Factores
                </p>
                <div className="mt-4 space-y-2">
                  {summary.factors.slice(0, 5).map((factor) => (
                    <div
                      key={factor.key}
                      className="flex items-center justify-between rounded-2xl border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-sm"
                    >
                      <span className="text-emerald-300/85">{factor.label}</span>
                      <span className="text-xs uppercase tracking-[0.18em] text-emerald-400">
                        {factor.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const dayCount = PERIOD_DAY_COUNT[period];
  const [snapshots, sleepData, metricsData] = await Promise.all([
    getDailyHealthTrend(dayCount),
    getSleepChartData(period),
    getMetricsData(period),
  ]);

  const averageSleepHours = average(
    snapshots.map((snapshot) => secondsToHours(snapshot.sleep?.totalSleepSeconds)),
  );
  const averageSleepScore = average(
    snapshots.map((snapshot) => snapshot.sleep?.score ?? null),
  );
  const averageReadiness = average(
    snapshots.map((snapshot) => snapshot.readiness?.score ?? null),
  );
  const partialDays = snapshots.filter((snapshot) => snapshot.freshness.isPartial).length;

  const readinessSeries = snapshots.map((snapshot) => ({
    day: snapshot.day,
    readinessScore: snapshot.readiness?.score ?? null,
  }));

  const activitySeries = snapshots.map((snapshot) => ({
    day: snapshot.day,
    steps: snapshot.activity?.steps ?? null,
  }));

  const lowestHeartRateSeries = snapshots.map((snapshot) => ({
    day: snapshot.day,
    lowestHeartRate: snapshot.sleep?.lowestHeartRate ?? null,
  }));

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_40%),linear-gradient(180deg,_rgba(2,44,34,0.98),_rgba(2,24,20,1))] px-4 py-6 md:px-6">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-400/80">
            Rollorian Oura
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-emerald-50">
            Tendencias
          </h1>
          <p className="text-sm text-emerald-300/80">
            Ultimos {dayCount} dias con una sola verdad derivada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Suspense>
            <PeriodSelector current={period} />
          </Suspense>
          <SyncButton />
        </div>
      </header>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Sueno medio</p>
          <p className="mt-3 text-4xl font-bold text-emerald-50">
            {formatMetric(averageSleepHours, "h", 1)}
          </p>
        </div>
        <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Sleep score medio</p>
          <p className="mt-3 text-4xl font-bold text-emerald-50">
            {formatMetric(averageSleepScore)}
          </p>
        </div>
        <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Readiness media</p>
          <p className="mt-3 text-4xl font-bold text-emerald-50">
            {formatMetric(averageReadiness)}
          </p>
        </div>
        <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">Dias parciales</p>
          <p className="mt-3 text-4xl font-bold text-emerald-50">{partialDays}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr,0.95fr]">
        <div className="space-y-4">
          <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">
                Sueno por dia
              </p>
              <p className="text-xs text-emerald-400/80">
                click para abrir el dia
              </p>
            </div>
            <DrillDownWrapper data={sleepData} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
              <MetricLineChart
                data={readinessSeries}
                dataKey="readinessScore"
                label="Readiness"
                unit=""
                color="#86efac"
              />
            </div>
            <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
              <MetricLineChart
                data={activitySeries}
                dataKey="steps"
                label="Pasos"
                unit=""
                color="#2dd4bf"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
            <StressBarChart data={metricsData} />
          </div>
          <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
            <MetricLineChart
              data={lowestHeartRateSeries}
              dataKey="lowestHeartRate"
              label="FC minima del sueno"
              unit=" bpm"
              color="#f59e0b"
            />
          </div>
          <div className="rounded-[28px] border border-emerald-700/30 bg-emerald-950/55 p-5">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-500">
                Cobertura del periodo
              </p>
              {snapshots.slice(-5).map((snapshot) => (
                <div
                  key={snapshot.day}
                  className="flex items-center justify-between rounded-2xl border border-emerald-900/70 bg-emerald-950/40 px-3 py-2 text-sm"
                >
                  <span className="text-emerald-200">{formatDay(snapshot.day)}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-emerald-400">
                    {snapshot.freshness.isPartial ? "partial" : "ok"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
