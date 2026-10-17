import assert from 'node:assert/strict';
import test from 'node:test';
import { macroSnapshot, macroText } from './macro.js';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
const pt = (series: string, i: number, value: number) => ({ series, date: day(i), value, source: 'fred:csv', retrievedAt: '' });

test('macro snapshot: last value on or before the date, 20-point change, place in the year (G-230)', () => {
  const pts = [...Array.from({ length: 30 }, (_, i) => pt('DGS10', i, 4 + i * 0.01)), pt('DGS10', 40, 9), pt('VIXCLS', 0, 30)];
  const m = macroSnapshot(pts, day(29))!;
  const d = m.items.find((x) => x.id === 'DGS10')!;
  assert.equal(d.date, day(29));
  assert.equal(Math.round(d.chg20! * 100), 20);
  assert.equal(Math.round(d.rangePct!), 100);
  assert.equal(m.items.some((x) => x.id === 'VIXCLS'), false, 'a series older than two weeks is left out');
  assert.match(macroText(m), /미국 10년 국채 금리 4\.29%\(2026-01-30\), 20거래일 \+20bp, 1년 범위의 100% 위치/);
  assert.equal(macroSnapshot([], day(1)), null);
});
