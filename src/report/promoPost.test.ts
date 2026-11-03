import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkText, modeOf, oauth1Header, planDay, xWithoutLink } from './promoPost.js';
import { PROMO_NOTE, xWeight } from './promoCards.js';

const all = ['x.png', 'x.txt', 'insta.txt', 'story.png', 'story.jpg', 'opinion1.jpg', 'opinion2.jpg', 'cover.jpg', 'miss.jpg', 'cover.png', 'miss.png'];
const texts = { x: `x (${PROMO_NOTE})`, insta: `insta ${PROMO_NOTE}` };

test('planDay: X and a story every weekday, the feed on Mon/Wed/Fri, nothing on weekends', () => {
  assert.deepEqual(planDay('2026-11-03', all, texts).map((p) => p.channel), ['x', 'story']); // Tue
  assert.deepEqual(planDay('2026-11-02', all, texts).map((p) => p.channel), ['x', 'story', 'insta']); // Mon
  assert.deepEqual(planDay('2026-11-02', all, texts).at(-1)!.images, ['opinion1.jpg', 'opinion2.jpg']);
  const fri = planDay('2026-11-06', all, { ...texts, blog: `blog ${PROMO_NOTE}` });
  assert.deepEqual(fri.map((p) => p.channel), ['x', 'story', 'insta', 'blog']);
  assert.deepEqual(fri[2]!.images, ['cover.jpg', 'miss.jpg', 'opinion1.jpg', 'opinion2.jpg']);
  assert.deepEqual(planDay('2026-11-07', all, texts), []);
});

test('planDay: a PNG-only day (before JPEGs) gets no Instagram posts', () => {
  assert.deepEqual(planDay('2026-11-02', ['x.png', 'story.png', 'opinion1.png'], texts).map((p) => p.channel), ['x']);
});

test('checkText stops advice, returns and money talk, and wants the education note', () => {
  assert.deepEqual(checkText(`위원회가 오른다고 봤어요. ${PROMO_NOTE}`, 'x'), []);
  assert.deepEqual(checkText('오늘 시장', 'story'), []);
  assert.ok(checkText(`지금 사세요 ${PROMO_NOTE}`, 'x').includes('사라·팔라'));
  assert.ok(checkText(`누적 수익률 30% ${PROMO_NOTE}`, 'insta').includes('수익률·수익 이야기'));
  assert.ok(checkText(`목표가 5만원 ${PROMO_NOTE}`, 'x').includes('종목 추천·목표가'));
  assert.ok(checkText(`VIP 리딩방 ${PROMO_NOTE}`, 'x').length >= 2);
  assert.ok(checkText('안내 없이 쓴 글', 'blog').some((p) => p.includes(PROMO_NOTE)));
});

test('modeOf defaults to off', () => {
  assert.equal(modeOf(undefined), 'off');
  assert.equal(modeOf('yes'), 'off');
  assert.equal(modeOf('manual'), 'manual');
  assert.equal(modeOf('on'), 'on');
});

test('oauth1Header matches the X docs example signature', () => {
  // https://developer.x.com/en/docs/authentication/oauth-1-0a/creating-a-signature (its body params put in the query; both are signed the same way)
  const h = oauth1Header('POST', `https://api.twitter.com/1.1/statuses/update.json?include_entities=true&status=${encodeURIComponent('Hello Ladies + Gentlemen, a signed OAuth request!')}`,
    { consumerKey: 'xvz1evFS4wEEPTGEFPHBog', consumerSecret: 'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw', token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb', tokenSecret: 'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE' },
    'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg', '1318622958');
  assert.match(h, /^OAuth oauth_consumer_key="xvz1evFS4wEEPTGEFPHBog", /);
  assert.match(h, /oauth_signature="hCtSmYh%2BiHYCEqBWrE7C7hYmtUk%3D"$/);
});

test('xWithoutLink swaps the site line for a profile pointer', () => {
  assert.equal(xWithoutLink('a\n\nhttps://x.y/?utm_source=x\n(b)'), 'a\n\n전체 리포트는 프로필 링크에서\n(b)');
});

test('xWithoutLink keeps a long post under 280', () => {
  const long = `11.2 그노몬\n${'가나다라 '.repeat(25)}\n\nhttps://x.y/\n(${PROMO_NOTE})`;
  const out = xWithoutLink(long);
  assert.ok(xWeight(out) <= 280);
  assert.ok(out.split('\n')[1]!.endsWith('…'));
});
