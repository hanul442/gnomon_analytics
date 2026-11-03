// G-305: the statistical price range (R1, valuation.ts forecastRanges) checked on ten years of history,
// split by market regime, so a change to it is judged on every kind of market and not on the last one.
// A sample is one stock on one day: the inputs forecastRanges uses (EWMA and 250-day sigma, kept drift) and
// what happened next (the stock's and the KOSPI's log move over the horizon). Candidates turn the inputs into
// a 10–90% band; fitted candidates learn only from the development years (before `cut`), and the years from
// `cut` on are the holdout, opened once for the verdict. Pure; src/cli/evalRange.ts does the files.

export interface RangeSample {
  date: string;
  h: number;
  /** EWMA (λ 0.94) daily sigma and the 250-day sigma at the base date. */
  sigS: number;
  sigL: number;
  /** Daily drift the live range keeps (mean of 120 daily log returns × 0.25). */
  drift: number;
  /** Log move of the stock over the next h sessions (delisted: to its last close). */
  ret: number;
  /** Log move of the KOSPI over the same sessions, and over the 60 before the base date. */
  mkt: number;
  prior60: number;
}

export const Z90 = 1.2815515655446004;
export const HORIZONS = [5, 20, 60, 120] as const;

/** The live method (gnm-forecast-v1): normal band around the kept drift. */
const sigmaV1 = (s: RangeSample) => (s.h <= 20 ? s.sigS : (s.sigS + s.sigL) / 2);
export const bandV1 = (s: RangeSample): [number, number] => {
  const sd = sigmaV1(s) * Math.sqrt(s.h), mu = s.drift * s.h;
  return [mu - Z90 * sd, mu + Z90 * sd];
};

export interface Candidate {
  key: string;
  label: string;
  /** Returns the band maker after seeing the development samples (only those). */
  fit: (dev: readonly RangeSample[]) => (s: RangeSample) => [number, number];
}

export const quantile = (xs: readonly number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo]! + (s[hi]! - s[lo]!) * (i - lo);
};

/** Standardised moves per horizon under a sigma rule; empirical quantiles of them become the band. */
function empirical(sigma: (s: RangeSample) => number, drift: boolean, qLo: number, qHi: number) {
  return (dev: readonly RangeSample[]) => {
    const q = new Map<number, [number, number]>();
    for (const h of HORIZONS) {
      const z = dev.filter((s) => s.h === h).map((s) => (s.ret - (drift ? s.drift * h : 0)) / (sigma(s) * Math.sqrt(h)));
      if (z.length) q.set(h, [quantile(z, qLo), quantile(z, qHi)]);
    }
    return (s: RangeSample): [number, number] => {
      const [a, b] = q.get(s.h) ?? [-Z90, Z90], sd = sigma(s) * Math.sqrt(s.h), mu = drift ? s.drift * s.h : 0;
      return [mu + a * sd, mu + b * sd];
    };
  };
}
const blend = (s: RangeSample) => Math.sqrt(s.sigS * s.sigL);

export const CANDIDATES: Candidate[] = [
  { key: 'v1', label: '지금 방법 (정규분포 ±1.28σ)', fit: () => bandV1 },
  { key: 'emp', label: '실제 분포의 10%·90% (아래·위 따로)', fit: empirical(sigmaV1, true, 0.1, 0.9) },
  { key: 'tail', label: '아래 꼬리만 넓게 (7%·90%)', fit: empirical(sigmaV1, true, 0.07, 0.9) },
  { key: 'blend', label: '단기·장기 변동성 평균 + 실제 분포', fit: empirical(blend, false, 0.1, 0.9) },
];

export type Regime = 'crash' | 'down' | 'flat' | 'up' | 'surge';
export const REGIME_LABEL: Record<Regime, string> = { crash: '급락 (시장 하위 5%)', down: '하락 (5~20%)', flat: '보통 (20~80%)', up: '상승 (80~95%)', surge: '급등 (상위 5%)' };
export const PRIOR_LABEL = { bull: '직전 60일 상승장 (+8% 넘게)', bear: '직전 60일 하락장 (−8% 넘게)', side: '직전 60일 횡보' } as const;

