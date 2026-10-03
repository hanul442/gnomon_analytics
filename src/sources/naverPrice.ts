// Daily OHLCV from Naver's chart feed (fchart.stock.naver.com).
// Each bar is an <item data="YYYYMMDD|open|high|low|close|volume"/> line.

import type { PriceBar } from '../types.js';

export const NAVER_PRICE_SOURCE = 'naver:fchart:day';
const ITEM = /<item\s+data="([^"]*)"\s*\/?>/g;

function isoDate(yyyymmdd: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(yyyymmdd);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (date.getUTCMonth() !== Number(m) - 1 || date.getUTCDate() !== Number(d)) return null;
  return `${y}-${m}-${d}`;
}

/** Parses the feed; rows with a bad date or a non-positive price are dropped, never repaired. */
export function parseNaverDailyChart(body: string, symbol: string, retrievedAt: Date): PriceBar[] {
  const bars: PriceBar[] = [];
  for (const match of body.matchAll(ITEM)) {
    const parts = (match[1] ?? '').split('|');
    if (parts.length < 6) continue;
    const date = isoDate(parts[0] ?? '');
    const [open, high, low, close, volume] = parts.slice(1, 6).map(Number) as [number, number, number, number, number];
    if (!date || ![open, high, low, close, volume].every(Number.isFinite)) continue;
    // A halted day shows zero prices; it is not a bar.
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) continue;
    bars.push({ symbol, date, open, high, low, close, volume, source: NAVER_PRICE_SOURCE, retrievedAt: retrievedAt.toISOString() });
  }
  if (bars.length === 0 && !body.includes('<chartdata')) throw new Error('NAVER_UNEXPECTED_RESPONSE');
  return bars;
}

export async function fetchNaverDailyBars(
  symbol: string,
  count: number,
  options: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<PriceBar[]> {
  const url = new URL('https://fchart.stock.naver.com/sise.nhn');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('timeframe', 'day');
  url.searchParams.set('count', String(count));
  url.searchParams.set('requestType', '0');
  const response = await (options.fetch ?? fetch)(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`NAVER_HTTP_${response.status}`);
  // The feed is EUC-KR; only ASCII digits are read, so latin1 decoding is enough.
  const body = new TextDecoder('latin1').decode(await response.arrayBuffer());
  return parseNaverDailyChart(body, symbol, (options.now ?? (() => new Date()))());
}
