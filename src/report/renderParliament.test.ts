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
  assert.match(html, /위원회 종합<\/dt><dd><b>약 57%/); // no bars, no base: the pooled vote; trend PM carries half weight (G-246)
  assert.match(html, /순위를 잘 맞힌 위원에게 더 무게/);
  assert.match(html, /1명은 위원회 전에 혼자 판단/);
  assert.doesNotMatch(html, /가격 범위/);
  const withRange = consensusNote({ ...report, market: { forecasts: [{ horizon: 20, p10: 9000, p90: 12000 }] } } as unknown as Parameters<typeof consensusNote>[0]);
  assert.ok(withRange.indexOf('가격 범위(80%)') < withRange.indexOf('위원회 종합')); // G-246: range leads
  assert.equal(consensusNote({ commentary: { status: 'FAILED' } } as unknown as Parameters<typeof consensusNote>[0]), '');
});

test('a Korean stock\'s note starts from the statistical base and only text analysts move it (G-264)', () => {
  const bars = Array.from({ length: 260 }, (_, i) => ({ date: `d${i}`, open: 100, high: 101 + (i % 3), low: 99, close: 100 + (i % 3), volume: 1 }));
  const report = { exchange: 'KOSPI', recentBars: bars, commentary: { status: 'OK', analysts: [
    { analyst: 'trend_momentum', stance: 'BULLISH', confidence: 90 }, { analyst: 'event_catalyst', stance: 'BULLISH', confidence: 70 },
  ] }, market: {} } as unknown as Parameters<typeof consensusNote>[0];
  const html = consensusNote(report);
  assert.match(html, /통계 기준 \d+%/);
  assert.match(html, /공시·뉴스를 읽은 위원 1명이 \+10%p 움직였어요/); // (70 − 50) halved
  assert.match(html, /차트를 보는 위원 판단은 기준에 이미 들어 있어/);
  // A coin keeps the pooled vote.
  assert.doesNotMatch(consensusNote({ ...report, kind: 'coin' } as unknown as Parameters<typeof consensusNote>[0]), /통계 기준/);
});

test('a Korean stock\'s note leads with where it sits among the day\'s stocks (G-268)', () => {
  const bars = Array.from({ length: 260 }, (_, i) => ({ date: `d${i}`, open: 100, high: 101 + (i % 3), low: 99, close: 100 + (i % 3), volume: 1 }));
  const report = { exchange: 'KOSPI', recentBars: bars, commentary: { status: 'OK', analysts: [{ analyst: 'fundamental', stance: 'NEUTRAL', confidence: 50 }] },
    market: { forecasts: [{ horizon: 20, p10: 90, p90: 110 }] } } as unknown as Parameters<typeof consensusNote>[0];
  const html = consensusNote(report);
  const at = (s: string) => html.indexOf(s);
  assert.ok(at('다른 종목과 비교') >= 0 && at('다른 종목과 비교') < at('가격 범위(80%)') && at('가격 범위(80%)') < at('오를 확률(참고)'));
  assert.match(html, /pl-of">\d\/5</);
  assert.match(html, /<details class="pl-how">/); // G-274: the explanation folds away
  assert.doesNotMatch(html, /kit-ring/); // G-274: the seats already show the split
});
