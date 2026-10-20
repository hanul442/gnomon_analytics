import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHome, renderReportsPage } from './renderHome.js';
import { watchInfo } from './conclusion.js';
import type { HomeEntry } from './renderHtml.js';
import type { DailyReport } from './dailyReport.js';

const entry = (symbol: string, changePct: number, kind: HomeEntry['kind'] = 'stock'): HomeEntry => ({
  symbol, name: symbol, href: `${symbol}/index.html`, group: 'daily', pickDate: '2026-10-06', kind, reasons: ['테스트'],
  report: { symbol, name: symbol, date: '2026-10-06', headline: '한 줄', price: { close: 100, changePct, volume: 1, volumeRatio20: 1 } } as unknown as DailyReport,
});

test('home: no view bar or market tabs, and no picks, saved screens or search box (G-264)', () => {
  const html = renderHome({ entries: [entry('AAA', 9), entry('BBB', 0.1, 'etf')], selection: null, universe: null, pulse: null, indices: [] });
  assert.ok(!html.includes('id="pz-note"') && !html.includes('class="mkt-tabs"'));
  for (const gone of ['id="today"', 'id="myscreens"', 'class="top-search"', 'id="more"', 'class="home-rail"', 'id="home-filings"']) assert.ok(!html.includes(gone), gone);
});

test('the shared scripts parse (a bad escape in a template once broke every page)', async () => {
  const { APP_JS, UI_JS } = await import('./renderHtml.js');
  for (const js of [APP_JS, UI_JS]) assert.doesNotThrow(() => new Function(js));
});

test('G-231: a live page rebuilt today is not a report made today; lists, pills and watchinfo use the dated report', () => {
  const live = (symbol: string, reportDate: string | null): HomeEntry => ({
    symbol, name: symbol, href: `${symbol}/index.html`, group: 'core', reportDate,
    report: { symbol, name: symbol, date: '2026-10-17', headline: '한 줄', commentary: { status: 'OK', tier: 'deep' }, price: { close: 100, changePct: 1, volume: 1, volumeRatio20: 1, sessionDate: '2026-10-16' } } as unknown as DailyReport,
  });
  const entries = [live('OLD', '2026-10-05'), live('NEW', '2026-10-16'), live('NONE', null)];
  const html = renderReportsPage({ entries, selection: null, universe: null, pulse: null, indices: [] });
  assert.match(html, /10\/16 나온 리포트 1개/);
  assert.ok(!html.includes('10/17 나온 리포트') && !html.includes('위원회 10/17'), 'the run date is never shown as the report date');
  assert.ok(html.includes('위원회 10/05') && html.includes('위원회 10/16'));
  const today = html.slice(html.indexOf('id="today-list"'), html.indexOf('</section>', html.indexOf('id="today-list"')));
  assert.ok(today.includes('NEW/index.html') && !today.includes('OLD/index.html') && !today.includes('NONE/index.html'));
  const info = watchInfo(entries);
  assert.deepEqual([info.OLD!.d, info.NEW!.d, info.NONE!.d], ['2026-10-05', '2026-10-16', '']);
});

test('G-264: home is the date with the market in one line, my stocks, three issues and the scorecard line', async () => {
  const { marketPulse } = await import('../analysis/quickCalc.js');
  const calcs = [['BEARISH', 20], ['BULLISH', 80], ['NEUTRAL', 50]].map(([level, score]) => ({ date: '2026-10-16', signal: { level, score: Number(score) / 100 }, moves: [{ days: 20, pct: 0 }] }));
  const html = renderHome({ entries: [entry('AAA', 9), entry('BBB', 1)], selection: null, universe: null, pulse: marketPulse(calcs as never), indices: [{ symbol: 'KOSPI', name: '코스피', date: '2026-10-16', close: 5668.05, changePct: 2.05, closes: [] }] });
  assert.match(html, /<h1 class="hh-d">10월 16일<\/h1>/);
  assert.match(html, /코스피 <b>5,668\.05<\/b> <span class="up">/);
  for (const gone of ['class="mh-v"', 'class="mh-bar"', 'class="mh-go"', 'class="ml-row"']) assert.ok(!html.includes(gone), gone);
  assert.ok(html.indexOf('id="mkt-hero"') < html.indexOf('id="banner"') && html.indexOf('id="banner"') < html.indexOf('id="watch-slot"') && html.indexOf('id="watch-slot"') < html.indexOf('id="watch"') && html.indexOf('id="watch"') < html.indexOf('id="news-issues"'), 'date, the notice line, mine, then issues');
  assert.ok(html.includes('<h2>내 종목 오늘</h2>') && html.includes('wl-rail'));
});

test('G-245: five tabs, no 전체 sheet, sibling pages as modes, and the 나 tab', async () => {
  const { tabBar, modeBar } = await import('./ui.js');
  const { renderSettings } = await import('./renderSettings.js');
  const bar = tabBar('', 'bottom');
  assert.deepEqual([...bar.matchAll(/aria-label="([^"]+)" data-tab-link/g)].map((m) => m[1]), ['홈', '찾기', '위원회', '나']);
  assert.ok(!bar.includes('data-all-menu'));
  const themes = modeBar('', 'themes.html');
  assert.ok(themes.includes('<a href="themes.html" aria-current="page">테마</a>') && themes.includes('href="signals.html"') && themes.includes('href="screener.html#etf"'));
  assert.ok(modeBar('', 'scorecard.html').includes('href="reports.html"'));
  assert.equal(modeBar('', 'index.html'), '');
  const me = renderSettings();
  assert.ok(me.includes('class="me-acct"') && me.includes('id="sm-admin"') && me.includes('id="help"') && me.includes('href="guide.html"'));
  assert.ok(!me.includes('id="side-menu"'));
  // G-255: four tabs; 내 종목's pages are rows under 나 › 내 기록, and 관심 종목 lights up 홈.
  assert.ok(me.includes('class="card st-rows me-rec"') && ['watch.html', 'inbox.html', 'myreports.html', 'mydebates.html'].every((h) => me.includes(`href="${h}"`)));
  assert.ok(modeBar('', 'inbox.html').includes('href="mydebates.html"') && !modeBar('', 'inbox.html').includes('watch.html'));
  assert.ok(!bar.includes('href="watch.html"'));
});