/** Regime of the window that followed, by the KOSPI move's place among all windows of the same horizon. */
export function regimeCuts(samples: readonly RangeSample[]): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (const h of HORIZONS) {
    const m = samples.filter((s) => s.h === h).map((s) => s.mkt);
    if (m.length) out.set(h, [0.05, 0.2, 0.8, 0.95].map((q) => quantile(m, q)));
  }
  return out;
}
export const regimeOf = (s: RangeSample, cuts: Map<number, number[]>): Regime => {
  const c = cuts.get(s.h)!;
  return s.mkt <= c[0]! ? 'crash' : s.mkt <= c[1]! ? 'down' : s.mkt < c[2]! ? 'flat' : s.mkt < c[3]! ? 'up' : 'surge';
};
export const priorOf = (s: RangeSample): keyof typeof PRIOR_LABEL => (s.prior60 > 0.08 ? 'bull' : s.prior60 < -0.08 ? 'bear' : 'side');

export interface Cell { n: number; inside: number; below: number; width: number; score: number }
const ALPHA = 0.2;
/** Coverage, misses below, mean width and the interval score (width plus 10× each miss distance; lower is better). */
export function cell(samples: readonly RangeSample[], band: (s: RangeSample) => [number, number]): Cell {
  let inside = 0, below = 0, width = 0, score = 0;
  for (const s of samples) {
    const [lo, hi] = band(s);
    if (s.ret < lo) below += 1; else if (s.ret <= hi) inside += 1;
    width += hi - lo;
    score += hi - lo + (2 / ALPHA) * Math.max(0, lo - s.ret) + (2 / ALPHA) * Math.max(0, s.ret - hi);
  }
  const n = Math.max(1, samples.length);
  return { n: samples.length, inside: inside / n, below: below / n, width: width / n, score: score / n };
}

export interface CandidateReport {
  key: string; label: string;
  byHorizon: { h: number; all: Cell; dev: Cell; hold: Cell; regimes: Record<Regime, Cell>; prior: Record<keyof typeof PRIOR_LABEL, Cell>; years: Record<string, Cell> }[];
}

export function rangeReport(samples: readonly RangeSample[], cut: string, candidates: readonly Candidate[] = CANDIDATES): CandidateReport[] {
  const dev = samples.filter((s) => s.date < cut), cuts = regimeCuts(samples);
  return candidates.map((c) => {
    const band = c.fit(dev);
    return {
      key: c.key, label: c.label,
      byHorizon: HORIZONS.map((h) => {
        const mine = samples.filter((s) => s.h === h);
        const by = <K extends string>(f: (s: RangeSample) => K) => {
          const g = new Map<K, RangeSample[]>();
          for (const s of mine) { const k = f(s); const xs = g.get(k); if (xs) xs.push(s); else g.set(k, [s]); }
          return Object.fromEntries([...g].map(([k, xs]) => [k, cell(xs, band)])) as Record<K, Cell>;
        };
        return {
          h, all: cell(mine, band), dev: cell(mine.filter((s) => s.date < cut), band), hold: cell(mine.filter((s) => s.date >= cut), band),
          regimes: by((s) => regimeOf(s, cuts)), prior: by(priorOf), years: by((s) => s.date.slice(0, 4)),
        };
      }),
    };
  });
}

/**
 * The bar a new range must clear on the holdout, for every horizon: honest coverage (78–85%), at least the
 * live method's coverage in the crash windows, and an interval score no worse than the live method's.
 */
export function verdict(rep: CandidateReport, base: CandidateReport): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const x of rep.byHorizon) {
    const b = base.byHorizon.find((y) => y.h === x.h)!;
    if (x.hold.inside < 0.78 || x.hold.inside > 0.85) reasons.push(`${x.h}일 적중 ${(x.hold.inside * 100).toFixed(1)}% (78~85% 밖)`);
    if (x.regimes.crash && b.regimes.crash && x.regimes.crash.inside < b.regimes.crash.inside - 0.005) reasons.push(`${x.h}일 급락 구간 ${(x.regimes.crash.inside * 100).toFixed(1)}% (지금 ${(b.regimes.crash.inside * 100).toFixed(1)}%보다 낮음)`);
    if (x.hold.score > b.hold.score * 1.001) reasons.push(`${x.h}일 범위 점수 ${x.hold.score.toFixed(4)} (지금 ${b.hold.score.toFixed(4)}보다 나쁨)`);
  }
  return { pass: reasons.length === 0, reasons };
}
