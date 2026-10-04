import assert from 'node:assert/strict';
import test from 'node:test';
import { forecastRanges, logTrend, scoreForecasts, technicalFairValue, type DailyBar } from './valuation.js';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
const series = (closes: readonly number[], volume = 1000): DailyBar[] => closes.map((c, i) => ({ date: day(i), high: c, low: c, close: c, volume }));
const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);

test('log trend of exact 1% daily growth: fitted = last close, no residual', () => {
  const closes = Array.from({ length: 120 }, (_, i) => 100 * 1.01 ** i);
  const t = logTrend(closes)!;
  near(t.fitted, closes.at(-1)!);
  near(t.dailySlope, Math.log(1.01));
  assert.ok(t.residualSd < 1e-9);
});

test('fair value: median of anchors; flat price sits inside its band', () => {
  const flat = technicalFairValue(series(Array.from({ length: 150 }, () => 1000)))!;
  near(flat.center, 1000);
  assert.equal(flat.position, 'INSIDE');
  assert.equal(flat.anchors.length, 4);
  // A late spike puts the close above the band.
  const spike = technicalFairValue(series([...Array.from({ length: 149 }, (_, i) => 1000 + (i % 2 ? 5 : -5)), 1300]))!;
  assert.equal(spike.position, 'ABOVE');
  assert.ok(spike.gapPct > 25);
  assert.equal(technicalFairValue(series([1, 2, 3])), null);
});

test('forecast: the median keeps a quarter of the recent drift', () => {
  const closes = Array.from({ length: 200 }, (_, i) => 100 * 1.01 ** i);
  const f = forecastRanges('X', series(closes), new Date('2026-10-02T09:30:00Z'));
  assert.deepEqual(f.map((x) => x.horizon), [5, 20, 60, 120]);
  for (const x of f) {
    near(x.p50, closes.at(-1)! * Math.exp(0.25 * Math.log(1.01) * x.horizon));
    // EWMA uses raw squared returns (RiskMetrics), so steady growth still counts as movement.
    near(x.p50 / x.p10, x.p90 / x.p50);
  }
});

test('forecast: ranges widen with the horizon and with volatility', () => {
  const closes = Array.from({ length: 250 }, (_, i) => 1000 * (1 + 0.03 * Math.sin(i)));
  const f = forecastRanges('X', series(closes), new Date());
  const width = (x: typeof f[number]) => x.p90 / x.p10;
  assert.ok(width(f[0]!) < width(f[1]!) && width(f[1]!) < width(f[3]!));
  assert.ok(f.every((x) => x.p10 < x.p50 && x.p50 < x.p90));
});

test('scoring uses the close h sessions after the base and reports coverage', () => {
  const bars = series([100, 101, 102, 103, 104, 105, 106]);
  const base = { method: 'gnm-forecast-v1' as const, symbol: 'X', baseClose: 100, sigma: 0, drift: 0, madeAt: '' };
  const logged = [
    { ...base, baseDate: day(0), horizon: 5, p10: 95, p50: 100, p90: 104 }, // actual 105: outside
    { ...base, baseDate: day(1), horizon: 5, p10: 100, p50: 105, p90: 110 }, // actual 106: inside
    { ...base, baseDate: day(2), horizon: 5, p10: 100, p50: 105, p90: 110 }, // not due yet
  ];
  const five = scoreForecasts(logged, bars).find((s) => s.horizon === 5)!;
  assert.equal(five.scored, 2);
  assert.equal(five.coverage, 0.5);
  assert.equal(five.latest[0]!.actual, 105);
  assert.equal(five.latest[0]!.targetDate, day(5));
  near(five.medianAbsErrorPct!, (5 + Math.abs(106 / 105 - 1) * 100) / 2);
});
