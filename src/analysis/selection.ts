// Weekly selection (docs/DESIGN.md §5.10, G-25): about 35 stocks a week get a
// report. The always-covered stocks from tickers.json come first; the rest are
// picked by one composite score over stocks above a market-cap floor:
// liquidity (20-session trading value), the size of the 5-session move, a
// trading-value surge against the prior 60 sessions, and major filings.
// The top few get the deep AI committee, the rest a brief one. Pure.

import type { UniverseRow } from '../sources/naverList.js';

export const SELECTION_METHOD = 'gnm-select-v1';

export interface SelectionParams {
  size: number;
  /** Picks (core included) that get the deep committee. */
  deep: number;
  /** KRW. */
  minMarketCap: number;
  weights: { liquidity: number; move: number; surge: number; event: number };
}

export const DEFAULT_SELECTION: SelectionParams = {
  size: 35, deep: 10, minMarketCap: 5e11,
  weights: { liquidity: 0.35, move: 0.25, surge: 0.2, event: 0.2 },
};

/** Common shares only: preferred shares end in 5/7/9/K, SPACs are excluded. */
export function eligible(row: UniverseRow, params: SelectionParams = DEFAULT_SELECTION): boolean {
  return row.kind === 'stock' && /0$/.test(row.symbol) && !/스팩/.test(row.name) && (row.marketCap ?? 0) >= params.minMarketCap;
}

const EARNINGS = /영업\(잠정\)실적|잠정실적|매출액또는손익구조/;
const MAJOR = /유상증자|무상증자|합병|분할|자기주식|최대주주변경|공급계약|주요사항보고서|조회공시|감자|전환사채|소송/;

/** 1 for earnings, 0.6 for another major filing, 0 otherwise; plus the titles that counted. */
export function eventScore(titles: readonly string[]): { score: number; hits: string[] } {
  const hits = titles.filter((t) => EARNINGS.test(t) || MAJOR.test(t));
  const score = titles.some((t) => EARNINGS.test(t)) ? 1 : hits.length ? 0.6 : 0;
  return { score, hits: [...new Set(hits.map((h) => h.replace(/^\[[^\]]*\]/, '').trim()))].slice(0, 3) };
}

export interface CandidateInput {
  row: UniverseRow;
  /** Recent daily bars, oldest first (about 70). */
  bars: readonly { date: string; close: number; volume: number }[];
  /** Filing titles from the selection window. */
  filings: readonly string[];
}

export interface Pick {
  symbol: string;
  name: string;
  market: 'KOSPI' | 'KOSDAQ';
  core: boolean;
  tier: 'deep' | 'brief';
  /** 0–1 composite; null for core stocks picked regardless. */
  score: number | null;
  parts: { liquidity: number; move: number; surge: number; event: number } | null;
  ret5: number | null;
  surge: number | null;
  reasons: string[];
}

