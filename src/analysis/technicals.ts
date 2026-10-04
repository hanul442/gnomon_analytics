// Technical signal summary (docs/DESIGN.md §4.2). Pure functions.
//
// Two groups vote BULLISH / NEUTRAL / BEARISH:
//   - moving averages: close above/below SMA and EMA of 5, 10, 20, 60, 120 days
//   - oscillators: RSI(14), Stochastic(14,3,3), MACD(12,26,9), CCI(20),
//     Momentum(10), Williams %R(14)
// Group score = (bullish − bearish) / voters; summary = mean of group scores.
// An indicator without enough history abstains. With fewer than half of all
// indicators voting, the summary is "판단 보류". The score is the strength of
// the technical signal, not a probability of the price going up.

export type Vote = 'BULLISH' | 'NEUTRAL' | 'BEARISH';
export type SignalLevel =
  | 'STRONG_BEARISH' | 'BEARISH' | 'SLIGHTLY_BEARISH' | 'NEUTRAL'
  | 'SLIGHTLY_BULLISH' | 'BULLISH' | 'STRONG_BULLISH';

export interface OhlcBar { date: string; high: number; low: number; close: number }

export interface IndicatorVote {
  key: string;
  label: string;
  group: 'MA' | 'OSC';
  /** Null when there is not enough history: the indicator abstains. */
  value: number | null;
  vote: Vote | null;
  rule: string;
}

export interface TechnicalSummary {
  sessionDate: string;
  /** −1 (all bearish) … +1 (all bullish); null when withheld. */
  score: number | null;
  level: SignalLevel | null;
  label: string;
  withheld: boolean;
  maScore: number | null;
  oscScore: number | null;
  votes: IndicatorVote[];
  counts: { bullish: number; neutral: number; bearish: number; abstained: number };
}

export const LEVEL_LABEL: Record<SignalLevel, string> = {
  STRONG_BEARISH: '강한 약세', BEARISH: '약세', SLIGHTLY_BEARISH: '약간 약세', NEUTRAL: '중립',
  SLIGHTLY_BULLISH: '약간 강세', BULLISH: '강세', STRONG_BULLISH: '강한 강세',
};

/** Score thresholds for the 7 levels (upper bounds, exclusive except the last). */
export function levelOf(score: number): SignalLevel {
  if (score <= -0.6) return 'STRONG_BEARISH';
  if (score <= -0.3) return 'BEARISH';
  if (score <= -0.1) return 'SLIGHTLY_BEARISH';
  if (score < 0.1) return 'NEUTRAL';
  if (score < 0.3) return 'SLIGHTLY_BULLISH';
  if (score < 0.6) return 'BULLISH';
  return 'STRONG_BULLISH';
}

// ---- indicator series (index-aligned with input; null until defined) ----

export function sma(values: readonly number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i]!;
    if (i >= period) sum -= values[i - period]!;
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

