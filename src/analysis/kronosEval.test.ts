import assert from 'node:assert/strict';
import test from 'node:test';
import { pathStats, quantile, scoreKronos, type KronosRow } from './kronosEval.js';

test('path stats: smoothed chance, median move and range', () => {
  const s = pathStats([0.9, 0.95, 1.05, 1.1, 1.2])!;
  assert.ok(Math.abs(s.up - 3.5 / 6) < 1e-12);
  assert.ok(Math.abs(s.move - Math.log(1.05)) < 1e-12);
  assert.ok(Math.abs(s.p10 - quantile([0.9, 0.95, 1.05, 1.1, 1.2], 0.1)) < 1e-12);
  assert.ok(s.spread > 0);
  assert.equal(pathStats([1, 1.1]), null);
  // All paths up is never certain.
  assert.ok(pathStats([1.1, 1.1, 1.1, 1.1])!.up < 1);
});

test('a model whose paths follow the outcome beats the base; one that says the opposite loses', () => {
  const rows = (sign: number): KronosRow[] => {
    const out: KronosRow[] = [];
    for (let d = 0; d < 8; d += 1) for (let k = 0; k < 40; k += 1) {
      const ret = ((k * 37 + d * 11) % 40) / 100 - 0.2;
      const centre = 1 + sign * ret;
      out.push({ id: `${d}:${k}`, date: `2026-0${d + 1}-01`, symbol: String(k), ret, excess: ret, ended: false, base: 0.45, p10: 0.9, p90: 1.1, sigma: 0.02, vol60: 0.02, paths: [centre - 0.02, centre - 0.01, centre, centre + 0.01, centre + 0.02] });
    }
    return out;
  };
  const good = scoreKronos(rows(1), 0.45), bad = scoreKronos(rows(-1), 0.45);
  assert.equal(good.dates, 8);
  assert.ok(good.brier.kronos < good.brier.base);
  assert.ok(good.ic.kronosMove.mean > 0.9 && good.ic.kronosMove.lo > 0);
  assert.ok(bad.ic.kronosMove.mean < -0.9);
  assert.ok(good.spread.mean > 0);
  // The base is flat here, so what Kronos adds is the whole of its ranking.
  assert.ok(good.icAdded.mean > 0.9);
});
