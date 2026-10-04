// Technical fair value and forecast ranges (docs/DESIGN.md §5.3, G-11).
// Pure functions. Neither is a company valuation or a probability of profit:
//   - fair value: where recent trading has centred (volume-weighted prices,
//     the 120-day log trend line, the 120-day average), with a band of the
//     usual distance from that trend;
//   - forecast: a lognormal price range per horizon from recent volatility,
//     with a quarter of the recent drift kept (momentum fades).
// Every forecast is logged unchanged and scored once its horizon has passed.

export const VALUATION_METHOD = 'gnm-tech-value-v1';
export const FORECAST_METHOD = 'gnm-forecast-v1';

export interface DailyBar { date: string; high: number; low: number; close: number; volume: number }

export interface FairValueAnchor { key: string; label: string; value: number }

export interface TechnicalFairValue {
  method: typeof VALUATION_METHOD;
  sessionDate: string;
  close: number;
  /** Median of the anchors. */
  center: number;
  low: number;
  high: number;
  /** Close vs center, percent. */
  gapPct: number;
  position: 'ABOVE' | 'INSIDE' | 'BELOW';
  anchors: FairValueAnchor[];
  /** Typical (1 standard deviation) distance from the 120-day trend, percent. */
  bandPct: number;
}

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

function vwap(bars: readonly DailyBar[], n: number): number | null {
  if (bars.length < n) return null;
  let pv = 0, v = 0;
  for (const b of bars.slice(-n)) { const tp = (b.high + b.low + b.close) / 3; pv += tp * b.volume; v += b.volume; }
  return v > 0 ? pv / v : null;
}

/** Least squares of ln(close) on day index; returns the fitted value today and the residual standard deviation. */
export function logTrend(closes: readonly number[]): { fitted: number; residualSd: number; dailySlope: number } | null {
  const n = closes.length;
  if (n < 20) return null;
  const ys = closes.map(Math.log);
  const xMean = (n - 1) / 2, yMean = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0;
  ys.forEach((y, x) => { sxy += (x - xMean) * (y - yMean); sxx += (x - xMean) ** 2; });
  const slope = sxy / sxx, intercept = yMean - slope * xMean;
  const residuals = ys.map((y, x) => y - (intercept + slope * x));
  const residualSd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / (n - 2));
  return { fitted: Math.exp(intercept + slope * (n - 1)), residualSd, dailySlope: slope };
}

export function technicalFairValue(input: readonly DailyBar[]): TechnicalFairValue | null {
  const bars = [...input].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (bars.length < 120) return null;
  const closes = bars.map((b) => b.close);
  const close = closes.at(-1)!;
  const trend = logTrend(closes.slice(-120))!;
  const sma120 = closes.slice(-120).reduce((s, c) => s + c, 0) / 120;
  const anchors: FairValueAnchor[] = [
    { key: 'VWAP20', label: '20일 거래량 가중 평균가', value: vwap(bars, 20) },
    { key: 'VWAP60', label: '60일 거래량 가중 평균가', value: vwap(bars, 60) },
    { key: 'TREND120', label: '120일 추세선', value: trend.fitted },
    { key: 'SMA120', label: '120일 평균가', value: sma120 },
  ].filter((a): a is FairValueAnchor => a.value !== null && Number.isFinite(a.value));
  const center = median(anchors.map((a) => a.value));
  const band = trend.residualSd;
  const low = center * Math.exp(-band), high = center * Math.exp(band);
  return {
    method: VALUATION_METHOD, sessionDate: bars.at(-1)!.date, close, center, low, high,
    gapPct: (close / center - 1) * 100,
    position: close > high ? 'ABOVE' : close < low ? 'BELOW' : 'INSIDE',
    anchors, bandPct: band * 100,
  };
}

// ---- forecast ----

export const FORECAST_HORIZONS = [5, 20, 60, 120] as const;
/** z for the 10th / 90th percentile of a normal distribution. */
const Z90 = 1.2815515655446004;
const DRIFT_KEPT = 0.25;
const EWMA_LAMBDA = 0.94;

