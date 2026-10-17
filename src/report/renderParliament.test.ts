import assert from 'node:assert/strict';
import test from 'node:test';
import { consensusNote, hemicycle } from './renderParliament.js';

test('hemicycle places exactly n seats for any size, left to right', () => {
  for (const n of [1, 2, 3, 5, 11, 16, 17, 34, 37, 65, 120]) {
    const seats = hemicycle(n);
    assert.equal(seats.length, n, `n=${n}`);
    for (let i = 1; i < seats.length; i += 1) assert.ok(Math.atan2(seats[i]!.y, seats[i]!.x) <= Math.atan2(seats[i - 1]!.y, seats[i - 1]!.x) + 1e-9, `order n=${n}`);
  }
  assert.deepEqual(hemicycle(0), []);
});

test('consensus note gives the pooled chance and says how many judged alone (G-228)', () => {
  const report = { commentary: { status: 'OK', lockedAnalysts: ['trend_momentum'], analysts: [
    { analyst: 'trend_momentum', stance: 'BULLISH', confidence: 70 }, { analyst: 'fundamental', stance: 'NEUTRAL', confidence: 60 },
  ] }, market: {} } as unknown as Parameters<typeof consensusNote>[0];
  const html = consensusNote(report);
  assert.match(html, /위원 2명 종합: 20거래일 뒤 지금보다 높을 확률 약 60%/);
  assert.match(html, /1명은 위원회 전에 혼자 판단/);
  assert.equal(consensusNote({ commentary: { status: 'FAILED' } } as unknown as Parameters<typeof consensusNote>[0]), '');
});
