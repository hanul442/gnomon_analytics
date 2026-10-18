import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBlind2, eventEvidence, flowEvidence } from './blindEval2.js';
import { forwardReturn, liquidSets, meanCI, panelStock, quintiles, scoreSignal, spearman, SIGNALS, type RawBar, type Row } from './evalPanel.js';

const day = (k: number) => Number(new Date(Date.UTC(2020, 0, 1) + k * 86_400_000).toISOString().slice(0, 10).replace(/-/g, ''));
const series = (n: number, close = (k: number) => 10_000 + k, vol = (_k: number) => 1000): RawBar[] => Array.from({ length: n }, (_, k) => [day(k), close(k), close(k) * 1.01, close(k) * 0.99, close(k), vol(k)]);

test('the most-traded set of a date ignores what is traded after it', () => {
  const cal = series(400).map((b) => b[0]!);
  const a = { symbol: 'A', bars: series(400, () => 10_000, () => 1000) };
  const b = { symbol: 'B', bars: series(400, () => 10_000, (k) => (k > 300 ? 1e9 : 10)) };
  const sets = liquidSets([a, b], cal, 1, day(260));
  assert.deepEqual(sets[0]!.symbols, ['A']); // B only becomes busy after day 300
  assert.deepEqual(sets.find((s) => s.date >= day(360))!.symbols, ['B']);
  // Cheap stocks and short histories are out.
  assert.deepEqual(liquidSets([{ symbol: 'C', bars: series(400, () => 900) }], cal, 5, day(260))[0]!.symbols, []);
});

test('a stock that stops trading keeps its last close as the outcome', () => {
  const s = panelStock('D', series(300, (k) => (k < 290 ? 10_000 : 2_000)), null, null);
  const r = forwardReturn(s, 285, '2099-01-01')!;
  assert.ok(r.ended);
  assert.ok(Math.abs(r.ret - (2000 / 10_000 - 1)) < 1e-9);
  const live = forwardReturn(s, 200, s.bars[220]!.date)!;
  assert.equal(live.ended, false);
});

test('rank statistics', () => {
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1);
  assert.deepEqual(quintiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  const m = meanCI([1, 1, 1, 1]);
  assert.equal(m.mean, 1); assert.equal(m.lo, 1); assert.equal(m.hi, 1);
});

test('a signal that sorts the outcome gets a positive IC and spread; its chance table only uses earlier dates', () => {
  const key = SIGNALS[0]!.key;
  const dates = Array.from({ length: 12 }, (_, d) => ({ date: `2020-${String(d + 1).padStart(2, '0')}-01`, rows: Array.from({ length: 50 }, (_, k): Row => ({ symbol: `S${k}`, i: 0, ret: 0, ended: false, excess: (k - 24.5) / 100, values: { [key]: k }, p10: null, p90: null, sigma: null })) }));
  const s = scoreSignal(key, dates)!;
  assert.ok(s.ic.mean > 0.99);
  assert.ok(s.spread.mean > 0);
  assert.ok(s.brier < s.brierBase);
  // With the outcome flipped on the last dates only, earlier dates' tables do not know it.
  const flipped = dates.map((d, n) => (n < 9 ? d : { ...d, rows: d.rows.map((r) => ({ ...r, excess: -r.excess })) }));
  assert.ok(scoreSignal(key, flipped)!.brier > scoreSignal(key, dates)!.brier);
});

test('blind v2 evidence carries no names, dates or sizes; replies are checked', () => {
  const raw = series(300, (k) => 50_000 + 100 * Math.sin(k / 5));
  const flows: RawBar[] = raw.map((b) => [b[0]!, 300, -100, 12.5]);
  const s = panelStock('X', raw, flows, [[day(280), 'buyback']]);
  const text = JSON.stringify([...flowEvidence(s, 290), ...eventEvidence(s, 290)]);
  assert.ok(text.includes('Q1') && text.includes('E1') && text.includes('자사주'));
  assert.ok(!/20\d\d-?\d\d-?\d\d/.test(text) && !/\d{4,}/.test(text));
  assert.deepEqual(parseBlind2('{"beat":55,"p10":90,"p90":112,"why":"x"}'), { beat: 0.55, p10: 90, p90: 112 });
  assert.equal(parseBlind2('{"beat":55,"p10":120,"p90":110}'), null);
  assert.equal(parseBlind2('no json'), null);
});

test('a yes/no signal is scored yes minus no', () => {
  const key = 'buyback';
  const dates = Array.from({ length: 8 }, (_, d) => ({ date: `2021-${String(d + 1).padStart(2, '0')}-01`, rows: Array.from({ length: 40 }, (_, k): Row => ({ symbol: `S${k}`, i: 0, ret: 0, ended: false, excess: k < 5 ? 0.04 : -0.005, values: { [key]: k < 5 ? 1 : 0 }, p10: null, p90: null, sigma: null })) }));
  const s = scoreSignal(key, dates)!;
  assert.ok(Math.abs(s.spread.mean - 4.5) < 1e-9);
});
