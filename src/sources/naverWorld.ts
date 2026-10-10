// 3.0 (G-143): US stocks from Naver's world-stock API, the same provider as Korean prices.
//   daily bars  https://api.stock.naver.com/chart/foreign/item/<reuters>/day?startDateTime=&endDateTime=
//   live quote  https://polling.finance.naver.com/api/realtime/worldstock/stock/<reuters>
// Reuters codes carry the exchange: AAPL.O (Nasdaq), KO.N (NYSE), SPY.K (NYSE Arca).

import type { PriceBar, StockSnapshot } from '../types.js';
import type { Quote } from './naverQuote.js';

export const NAVER_WORLD_SOURCE = 'naver:world:day';

/** A Reuters code: the ticker, with a dot and an exchange letter for most (AAPL.O, DELL.K); some NYSE/AMEX ones have none (TSM, SPY). Never KRW- (coins). */
export const US_CODE = /^(?!KRW-)[A-Z][A-Z0-9-]{0,9}(\.[A-Z])?$/;

const num = (v: unknown) => { const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : null; };

/** [{localDate:'20260901', openPrice, highPrice, lowPrice, closePrice, accumulatedTradingVolume}] → bars, oldest first. */
export function parseWorldBars(body: unknown, symbol: string, retrievedAt: Date): PriceBar[] {
  if (!Array.isArray(body)) throw new Error('NAVER_WORLD_UNEXPECTED');
  const out: PriceBar[] = [];
  for (const r of body as Record<string, unknown>[]) {
    const d = String(r.localDate ?? '');
    const o = num(r.openPrice), h = num(r.highPrice), l = num(r.lowPrice), c = num(r.closePrice), v = num(r.accumulatedTradingVolume) ?? 0;
    if (!/^\d{8}$/.test(d) || o == null || h == null || l == null || c == null || c <= 0) continue;
    out.push({ symbol, date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, open: o, high: h, low: l, close: c, volume: v, source: NAVER_WORLD_SOURCE, retrievedAt: retrievedAt.toISOString() });
  }
  return [...new Map(out.map((b) => [b.date, b])).values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchWorldBars(code: string, days: number, options: { now?: () => Date; fetch?: typeof fetch } = {}): Promise<PriceBar[]> {
  if (!US_CODE.test(code)) throw new Error('BAD_US_CODE');
  const now = (options.now ?? (() => new Date()))();
  const from = new Date(now.getTime() - Math.ceil(days * 1.5) * 86_400_000);
  const stamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '') + '0000';
  const url = `https://api.stock.naver.com/chart/foreign/item/${code}/day?startDateTime=${stamp(from)}&endDateTime=${stamp(new Date(now.getTime() + 86_400_000))}`;
  const r = await (options.fetch ?? fetch)(url, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } });
  if (!r.ok) throw new Error(`NAVER_WORLD_HTTP_${r.status}`);
  return parseWorldBars(await r.json(), code, now).slice(-days);
}

export function worldQuoteUrl(code: string): string {
  return `https://polling.finance.naver.com/api/realtime/worldstock/stock/${code}`;
}

/** The polling answer → the same Quote the Korean feed gives; pre/after-market price when that session is open. */
export function parseWorldQuote(body: unknown): Quote | null {
  const d = (body as { datas?: Record<string, unknown>[] })?.datas?.[0];
  if (!d) return null;
  const code = String(d.reutersCode ?? '');
  const close = num(d.closePrice), chg = num(d.compareToPreviousClosePrice), pct = num(d.fluctuationsRatio);
  if (!US_CODE.test(code) || close == null) return null;
  const over = d.overMarketPriceInfo as Record<string, unknown> | undefined;
  const overOpen = over && over.overMarketStatus === 'OPEN' && num(over.overPrice) != null;
  const session: Quote['session'] = d.marketStatus === 'OPEN' ? 'regular' : overOpen ? (over!.tradingSessionType === 'PRE_MARKET' ? 'pre' : 'after') : 'closed';
  const price = session === 'pre' || session === 'after' ? num(over!.overPrice)! : close;
  const at = String((session === 'pre' || session === 'after' ? over!.localTradedAt : d.localTradedAt) ?? '');
  return {
    symbol: code, price,
    change: session === 'pre' || session === 'after' ? num(over!.compareToPreviousClosePrice) ?? 0 : chg ?? 0,
    changePct: session === 'pre' || session === 'after' ? num(over!.fluctuationsRatio) ?? 0 : pct ?? 0,
    open: session !== 'closed',
    at: Number.isNaN(Date.parse(at)) ? null : new Date(at).toISOString(),
    session,
  };
}

