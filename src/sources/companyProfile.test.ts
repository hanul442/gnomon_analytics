import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchCompanyProfile, parseWiseMix, parseWiseOverview, rankInIndustry } from './companyProfile.js';

// As WiseReport and Naver answered for 삼성전자 on 2026-10-11, trimmed.
const FX = JSON.parse(readFileSync(join(process.cwd(), 'test', 'fixtures', 'company-profile.json'), 'utf8')) as {
  wise1: string; wise2: string; integration: unknown; basic: unknown; industry: { stocks: unknown[] };
};

test('company card (G-200): overview sentences, their date and the WICS sector', () => {
  const o = parseWiseOverview(FX.wise1);
  assert.equal(o.summary.length, 3);
  assert.match(o.summary[0]!, /^동사는 1969년 설립된 글로벌 전자 기업/);
  assert.equal(o.asOf, '2026-09-14');
  assert.equal(o.sector, '반도체와반도체장비');
  assert.deepEqual(parseWiseOverview('<html></html>'), { summary: [], asOf: null, sector: null });
});

test('sales mix: largest first, as reported, with its period', () => {
  const m = parseWiseMix(FX.wise2)!;
  assert.equal(m.asOf, '2026-06');
  assert.deepEqual(m.items[0], ['DS(반도체 등)', 68.52]);
  assert.equal(m.items.length, 4);
  assert.equal(parseWiseMix('<script>var chartData1 = [];</script>'), null);
  assert.equal(parseWiseMix('no chart'), null);
});

test('industry rank: common stocks only, by market value', () => {
  const r = rankInIndustry([FX.industry], '000660')!;
  assert.equal(r.name, '반도체와반도체장비');
  assert.equal(r.rank, 2);
  assert.equal(r.top[0]![1], '삼성전자');
  assert.ok(!r.top.some((t) => t[0] === '005935'), 'preferred shares are left out');
  assert.equal(rankInIndustry([FX.industry], '999990')!.rank, null);
  assert.equal(rankInIndustry([{}], '000660'), null);
});

test('fetch: all parts together; a failed part only blanks itself; nothing known is null, nothing reachable throws', async () => {
  const fake = (fail: (u: string) => boolean) => (async (url: string | URL | Request) => {
    const u = String(url);
    if (fail(u)) return new Response('no', { status: 500 });
    if (u.includes('c1010001')) return new Response(FX.wise1);
    if (u.includes('c1020001')) return new Response(FX.wise2);
    if (u.includes('/basic')) return Response.json(FX.basic);
    if (u.includes('/integration')) return Response.json(FX.integration);
    if (u.includes('/industry/')) return Response.json(u.includes('page=1') ? FX.industry : { stocks: [] });
    return new Response('no', { status: 404 });
  }) as typeof fetch;
  const p = (await fetchCompanyProfile('005930', fake(() => false)))!;
  assert.equal(p.name, '삼성전자');
  assert.equal(p.market, '코스피');
  assert.match(p.logo!, /^https:\/\/ssl\.pstatic\.net\//);
  assert.equal(p.industry!.rank, 1);
  assert.equal(p.mix!.items.length, 4);
  assert.equal(p.partial, undefined);
  const noMix = (await fetchCompanyProfile('005930', fake((u) => u.includes('c1020001'))))!;
  assert.equal(noMix.mix, null);
  assert.equal(noMix.summary.length, 3);
  assert.equal(noMix.partial, true, 'a source was down: the caller keeps it only briefly');
  const badPage = (await fetchCompanyProfile('005930', fake((u) => u.includes('page=2'))))!;
  assert.equal(badPage.industry, null, 'a missing industry page gives no rank rather than a wrong one');
  assert.equal(badPage.partial, true);
  await assert.rejects(fetchCompanyProfile('005930', fake(() => true)), /COMPANY_UPSTREAM/, 'an outage is an error, not "no company"');
  const none = (async () => new Response('no', { status: 404 })) as typeof fetch;
  assert.equal(await fetchCompanyProfile('999990', none), null);
  await assert.rejects(fetchCompanyProfile('AAPL.O', fake(() => false)), /BAD_CODE/);
});

test('an ETF has no card and costs one call; an industry list is fetched once for all its stocks', async () => {
  const asked: string[] = [];
  const f = (async (url: string | URL | Request) => {
    const u = String(url); asked.push(u);
    if (u.includes('/069500/basic')) return Response.json({ stockName: 'KODEX 200', stockEndType: 'etf' });
    if (u.includes('c1010001')) return new Response(FX.wise1);
    if (u.includes('c1020001')) return new Response(FX.wise2);
    if (u.includes('/basic')) return Response.json(FX.basic);
    if (u.includes('/integration')) return Response.json(FX.integration);
    if (u.includes('/industry/')) return Response.json(u.includes('page=1') ? FX.industry : { stocks: [] });
    return new Response('no', { status: 404 });
  }) as typeof fetch;
  assert.equal(await fetchCompanyProfile('069500', f), null);
  assert.equal(asked.length, 1);
  const memo = new Map();
  await fetchCompanyProfile('005930', f, new Date(), memo);
  const lists = () => asked.filter((u) => u.includes('/industry/')).length, once = lists();
  const again = (await fetchCompanyProfile('000660', f, new Date(), memo))!;
  assert.equal(lists(), once, 'the second stock of the industry reuses the list');
  assert.equal(again.industry!.rank, 2);
});
