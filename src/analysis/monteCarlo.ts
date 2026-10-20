// G-275: "is this result skill, or could luck give it?" Monte Carlo checks for the hidden-future evaluation.
//
// Every result there is a per-date number (a rank correlation, a top-minus-bottom spread, a Brier gap) averaged
// over evaluation dates 20 sessions apart. Two ways to make fake, skill-free versions of it:
//
// 1. Shuffle (permutation): on each date, hand the predictions to the day's stocks at random and recompute.
//    It keeps each day's spread of predictions and outcomes and removes only the link between them.
// 2. Block bootstrap: centre the per-date series on zero (no skill on average), then rebuild whole runs of it
//    by gluing random blocks of consecutive dates. Markets run in streaks (a factor works for months, then
//    stops), so dates are not independent; blocks keep those streaks, which a plain shuffle of dates would
//    break and so make luck look too rare.
//
// The shuffle alone is too easy to pass when per-date results are correlated over time, so the verdict uses
// the larger (stricter) of the two p-values. Internal methodology only; never advertising.

import { rng } from './evalPanel.js';

export interface LuckTest {
  /** Observed mean of the per-date statistic. */
  mean: number;
  dates: number;
  /** Two-sided p-value from the per-date shuffle (doubled one-sided; null when no shuffle was given). */
  pShuffle: number | null;
  /** Two-sided p-value from the centred circular block bootstrap. */
  pBlock: number;
  /** Block-bootstrap 95% interval of the mean. */
  lo: number; hi: number;
  /** Where the observed mean falls among the skill-free block-bootstrap means (0–100). */
  percentile: number;
  block: number; reps: number;
  /** max(pShuffle, pBlock). */
  p: number;
}

const mean = (xs: readonly number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

/** Means of `reps` circular block resamples of `xs` (each the same length as xs). Pure given the seed. */
export function blockMeans(xs: readonly number[], block: number, reps: number, seed: number): number[] {
  const n = xs.length, r = rng(seed), out: number[] = [];
  const L = Math.max(1, Math.min(block, n));
  for (let k = 0; k < reps; k += 1) {
    let s = 0, filled = 0;
    while (filled < n) {
      const start = Math.floor(r() * n);
      for (let j = 0; j < L && filled < n; j += 1, filled += 1) s += xs[(start + j) % n]!;
    }
    out.push(s / n);
  }
  return out;
}

/**
 * Block-bootstrap test that the per-date mean is zero, plus an optional shuffle null: `shuffled(seed)` returns
 * the same per-date series recomputed with that day's predictions handed out at random.
 */
export function luckTest(perDate: readonly number[], opts: { block?: number; reps?: number; seed?: number; shuffled?: (seed: number) => readonly number[]; shuffleReps?: number } = {}): LuckTest | null {
  const xs = perDate.filter((x) => Number.isFinite(x));
  if (xs.length < 10) return null;
  const block = opts.block ?? 6, reps = opts.reps ?? 4000, seed = opts.seed ?? 17;
  const m = mean(xs), centred = xs.map((x) => x - m);
  const nulls = blockMeans(centred, block, reps, seed);
  const pBlock = (1 + nulls.filter((x) => Math.abs(x) >= Math.abs(m)).length) / (reps + 1);
  const percentile = (nulls.filter((x) => x < m).length / reps) * 100;
  const boots = blockMeans(xs, block, reps, seed + 1).sort((a, b) => a - b);
  let pShuffle: number | null = null;
  if (opts.shuffled) {
    const sr = opts.shuffleReps ?? 1000;
    let hit = 0;
    // One-sided in the observed direction, doubled: a fake's mean need not centre on zero (a shuffled
    // probability still has a Brier score, just a worse one), so |fake| ≥ |real| would count the wrong tail.
    const dir = m >= 0 ? 1 : -1;
    for (let k = 0; k < sr; k += 1) { const ys = opts.shuffled(seed + 100 + k).filter((x) => Number.isFinite(x)); if (ys.length && dir * mean(ys) >= dir * m) hit += 1; }
    pShuffle = Math.min(1, (2 * (1 + hit)) / (sr + 1));
  }
  return { mean: m, dates: xs.length, pShuffle, pBlock, lo: boots[Math.floor(0.025 * reps)]!, hi: boots[Math.floor(0.975 * reps)]!, percentile, block, reps, p: Math.max(pShuffle ?? 0, pBlock) };
}

/** Fisher–Yates shuffle of a copy, from a seeded generator. */
export function shuffle<T>(xs: readonly T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** Plain-words verdict for the docs: p below 0.01 / 0.05, or not distinguishable from luck. */
export function luckVerdict(t: LuckTest | null): string {
  if (!t) return '자료 부족';
  return t.p < 0.01 ? '운으로 보기 어려움 (p<0.01)' : t.p < 0.05 ? '운일 가능성 낮음 (p<0.05)' : '운과 구분 안 됨';
}

/**
 * How many of `k` independent skill-free tests would pass p < `alpha` by luck alone (k·alpha), and the
 * Holm-adjusted pass/fail for each p. Many signals were tried, so a single p < 0.05 means little on its own.
 */
export function holm(ps: readonly number[], alpha = 0.05): boolean[] {
  const order = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]);
  const pass = new Array<boolean>(ps.length).fill(false);
  for (let k = 0; k < order.length; k += 1) { if (order[k]![0] <= alpha / (order.length - k)) pass[order[k]![1]] = true; else break; }
  return pass;
}
