// Builds one day's report from what was known at `generatedAt`. Pure: no I/O.

import type { MarketSection } from './marketSection.js';
import type { Disclosure, NewsItem, PriceBar } from '../types.js';
import { clusterNews, type NewsCluster } from '../analysis/news.js';
import type { Commentary } from '../analysis/commentary.js';
import { horizonMomentum, summarizeTechnicals, technicalReason, type HorizonMomentum, type TechnicalSummary } from '../analysis/technicals.js';
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
  /** ETF or coin (G-56); absent for a stock. */
  kind?: 'etf' | 'coin';
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
  /** Technical signal summary of the last session (docs/DESIGN.md §4.2). */
  technicals?: TechnicalSummary;
  /** One sentence explaining `technicals`. */
  technicalReason?: string;
  /** Short / mid / long horizon returns of the last session. */
  momentum?: HorizonMomentum[];
  /** News stories of the last 7 days known at generation (docs/DESIGN.md §4.3). */
  news?: NewsSection;
  /** Horizon gauges, fair value, forecasts, flows, valuation, financials (docs/DESIGN.md §5). */
  market?: MarketSection;
  /** Where it trades: KOSPI, KOSDAQ or UPBIT (shown next to the code). */
  exchange?: 'KOSPI' | 'KOSDAQ' | 'UPBIT';
  /** What most readers miss (G-99): earnings surprises, dividends, buybacks, insider and 5% holder moves. */
  edge?: import('../analysis/edge.js').EdgeSection;
  /** AI commentary for "왜?" (docs/DESIGN.md §4.4); written once with the report. */
  commentary?: Commentary;
  /** Daily bars up to and including `date`, oldest first, for the interactive chart. */
  recentBars?: { date: string; open: number; high: number; low: number; close: number; volume: number }[];
  /** Closes up to and including `date`, oldest first, for the chart. */
  recentCloses: { date: string; close: number }[];
  sources: string[];
}

export interface NewsSourceStatus {
  source: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface NewsSection {
  clusters: NewsCluster[];
  /** Cluster ids with at least one article not shown in an earlier report. */
  newIds: string[];
  status: NewsSourceStatus[];
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
  kind?: 'etf' | 'coin';
  exchange?: 'KOSPI' | 'KOSDAQ' | 'UPBIT';
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
  /** News articles known at generatedAt, and how each source fared this run. */
  news?: readonly NewsItem[];
  newsStatus?: readonly NewsSourceStatus[];
  /** The stock's name pattern; left out of headline similarity. */
  newsAliases?: RegExp;
  /** Daily bars kept for the chart (250 for dated reports; the live page keeps more). */
  barsLimit?: number;
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
  if (input.kind !== 'coin') parts.push(filings.length ? `새 공시 ${filings.length}건${important ? `(중요 ${important}건)` : ''}` : '새 공시 없음');

  const report: DailyReport = {
    schema: REPORT_SCHEMA,
    symbol: input.symbol,
    name: input.name,
    ...(input.kind ? { kind: input.kind } : {}),
    ...(input.exchange ? { exchange: input.exchange } : {}),
    date: input.date,
    generatedAt: input.generatedAt.toISOString(),
    status: session ? 'SESSION' : 'NO_SESSION',
    headline: `${parts.join('. ')}.`,
    notes,
    price,
    filings,
    recentFilings,
    recentBars: history.slice(-(input.barsLimit ?? 250)).map(({ date, open, high, low, close, volume }) => ({ date, open, high, low, close, volume })),
    recentCloses: history.slice(-130).map((bar) => ({ date: bar.date, close: bar.close })),
    sources: [...input.sources],
  };
  if (input.news || input.newsStatus) report.news = buildNewsSection(input.news ?? [], input.newsStatus ?? [], input.generatedAt, input.previous ?? null, input.newsAliases);
  if (report.news) {
    const fresh = report.news.clusters.filter((c) => report.news!.newIds.includes(c.id));
    const important = fresh.filter((c) => c.importance === 'HIGH').length;
    if (fresh.length) report.headline = `${report.headline.slice(0, -1)}. 새 뉴스 ${fresh.length}건${important ? `(중요 ${important}건)` : ''}.`;
  }
  if (history.length) {
    report.technicals = summarizeTechnicals(history);
    report.technicalReason = technicalReason(report.technicals);
    report.momentum = horizonMomentum(history);
  }
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
  if (current.news) {
    const fresh = current.news.clusters.filter((c) => current.news!.newIds.includes(c.id));
    const top = fresh.filter((c) => c.importance === 'HIGH').slice(0, 2).map((c) => c.title);
    out.push(fresh.length ? `새 뉴스 ${fresh.length}건${top.length ? `: ${top.join(', ')}` : ''}.` : '이전 리포트 이후 새 뉴스는 없어요.');
  }
  const levelBefore = previous.technicals?.label, levelNow = current.technicals?.label;
  if (levelBefore && levelNow && levelBefore !== levelNow) out.push(`기술적 신호: ${levelBefore} → ${levelNow}`);
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

const NEWS_WINDOW_MS = 7 * 24 * 60 * 60_000;
/** Stories kept in a report. Only kept stories count as shown for the next report. */
export const MAX_NEWS_STORIES = 30;

/** Stories of the last 7 days; "new" means an article earlier reports did not show. */
export function buildNewsSection(items: readonly NewsItem[], status: readonly NewsSourceStatus[], generatedAt: Date, previous: DailyReport | null, aliases?: RegExp): NewsSection {
  const cutoff = generatedAt.getTime();
  const recent = items.filter((i) => {
    const at = Date.parse(i.publishedAt);
    return at <= cutoff && at > cutoff - NEWS_WINDOW_MS;
  });
  const all = clusterNews(recent, aliases);
  const seen = new Set((previous?.news?.clusters ?? []).flatMap((c) => c.articles.map((a) => a.url)));
  const isNew = (c: (typeof all)[number]) => (previous?.news
    ? c.articles.some((a) => !seen.has(a.url))
    // No earlier news to compare with: the last 24 hours count as new.
    : Date.parse(c.lastAt) > cutoff - 24 * 60 * 60_000);
  // New stories first, then the rest, each in importance/recency order; stories beyond the cap are not kept.
  const clusters = [...all.filter(isNew), ...all.filter((c) => !isNew(c))].slice(0, MAX_NEWS_STORIES);
  const newIds = clusters.filter(isNew).map((c) => c.id);
  return { clusters, newIds, status: [...status] };
}
