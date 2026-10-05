import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CREDIT_ACTIONS, PLANS, TRIAL, validPromos, WATCH_LIMIT } from './plans.js';

test('promotions: only well-formed ones are published; the repo file is valid', async () => {
  assert.deepEqual(validPromos([{ id: 'a', credits: 20, from: '2026-10-05', to: '2026-10-31', title: 't' }]).length, 1);
  assert.equal(validPromos([{ id: 'a', credits: 0, from: '2026-10-05', to: '2026-10-31', title: 't' }]).length, 0);
  assert.equal(validPromos([{ id: 'a', credits: 20, from: '2026-11-01', to: '2026-10-31', title: 't' }]).length, 0);
  assert.equal(validPromos('nope').length, 0);
  const file = JSON.parse(await readFile('promos.json', 'utf8')) as unknown[];
  assert.equal(validPromos(file).length, file.length);
});

test('plan rules: credits from Plus, upgrade from Pro, trial only for cheap actions, watchlists grow', () => {
  for (const a of CREDIT_ACTIONS) assert.notEqual(a.min, 'free' as never);
  assert.equal(CREDIT_ACTIONS.find((a) => a.key === 'upgrade')!.min, 'pro');
  assert.deepEqual([...TRIAL.actions].sort(), ['brief', 'question']);
  assert.deepEqual(PLANS.map((p) => WATCH_LIMIT[p.key]), [5, 30, 100, 1e9]);
  assert.deepEqual(PLANS.map((p) => p.price), [0, 14900, 39000, 99000]);
});
