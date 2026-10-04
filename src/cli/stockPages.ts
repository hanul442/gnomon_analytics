// Chart data and the free computation for every listed stock without a report
// (docs/DESIGN.md §3.6, G-29). One year of daily bars and quickCalc per stock go
// to site/s/<code>.json for the shared stock.html page. Nothing is kept in
// data/: these are rebuilt every run.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchNaverDailyBars } from '../sources/naverPrice.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { NewsSourceStatus } from '../report/dailyReport.js';
import { pool } from './weekly.js';
import { quickCalc, type StockCalc } from '../analysis/quickCalc.js';

export const STOCK_PAGE_BARS = 250;

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
      if (!bars.length) return;
      const calc = quickCalc(r.symbol, bars, options.now());
      if (calc) calcs.set(r.symbol, calc);
      const body = { symbol: r.symbol, name: r.name, market: r.market, marketCap: r.marketCap, bars: bars.map((b) => [b.date, b.open, b.high, b.low, b.close, b.volume]), calc: calc ? compactCalc(calc) : null };
      await writeFile(join(dir, `${r.symbol}.json`), JSON.stringify(body));
      ok += 1;
    } catch (error) {
      if (errors.length < 3) errors.push(`${r.symbol}:${error instanceof Error ? error.message.slice(0, 60) : 'UNKNOWN'}`);
    }
  });
  const failed = todo.length - ok;
  return { status: { source: 'naver:fchart:day:all', ok: failed <= todo.length * 0.05, count: ok, ...(failed ? { error: `${failed} failed ${errors.join(' ')}` } : {}) }, calcs };
}

const r0 = (v: number) => Math.round(v);
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

/** Rounded for the page: whole won, one decimal for percentages. */
export function compactCalc(c: StockCalc): StockCalc {
  return {
    ...c,
    signal: { ...c.signal, score: c.signal.score === null ? null : Math.round(c.signal.score * 100) / 100 },
    moves: c.moves.map((m) => ({ ...m, pct: r1(m.pct) })),
    fair: c.fair ? { ...c.fair, center: r0(c.fair.center), low: r0(c.fair.low), high: r0(c.fair.high), gapPct: r1(c.fair.gapPct)! } : null,
    forecasts: c.forecasts.map((f) => ({ days: f.days, p10: r0(f.p10), p50: r0(f.p50), p90: r0(f.p90) })),
  };
}
