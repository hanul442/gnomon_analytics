// Price structure and participation (docs/DESIGN.md §5.1): swing points,
// structure breaks, Fibonacci retracement of the last leg, support and
// resistance, Bollinger bands and ATR, and a footprint of large-participant
// activity. Logic re-written from BLACK ORACLE BOT (marketStructure,
// waveTheory, largeParticipantFootprint, participantFlowFootprint). Pure.

export interface Bar { date: string; open: number; high: number; low: number; close: number; volume: number }

export interface Swing { date: string; price: number; type: 'HIGH' | 'LOW'; /** Date of the bar that confirmed it. */ confirmedOn: string }

export interface StructureBreak {
  /** BOS: continues the current bias. CHOCH: flips it (change of character). */
  type: 'BOS' | 'CHOCH';
  direction: 'BULLISH' | 'BEARISH';
  date: string;
  close: number;
  brokenSwing: Swing;
}

export interface PriceLevel { price: number; kind: 'SUPPORT' | 'RESISTANCE'; touches: number; lastDate: string }

export interface StructureSnapshot {
  sessionDate: string;
  close: number;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  swings: Swing[];
  breaks: StructureBreak[];
  /** Where the close sits in the latest swing range: lower third DISCOUNT, upper third PREMIUM. */
  zone: { rangeLow: number; rangeHigh: number; percentile: number; label: 'DISCOUNT' | 'EQUILIBRIUM' | 'PREMIUM' } | null;
  fibonacci: { from: Swing; to: Swing; retracement: number | null; zone: 'SHALLOW' | 'PREFERRED' | 'DEEP' | 'EXTENDED' | null; levels: { ratio: number; price: number }[] } | null;
  levels: PriceLevel[];
  bollinger: { middle: number; upper: number; lower: number; percentB: number; bandwidthPct: number } | null;
  atr14: number | null;
}

const confirmBars = 3;

/** Swing highs and lows with 3 bars each side; a swing exists only once the right-side bars have closed. */
export function swings(bars: readonly Bar[], side = confirmBars): Swing[] {
  const out: Swing[] = [];
  for (let i = side; i < bars.length - side; i += 1) {
    const b = bars[i]!;
    const left = bars.slice(i - side, i), right = bars.slice(i + 1, i + 1 + side);
    const confirmedOn = bars[i + side]!.date;
    if (left.every((x) => b.high > x.high) && right.every((x) => b.high >= x.high)) out.push({ date: b.date, price: b.high, type: 'HIGH', confirmedOn });
    if (left.every((x) => b.low < x.low) && right.every((x) => b.low <= x.low)) out.push({ date: b.date, price: b.low, type: 'LOW', confirmedOn });
  }
  return out;
}

/** A close beyond the latest confirmed swing is a break; against the current bias it is a change of character. */
export function structureBreaks(bars: readonly Bar[], points: readonly Swing[]): StructureBreak[] {
  const breaks: StructureBreak[] = [];
  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  const broken = new Set<Swing>();
  for (const bar of bars) {
    const known = points.filter((s) => s.confirmedOn < bar.date);
    const high = known.filter((s) => s.type === 'HIGH').at(-1), low = known.filter((s) => s.type === 'LOW').at(-1);
    if (high && !broken.has(high) && bar.close > high.price) {
      breaks.push({ type: bias === 'BEARISH' ? 'CHOCH' : 'BOS', direction: 'BULLISH', date: bar.date, close: bar.close, brokenSwing: high });
      broken.add(high); bias = 'BULLISH';
    }
    if (low && !broken.has(low) && bar.close < low.price) {
      breaks.push({ type: bias === 'BULLISH' ? 'CHOCH' : 'BOS', direction: 'BEARISH', date: bar.date, close: bar.close, brokenSwing: low });
      broken.add(low); bias = 'BEARISH';
    }
  }
  return breaks;
}

const FIB_RATIOS = [0.236, 0.382, 0.5, 0.618, 0.786];