export interface PriceForecast {
  method: typeof FORECAST_METHOD;
  symbol: string;
  /** Session the forecast starts from (its close is the base). */
  baseDate: string;
  baseClose: number;
  /** Trading days ahead. */
  horizon: number;
  p10: number;
  p50: number;
  p90: number;
  /** Daily log-return volatility and drift used. */
  sigma: number;
  drift: number;
  /** When the report that made it was generated (ISO). */
  madeAt: string;
}

/**
 * Lognormal ranges. Volatility: EWMA (λ=0.94) for horizons up to 20 days; for
 * longer ones, the average of EWMA and the 250-day standard deviation (calm or
 * wild weeks should not dominate a half-year range). Drift: a quarter of the
 * mean daily log return of the last 120 sessions.
 */
export function forecastRanges(symbol: string, input: readonly DailyBar[], madeAt: Date): PriceForecast[] {
  const bars = [...input].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (bars.length < 121) return [];
  const rets = bars.slice(1).map((b, i) => Math.log(b.close / bars[i]!.close));
  let variance = rets.slice(0, 20).reduce((s, r) => s + r * r, 0) / 20;
  for (const r of rets.slice(20)) variance = EWMA_LAMBDA * variance + (1 - EWMA_LAMBDA) * r * r;
  const sigmaShort = Math.sqrt(variance);
  const longRets = rets.slice(-250);
  const mean = longRets.reduce((s, r) => s + r, 0) / longRets.length;
  const sigmaLong = Math.sqrt(longRets.reduce((s, r) => s + (r - mean) ** 2, 0) / (longRets.length - 1));
  const recent = rets.slice(-120);
  const drift = (recent.reduce((s, r) => s + r, 0) / recent.length) * DRIFT_KEPT;
  const base = bars.at(-1)!;
  return FORECAST_HORIZONS.map((h) => {
    const sigma = h <= 20 ? sigmaShort : (sigmaShort + sigmaLong) / 2;
    const mu = drift * h, spread = Z90 * sigma * Math.sqrt(h);
    return {
      method: FORECAST_METHOD, symbol, baseDate: base.date, baseClose: base.close, horizon: h,
      p10: base.close * Math.exp(mu - spread), p50: base.close * Math.exp(mu), p90: base.close * Math.exp(mu + spread),
      sigma, drift, madeAt: madeAt.toISOString(),
    };
  });
}

export const forecastKey = (f: PriceForecast) => `${f.symbol}:${f.method}:${f.baseDate}:${f.horizon}`;

export interface ScoredForecast extends PriceForecast {
  targetDate: string;
  actual: number;
  inside: boolean;
  /** Actual vs p50, percent. */
  errorPct: number;
}

export interface ForecastScore {
  horizon: number;
  scored: number;
  /** Share of outcomes inside p10–p90; about 80% if the ranges are honest. */
  coverage: number | null;
  /** Median absolute error of p50, percent. */
  medianAbsErrorPct: number | null;
  latest: ScoredForecast[];
}

/** Scores every logged forecast whose horizon has passed, using only bars known now. */
export function scoreForecasts(logged: readonly PriceForecast[], input: readonly DailyBar[]): ForecastScore[] {
  const bars = [...input].sort((a, b) => (a.date < b.date ? -1 : 1));
  const indexOf = new Map(bars.map((b, i) => [b.date, i]));
  const scored: ScoredForecast[] = [];
  for (const f of logged) {
    const i = indexOf.get(f.baseDate);
    const target = i === undefined ? undefined : bars[i + f.horizon];
    if (!target) continue;
    scored.push({ ...f, targetDate: target.date, actual: target.close, inside: target.close >= f.p10 && target.close <= f.p90, errorPct: (target.close / f.p50 - 1) * 100 });
  }
  return FORECAST_HORIZONS.map((h) => {
    const mine = scored.filter((s) => s.horizon === h).sort((a, b) => (a.baseDate < b.baseDate ? -1 : 1));
    return {
      horizon: h, scored: mine.length,
      coverage: mine.length ? mine.filter((s) => s.inside).length / mine.length : null,
      medianAbsErrorPct: mine.length ? median(mine.map((s) => Math.abs(s.errorPct))) : null,
      latest: mine.slice(-5),
    };
  });
}
