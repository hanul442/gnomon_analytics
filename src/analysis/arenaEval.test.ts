import assert from 'node:assert/strict';
import test from 'node:test';
import { forecastStats, pathStats, quantile, quantileStats, scoreModel, verdict, type ArenaRow } from './arenaEval.js';

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

test('quantile stats: chance read off the quantiles, held at 5%/95% outside the band', () => {
  const q = [0.9, 0.93, 0.96, 0.98, 1.0, 1.02, 1.04, 1.07, 1.1];
  const s = quantileStats(q)!;
  assert.ok(Math.abs(s.up - 0.5) < 1e-9);
  assert.equal(s.p10, 0.9); assert.equal(s.p90, 1.1);
  // Halfway between the 30% and 40% quantiles → 35% below.
  assert.ok(Math.abs(quantileStats([0.9, 0.93, 0.98, 1.02, 1.03, 1.04, 1.05, 1.06, 1.1])!.up - 0.65) < 1e-9);
  assert.equal(quantileStats(q.map((v) => v + 0.2))!.up, 0.95);
  assert.equal(quantileStats(q.map((v) => v - 0.2))!.up, 0.050000000000000044);
  assert.equal(quantileStats([1, 1]), null);
  assert.ok(forecastStats({ q }) && forecastStats({ paths: [1, 1, 1, 1] }));
  assert.equal(forecastStats({}), null);
});

test('a model whose forecasts follow the outcome beats the base; one that says the opposite loses', () => {
  const rows = (sign: number): ArenaRow[] => {
    const out: ArenaRow[] = [];
    for (let d = 0; d < 8; d += 1) for (let k = 0; k < 40; k += 1) {
      const ret = ((k * 37 + d * 11) % 40) / 100 - 0.2;
      const centre = 1 + sign * ret;
      out.push({ id: `${d}:${k}`, date: `2026-0${d + 1}-01`, symbol: String(k), ret, excess: ret, ended: false, base: 0.4 + (k % 7) / 100, constant: 0.45, p10: 0.9, p90: 1.1, sigma: 0.02, vol60: 0.02, forecast: { paths: [centre - 0.02, centre - 0.01, centre, centre + 0.01, centre + 0.02] } });
    }
    return out;
  };
  const good = scoreModel(rows(1)), bad = scoreModel(rows(-1));
  assert.equal(good.dates, 8);
  assert.ok(good.brier.model < good.brier.base);
  assert.ok(good.ic.move.mean > 0.9 && good.ic.move.lo > 0);
  assert.ok(bad.ic.move.mean < -0.9);
  assert.ok(good.spread.mean > 0);
  // The base barely ranks these stocks, so nearly all of the model ranking is added information.
  assert.ok(good.icAdded.mean > 0.8);
  assert.equal(verdict(good).ranking, true);
  assert.equal(verdict(bad).ranking, false);
});
