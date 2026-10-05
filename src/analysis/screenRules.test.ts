import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanScreen, FIELD_INDEX, matches, PRESETS } from './screenRules.js';
import { riskFlags, riskOf } from './riskFilings.js';
import { volumeRead } from './quickCalc.js';

// [code, name, market, cap, close, chg, level, score, r5, r20, r120, fairGap, pos, covered, vol1, vol5, vwap, obv, flow, tv, hi52, risk, labels]
const row = (o: Partial<Record<string, unknown>> = {}) => {
  const r: unknown[] = ['000001', 'A', 'P', 20000, 10000, 2, 'BULLISH', 40, 1, 5, 10, -3, 'B', 0, 3.4, 1.8, 2, 30, 'A', 50, -2, 0, ''];
  for (const [k, v] of Object.entries(o)) r[FIELD_INDEX[k]!] = v;
  return r;
};
const preset = (k: string) => PRESETS.find((p) => p.key === k)!.screen;

test('presets are screens over the row columns', () => {
  assert.ok(matches(row(), preset('top'), FIELD_INDEX));
  assert.ok(!matches(row({ level: 'NEUTRAL' }), preset('top'), FIELD_INDEX));
  assert.ok(matches(row(), preset('volsurge'), FIELD_INDEX) && !matches(row({ vol1: 2 }), preset('volsurge'), FIELD_INDEX));
  assert.ok(matches(row(), preset('accum'), FIELD_INDEX) && matches(row(), preset('breakout'), FIELD_INDEX) && matches(row(), preset('value'), FIELD_INDEX));
  // Missing numbers never pass a numeric rule; filing risk drops a stock from buy-side presets.
  assert.ok(!matches(row({ vol1: null }), preset('volsurge'), FIELD_INDEX));
  assert.ok(!matches(row({ risk: 2 }), preset('top'), FIELD_INDEX) && matches(row({ risk: 2 }), preset('risky'), FIELD_INDEX));
  assert.ok(matches(row({ level: 'BEARISH' }), { match: 'any', rules: [{ f: 'level', op: '=', v: 'BULL' }, { f: 'market', op: '=', v: 'P' }] }, FIELD_INDEX));
});

test('screens from outside are checked', () => {
  assert.deepEqual(cleanScreen({ match: 'x', rules: [{ f: 'vol1', op: '>=', v: '3' }], maxRisk: 2 }), { match: 'all', rules: [{ f: 'vol1', op: '>=', v: 3 }], maxRisk: 2 });
  assert.equal(cleanScreen({ rules: [{ f: 'nope', op: '>=', v: 1 }] }), null);
  assert.equal(cleanScreen({ rules: [{ f: 'vol1', op: '>', v: 1 }] }), null);
  assert.equal(cleanScreen({ rules: [{ f: 'vol1', op: '>=', v: 'abc' }] }), null);
  // The matcher is self-contained, so the page can inline it.
  assert.ok(!/\bFIELDS\b|import/.test(matches.toString()));
});

test('filing risk: titles to rules, then one flag per stock', () => {
  assert.equal(riskOf('주요사항보고서(전환사채권발행결정)')?.key, 'cb');
  assert.equal(riskOf('[기재정정]주요사항보고서(유상증자결정)')?.key, 'rights');
  assert.equal(riskOf('관리종목지정(감사의견 거절)')?.level, 3);
  assert.equal(riskOf('투자경고종목지정해제'), null);
  assert.equal(riskOf('분기보고서 (2026.06)'), null);
  const flags = riskFlags([
    { symbol: '1', date: '2026-10-01', title: 't', receiptNo: 'a', key: 'cb' },
    { symbol: '1', date: '2026-10-02', title: 't', receiptNo: 'b', key: 'halt' },
    { symbol: '2', date: '2026-08-01', title: 't', receiptNo: 'c', key: 'cb' },
  ], '2026-09-05');
  assert.deepEqual(flags.get('1'), { level: 3, labels: ['전환사채', '거래정지'], latest: '2026-10-02' });
  assert.equal(flags.has('2'), false);
});

test('volume read: a surge, VWAP and an accumulation footprint', () => {
  const bars = Array.from({ length: 40 }, (_, i) => ({ date: `d${String(i).padStart(2, '0')}`, high: 101, low: 99, close: 100 + (i % 2 ? 0.5 : -0.5), volume: 1000 }));
  // Up days on heavy volume, down days on light: OBV climbs while the price goes nowhere.
  for (let i = 20; i < 40; i += 1) bars[i]!.volume = bars[i]!.close > bars[i - 1]!.close ? 3000 : 500;
  bars[39]!.volume = 9000;
  const v = volumeRead(bars)!;
  assert.ok(v.ratio1 > 5 && v.ratio5 > 1.5, JSON.stringify(v));
  assert.equal(v.flow, 'ACCUM');
  assert.ok(Math.abs(v.vwapGapPct) < 2);
  assert.equal(volumeRead(bars.slice(0, 10)), null);
});
