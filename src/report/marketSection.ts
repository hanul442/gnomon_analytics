// Stage A/B additions to the daily report (docs/DESIGN.md §5): horizon gauges,
// technical fair value, forecast ranges and their scores, investor flows,
// valuation snapshot, financials, benchmarks and research listings.
// Pure: callers pass records already filtered to what was known at generation.

import { horizonGauges, type HorizonGauge } from '../analysis/horizons.js';
import { footprint, structureSnapshot, type Footprint, type StructureSnapshot } from '../analysis/structure.js';
import { forecastRanges, scoreForecasts, technicalFairValue, type ForecastScore, type PriceForecast, type TechnicalFairValue } from '../analysis/valuation.js';
import type { FinancePeriod, IntradaySession, InvestorFlow, PriceBar, ResearchNote, StockSnapshot } from '../types.js';
import type { NewsSourceStatus } from './dailyReport.js';

export interface FlowDay { date: string; foreignNet: number | null; institutionNet: number | null; individualNet: number | null; foreignHoldRatio: number | null }
export interface FlowSection {
  days: FlowDay[];
  /** Net shares summed over the last 5 and 20 trading days. */
  sums: { days: 5 | 20; foreign: number | null; institution: number | null; individual: number | null }[];
  /** Foreign holding ratio change over 20 trading days, percentage points. */
  holdRatioChange20: number | null;
}

export interface BenchmarkComparison {
  symbol: string;
  name: string;
  /** Returns in percent over 5 / 20 / 60 sessions: [stock, benchmark]. */
  returns: { days: number; stock: number | null; benchmark: number | null }[];
}

export interface MarketSection {
  horizons: HorizonGauge[];
  fairValue: TechnicalFairValue | null;
  /** Daily swing structure, Fibonacci, support/resistance, Bollinger, ATR. */
  structure: StructureSnapshot | null;
  /** Weekly swing structure for the longer view. */
  weeklyStructure: StructureSnapshot | null;
  footprint: Footprint;
  /** Ranges made with this report (also appended to data/forecasts). */
  forecasts: PriceForecast[];
  forecastScores: ForecastScore[];
  flows: FlowSection | null;
  snapshot: StockSnapshot | null;
  /** Latest version of each period, oldest first. */
  quarters: FinancePeriod[];
  years: FinancePeriod[];
  benchmarks: BenchmarkComparison[];
  research: ResearchNote[];
  status: NewsSourceStatus[];
}

const ret = (closes: readonly number[], days: number): number | null =>
  closes.length > days ? (closes.at(-1)! / closes[closes.length - 1 - days]! - 1) * 100 : null;

function sum(values: readonly (number | null)[]): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length === values.length && known.length ? known.reduce((s, v) => s + v, 0) : null;
}

export function buildFlowSection(flows: readonly InvestorFlow[], date: string): FlowSection | null {
  const days = [...flows].filter((f) => f.date <= date).sort((a, b) => (a.date < b.date ? -1 : 1))
    .map(({ date: d, foreignNet, institutionNet, individualNet, foreignHoldRatio }) => ({ date: d, foreignNet, institutionNet, individualNet, foreignHoldRatio }));
  if (!days.length) return null;
  const sums = ([5, 20] as const).map((n) => {
    const w = days.length >= n ? days.slice(-n) : null;
    return {
      days: n,
      foreign: w ? sum(w.map((d) => d.foreignNet)) : null,
      institution: w ? sum(w.map((d) => d.institutionNet)) : null,
      individual: w ? sum(w.map((d) => d.individualNet)) : null,
    };
  });
  const now = days.at(-1)!.foreignHoldRatio, then = days.length > 20 ? days[days.length - 21]!.foreignHoldRatio : null;
  return { days: days.slice(-60), sums, holdRatioChange20: now !== null && then !== null ? now - then : null };
}

/** Keeps the latest version per period (the log is already point-in-time filtered). */
function latestPeriods(rows: readonly FinancePeriod[], type: FinancePeriod['periodType']): FinancePeriod[] {
  const byPeriod = new Map<string, FinancePeriod>();
  for (const r of rows) if (r.periodType === type) byPeriod.set(r.period, r);
  return [...byPeriod.values()].sort((a, b) => (a.period < b.period ? -1 : 1));
}

export function buildMarketSection(input: {
  symbol: string;
  date: string;
  generatedAt: Date;
  daily: readonly PriceBar[];
  weekly: readonly PriceBar[];
  intraday: readonly IntradaySession[];
  flows: readonly InvestorFlow[];
  snapshots: readonly StockSnapshot[];
  finance: readonly FinancePeriod[];
  research: readonly ResearchNote[];
  benchmarks: readonly { symbol: string; name: string; bars: readonly PriceBar[] }[];
  /** Forecasts logged by earlier reports. */
  loggedForecasts: readonly PriceForecast[];
  status: readonly NewsSourceStatus[];
}): MarketSection {
  const upTo = <T extends { date: string }>(xs: readonly T[]) => [...xs].filter((x) => x.date <= input.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const daily = upTo(input.daily.filter((b) => b.symbol === input.symbol));
  const weekly = upTo(input.weekly.filter((b) => b.symbol === input.symbol));
  const intraday = upTo(input.intraday.filter((s) => s.symbol === input.symbol));
  const forecasts = forecastRanges(input.symbol, daily, input.generatedAt);
  const stockCloses = daily.map((b) => b.close);
  return {
    horizons: horizonGauges({ intraday, daily, weekly }),
    fairValue: technicalFairValue(daily),
    structure: structureSnapshot(daily),
    weeklyStructure: structureSnapshot(weekly, 260),
    footprint: footprint(daily, input.flows.filter((f) => f.symbol === input.symbol)),
    forecasts,
    forecastScores: scoreForecasts(input.loggedForecasts.filter((f) => f.symbol === input.symbol), daily),
    flows: buildFlowSection(input.flows.filter((f) => f.symbol === input.symbol), input.date),
    snapshot: upTo(input.snapshots.filter((s) => s.symbol === input.symbol)).at(-1) ?? null,
    quarters: latestPeriods(input.finance, 'QUARTER'),
    years: latestPeriods(input.finance, 'ANNUAL'),
    benchmarks: input.benchmarks.map((b) => {
      const closes = upTo(b.bars).map((x) => x.close);
      return { symbol: b.symbol, name: b.name, returns: [5, 20, 60].map((days) => ({ days, stock: ret(stockCloses, days), benchmark: ret(closes, days) })) };
    }),
    research: upTo(input.research).reverse().slice(0, 10),
    status: [...input.status],
  };
}
