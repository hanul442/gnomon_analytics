// The committee's one number, rebuilt (G-264). The hidden-future test (docs/BLIND_EVAL.md) and the papers in
// "AI 위원 예측 개선 자료 조사" (2026-10-19) say the same thing: language models are weak at turning chart numbers
// into a direction (Tan et al., NeurIPS 2024; FINSABER, Li et al. 2025) and tend to extrapolate recent returns
// (Chen, Green, Gulen & Zhou 2024), while they read text well (Lopez-Lira & Tang; Chen, Kelly & Xiu). So:
//   1. the base chance that the price is higher in 20 sessions comes from a small statistical model fitted on ten
//      years of Korean stocks (60-session volatility and the 52-week-high position, the two factors that held up);
//   2. only the analysts who read text (earnings, filings, news) may move it, by at most AI_CAP points, and
//      their lean is halved until their record shows skill;
//   3. once enough committee numbers are scored, one Platt line (a + b·logit p) refitted on them corrects what
//      is left (Platt 1999; for LLM forecasts, e.g. the AIA Forecaster report 2025).
// Pure.

import { committeeConsensus, type AnalystId, type AnalystScore } from './analysts.js';

export interface OddsBar { high: number; close: number }

/** The model's inputs, defined exactly as the hidden-future signals (src/analysis/evalPanel.ts). Null without 250 sessions. */
export interface OddsFeatures { vol60: number; high52: number; max20: number }
export function oddsFeatures(bars: readonly OddsBar[]): OddsFeatures | null {
  if (bars.length < 250) return null;
  const i = bars.length - 1;
  let a = 0, b = 0;
  for (let k = i - 59; k <= i; k += 1) { const r = Math.log(bars[k]!.close / bars[k - 1]!.close); a += r; b += r * r; }
  const vol60 = Math.sqrt(Math.max(0, b / 60 - (a / 60) ** 2));
  let h = 0; for (let k = i - 249; k <= i; k += 1) h = Math.max(h, bars[k]!.high);
  const high52 = h > 0 ? bars[i]!.close / h : NaN;
  let max20 = -Infinity; for (let k = i - 19; k <= i; k += 1) max20 = Math.max(max20, bars[k]!.close / bars[k - 1]!.close - 1);
  return Number.isFinite(vol60) && Number.isFinite(high52) && Number.isFinite(max20) && vol60 > 0 ? { vol60, high52, max20 } : null;
}

export interface OddsModel {
  method: string;
  /** Inputs are standardized: x = (log vol60 − mean) / sd, y = (high52 − mean) / sd, m = (max20 − mean) / sd. */
  logVol: { mean: number; sd: number }; high52: { mean: number; sd: number }; max20: { mean: number; sd: number };
  /** logit P(higher in 20 sessions) = b0 + b1·x + b2·y + b3·m. */
  b: [number, number, number, number];
  /** What the fit was checked on, for the page and the docs. */
  fitted: { from: string; to: string; n: number; upRate: number; brier: number; brierBase: number; confirmFrom: string; confirmBrier: number; confirmBrierBase: number };
}

/**
 * G-264: fitted by src/cli/evalBase.ts on 2016–2026 (each evaluation day's 200 most-traded stocks, delisted
 * included; data/eval/base-2026-10-20.md). Fitted on 2016–2022 alone it beat the constant base rate on 2023–2026
 * too (Brier 0.2471 vs 0.2487): small, because the market's direction decides most of a stock's direction, but
 * the AI's own beat-the-market chances were worse than the base rate. Higher volatility and a bigger one-day
 * jump in the last 20 sessions lower the chance; the 52-week-high position barely moves it in absolute terms.
 */
export const BASE_MODEL: OddsModel = {
  method: 'gnm-base-v1',
  logVol: { mean: -3.304, sd: 0.5254 }, high52: { mean: 0.7028, sd: 0.1833 }, max20: { mean: 0.0958, sd: 0.078 },
  b: [-0.2853, -0.0838, 0.0156, -0.1011],
  fitted: { from: '2016-01-04', to: '2026-09-09', n: 26400, upRate: 0.4297, brier: 0.24337, brierBase: 0.24506, confirmFrom: '2023-01-01', confirmBrier: 0.24705, confirmBrierBase: 0.24873 },
};

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function predictOdds(f: OddsFeatures, m: OddsModel = BASE_MODEL): number {
  const z = (v: number, s: { mean: number; sd: number }) => clamp((v - s.mean) / s.sd, -4, 4);
  return sigmoid(m.b[0] + m.b[1] * z(Math.log(f.vol60), m.logVol) + m.b[2] * z(f.high52, m.high52) + m.b[3] * z(f.max20, m.max20));
}

/** The statistical base chance (0–1) for a Korean stock's bars, or null (too short, or not a stock the model was fitted on). */
export function baseUpProb(bars: readonly OddsBar[] | undefined, m: OddsModel = BASE_MODEL): number | null {
  const f = bars ? oddsFeatures(bars) : null;
  return f ? predictOdds(f, m) : null;
}

