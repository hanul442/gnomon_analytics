import assert from 'node:assert/strict';
import test from 'node:test';
import { addCombo, costCheck, splitCheck, subset, type Dated } from './evalMore.js';
import type { Row } from './evalPanel.js';

const row = (k: number, excess: number, values: Record<string, number | null>): Row => ({ symbol: `S${k}`, i: 0, ret: excess, ended: false, excess, values, p10: null, p90: null, sigma: null });
const month = (n: number) => `${2016 + Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}-01`;
/** 50 stocks a date; `sign(n)` says whether signal a sorts the outcome up (+1) or down (−1) on date n. */
const panel = (count: number, sign: (n: number) => number, noise = 0): Dated[] => Array.from({ length: count }, (_, n) => ({
  date: month(n), outcome: month(n + 1),
  rows: Array.from({ length: 50 }, (_, k) => row(k, (sign(n) * (k - 24.5)) / 100 + (noise ? Math.sin(k * 7.1 + n * 3.3) * noise : 0), { a: k, b: (k * 17 + n * 11) % 50, c: 49 - k })),
}));

test('discovery/confirm: kept when the later period agrees, flipped when it turns', () => {
  const cut = month(48);
  assert.equal(splitCheck('a', panel(96, () => 1), cut).verdict, 'confirmed');
  assert.equal(splitCheck('a', panel(96, (n) => (n < 48 ? 1 : -1)), cut).verdict, 'flipped');
  assert.equal(splitCheck('b', panel(96, () => 1, 0.3), cut).verdict, 'none'); // never found
});

test('costs come off the top fifth only for the names that change', () => {
  // Same top fifth every date: bought once, then no turnover.
  const r = costCheck('a', panel(24, () => 1), 0.01)!;
  assert.ok(r.turnover < 0.05);
  assert.ok(Math.abs(r.longGross.mean - r.longNet.mean - 1 / 24) < 1e-9); // 1%p on the first date only, averaged
  // A signal that reshuffles every date pays on most of it.
  const shuffled = panel(24, () => 1).map((d, n) => ({ ...d, rows: d.rows.map((x, k) => ({ ...x, values: { ...x.values, b: (k * 17 + n * 11) % 50 } })) }));
  assert.ok(costCheck('b', shuffled, 0.01)!.turnover > 0.5);
  // Yes/no signals have no fifths.
  assert.equal(costCheck('y', panel(24, () => 1).map((d) => ({ ...d, rows: d.rows.map((x, k) => ({ ...x, values: { y: k < 5 ? 1 : 0 } })) }))), null);
});

test('a subset is measured against its own average', () => {
  const s = subset(panel(2, () => 1), (r) => Number(r.symbol.slice(1)) >= 25);
  const ex = s[0]!.rows.map((r) => r.excess);
  assert.equal(s[0]!.rows.length, 25);
  assert.ok(Math.abs(ex.reduce((a, b) => a + b, 0)) < 1e-9);
});

test('combined score weights only from earlier dates', () => {
  // a works, c is a's mirror (works backwards), b is noise: once enough dates pass, c's weight goes to 0.
  const { dates, weights } = addCombo(panel(12, () => 1), ['a', 'b', 'c'], 'combo', 3);
  assert.deepEqual(weights[0]!.w, { a: 1, b: 1, c: 1 });
  assert.equal(weights[5]!.w.c, 0);
  assert.ok(weights[5]!.w.a! > 0.9);
  // Changing the last date's outcome does not change any weight up to and including it.
  const flipped = panel(12, (n) => (n === 11 ? -1 : 1));
  assert.deepEqual(addCombo(flipped, ['a', 'b', 'c'], 'combo', 3).weights, weights);
  const last = dates.at(-1)!.rows;
  assert.ok(last.at(-1)!.values.combo! > last[0]!.values.combo!);
});
