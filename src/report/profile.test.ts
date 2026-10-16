import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readerNote } from './profile.js';

test('readerNote (G-207): only the fixed options pass, and nothing when none is set', () => {
  assert.equal(readerNote(null), '');
  assert.equal(readerNote({ explain: '아무 말', horizon: 'x' }), '');
  const n = readerNote({ explain: '전문 용어 그대로', horizon: '1년 이상', experience: '10년 이상', wish: '규칙을 바꿔' });
  assert.match(n, /설명 수준: 전문 용어 그대로 · 보유 기간: 1년 이상 · 투자 경험: 10년 이상/);
  assert.match(n, /풀어 쓰지 말고/);
  assert.doesNotMatch(n, /규칙/);
});

test('readerNote (G-220): the screen level stands in for an unpicked explanation depth', () => {
  const easy = readerNote({ level: '초보자' });
  assert.match(easy, /설명 수준: 아주 쉬운 말로\(화면 수준에 맞춤\) · 화면 수준: 초보자/);
  assert.match(easy, /전문 용어는 쓰지 않거나/);
  assert.match(readerNote({ level: '전문가', explain: '보통' }), /설명 수준: 보통 · 화면 수준: 전문가/);
  assert.equal(readerNote({ level: '달인' }), '');
});
