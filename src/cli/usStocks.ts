// 3.0 US stocks (G-143): the top US stocks by market value on NASDAQ, NYSE and AMEX plus popular ETFs get
// the same free computation as a Korean stock, from Naver's world-stock daily bars (in dollars, US local
// dates). site/u/<code>.json feeds us.html; usstocks.json feeds the 찾기 tab and search. Rebuilt every run,
// best effort: a failure never stops the Korean run.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { quickCalc } from '../analysis/quickCalc.js';
import type { NewsSourceStatus } from '../report/dailyReport.js';
import { fetchUsUniverse, fetchWorldBars, type UsListing } from '../sources/naverWorld.js';
import { coinCalc, type CoinRow } from './coins.js';
import { pool } from './weekly.js';

/** Two years of sessions, like the Korean pages. */
export const US_PAGE_BARS = 500;

const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
const cents = (v: number) => Math.round(v * 100) / 100;

/**
 * Rows in the coin list's shape: [code, 한글 이름, "TICKER · Exchange · English name", 0, close, change%, level,
 * score×100, r5, r20, r120, vol1×, value (백만 달러), fairGap%, position, hi52Gap%].
 */
export async function writeUsPages(siteDir: string, options: { now: () => Date; fetch?: typeof fetch; universe?: readonly UsListing[]; concurrency?: number }): Promise<{ status: NewsSourceStatus; rows: CoinRow[] }> {
  const now = options.now(), dir = join(siteDir, 'u');
  await mkdir(dir, { recursive: true });
  let list: readonly UsListing[];
  try { list = options.universe ?? await fetchUsUniverse(options.fetch ? { fetch: options.fetch } : {}); } catch (e) {
    return { status: { source: 'naver:world:universe', ok: false, count: 0, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' }, rows: [] };
  }
  const rows: CoinRow[] = [], errors: string[] = [];
  await pool(list, options.concurrency ?? 6, async (l) => {
    try {
      const bars = await fetchWorldBars(l.code, US_PAGE_BARS, { now: () => now, ...(options.fetch ? { fetch: options.fetch } : {}) });
      if (bars.length < 2) return;
      const calc = quickCalc(l.code, bars, now), last = bars.at(-1)!, prev = bars.at(-2)!;
      await writeFile(join(dir, `${l.code}.json`), JSON.stringify({
        symbol: l.code, ticker: l.ticker, name: l.name, english: l.nameEng, market: l.exchange, kind: l.kind, industry: l.industry, currency: 'USD', marketCapUsd: l.marketCapUsd,
        bars: bars.map((b) => [b.date, cents(b.open), cents(b.high), cents(b.low), cents(b.close), b.volume]), calc: calc ? coinCalc(calc) : null,
      }));
      const mv = (d: number) => r1(calc?.moves.find((x) => x.days === d)?.pct);
      rows.push([l.code, l.name, `${l.ticker} · ${l.exchange}${l.kind === 'etf' ? ' ETF' : ''} · ${l.nameEng}`, 0, cents(last.close), r1(l.changePct ?? (last.close / prev.close - 1) * 100),
        calc?.signal.level ?? 'WITHHELD', calc?.signal.score == null ? null : Math.round(calc.signal.score * 100), mv(5), mv(20), mv(120),
        r1(calc?.volume?.ratio1), l.valueUsd != null ? Math.round(l.valueUsd / 1e6) : Math.round((last.volume * last.close) / 1e6), r1(calc?.fair?.gapPct),
        calc?.fair ? (calc.fair.position === 'ABOVE' ? 'A' : calc.fair.position === 'BELOW' ? 'B' : 'I') : null, r1(calc?.hi52GapPct)]);
    } catch (e) {
      if (errors.length < 3) errors.push(`${l.code}:${e instanceof Error ? e.message.slice(0, 40) : 'UNKNOWN'}`);
    }
  });
  rows.sort((a, b) => (b[12] ?? 0) - (a[12] ?? 0));
  const failed = list.length - rows.length;
  await writeFile(join(siteDir, 'usstocks.json'), JSON.stringify({ date: now.toISOString(), currency: 'USD', rows }));
  return { status: { source: NAVER_WORLD_DAY, ok: list.length > 0 && failed <= list.length * 0.1, count: rows.length, ...(failed ? { error: `${failed} failed ${errors.join(' ')}` } : {}) }, rows };
}
const NAVER_WORLD_DAY = 'naver:world:day:all';
