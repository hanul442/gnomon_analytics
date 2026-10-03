// One daily run: collect, append, write today's report once, render the site.
//
//   OPENDART_API_KEY=... node dist/cli/daily.js [--root <dir>]
//
// Today's report is written only after 18:00 KST (the session is settled) and
// never rewritten: if reports/<date>.json exists it is left as it is.

import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { buildDailyReport, type DailyReport } from '../report/dailyReport.js';
import { CHART_ASSET, renderIndex, renderReport } from '../report/renderHtml.js';
import { fetchNaverDailyBars, NAVER_PRICE_SOURCE } from '../sources/naverPrice.js';
import { fetchDartFilings, OPENDART_SOURCE, SK_HYNIX_CORP_CODE } from '../sources/opendart.js';
import { appendNew, asOf, readLog } from '../store/jsonlLog.js';
import type { Disclosure, PriceBar } from '../types.js';

const SYMBOL = '000660';
const NAME = 'SK하이닉스';
const KST_MS = 9 * 60 * 60_000;
const SETTLED_HOUR_KST = 18;

export function kstParts(at: Date): { date: string; compact: string; hour: number } {
  const kst = new Date(at.getTime() + KST_MS);
  const date = kst.toISOString().slice(0, 10);
  return { date, compact: date.replaceAll('-', ''), hour: kst.getUTCHours() };
}

const priceKey = (bar: PriceBar) => `${bar.symbol}:${bar.date}`;
const filingKey = (filing: Disclosure) => filing.receiptNo;

export async function runDaily(options: {
  root: string;
  now: Date;
  apiKey: string;
  fetch?: typeof fetch;
}): Promise<{ addedBars: number; addedFilings: number; report: 'WRITTEN' | 'EXISTS' | 'NOT_SETTLED' }> {
  const { root, now } = options;
  const clock = () => now;
  const pricePath = join(root, 'data', 'prices', `${SYMBOL}.jsonl`);
  const filingPath = join(root, 'data', 'disclosures', `${SYMBOL}.jsonl`);
  const reportDir = join(root, 'reports');
  const today = kstParts(now);
  const monthAgo = kstParts(new Date(now.getTime() - 31 * 24 * 60 * 60_000));
  const fetchOptions = { now: clock, ...(options.fetch ? { fetch: options.fetch } : {}) };

  const bars = await fetchNaverDailyBars(SYMBOL, 120, fetchOptions);
  const filings = await fetchDartFilings({ apiKey: options.apiKey, corpCode: SK_HYNIX_CORP_CODE, from: monthAgo.compact, to: today.compact, ...fetchOptions });
  const addedBars = await appendNew(pricePath, bars, priceKey);
  const addedFilings = await appendNew(filingPath, filings, filingKey);

  let report: 'WRITTEN' | 'EXISTS' | 'NOT_SETTLED' = 'NOT_SETTLED';
  const reportPath = join(reportDir, `${today.date}.json`);
  if (today.hour >= SETTLED_HOUR_KST) {
    const exists = await readFile(reportPath).then(() => true, () => false);
    if (exists) {
      report = 'EXISTS';
    } else {
      const earlier = await loadReports(reportDir);
      const built = buildDailyReport({
        symbol: SYMBOL,
        name: NAME,
        date: today.date,
        generatedAt: now,
        bars: asOf(await readLog<PriceBar>(pricePath), priceKey, now),
        disclosures: asOf(await readLog<Disclosure>(filingPath), filingKey, now),
        sources: [NAVER_PRICE_SOURCE, OPENDART_SOURCE],
        // The first report (no earlier ones) lists the past month's filings as context.
        previouslyReported: new Set(earlier.flatMap((r) => r.filings.map((f) => f.receiptNo))),
        previous: [...earlier].sort((a, b) => (a.date < b.date ? -1 : 1)).filter((r) => r.date < today.date).at(-1) ?? null,
      });
      await mkdir(reportDir, { recursive: true });
      await writeFile(reportPath, `${JSON.stringify(built, null, 2)}\n`, { flag: 'wx' });
      report = 'WRITTEN';
    }
  }
  await renderSite(root);
  return { addedBars: addedBars.length, addedFilings: addedFilings.length, report };
}

async function loadReports(reportDir: string): Promise<DailyReport[]> {
  const files = (await readdir(reportDir).catch(() => [] as string[])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  const reports: DailyReport[] = [];
  for (const file of files) reports.push(JSON.parse(await readFile(join(reportDir, file), 'utf8')) as DailyReport);
  return reports;
}

export async function renderSite(root: string): Promise<void> {
  const siteDir = join(root, 'site');
  const reports = await loadReports(join(root, 'reports'));
  await mkdir(join(siteDir, 'reports'), { recursive: true });
  for (const report of reports) {
    await writeFile(join(siteDir, 'reports', `${report.date}.html`), renderReport(report, { index: '../index.html' }));
  }
  await writeFile(join(siteDir, 'index.html'), renderIndex(reports));
  // The chart library is served from the site itself, not a CDN.
  // "exports" hides the standalone build; package.json is exported, so locate it from there.
  const packageJson = createRequire(import.meta.url).resolve('lightweight-charts/package.json');
  const library = join(dirname(packageJson), 'dist', 'lightweight-charts.standalone.production.js');
  await mkdir(dirname(join(siteDir, CHART_ASSET)), { recursive: true });
  await copyFile(library, join(siteDir, CHART_ASSET));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootFlag = process.argv.indexOf('--root');
  const root = rootFlag >= 0 ? process.argv[rootFlag + 1] ?? '.' : '.';
  runDaily({ root, now: new Date(), apiKey: process.env.OPENDART_API_KEY ?? '' })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
