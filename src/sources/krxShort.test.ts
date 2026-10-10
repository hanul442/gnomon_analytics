import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchKrxShort, parseKrxFinder, parseKrxShort, parseNaverDeposit, parseNaverVolume } from './krxShort.js';

// As KRX and Naver answered on 2026-10-10, trimmed.
const FX = JSON.parse(readFileSync(join(process.cwd(), 'test', 'fixtures', 'krx-short.json'), 'utf8')) as Record<string, unknown>;
const AT = new Date('2026-10-10T11:00:00Z');

test('short selling (G-195): oldest first, the balance blank until it is reported (T+2)', () => {
  const d = parseKrxShort(FX.short);
  assert.ok(d.length >= 10);
  assert.ok(d[0]![0] < d.at(-1)![0]);
  assert.deepEqual(d.at(-1), ['2026-10-08', 1373854, 365181966750, null, null]);
  assert.deepEqual(d.find((x) => x[0] === '2026-10-06'), ['2026-10-06', 795306, 216657212000, 5765855, 1568312560000]);
  assert.throws(() => parseKrxShort({}), /KRX_SHORT_UNEXPECTED/);
});

test('ISIN, volume and market credit', () => {
  assert.equal(parseKrxFinder(FX.finder, '005930'), 'KR7005930003');
  assert.equal(parseKrxFinder(FX.finder, '000660'), null, 'only the code asked');
  const v = parseNaverVolume(FX.trend);
  assert.deepEqual(v.at(-1), ['2026-10-08', 20157893]);
  const c = parseNaverDeposit(FX.deposit);
  assert.deepEqual(c.at(-1), ['2026-10-06', 1010486, 331299]);
  assert.ok(c[0]![0] < c.at(-1)![0]);
  assert.deepEqual(parseNaverDeposit(null), []);
});

test('fetch: the finder once per code, three parts in parallel, an unknown code is null', async () => {
  const asked: string[] = [];
  const fake = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url), body = String(init?.body ?? '');
    asked.push(u.includes('krx') ? new URLSearchParams(body).get('bld')! : u);
    if (u.includes('krx')) return Response.json(body.includes('finder') ? (body.includes('999999') ? { block1: [] } : FX.finder) : FX.short);
    if (u.includes('trendDeposit')) return Response.json(FX.deposit);
    if (u.includes('/trend')) return Response.json(FX.trend);
    return new Response('no', { status: 404 });
  }) as typeof fetch;
  const cache = new Map<string, string>();
  const s = (await fetchKrxShort('005930', fake, AT, cache))!;
  assert.equal(s.isin, 'KR7005930003');
  assert.ok(s.days.length && s.volume.length && s.credit.length);
  await fetchKrxShort('005930', fake, AT, cache);
  assert.equal(asked.filter((x) => x === 'dbms/comm/finder/finder_srtisu').length, 1, 'the ISIN is remembered');
  assert.equal(await fetchKrxShort('999999', fake, AT, cache), null);
  await assert.rejects(fetchKrxShort('AAPL.O', fake, AT), /BAD_CODE/);
});
