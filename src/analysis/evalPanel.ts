// Hidden-future evaluation v2 (G-245), the cross-section. On evaluation dates 20 sessions apart, the most-traded
// stocks of that day (point in time, delisted stocks included) are lined up by each signal, and the signal is
// scored on the 20 hidden sessions after it:
//   - market-relative: the outcome is the stock's 20-session return minus the average of that day's stocks;
//   - ranking: rank correlation (IC) with that excess return, and top fifth minus bottom fifth;
//   - beat-the-market chance: the signal's fifth turned into a probability from earlier dates only, Brier score;
//   - movement size: whether the statistical 20-session range (R1) held the close as often as it says (80%).
// Dates 20 sessions apart do not overlap, so each date is one independent-ish draw; confidence intervals
// resample dates. Pure; src/cli/evalRun.ts does the files.

import { forecastRanges } from './valuation.js';
import { context, STRATEGIES, type ArenaBar } from './strategies.js';

export const PANEL_METHOD = 'gnm-panel-v1';
export const H = 20;
export const MIN_HISTORY = 250;

/** Raw chart rows: [yyyymmdd, open, high, low, close, volume]. */
export type RawBar = number[];
export const toBars = (raw: readonly RawBar[]): ArenaBar[] =>
  raw.map((r) => ({ date: ymd(r[0]!), open: r[1]!, high: r[2]!, low: r[3]!, close: r[4]!, volume: r[5]! }));
export const ymd = (n: number) => { const s = String(n); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; };

/**
 * For each evaluation date (every `step` sessions of the calendar from `from`, with 20 sessions still to come),
 * the `top` stocks by average traded value over the 60 sessions before it, among those that traded that day,
 * have MIN_HISTORY sessions behind them and closed at 1,000 or more. Uses nothing after the date.
 */
export function liquidSets(series: readonly { symbol: string; bars: readonly RawBar[] }[], calendar: readonly number[], top: number, from: number, step = H): { date: number; k: number; symbols: string[] }[] {
  const prepared = series.map((s) => {
    const at = new Map<number, number>();
    const pv = [0];
    s.bars.forEach((b, i) => { at.set(b[0]!, i); pv.push(pv[i]! + b[4]! * b[5]!); });
    return { symbol: s.symbol, bars: s.bars, at, pv };
  });
  const out: { date: number; k: number; symbols: string[] }[] = [];
  const start = calendar.findIndex((d) => d >= from);
  if (start < 0) return out;
  for (let k = start; k + H < calendar.length; k += step) {
    const d = calendar[k]!;
    const scored: [string, number][] = [];
    for (const p of prepared) {
      const i = p.at.get(d);
      if (i === undefined || i < MIN_HISTORY - 1 || p.bars[i]![4]! < 1000) continue;
      scored.push([p.symbol, (p.pv[i + 1]! - p.pv[i - 59]!) / 60]);
    }
    scored.sort((a, b) => b[1] - a[1]);
    out.push({ date: d, k, symbols: scored.slice(0, top).map((x) => x[0]) });
  }
  return out;
}

export interface FlowDay { date: string; foreign: number; inst: number; hold: number }
export interface EventDay { date: string; key: string }
export interface PanelStock { symbol: string; bars: ArenaBar[]; at: Map<string, number>; ctx: ReturnType<typeof context>; flows: FlowDay[] | null; events: EventDay[] | null }

export function panelStock(symbol: string, raw: readonly RawBar[], flows: readonly RawBar[] | null, events: readonly [number, string][] | null): PanelStock {
  const bars = toBars(raw);
  return {
    symbol, bars, at: new Map(bars.map((b, i) => [b.date, i])), ctx: context(bars),
    flows: flows ? flows.map((f) => ({ date: ymd(f[0]!), foreign: f[1]!, inst: f[2]!, hold: f[3]! })) : null,
    events: events ? events.map(([d, key]) => ({ date: ymd(d), key })) : null,
  };
}

/** The close 20 calendar sessions on, or the last close before it when the stock stopped trading (a delisting keeps its loss). */
export function forwardReturn(s: PanelStock, i: number, outcomeDate: string): { ret: number; ended: boolean } | null {
  const base = s.bars[i]!;
  let j = s.at.get(outcomeDate);
  let ended = false;
  if (j === undefined) {
    // Last bar on or before the outcome date.
    let lo = i, hi = s.bars.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s.bars[m]!.date <= outcomeDate) lo = m; else hi = m - 1; }
    j = lo;
    ended = j === s.bars.length - 1 && s.bars[j]!.date < outcomeDate;
    if (j === i && !ended) return null;
  }
  return { ret: s.bars[j]!.close / base.close - 1, ended };
}

