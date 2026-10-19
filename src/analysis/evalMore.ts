// Hidden-future evaluation, extended checks (G-247). Builds on the cross-sections of evalPanel.ts:
//   - discovery/confirm: a signal found on 2016–2022 must point the same way on 2023–2026;
//   - costs: the top fifth bought and refreshed every 20 sessions, minus a round-trip cost on what changed;
//   - subgroups: market, size, rising or falling market;
//   - other horizons: the same dates with the outcome 5 or 60 sessions on;
//   - a combined score whose weights come only from dates before the one it is used on.
// Pure; src/cli/evalMore.ts does the files.

import { forwardReturn, meanCI, quintiles, scoreSignal, spearman, type PanelStock, type Row, type SignalScore } from './evalPanel.js';

export type Dated = { date: string; outcome: string; rows: Row[] };

/** Keeps the rows `keep` accepts and measures each against the average of the rows kept. */
export function subset(dates: readonly Dated[], keep: (r: Row, d: Dated) => boolean): Dated[] {
  return dates.map((d) => {
    const rows = d.rows.filter((r) => keep(r, d));
    const mean = rows.reduce((a, r) => a + r.ret, 0) / Math.max(1, rows.length);
    return { ...d, rows: rows.map((r) => ({ ...r, excess: r.ret - mean })) };
  });
}

/** The same rows with the outcome `outcomeOf(date)` instead (signal values are as of the date, so they stay). */
export function rehorizon(dates: readonly Dated[], stocks: ReadonlyMap<string, PanelStock>, outcomeOf: (date: string) => string | undefined): Dated[] {
  const out: Dated[] = [];
  for (const d of dates) {
    const outcome = outcomeOf(d.date);
    if (!outcome) continue;
    const rows: Row[] = [];
    for (const r of d.rows) {
      const f = forwardReturn(stocks.get(r.symbol)!, r.i, outcome);
      if (f) rows.push({ ...r, ret: f.ret, ended: f.ended, p10: null, p90: null });
    }
    const mean = rows.reduce((a, r) => a + r.ret, 0) / Math.max(1, rows.length);
    out.push({ date: d.date, outcome, rows: rows.map((r) => ({ ...r, excess: r.ret - mean })) });
  }
  return out;
}

export type Verdict = 'confirmed' | 'weaker' | 'faded' | 'flipped' | 'none';
export interface SplitResult { key: string; discovery: SignalScore | null; confirm: SignalScore | null; verdict: Verdict }

/**
 * A signal is found when its discovery IC interval leaves 0 ('none' otherwise). In the confirm period, measured
 * in the found direction: confirmed when the interval stays above 0, weaker when only the mean does, faded when
 * the mean is 0 or below, flipped when the whole interval is on the other side.
 */
export function splitCheck(key: string, dates: readonly Dated[], cut: string): SplitResult {
  const discovery = scoreSignal(key, dates.filter((d) => d.date < cut));
  const confirm = scoreSignal(key, dates.filter((d) => d.date >= cut));
  let verdict: Verdict = 'none';
  if (discovery && confirm && (discovery.ic.lo > 0 || discovery.ic.hi < 0)) {
    const s = Math.sign(discovery.ic.mean);
    const lo = s > 0 ? confirm.ic.lo : -confirm.ic.hi, hi = s > 0 ? confirm.ic.hi : -confirm.ic.lo, m = s * confirm.ic.mean;
    verdict = lo > 0 ? 'confirmed' : m > 0 ? 'weaker' : hi < 0 ? 'flipped' : 'faded';
  }
  return { key, discovery, confirm, verdict };
}

export interface CostResult {
  key: string; dates: number;
  /** Share of the top fifth that is new each date (bought), on average. */
  turnover: number;
  /** Top fifth minus the average of the day, per 20 sessions, %p: before and after costs. */
  longGross: { mean: number; lo: number; hi: number };
  longNet: { mean: number; lo: number; hi: number };
  /** Top minus bottom fifth, %p, before and after costs on both sides. */
  spreadGross: { mean: number; lo: number; hi: number };
  spreadNet: { mean: number; lo: number; hi: number };
}

