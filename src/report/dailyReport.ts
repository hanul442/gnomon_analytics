// Builds one day's report from what was known at `generatedAt`. Pure: no I/O.

import type { Disclosure, PriceBar } from '../types.js';
import { readFilingTitle, type Importance } from './classify.js';

export const REPORT_SCHEMA = 'gnm.daily-report.v0';

export interface PriceSection {
  close: number;
  previousClose: number | null;
  change: number | null;
  changePct: number | null;
  volume: number;
  /** Today's volume / mean of the previous 20 sessions. */
  volumeRatio20: number | null;
  return5dPct: number | null;
  return20dPct: number | null;
  high20: number;
  low20: number;
  /** Today's daily move in units of the previous 20 sessions' daily-return standard deviation. */
  moveZ20: number | null;
}

export interface ReportedFiling {
  receiptNo: string;
  title: string;
  filedDate: string;
  filer: string;
  url: string;
  category: string;
  importance: Importance;
  why: string;
}

export interface DailyReport {
  schema: typeof REPORT_SCHEMA;
  symbol: string;
  name: string;
  date: string;
  generatedAt: string;
  status: 'SESSION' | 'NO_SESSION';
  headline: string;
  notes: string[];
  price: PriceSection | null;
  filings: ReportedFiling[];
  /** Closes up to and including `date`, oldest first, for the chart. */
  recentCloses: { date: string; close: number }[];
  sources: string[];
}

const IMPORTANCE_ORDER: Record<Importance, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const won = (value: number): string => `${Math.round(value).toLocaleString('ko-KR')}원`;
const pct = (value: number): string => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

function stdev(values: readonly number[]): number | null {
  const m = mean(values);
  if (m === null || values.length < 2) return null;
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

function priceSection(history: readonly PriceBar[]): PriceSection {
  const today = history.at(-1)!;
  const prior = history.slice(0, -1);
  const previous = prior.at(-1) ?? null;
  const closeAgo = (n: number) => history.at(-1 - n)?.close ?? null;
  const window20 = history.slice(-20);
  const prior20 = prior.slice(-20);
  const returns = prior.slice(-21).map((bar, i, arr) => (i === 0 ? null : bar.close / arr[i - 1]!.close - 1)).filter((r): r is number => r !== null);
  const sd = stdev(returns);
  const dailyReturn = previous ? today.close / previous.close - 1 : null;
  const avgVolume = mean(prior20.map((bar) => bar.volume));
  const ret = (n: number) => {
    const base = closeAgo(n);
    return base ? (today.close / base - 1) * 100 : null;
  };
  return {
    close: today.close,
    previousClose: previous?.close ?? null,
    change: previous ? today.close - previous.close : null,
    changePct: dailyReturn === null ? null : dailyReturn * 100,
    volume: today.volume,
    volumeRatio20: avgVolume ? today.volume / avgVolume : null,
    return5dPct: ret(5),
    return20dPct: ret(20),
    high20: Math.max(...window20.map((bar) => bar.high)),
    low20: Math.min(...window20.map((bar) => bar.low)),
    moveZ20: dailyReturn !== null && sd && returns.length >= 10 ? dailyReturn / sd : null,
  };
}

export function buildDailyReport(input: {
  symbol: string;
  name: string;
  /** KST date being reported, YYYY-MM-DD. */
  date: string;
  generatedAt: Date;
  /** Already filtered to what was known at generatedAt. */
  bars: readonly PriceBar[];
  disclosures: readonly Disclosure[];
  /** Data sources consulted for this report. */
  sources: readonly string[];
  /**
   * Receipt numbers already shown in earlier reports. When given, every other
   * filing up to `date` (within 31 days) is new, so a filing that reached DART
   * after the previous report still appears once. Without it (the first
   * report) only filings since the previous session are shown.
   */
  previouslyReported?: ReadonlySet<string>;
}): DailyReport {
  const history = [...input.bars]
    .filter((bar) => bar.symbol === input.symbol && bar.date <= input.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const session = history.at(-1)?.date === input.date;
  const previousSessionDate = (session ? history.at(-2) : history.at(-1))?.date ?? '0000-00-00';

  const earliest = new Date(Date.parse(`${input.date}T00:00:00Z`) - 31 * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const reported = input.previouslyReported;
  const isNew = reported
    ? (d: Disclosure) => !reported.has(d.receiptNo) && d.filedDate >= earliest && d.filedDate <= input.date
    // First report: filings since the previous session, so weekend and holiday filings land on the next report.
    : (d: Disclosure) => d.filedDate > previousSessionDate && d.filedDate <= input.date;
  const filings = input.disclosures
    .filter(isNew)
    .map((d): ReportedFiling => {
      const reading = readFilingTitle(d.title);
      return { receiptNo: d.receiptNo, title: d.title, filedDate: d.filedDate, filer: d.filer, url: d.url, category: reading.category, importance: reading.importance, why: reading.why };
    })
    .sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] || (a.filedDate < b.filedDate ? 1 : -1));

  const price = session ? priceSection(history) : null;
  const notes: string[] = [];
  const parts: string[] = [];
  if (price) {
    parts.push(`${input.name} 종가 ${won(price.close)}${price.changePct === null ? '' : `, 전일 대비 ${pct(price.changePct)}`}`);
    if (price.moveZ20 !== null && Math.abs(price.moveZ20) >= 2) notes.push(`오늘 움직임은 최근 20거래일 평소 변동의 ${Math.abs(price.moveZ20).toFixed(1)}배로 큰 편이에요.`);
    if (price.volumeRatio20 !== null && price.volumeRatio20 >= 1.5) notes.push(`거래량이 최근 20거래일 평균의 ${price.volumeRatio20.toFixed(1)}배로 많았어요.`);
    if (price.volumeRatio20 !== null && price.volumeRatio20 <= 0.5) notes.push(`거래량이 최근 20거래일 평균의 ${price.volumeRatio20.toFixed(1)}배로 적었어요.`);
    if (price.close >= price.high20) notes.push('최근 20거래일 중 가장 높은 가격 근처에서 마감했어요.');
    if (price.close <= price.low20) notes.push('최근 20거래일 중 가장 낮은 가격 근처에서 마감했어요.');
  } else {
    parts.push(`${input.date}에는 거래가 없었어요`);
  }
  const important = filings.filter((f) => f.importance === 'HIGH').length;
  parts.push(filings.length ? `새 공시 ${filings.length}건${important ? `(중요 ${important}건)` : ''}` : '새 공시 없음');

  return {
    schema: REPORT_SCHEMA,
    symbol: input.symbol,
    name: input.name,
    date: input.date,
    generatedAt: input.generatedAt.toISOString(),
    status: session ? 'SESSION' : 'NO_SESSION',
    headline: `${parts.join('. ')}.`,
    notes,
    price,
    filings,
    recentCloses: history.slice(-60).map((bar) => ({ date: bar.date, close: bar.close })),
    sources: [...input.sources],
  };
}