/** Retracement of the last completed leg (swing to opposite swing) by the current close. */
export function fibonacci(points: readonly Swing[], close: number): StructureSnapshot['fibonacci'] {
  // Alternate HIGH/LOW keeping the more extreme of repeated types.
  const alt: Swing[] = [];
  for (const s of points) {
    const prev = alt.at(-1);
    if (!prev || prev.type !== s.type) alt.push(s);
    else if (s.type === 'HIGH' ? s.price > prev.price : s.price < prev.price) alt[alt.length - 1] = s;
  }
  if (alt.length < 2) return null;
  const from = alt[alt.length - 2]!, to = alt[alt.length - 1]!;
  const leg = to.price - from.price;
  if (leg === 0) return null;
  const retracement = (to.price - close) / leg;
  const zone = retracement < 0 ? null : retracement < 0.382 ? 'SHALLOW' : retracement <= 0.618 ? 'PREFERRED' : retracement <= 0.786 ? 'DEEP' : 'EXTENDED';
  return { from, to, retracement, zone, levels: FIB_RATIOS.map((ratio) => ({ ratio, price: to.price - leg * ratio })) };
}

/** Swing prices within 1.5% of each other are one level; the nearest three each side of the close are kept. */
export function priceLevels(points: readonly Swing[], close: number): PriceLevel[] {
  const clusters: { prices: number[]; lastDate: string }[] = [];
  for (const s of [...points].sort((a, b) => a.price - b.price)) {
    const c = clusters.at(-1);
    if (c && s.price / c.prices[0]! - 1 <= 0.015) { c.prices.push(s.price); if (s.date > c.lastDate) c.lastDate = s.date; }
    else clusters.push({ prices: [s.price], lastDate: s.date });
  }
  const levels = clusters.map((c) => {
    const price = c.prices.reduce((a, b) => a + b, 0) / c.prices.length;
    return { price, kind: price <= close ? 'SUPPORT' as const : 'RESISTANCE' as const, touches: c.prices.length, lastDate: c.lastDate };
  });
  const below = levels.filter((l) => l.kind === 'SUPPORT').sort((a, b) => b.price - a.price).slice(0, 3);
  const above = levels.filter((l) => l.kind === 'RESISTANCE').sort((a, b) => a.price - b.price).slice(0, 3);
  return [...above.reverse(), ...below];
}

export function bollinger(closes: readonly number[], period = 20, k = 2): StructureSnapshot['bollinger'] {
  if (closes.length < period) return null;
  const w = closes.slice(-period);
  const middle = w.reduce((a, b) => a + b, 0) / period;
  const sd = Math.sqrt(w.reduce((s, c) => s + (c - middle) ** 2, 0) / period);
  const upper = middle + k * sd, lower = middle - k * sd;
  const close = closes.at(-1)!;
  return { middle, upper, lower, percentB: upper === lower ? 0.5 : (close - lower) / (upper - lower), bandwidthPct: ((upper - lower) / middle) * 100 };
}

/** Wilder's ATR. */
export function atr(bars: readonly Bar[], period = 14): number | null {
  if (bars.length <= period) return null;
  const tr = bars.slice(1).map((b, i) => Math.max(b.high - b.low, Math.abs(b.high - bars[i]!.close), Math.abs(b.low - bars[i]!.close)));
  let value = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (const t of tr.slice(period)) value = (value * (period - 1) + t) / period;
  return value;
}

export function structureSnapshot(input: readonly Bar[], lookback = 250): StructureSnapshot | null {
  const bars = [...input].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-lookback);
  if (bars.length < 2 * confirmBars + 3) return null;
  const last = bars.at(-1)!;
  const points = swings(bars);
  const breaks = structureBreaks(bars, points);
  const hi = points.filter((s) => s.type === 'HIGH').at(-1), lo = points.filter((s) => s.type === 'LOW').at(-1);
  let zone: StructureSnapshot['zone'] = null;
  if (hi && lo && hi.price > lo.price) {
    const percentile = Math.min(1, Math.max(0, (last.close - lo.price) / (hi.price - lo.price)));
    zone = { rangeLow: lo.price, rangeHigh: hi.price, percentile, label: percentile < 1 / 3 ? 'DISCOUNT' : percentile > 2 / 3 ? 'PREMIUM' : 'EQUILIBRIUM' };
  }
  return {
    sessionDate: last.date, close: last.close,
    bias: breaks.at(-1)?.direction ?? 'NEUTRAL',
    swings: points.slice(-12), breaks: breaks.slice(-8), zone,
    fibonacci: fibonacci(points, last.close),
    levels: priceLevels(points, last.close),
    bollinger: bollinger(bars.map((b) => b.close)),
    atr14: atr(bars),
  };
}

