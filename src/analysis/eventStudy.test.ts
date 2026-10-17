import assert from 'node:assert/strict';
import test from 'node:test';
import { baseRateText, eventBaseRates } from './eventStudy.js';
import type { EventFiling } from './edge.js';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
const bench = Array.from({ length: 60 }, (_, i) => ({ date: day(i), close: 100 }));
const ev = (symbol: string, i: number, key: EventFiling['key'], n = `${symbol}${i}${key}`): EventFiling => ({ symbol, date: day(i), title: '', receiptNo: n, key });

test('base rates: excess return over 20 sessions, once per stock per window, no look-ahead (G-230)', () => {
  const prices = new Map([
    ['A', Array.from({ length: 60 }, (_, i) => ({ date: day(i), close: 100 + i }))], // rising
    ['B', Array.from({ length: 60 }, (_, i) => ({ date: day(i), close: 100 - i / 2 }))], // falling
  ]);
  const rates = eventBaseRates([
    ev('A', 0, 'buyback'), ev('A', 5, 'buyback'), // second within 20 sessions: counted once
    ev('A', 25, 'buyback'), ev('B', 0, 'buyback'),
    ev('A', 45, 'buyback'), // window not finished by day 59
    ev('C', 0, 'buyback'), // no prices
    ev('A', 0, 'insider'),
  ], prices, bench, day(59));
  const b = rates.find((r) => r.key === 'buyback')!;
  // A@0: 120/100 → +20%p; A@25: 145/125 → +16%p; B@0: 90/100 → −10%p
  assert.equal(b.n, 3);
  assert.equal(Math.round(b.upPct), 67);
  assert.equal(Math.round(b.medianExcessPct), 16);
  assert.equal(rates.find((r) => r.key === 'insider')!.n, 1);
  // As of day 20 only the A@0 window has just finished.
  assert.equal(eventBaseRates([ev('A', 0, 'buyback'), ev('B', 0, 'buyback')], prices, bench, day(20)).find((r) => r.key === 'buyback')!.n, 2);
  assert.equal(eventBaseRates([ev('A', 0, 'buyback')], prices, bench, day(19)).length, 0);
  assert.match(baseRateText([b]), /자사주 매입·소각 공시 뒤 20거래일\(공시일 종가부터, 코스피 대비\): 3건 중 시장보다 오른 비율 67%, 초과 수익 중앙값 \+16\.0%p/);
});
