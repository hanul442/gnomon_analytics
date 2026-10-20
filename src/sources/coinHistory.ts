// G-272: a coin's history before Upbit listed it. Upbit only has candles from its own listing day, so a coin that
// traded for years on Binance shows a "52-week high" that is really its Upbit listing-day spike, and every signal
// reads a few weeks of noise. Here the older days come from another exchange, converted to won by the price gap
// seen on the days both list it (USDT→KRW plus the kimchi premium), and the listing day's spike is trimmed.
// Public endpoints, no key. Binance's own host refuses US runners, so its public market-data mirror is used.

import type { PriceBar } from '../types.js';

export type HistorySource = 'binance' | 'okx' | 'bithumb';
/** A day from another exchange, dated like Upbit (the UTC date its 24 hours start on). */
export interface OuterBar { date: string; open: number; high: number; low: number; close: number; volume: number }
export interface CoinHistory {
  /** Where the days before `upbitSince` came from; null when none passed the checks. */
  source: HistorySource | null;
  /** Upbit's first day (its listing day when `listed` is true). */
  upbitSince: string;
  /** Days added before Upbit's first day. */
  added: number;
  /** Won per unit of the other exchange's price (≈ USDT→KRW × (1 + premium) for USDT pairs, ≈ 1 for Bithumb). */
  ratio: number | null;
  /** Upbit's premium over that exchange, %, for USDT pairs (the "kimchi premium" for this coin). */
  premiumPct: number | null;
  /** The listing day's high or low was cut back to what the coin traded at elsewhere (or to its open/close). */
  trimmed: boolean;
}

const UTC_DAY = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const median = (xs: readonly number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2) : NaN; };
const ok = (b: OuterBar) => /^\d{4}-\d{2}-\d{2}$/.test(b.date) && b.close > 0 && b.high >= b.low && b.low > 0 && Number.isFinite(b.volume);

/** data-api.binance.vision /api/v3/klines: [openTime, open, high, low, close, volume, …]. */
export function parseBinanceKlines(json: unknown): OuterBar[] {
  if (!Array.isArray(json)) return [];
  return (json as unknown[][]).map((k) => ({ date: UTC_DAY(Number(k[0])), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) })).filter(ok);
}
/** OKX /api/v5/market/history-candles (bar=1Dutc): newest first, [ts, o, h, l, c, vol, …]. */
export function parseOkxCandles(json: unknown): OuterBar[] {
  const data = (json as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return (data as unknown[][]).map((k) => ({ date: UTC_DAY(Number(k[0])), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) })).filter(ok).reverse();
}
/**
 * Bithumb /v1/candles/days (Upbit's shape). Its days are cut at 00:00 KST, nine hours before Upbit's, so each is
 * dated by the UTC day it mostly covers (15:00 UTC the day before → that day); good enough for days before listing.
 */
export function parseBithumbDays(json: unknown): OuterBar[] {
  if (!Array.isArray(json)) return [];
  return (json as Record<string, unknown>[]).map((c) => ({ date: String(c.candle_date_time_kst ?? '').slice(0, 10), open: Number(c.opening_price), high: Number(c.high_price), low: Number(c.low_price), close: Number(c.trade_price), volume: Number(c.candle_acc_trade_volume) })).filter(ok).reverse();
}

async function getJson(url: string, fetcher: typeof fetch): Promise<unknown> {
  const r = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`HTTP_${r.status}`);
  return r.json();
}