/** EMA seeded with the SMA of the first `period` values. */
export function ema(values: readonly number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i += 1) {
    if (i < period - 1) { out.push(null); continue; }
    if (prev === null) {
      prev = values.slice(0, period).reduce((s, v) => s + v, 0) / period;
    } else {
      prev = values[i]! * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(closes: readonly number[], period = 14): (number | null)[] {
  const out: (number | null)[] = closes.map(() => null);
  if (closes.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i += 1) {
    const d = closes[i]! - closes[i - 1]!;
    if (d > 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  const value = () => (loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss));
  out[period] = value();
  for (let i = period + 1; i < closes.length; i += 1) {
    const d = closes[i]! - closes[i - 1]!;
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = value();
  }
  return out;
}

/** Slow stochastic: %K = SMA(raw %K, smoothK), %D = SMA(%K, d). */
export function stochastic(bars: readonly OhlcBar[], period = 14, smoothK = 3, d = 3): { k: (number | null)[]; d: (number | null)[] } {
  const raw: (number | null)[] = bars.map((bar, i) => {
    if (i < period - 1) return null;
    const window = bars.slice(i - period + 1, i + 1);
    const hi = Math.max(...window.map((b) => b.high));
    const lo = Math.min(...window.map((b) => b.low));
    return hi === lo ? 50 : ((bar.close - lo) / (hi - lo)) * 100;
  });
  const k = smoothNullable(raw, smoothK);
  return { k, d: smoothNullable(k, d) };
}

function smoothNullable(values: readonly (number | null)[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const window = values.slice(i - period + 1, i + 1);
    if (window.some((v) => v === null)) return null;
    return (window as number[]).reduce((s, v) => s + v, 0) / period;
  });
}

export function macd(closes: readonly number[], fast = 12, slow = 26, signal = 9): { macd: (number | null)[]; signal: (number | null)[] } {
  const f = ema(closes, fast), s = ema(closes, slow);
  const line = closes.map((_, i) => (f[i] == null || s[i] == null ? null : f[i]! - s[i]!));
  const first = line.findIndex((v) => v !== null);
  const sig: (number | null)[] = closes.map(() => null);
  if (first >= 0) {
    const tail = ema(line.slice(first) as number[], signal);
    tail.forEach((v, j) => { sig[first + j] = v; });
  }
  return { macd: line, signal: sig };
}

/** CCI on typical price with mean absolute deviation. */
export function cci(bars: readonly OhlcBar[], period = 20): (number | null)[] {
  const tp = bars.map((b) => (b.high + b.low + b.close) / 3);
  return tp.map((v, i) => {
    if (i < period - 1) return null;
    const window = tp.slice(i - period + 1, i + 1);
    const mean = window.reduce((s, x) => s + x, 0) / period;
    const mad = window.reduce((s, x) => s + Math.abs(x - mean), 0) / period;
    return mad === 0 ? 0 : (v - mean) / (0.015 * mad);
  });
}

export function momentum(closes: readonly number[], period = 10): (number | null)[] {
  return closes.map((c, i) => (i < period ? null : c - closes[i - period]!));
}

export function williamsR(bars: readonly OhlcBar[], period = 14): (number | null)[] {
  return bars.map((bar, i) => {
    if (i < period - 1) return null;
    const window = bars.slice(i - period + 1, i + 1);
    const hi = Math.max(...window.map((b) => b.high));
    const lo = Math.min(...window.map((b) => b.low));
    return hi === lo ? -50 : ((hi - bar.close) / (hi - lo)) * -100;
  });
}

// ---- votes ----

const last = <T>(xs: readonly T[], back = 0): T | undefined => xs[xs.length - 1 - back];

/** +1 rising, −1 falling, 0 flat (equal), null without two values. */
function slope(series: readonly (number | null)[]): 1 | 0 | -1 | null {
  const a = last(series), b = last(series, 1);
  if (a == null || b == null) return null;
  return a > b ? 1 : a < b ? -1 : 0;
}

/** Compares with a relative tolerance so float noise does not vote. */
function cmp(a: number, b: number): 1 | 0 | -1 {
  const tol = 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  return a - b > tol ? 1 : b - a > tol ? -1 : 0;
}

export function summarizeTechnicals(input: readonly OhlcBar[]): TechnicalSummary {
  const bars = [...input].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const closes = bars.map((b) => b.close);
  const close = last(closes);
  const votes: IndicatorVote[] = [];

  for (const period of [5, 10, 20, 60, 120]) {
    for (const [kind, series] of [['SMA', sma(closes, period)], ['EMA', ema(closes, period)]] as const) {
      const value = last(series) ?? null;
      votes.push({
        key: `${kind}${period}`, label: `${kind === 'SMA' ? '단순' : '지수'} 이동평균 ${period}일`, group: 'MA', value,
        vote: value === null || close === undefined ? null : close > value ? 'BULLISH' : close < value ? 'BEARISH' : 'NEUTRAL',
        rule: '종가가 위면 강세, 아래면 약세',
      });
    }
  }

  const r = rsi(closes, 14);
  const rv = last(r) ?? null, rSlope = slope(r);
  votes.push({ key: 'RSI14', label: 'RSI (14)', group: 'OSC', value: rv,
    vote: rv === null || rSlope === null ? null : rv < 30 && rSlope > 0 ? 'BULLISH' : rv > 70 && rSlope < 0 ? 'BEARISH' : 'NEUTRAL',
    rule: '30 아래에서 반등하면 강세, 70 위에서 꺾이면 약세' });

  const st = stochastic(bars);
  const k = last(st.k) ?? null, dd = last(st.d) ?? null;
  votes.push({ key: 'STOCH', label: '스토캐스틱 (14,3,3)', group: 'OSC', value: k,
    vote: k === null || dd === null ? null : k < 20 && dd < 20 && k > dd ? 'BULLISH' : k > 80 && dd > 80 && k < dd ? 'BEARISH' : 'NEUTRAL',
    rule: '20 아래에서 %K가 %D 위로 오면 강세, 80 위에서 아래로 가면 약세' });

  const m = macd(closes);
  const mv = last(m.macd) ?? null, sv = last(m.signal) ?? null;
  votes.push({ key: 'MACD', label: 'MACD (12,26,9)', group: 'OSC', value: mv,
    vote: mv === null || sv === null ? null : cmp(mv, sv) > 0 ? 'BULLISH' : cmp(mv, sv) < 0 ? 'BEARISH' : 'NEUTRAL',
    rule: 'MACD선이 시그널선 위면 강세, 아래면 약세' });

  const c = cci(bars);
  const cv = last(c) ?? null, cSlope = slope(c);
  votes.push({ key: 'CCI20', label: 'CCI (20)', group: 'OSC', value: cv,
    vote: cv === null || cSlope === null ? null : cv < -100 && cSlope > 0 ? 'BULLISH' : cv > 100 && cSlope < 0 ? 'BEARISH' : 'NEUTRAL',
    rule: '-100 아래에서 반등하면 강세, 100 위에서 꺾이면 약세' });

  const mo = momentum(closes, 10);
  const mov = last(mo) ?? null, moSlope = slope(mo);
  votes.push({ key: 'MOM10', label: '모멘텀 (10)', group: 'OSC', value: mov,
    vote: mov === null || moSlope === null ? null : moSlope > 0 ? 'BULLISH' : moSlope < 0 ? 'BEARISH' : 'NEUTRAL',
    rule: '모멘텀이 커지면 강세, 작아지면 약세' });

  const w = williamsR(bars);
  const wv = last(w) ?? null, wSlope = slope(w);
  votes.push({ key: 'WR14', label: '윌리엄스 %R (14)', group: 'OSC', value: wv,
    vote: wv === null || wSlope === null ? null : wv < -80 && wSlope > 0 ? 'BULLISH' : wv > -20 && wSlope < 0 ? 'BEARISH' : 'NEUTRAL',
    rule: '-80 아래에서 반등하면 강세, -20 위에서 꺾이면 약세' });

  const groupScore = (group: 'MA' | 'OSC'): number | null => {
    const voted = votes.filter((v) => v.group === group && v.vote !== null);
    if (!voted.length) return null;
    return (voted.filter((v) => v.vote === 'BULLISH').length - voted.filter((v) => v.vote === 'BEARISH').length) / voted.length;
  };
  const maScore = groupScore('MA'), oscScore = groupScore('OSC');
  const counts = {
    bullish: votes.filter((v) => v.vote === 'BULLISH').length,
    neutral: votes.filter((v) => v.vote === 'NEUTRAL').length,
    bearish: votes.filter((v) => v.vote === 'BEARISH').length,
    abstained: votes.filter((v) => v.vote === null).length,
  };
  const withheld = counts.abstained * 2 > votes.length || maScore === null || oscScore === null;
  const score = withheld ? null : (maScore! + oscScore!) / 2;
  const level = score === null ? null : levelOf(score);
  return {
    sessionDate: last(bars)?.date ?? '',
    score, level, label: level ? LEVEL_LABEL[level] : '판단 보류', withheld, maScore, oscScore, votes, counts,
  };
}

// ---- horizon momentum ----

export type Trend = 'UP' | 'FLAT' | 'DOWN';
export interface HorizonMomentum { key: 'SHORT' | 'MID' | 'LONG'; label: string; days: number; returnPct: number | null; trend: Trend | null; threshold: number }

/** Return over 5 / 20 / 120 sessions; "보합" inside ±2% / ±5% / ±10%. */
export function horizonMomentum(input: readonly { date: string; close: number }[]): HorizonMomentum[] {
  const closes = [...input].sort((a, b) => (a.date < b.date ? -1 : 1)).map((b) => b.close);
  return ([['SHORT', '단기', 5, 2], ['MID', '중기', 20, 5], ['LONG', '장기', 120, 10]] as const).map(([key, label, days, threshold]) => {
    const now = last(closes), then = closes.length > days ? closes[closes.length - 1 - days] : undefined;
    const returnPct = now === undefined || then === undefined ? null : (now / then - 1) * 100;
    const trend = returnPct === null ? null : returnPct >= threshold ? 'UP' : returnPct <= -threshold ? 'DOWN' : 'FLAT';
    return { key, label, days, returnPct, trend, threshold };
  });
}

/** One deterministic sentence explaining the summary. */
export function technicalReason(summary: TechnicalSummary): string {
  if (summary.withheld) return `가격 기록이 부족해 지표 ${summary.votes.length}개 중 ${summary.counts.abstained}개를 계산하지 못했어요. 판단을 보류해요.`;
  const ma = summary.votes.filter((v) => v.group === 'MA' && v.vote !== null);
  const above = ma.filter((v) => v.vote === 'BULLISH').length;
  const osc = summary.votes.filter((v) => v.group === 'OSC' && v.vote !== null);
  const ob = osc.filter((v) => v.vote === 'BULLISH').length, os = osc.filter((v) => v.vote === 'BEARISH').length;
  return `종가가 이동평균 ${ma.length}개 중 ${above}개보다 위에 있고, 오실레이터 ${osc.length}개는 강세 ${ob}개, 약세 ${os}개, 중립 ${osc.length - ob - os}개예요.`;
}
