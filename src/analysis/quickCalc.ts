// Free computation for every listed stock (docs/DESIGN.md §3.6, G-29): from
// one year of daily bars, the technical signal (16 indicators), returns over
// 5 / 20 / 120 sessions, the technical fair value and forecast ranges. No
// strategy arena (a year is too short to test strategies out of sample) and
// no AI. One deterministic line sums it up. Pure.

import { horizonMomentum, summarizeTechnicals, type SignalLevel, type Vote } from './technicals.js';
import { forecastRanges, technicalFairValue, type DailyBar } from './valuation.js';

export const QUICK_METHOD = 'gnm-quick-v1';

export interface StockCalc {
  method: typeof QUICK_METHOD;
  date: string;
  close: number;
  signal: { label: string; level: SignalLevel | null; score: number | null; bull: number; neutral: number; bear: number; abstain: number };
  /** [label, vote] per indicator; null vote = abstained. */
  votes: [string, Vote | null][];
  moves: { label: string; days: number; pct: number | null }[];
  fair: { center: number; low: number; high: number; gapPct: number; position: 'ABOVE' | 'INSIDE' | 'BELOW' } | null;
  forecasts: { days: number; p10: number; p50: number; p90: number }[];
  /** The free one-line summary. */
  line: string;
}

const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const POSITION_WORD = { ABOVE: '적정가 범위보다 위', INSIDE: '적정가 범위 안', BELOW: '적정가 범위보다 아래' } as const;

export function quickCalc(symbol: string, bars: readonly DailyBar[], now: Date): StockCalc | null {
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : 1));
  const lastBar = sorted.at(-1);
  if (!lastBar) return null;
  const t = summarizeTechnicals(sorted);
  const moves = horizonMomentum(sorted).map((h) => ({ label: h.label, days: h.days, pct: h.returnPct }));
  const fv = technicalFairValue(sorted);
  const fair = fv ? { center: fv.center, low: fv.low, high: fv.high, gapPct: fv.gapPct, position: fv.position } : null;
  const forecasts = forecastRanges(symbol, sorted, now).map((f) => ({ days: f.horizon, p10: f.p10, p50: f.p50, p90: f.p90 }));
  const signal = { label: t.label, level: t.level, score: t.score, bull: t.counts.bullish, neutral: t.counts.neutral, bear: t.counts.bearish, abstain: t.counts.abstained };
  const mid = moves.find((m) => m.days === 20);
  const parts = [
    t.withheld ? '기록이 짧아 기술 신호는 보류' : `기술 신호 ${t.label}(지표 ${t.votes.length - t.counts.abstained}개 중 강세 ${t.counts.bullish}·약세 ${t.counts.bearish})`,
    mid?.pct != null ? `20거래일 ${signed(mid.pct)}` : '',
    fair ? POSITION_WORD[fair.position] : '',
  ].filter(Boolean);
  return {
    method: QUICK_METHOD, date: lastBar.date, close: lastBar.close, signal,
    votes: t.votes.map((v) => [v.label, v.vote]), moves, fair, forecasts, line: parts.join(' · '),
  };
}

export type PulseBucket = 'STRONG_BULLISH' | 'BULLISH' | 'SLIGHTLY_BULLISH' | 'NEUTRAL' | 'SLIGHTLY_BEARISH' | 'BEARISH' | 'STRONG_BEARISH' | 'WITHHELD';

export interface MarketPulse {
  date: string;
  counted: number;
  buckets: Record<PulseBucket, number>;
  bull: number;
  neutral: number;
  bear: number;
  /** Stocks above their 20-session level, share 0–1 of those with a 20-session return. */
  up20: number | null;
}

/** The market's temperature: how many stocks' technical signals lean each way. */
export function marketPulse(calcs: readonly Pick<StockCalc, 'date' | 'signal' | 'moves'>[]): MarketPulse | null {
  if (!calcs.length) return null;
  const buckets: Record<PulseBucket, number> = { STRONG_BULLISH: 0, BULLISH: 0, SLIGHTLY_BULLISH: 0, NEUTRAL: 0, SLIGHTLY_BEARISH: 0, BEARISH: 0, STRONG_BEARISH: 0, WITHHELD: 0 };
  for (const c of calcs) buckets[c.signal.level ?? 'WITHHELD'] += 1;
  const r20 = calcs.map((c) => c.moves.find((m) => m.days === 20)?.pct).filter((v): v is number => v != null);
  const date = calcs.map((c) => c.date).sort().at(-1)!;
  return {
    date, counted: calcs.length, buckets,
    bull: buckets.STRONG_BULLISH + buckets.BULLISH + buckets.SLIGHTLY_BULLISH,
    neutral: buckets.NEUTRAL,
    bear: buckets.STRONG_BEARISH + buckets.BEARISH + buckets.SLIGHTLY_BEARISH,
    up20: r20.length ? r20.filter((v) => v > 0).length / r20.length : null,
  };
}
