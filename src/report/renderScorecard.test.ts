import assert from 'node:assert/strict';
import test from 'node:test';
import { renderScorecard } from './renderScorecard.js';
import { scoreAnalysts, type AnalystCall } from '../analysis/analysts.js';
import type { HomeEntry } from './renderHtml.js';
import type { DailyReport } from './dailyReport.js';

const day = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString().slice(0, 10);
const bars = Array.from({ length: 40 }, (_, i) => ({ date: day(i), close: 100 + i }));
const call = (symbol: string, base: number, stance: AnalystCall['stance'], target: number): AnalystCall => ({
  symbol, analyst: 'trend_momentum', reportDate: day(base + 1), baseDate: day(base), baseClose: 100 + base, stance, confidence: 60, target, promptVersion: 't', madeAt: '',
});
/** A covered stock whose live report carries the analysts' board, as renderSite hands it to the scorecard. */
const scorecardEntry = (symbol: string, name: string, calls: AnalystCall[]): HomeEntry => ({
  symbol, name, href: `${symbol}/index.html`, group: 'core',
  report: { market: { forecasts: [], forecastScores: [], analystBoard: scoreAnalysts(calls, bars), paper: [] } } as unknown as DailyReport,
});

test('the scorecard shows each member\'s calls from stance to result, with the day\'s report one tap away (G-213)', () => {
  // G-301 (한서님 10/26 새 구조): the member cards live on 위원회 › 위원 (members.html), not on 채점.
  const html = renderScorecard([
    scorecardEntry('111111', '가 종목', [call('111111', 0, 'BULLISH', 125), call('111111', 30, 'BEARISH', 120)]),
    scorecardEntry('222222', '나 종목', [call('222222', 35, 'BULLISH', 150)]),
  ], [], 'members');
  assert.ok(!renderScorecard([scorecardEntry('111111', '가 종목', [call('111111', 0, 'BULLISH', 125)])]).includes('id="m-trend_momentum"'), '채점 has no member cards');
  assert.ok(html.includes('<h2>위원별 판단</h2>') && html.includes('id="m-trend_momentum"'));
  const rows = html.match(/<li class="mb-row[^]*?<\/li>/g) ?? [];
  assert.equal(rows.length, 3);
  // Newest report first; each row opens that day's report at the vote.
  assert.match(rows[0]!, /data-sym="222222"[^]*나 종목[^]*강세 60%[^]*대기 4\/20[^]*전망과 같은 쪽이에요[^]*href="222222\/reports\/2026-02-06\.html#parliament-ai"/);
  assert.match(rows[1]!, /약세 60%[^]*전망과 반대쪽이에요/);
  assert.match(rows[2]!, /맞음[^]*20거래일 뒤/);
  assert.ok(html.includes('class="mb-bar" hidden'), 'the watchlist filter shows only when the reader has a watchlist');
  assert.ok(!html.includes('AI 분석가 순위'), 'the old ranking table is now the members\' cards');
});

test('a member card compares stated confidence with the hit rate once 5 calls are scored (G-226)', () => {
  // Six due bullish calls at 60% on a rising stock: all right, so the member was under-confident by 40%p.
  const calls = Array.from({ length: 6 }, (_, i) => call('111111', i, 'BULLISH', 200));
  const html = renderScorecard([scorecardEntry('111111', '가 종목', calls)], [], 'members');
  assert.match(html, /<small>확신<\/small><b>60%<\/b>/);
  assert.match(html, /적중보다 40%p 덜 자신했어요 · 확신 점수 0\.16/);
  const few = renderScorecard([scorecardEntry('111111', '가 종목', calls.slice(0, 4))], [], 'members');
  assert.ok(!few.includes('덜 자신했어요'), 'fewer than 5 scored calls: no calibration line');
});

test('the scenario section scores probabilities against what happened, in public (G-227)', async () => {
  const { scenarioSection } = await import('./renderScorecard.js');
  const bins = [{ lo: 60, hi: 80, n: 4, saidPct: 70, happenedPct: 50 }];
  const html = scenarioSection([{ scored: 4, pending: 2, brier: 0.5, skill: 0.25, happened: { BULL: 2, BASE: 1, BEAR: 1 }, bins, calls: [] }]);
  assert.match(html, /id="scenarios"/);
  assert.match(html, /<b>0\.50<\/b>/);
  assert.match(html, /셋으로 똑같이 나눈 것보다 25% 나아요/);
  assert.match(html, /60~80%<\/td><td class="num">70%<\/td><td class="num"><b>50%<\/b>/);
  assert.match(scenarioSection([]), /아직 채점한 시나리오가 없어요/);
});
