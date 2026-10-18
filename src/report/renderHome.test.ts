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

test('home: no view bar or market tabs; temperature card; today picks carry a score and a reason per view (G-67)', () => {
  const html = renderHome({ entries: [entry('AAA', 9), entry('BBB', 0.1, 'etf')], selection: null, universe: null, pulse: null, indices: [] });
  assert.ok(!html.includes('id="pz-note"') && !html.includes('class="mkt-tabs"'));
  assert.ok(html.includes('data-s-trader=') && html.includes('pw-trader') && html.includes('오늘 ▲ +9.00%'));
  const s = (sym: string, v: string) => Number(new RegExp(`data-s-${v}="([-\\d.]+)"[^>]*>(?:(?!class="tp").)*?${sym}/index`, 's').exec(html)?.[1]);
  assert.ok(s('AAA', 'trader') > s('BBB', 'trader'), 'the big mover leads for traders');
  assert.ok(s('BBB', 'beginner') > s('AAA', 'beginner'), 'the ETF leads for beginners');
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

test('G-244: home leads with one market sentence and folds the rest into 더 보기', async () => {
  const { marketPulse } = await import('../analysis/quickCalc.js');
  const calcs = [['BEARISH', 20], ['BEARISH', 25], ['STRONG_BEARISH', 10], ['BULLISH', 80], ['NEUTRAL', 50]].map(([level, score]) => ({ date: '2026-10-16', signal: { level, score: Number(score) / 100 }, moves: [{ days: 20, pct: 0 }] }));
  const html = renderHome({ entries: [entry('AAA', 9), entry('BBB', 1), entry('CCC', -2), entry('DDD', 3)], selection: null, universe: null, pulse: marketPulse(calcs as never), indices: [{ symbol: 'KOSPI', name: '코스피', date: '2026-10-16', close: 5668.05, changePct: 2.05, closes: [] }] });
  assert.match(html, /<h1 class="mh-v">약세 종목이 많은 날이에요<\/h1>/);
  assert.match(html, /코스피 <b>5,668<\/b>/);
  for (const gone of ['id="movers"', 'id="themes-top"', 'id="signals"', 'id="show-all"', 'class="find-row"', 'class="block ix-row']) assert.ok(!html.includes(gone), gone);
  for (const link of ['themes.html', 'screener.html', 'signals.html', 'market-reports.html', 'updates.html']) assert.match(html, new RegExp(`class="ml-row" href="${link.replace('.', '\\.')}"`));
  assert.ok(html.indexOf('id="mkt-hero"') < html.indexOf('id="watch"') && html.indexOf('id="watch"') < html.indexOf('id="today"') && html.indexOf('id="today"') < html.indexOf('id="banner"'), 'market, mine, picks, then the banner');
  assert.match(html, /c\.hidden = i >= 3/, 'three picks');
});

test('G-245: five tabs, no 전체 sheet, sibling pages as modes, and the 나 tab', async () => {
  const { tabBar, modeBar } = await import('./ui.js');
  const { renderSettings } = await import('./renderSettings.js');
  const bar = tabBar('', 'bottom');
  assert.deepEqual([...bar.matchAll(/aria-label="([^"]+)" data-tab-link/g)].map((m) => m[1]), ['홈', '찾기', '내 종목', '위원회', '나']);
  assert.ok(!bar.includes('data-all-menu'));
  const themes = modeBar('', 'themes.html');
  assert.ok(themes.includes('<a href="themes.html" aria-current="page">테마</a>') && themes.includes('href="signals.html"') && themes.includes('href="screener.html#etf"'));
  assert.ok(modeBar('', 'scorecard.html').includes('href="reports.html"'));
  assert.equal(modeBar('', 'index.html'), '');
  const me = renderSettings();
  assert.ok(me.includes('class="me-acct"') && me.includes('id="sm-admin"') && me.includes('id="help"') && me.includes('href="guide.html"'));
  assert.ok(!me.includes('id="side-menu"'));
});
