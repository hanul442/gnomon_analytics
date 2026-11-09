import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseHanpan, hanpanDeadline, hanpanHit, makePick, scorePick, type HanpanCandidate } from './hanpan.js';

const c = (symbol: string, cap: number, dots: string, reportDate = '2026-11-03'): HanpanCandidate => ({ symbol, name: symbol, marketCap: cap, reportDate, dots: dots.split('') as never, why: '' });
const bar = (date: string, close: number) => ({ symbol: 'X', date, open: close, high: close, low: close, close, volume: 1 });

test('G-338: the most split of the biggest 50 wins; ties have no lean, old reports and recent picks rest', () => {
  const list = [c('A', 100, 'uuuuuuuuddd'), c('B', 90, 'uuuuuuddddd'), c('C', 80, 'uuuuuddddd'), c('D', 70, 'uuuuudddd', '2026-10-01'), c('E', 60, 'uuuuuudddd')];
  assert.equal(chooseHanpan(list, [], '2026-11-09')!.symbol, 'B'); // C is a tie, D is 39 days old
  assert.equal(chooseHanpan(list, ['B'], '2026-11-09')!.symbol, 'E');
  const many = Array.from({ length: 50 }, (_, i) => c(`S${i}`, 1000 - i, 'uuuuuuuuuud'));
  assert.equal(chooseHanpan([...many, c('small', 1, 'uuuuuuddddd')], [], '2026-11-09')!.symbol, 'S0');
  assert.equal(chooseHanpan([c('T', 1, 'uudd')], [], '2026-11-09'), null);
});

test('G-338: a pick is scored on the first session after its base; equal closes are right for nobody', () => {
  const p = makePick(c('B', 90, 'uuuuuuddddd'), bar('2026-11-06', 100));
  assert.deepEqual([p.lean, p.bull, p.bear, p.baseDate], ['up', 6, 5, '2026-11-06']);
  assert.equal(scorePick(p, [bar('2026-11-06', 100)]).endDate, undefined);
  const s = scorePick(p, [bar('2026-11-05', 90), bar('2026-11-06', 100), bar('2026-11-09', 102), bar('2026-11-10', 80)]);
  assert.deepEqual([s.endDate, s.endClose, s.hit], ['2026-11-09', 102, true]);
  assert.equal(hanpanHit('up', 100, 100), false);
  assert.equal(hanpanHit('down', 100, 100), false);
});

test('G-338: answers close at 15:30 KST on the next weekday', () => {
  assert.equal(hanpanDeadline('2026-11-06'), '2026-11-09T15:30:00+09:00');
  assert.equal(hanpanDeadline('2026-11-09'), '2026-11-10T15:30:00+09:00');
});
