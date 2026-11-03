import assert from 'node:assert/strict';
import test from 'node:test';
import { bandV1, cell, rangeReport, regimeCuts, regimeOf, verdict, Z90, type RangeSample } from './rangeEval.js';

const sample = (date: string, ret: number, mkt: number, h = 5): RangeSample => ({ date, h, sigS: 0.02, sigL: 0.02, drift: 0, ret, mkt, prior60: 0 });

test('the live band is ±1.28σ√h around the kept drift', () => {
  const [lo, hi] = bandV1({ ...sample('2020-01-01', 0, 0), drift: 0.001 });
  assert.ok(Math.abs(lo - (0.005 - Z90 * 0.02 * Math.sqrt(5))) < 1e-12);
  assert.ok(Math.abs(hi - (0.005 + Z90 * 0.02 * Math.sqrt(5))) < 1e-12);
});

test('cells count inside, below and the interval score', () => {
  const xs = [sample('2020-01-01', 0, 0), sample('2020-01-02', -0.2, 0), sample('2020-01-03', 0.2, 0)];
  const c = cell(xs, () => [-0.1, 0.1]);
  assert.equal(c.n, 3);
  assert.ok(Math.abs(c.inside - 1 / 3) < 1e-12 && Math.abs(c.below - 1 / 3) < 1e-12);
  assert.ok(Math.abs(c.score - (0.2 + (10 * 0.1 * 2) / 3)) < 1e-12);
});

test('regimes come from the market move of the same horizon, and the live method passes its own bar', () => {
  const xs = Array.from({ length: 200 }, (_, i) => sample(`20${i < 100 ? '18' : '25'}-01-${String((i % 28) + 1).padStart(2, '0')}`, ((i % 9) - 4) * 0.01, (i - 100) / 1000));
  const cuts = regimeCuts(xs);
  assert.equal(regimeOf(xs[0]!, cuts), 'crash');
  assert.equal(regimeOf(xs[100]!, cuts), 'flat');
  assert.equal(regimeOf(xs[199]!, cuts), 'surge');
  const reps = rangeReport(xs, '2024-01-01');
  const v1 = reps.find((r) => r.key === 'v1')!;
  assert.equal(v1.byHorizon.find((x) => x.h === 5)!.all.n, 200);
  assert.ok(verdict(v1, v1).reasons.every((r) => !r.includes('지금')));
});