// ---------- signals ----------

export interface SignalDef { key: string; name: string; group: 'rule' | 'factor' | 'flow' | 'event'; value(s: PanelStock, i: number, market: MarketView): number | null }
/** Index closes by date, for market-relative event reactions. */
export interface MarketView { close: Map<string, number>; dates: string[] }

const sumBack = (xs: readonly FlowDay[], end: string, n: number, f: (x: FlowDay) => number) => {
  let lo = 0, hi = xs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m]!.date <= end) lo = m + 1; else hi = m; }
  if (lo < n) return null;
  let s = 0; for (let k = lo - n; k < lo; k += 1) s += f(xs[k]!); return { sum: s, last: xs[lo - 1]!, first: xs[lo - n]! };
};
const recentEvent = (s: PanelStock, i: number, keys: readonly string[], sessions: number) => {
  if (!s.events) return null;
  const from = s.bars[Math.max(0, i - sessions + 1)]!.date, to = s.bars[i]!.date;
  return s.events.some((e) => e.date >= from && e.date <= to && keys.includes(e.key)) ? 1 : 0;
};

export const SIGNALS: readonly SignalDef[] = [
  ...STRATEGIES.filter((d) => d.key !== 'hold').map((d): SignalDef => ({ key: d.key, name: d.name, group: 'rule', value: (s, i) => d.score(s.ctx, i) })),
  { key: 'mom12_1', name: '12개월 모멘텀(최근 1개월 제외)', group: 'factor', value: (s, i) => (i >= 250 ? s.bars[i - 20]!.close / s.bars[i - 250]!.close - 1 : null) },
  { key: 'rev5', name: '5일 반전(최근 하락)', group: 'factor', value: (s, i) => (i >= 5 ? -(s.bars[i]!.close / s.bars[i - 5]!.close - 1) : null) },
  { key: 'high52', name: '52주 고가 근접', group: 'factor', value: (s, i) => { if (i < 249) return null; let h = 0; for (let k = i - 249; k <= i; k += 1) h = Math.max(h, s.bars[k]!.high); return s.bars[i]!.close / h; } },
  { key: 'lowvol', name: '낮은 변동성', group: 'factor', value: (s, i) => { if (i < 60) return null; let a = 0, b = 0; for (let k = i - 59; k <= i; k += 1) { const r = Math.log(s.bars[k]!.close / s.bars[k - 1]!.close); a += r; b += r * r; } return -Math.sqrt(b / 60 - (a / 60) ** 2); } },
  { key: 'volsurge', name: '거래량 급증(5일/60일)', group: 'factor', value: (s, i) => { if (i < 65) return null; let a = 0, b = 0; for (let k = i - 4; k <= i; k += 1) a += s.bars[k]!.volume; for (let k = i - 64; k <= i - 5; k += 1) b += s.bars[k]!.volume; return b > 0 ? (a / 5) / (b / 60) : null; } },
  { key: 'flow20', name: '외국인+기관 20일 순매수(거래량 대비)', group: 'flow', value: (s, i) => flowShare(s, i, (x) => x.foreign + x.inst) },
  { key: 'foreign20', name: '외국인 20일 순매수(거래량 대비)', group: 'flow', value: (s, i) => flowShare(s, i, (x) => x.foreign) },
  { key: 'inst20', name: '기관 20일 순매수(거래량 대비)', group: 'flow', value: (s, i) => flowShare(s, i, (x) => x.inst) },
  { key: 'hold20', name: '외국인 보유율 20일 변화', group: 'flow', value: (s, i) => { if (!s.flows) return null; const w = sumBack(s.flows, s.bars[i]!.date, 21, () => 0); return w && w.last.date >= s.bars[Math.max(0, i - 3)]!.date ? w.last.hold - w.first.hold : null; } },
  { key: 'buyback', name: '자사주 매입·소각 공시(20일 안)', group: 'event', value: (s, i) => recentEvent(s, i, ['buyback'], 20) },
  { key: 'contract', name: '공급계약 공시(20일 안)', group: 'event', value: (s, i) => recentEvent(s, i, ['contract'], 20) },
  { key: 'buybackSell', name: '자사주 처분 공시(20일 안, 반대 방향)', group: 'event', value: (s, i) => { const v = recentEvent(s, i, ['buybackSell'], 20); return v === null ? null : -v; } },
  { key: 'earnReact', name: '실적 공시 날 시장 대비 반응(60일 안)', group: 'event', value: (s, i, m) => earningsReaction(s, i, m) },
];

