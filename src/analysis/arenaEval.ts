// The model arena (G-290): open forecasting models in the hidden-future panel. Each model gives, for each stock on
// each evaluation day, either sample paths (Kronos) or quantiles (Chronos, TimesFM, ...) of the close 20 sessions on,
// as a ratio to the cutoff close. From them we read a chance of being higher, a typical move and an 80% range, and
// score them against what happened, next to the committee's statistical base (baseOdds.ts, refitted walk-forward)
// and the statistical range (valuation.ts) on the same rows.
// Internal research and a public methodology note, not an advertisement of returns. Pure.

import { meanCI, ranks, spearman } from './evalPanel.js';

export const ARENA_METHOD = 'gnm-arena-v1';
/** The quantile levels a quantile model returns, in order. */
export const LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as const;

/** One stock on one evaluation day: what happened and what the existing models said (no model forecast). */
export interface TruthRow {
  id: string; date: string; symbol: string;
  ret: number; excess: number; ended: boolean;
  /** The statistical base chance of being higher in 20 sessions, from a model fitted on outcomes known before this date. */
  base: number | null;
  /** The up rate of the outcomes known before this date (the "always say the usual" line). */
  constant: number;
  /** The statistical 80% range as ratios to the cutoff close, and its daily sigma. */
  p10: number | null; p90: number | null; sigma: number | null;
  /** 60-session daily volatility (positive). */
  vol60: number | null;
}
/** A model's forecast for one row: sample path closes, or the LEVELS quantiles (ratios to the cutoff close). */
export interface Forecast { paths?: number[]; q?: number[] }
export interface ArenaRow extends TruthRow { forecast: Forecast }

export interface ForecastStats { up: number; move: number; p10: number; p90: number; spread: number }

/** Linear-interpolated quantile of sorted values. */
export function quantile(sorted: readonly number[], q: number): number {
  if (!sorted.length) return NaN;
  const x = q * (sorted.length - 1), lo = Math.floor(x), hi = Math.ceil(x);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (x - lo);
}

/**
 * From sample paths: the chance of being higher (share of paths above the cutoff, pulled toward 50% by half a path
 * each way so 16 of 16 is not "certain"), the median log move, and the 10–90% range and its width in log terms.
 */
export function pathStats(paths: readonly number[]): ForecastStats | null {
  const xs = paths.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (xs.length < 4) return null;
  const up = (xs.filter((p) => p > 1).length + 0.5) / (xs.length + 1);
  const p10 = quantile(xs, 0.1), p90 = quantile(xs, 0.9);
  return { up, move: Math.log(quantile(xs, 0.5)), p10, p90, spread: Math.log(p90 / p10) };
}

/**
 * From the LEVELS quantiles: the chance of being higher is 1 − F(1), reading F off the quantiles by straight lines.
 * Outside the 10–90% band it is held at 5% / 95% (the quantiles say nothing finer there).
 */
export function quantileStats(q: readonly number[]): ForecastStats | null {
  if (q.length !== LEVELS.length || q.some((v) => !Number.isFinite(v) || v <= 0)) return null;
  const xs = [...q].sort((a, b) => a - b); // a model may cross its quantiles slightly
  let below: number;
  if (1 <= xs[0]!) below = 0.05;
  else if (1 >= xs.at(-1)!) below = 0.95;
  else {
    let k = 0; while (xs[k + 1]! < 1) k += 1;
    const a = xs[k]!, b = xs[k + 1]!;
    below = LEVELS[k]! + (b > a ? (1 - a) / (b - a) : 0.5) * (LEVELS[k + 1]! - LEVELS[k]!);
  }
  return { up: 1 - below, move: Math.log(xs[4]!), p10: xs[0]!, p90: xs[8]!, spread: Math.log(xs[8]! / xs[0]!) };
}

export const forecastStats = (f: Forecast): ForecastStats | null => (f.q ? quantileStats(f.q) : f.paths ? pathStats(f.paths) : null);

type Interval = { mean: number; lo: number; hi: number };