export interface UsListing { code: string; ticker: string; name: string; nameEng: string; exchange: 'NASDAQ' | 'NYSE' | 'AMEX'; kind: 'stock' | 'etf'; industry: string; marketCapUsd: number | null; close: number | null; changePct: number | null; valueUsd: number | null }

/** "194억 USD" / "2.05억 USD" / "4조 9,134억 USD" → dollars. */
export function usdHangeul(v: unknown): number | null {
  const s = String(v ?? '').replace(/,/g, '').replace(/\s*USD\s*$/, '').trim();
  if (!s) return null;
  const jo = /(\d+(?:\.\d+)?)조/.exec(s), eok = /(\d+(?:\.\d+)?)억/.exec(s), man = /(\d+(?:\.\d+)?)만/.exec(s);
  if (!jo && !eok && !man) { const n = Number(s); return Number.isFinite(n) ? n : null; }
  return Math.round((jo ? Number(jo[1]) * 1e12 : 0) + (eok ? Number(eok[1]) * 1e8 : 0) + (man ? Number(man[1]) * 1e4 : 0));
}

/** One page of /stock/exchange/<EX>/marketValue. */
export function parseUsRanking(body: unknown, exchange: UsListing['exchange']): UsListing[] {
  const rows = (body as { stocks?: Record<string, unknown>[] })?.stocks;
  if (!Array.isArray(rows)) throw new Error('NAVER_WORLD_UNEXPECTED');
  return rows.flatMap((r) => {
    const code = String(r.reutersCode ?? '');
    if (!US_CODE.test(code)) return [];
    return [{
      code, ticker: String(r.symbolCode ?? code.split('.')[0]), name: String(r.stockName ?? code), nameEng: String(r.stockNameEng ?? ''), exchange,
      kind: r.stockEndType === 'etf' ? 'etf' as const : 'stock' as const, industry: String((r.industryCodeType as { industryGroupKor?: string } | undefined)?.industryGroupKor ?? ''),
      marketCapUsd: num(r.marketValueFullRaw ?? r.marketValueFull) ?? usdHangeul(r.marketValueHangeul), close: num(r.closePrice), changePct: num(r.fluctuationsRatio), valueUsd: usdHangeul(r.accumulatedTradingValue),
    }];
  });
}

/** Popular US ETFs, resolved to Naver codes through its search (the ETF ranking has no public list). */
export const US_ETFS = ['SPY', 'QQQ', 'VOO', 'IVV', 'VTI', 'SCHD', 'TQQQ', 'SOXL', 'SOXX', 'SMH', 'DIA', 'JEPI', 'JEPQ', 'GLD', 'TLT', 'ARKK', 'XLK', 'IWM', 'VUG', 'TSLL'] as const;

