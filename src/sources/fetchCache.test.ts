import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { recordingFetch, replayingFetch } from './fetchCache.js';

const fake = (calls: string[], status = 200) => (async (input: RequestInfo | URL, init?: RequestInit) => {
  calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
  return new Response(`body of ${String(input)}`, { status, headers: { 'content-type': 'text/xml;charset=EUC-KR' } });
}) as typeof fetch;

test('a recorded GET is replayed without the network; a miss and a POST go out', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gnm-cache-'));
  try {
    const live: string[] = [];
    const rec = recordingFetch(fake(live), dir);
    assert.equal(await (await rec('https://fchart.stock.naver.com/a?key=SECRET')).text(), 'body of https://fchart.stock.naver.com/a?key=SECRET');
    assert.ok((await readdir(dir)).every((f) => !f.includes('SECRET')));
    const later: string[] = [];
    const rep = replayingFetch(fake(later), dir, 60_000);
    const hit = await rep('https://fchart.stock.naver.com/a?key=SECRET');
    assert.equal(await hit.text(), 'body of https://fchart.stock.naver.com/a?key=SECRET');
    assert.equal(hit.headers.get('content-type'), 'text/xml;charset=EUC-KR');
    await rep('https://fchart.stock.naver.com/b');
    await rep('https://fchart.stock.naver.com/a?key=SECRET', { method: 'POST' });
    assert.deepEqual(later, ['GET https://fchart.stock.naver.com/b', 'POST https://fchart.stock.naver.com/a?key=SECRET']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('errors are not recorded and old recordings are not replayed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gnm-cache-'));
  try {
    await recordingFetch(fake([], 503), dir)('https://x/err');
    assert.deepEqual(await readdir(dir).catch(() => []), []);
    await recordingFetch(fake([]), dir)('https://x/old');
    const old = new Date(Date.now() - 2 * 86_400_000);
    for (const f of await readdir(dir)) await utimes(join(dir, f), old, old);
    const live: string[] = [];
    await replayingFetch(fake(live), dir, 36 * 3_600_000)('https://x/old');
    assert.deepEqual(live, ['GET https://x/old']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