function flowShare(s: PanelStock, i: number, f: (x: FlowDay) => number): number | null {
  if (!s.flows) return null;
  const w = sumBack(s.flows, s.bars[i]!.date, 20, f);
  if (!w || w.last.date < s.bars[Math.max(0, i - 3)]!.date || i < 20) return null; // flows must be current
  let v = 0; for (let k = i - 19; k <= i; k += 1) v += s.bars[k]!.volume;
  return v > 0 ? w.sum / v : null;
}

/** Post-earnings drift: the stock's move minus the index's from the day before to the day after the latest earnings filing in the last 60 sessions. */
function earningsReaction(s: PanelStock, i: number, m: MarketView): number | null {
  if (!s.events) return null;
  const from = s.bars[Math.max(0, i - 59)]!.date, to = s.bars[Math.max(0, i - 1)]!.date; // the day after must be known by today
  const e = [...s.events].reverse().find((x) => x.key === 'earnings' && x.date >= from && x.date <= to);
  if (!e) return null;
  const j = s.bars.findIndex((b) => b.date >= e.date);
  if (j < 1 || j + 1 > i) return null;
  const a = s.bars[j - 1]!, b = s.bars[j + 1]!;
  const ia = m.close.get(a.date), ib = m.close.get(b.date);
  if (!ia || !ib) return null;
  return b.close / a.close - ib / ia;
}

// ---------- the cross-section of one date ----------

/** p10/p90 are the statistical range as a ratio to the base close. */
export interface Row { symbol: string; i: number; excess: number; ret: number; ended: boolean; values: Record<string, number | null>; p10: number | null; p90: number | null; sigma: number | null }

export function crossSection(stocks: ReadonlyMap<string, PanelStock>, symbols: readonly string[], date: string, outcomeDate: string, market: MarketView): Row[] {
  const rows: Omit<Row, 'excess'>[] = [];
  for (const sym of symbols) {
    const s = stocks.get(sym); if (!s) continue;
    const i = s.at.get(date); if (i === undefined) continue;
    const f = forwardReturn(s, i, outcomeDate); if (!f) continue;
    const fc = forecastRanges(sym, s.bars.slice(Math.max(0, i - 299), i + 1), new Date(0)).find((x) => x.horizon === H);
    rows.push({ symbol: sym, i, ret: f.ret, ended: f.ended, values: Object.fromEntries(SIGNALS.map((g) => [g.key, finite(g.value(s, i, market))])), p10: fc ? fc.p10 / s.bars[i]!.close : null, p90: fc ? fc.p90 / s.bars[i]!.close : null, sigma: fc?.sigma ?? null });
  }
  const mean = rows.reduce((a, r) => a + r.ret, 0) / Math.max(1, rows.length);
  return rows.map((r) => ({ ...r, excess: r.ret - mean }));
}
const finite = (v: number | null) => (v != null && Number.isFinite(v) ? v : null);

// ---------- statistics ----------

export function ranks(xs: readonly number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let k = 0; k < idx.length;) { let j = k; while (j + 1 < idx.length && idx[j + 1]![0] === idx[k]![0]) j += 1; for (let t = k; t <= j; t += 1) r[idx[t]![1]] = (k + j) / 2; k = j + 1; }
  return r;
}
export function spearman(a: readonly number[], b: readonly number[]): number | null {
  if (a.length < 3) return null;
  const ra = ranks(a), rb = ranks(b), n = a.length;
  const ma = ra.reduce((s, v) => s + v, 0) / n, mb = rb.reduce((s, v) => s + v, 0) / n;
  let c = 0, va = 0, vb = 0; for (let k = 0; k < n; k += 1) { c += (ra[k]! - ma) * (rb[k]! - mb); va += (ra[k]! - ma) ** 2; vb += (rb[k]! - mb) ** 2; }
  return va > 0 && vb > 0 ? c / Math.sqrt(va * vb) : null;
}
/** Fifths 0…4 by value (ties share a fifth). */
export const quintiles = (xs: readonly number[]) => { const r = ranks(xs); return r.map((v) => Math.min(4, Math.floor((v / xs.length) * 5))); };

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Mean and its 95% bootstrap interval, resampling the per-date values. */
export function meanCI(xs: readonly number[], seed = 1, reps = 2000): { mean: number; lo: number; hi: number; n: number } {
  const n = xs.length, mean = n ? xs.reduce((a, b) => a + b, 0) / n : NaN;
  if (n < 2) return { mean, lo: NaN, hi: NaN, n };
  const r = rng(seed), ms: number[] = [];
  for (let k = 0; k < reps; k += 1) { let s = 0; for (let t = 0; t < n; t += 1) s += xs[Math.floor(r() * n)]!; ms.push(s / n); }
  ms.sort((a, b) => a - b);
  return { mean, lo: ms[Math.floor(0.025 * reps)]!, hi: ms[Math.floor(0.975 * reps)]!, n };
}

