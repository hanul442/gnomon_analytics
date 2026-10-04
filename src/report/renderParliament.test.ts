import assert from 'node:assert/strict';
import test from 'node:test';
import { hemicycle } from './renderParliament.js';

test('hemicycle places exactly n seats for any size, left to right', () => {
  for (const n of [1, 2, 3, 5, 11, 16, 17, 34, 37, 65, 120]) {
    const seats = hemicycle(n);
    assert.equal(seats.length, n, `n=${n}`);
    for (let i = 1; i < seats.length; i += 1) assert.ok(Math.atan2(seats[i]!.y, seats[i]!.x) <= Math.atan2(seats[i - 1]!.y, seats[i - 1]!.x) + 1e-9, `order n=${n}`);
  }
  assert.deepEqual(hemicycle(0), []);
});