/** G-264: the base model was fitted on Korean listed stocks; ETFs, coins and US stocks have none (they keep the pooled vote). */
export const reportBase = (r: { kind?: string; currency?: string; exchange?: string; recentBars?: readonly OddsBar[] }) =>
  !r.kind && !r.currency && (r.exchange === 'KOSPI' || r.exchange === 'KOSDAQ' || !r.exchange) ? baseUpProb(r.recentBars) : null;

/**
 * Logistic regression by Newton's method with a small ridge on the slopes (not the intercept). Rows are
 * [x1, x2, …]; returns [b0, b1, …]. Deterministic.
 */
export function fitLogistic(X: readonly (readonly number[])[], y: readonly number[], ridge = 1e-3, iters = 50): number[] {
  const k = (X[0]?.length ?? 0) + 1, n = X.length;
  const b = new Array<number>(k).fill(0);
  for (let it = 0; it < iters; it += 1) {
    const g = new Array<number>(k).fill(0), H = Array.from({ length: k }, () => new Array<number>(k).fill(0));
    for (let r = 0; r < n; r += 1) {
      const z = [1, ...X[r]!];
      const p = sigmoid(z.reduce((s, v, j) => s + v * b[j]!, 0)), w = p * (1 - p);
      for (let j = 0; j < k; j += 1) { g[j]! += (y[r]! - p) * z[j]!; for (let l = 0; l < k; l += 1) H[j]![l]! += w * z[j]! * z[l]!; }
    }
    for (let j = 1; j < k; j += 1) { g[j]! -= ridge * n * b[j]!; H[j]![j]! += ridge * n; }
    const step = solve(H, g);
    let moved = 0;
    for (let j = 0; j < k; j += 1) { b[j]! += step[j]!; moved = Math.max(moved, Math.abs(step[j]!)); }
    if (moved < 1e-9) break;
  }
  return b;
}

/** Gaussian elimination with partial pivoting (small systems only). */
function solve(A: number[][], v: number[]): number[] {
  const n = v.length, M = A.map((row, i) => [...row, v[i]!]);
  for (let c = 0; c < n; c += 1) {
    let p = c; for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    [M[c], M[p]] = [M[p]!, M[c]!];
    const d = M[c]![c]!; if (Math.abs(d) < 1e-12) return new Array<number>(n).fill(0);
    for (let r = 0; r < n; r += 1) { if (r === c) continue; const f = M[r]![c]! / d; for (let j = c; j <= n; j += 1) M[r]![j]! -= f * M[c]![j]!; }
  }
  return M.map((row, i) => row[n]! / row[i]!);
}

// ---------- recalibration ----------

/** Below this many scored committee numbers the Platt line is not used (it would fit noise). */
export const CALIBRATION_MIN = 200;

export interface Calibration {
  method: 'platt-v1';
  /** p' = sigmoid(a + b·logit p). Identity is a = 0, b = 1. */
  a: number; b: number;
  /** Scored committee numbers behind it, and whether that is enough to use it. */
  n: number; active: boolean;
  /** Brier of the numbers as said, after the line (in-sample), of the base alone, and of always 50%. */
  brierSaid: number | null; brierFitted: number | null; brierBase: number | null;
  /** Average said vs how often the price was higher. */
  saidPct: number | null; happenedPct: number | null;
  madeAt: string;
}

export const IDENTITY: Calibration = { method: 'platt-v1', a: 0, b: 1, n: 0, active: false, brierSaid: null, brierFitted: null, brierBase: null, saidPct: null, happenedPct: null, madeAt: '' };

/**
 * Fits the Platt line on scored (said chance, outcome) pairs. The slope is pulled toward 1 and the intercept
 * toward 0 by a ridge of `prior` (about twenty observations' worth), so a thin record barely moves it.
 */
export function fitPlatt(points: readonly { p: number; up: boolean; base?: number | null }[], madeAt: string, prior = 5): Calibration {
  const pts = points.filter((x) => Number.isFinite(x.p));
  const n = pts.length;
  if (!n) return { ...IDENTITY, madeAt };
  const z = pts.map((x) => logit(clamp(x.p, 0.02, 0.98))), y = pts.map((x) => (x.up ? 1 : 0));
  let a = 0, b = 1;
  for (let it = 0; it < 50; it += 1) {
    let ga = -prior * a, gb = -prior * (b - 1), haa = prior, hab = 0, hbb = prior;
    for (let r = 0; r < n; r += 1) {
      const p = sigmoid(a + b * z[r]!), w = p * (1 - p), e = y[r]! - p;
      ga += e; gb += e * z[r]!; haa += w; hab += w * z[r]!; hbb += w * z[r]! * z[r]!;
    }
    const det = haa * hbb - hab * hab; if (Math.abs(det) < 1e-12) break;
    const da = (hbb * ga - hab * gb) / det, db = (haa * gb - hab * ga) / det;
    a += da; b += db;
    if (Math.abs(da) + Math.abs(db) < 1e-10) break;
  }
  const brier = (f: (r: number) => number) => pts.reduce((s, _, r) => s + (f(r) - y[r]!) ** 2, 0) / n;
  const withBase = pts.filter((x) => x.base != null);
  return {
    method: 'platt-v1', a, b, n, active: n >= CALIBRATION_MIN,
    brierSaid: brier((r) => pts[r]!.p), brierFitted: brier((r) => sigmoid(a + b * z[r]!)),
    brierBase: withBase.length === n ? brier((r) => pts[r]!.base!) : null,
    saidPct: (pts.reduce((s, x) => s + x.p, 0) / n) * 100, happenedPct: (y.reduce((s: number, v) => s + v, 0) / n) * 100, madeAt,
  };
}