export interface ArenaScore {
  rows: number; dates: number; from: string; to: string; upRate: number;
  /** Chance of being higher in 20 sessions: Brier (lower is better) for the model, the base, their average, the earlier up rate, and 50%. */
  brier: { model: number; base: number; blend: number; constant: number; half: number };
  /** Per-date Brier difference model − base (negative means the model is better), with its interval over dates. */
  brierGap: Interval;
  /** Mean per-date rank correlation with the 20-session excess return over the same day's stocks. */
  ic: { move: Interval; up: Interval; base: Interval; lowVol: Interval };
  /** The model's move IC after taking out the base's rank the same day: what it adds. */
  icAdded: Interval;
  /** Per-date IC difference model move − base. */
  icGap: Interval;
  /** Top fifth minus bottom fifth by the model's move, average excess return, percent. */
  spread: Interval;
  /** Share of closes inside each 80% range (it should be about 80%), and whether wider ranges went with bigger moves. */
  range: { coverage: number; statCoverage: number; sizeIc: Interval; statSizeIc: Interval; volSizeIc: Interval; sizeGap: Interval; n: number };
  /** Calibration of the model's chance: said vs happened, by band. */
  bands: { lo: number; hi: number; n: number; said: number; happened: number }[];
}

/** Rank residual of a after taking out b, correlated with c (all within one date). */
function partialRankCorr(a: readonly number[], b: readonly number[], c: readonly number[]): number | null {
  const n = a.length;
  if (n < 3) return null;
  const rk = (xs: readonly number[]) => ranks(xs).map((r) => r / (n - 1) - 0.5);
  const ra = rk(a), rb = rk(b), rc = rk(c);
  // A flat b (every stock the same) takes nothing out.
  const vb = rb.reduce((s, x) => s + x * x, 0);
  const beta = vb > 0 ? ra.reduce((s, x, k) => s + x * rb[k]!, 0) / vb : 0;
  const res = ra.map((x, k) => x - beta * rb[k]!);
  const num = res.reduce((s, x, k) => s + x * rc[k]!, 0), da = Math.sqrt(res.reduce((s, x) => s + x * x, 0)), dc = Math.sqrt(rc.reduce((s, x) => s + x * x, 0));
  return da > 0 && dc > 0 ? num / (da * dc) : null;
}

