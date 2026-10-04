import assert from 'node:assert/strict';
import test from 'node:test';
import { marketPulse, quickCalc } from './quickCalc.js';

const day = (i: number) => new Date(Date.UTC(2025, 9, 1) + i * 86_400_000).toISOString().slice(0, 10);
const series = (n: number, step: number) => Array.from({ length: n }, (_, i) => { const c = 10000 * (1 + step) ** i; return { date: day(i), high: c * 1.01, low: c * 0.99, close: c, volume: 1000 }; });

test('quickCalc: signal, moves, fair value and forecasts from a year of bars, with one line', () => {
  const c = quickCalc('000000', series(250, 0.002), new Date('2026-06-08T09:00:00Z'))!;
  assert.equal(c.signal.level !== null, true);
  assert.equal(c.votes.length, 16);
  assert.deepEqual(c.moves.map((m) => m.days), [5, 20, 120]);
  assert.ok(c.fair && c.fair.low < c.fair.high);
  assert.equal(c.forecasts.length > 0, true);
  assert.match(c.line, /^기술 신호 .+ · 20거래일 \+\d/);
  // Too short a history: the signal is withheld, and the line says so.
  assert.match(quickCalc('000000', series(8, 0.01), new Date())!.line, /보류/);
  assert.equal(quickCalc('000000', [], new Date()), null);
});

test('marketPulse counts stocks by signal level', () => {
  const up = quickCalc('a', series(250, 0.002), new Date())!, down = quickCalc('b', series(250, -0.002), new Date())!;
  const p = marketPulse([up, up, down])!;
  assert.equal(p.counted, 3);
  assert.deepEqual([p.bull, p.bear], [2, 1]);
  assert.equal(Math.round(p.up20! * 3), 2);
  assert.equal(marketPulse([]), null);
});
