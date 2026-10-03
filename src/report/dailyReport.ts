// Builds one day's report from what was known at `generatedAt`. Pure: no I/O.

import type { Disclosure, PriceBar } from '../types.js';
import { readFilingTitle, type Importance } from './classify.js';

export const REPORT_SCHEMA = 'gnm.daily-report.v0';

export interface PriceSection {
  /** Trading date these numbers describe (the last session on or before the report date). */
  sessionDate: string;
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
  /** Filings of the last 31 days known at generation, newest first (context, not only new ones). */
  recentFilings?: ReportedFiling[];
  /** What changed since the previous report. */
  changes?: string[];
  /** Daily bars up to and including `date`, oldest first, for the interactive chart. */
  recentBars?: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
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
    sessionDate: today.date,
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
  /** The latest earlier report, for "what changed since yesterday". */
  previous?: DailyReport | null;
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
  const toReported = (d: Disclosure): ReportedFiling => {
    const reading = readFilingTitle(d.title);
    return { receiptNo: d.receiptNo, title: d.title, filedDate: d.filedDate, filer: d.filer, url: d.url, category: reading.category, importance: reading.importance, why: reading.why };
  };
  const filings = input.disclosures
    .filter(isNew)
    .map(toReported)
    .sort((a, b) => IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance] || (a.filedDate < b.filedDate ? 1 : -1));
  const recentFilings = input.disclosures
    .filter((d) => d.filedDate >= earliest && d.filedDate <= input.date)
    .map(toReported)
    .sort((a, b) => (a.filedDate < b.filedDate ? 1 : a.filedDate > b.filedDate ? -1 : a.receiptNo < b.receiptNo ? 1 : -1));

  // On a holiday the last session's numbers are still shown, labelled with their date.
  const price = history.length ? priceSection(history) : null;
  const notes: string[] = [];
  const parts: string[] = [];
  if (price && session) {
    parts.push(`${input.name} 종가 ${won(price.close)}${price.changePct === null ? '' : `, 전일 대비 ${pct(price.changePct)}`}`);
    if (price.moveZ20 !== null && Math.abs(price.moveZ20) >= 2) notes.push(`오늘 움직임은 최근 20거래일 평소 변동의 ${Math.abs(price.moveZ20).toFixed(1)}배로 큰 편이에요.`);
    if (price.volumeRatio20 !== null && price.volumeRatio20 >= 1.5) notes.push(`거래량이 최근 20거래일 평균의 ${price.volumeRatio20.toFixed(1)}배로 많았어요.`);
    if (price.volumeRatio20 !== null && price.volumeRatio20 <= 0.5) notes.push(`거래량이 최근 20거래일 평균의 ${price.volumeRatio20.toFixed(1)}배로 적었어요.`);
    if (price.close >= price.high20) notes.push('최근 20거래일 중 가장 높은 가격 근처에서 마감했어요.');
    if (price.close <= price.low20) notes.push('최근 20거래일 중 가장 낮은 가격 근처에서 마감했어요.');
  } else if (price) {
    parts.push(`${input.date}에는 거래가 없었어요. 마지막 거래일(${price.sessionDate}) 종가는 ${won(price.close)}이에요`);
  } else {
    parts.push(`${input.date}에는 거래가 없었고 가격 기록도 없어요`);
  }
  const important = filings.filter((f) => f.importance === 'HIGH').length;
  parts.push(filings.length ? `새 공시 ${filings.length}건${important ? `(중요 ${important}건)` : ''}` : '새 공시 없음');

  const report: DailyReport = {
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
    recentFilings,
    recentBars: history.slice(-130).map(({ date, open, high, low, close, volume }) => ({ date, open, high, low, close, volume })),
    recentCloses: history.slice(-130).map((bar) => ({ date: bar.date, close: bar.close })),
    sources: [...input.sources],
  };
  report.changes = describeChanges(input.previous ?? null, report);
  return report;
}

/** "어제 대비 바뀐 점": compares this report with the previous one. Pure. */
export function describeChanges(previous: DailyReport | null, current: DailyReport): string[] {
  if (!previous) return ['첫 리포트예요. 다음 리포트부터 이전 리포트와 비교해요.'];
  const out: string[] = [];
  const before = previous.price;
  const now = current.price;
  // Reports written before sessionDate existed only had prices on session days.
  const beforeDate = before ? (before.sessionDate ?? previous.date) : null;
  if (before && now && beforeDate) {
    if (beforeDate === now.sessionDate) {
      out.push('새 거래일이 없어서 가격은 이전 리포트와 같아요.');
    } else {
      out.push(`종가 ${won(before.close)} → ${won(now.close)} (${pct((now.close / before.close - 1) * 100)}, ${beforeDate} → ${now.sessionDate})`);
    }
  } else if (now) {
    out.push(`이전 리포트(${previous.date})에는 가격이 없었어요. ${now.sessionDate} 종가는 ${won(now.close)}이에요.`);
  }
  if (current.filings.length) {
    const top = current.filings.filter((f) => f.importance === 'HIGH').slice(0, 2).map((f) => f.title);
    out.push(`새 공시 ${current.filings.length}건${top.length ? `: ${top.join(', ')}` : ''}.`);
  } else {
    out.push('이전 리포트 이후 새 공시는 없어요.');
  }
  // Signals describe a session; only compare two session reports.
  if (current.status === 'SESSION' && previous.status === 'SESSION') {
    for (const note of current.notes) if (!previous.notes.includes(note)) out.push(`새 신호: ${note}`);
    for (const note of previous.notes) if (!current.notes.includes(note)) out.push(`사라진 신호: ${note}`);
  }
  return out;
}
