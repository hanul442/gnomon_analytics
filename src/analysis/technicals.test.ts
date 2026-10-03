import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cci, ema, horizonMomentum, levelOf, macd, momentum, rsi, sma, stochastic, summarizeTechnicals, technicalReason, williamsR,
  type OhlcBar,
} from './technicals.js';

const close = (a: number | null | undefined, b: number, tol = 0.01) => assert.ok(a != null && Math.abs(a - b) <= tol, `${a} ≈ ${b}`);

// StockCharts' sheet rounds the first average gain/loss, which shifts its
// published values by ~0.07; unrounded Wilder RSI must stay within 0.1.
test('RSI matches the published Wilder example (StockCharts)', () => {
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
  const r = rsi(closes, 14);
  assert.equal(r[13], null);
  close(r[14], 70.53, 0.1);
  close(r[15], 66.32, 0.1);
  close(r[16], 66.55, 0.1);
  close(r[17], 69.41, 0.1);
  close(r[18], 66.36, 0.1);
  close(r[19], 57.97, 0.1);
});

test('SMA and EMA', () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  // EMA(3): seed SMA(1,2,3)=2, k=0.5 → 3, 4
  assert.deepEqual(ema([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  const e = ema([10, 10, 10, 13], 3);
  close(e[3], 11.5);
});

test('MACD of a flat series is zero; of a rising series is positive', () => {
  const flat = macd(Array(60).fill(100));
  close(flat.macd.at(-1), 0);
  close(flat.signal.at(-1), 0);
  assert.equal(flat.signal[32], null);
  assert.notEqual(flat.signal[33], null);
  const up = macd(Array.from({ length: 60 }, (_, i) => 100 + i));
  assert.ok(up.macd.at(-1)! > 0);
});

test('stochastic, Williams %R, CCI and momentum on a hand-checked window', () => {
  const bars: OhlcBar[] = [
    { date: 'd1', high: 10, low: 0, close: 5 },
    { date: 'd2', high: 10, low: 0, close: 10 },
    { date: 'd3', high: 10, low: 0, close: 0 },
  ];
  const st = stochastic(bars, 3, 1, 1);
  assert.deepEqual(st.k, [null, null, 0]);
  assert.deepEqual(williamsR(bars, 3), [null, null, -100]);
  // typical prices 5, 6.67, 3.33 → mean 5, MAD 1.11; CCI = (3.33-5)/(0.015*1.11) = -100
  close(cci(bars, 3)[2], -100, 0.1);
  assert.deepEqual(momentum([1, 2, 4, 7], 2), [null, null, 3, 5]);
});

test('seven levels', () => {
  assert.deepEqual([-1, -0.6, -0.5, -0.3, -0.2, -0.1, 0, 0.09, 0.1, 0.29, 0.3, 0.59, 0.6, 1].map(levelOf), [
    'STRONG_BEARISH', 'STRONG_BEARISH', 'BEARISH', 'BEARISH', 'SLIGHTLY_BEARISH', 'SLIGHTLY_BEARISH', 'NEUTRAL', 'NEUTRAL',
    'SLIGHTLY_BULLISH', 'SLIGHTLY_BULLISH', 'BULLISH', 'BULLISH', 'STRONG_BULLISH', 'STRONG_BULLISH',
  ]);
});

function series(closes: number[]): OhlcBar[] {
  return closes.map((c, i) => ({ date: `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, high: c * 1.01, low: c * 0.99, close: c }));
}

test('a steady uptrend reads bullish on moving averages', () => {
  const s = summarizeTechnicals(series(Array.from({ length: 150 }, (_, i) => 100 + i)));
  assert.equal(s.withheld, false);
  assert.equal(s.maScore, 1);
  // A perfectly steady climb: flat RSI, momentum and MACD-on-signal are neutral, not bearish.
  for (const key of ['RSI14', 'MOM10', 'MACD']) assert.equal(s.votes.find((v) => v.key === key)?.vote, 'NEUTRAL', key);
  assert.ok(s.score! > 0);
  assert.equal(s.counts.abstained, 0);
  assert.match(technicalReason(s), /이동평균 10개 중 10개보다 위/);
});

test('too little history withholds the call instead of guessing', () => {
  const s = summarizeTechnicals(series([100, 101, 102, 101, 103, 104, 102, 105, 106, 104]));
  assert.equal(s.withheld, true);
  assert.equal(s.score, null);
  assert.equal(s.label, '판단 보류');
  assert.match(technicalReason(s), /판단을 보류해요/);
});

test('horizon momentum with thresholds', () => {
  const bars = Array.from({ length: 130 }, (_, i) => ({ date: `d${String(i).padStart(3, '0')}`, close: 100 }));
  bars[129] = { date: 'd129', close: 103 };
  const m = horizonMomentum(bars);
  assert.deepEqual(m.map((h) => h.trend), ['UP', 'FLAT', 'FLAT']);
  assert.equal(horizonMomentum(bars.slice(0, 10))[2]?.trend, null);
});

test('falling oscillators vote bearish, flat ones neutral', () => {
  const up = Array.from({ length: 150 }, (_, i) => 100 + i);
  const peaked = [...up, 247, 240, 232];
  const s = summarizeTechnicals(series(peaked));
  assert.equal(s.votes.find((v) => v.key === 'MOM10')?.vote, 'BEARISH');
  assert.equal(s.votes.find((v) => v.key === 'MACD')?.vote, 'BEARISH');
});
