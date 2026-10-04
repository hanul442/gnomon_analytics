// Naver Pay Securities mobile API (m.stock.naver.com/api/stock/{code}/...).
// Free and keyless. Values arrive as display strings ("+76,049", "49.75%",
// "8.21배", "1,345조 5,669억"); anything unreadable becomes null, never a guess.

import type { FinancePeriod, InvestorFlow, ResearchNote, StockSnapshot } from '../types.js';

export const NAVER_FLOW_SOURCE = 'naver:m-stock:trend';
export const NAVER_SNAPSHOT_SOURCE = 'naver:m-stock:integration';
export const NAVER_FINANCE_SOURCE = 'naver:m-stock:finance';
export const NAVER_RESEARCH_SOURCE = 'naver:m-stock:research';
const BASE = 'https://m.stock.naver.com/api';
// Identify ourselves honestly; the API answers non-browser clients.
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; GnomonAnalytics/1.0; +https://hanul442.github.io/gnomon_analytics/)', Accept: 'application/json' };

/** "+76,049" → 76049, "49.75%" → 49.75, "8.21배" → 8.21, "-"/"N/A" → null. */
export function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.replace(/[,\s%배원]/g, '');
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

/** "1,345조 5,669억" → 1.3455669e15 (KRW). */
export function koreanAmount(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(?:([\d,]+)조)?\s*(?:([\d,]+)억)?\s*(?:([\d,]+)만)?$/.exec(value.trim());
  if (!match || !(match[1] || match[2] || match[3])) return num(value);
  const part = (s: string | undefined) => (s ? Number(s.replace(/,/g, '')) : 0);
  return part(match[1]) * 1e12 + part(match[2]) * 1e8 + part(match[3]) * 1e4;
}

const ymd = (value: unknown): string | null => {
  const m = typeof value === 'string' ? /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value) : null;
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});

/** /trend: the last ~60 trading days of investor net buying, newest first. */
export function parseInvestorFlows(payload: unknown, symbol: string, retrievedAt: Date): InvestorFlow[] {
  if (!Array.isArray(payload)) throw new Error('NAVER_FLOW_UNEXPECTED_RESPONSE');
  const out: InvestorFlow[] = [];
  for (const raw of payload) {
    const row = record(raw);
    const date = ymd(row.bizdate);
    if (!date) continue;
    out.push({
      symbol, date,
      foreignNet: num(row.foreignerPureBuyQuant),
      institutionNet: num(row.organPureBuyQuant),
      individualNet: num(row.individualPureBuyQuant),
      foreignHoldRatio: num(row.foreignerHoldRatio),
      close: num(row.closePrice),
      volume: num(row.accumulatedTradingVolume),
      source: NAVER_FLOW_SOURCE, retrievedAt: retrievedAt.toISOString(),
    });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** /integration: valuation figures and the securities-firm consensus. */
export function parseSnapshot(payload: unknown, symbol: string, date: string, retrievedAt: Date): StockSnapshot {
  const body = record(payload);
  if (!Array.isArray(body.totalInfos)) throw new Error('NAVER_SNAPSHOT_UNEXPECTED_RESPONSE');
  const info = new Map<string, unknown>(body.totalInfos.map((raw) => { const r = record(raw); return [String(r.code), r.value]; }));
  const consensus = record(body.consensusInfo);
  const consensusDate = ymd(consensus.createDate);
  return {
    symbol, date,
    per: num(info.get('per')), eps: num(info.get('eps')),
    estimatedPer: num(info.get('cnsPer')), estimatedEps: num(info.get('cnsEps')),
    pbr: num(info.get('pbr')), bps: num(info.get('bps')),
    dividendYield: num(info.get('dividendYieldRatio')),
    marketCap: koreanAmount(info.get('marketValue')),
    high52w: num(info.get('highPriceOf52Weeks')), low52w: num(info.get('lowPriceOf52Weeks')),
    consensus: consensusDate
      ? { date: consensusDate, targetPriceMean: num(consensus.priceTargetMean), recommendationMean: num(consensus.recommMean) }
      : null,
    source: NAVER_SNAPSHOT_SOURCE, retrievedAt: retrievedAt.toISOString(),
  };
}

/** /integration researches: report listings (title, firm, date). */
export function parseResearch(payload: unknown, symbol: string, retrievedAt: Date): ResearchNote[] {
  const rows = record(payload).researches;
  if (!Array.isArray(rows)) return [];
  const out: ResearchNote[] = [];
  for (const raw of rows) {
    const r = record(raw);
    const date = ymd(r.wdt);
    if (r.id == null || !date || typeof r.tit !== 'string') continue;
    out.push({ id: String(r.id), symbol, broker: String(r.bnm ?? ''), title: r.tit.trim(), date, source: NAVER_RESEARCH_SOURCE, retrievedAt: retrievedAt.toISOString() });
  }
  return out;
}

/** /finance/quarter and /finance/annual: one record per period column. */
export function parseFinance(payload: unknown, symbol: string, periodType: FinancePeriod['periodType'], retrievedAt: Date): FinancePeriod[] {
  const info = record(record(payload).financeInfo);
  if (!Array.isArray(info.trTitleList) || !Array.isArray(info.rowList)) throw new Error('NAVER_FINANCE_UNEXPECTED_RESPONSE');
  return info.trTitleList.flatMap((rawCol) => {
    const col = record(rawCol);
    const period = typeof col.key === 'string' && /^\d{6}$/.test(col.key) ? col.key : null;
    if (!period) return [];
    const metrics: Record<string, number | null> = {};
    for (const rawRow of info.rowList as unknown[]) {
      const row = record(rawRow);
      if (typeof row.title !== 'string') continue;
      metrics[row.title] = num(record(record(row.columns)[period]).value);
    }
    return [{ symbol, periodType, period, isEstimate: col.isConsensus === 'Y', metrics, source: NAVER_FINANCE_SOURCE, retrievedAt: retrievedAt.toISOString() }];
  });
}

export async function getJson(path: string, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(`${BASE}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`NAVER_STOCK_HTTP_${response.status}`);
  return response.json();
}

export interface NaverStockData {
  flows: InvestorFlow[];
  snapshot: StockSnapshot;
  research: ResearchNote[];
  finance: FinancePeriod[];
}

/** Everything this module reads for one stock. `date` is the KST collection date. */
export async function fetchNaverStockData(symbol: string, date: string, options: { fetch?: typeof fetch; now?: () => Date } = {}): Promise<NaverStockData> {
  const fetcher = options.fetch ?? fetch;
  const now = (options.now ?? (() => new Date()))();
  const [trend, integration, quarter, annual] = await Promise.all([
    getJson(`/stock/${symbol}/trend?pageSize=60`, fetcher),
    getJson(`/stock/${symbol}/integration`, fetcher),
    getJson(`/stock/${symbol}/finance/quarter`, fetcher),
    getJson(`/stock/${symbol}/finance/annual`, fetcher),
  ]);
  return {
    flows: parseInvestorFlows(trend, symbol, now),
    snapshot: parseSnapshot(integration, symbol, date, now),
    research: parseResearch(integration, symbol, now),
    finance: [...parseFinance(quarter, symbol, 'QUARTER', now), ...parseFinance(annual, symbol, 'ANNUAL', now)],
  };
}
