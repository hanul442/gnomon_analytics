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
