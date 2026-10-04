// Chart data for every listed stock without a report (docs/DESIGN.md §3.6).
// One year of daily bars per stock goes to site/s/<code>.json for the shared
// stock.html page. Nothing is kept in data/: these are rebuilt every run.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchNaverDailyBars } from '../sources/naverPrice.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { NewsSourceStatus } from '../report/dailyReport.js';
import { pool } from './weekly.js';

export const STOCK_PAGE_BARS = 250;

export async function writeStockPages(
  siteDir: string,
  rows: readonly UniverseRow[],
  covered: ReadonlySet<string>,
  options: { now: () => Date; fetch?: typeof fetch; concurrency?: number },
): Promise<NewsSourceStatus> {
  const dir = join(siteDir, 's');
  await mkdir(dir, { recursive: true });
  const todo = rows.filter((r) => !covered.has(r.symbol));
  let ok = 0;
  const errors: string[] = [];
  await pool(todo, options.concurrency ?? 8, async (r) => {
    try {
      const bars = await fetchNaverDailyBars(r.symbol, STOCK_PAGE_BARS, { now: options.now, ...(options.fetch ? { fetch: options.fetch } : {}) });
      if (!bars.length) return;
      const body = { symbol: r.symbol, name: r.name, market: r.market, marketCap: r.marketCap, bars: bars.map((b) => [b.date, b.open, b.high, b.low, b.close, b.volume]) };
      await writeFile(join(dir, `${r.symbol}.json`), JSON.stringify(body));
      ok += 1;
    } catch (error) {
      if (errors.length < 3) errors.push(`${r.symbol}:${error instanceof Error ? error.message.slice(0, 60) : 'UNKNOWN'}`);
    }
  });
  const failed = todo.length - ok;
  return { source: 'naver:fchart:day:all', ok: failed <= todo.length * 0.05, count: ok, ...(failed ? { error: `${failed} failed ${errors.join(' ')}` } : {}) };
}
