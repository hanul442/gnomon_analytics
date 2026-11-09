// 오늘의 한 판 (G-338, 한서님 11/9 '추천대로'): one stock a session, one question — will today's close end above
// yesterday's? The committee's lean is its seat split (강세 vs 약세) on its newest report. Readers answer once before
// 15:30 KST; the evening run scores the committee and the page scores the reader's own answer from the same close.
// The stock is chosen by a rule, never by hand: among the 50 biggest Korean companies with a recent committee report,
// the one whose committee is the most split (a close call is the fun, and it reads less like a recommendation).
// Same for everyone, no money, no ranking: an educational game, not advice. Pure.

import type { PriceBar } from '../types.js';

export type HanpanLean = 'up' | 'down';
/** One seat as a dot: u 강세, n 중립, d 약세, a 기권. */
export type SeatDot = 'u' | 'n' | 'd' | 'a';

export interface HanpanPick {
  /** The session whose close is the base (the evening the pick was made). */
  baseDate: string;
  symbol: string;
  name: string;
  baseClose: number;
  lean: HanpanLean;
  bull: number;
  bear: number;
  /** Every seat in the order the committee card shows them. */
  dots: SeatDot[];
  /** The committee's first summary sentence. */
  why: string;
  /** The day the committee report was made. */
  reportDate: string;
  /** Filled by the first settled run that sees a later close. */
  endDate?: string;
  endClose?: number;
  /** The committee was right (end close strictly past the base in its direction). */
  hit?: boolean;
}

export interface HanpanState { picks: HanpanPick[] }

export interface HanpanCandidate {
  symbol: string;
  name: string;
  marketCap: number;
  reportDate: string;
  dots: SeatDot[];
  why: string;
}

/** How many of the biggest companies are eligible, how old a report may be, and how long a stock rests after a turn. */
export const HANPAN_TOP = 50, HANPAN_MAX_REPORT_DAYS = 15, HANPAN_REST = 5;
/** How many picks the site file keeps. */
export const HANPAN_KEEP = 40;

const count = (dots: readonly SeatDot[], k: SeatDot) => dots.filter((d) => d === k).length;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Up or down when the strict outcome differs from the base; a close equal to the base is right for nobody. */
export const hanpanHit = (lean: HanpanLean, base: number, end: number): boolean => (lean === 'up' ? end > base : end < base);

/**
 * The next stock: the 50 biggest by market cap that have a report from the last 15 days with more 강세 than 약세 seats or
 * the other way round (a tie has no lean), not picked in the last 5 turns. The most split wins; a tie goes to the bigger
 * company. Null when none qualifies.
 */
export function chooseHanpan(candidates: readonly HanpanCandidate[], recent: readonly string[], onDate: string): HanpanCandidate | null {
  const top = [...candidates].sort((a, b) => b.marketCap - a.marketCap).slice(0, HANPAN_TOP);
  const rest = new Set(recent.slice(-HANPAN_REST));
  const ok = top.filter((c) => !rest.has(c.symbol) && days(c.reportDate, onDate) <= HANPAN_MAX_REPORT_DAYS && days(c.reportDate, onDate) >= 0 && count(c.dots, 'u') !== count(c.dots, 'd'));
  const split = (c: HanpanCandidate) => { const u = count(c.dots, 'u'), d = count(c.dots, 'd'); return 1 - Math.abs(u - d) / (u + d); };
  return ok.sort((a, b) => split(b) - split(a) || b.marketCap - a.marketCap)[0] ?? null;
}

/** A pick from a candidate and the base session's close. */
export function makePick(c: HanpanCandidate, base: PriceBar): HanpanPick {
  const bull = count(c.dots, 'u'), bear = count(c.dots, 'd');
  return { baseDate: base.date, symbol: c.symbol, name: c.name, baseClose: base.close, lean: bull > bear ? 'up' : 'down', bull, bear, dots: [...c.dots], why: c.why, reportDate: c.reportDate };
}

/** Scores a pick from bars of its stock: the first session after the base. The base close comes from the same bars when they hold it. */
export function scorePick(p: HanpanPick, bars: readonly PriceBar[]): HanpanPick {
  if (p.endDate) return p;
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : 1));
  const end = sorted.find((b) => b.date > p.baseDate);
  if (!end) return p;
  const base = sorted.find((b) => b.date === p.baseDate)?.close ?? p.baseClose;
  return { ...p, baseClose: base, endDate: end.date, endClose: end.close, hit: hanpanHit(p.lean, base, end.close) };
}

/** 15:30 KST of the first weekday after the base: answers close then (holidays are not known here, so a holiday closes early). */
export function hanpanDeadline(baseDate: string): string {
  const d = new Date(`${baseDate}T00:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return `${d.toISOString().slice(0, 10)}T15:30:00+09:00`;
}
