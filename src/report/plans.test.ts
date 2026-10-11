import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { allows, CREDIT_ACTIONS, FEATURES, gate, needText, NOTIFY_LIMITS, PLANS, TRIAL, validPromos, WATCH_LIMIT, type Feature } from './plans.js';

test('promotions: only well-formed ones are published; the repo file is valid', async () => {
  assert.deepEqual(validPromos([{ id: 'a', credits: 20, from: '2026-10-05', to: '2026-10-31', title: 't' }]).length, 1);
  assert.equal(validPromos([{ id: 'a', credits: 0, from: '2026-10-05', to: '2026-10-31', title: 't' }]).length, 0);
  assert.equal(validPromos([{ id: 'a', credits: 20, from: '2026-11-01', to: '2026-10-31', title: 't' }]).length, 0);
  assert.equal(validPromos('nope').length, 0);
  const file = JSON.parse(await readFile('promos.json', 'utf8')) as unknown[];
  assert.equal(validPromos(file).length, file.length);
});

test('plan rules: credits from Plus, one report kind (G-168), trial only for quick questions, watchlists grow', () => {
  for (const a of CREDIT_ACTIONS) assert.notEqual(a.min, 'free' as never);
  assert.deepEqual(CREDIT_ACTIONS.filter((a) => /리포트 요청/.test(a.label)).map((a) => a.key), ['report']);
  assert.deepEqual([...TRIAL.actions], ['question']);
  assert.deepEqual(PLANS.map((p) => WATCH_LIMIT[p.key]), [5, 30, 100, 1e9]);
  assert.deepEqual(PLANS.map((p) => p.price), [0, 14900, 39000, 99000]);
});

test('one permission table (G-215): what each of the five plans may use', () => {
  const features = Object.keys(FEATURES) as Feature[];
  // Pinned on purpose: moving a feature to another plan should be a decision that also changes this list.
  const PRO_ONLY = ['invite', 'idea', 'intraday', 'forecast', 'arenaDetail', 'debateRest', 'record', 'paperLedger', 'scoreMisses', 'deepFull'];
  const expected: Record<string, string[]> = {
    free: [], plus: features.filter((f) => !PRO_ONLY.includes(f)), pro: features, max: features, alpha: features,
  };
  for (const [plan, list] of Object.entries(expected)) assert.deepEqual(features.filter((f) => allows(plan, f)), list, plan);
  assert.equal(allows('unknown', 'ask'), false);
  // Credit actions, notifications and the site's locks read the same table.
  for (const a of CREDIT_ACTIONS) assert.equal(a.min, FEATURES[a.key], a.key);
  for (const p of PLANS) assert.deepEqual([NOTIFY_LIMITS[p.key].push, NOTIFY_LIMITS[p.key].intraday], [allows(p.key, 'push'), allows(p.key, 'intraday')], p.key);
  assert.match(gate('x', { base: '', what: '예측', feature: 'forecast' }), /data-need="pro".*프로부터 볼 수 있어요/s);
  assert.match(gate('x', { base: '', what: '토론', feature: 'debate' }), /data-need="plus".*플러스부터 볼 수 있어요/s);
  assert.equal(needText('screenTools'), '플러스부터');
});
