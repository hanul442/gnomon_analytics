import assert from 'node:assert/strict';
import test from 'node:test';
import { atr, bollinger, fibonacci, footprint, priceLevels, structureBreaks, structureSnapshot, swings, type Bar } from './structure.js';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
/** Bars whose high/low are close ± 1. */
const bars = (closes: readonly number[], volume = 100): Bar[] => closes.map((c, i) => ({ date: day(i), open: c, high: c + 1, low: c - 1, close: c, volume }));

test('swings need three lower bars each side and are dated by their confirming bar', () => {
  const b = bars([10, 11, 12, 15, 12, 11, 10, 11, 12]);
  assert.deepEqual(swings(b), [{ date: day(3), price: 16, type: 'HIGH', confirmedOn: day(6) }]);
});

test('a close above the last swing high is a BOS; breaking the other way flips to CHOCH', () => {
  const b = bars([10, 11, 12, 15, 12, 11, 10, 11, 12, 17, 13, 12, 11, 8, 9, 10, 11, 12, 13, 5]);
  const s = swings(b);
  const breaks = structureBreaks(b, s);
  assert.equal(breaks[0]!.type, 'BOS');
  assert.equal(breaks[0]!.direction, 'BULLISH');
  assert.equal(breaks[0]!.date, day(9));
  const flip = breaks.find((x) => x.direction === 'BEARISH')!;
  assert.equal(flip.type, 'CHOCH');
});

test('fibonacci measures the close against the last leg', () => {
  const pts = [
    { date: day(1), price: 100, type: 'LOW' as const, confirmedOn: day(4) },
    { date: day(5), price: 200, type: 'HIGH' as const, confirmedOn: day(8) },
  ];
  const f = fibonacci(pts, 150)!;
  assert.equal(f.retracement, 0.5);
  assert.equal(f.zone, 'PREFERRED');
  assert.deepEqual(f.levels.map((l) => Math.round(l.price * 10) / 10), [176.4, 161.8, 150, 138.2, 121.4]);
});

test('price levels: nearby swings merge, nearest three each side', () => {
  const pts = [100, 101, 120, 130, 140, 150, 160, 80, 70, 60].map((price, i) => ({ date: day(i), price, type: 'LOW' as const, confirmedOn: day(i + 3) }));
  const levels = priceLevels(pts, 125);
  assert.deepEqual(levels.map((l) => [l.kind, Math.round(l.price * 10) / 10, l.touches]), [
    ['RESISTANCE', 150, 1], ['RESISTANCE', 140, 1], ['RESISTANCE', 130, 1],
    ['SUPPORT', 120, 1], ['SUPPORT', 100.5, 2], ['SUPPORT', 80, 1],
  ]);
});

test('bollinger and ATR on known values', () => {
  const b = bollinger(Array.from({ length: 20 }, (_, i) => (i % 2 ? 11 : 9)))!;
  assert.equal(b.middle, 10);
  assert.equal(b.upper, 12);
  assert.equal(b.lower, 8);
  assert.equal(b.percentB, 0.75);
  // Constant 2-point range, no gaps: ATR is 2.
  assert.equal(atr(bars(Array.from({ length: 30 }, () => 50))), 2);
});

test('footprint: heavy volume closing at the high plus net buying reads as accumulation-like', () => {
  const b = bars(Array.from({ length: 25 }, () => 100), 100);
  b[24] = { date: day(24), open: 98, high: 105, low: 95, close: 105, volume: 400 };
  const flows = Array.from({ length: 5 }, (_, i) => ({ date: day(20 + i), foreignNet: 40, institutionNet: 20 }));
  const f = footprint(b, flows);
  assert.equal(f.state, 'ACCUMULATION_LIKE');
  assert.equal(f.volumeRatio, 4);
  assert.equal(f.closeLocation, 1);
  assert.equal(f.foreignShare5, 25);
  assert.equal(footprint(bars([1, 2, 3]), []).state, 'DATA_GAP');
});

test('snapshot pulls the pieces together', () => {
  const closes = Array.from({ length: 120 }, (_, i) => 100 + 10 * Math.sin(i / 6) + i * 0.2);
  const s = structureSnapshot(bars(closes))!;
  assert.ok(s.swings.length > 4);
  assert.ok(s.levels.length > 0);
  assert.ok(s.bollinger && s.atr14);
  assert.ok(['BULLISH', 'BEARISH', 'NEUTRAL'].includes(s.bias));
});
