import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SMOOTH_JS, smoothD } from './chartLook.js';

test('smoothD passes through every point and never overshoots a flat run', () => {
  const d = smoothD('0,10 10,10 20,0 30,0 40,5');
  assert.match(d, /^M0,10C/);
  for (const p of ['10,10', '20,0', '30,0', '40,5']) assert.ok(d.includes(` ${p}C`) || d.endsWith(` ${p}`), p);
  // Monotone: no control point above the highest or below the lowest y.
  const ys = [...d.matchAll(/-?[0-9.]+,(-?[0-9.]+)/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...ys) >= 0 && Math.max(...ys) <= 10);
});

test('smoothD falls back to straight lines for two points', () => {
  assert.equal(smoothD('0,1 5,2'), 'M0,1L5,2');
});

test('SMOOTH_JS is the same function as page-script source', () => {
  const f = new Function(`${SMOOTH_JS}; return smoothD;`)() as typeof smoothD;
  assert.equal(f('0,10 10,10 20,0 30,0 40,5'), smoothD('0,10 10,10 20,0 30,0 40,5'));
  assert.doesNotMatch(SMOOTH_JS, /[`]|\$\{/);
});