/** Up to `days` daily bars ending `before` (exclusive), oldest first. Never throws: no listing → []. */
export async function fetchOuterDays(source: HistorySource, base: string, before: string, days: number, fetcher: typeof fetch = fetch): Promise<OuterBar[]> {
  const out = new Map<string, OuterBar>();
  const endMs = Date.parse(`${before}T00:00:00Z`);
  try {
    if (source === 'binance') {
      // One request covers 1000 days.
      const page = parseBinanceKlines(await getJson(`https://data-api.binance.vision/api/v3/klines?symbol=${base}USDT&interval=1d&endTime=${endMs - 1}&limit=${Math.min(1000, days)}`, fetcher));
      for (const b of page) out.set(b.date, b);
    } else {
      let cursor = endMs;
      for (let guard = 0; guard < 12 && out.size < days; guard += 1) {
        const url = source === 'okx'
          ? `https://www.okx.com/api/v5/market/history-candles?instId=${base}-USDT&bar=1Dutc&limit=100&after=${cursor}`
          // Bithumb's `to` is KST wall time; its day starting 00:00 KST of `before` is excluded.
          : `https://api.bithumb.com/v1/candles/days?market=KRW-${base}&count=200&to=${encodeURIComponent(new Date(cursor + 9 * 3600_000).toISOString().slice(0, 19).replace('T', ' '))}`;
        const page = (source === 'okx' ? parseOkxCandles : parseBithumbDays)(await getJson(url, fetcher));
        const n = out.size;
        for (const b of page) if (b.date < before) out.set(b.date, b);
        if (!page.length || out.size === n) break;
        cursor = Date.parse(`${page[0]!.date}T00:00:00Z`) - (source === 'bithumb' ? 9 * 3600_000 : 0);
        if (page.length < (source === 'okx' ? 100 : 200)) break;
      }
    }
  } catch { return []; }
  return [...out.values()].filter((b) => b.date < before).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-days);
}

/**
 * Joins `outer` (another exchange) before Upbit's first day, priced in won. Pure.
 * The ratio is the median of Upbit close ÷ outer close over the days both have (the listing day left out when
 * there are others). The pair is trusted only when it plainly is the same coin: the ratio sits within 15% of the
 * USDT rate (or of 1 for a won market), and most overlapping days agree with it within 10%. Ticker clashes
 * (two different coins named AI or O) fail here and add nothing.
 */
export function spliceCoinHistory(upbit: readonly PriceBar[], outer: readonly OuterBar[], opts: { source: HistorySource; usdtKrw: number | null; total: number; listed: boolean }): { bars: PriceBar[]; history: CoinHistory } {
  const first = upbit[0];
  const none = (trimmedBars: PriceBar[], trimmed: boolean): { bars: PriceBar[]; history: CoinHistory } => ({ bars: trimmedBars, history: { source: null, upbitSince: first?.date ?? '', added: 0, ratio: null, premiumPct: null, trimmed } });
  if (!first) return none([], false);
  const fallback = () => { const t = opts.listed ? trimListingDay(upbit, null) : null; return none(t ? t.bars : [...upbit], !!t); };
  const expected = opts.source === 'bithumb' ? 1 : opts.usdtKrw;
  if (!expected || !(expected > 0)) return fallback();
  const byDate = new Map(outer.map((b) => [b.date, b]));
  const pairs = upbit.map((u, i) => ({ u, o: byDate.get(u.date), i })).filter((p): p is { u: PriceBar; o: OuterBar; i: number } => !!p.o);
  const use = (pairs.length > 1 && opts.listed ? pairs.filter((p) => p.i > 0) : pairs).slice(0, 30);
  if (!use.length) return fallback();
  const ratios = use.map((p) => p.u.close / p.o.close), ratio = median(ratios);
  const agree = ratios.filter((r) => Math.abs(r / ratio - 1) <= 0.1).length / ratios.length;
  if (!(Math.abs(ratio / expected - 1) <= 0.15) || (ratios.length >= 3 && agree < 2 / 3)) return fallback();
  const vols = use.filter((p) => p.o.volume > 0 && p.u.volume > 0).map((p) => p.u.volume / p.o.volume), volRatio = vols.length ? median(vols) : 1;
  const want = Math.max(0, opts.total - upbit.length);
  const before = outer.filter((b) => b.date < first.date).slice(-want);
  const tag = `${opts.source}:days×upbit`, at = first.retrievedAt;
  const older: PriceBar[] = before.map((b) => ({ symbol: first.symbol, date: b.date, open: b.open * ratio, high: b.high * ratio, low: b.low * ratio, close: b.close * ratio, volume: b.volume * volRatio, source: tag, retrievedAt: at }));
  const t = opts.listed ? trimListingDay(upbit, byDate.get(first.date) ? scale(byDate.get(first.date)!, ratio) : null) : null;
  const recent = t ? t.bars : [...upbit];
  return {
    bars: [...older, ...recent],
    history: { source: older.length ? opts.source : null, upbitSince: first.date, added: older.length, ratio, premiumPct: opts.source === 'bithumb' ? null : (ratio / expected - 1) * 100, trimmed: !!t },
  };
}

