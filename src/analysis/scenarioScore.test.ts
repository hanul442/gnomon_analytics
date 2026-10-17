import assert from 'node:assert/strict';
import test from 'node:test';
import { brierOf, calibrationBins, mergeBoards, scenarioCallOf, scoreScenarios, type ScenarioCall } from './scenarioScore.js';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
const call = (base: number, bull: number, bear: number, probs = { BULL: 30, BASE: 50, BEAR: 20 }): ScenarioCall => ({ reportDate: day(base), baseDate: day(base), baseClose: 100, probs, bullTrigger: bull, bearTrigger: bear });

test('the scenario whose trigger the close crosses first happened; neither within 20 sessions is BASE (G-227)', () => {
  // Flat at 100 for 10 sessions, then up to 115, then the series ends at session 45.
  const bars = Array.from({ length: 46 }, (_, i) => ({ date: day(i), close: i < 10 ? 100 : 115 }));
  const board = scoreScenarios([call(0, 110, 90), call(12, 130, 90), call(40, 130, 90)], bars);
  assert.deepEqual(board.calls.map((c) => [c.baseDate, c.outcome, c.done, c.crossedOn]), [
    [day(40), null, false, null], // 5 sessions in, nothing crossed: still open
    [day(12), 'BASE', true, null], // 20 sessions without crossing 130 or 90
    [day(0), 'BULL', true, day(10)], // crossed 110 on session 10: done early
  ]);
  assert.deepEqual([board.scored, board.pending], [2, 1]);
  assert.deepEqual(board.happened, { BULL: 1, BASE: 1, BEAR: 0 });
  // BULL at 30%: 0.49 + 0.25 + 0.04 = 0.78. BASE at 50%: 0.09 + 0.25 + 0.04 = 0.38.
  assert.equal(Math.round(board.brier! * 100) / 100, 0.58);
  assert.ok(board.skill! > 0 && board.skill! < 0.2);
});

test('a report becomes a call only with all three probabilities and both triggers', () => {
  const sc = (kind: 'BULL' | 'BASE' | 'BEAR', probability?: number, trigger?: number) => ({ kind, ...(probability !== undefined ? { probability } : {}), ...(trigger ? { trigger } : {}) });
  const report = (scenarios: ReturnType<typeof sc>[]) => ({ date: day(1), price: { close: 100, sessionDate: day(0) }, commentary: { status: 'OK', scenarios } });
  assert.deepEqual(scenarioCallOf(report([sc('BULL', 30, 110), sc('BASE', 50), sc('BEAR', 20, 90)])), { ...call(0, 110, 90), reportDate: day(1) });
  assert.equal(scenarioCallOf(report([sc('BULL', 30, 110), sc('BASE'), sc('BEAR', 20, 90)])), null);
  assert.equal(scenarioCallOf(report([sc('BULL', 30), sc('BASE', 50), sc('BEAR', 20, 90)])), null);
  assert.equal(scenarioCallOf({ ...report([]), commentary: { status: 'FAILED' } }), null);
});

test('calibration buckets and merging boards across stocks', () => {
  assert.equal(brierOf({ BULL: 100, BASE: 0, BEAR: 0 }, 'BULL'), 0);
  const bins = calibrationBins([{ p: 70, hit: true }, { p: 75, hit: false }, { p: 10, hit: false }]);
  assert.deepEqual(bins.map((b) => [b.lo, b.n, b.saidPct, b.happenedPct]), [[0, 1, 10, 0], [60, 2, 72.5, 50]]);
  const one = { scored: 2, pending: 1, brier: 0.5, skill: 0.25, happened: { BULL: 1, BASE: 1, BEAR: 0 }, bins, calls: [] };
  const merged = mergeBoards([one, { ...one, brier: 0.2, happened: { BULL: 0, BASE: 0, BEAR: 2 } }]);
  assert.deepEqual([merged.scored, merged.pending, Math.round(merged.brier! * 100) / 100], [4, 2, 0.35]);
  assert.deepEqual(merged.happened, { BULL: 1, BASE: 1, BEAR: 2 });
  assert.deepEqual(merged.bins.map((b) => [b.lo, b.n]), [[0, 2], [60, 4]]);
});
