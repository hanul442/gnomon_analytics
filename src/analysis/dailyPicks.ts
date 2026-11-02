// Daily AI reports (docs/DESIGN.md §5.19, G-56): on each settled weekday run, two stocks drawn at
// random from the tops of the ready-made screens, then the ETF (Monday, Wednesday, Friday) or the coin
// (Tuesday, Thursday); on weekends one coin. Every pick gets the full committee (G-168: no briefs), so
// a weekday is three committee reports. The draw is seeded by the date, so a re-run picks the same names. Pure.

import { PRESETS } from './screenRules.js';
import { todaysSignals } from './signalLog.js';
import { usTicker } from '../sources/naverWorld.js';

export type PickKind = 'stock' | 'etf' | 'coin';
export interface DailyPick { date: string; symbol: string; name: string; kind: PickKind; market: 'KOSPI' | 'KOSDAQ' | 'UPBIT' | 'NASDAQ' | 'NYSE' | 'AMEX'; tier: 'deep'; reason: string; /** G-179: a US pick's ticker and English name (from the usstocks row). */ us?: { ticker: string; english: string } }

export const DAILY_STOCKS = 2;
/**
 * G-311: the core rotation. The biggest companies by market cap (preferred shares aside) take turns, two a
 * weekday, the one with the oldest committee report first, so every one of them gets a new report about every
 * two weeks. Before this, the draw only reached screen tops, and 삼성전자·SK하이닉스 sat on a 10/05 report for
 * 18 sessions. With the rotation on, the random draw gives one stock instead of two.
 */
export const CORE_SIZE = 20, CORE_DAILY = 2, CORE_MIN_DAYS = 10;
const PREFERRED = /우[A-C]?$|우\(전환\)$|[0-9]우$/;
/** G-179: one US stock a weekday, from the top of the US list by trading value (ETFs aside). */
export const DAILY_US = 1;
const US_POOL = 40;
/** How far down each list the draw reaches. */
const ETF_POOL = 20, COIN_POOL = 15;
/** Screens left out of the stock draw: overheated and risky names are not what a reader is pointed to. */
const SKIP_PRESETS = new Set(['hot', 'risky']);
/** Leveraged, inverse and cash-like ETFs say little on their own. */
const ETF_SKIP = /레버리지|인버스|2X|곱버스|금리|머니마켓|MMF|단기채|단기통안|KOFR|CD|SOFR/i;
const STABLE = new Set(['USDT', 'USDC', 'USDE', 'DAI', 'USDS', 'PYUSD', 'TUSD']);

/** mulberry32 over a hash of the date. */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: readonly T[], rand: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
  return out;
}

/**
 * `stocks` are screener rows (src/report/renderScreener.ts ScreenerRow), `etfs` and `coins` list rows
 * (src/cli/coins.ts CoinRow, sorted by trading value). `weekday` is 0 (Sunday) to 6 (Saturday), KST.
 * `exclude` holds symbols reported recently or covered otherwise.
 */
