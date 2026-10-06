import { publicPanels } from '../report/publicPanels.js';
// One daily run: for every stock in tickers.json collect, append, write
// today's report once; then render the site.
//
//   OPENDART_API_KEY=... node dist/cli/daily.js [--root <dir>]
//
// Today's report is written only after 18:00 KST (the session is settled) and
// never rewritten: if reports/<symbol>/<date>.json exists it is left as it is.
// One stock failing does not stop the others.

import { collectRiskFilings } from './riskCollect.js';
import { etfRows, writeCoinPages, type CoinRow } from './coins.js';
import { chooseDailyPicks, type DailyPick } from '../analysis/dailyPicks.js';
import { fetchUpbitDays, fetchUpbitDaysLong, UPBIT_SOURCE } from '../sources/upbit.js';
import { escapeRegex } from './weekly.js';
import { renderCoinsRedirect } from '../report/renderCoins.js';
import { watchInfo } from '../report/conclusion.js';
import { renderGuide, renderUpdates, renderSurvey, validBanners } from '../report/alphaPages.js';
import { trackSignals } from './signals.js';
import type { RiskFlag } from '../analysis/riskFilings.js';
import { SITE_CONFIG } from '../report/alpha.js';
import { renderAccount, renderAdmin, renderLogin, renderOnboarding } from '../report/renderAlpha.js';
import { copyFile, cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { buildDailyReport, type DailyReport } from '../report/dailyReport.js';
import { COMMENTARY_PROMPT_VERSION, publicCommentary, skippedCommentary, writeCommentary, type CommentaryTier } from '../analysis/commentary.js';
import { deepPath, seal, unseal } from '../report/seal.js';
import { AiBudget } from './aiBudget.js';
import type Anthropic from '@anthropic-ai/sdk';
import { CHART_ASSET, FONT_DIR, renderDeep, renderIndex, renderReport, renderStockPage, type HomeEntry, type PageContext, writeAssets } from '../report/renderHtml.js';
import { renderHome, renderReportsPage, type IndexQuote } from '../report/renderHome.js';
import { renderHanul } from '../report/renderHanul.js';
import { render509, renderSupport } from '../report/renderSupport.js';
import { MANIFEST, renderAlerts, SW_JS } from '../report/renderAlerts.js';
import { renderCheckout, renderPricing } from '../report/renderPricing.js';
import { validPromos } from '../report/plans.js';
import { renderPaper, renderScorecard, renderTerms } from '../report/renderScorecard.js';
import { renderScreener, screenerRows } from '../report/renderScreener.js';
import { fetchNaverDailyBars, NAVER_PRICE_SOURCE } from '../sources/naverPrice.js';
import { fetchDartFilings, OPENDART_SOURCE } from '../sources/opendart.js';
import { appendNew, appendUnseen, asOf, readLog } from '../store/jsonlLog.js';
import type { Disclosure, NewsItem, PriceBar } from '../types.js';
import { isRelevant } from '../analysis/news.js';
import { collectMarketData, financeKey, flowKey, intradayKey, marketPaths, researchKey, snapshotKey } from './marketData.js';
import { buildMarketSection } from '../report/marketSection.js';
import { forecastKey, type PriceForecast } from '../analysis/valuation.js';
import { analystCallKey, type AnalystCall } from '../analysis/analysts.js';
import { paperEntries, paperKey, type PaperEntry } from '../analysis/paper.js';
import type { FinancePeriod, IntradaySession, InvestorFlow, ResearchNote, StockSnapshot } from '../types.js';
import type { NewsSourceStatus } from '../report/dailyReport.js';
import { aliasPattern, benchmarksFor, loadTickers, type Ticker } from '../config/tickers.js';
import { collectUniverse, readCorpCodes, readListedStocks, type ListedStock } from './universe.js';
import { loadRequests, type ReportRequest } from '../config/requests.js';
import { latestSelection, pickTicker, pool, runSelection } from './weekly.js';
import { writeStockPages } from './stockPages.js';
import { marketPulse, quickCalc, type MarketPulse, type StockCalc } from '../analysis/quickCalc.js';
import type { Selection, SelectionParams } from '../analysis/selection.js';
import type { UniverseRow } from '../sources/naverList.js';
import { fetchNaverNews, fetchRss, GOOGLE_NEWS_SOURCE, googleNewsSearchUrl, NAVER_NEWS_SOURCE } from '../sources/news.js';

const KST_MS = 9 * 60 * 60_000;

/**
 * G-61: the secret that seals committee reports (env GNM_DEEP_KEY). Without it nothing is sealed and
 * pages carry the whole commentary, as before.
 */
let DEEP_KEY = '';
export const setDeepKey = (key: string | undefined) => { DEEP_KEY = (key ?? '').trim(); };

/** A committee commentary as stored in the public repository: the public part plus the sealed whole. */
async function storable(report: DailyReport): Promise<DailyReport> {
  const c = report.commentary;
  if (!DEEP_KEY || c?.status !== 'OK' || c.tier === 'brief' || c.sealed) return report;
  return { ...report, commentary: { ...publicCommentary(c), sealed: await seal(JSON.stringify(c), DEEP_KEY) } };
}

/** Writes a report page; with the key, the page gets the public part and the paid part is sealed next to it. */
async function writeReportPage(siteDir: string, path: string, report: DailyReport, links: Parameters<typeof renderReport>[1], deepDate: string | null): Promise<void> {
  const c = report.commentary;
  if (!DEEP_KEY || !deepDate || c?.status !== 'OK' || c.tier === 'brief' || c.sealed) { await writeFile(path, renderReport(report, links)); return; }
  await writeFile(path, renderReport({ ...report, commentary: publicCommentary(c) }, { ...links, deep: { date: deepDate } }));
  const file = join(siteDir, deepPath(report.symbol, deepDate));
  await mkdir(dirname(file), { recursive: true });
  const ctx: Pick<PageContext, 'live' | 'previous'> = { live: !!links.live, previous: links.previous ?? null };
  await writeFile(file, await seal(renderDeep(report, ctx), DEEP_KEY));
}
const SETTLED_HOUR_KST = 18;
const daysBetween = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

export function kstParts(at: Date): { date: string; compact: string; hour: number } {
  const kst = new Date(at.getTime() + KST_MS);
  const date = kst.toISOString().slice(0, 10);
  return { date, compact: date.replaceAll('-', ''), hour: kst.getUTCHours() };
}

const priceKey = (bar: PriceBar) => `${bar.symbol}:${bar.date}`;
const filingKey = (filing: Disclosure) => filing.receiptNo;
const newsKey = (item: NewsItem) => item.url;
const MK_ECONOMY_RSS = 'https://www.mk.co.kr/rss/40300001/';

async function collectNews(
  ticker: Ticker,
  options: { naver?: { clientId: string; clientSecret: string } },
  fetchOptions: { now: () => Date; fetch?: typeof fetch },
): Promise<{ items: NewsItem[]; status: NewsSourceStatus[] }> {
  const jobs: [string, () => Promise<NewsItem[]>][] = [
    [NAVER_NEWS_SOURCE, () => (options.naver?.clientId && options.naver.clientSecret
      ? fetchNaverNews({ clientId: options.naver.clientId, clientSecret: options.naver.clientSecret, query: ticker.newsQuery, ...fetchOptions })
      : Promise.reject(new Error('NAVER_API_KEY_MISSING')))],
    [GOOGLE_NEWS_SOURCE, () => fetchRss(googleNewsSearchUrl(ticker.newsQuery), GOOGLE_NEWS_SOURCE, fetchOptions)],
    ['rss:mk-economy', () => fetchRss(MK_ECONOMY_RSS, 'rss:mk-economy', { ...fetchOptions, publisher: '매일경제' })],
  ];
  const items: NewsItem[] = [];
  const status: NewsSourceStatus[] = [];
  const aliases = aliasPattern(ticker);
  for (const [source, run] of jobs) {
    try {
      const got = await run();
      items.push(...got);
      status.push({ source, ok: true, count: got.filter((n) => isRelevant(n.title, aliases)).length });
    } catch (error) {
      status.push({ source, ok: false, count: 0, error: error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN' });
    }
  }
  return { items, status };
}

interface RunOptions {
  root: string;
  now: Date;
  apiKey: string;
  naver?: { clientId: string; clientSecret: string };
  anthropicApiKey?: string;
  /** Monthly AI budget in USD (env GNM_AI_BUDGET_USD); shared by every stock in the run. */
  aiBudgetUsd?: number;
  budget?: AiBudget;
  /** Injected in tests instead of a real API client. */
  anthropic?: Anthropic;
  fetch?: typeof fetch;
}

export interface TickerResult {
  symbol: string;
  addedBars: number;
  addedFilings: number;
  addedNews: number;
  newsStatus: NewsSourceStatus[];
  marketStatus: NewsSourceStatus[];
  report: 'WRITTEN' | 'EXISTS' | 'NOT_SETTLED' | 'SKIPPED';
}

export interface DailyRunResult {
  results: TickerResult[];
  failed: { symbol: string; error: string }[];
  universeStatus: NewsSourceStatus[];
  /** Date of the weekly selection made in this run, if any. */
  selected: string | null;
}

export async function runDaily(options: RunOptions & { tickers: readonly Ticker[]; requests?: readonly ReportRequest[]; concurrency?: number; selectionParams?: SelectionParams; stockPages?: boolean; coins?: boolean; dailyPicks?: boolean }): Promise<DailyRunResult> {
  const { root, now } = options;
  const today = kstParts(now);
  const fetchOpt = options.fetch ? { fetch: options.fetch } : {};
  // Every listed stock, for search and the weekly selection (best effort).
  const universe = await collectUniverse(root, { apiKey: options.apiKey, now, ...fetchOpt });

  // Weekly selection: on Friday's settled run, or the first settled run when none exists yet.
  let selection = await latestSelection(root);
  let selected: string | null = null;
  const friday = new Date(Date.parse(`${today.date}T00:00:00Z`)).getUTCDay() === 5;
  // A missed Friday (failed run) is caught up by the next settled run once the selection is 8+ days old.
  const stale = selection ? daysBetween(selection.date, today.date) >= 8 : true;
  if (today.hour >= SETTLED_HOUR_KST && universe.rows?.length && (stale || (friday && selection!.date !== today.date))) {
    selection = await runSelection({ root, date: today.date, now, apiKey: options.apiKey, universe: universe.rows, core: options.tickers, ...(options.selectionParams ? { params: options.selectionParams } : {}), ...fetchOpt });
    selected = today.date;
  }
  // Coverage: the always-covered stocks, then this week's picks (G-28: dated reports and AI once a week).
  // Core stocks report on Friday's settled run, or the first settled run once their last report is 8+ days old.
  // Picks get AI and a dated report only on the day they are picked; on other days every page is a live dashboard.
  const corpCodes = await readCorpCodes(root);
  const core = new Set(options.tickers.map((t) => t.symbol));
  const weeklyDue = async (symbol: string) => {
    const last = (await readdir(join(root, 'reports', symbol)).catch(() => [] as string[])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < today.date).sort().at(-1)?.slice(0, 10);
    return friday || !last || daysBetween(last, today.date) >= 8;
  };
  const jobs: { ticker: Ticker; tier: CommentaryTier | null; reportDay: boolean; force?: boolean }[] = [];
  for (const t of options.tickers) {
    const due = await weeklyDue(t.symbol);
    jobs.push({ ticker: t, tier: due && t.ai ? 'deep' : null, reportDay: due });
  }
  for (const p of (selection?.picks ?? []).filter((x) => !core.has(x.symbol))) jobs.push({ ticker: pickTicker(p, corpCodes), tier: selected ? p.tier : null, reportDay: selected !== null });
  // Requested stocks: a deep committee right away until one report has it, then dashboards only.
  const listed: readonly ListedStock[] = universe.rows ?? await readListedStocks(root);
  const requested = new Set<string>();
  for (const r of options.requests ?? []) {
    const stock = listed.find((x) => x.symbol === r.symbol);
    if (!stock || jobs.some((j) => j.ticker.symbol === r.symbol)) continue;
    requested.add(r.symbol);
    const hasAi = (await loadReports(join(root, 'reports', r.symbol))).some((rep) => rep.commentary?.status === 'OK');
    jobs.push({ ticker: pickTicker(stock, corpCodes), tier: hasAi ? null : 'deep', reportDay: !hasAi });
  }
  // Refresh requests: a new deep committee report today, once, for a stock whose committee reports
  // all predate the current prompt (earlier dated reports stay as written). Any day, session or not.
  for (const r of (options.requests ?? []).filter((x) => x.refresh)) {
    let job = jobs.find((j) => j.ticker.symbol === r.symbol);
    const stock = listed.find((x) => x.symbol === r.symbol);
    if (!job && stock) jobs.push(job = { ticker: pickTicker(stock, corpCodes), tier: null, reportDay: false });
    if (!job || !job.ticker.ai) continue;
    const current = (await loadReports(join(root, 'reports', r.symbol))).some((rep) => rep.commentary?.status === 'OK' && rep.commentary.promptVersion === COMMENTARY_PROMPT_VERSION);
    if (!current) Object.assign(job, { tier: 'deep', reportDay: true, force: true });
  }
  // Index and peer prices once, before the stocks run in parallel (each stock then writes only its own files).
  const benchStatus: NewsSourceStatus[] = [];
  const fetchBenches = async (list: readonly Ticker[]) => {
    const benches = [...new Map(list.flatMap((t) => benchmarksFor(t)).map((b) => [b.symbol, b])).values()].filter((b) => !benchStatus.some((st) => st.source.endsWith(`:${b.symbol}`)));
    for (const b of benches) {
      try {
        const added = await appendNew(join(root, 'data', 'prices', `${b.symbol}.jsonl`), await benchBars(b.symbol, now, fetchOpt), priceKey);
        benchStatus.push({ source: `${b.symbol.startsWith('KRW-') ? 'upbit:candles:days' : 'naver:fchart:day'}:${b.symbol}`, ok: true, count: added.length });
      } catch (error) {
        benchStatus.push({ source: `${b.symbol.startsWith('KRW-') ? 'upbit:candles:days' : 'naver:fchart:day'}:${b.symbol}`, ok: false, count: 0, error: error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN' });
      }
    }
  };
  await fetchBenches(jobs.map((j) => j.ticker));
  const budget = options.budget ?? await AiBudget.load(root, now, options.aiBudgetUsd);
  const results: TickerResult[] = [];
  const failed: { symbol: string; error: string }[] = [];
  const lives = new Map<string, DailyReport>();
  const run = async ({ ticker, tier, reportDay, force }: (typeof jobs)[number]) => {
    try {
      const result = await runTicker({ ...options, budget }, ticker, tier, core.has(ticker.symbol), reportDay, force);
      result.marketStatus.push(...benchStatus.filter((st) => benchmarksFor(ticker).some((b) => st.source.endsWith(`:${b.symbol}`))));
      results.push(result);
    } catch (error) {
      failed.push({ symbol: ticker.symbol, error: error instanceof Error ? error.message.slice(0, 300) : String(error) });
    }
  };
  // Core stocks one by one (a peer may be another core stock whose price file is being written),
  // then the weekly picks in parallel: each touches only its own files and reads prefetched index prices.
  for (const job of jobs.filter((j) => core.has(j.ticker.symbol))) await run(job);
  await pool(jobs.filter((j) => !core.has(j.ticker.symbol)), options.concurrency ?? 4, run);
  // The dashboards are rebuilt from the latest data on every run; dated reports stay as written.
  for (const r of results) {
    const ticker = jobs.find((j) => j.ticker.symbol === r.symbol)!.ticker;
    lives.set(r.symbol, await composeReport(root, ticker, now, { newsStatus: r.newsStatus, marketStatus: r.marketStatus, barsLimit: 1000 }));
  }
  if (!results.length) throw new Error(`every stock failed: ${failed.map((f) => `${f.symbol} ${f.error}`).join('; ')}`);
  results.sort((a, b) => jobs.findIndex((j) => j.ticker.symbol === a.symbol) - jobs.findIndex((j) => j.ticker.symbol === b.symbol));
  // Every other listed stock gets a chart page with the free computation (best effort).
  const calcs = new Map<string, StockCalc>();
  if (universe.rows?.length && options.stockPages !== false) {
    const withPages = new Set([...jobs.map((j) => j.ticker.symbol), ...(await readdir(join(root, 'reports')).catch(() => [] as string[]))]);
    const pages = await writeStockPages(join(root, 'site'), universe.rows, withPages, { now: () => now, ...fetchOpt });
    universe.status.push(pages.status);
    for (const [k, v] of pages.calcs) calcs.set(k, v);
  }
  // Covered stocks count toward the market's temperature too, from their stored prices.
  for (const j of jobs) {
    const bars = asOf(await readLog<PriceBar>(join(root, 'data', 'prices', `${j.ticker.symbol}.jsonl`)), priceKey, now).slice(-250);
    const calc = quickCalc(j.ticker.symbol, bars, now);
    if (calc) calcs.set(j.ticker.symbol, calc);
  }
  // ETFs (G-55): the same free pages as stocks, listed apart.
  let etfList: CoinRow[] = [];
  if (universe.etfs.length && options.stockPages !== false) {
    const etf = await writeStockPages(join(root, 'site'), universe.etfs, new Set(), { now: () => now, ...fetchOpt });
    universe.status.push({ ...etf.status, source: 'naver:fchart:day:etf' });
    etfList = etfRows(universe.etfs, etf.calcs);
    await writeFile(join(root, 'site', 'etfs.json'), JSON.stringify({ date: now.toISOString(), rows: etfList }));
  }
  // Every Upbit KRW market (G-54): best effort, never fails the run.
  let coinList: CoinRow[] = [];
  if (options.coins !== false) {
    const coins = await writeCoinPages(join(root, 'site'), { now: () => now, ...fetchOpt });
    universe.status.push(coins.status);
    coinList = coins.rows;
  }
  // Filing risk flags for every listed company (G-49), shown next to screener results.
  const risk = await collectRiskFilings({ root, apiKey: options.apiKey, today: today.date, now: () => now, ...fetchOpt });
  universe.status.push({ source: 'opendart:risk-filings', ok: !risk.error, count: risk.fetched, ...(risk.error ? { error: risk.error } : {}) });
  const pulse = marketPulse([...calcs.values()]);
  // Requested ETFs and coins (G-56), named from the lists just computed: a deep committee until one
  // report has it, then dashboards only (the same as a requested stock). Unknown symbols are recorded.
  const reqJobs: (typeof jobs)[number][] = [];
  for (const r of options.requests ?? []) {
    const coin = r.symbol.startsWith('KRW-');
    if (jobs.some((j) => j.ticker.symbol === r.symbol) || (!coin && !universe.etfs.some((e) => e.symbol === r.symbol))) continue;
    const name = coin ? coinList.find((c) => c[0] === r.symbol)?.[1] : universe.etfs.find((e) => e.symbol === r.symbol)?.name;
    if (!name) { universe.status.push({ source: `request:${r.symbol}`, ok: false, count: 0, error: coin ? 'NOT_ON_UPBIT_KRW' : 'NOT_LISTED' }); continue; }
    requested.add(r.symbol);
    const hasAi = (await loadReports(join(root, 'reports', r.symbol))).some((rep) => rep.commentary?.status === 'OK');
    const ticker = dailyTicker({ date: today.date, symbol: r.symbol, name, kind: coin ? 'coin' : 'etf', market: coin ? 'UPBIT' : 'KOSPI', tier: 'deep', reason: '요청' }, corpCodes);
    reqJobs.push({ ticker, tier: hasAi ? null : 'deep', reportDay: !hasAi });
  }
  jobs.push(...reqJobs);
  // Index and Bitcoin prices first; one at a time, since a requested Bitcoin writes the file another coin reads.
  await fetchBenches(reqJobs.map((j) => j.ticker));
  for (const job of reqJobs) await run(job);
  for (const j of reqJobs) {
    const r = results.find((x) => x.symbol === j.ticker.symbol);
    if (r) lives.set(r.symbol, await composeReport(root, j.ticker, now, { newsStatus: r.newsStatus, marketStatus: r.marketStatus, barsLimit: 1000 }));
  }
  // Daily AI reports (G-56): five stocks, an ETF and a coin drawn from the lists just computed, after
  // the close; on a day without a stock session (weekend, holiday) the coin only. They run last, so
  // the monthly AI budget goes to the core stocks and the weekly picks first.
  if (today.hour >= SETTLED_HOUR_KST && options.dailyPicks !== false) {
    const session = pulse?.date === today.date;
    const exclude = new Set([...jobs.map((j) => j.ticker.symbol), ...await recentlyReported(root, today.date, 28)]);
    const picks = await dailyPicksFor(root, today.date, () => chooseDailyPicks({
      date: today.date, weekday: session ? new Date(`${today.date}T00:00:00Z`).getUTCDay() : 0,
      stocks: session && universe.rows ? screenerRows(universe.rows, calcs, new Set(), risk.flags) : [], etfs: session ? etfList : [], coins: coinList, exclude,
    }));
    const fresh = picks.filter((p) => !jobs.some((j) => j.ticker.symbol === p.symbol));
    const pickJobs = fresh.map((p) => ({ ticker: dailyTicker(p, corpCodes), tier: p.tier, reportDay: true }));
    jobs.push(...pickJobs);
    await fetchBenches(pickJobs.map((j) => j.ticker));
    await pool(pickJobs, options.concurrency ?? 4, run);
    for (const j of pickJobs) {
      const r = results.find((x) => x.symbol === j.ticker.symbol);
      if (r) lives.set(r.symbol, await composeReport(root, j.ticker, now, { newsStatus: r.newsStatus, marketStatus: r.marketStatus, barsLimit: 1000 }));
    }
  }
  await renderSite(root, jobs.map((j) => j.ticker), lives, universe.rows, selection, requested, { pulse, calcs, risk: risk.flags, daily: await readLog<DailyPick>(join(root, 'data', 'daily-picks.jsonl')) });
  // What failed this run, kept in data/ so it can be checked (and alerted on) without the Actions log.
  const failedSources = (list: readonly NewsSourceStatus[]) => list.filter((st) => !st.ok).map((st) => ({ source: st.source, error: st.error ?? '' }));
  await mkdir(join(root, 'data', 'status'), { recursive: true });
  await writeFile(join(root, 'data', 'status', 'last-run.json'), `${JSON.stringify({
    at: now.toISOString(), selected,
    universe: universe.status,
    stocks: results.map((r) => ({ symbol: r.symbol, report: r.report, failedSources: failedSources([...r.newsStatus, ...r.marketStatus]) })),
    failed,
  }, null, 1)}\n`);
  return { results, failed, universeStatus: universe.status, selected };
}

/** Index prices from Naver; Bitcoin (a coin's benchmark) from Upbit. */
const benchBars = (symbol: string, now: Date, fetchOpt: { fetch?: typeof fetch }) =>
  symbol.startsWith('KRW-') ? fetchUpbitDays(symbol, now, fetchOpt.fetch) : fetchNaverDailyBars(symbol, 250, { now: () => now, ...fetchOpt });

/** Symbols with a dated report in the last `days` days. */
async function recentlyReported(root: string, date: string, days: number): Promise<string[]> {
  const out: string[] = [];
  for (const d of await readdir(join(root, 'reports')).catch(() => [] as string[])) {
    const last = (await readdir(join(root, 'reports', d)).catch(() => [] as string[])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().at(-1)?.slice(0, 10);
    if (last && daysBetween(last, date) < days) out.push(d);
  }
  return out;
}

/** Today's picks as logged; drawn and logged once a day, so a re-run reports the same names. */
async function dailyPicksFor(root: string, date: string, choose: () => DailyPick[]): Promise<DailyPick[]> {
  const path = join(root, 'data', 'daily-picks.jsonl');
  const logged = (await readLog<DailyPick>(path)).filter((p) => p.date === date);
  if (logged.length) return logged;
  const picks = choose();
  await appendUnseen(path, picks, (p) => `${p.date}|${p.symbol}`);
  return picks;
}

export function dailyTicker(p: DailyPick, corpCodes: Readonly<Record<string, string>>): Ticker {
  if (p.kind === 'stock') return pickTicker({ symbol: p.symbol, name: p.name, market: p.market === 'KOSDAQ' ? 'KOSDAQ' : 'KOSPI' }, corpCodes);
  const sym = p.symbol.replace('KRW-', '');
  return { symbol: p.symbol, name: p.name, market: p.kind === 'coin' ? 'UPBIT' : 'KOSPI', kind: p.kind, dartCorpCode: '', newsQuery: p.kind === 'coin' ? `${p.name} 코인` : p.name,
    newsAliases: p.kind === 'coin' ? [escapeRegex(p.name), `\\b${escapeRegex(sym)}\\b`] : [escapeRegex(p.name)], ai: true };
}

async function runTicker(options: RunOptions, ticker: Ticker, tier: CommentaryTier | null, core: boolean, reportDay: boolean, force = false): Promise<TickerResult> {
  const { root, now } = options;
  const SYMBOL = ticker.symbol;
  const clock = () => now;
  const pricePath = join(root, 'data', 'prices', `${SYMBOL}.jsonl`);
  const filingPath = join(root, 'data', 'disclosures', `${SYMBOL}.jsonl`);
  const reportDir = join(root, 'reports', SYMBOL);
  const today = kstParts(now);
  const monthAgo = kstParts(new Date(now.getTime() - 31 * 24 * 60 * 60_000));
  const fetchOptions = { now: clock, ...(options.fetch ? { fetch: options.fetch } : {}) };

  // About four years of sessions: enough history for strategy backtests.
  const coin = ticker.market === 'UPBIT';
  const bars = coin ? await fetchUpbitDaysLong(SYMBOL, now, 1000, options.fetch) : await fetchNaverDailyBars(SYMBOL, 1000, fetchOptions);
  // Without a corp code DART would return every company's filings, so skip it.
  const filings = ticker.dartCorpCode ? await fetchDartFilings({ apiKey: options.apiKey, corpCode: ticker.dartCorpCode, from: monthAgo.compact, to: today.compact, ...fetchOptions }) : [];
  const addedBars = await appendNew(pricePath, bars, priceKey);
  const addedFilings = await appendNew(filingPath, filings, filingKey);
  // News is best effort: a failed source is recorded and shown, never fatal.
  const newsPath = join(root, 'data', 'news', `${SYMBOL}.jsonl`);
  const { items: news, status: newsStatus } = await collectNews(ticker, options, fetchOptions);
  const aliases = aliasPattern(ticker);
  const addedNews = await appendUnseen(newsPath, news.filter((n) => isRelevant(n.title, aliases)), newsKey);
  // Index and peer prices were fetched once by runDaily.
  // Coins have no Naver weekly, minute, flow or finance pages.
  const marketStatus = coin ? [] : await collectMarketData(root, SYMBOL, today.date, fetchOptions, []);

  let report: 'WRITTEN' | 'EXISTS' | 'NOT_SETTLED' | 'SKIPPED' = 'NOT_SETTLED';
  const reportPath = join(reportDir, `${today.date}.json`);
  const forecastPath = join(root, 'data', 'forecasts', `${SYMBOL}.jsonl`);
  if (today.hour >= SETTLED_HOUR_KST) {
    const exists = await readFile(reportPath).then(() => true, () => false);
    if (exists) {
      report = 'EXISTS';
    } else {
      const built = await composeReport(root, ticker, now, { newsStatus, marketStatus });
      // When a dated report is kept (G-27, G-28): on the weekly report day only, and for core stocks only
      // on a trading day (a holiday adds nothing and would spend an AI call).
      const session = built.status === 'SESSION';
      const keep = reportDay && (!core || session || force);
      // Core stocks still log forecasts and paper positions every trading day, report or not.
      if (!keep) {
        if (core && session && built.price && built.market) {
          await appendUnseen(forecastPath, built.market.forecasts, forecastKey);
          await appendUnseen(join(root, 'data', 'paper', `${SYMBOL}.jsonl`), paperEntries({
            symbol: SYMBOL, sessionDate: built.price.sessionDate ?? today.date, close: built.price.close, arena: built.market.arena, recordedAt: now.toISOString(),
          }), paperKey);
        }
        return { symbol: SYMBOL, addedBars: addedBars.length, addedFilings: addedFilings.length, addedNews: addedNews.length, newsStatus, marketStatus, report: 'SKIPPED' };
      }
      // Forecasts are logged as made and never revised; a repeat of the same base session is skipped.
      await appendUnseen(forecastPath, built.market!.forecasts, forecastKey);
      // AI commentary never blocks the report: a failure is stored as status FAILED.
      if (tier && options.budget && !options.budget.allows(tier)) {
        built.commentary = skippedCommentary(built, `AI_MONTHLY_BUDGET:${options.budget.limit}USD`, now);
      } else if (tier) {
        options.budget?.reserve(tier);
        built.commentary = await writeCommentary(built, {
          now: clock, tier,
          ...(options.anthropic ? { client: options.anthropic } : {}),
          ...(options.anthropicApiKey ? { apiKey: options.anthropicApiKey } : {}),
        });
        await options.budget?.record(SYMBOL, tier, built.commentary, now);
      }
      // Analyst calls are logged as made, to be scored 20 sessions later.
      const c = built.commentary;
      if (c?.status === 'OK' && c.analysts?.length && built.price) {
        const calls: AnalystCall[] = c.analysts.map((v) => ({
          symbol: SYMBOL, analyst: v.analyst, reportDate: today.date, baseDate: built.price!.sessionDate ?? today.date, baseClose: built.price!.close,
          stance: v.stance, confidence: v.confidence, target: v.target, promptVersion: c.promptVersion, madeAt: now.toISOString(),
        }));
        await appendUnseen(join(root, 'data', 'analysts', `${SYMBOL}.jsonl`), calls, analystCallKey);
      }
      // Paper ledger: what each follower holds from this close (G-21).
      if (built.price && built.market) {
        await appendUnseen(join(root, 'data', 'paper', `${SYMBOL}.jsonl`), paperEntries({
          symbol: SYMBOL, sessionDate: built.price.sessionDate ?? today.date, close: built.price.close, arena: built.market.arena,
          analysts: c?.status === 'OK' ? c.analysts : undefined, recordedAt: now.toISOString(),
        }), paperKey);
      }
      await mkdir(reportDir, { recursive: true });
      await writeFile(reportPath, `${JSON.stringify(await storable(built))}\n`, { flag: 'wx' });
      report = 'WRITTEN';
    }
  }
  return { symbol: SYMBOL, addedBars: addedBars.length, addedFilings: addedFilings.length, addedNews: addedNews.length, newsStatus, marketStatus, report };
}

/**
 * Builds a report from everything known at `now`. Used for the dated report
 * (written once after 18:00 KST) and for the live front page (every run).
 * The live page reuses the latest dated report's AI commentary, labelled
 * with that report's date; it never calls the model itself.
 */
export async function composeReport(
  root: string,
  ticker: Ticker,
  now: Date,
  options: { newsStatus?: readonly NewsSourceStatus[]; marketStatus?: readonly NewsSourceStatus[]; barsLimit?: number } = {},
): Promise<DailyReport> {
  const today = kstParts(now);
  const SYMBOL = ticker.symbol;
  const reportDir = join(root, 'reports', SYMBOL);
  const pricePath = join(root, 'data', 'prices', `${SYMBOL}.jsonl`);
  const filingPath = join(root, 'data', 'disclosures', `${SYMBOL}.jsonl`);
  const newsPath = join(root, 'data', 'news', `${SYMBOL}.jsonl`);
  const forecastPath = join(root, 'data', 'forecasts', `${SYMBOL}.jsonl`);
  const earlier = (await loadReports(reportDir)).filter((r) => r.date < today.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const daily = asOf(await readLog<PriceBar>(pricePath), priceKey, now);
  const built = buildDailyReport({
    symbol: SYMBOL,
    name: ticker.name,
    ...(ticker.kind ? { kind: ticker.kind } : {}),
    date: today.date,
    generatedAt: now,
    bars: daily,
    disclosures: asOf(await readLog<Disclosure>(filingPath), filingKey, now),
    news: asOf(await readLog<NewsItem>(newsPath), newsKey, now),
    newsStatus: options.newsStatus ?? [],
    newsAliases: aliasPattern(ticker),
    sources: ticker.market === 'UPBIT' ? [UPBIT_SOURCE] : ticker.kind === 'etf' ? [NAVER_PRICE_SOURCE] : [NAVER_PRICE_SOURCE, OPENDART_SOURCE],
    // The first report (no earlier ones) lists the past month's filings as context.
    previouslyReported: new Set(earlier.flatMap((r) => r.filings.map((f) => f.receiptNo))),
    previous: earlier.at(-1) ?? null,
    ...(options.barsLimit ? { barsLimit: options.barsLimit } : {}),
  });
  const mp = marketPaths(root, SYMBOL);
  built.market = buildMarketSection({
    symbol: SYMBOL, date: today.date, generatedAt: now,
    daily,
    weekly: asOf(await readLog<PriceBar>(mp.weekly), priceKey, now),
    intraday: asOf(await readLog<IntradaySession>(mp.intraday), intradayKey, now),
    flows: asOf(await readLog<InvestorFlow>(mp.flows), flowKey, now),
    snapshots: asOf(await readLog<StockSnapshot>(mp.snapshots), snapshotKey, now),
    finance: asOf(await readLog<FinancePeriod>(mp.finance), financeKey, now),
    research: asOf(await readLog<ResearchNote>(mp.research), researchKey, now),
    benchmarks: await Promise.all(benchmarksFor(ticker).map(async (b) => ({ ...b, bars: asOf(await readLog<PriceBar>(mp.daily(b.symbol)), priceKey, now) }))),
    loggedForecasts: (await readLog<PriceForecast>(forecastPath)).filter((f) => f.madeAt <= now.toISOString()),
    analystCalls: (await readLog<AnalystCall>(join(root, 'data', 'analysts', `${SYMBOL}.jsonl`))).filter((c) => c.madeAt <= now.toISOString()),
    paperEntries: (await readLog<PaperEntry>(join(root, 'data', 'paper', `${SYMBOL}.jsonl`))).filter((e) => e.recordedAt <= now.toISOString()),
    status: options.marketStatus ?? [],
  });
  return built;
}

async function loadReports(reportDir: string): Promise<DailyReport[]> {
  const files = (await readdir(reportDir).catch(() => [] as string[])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  const reports: DailyReport[] = [];
  for (const file of files) {
    const r = JSON.parse(await readFile(join(reportDir, file), 'utf8')) as DailyReport;
    // With the key, a sealed commentary is opened again (the run needs it whole); without, the public part stays.
    if (DEEP_KEY && r.commentary?.sealed) {
      try { r.commentary = JSON.parse(await unseal(r.commentary.sealed, DEEP_KEY)); } catch { /* wrong key: keep the public part */ }
    } else if (DEEP_KEY && r.commentary?.status === 'OK' && r.commentary.tier !== 'brief') {
      // Written before the key existed: seal it in place so the repo keeps only the public part.
      await writeFile(join(reportDir, file), `${JSON.stringify(await storable(r))}\n`);
    }
    reports.push(r);
  }
  return reports;
}

/**
 * Site layout: index.html lists the stocks; <symbol>/index.html is a stock's
 * dashboard (live when this run built one, else its latest dated report),
 * <symbol>/archive.html its dated reports and <symbol>/reports/<date>.html each one.
 */
export async function renderSite(root: string, tickers: readonly Ticker[], lives: ReadonlyMap<string, DailyReport> = new Map(), universe: readonly UniverseRow[] | null = null, selection: Selection | null = null, requested: ReadonlySet<string> = new Set(), extras: { pulse?: MarketPulse | null; calcs?: ReadonlyMap<string, StockCalc>; risk?: ReadonlyMap<string, RiskFlag>; daily?: readonly DailyPick[] } = {}): Promise<void> {
  const siteDir = join(root, 'site');
  // The alpha API address (G-44): GNM_API_URL wins over gnm.config.json; empty keeps the browser-only MOCK.
  const config = JSON.parse(await readFile(join(root, 'gnm.config.json'), 'utf8').catch(() => '{}')) as { apiUrl?: string };
  SITE_CONFIG.apiUrl = process.env.GNM_API_URL ?? config.apiUrl ?? '';
  const home: HomeEntry[] = [];
  // Stocks picked in earlier weeks keep their pages (latest dated report), off the front page.
  const reportDirs = (await readdir(join(root, 'reports'), { withFileTypes: true }).catch(() => [])).filter((d) => d.isDirectory() && /^([0-9A-Z]{6}|KRW-[A-Z0-9]{1,15})$/.test(d.name)).map((d) => d.name);
  const past: Ticker[] = [];
  for (const symbol of reportDirs.filter((d) => !tickers.some((t) => t.symbol === d))) {
    const latest = (await loadReports(join(root, 'reports', symbol))).sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
    if (latest) past.push({ symbol, name: latest.name, market: symbol.startsWith('KRW-') ? 'UPBIT' : 'KOSPI', ...(latest.kind ? { kind: latest.kind } : {}), dartCorpCode: '', newsQuery: latest.name, newsAliases: [latest.name], ai: false });
  }
  const picks = new Map((selection?.picks ?? []).map((p) => [p.symbol, p]));
  // Daily picks of the last seven days stay on the front page (G-56), newest first.
  const weekAgo = new Date(Date.parse(`${kstParts(new Date()).date}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  const daily = new Map([...(extras.daily ?? [])].filter((p) => p.date >= weekAgo).sort((a, b) => (a.date < b.date ? -1 : 1)).map((p) => [p.symbol, p]));
  for (const ticker of [...tickers, ...past]) {
    const dir = join(siteDir, ticker.symbol);
    const reports = await loadReports(join(root, 'reports', ticker.symbol));
    await mkdir(join(dir, 'reports'), { recursive: true });
    const sorted = [...reports].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const report of sorted) {
      const previous = sorted.filter((r) => r.date < report.date && r.commentary?.status === 'OK').at(-1) ?? null;
      await writeReportPage(siteDir, join(dir, 'reports', `${report.date}.html`), report, { index: '../archive.html', base: '../../', homeHref: '../index.html', archiveHref: '../archive.html', previous }, report.date);
    }
    await writeFile(join(dir, 'archive.html'), renderIndex(reports, { base: '../', name: ticker.name }));
    const latest = [...reports].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
    const live = lives.get(ticker.symbol);
    const links = { index: 'archive.html', base: '../', homeHref: 'index.html', archiveHref: 'archive.html' };
    let page: DailyReport | null = null;
    if (live) {
      const ai = [...reports].filter((r) => r.commentary?.status === 'OK').sort((a, b) => (a.date < b.date ? -1 : 1));
      const withAi = ai.at(-1) ?? [...reports].filter((r) => r.commentary).sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
      page = { ...live, ...(withAi?.commentary ? { commentary: withAi.commentary } : {}) };
      await writeReportPage(siteDir, join(dir, 'index.html'), page, { ...links, live: true, commentaryFrom: withAi?.date ?? null, previous: ai.length > 1 ? ai.at(-2)! : null }, withAi?.date ?? null);
    } else if (latest) {
      page = latest;
      await writeReportPage(siteDir, join(dir, 'index.html'), latest, links, latest.date);
    } else {
      await writeFile(join(dir, 'index.html'), renderIndex(reports, { base: '../', name: ticker.name }));
    }
    if (page) {
      // Calculation-page entry points open an existing report in the same template.
      const calcPath=join(siteDir,page.kind==='coin'?'c':'s',ticker.symbol+'.json');
      try {const raw=JSON.parse(await readFile(calcPath,'utf8'));raw.pageUrl=ticker.symbol+'/index.html';await writeFile(calcPath,JSON.stringify(raw));} catch { /* no shared price file for this covered symbol */ }
      const { commentary: _private, ...input } = page;
      await mkdir(join(siteDir, 'research'), { recursive: true });
      await writeFile(join(siteDir, 'research', ticker.symbol + '.json'), JSON.stringify(input));
      await writeFile(join(siteDir, 'research', ticker.symbol + '.panels.json'), JSON.stringify(publicPanels(input)));
    }
    const pick = picks.get(ticker.symbol);
    const day = daily.get(ticker.symbol);
    const group = day && !pick ? 'daily' : past.includes(ticker) ? 'past' : pick && !pick.core ? 'weekly' : requested.has(ticker.symbol) ? 'request' : 'core';
    home.push({ symbol: ticker.symbol, name: ticker.name, href: `${ticker.symbol}/index.html`, report: page, group, ...(pick ? { reasons: pick.reasons, tier: pick.tier } : day ? { reasons: [day.reason], tier: day.tier, pickDate: day.date, kind: day.kind } : {}) });
  }
  await writeAssets(siteDir);
  await writeFile(join(siteDir, 'stock.html'), renderStockPage());
  // Coins (G-54): the same chart page over site/c/, and the list.
  await writeFile(join(siteDir, 'coin.html'), renderStockPage(true));
  // G-72: ETFs and coins are tabs of 찾기 now; the old addresses forward there.
  await writeFile(join(siteDir, 'coins.html'), renderCoinsRedirect('coin'));
  await writeFile(join(siteDir, 'etfs.html'), renderCoinsRedirect('etf'));
  // Closed alpha pages (G-44); they need the API address to do anything.
  await writeFile(join(siteDir, 'login.html'), renderLogin());
  await writeFile(join(siteDir, 'onboarding.html'), renderOnboarding());
  await writeFile(join(siteDir, 'account.html'), renderAccount());
  await writeFile(join(siteDir, 'admin.html'), renderAdmin());
  await writeFile(join(siteDir, 'pricing.html'), renderPricing());
  // Trial-credit promotions (G-38): edited by hand in promos.json, published as-is when valid.
  const promos = validPromos(JSON.parse(await readFile(join(root, 'promos.json'), 'utf8').catch(() => '[]')));
  await writeFile(join(siteDir, 'promos.json'), JSON.stringify(promos));
  // Alpha guide and surveys (G-58); notices for the home banner are edited by hand in banners.json.
  await writeFile(join(siteDir, 'hanul.html'), renderHanul());
  await writeFile(join(siteDir, 'faq.html'), renderSupport());
  await writeFile(join(siteDir, '509op.html'), render509());
  await writeFile(join(siteDir, 'alerts.html'), renderAlerts());
  await writeFile(join(siteDir, 'sw.js'), SW_JS);
  await writeFile(join(siteDir, 'manifest.webmanifest'), MANIFEST);
  await mkdir(join(siteDir, 'assets'), { recursive: true });
  for (const n of [96, 192, 512]) await copyFile(new URL(`../../assets/gnomon-icon-${n}.png`, import.meta.url), join(siteDir, 'assets', `gnomon-icon-${n}.png`));
  await copyFile(new URL('../../assets/hanul-logo.jpg', import.meta.url), join(siteDir, 'assets', 'hanul-logo.jpg'));
  await writeFile(join(siteDir, 'guide.html'), renderGuide());
  await writeFile(join(siteDir, 'updates.html'), renderUpdates());
  // Guide screenshots (G-74) live in docs/guide and are published next to the page.
  await cp(join(root, 'docs', 'guide'), join(siteDir, 'guide'), { recursive: true }).catch(() => {});
  await writeFile(join(siteDir, 'survey.html'), renderSurvey());
  const banners = validBanners(JSON.parse(await readFile(join(root, 'banners.json'), 'utf8').catch(() => '[]')), kstParts(new Date()).date);
  await writeFile(join(siteDir, 'checkout.html'), renderCheckout());
  // Screener rows over every stock's free computation (G-43), and the presets' track record (G-53).
  const rows = universe && extras.calcs ? screenerRows(universe, extras.calcs, new Set(home.map((e) => e.symbol)), extras.risk) : [];
  const dataDate = extras.pulse?.date ?? null;
  const signals = await trackSignals(root, rows, dataDate, dataDate ?? kstParts(new Date()).date);
  await writeFile(join(siteDir, 'scorecard.html'), renderScorecard(home.filter((e) => e.group !== 'past'), signals.board));
  await writeFile(join(siteDir, 'terms.html'), renderTerms());
  await writeFile(join(siteDir, 'paper.html'), renderPaper());
  // Screener over every stock's free computation (G-43).
  await writeFile(join(siteDir, 'screener.html'), renderScreener());
  await writeFile(join(siteDir, 'screener.json'), JSON.stringify({ date: dataDate, rows }));
  // Index quotes for the front page, from the stored index prices.
  const indices: IndexQuote[] = [];
  for (const [symbol, name] of [['KOSPI', '코스피'], ['KOSDAQ', '코스닥']] as const) {
    // Last record per session (a session can be re-recorded while it is still open).
    const bars = [...new Map((await readLog<PriceBar>(join(root, 'data', 'prices', `${symbol}.jsonl`))).map((b) => [b.date, b] as const)).values()].sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = bars.at(-1), prev = bars.at(-2);
    if (last) indices.push({ symbol, name, date: last.date, close: last.close, changePct: prev ? (last.close / prev.close - 1) * 100 : null, closes: bars.slice(-60).map((b) => b.close) });
  }
  const homeData = {
    banners,
    entries: home, universe, indices, pulse: extras.pulse ?? null, ...(extras.calcs ? { calcs: extras.calcs } : {}),
    selection: selection ? { date: selection.date, eligible: selection.eligible, universe: selection.universe } : null,
  };
  await writeFile(join(siteDir, 'index.html'), renderHome(homeData));
  // The watchlist's status line (G-85): test prices and what is new, per covered stock.
  await writeFile(join(siteDir, 'watchinfo.json'), JSON.stringify(watchInfo(home)));
  await writeFile(join(siteDir, 'reports.html'), renderReportsPage(homeData));
  // Search index: every listed stock, with today's price when the list was fetched this run.
  const covered = new Set([...tickers, ...past].map((t) => t.symbol));
  const items = universe
    ? universe.map((r) => [r.symbol, r.name, r.market, r.close, r.changePct, covered.has(r.symbol) ? 1 : 0])
    : (await readListedStocks(root)).map((r) => [r.symbol, r.name, r.market, null, null, covered.has(r.symbol) ? 1 : 0]);
  for (const t of tickers) if (!items.some((i) => i[0] === t.symbol)) items.push([t.symbol, t.name, t.market, null, null, 1]);
  await writeFile(join(siteDir, 'search.json'), JSON.stringify({ fields: ['symbol', 'name', 'market', 'close', 'changePct', 'report'], items }));
  // The chart library is served from the site itself, not a CDN.
  // "exports" hides the standalone build; package.json is exported, so locate it from there.
  const packageJson = createRequire(import.meta.url).resolve('lightweight-charts/package.json');
  const library = join(dirname(packageJson), 'dist', 'lightweight-charts.standalone.production.js');
  await mkdir(dirname(join(siteDir, CHART_ASSET)), { recursive: true });
  await copyFile(library, join(siteDir, CHART_ASSET));
  // Pretendard (OFL-1.1), split by unicode range so a page loads only the glyphs it uses.
  const fontRoot = join(dirname(createRequire(import.meta.url).resolve('pretendard/package.json')), 'dist', 'web', 'variable');
  await cp(join(fontRoot, 'woff2-dynamic-subset'), join(siteDir, FONT_DIR, 'woff2-dynamic-subset'), { recursive: true });
  await copyFile(join(fontRoot, 'pretendardvariable-dynamic-subset.css'), join(siteDir, FONT_DIR, 'pretendard.css'));
  // Noto Serif KR 600 (OFL-1.1) for headings, woff2 only, also split by unicode range.
  const serifRoot = dirname(createRequire(import.meta.url).resolve('@fontsource/noto-serif-kr/package.json'));
  const serifCss = (await readFile(join(serifRoot, '600.css'), 'utf8'))
    .replace(/, url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g, '')
    .replaceAll('./files/', './serif/');
  await mkdir(join(siteDir, FONT_DIR, 'serif'), { recursive: true });
  for (const file of (await readdir(join(serifRoot, 'files'))).filter((f) => f.endsWith('-600-normal.woff2'))) {
    await copyFile(join(serifRoot, 'files', file), join(siteDir, FONT_DIR, 'serif', file));
  }
  await writeFile(join(siteDir, FONT_DIR, 'serif.css'), serifCss);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag >= 0 ? process.argv[rootFlag + 1] ?? '.' : '.';
  setDeepKey(process.env.GNM_DEEP_KEY);
  Promise.all([loadTickers(join(root, 'tickers.json')), loadRequests(join(root, 'requests.json'))])
    .then(([tickers, requests]) => runDaily({
      root, now: new Date(), apiKey: process.env.OPENDART_API_KEY ?? '', tickers, requests,
      naver: { clientId: process.env.NAVER_CLIENT_ID ?? '', clientSecret: process.env.NAVER_CLIENT_SECRET ?? '' },
      anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
      ...(process.env.GNM_AI_BUDGET_USD ? { aiBudgetUsd: Number(process.env.GNM_AI_BUDGET_USD) } : {}),
    }))
    .then((result) => {
      console.log(JSON.stringify(result));
      // A failed stock is reported; the run still succeeds so the others are published.
      for (const f of result.failed) console.error(`::warning::${f.symbol} failed: ${f.error}`);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