const scale = (b: OuterBar, r: number): OuterBar => ({ ...b, open: b.open * r, high: b.high * r, low: b.low * r, close: b.close * r });

/**
 * Upbit's listing day often spikes for minutes (JPYC, a yen stablecoin, printed 4× its price). That wick is not a
 * level the coin held, so its high is cut to the higher of the close and the day's high elsewhere (or its open,
 * when no other exchange has the day). The low is cut to the low elsewhere; with no other exchange it only goes
 * as far as the open, the close and the next day's low, since listing spikes run up, not down. Returns null when nothing changes.
 */
export function trimListingDay(upbit: readonly PriceBar[], elsewhere: OuterBar | null): { bars: PriceBar[] } | null {
  const d = upbit[0];
  if (!d) return null;
  const hiCap = elsewhere ? Math.max(elsewhere.high, d.close) : Math.max(d.close, Math.min(d.open, (upbit[1]?.high ?? d.close)));
  const loCap = elsewhere ? Math.min(elsewhere.low, d.close) : Math.min(d.close, d.open, upbit[1]?.low ?? d.close);
  // Only a wick more than 10% past that is cut; an ordinary first day stays as Upbit printed it.
  const high = d.high > hiCap * 1.1 ? hiCap : d.high, low = d.low < loCap / 1.1 ? loCap : d.low;
  if (high === d.high && low === d.low) return null;
  const open = Math.min(high, Math.max(low, d.open));
  return { bars: [{ ...d, open, high, low }, ...upbit.slice(1)] };
}

/** Upbit's KRW-USDT price, the won value of one USDT including the premium Koreans pay. */
export async function fetchUsdtKrw(fetcher: typeof fetch = fetch): Promise<number | null> {
  try {
    const j = await getJson('https://api.upbit.com/v1/ticker?markets=KRW-USDT', fetcher) as { trade_price?: unknown }[];
    const p = Number(j?.[0]?.trade_price);
    return p > 0 ? p : null;
  } catch { return null; }
}

/**
 * Upbit days, and when Upbit has fewer than `total` (the coin is newer there), older days from Binance, OKX or
 * Bithumb, whichever adds the most. `listed` = Upbit returned less than asked, so its first day is the listing day.
 */
export async function withOuterHistory(upbit: readonly PriceBar[], total: number, options: { usdtKrw: number | null; fetch?: typeof fetch; sources?: readonly HistorySource[] }): Promise<{ bars: PriceBar[]; history: CoinHistory | null }> {
  const first = upbit[0];
  if (!first || upbit.length >= total) return { bars: [...upbit], history: null };
  const base = first.symbol.replace(/^KRW-/, '');
  let best: { bars: PriceBar[]; history: CoinHistory } | null = null;
  for (const source of options.sources ?? ['binance', 'okx', 'bithumb'] as const) {
    // A few overlapping days are fetched with the older ones, so the ratio can be measured.
    const overlapEnd = upbit[Math.min(upbit.length - 1, 30)]!.date;
    const outer = await fetchOuterDays(source, base, nextDay(overlapEnd), total - upbit.length + 31, options.fetch);
    if (!outer.length) continue;
    const r = spliceCoinHistory(upbit, outer, { source, usdtKrw: options.usdtKrw, total, listed: true });
    if (!best || r.history.added > best.history.added) best = r;
    if (r.bars.length >= total) break;
  }
  return best ?? spliceCoinHistory(upbit, [], { source: 'binance', usdtKrw: options.usdtKrw, total, listed: true });
}

const nextDay = (d: string) => UTC_DAY(Date.parse(`${d}T00:00:00Z`) + 86_400_000);
