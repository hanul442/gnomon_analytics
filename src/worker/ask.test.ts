import assert from 'node:assert/strict';
import test from 'node:test';
import { askParams } from './ask.js';

test('changing questions, UI tabs, or history preserves the cached stock prefix', () => {
  const input = { tier: 'standard' as const, symbol: '000660', siteData: '고정된 종목 자료', persona: { name: '전문가', focus: '업황' } };
  const first = askParams({ ...input, question: '첫 질문', page: '첫 화면' });
  const next = askParams({ ...input, question: '둘째 질문', page: '다른 화면', history: [{ q: '첫 질문', a: '답변' }] });
  assert.deepEqual(first.system, next.system);
  const a = first.messages as { role: string; content: unknown }[];
  const b = next.messages as { role: string; content: unknown }[];
  assert.deepEqual(a[0], b[0]);
  assert.match(JSON.stringify(a[0]), /cache_control/);
  assert.doesNotMatch(JSON.stringify(a[0]), /첫 질문|첫 화면/);
  assert.doesNotMatch(JSON.stringify(b.at(-1)), /cache_control/);
  assert.notDeepEqual(a[0], (askParams({ ...input, siteData: '갱신된 자료', question: 'q' }).messages as unknown[])[0]);
  const other = askParams({ ...input, persona: { name: '다른 전문가', focus: '수급' }, question: 'q' });
  assert.deepEqual((first.system as unknown[])[0], (other.system as unknown[])[0]);
});

test('short Haiku calls do not request cache writes or thinking', () => {
  const params = askParams({ tier: 'question', question: '조건 만들기', siteData: '짧은 자료' });
  assert.doesNotMatch(JSON.stringify(params), /cache_control/);
  assert.equal(params.thinking, undefined);
});
