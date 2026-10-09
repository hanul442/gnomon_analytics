// Weekly selection (docs/DESIGN.md §5.10, G-25, G-28): about 40 stocks a week
// get a report. The full AI committee goes to the always-covered stocks from
// tickers.json plus the largest companies by market cap (five in all). The rest
// get a dated data report without AI (G-168: no more briefs; a reader can ask for
// the committee with credits) and are picked by one composite score over stocks above a
// market-cap floor, so that big, much-traded and newsworthy stocks come before
// the week's biggest movers: size (market cap), liquidity (20-session trading
// value), major filings, the 5-session move and a trading-value surge. Pure.

import type { UniverseRow } from '../sources/naverList.js';

export const SELECTION_METHOD = 'gnm-select-v2';

export interface SelectionParams {
  size: number;
  /** Largest companies by market cap added to the core stocks for the deep committee. */
  bigCaps: number;
  /** KRW. */
  minMarketCap: number;
  weights: Weights;
}

type Weights = { size: number; liquidity: number; event: number; move: number; surge: number };

export const DEFAULT_SELECTION: SelectionParams = {
  size: 40, bigCaps: 3, minMarketCap: 5e11,
  weights: { size: 0.25, liquidity: 0.25, event: 0.25, move: 0.15, surge: 0.1 },
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
  /** 'deep' for the committee; null for a data-only report. Selections saved before v3.5.0 may say 'brief'. */
  tier: 'deep' | 'brief' | null;
  /** 0–1 composite; null for stocks picked regardless (core and the largest by market cap). */
  score: number | null;
  parts: Weights | null;
  ret5: number | null;
  surge: number | null;
  reasons: string[];
}

export interface Selection {
  method: string;
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

const eok = (krw: number) => (krw >= 1e12 ? `${(krw / 1e12).toFixed(1).replace(/\.0$/, '')}조` : `${Math.round(krw / 1e8).toLocaleString('ko-KR')}억`);

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
  const caps = scored.map((x) => x.c.row.marketCap ?? 0), liqs = scored.map((x) => x.s.liq), moves = scored.map((x) => Math.abs(x.s.ret5 ?? 0)), surges = scored.map((x) => x.s.surge ?? 0);
  const w = params.weights;
  const ranked = scored.map(({ c, s }) => {
    const parts: Weights = { size: percentile(caps, c.row.marketCap ?? 0), liquidity: percentile(liqs, s.liq), event: s.ev.score, move: percentile(moves, Math.abs(s.ret5 ?? 0)), surge: percentile(surges, s.surge ?? 0) };
    const score = w.size * parts.size + w.liquidity * parts.liquidity + w.event * parts.event + w.move * parts.move + w.surge * parts.surge;
    const reasons: string[] = [];
    if (parts.size >= 0.9 && c.row.marketCap) reasons.push(`시가총액 ${eok(c.row.marketCap)}원`);
    if (parts.liquidity >= 0.9) reasons.push(`20일 평균 거래대금 ${eok(s.liq)}원`);
    for (const h of s.ev.hits) reasons.push(`공시: ${h}`);
    if (s.ret5 !== null && Math.abs(s.ret5) >= 0.08) reasons.push(`5거래일 ${s.ret5 > 0 ? '+' : ''}${(s.ret5 * 100).toFixed(1)}%`);
    if (s.surge !== null && s.surge >= 1.8) reasons.push(`거래대금 평소의 ${s.surge.toFixed(1)}배`);
    if (!reasons.length) reasons.push('종합 점수 상위');
    return { cap: c.row.marketCap ?? 0, pick: { symbol: c.row.symbol, name: c.row.name, market: c.row.market, core: false, tier: null, score, parts, ret5: s.ret5, surge: s.surge, reasons } as Pick };
  }).sort((a, b) => b.pick.score! - a.pick.score! || (a.pick.symbol < b.pick.symbol ? -1 : 1));
  const core: Pick[] = input.core.map((c) => ({ ...c, core: true, tier: 'deep', score: null, parts: null, ret5: null, surge: null, reasons: ['매주 리포트하는 대표 종목'] }));
  // The largest companies join the core for the full committee, whatever their score.
  const big = [...ranked].sort((a, b) => b.cap - a.cap).slice(0, params.bigCaps).map((r) => ({ ...r.pick, tier: 'deep' as const, score: null, reasons: [`시가총액 상위 (${eok(r.cap)}원)`] }));
  const bigSet = new Set(big.map((p) => p.symbol));
  const rest = ranked.filter((r) => !bigSet.has(r.pick.symbol)).map((r) => r.pick);
  const picks = [...core, ...big, ...rest].slice(0, Math.max(params.size, core.length + big.length));
  return {
    method: SELECTION_METHOD, date: input.date, generatedAt: input.generatedAt.toISOString(), params,
    universe: input.universe, eligible: input.eligibleCount, scored: scored.length, picks,
  };
}

/**
 * Which eligible stocks are worth fetching bars for: the largest, the most
 * traded today, the biggest movers today, and anything with a major filing.
 * Keeps the run short.
 */
export function shortlist(rows: readonly UniverseRow[], filingsBySymbol: ReadonlyMap<string, readonly string[]>, params: SelectionParams = DEFAULT_SELECTION, limit = 220): UniverseRow[] {
  const ok = rows.filter((r) => eligible(r, params));
  const byCap = [...ok].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)).slice(0, 80);
  const byValue = [...ok].sort((a, b) => (b.tradingValue ?? 0) - (a.tradingValue ?? 0)).slice(0, 140);
  const byMove = [...ok].sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0)).slice(0, 50);
  const byEvent = ok.filter((r) => eventScore(filingsBySymbol.get(r.symbol) ?? []).score > 0);
  const seen = new Set<string>();
  const out: UniverseRow[] = [];
  for (const r of [...byCap, ...byValue, ...byMove, ...byEvent]) if (!seen.has(r.symbol)) { seen.add(r.symbol); out.push(r); }
  return out.slice(0, limit);
}
