import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreKey, scoreSignals, signalBoard, todaysSignals } from './signalLog.js';
import { FIELD_INDEX } from './screenRules.js';

const row = (code: string, o: Record<string, unknown>) => {
  const r: unknown[] = [code, `종목${code}`, 'P', 20000, 1000, 2, 'BULLISH', 40, 1, 5, 10, -3, 'B', 0, 1, 1, 0, 0, null, 50, -20, 0, ''];
  for (const [k, v] of Object.entries(o)) r[FIELD_INDEX[k]!] = v;
  return r;
};

test('signals: the top of each preset is recorded, then scored at 5 and 20 sessions against its index', () => {
  const rows = [row('A', { vol1: 5, chg: 3 }), row('B', { vol1: 4, chg: 2, market: 'Q' }), row('C', { level: 'NEUTRAL' })];
  const sig = todaysSignals(rows, '2026-10-01');
  assert.deepEqual(sig.filter((s) => s.preset === 'volsurge').map((s) => s.symbol), ['A', 'B']);
  assert.ok(sig.some((s) => s.preset === 'top' && s.symbol === 'A') && !sig.some((s) => s.symbol === 'C' && s.preset === 'top'));
  const sessions = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];
  const index = { P: new Map(sessions.map((d, i) => [d, 100 + i])), Q: new Map(sessions.map((d) => [d, 100])) };
  const vs = sig.filter((s) => s.preset === 'volsurge');
  // Four sessions later: nothing due yet.
  assert.equal(scoreSignals({ signals: vs, scored: new Set(), today: '2026-10-07', sessions, closeNow: new Map([['A', 1100]]), index }).length, 0);
  const scores = scoreSignals({ signals: vs, scored: new Set(), today: '2026-10-08', sessions, closeNow: new Map([['A', 1100], ['B', 900]]), index });
  assert.deepEqual(scores.map((s) => [s.symbol, s.horizon, s.returnPct, s.indexPct, s.excessPct]), [['A', 5, 10, 5, 5], ['B', 5, -10, 0, -10]]);
  assert.equal(scoreSignals({ signals: vs, scored: new Set(scores.map((s) => scoreKey(s, s.horizon))), today: '2026-10-08', sessions, closeNow: new Map([['A', 1100]]), index }).length, 0);
  const board = signalBoard(scores);
  assert.deepEqual([board[0]!.preset, board[0]!.n, board[0]!.avgPct, board[0]!.hitRate, board[0]!.avgExcessPct, board[0]!.beatRate], ['volsurge', 2, 0, 0.5, -2.5, 0.5]);
});
