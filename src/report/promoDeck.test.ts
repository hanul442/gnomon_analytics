import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deckInstaCaption, deckSlides, deckXCaption, hookOf, plain, scoreDateOf } from './promoDeck.js';
import type { PromoCall, PromoDay, PromoOpinion } from './promoCards.js';
import { checkText, xWithoutLink } from './promoPost.js';
import { xWeight } from './promoCards.js';

const day = (o: Partial<PromoDay> = {}): PromoDay => ({
  date: '2026-11-02', weekday: '월', summary: '한국 증시는 2.24% 상승으로 마감했고, 반도체·방산 등 주요 종목들이 상승을 주도했어요. 둘째 문장이에요.',
  indices: [{ name: '코스피', pct: 2.24 }, { name: '코스닥', pct: 1.38 }, { name: '미국 반도체', pct: -3.22 }],
  breadth: { group: '코스피', total: 868, up: 157, flat: 75, down: 636 }, scored: [], week: [], weekFrom: '2026-11-02', ...o,
});
const op = (o: Partial<PromoOpinion> = {}): PromoOpinion => ({
  symbol: '000000', name: '삼미금속', date: '2026-11-02', seats: Array.from({ length: 7 }, (_, i) => ({ member: `위원${i}`, stance: i ? 'BEARISH' : 'BULLISH' })),
  bull: 1, neutral: 0, bear: 6, lead: 'BEARISH', leadCount: 6, invalidation: 9510, scoreDate: '2026-11-30', ...o,
});
const call = (o: Partial<PromoCall>): PromoCall => ({ symbol: 'A', name: '가', analyst: 'x', member: '추세 PM', stance: 'BULLISH', baseDate: '2026-10-02', outcomeDate: '2026-11-02', hit: true, movePct: 5, brokeOn: null, ...o });

test('hookOf: market vs committee contrast comes first', () => {
  const h = hookOf(day(), [op()]);
  assert.equal(h.kind, 'contrast');
  assert.equal(plain(h.pre), '코스피는 2.24% 올랐는데');
  assert.match(plain(h.main), /73%가\n'내린다'고/);
});

test('hookOf falls back in order: scored → consensus → world → breadth', () => {
  const calm = { indices: [{ name: '코스피', pct: 0.1 }, { name: '미국 반도체', pct: -0.5 }] };
  assert.equal(hookOf(day({ ...calm, scored: [call({})] }), [op()]).kind, 'scored');
  assert.equal(hookOf(day(calm), [op()]).kind, 'consensus');
  assert.equal(hookOf(day({ indices: [{ name: '코스피', pct: 0.1 }, { name: '미국 반도체', pct: -3.2 }] }), []).kind, 'world');
  assert.equal(hookOf(day(calm), []).kind, 'breadth');
  assert.equal(hookOf(day({ ...calm, breadth: null }), []).kind, 'plain');
});

test('deckSlides: cover first, CTA last, weekly slides only on a week with scores', () => {
  const roles = (d: PromoDay, w: boolean) => deckSlides(d, [op(), op({ name: '현대글로비스' })], '.', w).map((s) => s.role);
  assert.deepEqual(roles(day(), false), ['cover', 'market', 'breadth', 'opinion1', 'opinion2', 'how', 'cta']);
  assert.deepEqual(roles(day(), true), ['cover', 'market', 'breadth', 'opinion1', 'opinion2', 'how', 'cta']);
  const wk = [call({}), call({ symbol: 'B', name: '나', hit: false, movePct: -8 })];
  assert.deepEqual(roles(day({ week: wk, scored: wk }), true), ['cover', 'market', 'breadth', 'scored', 'opinion1', 'opinion2', 'week', 'miss', 'how', 'cta']);
  const html = deckSlides(day(), [op()], '.', false)[0]!.html;
  assert.ok(html.includes('white-space:nowrap"><span class="down">73%</span>가</span>'));
});

test('captions open with the hook and pass the posting check', () => {
  const d = day(), ops = [op(), op({ name: '현대글로비스', lead: 'BULLISH', bull: 6, bear: 1 })];
  const insta = deckInstaCaption(d, ops), x = deckXCaption(d, ops, 'https://example.com/');
  assert.ok(insta.startsWith("코스피는 2.24% 올랐는데 AI 위원회는 73%가 '내린다'고 봤어요."));
  assert.deepEqual(checkText(insta, 'insta'), []);
  assert.deepEqual(checkText(x, 'x'), []);
  assert.ok(xWeight(xWithoutLink(x)) <= 280);
  assert.equal(scoreDateOf('2026-11-02'), '2026-11-30');
});
