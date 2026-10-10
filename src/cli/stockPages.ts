// Chart data and the free computation for every listed stock without a report
// (docs/DESIGN.md §3.6, G-29). One year of daily bars and quickCalc per stock go
// to site/s/<code>.json for the shared stock.html page. Nothing is kept in
// data/: these are rebuilt every run.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchNaverDailyBars } from '../sources/naverPrice.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { NewsSourceStatus } from '../report/dailyReport.js';
import { renderCalculationPage } from '../report/calculationPage.js';
import { pool } from './weekly.js';
import { quickCalc, type StockCalc } from '../analysis/quickCalc.js';
import { compactCalc } from '../analysis/compactCalc.js';

/** About two years: enough history for the strategy race's in- and out-of-sample split and a long chart. */
export const STOCK_PAGE_BARS = 500;

export async function writeStockPages(
  siteDir: string,
  rows: readonly UniverseRow[],
  covered: ReadonlySet<string>,
  options: { now: () => Date; fetch?: typeof fetch; concurrency?: number },
): Promise<{ status: NewsSourceStatus; calcs: Map<string, StockCalc> }> {
  const dir = join(siteDir, 's');
  await mkdir(dir, { recursive: true });
  const todo = rows.filter((r) => !covered.has(r.symbol));
  let ok = 0;
  const calcs = new Map<string, StockCalc>();
  const errors: string[] = [];
  await pool(todo, options.concurrency ?? 8, async (r) => {
    try {
      const bars = await fetchNaverDailyBars(r.symbol, STOCK_PAGE_BARS, { now: options.now, ...(options.fetch ? { fetch: options.fetch } : {}) });

      const calc = quickCalc(r.symbol, bars, options.now());
      if (calc) calcs.set(r.symbol, calc);
      const body = { pageUrl: `s/${r.symbol}.html`, symbol: r.symbol, name: r.name, market: r.market, kind: r.kind, marketCap: r.marketCap, bars: bars.map((b) => [b.date, b.open, b.high, b.low, b.close, b.volume]), calc: calc ? compactCalc(calc) : null };
      await writeFile(join(dir, `${r.symbol}.json`), JSON.stringify(body));
      await writeFile(join(dir, `${r.symbol}.html`), renderCalculationPage({symbol:r.symbol,name:r.name,...(r.kind==='etf'?{kind:'etf' as const}:{}),bars,now:options.now()}));
      if(bars.length) ok += 1;
    } catch (error) {
      // Keep the same screen even when this stock's price provider is unavailable.
      await writeFile(join(dir, `${r.symbol}.html`),renderCalculationPage({symbol:r.symbol,name:r.name,...(r.kind==='etf'?{kind:'etf' as const}:{}),bars:[],now:options.now()}));
      await writeFile(join(dir, `${r.symbol}.json`),JSON.stringify({pageUrl:`s/${r.symbol}.html`,symbol:r.symbol,name:r.name,market:r.market,bars:[],calc:null}));
      if (errors.length < 3) errors.push(`${r.symbol}:${error instanceof Error ? error.message.slice(0, 60) : 'UNKNOWN'}`);
    }
  });
  const failed = todo.length - ok;
  return { status: { source: 'naver:fchart:day:all', ok: failed <= todo.length * 0.05, count: ok, ...(failed ? { error: `${failed} failed ${errors.join(' ')}` } : {}) }, calcs };
}


/** Rounded for the page: whole won, one decimal for percentages. */
export { compactCalc };
