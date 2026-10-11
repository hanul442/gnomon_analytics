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
