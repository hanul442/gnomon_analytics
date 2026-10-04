// One daily run: for every stock in tickers.json collect, append, write
// today's report once; then render the site.
//
//   OPENDART_API_KEY=... node dist/cli/daily.js [--root <dir>]
//
// Today's report is written only after 18:00 KST (the session is settled) and
// never rewritten: if reports/<symbol>/<date>.json exists it is left as it is.
// One stock failing does not stop the others.

import { copyFile, cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { buildDailyReport, type DailyReport } from '../report/dailyReport.js';
import { writeCommentary } from '../analysis/commentary.js';
import type Anthropic from '@anthropic-ai/sdk';
import { CHART_ASSET, FONT_DIR, renderHome, renderIndex, renderReport, type HomeEntry } from '../report/renderHtml.js';
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
import { collectUniverse, readListedStocks } from './universe.js';
import type { UniverseRow } from '../sources/naverList.js';
import { fetchNaverNews, fetchRss, GOOGLE_NEWS_SOURCE, googleNewsSearchUrl, NAVER_NEWS_SOURCE } from '../sources/news.js';

const KST_MS = 9 * 60 * 60_000;
const SETTLED_HOUR_KST = 18;

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
  report: 'WRITTEN' | 'EXISTS' | 'NOT_SETTLED';
}

export async function runDaily(options: RunOptions & { tickers: readonly Ticker[] }): Promise<{ results: TickerResult[]; failed: { symbol: string; error: string }[]; universeStatus: NewsSourceStatus[] }> {
  // Every listed stock, for search (best effort: the reports do not depend on it).
  const universe = await collectUniverse(options.root, { apiKey: options.apiKey, now: options.now, ...(options.fetch ? { fetch: options.fetch } : {}) });
  const results: TickerResult[] = [];
  const failed: { symbol: string; error: string }[] = [];
  const lives = new Map<string, DailyReport>();
  for (const ticker of options.tickers) {
    try {
      const result = await runTicker(options, ticker);
      results.push(result);
      // The front page is rebuilt from the latest data on every run; dated reports stay as written.
      lives.set(ticker.symbol, await composeReport(options.root, ticker, options.now, { newsStatus: result.newsStatus, marketStatus: result.marketStatus, barsLimit: 1000 }));
    } catch (error) {
      failed.push({ symbol: ticker.symbol, error: error instanceof Error ? error.message.slice(0, 300) : String(error) });
    }
  }
  if (!results.length) throw new Error(`every stock failed: ${failed.map((f) => `${f.symbol} ${f.error}`).join('; ')}`);
  await renderSite(options.root, options.tickers, lives, universe.rows);
  return { results, failed, universeStatus: universe.status };
}

