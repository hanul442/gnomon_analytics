// Daily AI reports (docs/DESIGN.md §5.19, G-56): on each settled weekday run, five stocks drawn at
// random from the tops of the ready-made screens, one ETF and one coin; on weekends one coin only.
// Two deep committees a weekday (the first stock, and the ETF or the coin on alternate days), the
// rest briefs. The draw is seeded by the date, so a re-run of the same day picks the same names. Pure.

import { PRESETS } from './screenRules.js';
import { todaysSignals } from './signalLog.js';

export type PickKind = 'stock' | 'etf' | 'coin';
export interface DailyPick { date: string; symbol: string; name: string; kind: PickKind; market: 'KOSPI' | 'KOSDAQ' | 'UPBIT'; tier: 'deep' | 'brief'; reason: string }

export const DAILY_STOCKS = 5;
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
  exclude: ReadonlySet<string>;
}): DailyPick[] {
  const rand = seeded(`gnm-daily:${input.date}`);
  const weekend = input.weekday === 0 || input.weekday === 6;
  const out: DailyPick[] = [];
  if (!weekend) {
    const rows = new Map(input.stocks.map((r) => [String(r[0]), r]));
    const label = new Map(PRESETS.map((p) => [p.key, p.label]));
    // A stock found by several screens counts once, under the first.
    const pool = new Map<string, string>();
    for (const s of todaysSignals(input.stocks, input.date)) {
      const r = rows.get(s.symbol)!;
      if (SKIP_PRESETS.has(s.preset) || input.exclude.has(s.symbol) || pool.has(s.symbol)) continue;
      if (Number(r[21] ?? 0) >= 2 || Number(r[3] ?? 0) < 1000) continue;
      pool.set(s.symbol, label.get(s.preset) ?? s.preset);
    }
    for (const symbol of shuffle([...pool.keys()], rand).slice(0, DAILY_STOCKS)) {
      const r = rows.get(symbol)!;
      out.push({ date: input.date, symbol, name: String(r[1]), kind: 'stock', market: r[2] === 'Q' ? 'KOSDAQ' : 'KOSPI', tier: out.length ? 'brief' : 'deep', reason: `스크리너 '${pool.get(symbol)}' 신호 후보`  });
    }
    const etfs = input.etfs.filter((r) => !ETF_SKIP.test(String(r[1])) && !input.exclude.has(String(r[0])) && Number(r[4]) > 0).slice(0, ETF_POOL);
    const etf = shuffle(etfs, rand)[0];
    // Deep for the ETF on Monday, Wednesday and Friday; for the coin on Tuesday and Thursday.
    if (etf) out.push({ date: input.date, symbol: String(etf[0]), name: String(etf[1]), kind: 'etf', market: 'KOSPI', tier: input.weekday % 2 ? 'deep' : 'brief', reason: '거래대금 상위 ETF 후보에서 선정' });
  }
  const coins = input.coins.filter((r) => !STABLE.has(String(r[0]).replace('KRW-', '')) && !r[3] && Number(r[4]) >= 100 && !input.exclude.has(String(r[0]))).slice(0, COIN_POOL);
  const coin = shuffle(coins, rand)[0];
  if (coin) out.push({ date: input.date, symbol: String(coin[0]), name: String(coin[1]), kind: 'coin', market: 'UPBIT', tier: weekend || input.weekday % 2 === 0 ? 'deep' : 'brief', reason: '24시간 거래대금 상위 코인 후보에서 선정' });
  return out;
}
