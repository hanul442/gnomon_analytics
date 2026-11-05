import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchDaily } from './dispatch.js';

test('without a token nothing is sent', async () => {
  let called = false;
  const r = await dispatchDaily({}, (async () => { called = true; return new Response(null, { status: 204 }); }) as typeof fetch);
  assert.equal(called, false);
  assert.equal(r.ok, false);
});

test('starts daily.yml on main with the token', async () => {
  let url = '', init: RequestInit | undefined;
  const r = await dispatchDaily({ GH_DISPATCH_TOKEN: 't0k' }, (async (u: RequestInfo | URL, i?: RequestInit) => { url = String(u); init = i; return new Response(null, { status: 204 }); }) as typeof fetch);
  assert.equal(r.ok, true);
  assert.equal(url, 'https://api.github.com/repos/hanul442/gnomon_analytics/actions/workflows/daily.yml/dispatches');
  assert.equal(init?.method, 'POST');
  assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer t0k');
  assert.deepEqual(JSON.parse(String(init?.body)), { ref: 'main' });
});

test('a refused dispatch reports the status', async () => {
  const r = await dispatchDaily({ GH_DISPATCH_TOKEN: 'bad' }, (async () => new Response('Bad credentials', { status: 401 })) as typeof fetch);
  assert.deepEqual(r, { ok: false, status: 401, reason: 'Bad credentials' });
});