export interface Selection {
  method: typeof SELECTION_METHOD;
  /** Session the selection is based on. */
  date: string;
  generatedAt: string;
  params: SelectionParams;
  universe: number;
  eligible: number;
  scored: number;
  picks: Pick[];
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** Share of values strictly below v, so the top value gets close to 1. */
function percentile(values: readonly number[], v: number): number {
  if (values.length < 2) return 1;
  return values.filter((x) => x < v).length / (values.length - 1);
}

function stats(c: CandidateInput) {
  const b = c.bars;
  const tv = b.map((x) => x.close * x.volume);
  const liq = b.length >= 5 ? mean(tv.slice(-20)) : (c.row.tradingValue ?? 0);
  const ret5 = b.length >= 6 ? b.at(-1)!.close / b.at(-6)!.close - 1 : null;
  const prior = tv.slice(-65, -5);
  const surge = prior.length >= 20 && mean(prior) > 0 ? mean(tv.slice(-5)) / mean(prior) : null;
  return { liq, ret5, surge, ev: eventScore(c.filings) };
}

const eok = (krw: number) => `${Math.round(krw / 1e8).toLocaleString('ko-KR')}억`;

export function selectWeekly(input: {
  date: string;
  generatedAt: Date;
  universe: number;
  core: readonly { symbol: string; name: string; market: 'KOSPI' | 'KOSDAQ' }[];
  candidates: readonly CandidateInput[];
  eligibleCount: number;
  params?: SelectionParams;
}): Selection {
  const params = input.params ?? DEFAULT_SELECTION;
  const coreSet = new Set(input.core.map((c) => c.symbol));
  const scored = input.candidates.filter((c) => !coreSet.has(c.row.symbol)).map((c) => ({ c, s: stats(c) }));
  const liqs = scored.map((x) => x.s.liq), moves = scored.map((x) => Math.abs(x.s.ret5 ?? 0)), surges = scored.map((x) => x.s.surge ?? 0);
  const w = params.weights;
  const ranked = scored.map(({ c, s }) => {
    const parts = { liquidity: percentile(liqs, s.liq), move: percentile(moves, Math.abs(s.ret5 ?? 0)), surge: percentile(surges, s.surge ?? 0), event: s.ev.score };
    const score = w.liquidity * parts.liquidity + w.move * parts.move + w.surge * parts.surge + w.event * parts.event;
    const reasons: string[] = [];
    if (parts.liquidity >= 0.9) reasons.push(`20일 평균 거래대금 ${eok(s.liq)}원`);
    if (s.ret5 !== null && Math.abs(s.ret5) >= 0.08) reasons.push(`5거래일 ${s.ret5 > 0 ? '+' : ''}${(s.ret5 * 100).toFixed(1)}%`);
    if (s.surge !== null && s.surge >= 1.8) reasons.push(`거래대금 평소의 ${s.surge.toFixed(1)}배`);
    for (const h of s.ev.hits) reasons.push(`공시: ${h}`);
    if (!reasons.length) reasons.push('종합 점수 상위');
    return { pick: { symbol: c.row.symbol, name: c.row.name, market: c.row.market, core: false, tier: 'brief', score, parts, ret5: s.ret5, surge: s.surge, reasons } as Pick };
  }).sort((a, b) => b.pick.score! - a.pick.score! || (a.pick.symbol < b.pick.symbol ? -1 : 1));
  const core: Pick[] = input.core.map((c) => ({ ...c, core: true, tier: 'deep', score: null, parts: null, ret5: null, surge: null, reasons: ['매일 리포트하는 대표 종목'] }));
  const picks = [...core, ...ranked.slice(0, Math.max(0, params.size - core.length)).map((r) => r.pick)];
  picks.forEach((p, i) => { p.tier = i < params.deep ? 'deep' : 'brief'; });
  return {
    method: SELECTION_METHOD, date: input.date, generatedAt: input.generatedAt.toISOString(), params,
    universe: input.universe, eligible: input.eligibleCount, scored: scored.length, picks,
  };
}

/**
 * Which eligible stocks are worth fetching bars for: the most traded today,
 * the biggest movers today, and anything with a major filing. Keeps the run short.
 */
export function shortlist(rows: readonly UniverseRow[], filingsBySymbol: ReadonlyMap<string, readonly string[]>, params: SelectionParams = DEFAULT_SELECTION, limit = 220): UniverseRow[] {
  const ok = rows.filter((r) => eligible(r, params));
  const byValue = [...ok].sort((a, b) => (b.tradingValue ?? 0) - (a.tradingValue ?? 0)).slice(0, 140);
  const byMove = [...ok].sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0)).slice(0, 50);
  const byEvent = ok.filter((r) => eventScore(filingsBySymbol.get(r.symbol) ?? []).score > 0);
  const seen = new Set<string>();
  const out: UniverseRow[] = [];
  for (const r of [...byValue, ...byMove, ...byEvent]) if (!seen.has(r.symbol)) { seen.add(r.symbol); out.push(r); }
  return out.slice(0, limit);
}
