import assert from 'node:assert/strict';
import test from 'node:test';
import { rng } from './evalPanel.js';
import { blockMeans, holm, luckTest, shuffle } from './monteCarlo.js';

test('pure noise is not called skill, a steady edge is (G-275)', () => {
  const r = rng(3), noise = Array.from({ length: 132 }, () => r() - 0.5);
  const t0 = luckTest(noise)!;
  assert.ok(t0.p > 0.05, `noise p ${t0.p}`);
  const edge = noise.map((x) => x * 0.2 + 0.05);
  const t1 = luckTest(edge)!;
  assert.ok(t1.p < 0.01 && t1.lo > 0 && t1.percentile > 99);
});

test('streaky per-date results get a wider luck band than independent ones (G-275)', () => {
  const r = rng(5);
  // Same values, once in long streaks (regimes) and once scattered.
  const streaky = Array.from({ length: 120 }, (_, i) => (Math.floor(i / 20) % 2 ? 1 : -1) + (r() - 0.5) * 0.2);
  const sd = (xs: number[]) => { const m = xs.reduce((a, x) => a + x, 0) / xs.length; return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length); };
  assert.ok(sd(blockMeans(streaky, 12, 2000, 1)) > 1.5 * sd(blockMeans(streaky, 1, 2000, 1)));
});

test('the shuffle null joins the block p-value and the stricter one wins (G-275)', () => {
  const xs = Array.from({ length: 50 }, (_, i) => 0.1 + (i % 2 ? 0.01 : -0.01));
  const t = luckTest(xs, { shuffled: () => xs.map(() => 0.2), shuffleReps: 50 })!;
  assert.equal(t.pShuffle, 1); // every fake beat it
  assert.equal(t.p, 1);
  assert.equal(luckTest([1, 2, 3]), null);
});

test('shuffle keeps the items and holm is stricter than one test at a time (G-275)', () => {
  assert.deepEqual(shuffle([1, 2, 3, 4], rng(1)).sort(), [1, 2, 3, 4]);
  assert.deepEqual(holm([0.001, 0.04, 0.03, 0.5]), [true, false, false, false]);
});
