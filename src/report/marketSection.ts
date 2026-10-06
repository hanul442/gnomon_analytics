// Stage A/B additions to the daily report (docs/DESIGN.md §5): horizon gauges,
// technical fair value, forecast ranges and their scores, investor flows,
// valuation snapshot, financials, benchmarks and research listings.
// Pure: callers pass records already filtered to what was known at generation.

import { paperBooks, type PaperBook, type PaperEntry } from '../analysis/paper.js';
import { horizonGauges, type HorizonGauge } from '../analysis/horizons.js';
import { runArena, type ArenaResult } from '../analysis/strategies.js';
import { scoreAnalysts, type AnalystCall, type AnalystScore } from '../analysis/analysts.js';
import { footprint, structureSnapshot, type Footprint, type StructureSnapshot } from '../analysis/structure.js';
import { forecastRanges, scoreForecasts, technicalFairValue, type ForecastScore, type PriceForecast, type TechnicalFairValue } from '../analysis/valuation.js';
import type { FinancePeriod, IntradaySession, InvestorFlow, PriceBar, ResearchNote, StockSnapshot } from '../types.js';
import type { NewsSourceStatus } from './dailyReport.js';

/** Net shares per investor group; *Value is the same in KRW, estimated as net shares × that day's close. */
export interface FlowDay { date: string; foreignNet: number | null; institutionNet: number | null; individualNet: number | null; foreignHoldRatio: number | null; foreignValue?: number | null; institutionValue?: number | null; individualValue?: number | null }
export interface FlowSection {
  days: FlowDay[];
  /** Net shares (and their estimated KRW value) summed over the last 5 and 20 trading days. */
  sums: { days: 5 | 20; foreign: number | null; institution: number | null; individual: number | null; foreignValue?: number | null; institutionValue?: number | null; individualValue?: number | null }[];
  /** Foreign holding ratio change over 20 trading days, percentage points. */
  holdRatioChange20: number | null;
}

export interface BenchmarkComparison {
  symbol: string;
  name: string;
  /** Returns in percent over 5 / 20 / 60 sessions: [stock, benchmark]. */
  returns: { days: number; stock: number | null; benchmark: number | null }[];
  /** Last close, its change in percent, and the last 60 closes for a sparkline. */
  last: number | null;
  changePct: number | null;
  spark: number[];
  /** Last 250 daily closes, [date, close], for the chart's comparison line (absent in older reports). */
  series?: [string, number][];
}

export interface MarketSection {
  horizons: HorizonGauge[];
  fairValue: TechnicalFairValue | null;
  /** Daily swing structure, Fibonacci, support/resistance, Bollinger, ATR. */
  structure: StructureSnapshot | null;
  /** Weekly swing structure for the longer view. */
  weeklyStructure: StructureSnapshot | null;
  footprint: Footprint;
  /** Strategy arena on the available daily history (docs/DESIGN.md §5.5). */
  arena: ArenaResult | null;
  /** AI analyst battle leaderboard from logged calls (docs/DESIGN.md §5.6). */
  analystBoard: AnalystScore[];
  /** Paper-trading ledger replayed from logged entries (G-21); absent in reports made before it existed. */
  paper?: PaperBook[];
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
    .map(({ date: d, foreignNet, institutionNet, individualNet, foreignHoldRatio, close }) => {
      const krw = (n: number | null) => (n === null || !close ? null : Math.round(n * close));
      return { date: d, foreignNet, institutionNet, individualNet, foreignHoldRatio, foreignValue: krw(foreignNet), institutionValue: krw(institutionNet), individualValue: krw(individualNet) };
    });
  if (!days.length) return null;
  const sums = ([5, 20] as const).map((n) => {
    const w = days.length >= n ? days.slice(-n) : null;
    return {
      days: n,
      foreign: w ? sum(w.map((d) => d.foreignNet)) : null,
      institution: w ? sum(w.map((d) => d.institutionNet)) : null,
      individual: w ? sum(w.map((d) => d.individualNet)) : null,
      foreignValue: w ? sum(w.map((d) => d.foreignValue ?? null)) : null,
      institutionValue: w ? sum(w.map((d) => d.institutionValue ?? null)) : null,
      individualValue: w ? sum(w.map((d) => d.individualValue ?? null)) : null,
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
  /** Analyst calls logged by earlier reports. */
  analystCalls?: readonly AnalystCall[];
  /** Paper-trading entries logged by earlier settled runs. */
  paperEntries?: readonly PaperEntry[];
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
    arena: runArena(daily),
    analystBoard: scoreAnalysts((input.analystCalls ?? []).filter((c) => c.symbol === input.symbol), daily),
    paper: paperBooks((input.paperEntries ?? []).filter((e) => e.symbol === input.symbol && e.date <= input.date), daily),
    forecasts,
    forecastScores: scoreForecasts(input.loggedForecasts.filter((f) => f.symbol === input.symbol), daily),
    flows: buildFlowSection(input.flows.filter((f) => f.symbol === input.symbol), input.date),
    snapshot: upTo(input.snapshots.filter((s) => s.symbol === input.symbol)).at(-1) ?? null,
    quarters: latestPeriods(input.finance, 'QUARTER'),
    years: latestPeriods(input.finance, 'ANNUAL'),
    benchmarks: input.benchmarks.map((b) => {
      const upto = upTo(b.bars), closes = upto.map((x) => x.close);
      return {
        symbol: b.symbol, name: b.name, returns: [5, 20, 60].map((days) => ({ days, stock: ret(stockCloses, days), benchmark: ret(closes, days) })),
        last: closes.at(-1) ?? null, changePct: ret(closes, 1), spark: closes.slice(-60),
        series: upto.slice(-250).map((x) => [x.date, x.close] as [string, number]),
      };
    }),
    research: upTo(input.research).reverse().slice(0, 10),
    status: [...input.status],
  };
}
