import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_CAP, applyCalibration, BASE_MODEL, baseUpProb, CALIBRATION_MIN, committeeOdds, fitLogistic, fitPlatt, oddsFeatures, predictOdds, reportBase } from './baseOdds.js';

const flat = (n: number, wiggle: number) => Array.from({ length: n }, (_, i) => ({ high: 100 + wiggle, close: 100 + (i % 2 ? wiggle : -wiggle) }));

test('features need 250 sessions and match the hidden-future signals', () => {
  assert.equal(oddsFeatures(flat(249, 1)), null);
  const f = oddsFeatures([...flat(259, 1), { high: 120, close: 110 }])!;
  assert.ok(f.vol60 > 0);
  assert.ok(Math.abs(f.high52 - 110 / 120) < 1e-12);
  assert.ok(Math.abs(f.max20 - (110 / 99 - 1)) < 1e-12);
});

test('the base falls with volatility and a recent jump, and sits near the ten-year up rate', () => {
  const calm = baseUpProb(flat(260, 0.5))!, wild = baseUpProb(flat(260, 5))!;
  assert.ok(calm > wild);
  const jumped = baseUpProb([...flat(250, 0.5), { high: 130, close: 130 }, ...flat(9, 0.5).map((b) => ({ high: 130, close: b.close + 30 }))])!;
  assert.ok(jumped < calm);
  const mid = predictOdds({ vol60: Math.exp(BASE_MODEL.logVol.mean), high52: BASE_MODEL.high52.mean, max20: BASE_MODEL.max20.mean });
  assert.ok(Math.abs(mid - BASE_MODEL.fitted.upRate) < 0.03);
  assert.equal(reportBase({ kind: 'etf', recentBars: flat(260, 1) }), null);
  assert.equal(reportBase({ exchange: 'NASDAQ', recentBars: flat(260, 1) }), null);
  assert.ok(reportBase({ exchange: 'KOSDAQ', recentBars: flat(260, 1) })! > 0);
});

test('logistic fit recovers a known slope', () => {
  // y = 1 exactly when x > 0, with some overlap: the slope must come out positive and the intercept near 0.
  const X: number[][] = [], y: number[] = [];
  for (let k = -50; k <= 50; k += 1) { X.push([k / 10]); y.push(k > 0 || k === -3 ? 1 : k === 3 ? 0 : k > 0 ? 1 : 0); }
  const [b0, b1] = fitLogistic(X, y);
  assert.ok(b1! > 1);
  assert.ok(Math.abs(b0!) < 0.5);
});

test('only text analysts move the base, halved and capped', () => {
  const calls = [
    { analyst: 'trend_momentum' as const, stance: 'BULLISH' as const, confidence: 95 },
    { analyst: 'mean_reversion' as const, stance: 'BEARISH' as const, confidence: 95 },
  ];
  const chartOnly = committeeOdds(0.43, calls)!;
  assert.deepEqual([chartOnly.upPct, chartOnly.aiPts, chartOnly.textN, chartOnly.n], [43, 0, 0, 2]);
  const news = committeeOdds(0.43, [...calls, { analyst: 'event_catalyst', stance: 'BULLISH', confidence: 64 }])!;
  assert.deepEqual([news.upPct, news.aiPts, news.textN], [50, 7, 1]);
  const loud = committeeOdds(0.43, [{ analyst: 'fundamental', stance: 'BEARISH', confidence: 98 }])!;
  assert.deepEqual([loud.upPct, loud.aiPts], [33, -AI_CAP]);
  // Without a base the old pooled vote stays.
  assert.equal(committeeOdds(null, calls, [], null)!.basePct, null);
  assert.equal(committeeOdds(0.43, []), null);
});

test('the Platt line corrects a biased forecaster and is used only once enough is scored', () => {
  // Says 60% when it happens 40%.
  const pts = Array.from({ length: 400 }, (_, i) => ({ p: 0.6, up: i % 5 < 2 }));
  const c = fitPlatt(pts, 't');
  assert.ok(c.active && c.n === 400 && CALIBRATION_MIN <= 400);
  assert.ok(Math.abs(applyCalibration(0.6, c) - 0.4) < 0.03);
  assert.ok(c.brierFitted! < c.brierSaid!);
  const few = fitPlatt(pts.slice(0, CALIBRATION_MIN - 1), 't');
  assert.equal(few.active, false);
  assert.equal(applyCalibration(0.6, few), 0.6);
  assert.equal(committeeOdds(0.6, [{ analyst: 'fundamental', stance: 'NEUTRAL', confidence: 50 }], [], c)!.upPct, Math.round(applyCalibration(0.6, c) * 100));
});
