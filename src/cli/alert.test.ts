import assert from 'node:assert/strict';
import test from 'node:test';
import { alertFor, scrub, type LastRun } from './alert.js';

const base: LastRun = { at: '2026-10-05T09:40:00.000Z', selected: null, universe: [{ source: 'naver:m-stock:marketValue', ok: true, count: 2768 }], stocks: [{ symbol: '000660', report: 'SKIPPED', failedSources: [] }], failed: [] };

test('a healthy run does not alert; news failures are listed but do not alert', () => {
  assert.equal(alertFor(base).alert, false);
  const news = { ...base, stocks: [{ symbol: '000660', report: 'SKIPPED', failedSources: [{ source: 'google:news-rss', error: 'HTTP 503' }] }] };
  const r = alertFor(news);
  assert.equal(r.alert, false);
  assert.match(r.body, /참고.*1건[\s\S]*google:news-rss/);
});

test('failed stocks, the stock list and daily prices alert', () => {
  assert.equal(alertFor({ ...base, failed: [{ symbol: '999990', error: 'HTTP 500' }] }).alert, true);
  assert.equal(alertFor({ ...base, universe: [{ source: 'naver:m-stock:marketValue', ok: false, count: 0, error: 'timeout' }] }).alert, true);
  const r = alertFor({ ...base, stocks: [{ symbol: '005930', report: 'SKIPPED', failedSources: [{ source: 'naver:fchart:day:KOSPI', error: 'HTTP 500' }] }] });
  assert.equal(r.alert, false); // an index, not the stock's own prices
  assert.match(alertFor({ ...base, failed: [{ symbol: '999990', error: 'x' }] }).title, /^실행 경보: 2026-10-05 09:40 UTC 실행에서 1건 실패$/);
});

test('credentials never reach the issue', () => {
  assert.equal(scrub('GET https://opendart.fss.or.kr/api/list.json?crtfc_key=abc123&corp_code=1 failed'), 'GET https://opendart.fss.or.kr/api/list.json failed');
  assert.equal(scrub('bad crtfc_key=abc123 here'), 'bad crtfc_key=*** here');
  assert.ok(!alertFor({ ...base, failed: [{ symbol: '1', error: 'token=SECRET1' }] }).body.includes('SECRET1'));
});
