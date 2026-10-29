import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDailyReport } from './dailyReport.js';
import { renderDeep, renderReport } from './renderHtml.js';
import { committeeHero } from './committeeSeats.js';
import { reportFragments } from '../worker/reports.js';
import { JOBS_JS } from './onDemandBrowser.js';

// Live audit 10/26: signed-in pages had #committee and #join twice (and the verdict line twice) after the deep part or a
// report made on request was painted over the public page.
const report = () => {
  const bars = Array.from({ length: 30 }, (_, i) => ({ symbol: '005930', source: 'test', retrievedAt: '2026-10-06T00:00:00Z', date: '2026-09-' + String(i + 1).padStart(2, '0'), open: 100, high: 105, low: 95, close: 100 + i, volume: 1000 }));
  const r = buildDailyReport({ symbol: '005930', name: '삼성전자', date: '2026-09-30', generatedAt: new Date('2026-09-30T09:00:00Z'), bars, disclosures: [], sources: [] });
  r.commentary = { status: 'OK', generatedAt: '2026-09-30T09:00:00Z', model: 'test', summary: { text: '위원회는 강세로 봐요. 실적이 근거예요. 다만 환율은 변수예요.' }, bullish: [{ text: '실적', evidenceIds: [], kind: 'FACT' }], bearish: [{ text: '환율', evidenceIds: [], kind: 'FACT' }], uncertain: [], watch: [], dataGaps: [], evidence: [],
    analysts: [{ analyst: 'fundamental', stance: 'BULLISH', confidence: 60, target: 140, rationale: { text: '실적', evidenceIds: [], kind: 'INFERENCE' } }, { analyst: 'trend_momentum', stance: 'BEARISH', confidence: 55, target: 120, rationale: { text: '환율', evidenceIds: [], kind: 'INFERENCE' } }] } as any;
  return r;
};
const count = (html: string, s: string) => html.split(s).length - 1;

test('the deep part swaps in a conclusion card without a second 위원회 판단 page or verdict line', () => {
  const r = report();
  assert.ok(committeeHero(r), 'fixture shows the committee card on home');
  const page = renderReport(r, { index: 'index.html', live: true, deep: { date: r.date } } as any);
  assert.equal(count(page, 'id="committee"'), 1);
  const deep = renderDeep(r, { live: true });
  assert.equal(count(deep, 'id="committee"'), 0);
  assert.equal(count(deep, 'class="cl-line"'), 0);
  assert.equal(count(deep, 'id="home-conclusion"'), 1);
});

test('a report made on request: the AI tab carries no second question box, and the fresh verdict replaces the old one', () => {
  const f = reportFragments(report());
  assert.equal(count(f.ai!, 'id="join"'), 0);
  assert.match(JOBS_JS, /\['\.cl-head','#committee'\]\.forEach/);
});
