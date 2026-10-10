// Coins (docs/DESIGN.md §5.17, G-54): every Upbit KRW market gets the same free computation as a
// stock, from 200 daily candles (09:00 KST cut). site/c/<market>.json feeds coin.html; coins.json
// feeds coins.html. Rebuilt every run; nothing is kept in data/. Best effort: a failure never stops
// the stock run.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { quickCalc, type StockCalc } from '../analysis/quickCalc.js';
import type { NewsSourceStatus } from '../report/dailyReport.js';
import type { UniverseRow } from '../sources/naverList.js';
import { fetchUpbitDaysLong, fetchUpbitMarkets, fetchUpbitTickers } from '../sources/upbit.js';
import { renderCalculationPage } from '../report/calculationPage.js';
import { coinCalc } from '../analysis/compactCalc.js';

/** [market, name, english, warning, close, change24h%, level, score×100, r5, r20, r120, vol1×, value24h(억), fairGap%, position, hi52Gap%]. */
export type CoinRow = [string, string, string, 0 | 1, number, number | null, string, number | null, number | null, number | null, number | null, number | null, number | null, number | null, 'A' | 'I' | 'B' | null, number | null];

export { coinCalc };
/** Six significant digits: coins trade from fractions of a won to tens of millions. */
const sig = (v: number) => Number(v.toPrecision(6));

/** ETFs (G-55) in the coins list's row shape: no caution flag, trading value of the day. */
export function etfRows(rows: readonly UniverseRow[], calcs: ReadonlyMap<string, StockCalc>): CoinRow[] {
  const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
  return rows.filter((u) => calcs.has(u.symbol)).map((u): CoinRow => {
    const c = calcs.get(u.symbol)!, mv = (d: number) => r1(c.moves.find((x) => x.days === d)?.pct);
    return [u.symbol, u.name, '', 0, c.close, r1(u.changePct), c.signal.level ?? 'WITHHELD', c.signal.score == null ? null : Math.round(c.signal.score * 100), mv(5), mv(20), mv(120),
      r1(c.volume?.ratio1), u.tradingValue == null ? null : Math.round(u.tradingValue / 1e8), r1(c.fair?.gapPct), c.fair ? (c.fair.position === 'ABOVE' ? 'A' : c.fair.position === 'BELOW' ? 'B' : 'I') : null, r1(c.hi52GapPct)];
  }).sort((a, b) => (b[12] ?? 0) - (a[12] ?? 0));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function writeCoinPages(siteDir: string, options: { now: () => Date; fetch?: typeof fetch; pauseMs?: number }): Promise<{ status: NewsSourceStatus; rows: CoinRow[] }> {
  const fetcher = options.fetch ?? fetch, now = options.now();
  const dir = join(siteDir, 'c');
  await mkdir(dir, { recursive: true });
  let markets;
  try { markets = await fetchUpbitMarkets(fetcher); } catch (e) {
    return { status: { source: 'upbit:market:all', ok: false, count: 0, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' }, rows: [] };
  }
  const tickers = new Map<string, { value24h: number; changePct: number }>();
  for (let i = 0; i < markets.length; i += 100) {
    try { for (const [k, v] of await fetchUpbitTickers(markets.slice(i, i + 100).map((m) => m.market), fetcher)) tickers.set(k, v); } catch { /* the list still works without 24h values */ }
  }
  const rows: CoinRow[] = [], errors: string[] = [];
  // Under the quotation limit (about 10 a second): two at a time with a short pause.
  for (let i = 0; i < markets.length; i += 2) {
    await Promise.all(markets.slice(i, i + 2).map(async (m) => {
      try {
        const bars = await fetchUpbitDaysLong(m.market, now, 400, fetcher);
        if (bars.length < 2) return;
        const calc = quickCalc(m.market, bars, now), t = tickers.get(m.market), last = bars.at(-1)!, prev = bars.at(-2)!;
        await writeFile(join(dir, `${m.market}.json`), JSON.stringify({ pageUrl: `c/${m.market}.html`, symbol: m.market, name: m.name, english: m.english, market: 'UPBIT', warning: m.warning,
          bars: bars.map((b) => [b.date, b.open, b.high, b.low, b.close, b.volume]), calc: calc ? coinCalc(calc) : null }));
        await writeFile(join(dir, `${m.market}.html`),renderCalculationPage({symbol:m.market,name:m.name,kind:'coin',bars,now}));
        const mv = (d: number) => { const v = calc?.moves.find((x) => x.days === d)?.pct; return v == null ? null : Math.round(v * 10) / 10; };
        const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
        rows.push([m.market, m.name, m.english, m.warning ? 1 : 0, sig(last.close), r1(t ? t.changePct : (last.close / prev.close - 1) * 100),
          calc?.signal.level ?? 'WITHHELD', calc?.signal.score == null ? null : Math.round(calc.signal.score * 100), mv(5), mv(20), mv(120),
          r1(calc?.volume?.ratio1), t ? Math.round(t.value24h / 1e8) : null, r1(calc?.fair?.gapPct),
          calc?.fair ? (calc.fair.position === 'ABOVE' ? 'A' : calc.fair.position === 'BELOW' ? 'B' : 'I') : null, r1(calc?.hi52GapPct)]);
      } catch (e) {
        if (errors.length < 3) errors.push(`${m.market}:${e instanceof Error ? e.message.slice(0, 40) : 'UNKNOWN'}`);
      }
    }));
    if (options.pauseMs !== 0) await sleep(options.pauseMs ?? 250);
  }
  rows.sort((a, b) => (b[12] ?? 0) - (a[12] ?? 0));
  const failed = markets.length - rows.length;
  await writeFile(join(siteDir, 'coins.json'), JSON.stringify({ date: now.toISOString(), rows }));
  return { status: { source: 'upbit:candles:days:all', ok: failed <= markets.length * 0.05, count: rows.length, ...(failed ? { error: `${failed} failed ${errors.join(' ')}` } : {}) }, rows };
}
