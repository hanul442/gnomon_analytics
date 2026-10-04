import assert from 'node:assert/strict';
import test from 'node:test';
import { paperBooks, paperEntries, type PaperEntry } from './paper.js';
import { ARENA_COST } from './strategies.js';

const bars = [100, 110, 121, 121, 108.9].map((close, i) => ({ date: `2026-10-0${i + 1}`, close }));
const entry = (date: string, follower: string, position: 0 | 1): PaperEntry => ({ symbol: 'X', date, close: 0, follower, label: follower, position, basis: '', method: 'gnm-paper-v1', recordedAt: '' });
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);

test('a position earns from the next session, not the one that set it', () => {
  // Bought at the close of 10-02 (110): earns 110→121→121→108.9, i.e. -1%.
  const [book] = paperBooks([entry('2026-10-02', 'champion', 1)], bars);
  near(book!.totalReturn, (1 - ARENA_COST / 2) * (108.9 / 110) - 1);
  assert.equal(book!.sessions, 3);
  assert.deepEqual(book!.trades.map((t) => [t.date, t.action, t.price]), [['2026-10-02', 'BUY', 110]]);
});

test('a follower keeps its last position on days without an entry, and selling stops the bleeding', () => {
  const [book] = paperBooks([entry('2026-10-01', 'analyst:x', 1), entry('2026-10-03', 'analyst:x', 0)], bars);
  // Held 100→121, sold at 121, so the drop to 108.9 is avoided.
  near(book!.totalReturn, (1 - ARENA_COST / 2) ** 2 * 1.21 - 1);
  assert.equal(book!.position, 0);
  assert.equal(book!.equity.length, 5);
});

test('entries: buy and hold always, the champion, and analysts long only when bullish', () => {
  const es = paperEntries({
    symbol: 'X', sessionDate: '2026-10-02', close: 110, recordedAt: 't',
    arena: { championKey: 'macd', results: [{ key: 'macd', name: 'MACD 교차', position: 0 }] } as never,
    analysts: [{ analyst: 'trend_momentum', stance: 'BULLISH' }, { analyst: 'mean_reversion', stance: 'BEARISH' }] as never,
  });
  assert.deepEqual(es.map((e) => [e.follower, e.position]), [['hold', 1], ['champion', 0], ['analyst:trend_momentum', 1], ['analyst:mean_reversion', 0]]);
  // Champion first, buy-and-hold last.
  assert.deepEqual(paperBooks(es, bars).map((b) => b.follower), ['champion', 'analyst:mean_reversion', 'analyst:trend_momentum', 'hold']);
});