// ---- participation footprint ----

export interface Footprint {
  sessionDate: string;
  state: 'ACCUMULATION_LIKE' | 'DISTRIBUTION_LIKE' | 'MIXED' | 'NEUTRAL' | 'DATA_GAP';
  /** −100 (distribution-like) … +100 (accumulation-like). */
  score: number;
  /** Today's volume vs the 20-session average. */
  volumeRatio: number | null;
  /** Where the close sits in today's range: 0 at the low, 1 at the high. */
  closeLocation: number | null;
  /** Foreign and institution net shares over 5 sessions as a share of 5-session volume, percent. */
  foreignShare5: number | null;
  institutionShare5: number | null;
  reasons: string[];
}

/**
 * Behaviour (unusual volume closing near the high or low) plus observed net
 * buying. It never names who traded beyond the investor types Naver reports,
 * and it is not evidence of manipulation.
 */
export function footprint(input: readonly Bar[], flows: readonly { date: string; foreignNet: number | null; institutionNet: number | null }[]): Footprint {
  const bars = [...input].sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = bars.at(-1);
  if (!last || bars.length < 21) {
    return { sessionDate: last?.date ?? '', state: 'DATA_GAP', score: 0, volumeRatio: null, closeLocation: null, foreignShare5: null, institutionShare5: null, reasons: ['가격 기록이 20거래일보다 짧아요.'] };
  }
  const avgVol = bars.slice(-21, -1).reduce((s, b) => s + b.volume, 0) / 20;
  const volumeRatio = avgVol > 0 ? last.volume / avgVol : null;
  const closeLocation = last.high > last.low ? (last.close - last.low) / (last.high - last.low) : 0.5;
  const reasons: string[] = [];
  let behaviour = 0;
  if (volumeRatio !== null && volumeRatio >= 1.5) {
    behaviour = (closeLocation - 0.5) * 2 * Math.min(1, (volumeRatio - 1) / 1.5) * 100;
    reasons.push(`거래량이 20일 평균의 ${volumeRatio.toFixed(1)}배였고, 종가가 하루 범위의 ${Math.round(closeLocation * 100)}% 위치였어요.`);
  }
  const recent = [...flows].filter((f) => f.date <= last.date).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-5);
  const vol5 = bars.slice(-5).reduce((s, b) => s + b.volume, 0);
  const share = (key: 'foreignNet' | 'institutionNet') =>
    recent.length === 5 && recent.every((f) => f[key] !== null) && vol5 > 0 ? (recent.reduce((s, f) => s + f[key]!, 0) / vol5) * 100 : null;
  const foreignShare5 = share('foreignNet'), institutionShare5 = share('institutionNet');
  let observed: number | null = null;
  if (foreignShare5 !== null && institutionShare5 !== null) {
    // 10% of volume bought net over a week is a strong signal; scale to ±100.
    observed = Math.max(-100, Math.min(100, ((foreignShare5 + institutionShare5) / 10) * 100));
    reasons.push(`최근 5거래일 외국인 순매수는 거래량의 ${foreignShare5.toFixed(1)}%, 기관은 ${institutionShare5.toFixed(1)}%예요.`);
  } else {
    reasons.push('최근 5거래일 투자자별 순매수 기록이 모자라요.');
  }
  const score = observed === null ? behaviour : 0.4 * behaviour + 0.6 * observed;
  const state = observed === null && behaviour === 0 ? 'DATA_GAP'
    : score >= 25 ? 'ACCUMULATION_LIKE' : score <= -25 ? 'DISTRIBUTION_LIKE'
      : Math.sign(behaviour) !== 0 && observed !== null && Math.sign(behaviour) !== Math.sign(observed) ? 'MIXED' : 'NEUTRAL';
  return { sessionDate: last.date, state, score: Math.round(score), volumeRatio, closeLocation, foreignShare5, institutionShare5, reasons };
}