/** `roundTrip` is the cost of buying and later selling, as a fraction (0.0025 = 0.25%). Yes/no signals have no fifths: null. */
export function costCheck(key: string, dates: readonly Dated[], roundTrip = 0.0025, minStocks = 30): CostResult | null {
  let prevTop: Set<string> | null = null, prevBot: Set<string> | null = null;
  const tos: number[] = [], lg: number[] = [], ln: number[] = [], sg: number[] = [], sn: number[] = [];
  for (const d of dates) {
    const rows = d.rows.filter((r) => r.values[key] != null);
    if (rows.length < minStocks) { prevTop = prevBot = null; continue; }
    const v = rows.map((r) => r.values[key]!);
    if (new Set(v).size <= 2) return null;
    const q = quintiles(v);
    const top = rows.filter((_, t) => q[t] === 4), bot = rows.filter((_, t) => q[t] === 0);
    if (!top.length || !bot.length) continue;
    const newShare = (now: Row[], before: Set<string> | null) => (before ? now.filter((r) => !before.has(r.symbol)).length / now.length : 1);
    const toT = newShare(top, prevTop), toB = newShare(bot, prevBot);
    const avg = (xs: Row[]) => (xs.reduce((a, r) => a + r.excess, 0) / xs.length) * 100;
    const t = avg(top), b = avg(bot), c = roundTrip * 100;
    tos.push(toT); lg.push(t); ln.push(t - c * toT); sg.push(t - b); sn.push(t - b - c * (toT + toB));
    prevTop = new Set(top.map((r) => r.symbol)); prevBot = new Set(bot.map((r) => r.symbol));
  }
  if (tos.length < 5) return null;
  const ci = (xs: number[], s: number) => { const m = meanCI(xs, s); return { mean: m.mean, lo: m.lo, hi: m.hi }; };
  return { key, dates: tos.length, turnover: tos.reduce((a, x) => a + x, 0) / tos.length, longGross: ci(lg, 21), longNet: ci(ln, 22), spreadGross: ci(sg, 23), spreadNet: ci(sn, 24) };
}

/**
 * Adds `values[key]`: the weighted sum of the components' within-date ranks (−0.5…0.5, missing = 0). A component's
 * weight on a date is its average IC over the dates before it (negative → 0); until `minPast` dates have passed
 * every component counts the same. 20-session dates do not overlap, so a date's outcome is known by the next.
 */
export function addCombo(dates: readonly Dated[], components: readonly string[], key = 'combo', minPast = 6): { dates: Dated[]; weights: { date: string; w: Record<string, number> }[] } {
  const icSum: Record<string, number> = {}, icN: Record<string, number> = {};
  const out: Dated[] = [], weights: { date: string; w: Record<string, number> }[] = [];
  for (const d of dates) {
    const w: Record<string, number> = {};
    for (const c of components) w[c] = (icN[c] ?? 0) >= minPast ? Math.max(0, icSum[c]! / icN[c]!) : 1;
    const total = components.reduce((a, c) => a + w[c]!, 0);
    const rank: Record<string, Map<string, number>> = {};
    for (const c of components) {
      const rows = d.rows.filter((r) => r.values[c] != null).sort((a, b) => a.values[c]! - b.values[c]!);
      rank[c] = new Map(rows.map((r, k) => [r.symbol, rows.length > 1 ? k / (rows.length - 1) - 0.5 : 0]));
    }
    out.push({ ...d, rows: d.rows.map((r) => ({ ...r, values: { ...r.values, [key]: total > 0 ? components.reduce((a, c) => a + w[c]! * (rank[c]!.get(r.symbol) ?? 0), 0) / total : null } })) });
    weights.push({ date: d.date, w });
    // Only now does this date's outcome join the weights, for the dates after it.
    for (const c of components) {
      const rows = d.rows.filter((r) => r.values[c] != null);
      const ic = rows.length >= 30 ? spearman(rows.map((r) => r.values[c]!), rows.map((r) => r.excess)) : null;
      if (ic !== null) { icSum[c] = (icSum[c] ?? 0) + ic; icN[c] = (icN[c] ?? 0) + 1; }
    }
  }
  return { dates: out, weights };
}