export const applyCalibration = (p: number, c: Calibration | null | undefined) => (c?.active ? sigmoid(c.a + c.b * logit(clamp(p, 0.02, 0.98))) : p);

// ---------- the committee number ----------

/** The analysts whose lenses are text: earnings and valuation, filings and news. Chart analysts are covered by the base. */
export const TEXT_ANALYSTS: readonly AnalystId[] = ['fundamental', 'event_catalyst'];
/** Most the text analysts may move the base, percentage points. */
export const AI_CAP = 10;
/** Their lean counts half until an analyst's live record weighs it (committeeConsensus's skill weights). */
export const AI_SHRINK = 0.5;

export interface CommitteeOdds {
  /** Final chance the price is higher in 20 sessions, whole percent. */
  upPct: number;
  /** The statistical base, whole percent, or null (the old pooled vote is used). */
  basePct: number | null;
  /** What the text analysts added, percentage points (after the cap). */
  aiPts: number;
  /** Text analysts that moved it, and analysts in all. */
  textN: number; n: number;
  calibrated: boolean; weighted: boolean; prior: boolean;
}

type Call = { analyst: AnalystId; stance: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; confidence: number };

/**
 * G-264: base chance from the model, moved by the text analysts' pooled lean (halved, capped at ±AI_CAP),
 * then the Platt line when it is active. Without a base (an ETF, a coin, a US stock, a short history) it falls
 * back to every analyst's pooled vote (committeeConsensus), as before. Null without calls.
 */
export function committeeOdds(
  base: number | null,
  calls: readonly Call[],
  board: readonly Pick<AnalystScore, 'analyst' | 'scored' | 'brier'>[] = [],
  calibration?: Calibration | null,
): CommitteeOdds | null {
  if (!calls.length) return null;
  if (base == null) {
    const k = committeeConsensus(calls, board)!;
    return { upPct: k.upPct, basePct: null, aiPts: 0, textN: 0, n: k.n, calibrated: false, weighted: k.weighted, prior: k.prior };
  }
  const text = calls.filter((c) => TEXT_ANALYSTS.includes(c.analyst));
  const k = text.length ? committeeConsensus(text, board, {}) : null;
  const aiPts = k ? clamp(AI_SHRINK * (k.upPct - 50), -AI_CAP, AI_CAP) : 0;
  const said = clamp(base + aiPts / 100, 0.05, 0.95);
  const final = applyCalibration(said, calibration);
  return { upPct: Math.round(final * 100), basePct: Math.round(base * 100), aiPts: Math.round(aiPts), textN: text.length, n: calls.length, calibrated: !!calibration?.active, weighted: !!k?.weighted, prior: false };
}

/** The said chance before the Platt line (0–1), for logging and refitting. */
export function saidOdds(base: number, calls: readonly Call[], board: readonly Pick<AnalystScore, 'analyst' | 'scored' | 'brier'>[] = []): number {
  const text = calls.filter((c) => TEXT_ANALYSTS.includes(c.analyst));
  const k = text.length ? committeeConsensus(text, board, {}) : null;
  return clamp(base + (k ? clamp(AI_SHRINK * (k.upPct - 50), -AI_CAP, AI_CAP) : 0) / 100, 0.05, 0.95);
}

// ---------- where a stock sits among the most-traded (G-268) ----------

/**
 * Fifths of the base score over ten years of each day's 200 most-traded stocks (cut points of the shipped model),
 * and how each fifth did out of sample: the 2016–2022 model's fifths on 2023–2026, the 20-session return against
 * that day's average (data/eval/base-2026-10-20.md §3). Ranking against other stocks held up far better than
 * calling a direction, so the page leads with this. The lowest fifth (high volatility, a recent jump) is the clear one.
 */
export const BASE_FIFTH_CUTS = [0.398, 0.425, 0.445, 0.466] as const;
export const BASE_FIFTHS = [
  { label: '가장 낮음', beatPct: 35.6, excessPct: -1.95 },
  { label: '낮음', beatPct: 42.1, excessPct: 1.03 },
  { label: '중간', beatPct: 44.0, excessPct: 0.7 },
  { label: '높음', beatPct: 45.1, excessPct: 0.33 },
  { label: '가장 높음', beatPct: 46.8, excessPct: 0.45 },
] as const;

export function basePosition(base: number): { fifth: number; label: string; beatPct: number; excessPct: number } {
  const fifth = BASE_FIFTH_CUTS.filter((c) => base > c).length;
  return { fifth, ...BASE_FIFTHS[fifth]! };
}