/** Scores one model on its rows, grouped by date. */
export function scoreModel(all: readonly ArenaRow[], minStocks = 30): ArenaScore {
  const rows = all.map((r) => ({ r, s: forecastStats(r.forecast) })).filter((x): x is { r: ArenaRow; s: ForecastStats } => x.s !== null && x.r.base !== null);
  const byDate = new Map<string, typeof rows>();
  for (const x of rows) byDate.set(x.r.date, [...(byDate.get(x.r.date) ?? []), x]);
  const dates = [...byDate.keys()].sort();
  const up = (x: { r: ArenaRow }) => (x.r.ret > 0 ? 1 : 0);
  const sq = (p: number, y: number) => (p - y) ** 2;
  const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const brier = {
    model: mean(rows.map((x) => sq(x.s.up, up(x)))),
    base: mean(rows.map((x) => sq(x.r.base!, up(x)))),
    blend: mean(rows.map((x) => sq((x.s.up + x.r.base!) / 2, up(x)))),
    constant: mean(rows.map((x) => sq(x.r.constant, up(x)))),
    half: mean(rows.map((x) => sq(0.5, up(x)))),
  };
  const gaps: number[] = [], icMove: number[] = [], icUp: number[] = [], icBase: number[] = [], icVol: number[] = [], icAdd: number[] = [], icGap: number[] = [], spreads: number[] = [];
  const kSize: number[] = [], sSize: number[] = [], vSize: number[] = [], sizeGap: number[] = [];
  for (const d of dates) {
    const xs = byDate.get(d)!;
    gaps.push(mean(xs.map((x) => sq(x.s.up, up(x)) - sq(x.r.base!, up(x)))));
    if (xs.length < minStocks) continue;
    const ex = xs.map((x) => x.r.excess);
    const a = spearman(xs.map((x) => x.s.move), ex), b = spearman(xs.map((x) => x.r.base!), ex);
    if (a !== null) icMove.push(a);
    if (b !== null) icBase.push(b);
    if (a !== null && b !== null) icGap.push(a - b);
    const u = spearman(xs.map((x) => x.s.up), ex); if (u !== null) icUp.push(u);
    const withVol = xs.filter((x) => x.r.vol60 !== null);
    const v = spearman(withVol.map((x) => -x.r.vol60!), withVol.map((x) => x.r.excess)); if (v !== null) icVol.push(v);
    const p = partialRankCorr(xs.map((x) => x.s.move), xs.map((x) => x.r.base!), ex); if (p !== null) icAdd.push(p);
    const rk = ranks(xs.map((x) => x.s.move)), n = xs.length;
    const top = xs.filter((_, k) => rk[k]! >= 0.8 * (n - 1)), bottom = xs.filter((_, k) => rk[k]! <= 0.2 * (n - 1));
    if (top.length && bottom.length) spreads.push((mean(top.map((x) => x.r.excess)) - mean(bottom.map((x) => x.r.excess))) * 100);
    const live = xs.filter((x) => !x.r.ended), size = live.map((x) => Math.abs(Math.log(1 + x.r.ret)));
    const ks = spearman(live.map((x) => x.s.spread), size); if (ks !== null) kSize.push(ks);
    const ls = live.filter((x) => x.r.sigma !== null);
    const ss = spearman(ls.map((x) => x.r.sigma!), ls.map((x) => Math.abs(Math.log(1 + x.r.ret)))); if (ss !== null) sSize.push(ss);
    if (ks !== null && ss !== null) sizeGap.push(ks - ss);
    const lv = live.filter((x) => x.r.vol60 !== null);
    const vs = spearman(lv.map((x) => x.r.vol60!), lv.map((x) => Math.abs(Math.log(1 + x.r.ret)))); if (vs !== null) vSize.push(vs);
  }
  const ci = (xs: readonly number[], seed: number): Interval => { const c = meanCI(xs, seed); return { mean: c.mean, lo: c.lo, hi: c.hi }; };
  const live = rows.filter((x) => !x.r.ended);
  const inside = (c: number, lo: number, hi: number) => c >= lo && c <= hi;
  const withStat = live.filter((x) => x.r.p10 !== null && x.r.p90 !== null);
  const edges = [0, 0.3, 0.4, 0.5, 0.6, 0.7, 1.0001];
  return {
    rows: rows.length, dates: dates.length, from: dates[0] ?? '', to: dates.at(-1) ?? '', upRate: mean(rows.map(up)),
    brier, brierGap: ci(gaps, 3),
    ic: { move: ci(icMove, 5), up: ci(icUp, 6), base: ci(icBase, 7), lowVol: ci(icVol, 8) },
    icAdded: ci(icAdd, 9), icGap: ci(icGap, 10), spread: ci(spreads, 11),
    range: {
      n: live.length,
      coverage: mean(live.map((x) => (inside(1 + x.r.ret, x.s.p10, x.s.p90) ? 1 : 0))),
      statCoverage: mean(withStat.map((x) => (inside(1 + x.r.ret, x.r.p10!, x.r.p90!) ? 1 : 0))),
      sizeIc: ci(kSize, 12), statSizeIc: ci(sSize, 13), volSizeIc: ci(vSize, 14), sizeGap: ci(sizeGap, 15),
    },
    bands: edges.slice(0, -1).map((lo, k) => {
      const hi = edges[k + 1]!, xs = rows.filter((x) => x.s.up >= lo && x.s.up < hi);
      return { lo, hi: Math.min(1, hi), n: xs.length, said: mean(xs.map((x) => x.s.up)), happened: mean(xs.map(up)) };
    }),
  };
}

/**
 * A model "wins" a question only when its 95% interval against the base on the same rows clears zero:
 * direction (Brier gap below 0), ranking (IC gap above 0) or size (size-IC gap above 0) — and then still has to hold
 * on later months before anyone acts on it.
 */
export function verdict(s: ArenaScore): { direction: boolean; ranking: boolean; size: boolean } {
  return { direction: s.brierGap.hi < 0, ranking: s.icGap.lo > 0, size: s.range.sizeGap.lo > 0 };
}
