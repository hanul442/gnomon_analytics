import assert from 'node:assert/strict';
import test from 'node:test';
import { ACTION_COST, actionChecks, ASSUMPTIONS, cheapestCredit, netOf, planChecks } from './economics.js';
import { CREDIT_PACKS, PLANS } from './plans.js';

test('every credit action, bought at the cheapest credit, costs us at most half of what we keep', () => {
  for (const a of actionChecks()) assert.ok(a.ratio <= ASSUMPTIONS.maxCostRatio, `${a.key}: cost ${a.cost.toFixed(0)} / net ${a.net.toFixed(0)} = ${(a.ratio * 100).toFixed(0)}%`);
});

test('every paid plan, with all its credits spent the worst way, costs us at most half of what we keep', () => {
  for (const p of planChecks()) assert.ok(p.ratio <= ASSUMPTIONS.maxCostRatio, `${p.key}: ${(p.ratio * 100).toFixed(0)}%`);
});

test('tiers climb: each plan costs more and adds something; packs get cheaper per credit', () => {
  for (let i = 1; i < PLANS.length; i += 1) { assert.ok(PLANS[i]!.price > PLANS[i - 1]!.price); assert.ok(PLANS[i]!.adds.length > 0); }
  const per = CREDIT_PACKS.map((k) => k.price / k.credits);
  for (let i = 1; i < per.length; i += 1) assert.ok(per[i]! < per[i - 1]!);
  assert.ok(cheapestCredit() > 60, 'credits never sold below 60원');
  // Sanity: a report request costs us a few hundred won; the net of 1,000원 is about 877원.
  assert.ok(ACTION_COST.report > 150 && ACTION_COST.report < 400, String(ACTION_COST.report));
  assert.equal(Math.round(netOf(1000)), 877);
});