export interface SignalScore {
  key: string; name: string; group: SignalDef['group']; dates: number; avgStocks: number;
  /** Mean rank correlation with the excess return, with its 95% interval over dates. */
  ic: { mean: number; lo: number; hi: number };
  /** Share of dates with a positive IC. */
  icPositive: number;
  /** Top fifth minus bottom fifth, average 20-session excess return, percent. */
  spread: { mean: number; lo: number; hi: number };
  /** Beat-the-market chance from the signal's fifth (calibrated on earlier dates only): Brier, and the same for the base rate. */
  brier: number; brierBase: number; skill: number;
}

/**
 * Scores one signal over dates. `dates` are in time order and 20 sessions apart, so a date's outcome is known by
 * the next one; the fifth→chance table for a date uses only the dates before it (at least 6; 50% before that).
 */
export function scoreSignal(key: string, dates: readonly { date: string; rows: readonly Row[] }[], minStocks = 30, seed = 7): SignalScore | null {
  const def = SIGNALS.find((s) => s.key === key);
  const ics: number[] = [], spreads: number[] = [], sizes: number[] = [];
  const past = { hit: [0, 0, 0, 0, 0], n: [0, 0, 0, 0, 0], all: 0, allN: 0 };
  let b = 0, bb = 0, bn = 0;
  for (const d of dates) {
    const rows = d.rows.filter((r) => r.values[key] != null);
    if (rows.length < minStocks) continue;
    const v = rows.map((r) => r.values[key]!), ex = rows.map((r) => r.excess);
    const ic = spearman(v, ex);
    if (ic === null) continue; // a signal with no spread that day (e.g. no one filed)
    ics.push(ic); sizes.push(rows.length);
    const q = quintiles(v);
    const avg = (k: number) => { const xs = ex.filter((_, t) => q[t] === k); return xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : null; };
    const hi = avg(4), lo = avg(0);
    if (hi !== null && lo !== null) spreads.push((hi - lo) * 100);
    const enough = past.allN >= 6 * minStocks;
    rows.forEach((r, t) => {
      const beat = r.excess > 0 ? 1 : 0;
      const base = past.allN ? past.all / past.allN : 0.5;
      const p = enough && past.n[q[t]!]! ? past.hit[q[t]!]! / past.n[q[t]!]! : 0.5;
      if (enough) { b += (p - beat) ** 2; bb += (base - beat) ** 2; bn += 1; }
    });
    rows.forEach((r, t) => { const beat = r.excess > 0 ? 1 : 0; past.hit[q[t]!]! += beat; past.n[q[t]!]! += 1; past.all += beat; past.allN += 1; });
  }
  if (ics.length < 5) return null;
  const ic = meanCI(ics, seed), sp = meanCI(spreads, seed + 1);
  return {
    key, name: def?.name ?? key, group: def?.group ?? 'factor', dates: ics.length, avgStocks: Math.round(sizes.reduce((a, c) => a + c, 0) / sizes.length),
    ic: { mean: ic.mean, lo: ic.lo, hi: ic.hi }, icPositive: ics.filter((x) => x > 0).length / ics.length,
    spread: { mean: sp.mean, lo: sp.lo, hi: sp.hi },
    brier: bn ? b / bn : NaN, brierBase: bn ? bb / bn : NaN, skill: bn ? 1 - b / bb : NaN,
  };
}

/** How often the statistical 20-session range held the close (it says 80%), and whether wider ranges went with bigger moves. */
export function rangeScore(dates: readonly { date: string; rows: readonly Row[] }[]): { n: number; coverage: number; below: number; above: number; sizeIc: { mean: number; lo: number; hi: number } } {
  const rr = dates.flatMap((d) => d.rows.filter((r) => r.p10 != null && r.p90 != null && !r.ended));
  const side = rr.map((r) => { const c = 1 + r.ret; return c < r.p10! ? -1 : c > r.p90! ? 1 : 0; });
  const ics: number[] = [];
  for (const d of dates) {
    const rows = d.rows.filter((r) => r.sigma != null && !r.ended);
    if (rows.length < 30) continue;
    const ic = spearman(rows.map((r) => r.sigma!), rows.map((r) => Math.abs(Math.log(1 + r.ret))));
    if (ic !== null) ics.push(ic);
  }
  const ci = meanCI(ics, 11), n = Math.max(1, rr.length);
  return { n: rr.length, coverage: side.filter((x) => x === 0).length / n, below: side.filter((x) => x < 0).length / n, above: side.filter((x) => x > 0).length / n, sizeIc: { mean: ci.mean, lo: ci.lo, hi: ci.hi } };
}
