import assert from 'node:assert/strict';
import test from 'node:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { Disclosure, NewsItem, PriceBar } from '../types.js';
import { buildDailyReport } from '../report/dailyReport.js';
import { renderReport } from '../report/renderHtml.js';
import { buildEvidence, COMMENTARY_MODEL, sanitizeClaims, writeCommentary } from './commentary.js';

const AT = '2026-10-05T09:30:00.000Z';
const bars: PriceBar[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10);
  const close = 300000 + i * 1000;
  return { symbol: '000660', date, open: close, high: close + 500, low: close - 500, close, volume: 1_000_000, source: 'naver:fchart:day', retrievedAt: AT };
});
const filing: Disclosure = { receiptNo: '20260930000001', corpName: 'SK하이닉스', stockCode: '000660', title: '주요사항보고서(자기주식취득결정)', filer: 'SK하이닉스', filedDate: '2026-09-30', remark: '유', url: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260930000001', source: 'opendart:list', retrievedAt: AT };
const news: NewsItem = { url: 'https://www.yna.co.kr/1', title: 'SK하이닉스 3분기 영업이익 사상 최대', publisher: '연합뉴스', publishedAt: '2026-09-30T08:00:00.000Z', source: 'naver:news-search', retrievedAt: AT };
const report = buildDailyReport({ symbol: '000660', name: 'SK하이닉스', date: '2026-09-30', generatedAt: new Date(AT), bars, disclosures: [filing], sources: [], news: [news], newsStatus: [] });

test('evidence is numbered from the report itself', () => {
  const ids = buildEvidence(report).map((e) => e.id);
  assert.deepEqual(ids, ['P1', 'T1', 'F1', 'N1']);
  assert.equal(buildEvidence(report)[2]?.url, filing.url);
});

test('claims without a known evidence ID are dropped', () => {
  const { kept, dropped } = sanitizeClaims([
    { text: '근거 있음', evidenceIds: ['f1', 'X9'] },
    { text: '근거 없음', evidenceIds: ['X9'] },
    { text: '  ', evidenceIds: ['P1'] },
  ], new Set(['P1', 'F1']));
  assert.deepEqual(kept, [{ text: '근거 있음', evidenceIds: ['F1'] }]);
  assert.equal(dropped, 2);
});

function fakeClient(reply: unknown | Error, seen: unknown[] = []): Anthropic {
  return { beta: { messages: { parse: async (params: unknown) => { seen.push(params); if (reply instanceof Error) throw reply; return reply; } } } } as unknown as Anthropic;
}

test('a successful call keeps cited claims and records the model', async () => {
  const seen: unknown[] = [];
  const client = fakeClient({
    stop_reason: 'end_turn', model: COMMENTARY_MODEL,
    parsed_output: {
      summary: { text: '실적 기대와 자사주 매입이 겹쳤어요.', evidenceIds: ['N1', 'F1'] },
      bullish: [{ text: '사상 최대 실적 보도', evidenceIds: ['N1'] }, { text: '근거 없는 주장', evidenceIds: ['Z1'] }],
      bearish: [], uncertain: [{ text: '단기 과열 여부', evidenceIds: ['T1'] }],
      watch: [{ text: '실적 발표 확정치', evidenceIds: ['N1'] }], dataGaps: ['수급 데이터 없음'],
    },
  }, seen);
  const c = await writeCommentary(report, { client, now: () => new Date(AT) });
  assert.equal(c.status, 'OK');
  assert.equal(c.bullish.length, 1);
  assert.equal(c.dropped, 1);
  assert.equal(c.servedBy, COMMENTARY_MODEL);
  const params = seen[0] as Record<string, unknown>;
  assert.equal(params.model, 'claude-opus-5-5');
  assert.equal(params.fallbacks, 'default');
  assert.deepEqual(params.betas, ['server-side-fallback-2026-07-01']);
  assert.equal((params.output_config as { effort: string }).effort, 'medium');
  assert.match(JSON.stringify(params.messages), /N1/);
});

test('refusals, errors and a missing key never throw', async () => {
  const refused = await writeCommentary(report, { client: fakeClient({ stop_reason: 'refusal', stop_details: { category: 'cyber' }, model: COMMENTARY_MODEL, parsed_output: null }) });
  assert.deepEqual([refused.status, refused.error], ['FAILED', 'REFUSAL:cyber']);
  const broken = await writeCommentary(report, { client: fakeClient(new Error('network down')) });
  assert.deepEqual([broken.status, broken.error], ['FAILED', 'network down']);
  const skipped = await writeCommentary(report, {});
  assert.deepEqual([skipped.status, skipped.error], ['SKIPPED', 'ANTHROPIC_API_KEY_MISSING']);
});

test('the page shows claims with evidence chips, or why there is no commentary', async () => {
  const ok = { ...report, commentary: await writeCommentary(report, { client: fakeClient({ stop_reason: 'end_turn', model: COMMENTARY_MODEL, parsed_output: { summary: { text: '요약 <b>', evidenceIds: ['P1'] }, bullish: [{ text: '강세 이유', evidenceIds: ['F1'] }], bearish: [], uncertain: [], watch: [], dataGaps: [] } }) }) };
  const html = renderReport(ok, { index: '../index.html' });
  assert.ok(html.includes('요약 &lt;b&gt;'));
  assert.ok(html.includes(`href="${filing.url}"`));
  assert.ok(html.includes('강세 이유'));
  // With desk votes, the AI tab opens with a parliament of the committee.
  const voted = { ...ok, commentary: { ...ok.commentary, desks: [{ desk: 'TECHNICAL', stance: 'BULLISH', view: { text: '추세 위', evidenceIds: ['P1'] } }] } } as typeof ok;
  assert.ok(!html.includes('id="parliament-ai"') && renderReport(voted, { index: '../index.html' }).includes('id="parliament-ai"'));
  const failed = { ...report, commentary: await writeCommentary(report, {}) };
  assert.match(renderReport(failed, { index: '../index.html' }), /AI 해설이 없어요: API 키가 설정되지 않았어요/);
});

test('the committee keeps desk views, the red team and three scenarios, each citing evidence', async () => {
  const client = fakeClient({
    stop_reason: 'end_turn', model: COMMENTARY_MODEL,
    parsed_output: {
      summary: { text: '요약', evidenceIds: ['P1'] },
      desks: [
        { desk: 'TECHNICAL', stance: 'BULLISH', view: { text: '이동평균 위', evidenceIds: ['T1'] } },
        { desk: 'FLOW', stance: 'INSUFFICIENT_DATA', view: { text: '근거 없음', evidenceIds: ['Q9'] } },
      ],
      redTeam: { counterargument: { text: '과열', evidenceIds: ['P1'] }, unresolved: ['수급 해석', ' '] },
      scenarios: [
        { kind: 'BULL', narrative: { text: '돌파', evidenceIds: ['T1'] }, catalysts: ['실적'], invalidation: ['170만 원 이탈'] },
        { kind: 'BASE', narrative: { text: '횡보', evidenceIds: ['P1'] }, catalysts: [], invalidation: [] },
        { kind: 'BEAR', narrative: { text: '하락', evidenceIds: ['ZZ'] }, catalysts: [], invalidation: [] },
      ],
      analysts: [
        { analyst: 'trend_momentum', stance: 'BULLISH', confidence: 140, target: 330000, rationale: { text: '추세 유지', evidenceIds: ['T1'] } },
        { analyst: 'fundamental', stance: 'BEARISH', confidence: 50, target: 0, rationale: { text: '가격 없음', evidenceIds: ['P1'] } },
      ],
      bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [],
    },
  });
  const c = await writeCommentary(report, { client, now: () => new Date(AT) });
  assert.deepEqual(c.desks?.map((d) => [d.desk, d.stance]), [['TECHNICAL', 'BULLISH']]);
  assert.deepEqual(c.redTeam?.unresolved, ['수급 해석']);
  assert.deepEqual(c.scenarios?.map((s) => s.kind), ['BULL', 'BASE']);
  assert.equal(c.dropped, 2);
  assert.equal(c.promptVersion, 'gnm-committee-v3');
  // Confidence is clamped to 0–100; a non-positive target drops the analyst.
  assert.deepEqual(c.analysts?.map((a) => [a.analyst, a.confidence, a.target]), [['trend_momentum', 100, 330000]]);
});