export function parseUsSearch(body: unknown, ticker: string): UsListing | null {
  const items = (body as { items?: Record<string, string>[] })?.items ?? [];
  const hit = items.find((x) => x.code === ticker && x.nationCode === 'USA');
  if (!hit || !US_CODE.test(hit.reutersCode ?? '')) return null;
  const ex = hit.typeCode === 'NASDAQ' ? 'NASDAQ' : hit.typeCode === 'NYSE' ? 'NYSE' : 'AMEX';
  return { code: hit.reutersCode!, ticker, name: hit.name ?? ticker, nameEng: hit.name ?? '', exchange: ex, kind: /\/etf\//.test(hit.url ?? '') ? 'etf' : 'stock', industry: 'ETF', marketCapUsd: null, close: null, changePct: null, valueUsd: null };
}

/** The US universe: top stocks by market value on each exchange, plus the popular ETFs. */
/**
 * G-188: every listed US stock, by market value, for search and on-demand pages (names only; no bars). Walks the
 * same ranking pages until they run out (or `maxPages` per exchange); a page that fails ends that exchange.
 */
export async function fetchUsDirectory(options: { fetch?: typeof fetch; maxPages?: number } = {}): Promise<UsListing[]> {
  const f = options.fetch ?? fetch, max = options.maxPages ?? 120, out = new Map<string, UsListing>();
  const get = (url: string) => f(url, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  for (const ex of ['NASDAQ', 'NYSE', 'AMEX'] as const) {
    for (let page = 1; page <= max; page += 1) {
      const body = await get(`https://api.stock.naver.com/stock/exchange/${ex}/marketValue?page=${page}&pageSize=50`);
      let rows: UsListing[] = []; try { rows = body ? parseUsRanking(body, ex) : []; } catch { rows = []; }
      if (!rows.length) break;
      for (const l of rows) if (!out.has(l.code)) out.set(l.code, l);
    }
  }
  return [...out.values()];
}

/** The computed set: the top of each exchange by market value plus popular ETFs. With `directory`, the top is taken from it (no second walk). */
export async function fetchUsUniverse(options: { fetch?: typeof fetch; perExchange?: Partial<Record<UsListing['exchange'], number>>; directory?: readonly UsListing[] } = {}): Promise<UsListing[]> {
  const f = options.fetch ?? fetch, want = { NASDAQ: 300, NYSE: 300, AMEX: 40, ...options.perExchange };
  const get = (url: string) => f(url, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const out = new Map<string, UsListing>();
  if (options.directory?.length) for (const ex of ['NASDAQ', 'NYSE', 'AMEX'] as const) for (const l of options.directory.filter((x) => x.exchange === ex).slice(0, want[ex])) out.set(l.code, l);
  else for (const ex of ['NASDAQ', 'NYSE', 'AMEX'] as const) {
    for (let page = 1; (page - 1) * 50 < want[ex]; page += 1) {
      const body = await get(`https://api.stock.naver.com/stock/exchange/${ex}/marketValue?page=${page}&pageSize=50`);
      if (!body) break;
      for (const l of parseUsRanking(body, ex).slice(0, want[ex] - (page - 1) * 50)) out.set(l.code, l);
    }
  }
  for (const t of US_ETFS) {
    const hit = parseUsSearch(await get(`https://ac.stock.naver.com/ac?q=${t}&target=stock`), t);
    if (hit && !out.has(hit.code)) out.set(hit.code, { ...hit, kind: 'etf' });
  }
  return [...out.values()];
}

/** Valuation figures Naver shows for a US stock (PER, EPS, PBR, 시가총액, 52주 범위, 배당수익률). */
export const NAVER_WORLD_BASIC_SOURCE = 'naver:world:basic';
export function worldBasicUrl(code: string): string {
  return `https://api.stock.naver.com/stock/${code}/basic`;
}
const money = (v: unknown): number | null => { const s = String(v ?? '').replace(/[$,\s]/g, '').replace(/(배|%|USD|원)$/g, ''); const n = Number(s); return s && Number.isFinite(n) ? n : null; };
/**
 * /stock/<code>/basic → StockSnapshot. The answer carries `stockItemTotalInfos: [{code, key, value}]`; rows are
 * matched by their code first and their Korean label second, so a renamed code still reads. Nothing Naver does
 * not show is invented: consensus stays null, and so does any missing figure.
 */
export function parseWorldBasic(body: unknown, code: string, retrievedAt: Date): StockSnapshot | null {
  const b = body as { stockItemTotalInfos?: unknown; stockEndType?: unknown; closePrice?: unknown } | null;
  const rows = Array.isArray(b?.stockItemTotalInfos) ? (b!.stockItemTotalInfos as { code?: unknown; key?: unknown; value?: unknown }[]) : null;
  if (!rows) return null;
  const find = (codes: readonly string[], label: RegExp) => rows.find((r) => codes.includes(String(r.code ?? ''))) ?? rows.find((r) => label.test(String(r.key ?? '')));
  const val = (codes: readonly string[], label: RegExp) => find(codes, label)?.value;
  const cap = val(['marketValue', 'marketValueFull'], /시가\s*총액/), per = money(val(['per'], /^PER$/i)), eps = money(val(['eps'], /^EPS$/i)), pbr = money(val(['pbr'], /^PBR$/i));
  const high52 = money(val(['highPriceOf52Weeks', 'high52w', 'fiftyTwoWeekHigh'], /52주.*(최고|고가)/)), low52 = money(val(['lowPriceOf52Weeks', 'low52w', 'fiftyTwoWeekLow'], /52주.*(최저|저가)/));
  const dy = money(val(['dividendYieldRatio', 'dividendYield'], /배당\s*수익률/));
  const marketCap = typeof cap === 'number' ? cap : usdHangeul(cap);
  if (per == null && eps == null && pbr == null && marketCap == null && high52 == null) return null;
  return { symbol: code, date: retrievedAt.toISOString().slice(0, 10), per, eps, estimatedPer: null, estimatedEps: null, pbr, bps: null, dividendYield: dy, marketCap, high52w: high52, low52w: low52, consensus: null, source: NAVER_WORLD_BASIC_SOURCE, retrievedAt: retrievedAt.toISOString() };
}
export async function fetchWorldBasic(code: string, options: { now?: () => Date; fetch?: typeof fetch } = {}): Promise<StockSnapshot | null> {
  const r = await (options.fetch ?? fetch)(worldBasicUrl(code), { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } });
  if (!r.ok) throw new Error(`NAVER_WORLD_HTTP_${r.status}`);
  return parseWorldBasic(await r.json(), code, (options.now ?? (() => new Date()))());
}
