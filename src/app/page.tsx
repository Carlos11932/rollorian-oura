import { Suspense } from "react";
import {
  getSleepChartData,
  getMetricsData,
  getIntradayHeartRate,
  type Period,
} from "@/features/oura/server/queries";
import { SleepAreaChart } from "@/features/oura/components/SleepAreaChart";
import { DrillDownWrapper } from "@/features/oura/components/DrillDownWrapper";
import { SleepScoreGauge } from "@/features/oura/components/SleepScoreGauge";
import { EfficiencyGauge } from "@/features/oura/components/EfficiencyGauge";
import { MetricLineChart } from "@/features/oura/components/MetricLineChart";
import { IntradayHRChart } from "@/features/oura/components/IntradayHRChart";
import { PeriodSelector } from "@/features/oura/components/PeriodSelector";
import { SyncButton } from "@/features/oura/components/SyncButton";
import { format } from "date-fns";

const VALID_PERIODS = ["1d", "7d", "14d", "30d", "90d"] as const;
type ValidPeriod = (typeof VALID_PERIODS)[number];

function isValidPeriod(value: string | undefined): value is ValidPeriod {
  return VALID_PERIODS.includes(value as ValidPeriod);
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

  const period: Period = isValidPeriod(rawPeriod) ? rawPeriod : "7d";
  const selectedDate: string | undefined =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;

  const today = format(new Date(), "yyyy-MM-dd");

  if (period === "1d") {
    const targetDate = selectedDate ?? today;

    const [sleepData, intradayData] = await Promise.all([
      getSleepChartData("1d", targetDate),
      getIntradayHeartRate(targetDate),
    ]);

    const daySleep = sleepData.at(0);
    const latestScore = daySleep?.score ?? null;
    const latestEfficiency = daySleep?.efficiency ?? null;

    return (
      <div className="min-h-screen bg-emerald-950/20 p-4 md:p-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-emerald-100 tracking-tight">
            Rollorian Oura
          </h1>
          <div className="flex items-center gap-3">
            <Suspense>
              <PeriodSelector current={period} />
            </Suspense>
            <SyncButton />
          </div>
        </header>

        {/* Day view label */}
        <p className="mb-4 text-sm text-emerald-500">
          Vista: {targetDate}
        </p>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Sleep Column — 2/3 width */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {/* Sleep Area Chart (single day, no drill-down) */}
            <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
              <h2 className="mb-3 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
                Sueño — ciclos
              </h2>
              <SleepAreaChart data={sleepData} />
              {/* Legend */}
              <div className="mt-2 flex items-center gap-4 text-xs text-emerald-500">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-800" />
                  Profundo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  REM
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-200" />
                  Ligero
                </span>
              </div>
            </div>

            {/* Score + Efficiency Gauges */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
                <h2 className="mb-2 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
                  Sleep Score
                </h2>
                <SleepScoreGauge score={latestScore} />
                <p className="mt-1 text-xs text-emerald-600">
                  Día seleccionado
                </p>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
                <h2 className="mb-2 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
                  Eficiencia
                </h2>
                <EfficiencyGauge efficiency={latestEfficiency} />
                <p className="mt-1 text-xs text-emerald-600">
                  Día seleccionado
                </p>
              </div>
            </div>
          </div>

          {/* Intraday HR Column — 1/3 width */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
              <h2 className="mb-3 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
                Frecuencia cardíaca intraday
              </h2>
              <IntradayHRChart data={intradayData} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Multi-day view ─────────────────────────────────────────────────────────

  const [sleepData, metricsData] = await Promise.all([
    getSleepChartData(period),
    getMetricsData(period),
  ]);

  // Latest sleep record for gauges
  const latestSleep = sleepData.at(-1);
  const latestScore = latestSleep?.score ?? null;
  const latestEfficiency = latestSleep?.efficiency ?? null;

  return (
    <div className="min-h-screen bg-emerald-950/20 p-4 md:p-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-emerald-100 tracking-tight">
          Rollorian Oura
        </h1>
        <div className="flex items-center gap-3">
          <Suspense>
            <PeriodSelector current={period} />
          </Suspense>
          <SyncButton />
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Sleep Column — 2/3 width */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Sleep Area Chart with drill-down */}
          <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
            <h2 className="mb-3 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
              Sueño — ciclos
            </h2>
            <DrillDownWrapper data={sleepData} />
            {/* Legend */}
            <div className="mt-2 flex items-center gap-4 text-xs text-emerald-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-800" />
                Profundo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                REM
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-200" />
                Ligero
              </span>
            </div>
          </div>

          {/* Score + Efficiency Gauges */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
              <h2 className="mb-2 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
                Sleep Score
              </h2>
              <SleepScoreGauge score={latestScore} />
              <p className="mt-1 text-xs text-emerald-600">
                Última noche registrada
              </p>
            </div>
            <div className="flex flex-col items-center rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
              <h2 className="mb-2 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
                Eficiencia
              </h2>
              <EfficiencyGauge efficiency={latestEfficiency} />
              <p className="mt-1 text-xs text-emerald-600">
                Última noche registrada
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Column — 1/3 width */}
        <div className="flex flex-col gap-4">
          {/* Resting HR */}
          <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
            <MetricLineChart
              data={metricsData}
              dataKey="restingHR"
              label="FC en reposo"
              unit=" bpm"
              color="var(--color-emerald-400)"
            />
          </div>

          {/* Cardio Age */}
          <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
            <MetricLineChart
              data={metricsData}
              dataKey="cardioAge"
              label="Edad cardiovascular"
              unit=" años"
              color="var(--color-teal-400)"
            />
          </div>

          {/* Stress Line Chart */}
          <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
            <MetricLineChart
              data={metricsData}
              dataKey="stressHigh"
              label="Estrés alto"
              unit=" min"
              color="#f87171"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
