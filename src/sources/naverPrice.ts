// OHLCV from Naver's chart feed (fchart.stock.naver.com).
// Day and week bars are <item data="YYYYMMDD|open|high|low|close|volume"/> lines.
// Minute bars are <item data="YYYYMMDDHHmm|null|null|null|close|cumulativeVolume"/>.

import type { IntradaySession, PriceBar } from '../types.js';

export const NAVER_PRICE_SOURCE = 'naver:fchart:day';
export const NAVER_WEEK_SOURCE = 'naver:fchart:week';
export const NAVER_MINUTE_SOURCE = 'naver:fchart:minute';
export type ChartTimeframe = 'day' | 'week' | 'minute';
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
export function parseNaverDailyChart(body: string, symbol: string, retrievedAt: Date, source = NAVER_PRICE_SOURCE): PriceBar[] {
  const bars: PriceBar[] = [];
  for (const match of body.matchAll(ITEM)) {
    const parts = (match[1] ?? '').split('|');
    if (parts.length < 6) continue;
    const date = isoDate(parts[0] ?? '');
    const [open, high, low, close, volume] = parts.slice(1, 6).map(Number) as [number, number, number, number, number];
    if (!date || ![open, high, low, close, volume].every(Number.isFinite)) continue;
    // A halted day shows zero prices; it is not a bar.
    if (open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) continue;
    bars.push({ symbol, date, open, high, low, close, volume, source, retrievedAt: retrievedAt.toISOString() });
  }
  if (bars.length === 0 && !body.includes('<chartdata')) throw new Error('NAVER_UNEXPECTED_RESPONSE');
  return bars;
}

/** Regular KRX session only; Naver's minute feed also carries 08:00-20:00 alternative-venue trading. */
const SESSION_OPEN = '09:00', SESSION_CLOSE = '15:30';

/** Groups minute closes into one record per regular-session day. */
export function parseNaverMinuteChart(body: string, symbol: string, retrievedAt: Date): IntradaySession[] {
  const days = new Map<string, IntradaySession>();
  for (const match of body.matchAll(ITEM)) {
    const parts = (match[1] ?? '').split('|');
    const stamp = parts[0] ?? '';
    if (parts.length < 6 || !/^\d{12}$/.test(stamp)) continue;
    const date = isoDate(stamp.slice(0, 8));
    const time = `${stamp.slice(8, 10)}:${stamp.slice(10, 12)}`;
    const close = Number(parts[4]), cum = Number(parts[5]);
    if (!date || time < SESSION_OPEN || time > SESSION_CLOSE || !(close > 0) || !Number.isFinite(cum) || cum < 0) continue;
    const day = days.get(date) ?? { symbol, date, times: [], closes: [], cumVolumes: [], source: NAVER_MINUTE_SOURCE, retrievedAt: retrievedAt.toISOString() };
    day.times.push(time); day.closes.push(close); day.cumVolumes.push(cum);
    days.set(date, day);
  }
  if (days.size === 0 && !body.includes('<chartdata')) throw new Error('NAVER_UNEXPECTED_RESPONSE');
  return [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

async function fetchChart(symbol: string, timeframe: ChartTimeframe, count: number, options: { fetch?: typeof fetch }): Promise<string> {
  const url = new URL('https://fchart.stock.naver.com/sise.nhn');
  url.searchParams.set('symbol', symbol);
  url.searchParams.set('timeframe', timeframe);
  url.searchParams.set('count', String(count));
  url.searchParams.set('requestType', '0');
  const response = await (options.fetch ?? fetch)(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`NAVER_HTTP_${response.status}`);
  // The feed is EUC-KR; only ASCII digits are read, so latin1 decoding is enough.
  return new TextDecoder('latin1').decode(await response.arrayBuffer());
}

export async function fetchNaverDailyBars(
  symbol: string,
  count: number,
  options: { fetch?: typeof fetch; now?: () => Date } = {},
): Promise<PriceBar[]> {
  return parseNaverDailyChart(await fetchChart(symbol, 'day', count, options), symbol, (options.now ?? (() => new Date()))());
}

export async function fetchNaverWeeklyBars(symbol: string, count: number, options: { fetch?: typeof fetch; now?: () => Date } = {}): Promise<PriceBar[]> {
  return parseNaverDailyChart(await fetchChart(symbol, 'week', count, options), symbol, (options.now ?? (() => new Date()))(), NAVER_WEEK_SOURCE);
}

/** About the last ten sessions; Naver ignores the requested count for minute data. */
export async function fetchNaverIntraday(symbol: string, options: { fetch?: typeof fetch; now?: () => Date } = {}): Promise<IntradaySession[]> {
  return parseNaverMinuteChart(await fetchChart(symbol, 'minute', 4000, options), symbol, (options.now ?? (() => new Date()))());
}
