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
  /** Volume read from daily bars (G-48). Null with fewer than 25 sessions. */
  volume?: VolumeRead | null;
  /** Close against the highest high of the last year, % (0 at a new high). */
  hi52GapPct?: number | null;
  /** Close against the lowest low of the last year, % (0 at a new low). */
  lo52GapPct?: number | null;
  /** The free one-line summary. */
  line: string;
}

export interface VolumeRead {
  /** Last session's volume ÷ the average of the 20 sessions before it. */
  ratio1: number;
  /** Average of the last 5 sessions ÷ the average of the 20 before them. */
  ratio5: number;
  /** Close against the 20-session volume-weighted average price, %. */
  vwapGapPct: number;
  /** On-balance volume change over 20 sessions, as % of those sessions' total volume (−100…100). */
  obvPct: number;
  /** ACCUM: OBV rising while the price went nowhere or down; DIST: the reverse. */
  flow: 'ACCUM' | 'DIST' | null;
  /** Last session's trading value (close × volume) ÷ the 20 sessions before it. */
  tvRatio1?: number;
  /** Chaikin accumulation/distribution over 20 sessions: Σ(close location × volume) ÷ Σvolume, −100…100.
   *  Positive when closes sit near the day's high on heavy days (buying into the close). */
  adPct?: number;
  /** The largest single-day volume of the last 10 sessions ÷ the 20 sessions before that day. */
  spike10?: number;
}

/** Volume factors (G-48): surges, VWAP position, OBV trend and its divergence from price. */
export function volumeRead(bars: readonly DailyBar[]): VolumeRead | null {
  if (bars.length < 25) return null;
  const avg = (xs: readonly DailyBar[]) => xs.reduce((s, b) => s + b.volume, 0) / xs.length;
  const n = bars.length, last = bars[n - 1]!;
  const base1 = avg(bars.slice(n - 21, n - 1)), base5 = avg(bars.slice(n - 25, n - 5)), last5 = avg(bars.slice(n - 5));
  if (!(base1 > 0) || !(base5 > 0)) return null;
  const w = bars.slice(n - 20), vol = w.reduce((s, b) => s + b.volume, 0);
  const vwap = vol > 0 ? w.reduce((s, b) => s + ((b.high + b.low + b.close) / 3) * b.volume, 0) / vol : last.close;
  let obv = 0;
  for (let i = n - 20; i < n; i += 1) { const d = bars[i]!.close - bars[i - 1]!.close; obv += d > 0 ? bars[i]!.volume : d < 0 ? -bars[i]!.volume : 0; }
  const obvPct = vol > 0 ? (obv / vol) * 100 : 0, priceChg = (last.close / bars[n - 21]!.close - 1) * 100;
  const flow = obvPct >= 20 && priceChg <= 3 ? 'ACCUM' : obvPct <= -20 && priceChg >= -3 ? 'DIST' : null;
  const value = (b: DailyBar) => b.close * b.volume;
  const baseValue = bars.slice(n - 21, n - 1).reduce((s, b) => s + value(b), 0) / 20;
  const ad = w.reduce((s, b) => s + (b.high > b.low ? ((b.close - b.low) - (b.high - b.close)) / (b.high - b.low) : 0) * b.volume, 0);
  let spike10 = 0;
  for (let i = Math.max(21, n - 10); i < n; i += 1) { const base = avg(bars.slice(i - 20, i)); if (base > 0) spike10 = Math.max(spike10, bars[i]!.volume / base); }
  return { ratio1: last.volume / base1, ratio5: last5 / base5, vwapGapPct: (last.close / vwap - 1) * 100, obvPct, flow,
    tvRatio1: baseValue > 0 ? value(last) / baseValue : 0, adPct: vol > 0 ? (ad / vol) * 100 : 0, spike10 };
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
  const volume = volumeRead(sorted);
  const year = sorted.slice(-250), hi = Math.max(...year.map((b) => b.high));
  const hi52GapPct = hi > 0 ? (lastBar.close / hi - 1) * 100 : null;
  const lo = Math.min(...year.map((b) => b.low)), lo52GapPct = lo > 0 ? (lastBar.close / lo - 1) * 100 : null;
  const signal = { label: t.label, level: t.level, score: t.score, bull: t.counts.bullish, neutral: t.counts.neutral, bear: t.counts.bearish, abstain: t.counts.abstained };
  const mid = moves.find((m) => m.days === 20);
  const parts = [
    t.withheld ? '기록이 짧아 기술 신호는 보류' : `기술 신호 ${t.label}(지표 ${t.votes.length - t.counts.abstained}개 중 강세 ${t.counts.bullish}·약세 ${t.counts.bearish})`,
    mid?.pct != null ? `20거래일 ${signed(mid.pct)}` : '',
    fair ? POSITION_WORD[fair.position] : '',
  ].filter(Boolean);
  return {
    method: QUICK_METHOD, date: lastBar.date, close: lastBar.close, signal,
    votes: t.votes.map((v) => [v.label, v.vote]), moves, fair, forecasts, volume, hi52GapPct, lo52GapPct, line: parts.join(' · '),
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
