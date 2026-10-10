// 3.0 US stocks (G-143): the top US stocks by market value on NASDAQ, NYSE and AMEX plus popular ETFs get
// the same free computation as a Korean stock, from Naver's world-stock daily bars (in dollars, US local
// dates). site/u/<code>.json feeds us.html; usstocks.json feeds the 찾기 tab and search. Rebuilt every run,
// best effort: a failure never stops the Korean run.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { US_PAGE_BARS, cents, usDescription, usPage } from '../analysis/usPage.js';
import type { NewsSourceStatus } from '../report/dailyReport.js';
import { fetchUsDirectory, fetchUsUniverse, fetchWorldBars, type UsListing } from '../sources/naverWorld.js';
import { cikMap, edgarUserAgent, tickersUrl } from '../sources/edgar.js';
import type { CoinRow } from './coins.js';
import { pool } from './weekly.js';

const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);

/**
 * Rows in the coin list's shape: [code, 한글 이름, "TICKER · Exchange · English name", 0, close, change%, level,
 * score×100, r5, r20, r120, vol1×, value (백만 달러), fairGap%, position, hi52Gap%].
 */
export async function writeUsPages(siteDir: string, options: { now: () => Date; fetch?: typeof fetch; universe?: readonly UsListing[]; concurrency?: number }): Promise<{ status: NewsSourceStatus; rows: CoinRow[]; /** The latest US session among the pages (G-179: the home temperature card's date). */ date: string }> {
  const now = options.now(), dir = join(siteDir, 'u');
  await mkdir(dir, { recursive: true });
  let list: readonly UsListing[];
  // G-188: every listed US stock's name for search (pages for the rest are made on demand by the API). Best effort.
  let directory: Awaited<ReturnType<typeof fetchUsDirectory>> | undefined;
  if (!options.universe) {
    try { directory = await fetchUsDirectory(options.fetch ? { fetch: options.fetch } : {}); } catch { directory = undefined; }
    if (directory?.listings.length) await writeFile(join(siteDir, 'usnames.json'), JSON.stringify({ date: now.toISOString(), rows: directory.listings.map((l) => [l.code, l.name, usDescription(l)]) }));
  }
  try { list = options.universe ?? await fetchUsUniverse({ ...(options.fetch ? { fetch: options.fetch } : {}), ...(directory ? { directory } : {}) }); } catch (e) {
    return { status: { source: 'naver:world:universe', ok: false, count: 0, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' }, rows: [], date: '' };
  }
  // G-179: the SEC CIK per ticker, from one download; a requested report then skips the 1 MB map. Best effort.
  let ciks = new Map<string, number>();
  try { const r = await (options.fetch ?? fetch)(tickersUrl, { headers: { 'User-Agent': edgarUserAgent(process.env.EDGAR_CONTACT), Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) }); if (r.ok) ciks = cikMap(await r.json()); } catch { /* no CIKs this run */ }
  const rows: CoinRow[] = [], errors: string[] = [];
  let latest = '';
  await pool(list, options.concurrency ?? 6, async (l) => {
    try {
      const bars = await fetchWorldBars(l.code, US_PAGE_BARS, { now: () => now, ...(options.fetch ? { fetch: options.fetch } : {}) });
      if (bars.length < 2) return;
      const { body, calc } = usPage(l.code, bars, now, { ...l, cik: ciks.get(l.ticker.toUpperCase().replace(/\./g, '-')) ?? null });
      const last = bars.at(-1)!, prev = bars.at(-2)!;
      if (last.date > latest) latest = last.date;
      await writeFile(join(dir, `${l.code}.json`), JSON.stringify(body));
      const mv = (d: number) => r1(calc?.moves.find((x) => x.days === d)?.pct);
      rows.push([l.code, l.name, usDescription(l), 0, cents(last.close), r1(l.changePct ?? (last.close / prev.close - 1) * 100),
        calc?.signal.level ?? 'WITHHELD', calc?.signal.score == null ? null : Math.round(calc.signal.score * 100), mv(5), mv(20), mv(120),
        r1(calc?.volume?.ratio1), l.valueUsd != null ? Math.round(l.valueUsd / 1e6) : Math.round((last.volume * last.close) / 1e6), r1(calc?.fair?.gapPct),
        calc?.fair ? (calc.fair.position === 'ABOVE' ? 'A' : calc.fair.position === 'BELOW' ? 'B' : 'I') : null, r1(calc?.hi52GapPct)]);
    } catch (e) {
      if (errors.length < 3) errors.push(`${l.code}:${e instanceof Error ? e.message.slice(0, 40) : 'UNKNOWN'}`);
    }
  });
  rows.sort((a, b) => (b[12] ?? 0) - (a[12] ?? 0));
  const failed = list.length - rows.length;
  // A directory walk that stopped early leaves those exchanges' smaller names out of search today: say so.
  if (directory?.partial.length) errors.unshift(`names cut short: ${directory.partial.join(',')}`);
  await writeFile(join(siteDir, 'usstocks.json'), JSON.stringify({ date: now.toISOString(), currency: 'USD', rows }));
  return { status: { source: NAVER_WORLD_DAY, ok: list.length > 0 && failed <= list.length * 0.1, count: rows.length, ...(failed || directory?.partial.length ? { error: `${failed} failed ${errors.join(' ')}` } : {}) }, rows, date: latest };
}
const NAVER_WORLD_DAY = 'naver:world:day:all';
