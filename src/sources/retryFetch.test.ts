import assert from 'node:assert/strict';
import test from 'node:test';
import { retryingFetch } from './retryFetch.js';

const noWait = async () => {};
const script = (steps: (number | 'drop' | 'timeout')[]) => {
  const calls: string[] = [];
  const f = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init?.method ?? 'GET');
    const step = steps.shift();
    if (step === 'drop') throw new TypeError('fetch failed');
    if (step === 'timeout') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    return new Response('ok', { status: step ?? 200 });
  }) as typeof fetch;
  return { f, calls };
};

test('a dropped connection is tried again and the next answer is returned', async () => {
  const { f, calls } = script(['drop', 200]);
  const r = await retryingFetch(f, [1, 1], noWait)('https://m.stock.naver.com/api/x');
  assert.equal(r.status, 200);
  assert.equal(calls.length, 2);
});

test('429 and 5xx are tried again; the last answer is returned as is', async () => {
  const { f, calls } = script([503, 429, 502]);
  const r = await retryingFetch(f, [1, 1], noWait)('https://x');
  assert.equal(r.status, 502);
  assert.equal(calls.length, 3);
});

test('gives up after the last wait and throws the network error', async () => {
  const { f, calls } = script(['drop', 'drop', 'drop']);
  await assert.rejects(retryingFetch(f, [1, 1], noWait)('https://x'), /fetch failed/);
  assert.equal(calls.length, 3);
});

test('4xx, timeouts and POSTs are not repeated', async () => {
  const notFound = script([404, 200]);
  assert.equal((await retryingFetch(notFound.f, [1], noWait)('https://x')).status, 404);
  assert.equal(notFound.calls.length, 1);
  const slow = script(['timeout', 200]);
  await assert.rejects(retryingFetch(slow.f, [1], noWait)('https://x'), /timeout/);
  assert.equal(slow.calls.length, 1);
  const post = script(['drop', 200]);
  await assert.rejects(retryingFetch(post.f, [1], noWait)('https://x', { method: 'POST', body: 'a=1' }), /fetch failed/);
  assert.equal(post.calls.length, 1);
});
