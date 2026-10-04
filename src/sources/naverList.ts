// Every listed KOSPI/KOSDAQ item with its latest close, change, trading value
// and market cap, from Naver's market-cap ranking (m.stock.naver.com/api/stocks/
// marketValue/{market}). Used for search and the weekly selection; not evidence.

import { getJson, num } from './naverStock.js';

export const NAVER_LIST_SOURCE = 'naver:m-stock:marketValue';
const PAGE = 100;

export interface UniverseRow {
  symbol: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ';
  /** "stock", "etf", "etn" … as Naver labels it. */
  kind: string;
  close: number | null;
  changePct: number | null;
  /** KRW. */
  tradingValue: number | null;
  /** KRW. */
  marketCap: number | null;
  /** When the price was traded, ISO with offset. */
  tradedAt: string | null;
}

export function parseMarketList(json: unknown, market: 'KOSPI' | 'KOSDAQ'): { rows: UniverseRow[]; total: number } {
  const body = (json && typeof json === 'object' ? json : {}) as { stocks?: unknown; totalCount?: unknown };
  if (!Array.isArray(body.stocks)) throw new Error('NAVER_LIST_SHAPE');
  const rows: UniverseRow[] = [];
  for (const s of body.stocks as Record<string, unknown>[]) {
    if (typeof s.itemCode !== 'string' || typeof s.stockName !== 'string') continue;
    // Trading value arrives in millions of won, market cap in hundred millions.
    const value = num(s.accumulatedTradingValue), cap = num(s.marketValue);
    rows.push({
      symbol: s.itemCode, name: s.stockName.trim(), market, kind: typeof s.stockEndType === 'string' ? s.stockEndType : 'unknown',
      close: num(s.closePrice), changePct: num(s.fluctuationsRatio),
      tradingValue: value === null ? null : value * 1e6, marketCap: cap === null ? null : cap * 1e8,
      tradedAt: typeof s.localTradedAt === 'string' ? s.localTradedAt : null,
    });
  }
  return { rows, total: typeof body.totalCount === 'number' ? body.totalCount : rows.length };
}

export async function fetchMarketUniverse(market: 'KOSPI' | 'KOSDAQ', options: { fetch?: typeof fetch } = {}): Promise<UniverseRow[]> {
  const fetcher = options.fetch ?? fetch;
  const rows: UniverseRow[] = [];
  for (let page = 1; page <= 60; page += 1) {
    const { rows: got, total } = parseMarketList(await getJson(`/stocks/marketValue/${market}?page=${page}&pageSize=${PAGE}`, fetcher), market);
    rows.push(...got);
    if (!got.length || rows.length >= total) break;
  }
  return rows;
}
