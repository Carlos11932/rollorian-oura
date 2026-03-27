import { Suspense } from "react";
import {
  getSleepChartData,
  getMetricsData,
  getIntradayHeartRate,
  getSleepIntradayData,
  getStressIntradayData,
  type Period,
} from "@/features/oura/server/queries";
import { DrillDownWrapper } from "@/features/oura/components/DrillDownWrapper";
import { SleepScoreGauge } from "@/features/oura/components/SleepScoreGauge";
import { EfficiencyGauge } from "@/features/oura/components/EfficiencyGauge";
import { CardioAgeDisplay } from "@/features/oura/components/CardioAgeDisplay";
import { MetricLineChart } from "@/features/oura/components/MetricLineChart";
import { IntradayHRChart } from "@/features/oura/components/IntradayHRChart";
import { SleepIntradayChart } from "@/features/oura/components/SleepIntradayChart";
import { StressIntradayChart } from "@/features/oura/components/StressIntradayChart";
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

    const [sleepData, metricsData, intradayHRData, sleepIntradayData, stressIntradayData] =
      await Promise.all([
        getSleepChartData("1d", targetDate),
        getMetricsData("1d", targetDate),
        getIntradayHeartRate(targetDate),
        getSleepIntradayData(targetDate),
        getStressIntradayData(targetDate),
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

        {/* Top row: 3 gauges */}
        <div className="mb-4 grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
            <h2 className="mb-2 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
              Sleep Score
            </h2>
            <SleepScoreGauge score={latestScore} />
          </div>
          <div className="flex flex-col items-center rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
            <h2 className="mb-2 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
              Eficiencia del sueño
            </h2>
            <EfficiencyGauge efficiency={latestEfficiency} />
          </div>
          <div className="flex flex-col items-center rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
            <h2 className="mb-2 text-sm font-semibold text-emerald-300 uppercase tracking-wide">
              Edad Cardiovascular
            </h2>
            <CardioAgeDisplay age={metricsData[0]?.cardioAge ?? null} />
          </div>
        </div>

        {/* Bottom grid: 2/3 + 1/3 */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Sleep intraday — 2/3 */}
          <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4 lg:col-span-2">
            <SleepIntradayChart data={sleepIntradayData} />
          </div>

          {/* FC intraday + Stress intraday — 1/3 */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
              <IntradayHRChart data={intradayHRData} />
            </div>
            <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
              <StressIntradayChart data={stressIntradayData} />
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

          {/* Score + Efficiency Line Charts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
              <MetricLineChart
                data={sleepData}
                dataKey="score"
                label="Sleep Score"
                unit=""
                color="#34d399"
              />
            </div>
            <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
              <MetricLineChart
                data={sleepData}
                dataKey="efficiency"
                label="Eficiencia del sueño"
                unit="%"
                color="#2dd4bf"
              />
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
              color="#34d399"
            />
          </div>

          {/* Cardio Age */}
          <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
            <MetricLineChart
              data={metricsData}
              dataKey="cardioAge"
              label="Edad cardiovascular"
              unit=" años"
              color="#2dd4bf"
            />
          </div>

          {/* Stress Line Chart */}
          <div className="rounded-xl border border-emerald-900 bg-emerald-950/60 p-4">
            <MetricLineChart
              data={metricsData}
              dataKey="stressHigh"
              label="Tiempo en estrés"
              unit=" min"
              color="#f87171"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