export function chooseDailyPicks(input: {
  date: string; weekday: number;
  stocks: readonly (readonly unknown[])[]; etfs: readonly (readonly unknown[])[]; coins: readonly (readonly unknown[])[];
  /** usstocks.json rows: [code, 한글 이름, "TICKER · NASDAQ · English", …, value(백만 달러) at 12]. */
  us?: readonly (readonly unknown[])[];
  exclude: ReadonlySet<string>;
  /** G-311: last committee report date per symbol (YYYY-MM-DD). Given, the core rotation is on. */
  lastReported?: ReadonlyMap<string, string>;
}): DailyPick[] {
  const rand = seeded(`gnm-daily:${input.date}`);
  const weekend = input.weekday === 0 || input.weekday === 6;
  const out: DailyPick[] = [];
  if (!weekend) {
    const rows = new Map(input.stocks.map((r) => [String(r[0]), r]));
    const core = input.lastReported ? coreRotation(input.stocks, input.lastReported, input.date) : [];
    for (const r of core) out.push({ date: input.date, symbol: String(r[0]), name: String(r[1]), kind: 'stock', market: r[2] === 'Q' ? 'KOSDAQ' : 'KOSPI', tier: 'deep', reason: `시가총액 상위 ${CORE_SIZE}종목 순서 (가장 오래된 판단부터)` });
    const randomStocks = input.lastReported ? DAILY_STOCKS - 1 : DAILY_STOCKS;
    const label = new Map(PRESETS.map((p) => [p.key, p.label]));
    // A stock found by several screens counts once, under the first.
    const pool = new Map<string, string>();
    for (const s of todaysSignals(input.stocks, input.date)) {
      const r = rows.get(s.symbol)!;
      if (SKIP_PRESETS.has(s.preset) || input.exclude.has(s.symbol) || pool.has(s.symbol) || core.some((r) => String(r[0]) === s.symbol)) continue;
      if (Number(r[21] ?? 0) >= 2 || Number(r[3] ?? 0) < 1000) continue;
      pool.set(s.symbol, label.get(s.preset) ?? s.preset);
    }
    // G-197: the two stocks come from different screens, and one of them is a larger company (1조+) when the
    // pool has one; the same few screens kept handing over small caps of one kind.
    const order = shuffle([...pool.keys()], rand), chosen: string[] = [];
    const big = (sym: string) => Number(rows.get(sym)![3] ?? 0) >= 10_000;
    // Each next pick is the first (in the day's shuffled order) with the best rank: being a larger company while
    // none of the picks is one yet counts most (3), then a screen not used yet (2).
    // With the core rotation on, the big companies are covered there, so the one random stock stays a discovery.
    while (chosen.length < randomStocks && chosen.length < order.length) {
      const rest = order.filter((x) => !chosen.includes(x));
      const rank = (x: string) => (chosen.some((c) => pool.get(c) === pool.get(x)) ? 0 : 2) + (!core.length && !chosen.some(big) && chosen.length === randomStocks - 1 && big(x) ? 3 : 0);
      chosen.push(rest.reduce((a, x) => (rank(x) > rank(a) ? x : a), rest[0]!));
    }
    for (const symbol of chosen) {
      const r = rows.get(symbol)!;
      out.push({ date: input.date, symbol, name: String(r[1]), kind: 'stock', market: r[2] === 'Q' ? 'KOSDAQ' : 'KOSPI', tier: 'deep', reason: `스크리너 '${pool.get(symbol)}' 신호 후보`  });
    }
    const etfs = input.etfs.filter((r) => !ETF_SKIP.test(String(r[1])) && !input.exclude.has(String(r[0])) && Number(r[4]) > 0).slice(0, ETF_POOL);
    const etf = shuffle(etfs, rand)[0];
    // The ETF on Monday, Wednesday and Friday; the coin on Tuesday and Thursday (and weekends).
    if (etf && input.weekday % 2) out.push({ date: input.date, symbol: String(etf[0]), name: String(etf[1]), kind: 'etf', market: 'KOSPI', tier: 'deep', reason: '거래대금 상위 ETF 후보에서 선정' });
    // G-179: one US stock (not an ETF) from the top of the list by trading value; the desc column carries ticker · exchange · English name.
    const usRows = (input.us ?? []).filter((r) => !input.exclude.has(String(r[0])) && Number(r[4]) > 0 && !/ ETF /.test(` ${String(r[2])} `)).sort((a, b) => Number(b[12] ?? 0) - Number(a[12] ?? 0)).slice(0, US_POOL);
    for (const r of shuffle(usRows, rand).slice(0, DAILY_US)) {
      const [head = '', exchange = 'NASDAQ', ...rest] = String(r[2] ?? '').split(' · '), ticker = head || usTicker(String(r[0]));
      const market = exchange === 'NYSE' ? 'NYSE' as const : exchange === 'AMEX' ? 'AMEX' as const : 'NASDAQ' as const;
      out.push({ date: input.date, symbol: String(r[0]), name: String(r[1]), kind: 'stock', market, tier: 'deep', reason: '미국 거래대금 상위 후보에서 선정', us: { ticker, english: rest.join(' · ') } });
    }
  }
  const coins = input.coins.filter((r) => !STABLE.has(String(r[0]).replace('KRW-', '')) && !r[3] && Number(r[4]) >= 100 && !input.exclude.has(String(r[0]))).slice(0, COIN_POOL);
  const coin = shuffle(coins, rand)[0];
  if (coin && (weekend || input.weekday % 2 === 0)) out.push({ date: input.date, symbol: String(coin[0]), name: String(coin[1]), kind: 'coin', market: 'UPBIT', tier: 'deep', reason: '24시간 거래대금 상위 코인 후보에서 선정' });
  return out;
}

/**
 * G-311: today's core stocks: the CORE_SIZE biggest by market cap (preferred shares aside), those whose last
 * committee report is at least CORE_MIN_DAYS old (or missing), oldest report first, then bigger first. Pure.
 */
export function coreRotation(stocks: readonly (readonly unknown[])[], lastReported: ReadonlyMap<string, string>, date: string): (readonly unknown[])[] {
  const top = stocks.filter((r) => !PREFERRED.test(String(r[1])) && Number(r[3] ?? 0) > 0).sort((a, b) => Number(b[3]) - Number(a[3])).slice(0, CORE_SIZE);
  const age = (r: readonly unknown[]) => { const last = lastReported.get(String(r[0])); return last ? (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 864e5 : Infinity; };
  return top.map((r, i) => ({ r, i, a: age(r) })).filter((x) => x.a >= CORE_MIN_DAYS).sort((x, y) => (y.a - x.a) || (x.i - y.i)).slice(0, CORE_DAILY).map((x) => x.r);
}
