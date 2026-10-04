import assert from 'node:assert/strict';
import test from 'node:test';
import { horizonGauges, intradayBars, monthlyBars } from './horizons.js';
import type { IntradaySession } from '../types.js';

const session = (date: string, times: string[], closes: number[], cumVolumes: number[]): IntradaySession =>
  ({ symbol: 'X', date, times, closes, cumVolumes, source: 't', retrievedAt: '' });

test('minute closes become 15-minute bars; the 15:30 print joins the last bar', () => {
  const s = session('2026-10-02', ['09:00', '09:07', '09:14', '09:15', '15:19', '15:30'], [100, 104, 99, 101, 110, 108], [10, 30, 35, 50, 900, 1000]);
  const bars = intradayBars([s], 15);
  assert.deepEqual(bars.map((b) => b.date), ['2026-10-02T09:00', '2026-10-02T09:15', '2026-10-02T15:19']);
  assert.deepEqual(bars[0], { date: '2026-10-02T09:00', open: 100, high: 104, low: 99, close: 99, volume: 35 });
  assert.deepEqual([bars[2]!.close, bars[2]!.volume], [108, 950]);
});

test('weekly bars roll up into calendar months', () => {
  const weeks = [
    { date: '2026-08-28', open: 10, high: 12, low: 9, close: 11, volume: 5 },
    { date: '2026-09-04', open: 11, high: 15, low: 10, close: 14, volume: 7 },
    { date: '2026-09-11', open: 14, high: 14, low: 8, close: 9, volume: 1 },
  ];
  assert.deepEqual(monthlyBars(weeks), [
    { date: '2026-08', open: 10, high: 12, low: 9, close: 11, volume: 5 },
    { date: '2026-09', open: 11, high: 15, low: 8, close: 9, volume: 8 },
  ]);
});

test('five gauges in order; a horizon without bars withholds', () => {
  const g = horizonGauges({ intraday: [], daily: [], weekly: [] });
  assert.deepEqual(g.map((x) => x.label), ['초단기', '단기', '중기', '중장기', '장기']);
  assert.ok(g.every((x) => x.summary.withheld && x.summary.label === '판단 보류'));
});
