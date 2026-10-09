// Covered stocks (docs/DESIGN.md §3.3). The list lives in tickers.json at the
// repository root so a stock is added without touching code.

import { readFile } from 'node:fs/promises';

export interface Ticker {
  /** KRX code, e.g. 005930. */
  symbol: string;
  name: string;
  /** Index the stock is compared against; UPBIT for coins (KRW-XXX symbols); a US exchange for a US stock (G-179). */
  market: 'KOSPI' | 'KOSDAQ' | 'UPBIT' | 'NASDAQ' | 'NYSE' | 'AMEX';
  /** G-179: a US stock's ticker, English name and SEC CIK (from u/<code>.json), for EDGAR and English news. */
  us?: { ticker: string; english: string; cik: number | null };
  /** ETFs and coins (G-56) are reported with the same pipeline; their prompts and sources differ. */
  kind?: 'etf' | 'coin';
  /** OpenDART corp_code (8 digits), not the stock code. */
  dartCorpCode: string;
  /** Search term for news sources. */
  newsQuery: string;
  /** Regular expressions (source text) that a relevant headline must match. */
  newsAliases: string[];
  /** A peer shown in "market relative return". */
  peer?: { symbol: string; name: string };
  /** Whether the daily AI committee runs for this stock (costs money). */
  ai: boolean;
}

const MARKET_NAME = { KOSPI: '코스피', KOSDAQ: '코스닥' } as const;
export const BTC = { symbol: 'KRW-BTC', name: '비트코인' } as const;

/** Index first, then the peer. A coin is compared against Bitcoin (Bitcoin against nothing). */
export const isUsMarket = (m: Ticker['market']): m is 'NASDAQ' | 'NYSE' | 'AMEX' => m === 'NASDAQ' || m === 'NYSE' || m === 'AMEX';
/** A US stock has no index bars here (G-179), so it compares against nothing. */
export const benchmarksFor = (t: Ticker): { symbol: string; name: string }[] =>
  t.market === 'UPBIT' ? (t.symbol === BTC.symbol ? [] : [{ ...BTC }]) : isUsMarket(t.market) ? [] : [{ symbol: t.market, name: MARKET_NAME[t.market] }, ...(t.peer ? [t.peer] : [])];

export const aliasPattern = (t: Pick<Ticker, 'newsAliases'>): RegExp => new RegExp(t.newsAliases.join('|'), 'i');

export function parseTickers(raw: unknown): Ticker[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error('tickers: a non-empty array is required');
  const seen = new Set<string>();
  return raw.map((t: Partial<Ticker>, i) => {
    const where = `tickers[${i}]`;
    if (typeof t.symbol !== 'string' || !/^[0-9A-Z]{6}$/.test(t.symbol)) throw new Error(`${where}: symbol must be a 6-character KRX code`);
    if (seen.has(t.symbol)) throw new Error(`${where}: duplicate symbol ${t.symbol}`);
    seen.add(t.symbol);
    if (typeof t.name !== 'string' || !t.name.trim()) throw new Error(`${where}: name is required`);
    if (t.market !== 'KOSPI' && t.market !== 'KOSDAQ') throw new Error(`${where}: market must be KOSPI or KOSDAQ`);
    if (typeof t.dartCorpCode !== 'string' || !/^\d{8}$/.test(t.dartCorpCode)) throw new Error(`${where}: dartCorpCode must be 8 digits`);
    if (typeof t.newsQuery !== 'string' || !t.newsQuery.trim()) throw new Error(`${where}: newsQuery is required`);
    if (!Array.isArray(t.newsAliases) || !t.newsAliases.length || t.newsAliases.some((a) => typeof a !== 'string' || !a)) throw new Error(`${where}: newsAliases must be non-empty strings`);
    aliasPattern(t as Ticker); // throws on an invalid regular expression
    if (t.peer && (typeof t.peer.symbol !== 'string' || typeof t.peer.name !== 'string')) throw new Error(`${where}: peer needs symbol and name`);
    return { symbol: t.symbol, name: t.name, market: t.market, dartCorpCode: t.dartCorpCode, newsQuery: t.newsQuery, newsAliases: [...t.newsAliases], ...(t.peer ? { peer: { symbol: t.peer.symbol, name: t.peer.name } } : {}), ai: t.ai === true };
  });
}

export async function loadTickers(path: string): Promise<Ticker[]> {
  return parseTickers(JSON.parse(await readFile(path, 'utf8')));
}
