// G-188: one shape for a US stock page (site/u/<code>.json), shared by the daily run and the API Worker's
// on-demand pages, so us.html draws both the same way. No Node file APIs (the Worker bundles this).
import type { PriceBar } from '../types.js';
import { usTicker, type UsListing } from '../sources/naverWorld.js';
import { quickCalc, type StockCalc } from './quickCalc.js';
import { coinCalc } from './compactCalc.js';

/** Two years of sessions on a US stock page, like the Korean pages. */
export const US_PAGE_BARS = 500;

export const cents = (v: number) => Math.round(v * 100) / 100;

/** "TICKER · Exchange[ ETF] · English name", the search and list subtitle. */
export function usDescription(l: Pick<UsListing, 'ticker' | 'exchange' | 'kind' | 'nameEng'>): string {
  return `${l.ticker} · ${l.exchange}${l.kind === 'etf' ? ' ETF' : ''} · ${l.nameEng}`;
}

export type UsPageMeta = Partial<Pick<UsListing, 'ticker' | 'name' | 'nameEng' | 'exchange' | 'kind' | 'industry' | 'marketCapUsd'>> & { cik?: number | null };

/** The page JSON and the full calc (the daily run also builds its list row from the calc). */
export function usPage(code: string, bars: readonly PriceBar[], now: Date, meta: UsPageMeta = {}): { body: Record<string, unknown>; calc: StockCalc | null } {
  const calc = quickCalc(code, bars, now);
  return {
    calc,
    body: {
      symbol: code, ticker: meta.ticker ?? usTicker(code), name: meta.name ?? null, english: meta.nameEng ?? null, market: meta.exchange ?? null, kind: meta.kind ?? null,
      industry: meta.industry ?? null, currency: 'USD', marketCapUsd: meta.marketCapUsd ?? null, cik: meta.cik ?? null,
      bars: bars.map((b) => [b.date, cents(b.open), cents(b.high), cents(b.low), cents(b.close), b.volume]), calc: calc ? coinCalc(calc) : null,
    },
  };
}
