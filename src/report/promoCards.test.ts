import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blogText, instaCaption, mondayOf, pickLines, promoDay, scoreCalls, storyHtml, worstMiss, xCaption, xHtml, xWeight, type PromoCall } from './promoCards.js';
import type { AnalystCall } from '../analysis/analysts.js';

const bars = Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, close: 100 + i }));
const call = (analyst: AnalystCall['analyst'], stance: AnalystCall['stance'], target: number, extra: Partial<AnalystCall> = {}): AnalystCall =>
  ({ symbol: 'X', analyst, reportDate: '2026-10-01', baseDate: '2026-10-01', baseClose: 100, stance, confidence: 60, target, promptVersion: 'v', madeAt: '2026-10-01T10:00:00Z', ...extra });

test('scoreCalls scores a call on its 20th session and leaves younger ones out', () => {
  const out = scoreCalls('X', '엑스', [call('trend_momentum', 'BULLISH', 120), call('mean_reversion', 'BEARISH', 90), call('fundamental', 'BULLISH', 120, { baseDate: '2026-10-20' })], bars);
  assert.equal(out.length, 2);
  assert.equal(out[0]!.outcomeDate, '2026-10-21');
  assert.deepEqual(out.map((x) => x.hit), [true, false]);
  assert.equal(out[1]!.member, '평균회귀 PM');
  assert.ok(Math.abs(out[0]!.movePct - 20) < 1e-9);
});

test('scoreCalls notes the day an invalidation price was crossed', () => {
  const down = bars.map((b, i) => ({ ...b, close: 100 - i }));
  const [x] = scoreCalls('X', '엑스', [call('trend_momentum', 'BULLISH', 120, { invalidation: 95 })], down);
  assert.equal(x!.hit, false);
  assert.equal(x!.brokeOn, '2026-10-07');
});

const pc = (o: Partial<PromoCall>): PromoCall => ({ symbol: 'A', name: '가', analyst: 'trend_momentum', member: '추세·모멘텀 PM', stance: 'BULLISH', baseDate: '2026-10-02', outcomeDate: '2026-10-30', hit: true, movePct: 5, brokeOn: null, ...o });
const market = {
  date: '2026-10-30',
  groups: [{ id: 'M1', name: '코스피', temperature: { buckets: { BULLISH: 10, NEUTRAL: 5, BEARISH: 85 } } }],
  world: { indices: [{ key: 'KOSPI', name: '코스피', changePct: -3.48 }, { key: '.SOX', name: '필라델피아 반도체', changePct: -7.6 }] },
  ai: { summary: { text: '코스피가 내렸어요. 반도체가 약했어요. 내일은 금리를 봐요.' } },
};

test('promoDay picks the day, the week from Monday, indices and breadth', () => {
  const d = promoDay(market, [pc({}), pc({ outcomeDate: '2026-10-27', hit: false }), pc({ outcomeDate: '2026-10-23' })]);
  assert.equal(mondayOf('2026-10-30'), '2026-10-26');
  assert.equal(d.weekday, '금');
  assert.equal(d.scored.length, 1);
  assert.equal(d.week.length, 2);
  assert.deepEqual(d.indices.map((x) => x.name), ['코스피', '미국 반도체']);
  assert.deepEqual(d.breadth, { group: '코스피', up: 10, flat: 5, down: 85, total: 100 });
  assert.ok(d.summary.startsWith('코스피가 내렸어요.'));
});

test('cards show misses, never returns of ours, and always carry the education note', () => {
  const d = promoDay(market, [pc({}), pc({ symbol: 'B', name: '나', hit: false, movePct: -12 })]);
  for (const html of [storyHtml(d, '.'), xHtml(d, '.')]) {
    assert.ok(html.includes('틀림'));
    assert.ok(!/수익률|매수|매도|목표가/.test(html));
  }
  assert.ok(storyHtml(d, '.').includes('투자 권유가 아닌 교육용 자료예요'));
  assert.equal(pickLines(d.scored, 1)[0]!.name, '나');
  assert.equal(worstMiss(d.week)!.name, '나');
  for (const t of [instaCaption(d), blogText(d), xCaption(d)]) assert.ok(t.includes('교육용') && !/수익률|매수|매도/.test(t));
});

test('the X post stays within 280 weighted characters', () => {
  const long = { ...market, ai: { summary: { text: '가'.repeat(140) + '요. ' + '나'.repeat(100) + '요.' } } };
  const t = xCaption(promoDay(long, [pc({})]));
  assert.ok(xWeight(t.replace(/https?:\/\/\S+/g, 'x'.repeat(23))) <= 280, t);
});

test('a day with nothing scored says so instead of showing zeros', () => {
  const d = promoDay(market, []);
  assert.ok(storyHtml(d, '.').includes('20거래일이 끝난 판단이 없어요'));
  assert.ok(xCaption(d).includes('채점할 판단이 없었어요'));
});
