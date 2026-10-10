// A US stock's research inputs (G-179): SEC EDGAR filings, XBRL financials and Form 4 trades, Naver's
// valuation snapshot and English news, gathered best effort and poured into the same DailyReport the
// Korean pipeline builds, so the panels, the status strip and the committee's evidence list need no US branch.

import type { Disclosure, FinancePeriod, PriceBar, StockSnapshot, NewsItem } from '../types.js';
import type { NewsSourceStatus, DailyReport } from './dailyReport.js';
import { buildDailyReport } from './dailyReport.js';
import { buildMarketSection } from './marketSection.js';
import { buildEdge, type InsiderReport } from '../analysis/edge.js';
import { weeklyFromDaily } from '../analysis/horizons.js';
import { withCurrency } from './format.js';
import { fetchEdgar } from '../sources/edgar.js';
import { fetchUsNews, US_NEWS_SOURCE, usNewsName } from '../sources/usNews.js';
import { fetchWorldBasic, NAVER_WORLD_BASIC_SOURCE, usTicker } from '../sources/naverWorld.js';

export interface UsResearch {
  cik: number | null;
  disclosures: Disclosure[];
  finance: FinancePeriod[];
  insider: InsiderReport[];
  snapshot: StockSnapshot | null;
  news: NewsItem[];
  status: NewsSourceStatus[];
}

export const emptyUsResearch = (): UsResearch => ({ cik: null, disclosures: [], finance: [], insider: [], snapshot: null, news: [], status: [] });

/** Every source in turn; a source that fails leaves a status row and the rest still arrive. */
export async function gatherUsResearch(input: { symbol: string; ticker: string; nameEng: string; cik?: number | null; fetch?: typeof fetch; now?: () => Date; contact?: string }): Promise<UsResearch> {
  const now = input.now ?? (() => new Date()), out = emptyUsResearch();
  const opts = { ...(input.fetch ? { fetch: input.fetch } : {}), now };
  // The three sources are independent: EDGAR (serial inside, for SEC's rate limit), Naver and Google run side by side.
  const [edgar, snapshot, news] = await Promise.allSettled([
    fetchEdgar({ symbol: input.symbol, ticker: input.ticker, cik: input.cik ?? null, ...opts, ...(input.contact ? { contact: input.contact } : {}) }),
    fetchWorldBasic(input.symbol, opts),
    fetchUsNews(input.ticker, input.nameEng, opts),
  ]);
  const failed = (source: string, e: unknown) => ({ source, ok: false, count: 0, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' });
  if (edgar.status === 'fulfilled') { out.cik = edgar.value.cik; out.disclosures = edgar.value.disclosures; out.finance = edgar.value.finance; out.insider = edgar.value.insider; out.status.push(...edgar.value.status); } else out.status.push(failed('sec:edgar', edgar.reason));
  if (snapshot.status === 'fulfilled') { out.snapshot = snapshot.value; out.status.push({ source: NAVER_WORLD_BASIC_SOURCE, ok: !!out.snapshot, count: out.snapshot ? 1 : 0 }); } else out.status.push(failed(NAVER_WORLD_BASIC_SOURCE, snapshot.reason));
  if (news.status === 'fulfilled') { out.news = news.value; out.status.push({ source: US_NEWS_SOURCE, ok: true, count: out.news.length }); } else out.status.push(failed(US_NEWS_SOURCE, news.reason));
  return out;
}

/**
 * The report of a US stock from its daily bars and the research above: filings and news through the usual
 * report builder, the market section with the snapshot and XBRL periods (weekly bars synthesised from the
 * daily ones so the timing gauges work), and the edge section with Form 4 trades.
 */
export function buildUsReport(input: { symbol: string; name: string; nameEng?: string; ticker?: string; kind?: 'etf'; exchange?: 'NASDAQ' | 'NYSE' | 'AMEX'; bars: readonly PriceBar[]; research: UsResearch; now: Date; previous?: DailyReport | null }): DailyReport {
  const { research: r, bars, now } = input, date = bars.at(-1)!.date;
  const sources = [bars[0]?.source ?? 'naver:world', ...r.status.filter((s) => s.ok && s.count).map((s) => s.source)];
  // A story is about this stock when it names the company (as people write it) or the ticker.
  const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const names = [input.nameEng ? usNewsName(input.nameEng) : '', input.ticker ?? usTicker(input.symbol)].filter((x) => x.length >= 2);
  const aliases = names.length ? new RegExp(names.map((n) => `\\b${esc(n)}\\b`).join('|'), 'i') : undefined;
  const report = buildDailyReport({
    symbol: input.symbol, name: input.name, date, generatedAt: now, bars, disclosures: r.disclosures, sources, currency: 'USD',
    ...(input.kind ? { kind: input.kind } : {}), ...(input.exchange ? { exchange: input.exchange } : {}),
    news: r.news, newsStatus: r.status.filter((s) => s.source === US_NEWS_SOURCE), ...(aliases ? { newsAliases: aliases } : {}), ...(input.previous ? { previous: input.previous } : {}),
  });
  report.market = withCurrency('USD', () => buildMarketSection({
    symbol: input.symbol, date, generatedAt: now, daily: bars, weekly: weeklyFromDaily(bars).map((w) => ({ ...w, symbol: input.symbol, source: 'derived:weekly', retrievedAt: now.toISOString() })), intraday: [],
    // The snapshot is taken today (KST) while the last bar is a US session date; dated after the report it would be dropped.
    flows: [], snapshots: r.snapshot ? [{ ...r.snapshot, date: r.snapshot.date > date ? date : r.snapshot.date }] : [], finance: r.finance, research: [], benchmarks: [], loggedForecasts: [], status: r.status.filter((s) => s.source !== US_NEWS_SOURCE),
  }));
  const close = report.price?.close ?? bars.at(-1)!.close;
  if (!input.kind) report.edge = withCurrency('USD', () => buildEdge({ date, close, bars, finance: r.finance, financeLog: r.finance, events: [], insider: r.insider, holders: [], us: true, filings: r.disclosures }));
  const got = { filings: r.disclosures.length, finance: r.finance.length, insider: r.insider.length, news: r.news.length, snapshot: !!r.snapshot };
  report.notes.push(`미국 주식은 네이버 해외 주식 일봉(달러, 미국 현지 날짜) 기준이에요. ${got.filings || got.finance || got.insider ? `SEC EDGAR에서 공시 ${got.filings}건, 재무 ${got.finance}개 기간, 내부자 거래 ${got.insider}건을 읽었어요.` : `SEC EDGAR 자료를 읽지 못해 공시·재무 판단은 보류해요${r.status.some((s) => /EDGAR_HTTP_403/.test(s.error ?? '')) ? '(SEC가 요청을 거절했어요. 운영자가 EDGAR_CONTACT에 연락처를 넣어야 해요)' : ''}.`} ${got.news ? `영문 뉴스 ${got.news}건을 모았어요.` : ''}투자자별 수급과 증권가 목표가는 없어요.`.replace(/\s+/g, ' ').trim());
  return report;
}
