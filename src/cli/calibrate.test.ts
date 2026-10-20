import assert from 'node:assert/strict';
import test from 'node:test';
import type { AnalystCall } from '../analysis/analysts.js';
import { scoredOdds } from './calibrate.js';
import type { PriceBar } from '../types.js';

test('each past committee is rebuilt from its logged calls and scored 20 sessions on', () => {
  const day = (i: number) => new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
  const bars: PriceBar[] = Array.from({ length: 300 }, (_, i) => ({ symbol: 'X', date: day(i), open: 100, high: 102, low: 98, close: 100 + (i % 4), volume: 1, source: 't', retrievedAt: '' }));
  const call = (analyst: AnalystCall['analyst'], base: number, confidence: number): AnalystCall => ({ symbol: 'X', analyst, reportDate: day(base + 1), baseDate: day(base), baseClose: bars[base]!.close, stance: 'BULLISH', confidence, target: 110, promptVersion: 't', madeAt: '' });
  const out = scoredOdds([call('fundamental', 260, 70), call('trend_momentum', 260, 90), call('fundamental', 100, 70), call('fundamental', 290, 70)], bars);
  // Day 100 has too little history, day 290 is not due yet.
  assert.equal(out.length, 1);
  assert.ok(Math.abs(out[0]!.p - (out[0]!.base + 0.1)) < 1e-9); // the text analyst's +20 halved
  assert.equal(out[0]!.up, bars[280]!.close > bars[260]!.close);
});
