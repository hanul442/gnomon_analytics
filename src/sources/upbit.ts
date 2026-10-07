// Upbit quotation API (https://docs.upbit.com): KRW markets and daily candles. Public, no key.
// Daily candles cut at 09:00 KST. Rate limit about 10 requests a second per IP.

import type { PriceBar } from '../types.js';

export const UPBIT_SOURCE = 'upbit:candles:days';
const BASE = 'https://api.upbit.com/v1';

export interface CoinMarket { market: string; name: string; english: string; warning: boolean }

/** KRW markets only; `warning` is Upbit's 유의 종목 flag. */
export function parseUpbitMarkets(json: unknown): CoinMarket[] {
  if (!Array.isArray(json)) throw new Error('UPBIT_MARKETS_SHAPE');
  return (json as Record<string, unknown>[])
    .filter((m) => typeof m.market === 'string' && /^KRW-[A-Z0-9]{1,15}$/.test(m.market) && typeof m.korean_name === 'string')
    .map((m) => {
      const ev = m.market_event as { warning?: unknown } | undefined;
      return { market: m.market as string, name: (m.korean_name as string).trim(), english: typeof m.english_name === 'string' ? m.english_name : '', warning: m.market_warning === 'CAUTION' || ev?.warning === true };
    });
}

/** Candles arrive newest first; returns oldest first, dated by the KST day they start. */
export function parseUpbitDays(json: unknown, market: string, retrievedAt: Date): PriceBar[] {
  if (!Array.isArray(json)) throw new Error('UPBIT_CANDLES_SHAPE');
  const out: PriceBar[] = [];
  for (const c of json as Record<string, unknown>[]) {
    const date = typeof c.candle_date_time_kst === 'string' ? c.candle_date_time_kst.slice(0, 10) : '';
    const [open, high, low, close, volume] = [c.opening_price, c.high_price, c.low_price, c.trade_price, c.candle_acc_trade_volume].map(Number);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(close! > 0) || !(high! >= low!)) continue;
    out.push({ symbol: market, date, open: open!, high: high!, low: low!, close: close!, volume: volume! >= 0 ? volume! : 0, source: UPBIT_SOURCE, retrievedAt: retrievedAt.toISOString() });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Trading value of the last 24 hours, KRW, per market (one request for many markets). */
export function parseUpbitTickers(json: unknown): Map<string, { value24h: number; changePct: number }> {
  const out = new Map<string, { value24h: number; changePct: number }>();
  if (!Array.isArray(json)) return out;
  for (const t of json as Record<string, unknown>[]) {
    if (typeof t.market === 'string') out.set(t.market, { value24h: Number(t.acc_trade_price_24h) || 0, changePct: (Number(t.signed_change_rate) || 0) * 100 });
  }
  return out;
}

async function get(path: string, fetcher: typeof fetch): Promise<unknown> {
  const r = await fetcher(`${BASE}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`UPBIT_HTTP_${r.status}`);
  return r.json();
}

export const fetchUpbitMarkets = (fetcher: typeof fetch = fetch) => get('/market/all?isDetails=true', fetcher).then(parseUpbitMarkets);
export const fetchUpbitTickers = (markets: readonly string[], fetcher: typeof fetch = fetch) => get(`/ticker?markets=${markets.join(',')}`, fetcher).then(parseUpbitTickers);
/** 200 days (the API's most per request). */
export const fetchUpbitDays = (market: string, now: Date, fetcher: typeof fetch = fetch) => get(`/candles/days?market=${market}&count=200`, fetcher).then((j) => parseUpbitDays(j, market, now));

/**
 * Up to `total` days, 200 per request, paging back with `to` (exclusive, UTC). A KST-dated candle
 * starts at 00:00 UTC of that date. Used for reported coins (G-56), whose strategy backtests want ~4 years.
 */
export async function fetchUpbitDaysLong(market: string, now: Date, total = 1000, fetcher: typeof fetch = fetch, pauseMs = 150): Promise<PriceBar[]> {
  const out = new Map<string, PriceBar>();
  let to = '';
  while (out.size < total) {
    const page = await get(`/candles/days?market=${market}&count=200${to ? `&to=${encodeURIComponent(to)}` : ''}`, fetcher).then((j) => parseUpbitDays(j, market, now));
    const before = out.size;
    for (const b of page) out.set(b.date, b);
    // A short page is the start of the market; a page with nothing new would loop forever.
    if (page.length < 200 || out.size === before) break;
    to = `${page[0]!.date}T00:00:00Z`;
    if (pauseMs) await new Promise((r) => setTimeout(r, pauseMs));
  }
  return [...out.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-total);
}

export interface CoinCandle { time:number; open:number; high:number; low:number; close:number; volume:number }
/** UTC timestamps stay absolute; the chart formats labels in KST. Missing trades are not fabricated. */
export function parseUpbitMinutes(json:unknown, market:string):CoinCandle[]{
 if(!Array.isArray(json))throw new Error('UPBIT_CANDLES_SHAPE');
 const out=new Map<number,CoinCandle>();
 for(const c of json as Record<string,unknown>[]){
  if(c.market!==market||typeof c.candle_date_time_utc!=='string')continue;
  const time=Date.parse(c.candle_date_time_utc+'Z')/1000;
  const [open,high,low,close,volume]=[c.opening_price,c.high_price,c.low_price,c.trade_price,c.candle_acc_trade_volume].map(Number);
  if(![time,open,high,low,close,volume].every(Number.isFinite)||!(open!>0&&close!>0&&low!>0&&high!>=low!&&volume!>=0))continue;
  out.set(time,{time,open:open!,high:high!,low:low!,close:close!,volume:volume!});
 }
 return [...out.values()].sort((a,b)=>a.time-b.time);
}
export const fetchUpbitMinutes=(market:string,unit:number,fetcher:typeof fetch=fetch)=>get(`/candles/minutes/${unit}?market=${market}&count=200`,fetcher).then(j=>parseUpbitMinutes(j,market));

/** G-111: recent trades as one point per second (the last trade of that second), oldest first. */
export interface TickPoint { time: number; price: number; volume: number }
export function parseUpbitTicks(json: unknown, market: string): TickPoint[] {
 if (!Array.isArray(json)) throw new Error('UPBIT_TICKS_SHAPE');
 const out = new Map<number, TickPoint>();
 for (const t of json as Record<string, unknown>[]) {
  if (t.market !== market) continue;
  const ms = Number(t.timestamp), price = Number(t.trade_price), volume = Number(t.trade_volume);
  if (!Number.isFinite(ms) || !(price > 0) || !Number.isFinite(volume)) continue;
  const time = Math.floor(ms / 1000), prev = out.get(time);
  // The API lists newest first, so the first one seen for a second is its last trade.
  if (prev) prev.volume += volume; else out.set(time, { time, price, volume });
 }
 return [...out.values()].sort((a, b) => a.time - b.time);
}
export const fetchUpbitTicks = (market: string, fetcher: typeof fetch = fetch) => get(`/trades/ticks?market=${market}&count=500`, fetcher).then((j) => parseUpbitTicks(j, market));