async function runTicker(options: RunOptions, ticker: Ticker): Promise<TickerResult> {
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
  const bars = await fetchNaverDailyBars(SYMBOL, 1000, fetchOptions);
  const filings = await fetchDartFilings({ apiKey: options.apiKey, corpCode: ticker.dartCorpCode, from: monthAgo.compact, to: today.compact, ...fetchOptions });
  const addedBars = await appendNew(pricePath, bars, priceKey);
  const addedFilings = await appendNew(filingPath, filings, filingKey);
  // News is best effort: a failed source is recorded and shown, never fatal.
  const newsPath = join(root, 'data', 'news', `${SYMBOL}.jsonl`);
  const { items: news, status: newsStatus } = await collectNews(ticker, options, fetchOptions);
  const aliases = aliasPattern(ticker);
  const addedNews = await appendUnseen(newsPath, news.filter((n) => isRelevant(n.title, aliases)), newsKey);
  const marketStatus = await collectMarketData(root, SYMBOL, today.date, fetchOptions, benchmarksFor(ticker));

  let report: 'WRITTEN' | 'EXISTS' | 'NOT_SETTLED' = 'NOT_SETTLED';
  const reportPath = join(reportDir, `${today.date}.json`);
  const forecastPath = join(root, 'data', 'forecasts', `${SYMBOL}.jsonl`);
  if (today.hour >= SETTLED_HOUR_KST) {
    const exists = await readFile(reportPath).then(() => true, () => false);
    if (exists) {
      report = 'EXISTS';
    } else {
      const built = await composeReport(root, ticker, now, { newsStatus, marketStatus });
      // Forecasts are logged as made and never revised; a repeat of the same base session is skipped.
      await appendUnseen(forecastPath, built.market!.forecasts, forecastKey);
      // AI commentary never blocks the report: a failure is stored as status FAILED.
      if (ticker.ai) {
        built.commentary = await writeCommentary(built, {
          now: clock,
          ...(options.anthropic ? { client: options.anthropic } : {}),
          ...(options.anthropicApiKey ? { apiKey: options.anthropicApiKey } : {}),
        });
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
      await writeFile(reportPath, `${JSON.stringify(built, null, 2)}\n`, { flag: 'wx' });
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
    date: today.date,
    generatedAt: now,
    bars: daily,
    disclosures: asOf(await readLog<Disclosure>(filingPath), filingKey, now),
    news: asOf(await readLog<NewsItem>(newsPath), newsKey, now),
    newsStatus: options.newsStatus ?? [],
    newsAliases: aliasPattern(ticker),
    sources: [NAVER_PRICE_SOURCE, OPENDART_SOURCE],
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
  for (const file of files) reports.push(JSON.parse(await readFile(join(reportDir, file), 'utf8')) as DailyReport);
  return reports;
}

/**
 * Site layout: index.html lists the stocks; <symbol>/index.html is a stock's
 * dashboard (live when this run built one, else its latest dated report),
 * <symbol>/archive.html its dated reports and <symbol>/reports/<date>.html each one.
 */
export async function renderSite(root: string, tickers: readonly Ticker[], lives: ReadonlyMap<string, DailyReport> = new Map(), universe: readonly UniverseRow[] | null = null): Promise<void> {
  const siteDir = join(root, 'site');
  const home: HomeEntry[] = [];
  for (const ticker of tickers) {
    const dir = join(siteDir, ticker.symbol);
    const reports = await loadReports(join(root, 'reports', ticker.symbol));
    await mkdir(join(dir, 'reports'), { recursive: true });
    for (const report of reports) {
      await writeFile(join(dir, 'reports', `${report.date}.html`), renderReport(report, { index: '../archive.html', base: '../../', homeHref: '../index.html', archiveHref: '../archive.html' }));
    }
    await writeFile(join(dir, 'archive.html'), renderIndex(reports, { base: '../', name: ticker.name }));
    const latest = [...reports].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
    const live = lives.get(ticker.symbol);
    const links = { index: 'archive.html', base: '../', homeHref: 'index.html', archiveHref: 'archive.html' };
    let page: DailyReport | null = null;
    if (live) {
      const withAi = [...reports].filter((r) => r.commentary).sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
      page = { ...live, ...(withAi?.commentary ? { commentary: withAi.commentary } : {}) };
      await writeFile(join(dir, 'index.html'), renderReport(page, { ...links, live: true, commentaryFrom: withAi?.date ?? null }));
    } else if (latest) {
      page = latest;
      await writeFile(join(dir, 'index.html'), renderReport(latest, links));
    } else {
      await writeFile(join(dir, 'index.html'), renderIndex(reports, { base: '../', name: ticker.name }));
    }
    home.push({ symbol: ticker.symbol, name: ticker.name, href: `${ticker.symbol}/index.html`, report: page });
  }
  await writeFile(join(siteDir, 'index.html'), renderHome(home));
  // Search index: every listed stock, with today's price when the list was fetched this run.
  const covered = new Set(tickers.map((t) => t.symbol));
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
  loadTickers(join(root, 'tickers.json'))
    .then((tickers) => runDaily({
      root, now: new Date(), apiKey: process.env.OPENDART_API_KEY ?? '', tickers,
      naver: { clientId: process.env.NAVER_CLIENT_ID ?? '', clientSecret: process.env.NAVER_CLIENT_SECRET ?? '' },
      anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
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
