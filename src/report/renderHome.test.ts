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

test('home: no view bar or market tabs, and no picks, saved screens or search box (G-266)', () => {
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
  // G-301 (한서님 10/26 새 구조): one stream by date; each day heads its own block.
  assert.match(html, /<h2>10\/16 \(금\)<\/h2><span class="muted">최신 · 종목 1개<\/span>/);
  assert.ok(!html.includes('10/17 (') && !html.includes('위원회 10/17'), 'the run date is never shown as the report date');
  assert.ok(html.includes('<h2>10/05 (월)</h2>') && !html.includes('위원회 10/05'));
  const today = html.slice(html.indexOf('id="today-list"'), html.indexOf('</section>', html.indexOf('id="today-list"')));
  assert.ok(today.includes('NEW/index.html') && !today.includes('OLD/index.html') && !today.includes('NONE/index.html'));
  const info = watchInfo(entries);
  assert.deepEqual([info.OLD!.d, info.NEW!.d, info.NONE!.d], ['2026-10-05', '2026-10-16', '']);
});

test('G-277: home is 세계 + 위원회 — tabs, the date, the big banner, key numbers, committee, mine, one merged issue list', async () => {
  const { marketPulse } = await import('../analysis/quickCalc.js');
  const calcs = [['BEARISH', 20], ['BULLISH', 80], ['NEUTRAL', 50]].map(([level, score]) => ({ date: '2026-10-16', signal: { level, score: Number(score) / 100 }, moves: [{ days: 20, pct: 0 }] }));
  const html = renderHome({ entries: [entry('AAA', 9), entry('BBB', 1)], selection: null, universe: null, pulse: marketPulse(calcs as never), indices: [{ symbol: 'KOSPI', name: '코스피', date: '2026-10-16', close: 5668.05, changePct: 2.05, closes: [] }] });
  // G-301 (한서님 10/26 새 구조): home is one screen; 이슈 전체 opens from its link, no part buttons anywhere.
  assert.deepEqual([...html.matchAll(/class="wd-p hm-p" data-wd-p="([a-z]+)"/g)].map((m) => m[1]), ['sum', 'news'], 'no world snapshot: no 시장 전체');
  assert.doesNotMatch(html, /data-wd="/, 'no part buttons');
  assert.match(html, /<p class="hm-d">10월 16일 [월화수목금토일]요일<\/p>/);
  assert.match(html, /<p class="hm-s">오늘 시장을 한눈에 모았어요\.<\/p>/, 'no world snapshot: a plain line');
  const at = (k: string) => html.indexOf(k);
  assert.ok(at('id="mkt-hero"') < at('class="hm-bn"') && at('class="hm-bn"') < at('id="watch-slot"') && at('id="watch-slot"') < at('id="watch"'), 'date, the big banner, then mine');
  assert.ok(at('id="watch"') < at('<h2>오늘 이슈</h2>'), 'mine before the issues');
  assert.ok(html.includes('<h2>내 종목 오늘</h2>') && html.includes('wl-rail'));
  assert.ok(html.includes('data-wd-p="news"') && html.includes('data-wd-tag="세계"'), 'one issue list with a 한국/세계 filter');
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
  // G-281: no jump row; 내 투자 방식 and 내 위원회 are one line each; 내 기록 shows only where the bottom bar is not (wide screens).
  assert.ok(!me.includes('class="st-nav"') && me.includes('<details class="st-fold" id="profile">') && me.includes('<details class="st-fold" id="committee">') && me.includes('class="card st-group"'));
  // G-300: 내 계정 once (the head card, 요금제 beside it); 약관 and 개인정보 only in the footer.
  assert.equal(me.split('<b>내 계정</b>').length - 1, 1);
  assert.ok(me.includes('class="me-plan"') && !me.includes('id="account">계정</h2>'));
  assert.ok(modeBar('', 'inbox.html').includes('href="mydebates.html"') && !modeBar('', 'inbox.html').includes('watch.html'));
  assert.ok(!bar.includes('href="watch.html"'));
});

test('G-269: a picture banner on home is the same slim line, its title and 티저 보기', async () => {
  const { bannerHtml } = await import('./alphaPages.js');
  const html = bannerHtml([{ title: '정보의 바다는, 끝.', image: { wide: 'assets/banners/a.jpg', video: 'assets/banners/t.mp4' } }]);
  assert.match(html, /<b class="bn-alt">정보의 바다는, 끝\.<\/b>/);
  assert.match(html, /bn-play/);
});

test('G-269: the 4.0.0 update film banner says 영상 보기, a teaser film still says 티저 보기', async () => {
  const { bannerHtml, validBanners } = await import('./alphaPages.js');
  const list = validBanners([{ title: '알파 4.0.0 업데이트', image: { wide: 'assets/banners/update-4.0.0-wide.jpg', video: 'assets/banners/update-4.0.0.mp4', poster: 'assets/banners/update-4.0.0-poster.jpg' } }, { title: '티저', image: { wide: 'assets/banners/a.jpg', video: 'assets/banners/teaser-beta.mp4' } }], '2026-10-20');
  const html = bannerHtml(list);
  assert.match(html, /data-video="assets\/banners\/update-4\.0\.0\.mp4"[^>]*aria-label="알파 4\.0\.0 업데이트 · 영상 보기"/);
  assert.match(html, /<\/svg>영상 보기<\/span>/);
  assert.match(html, /<\/svg>티저 보기<\/span>/);
});

test('G-271 miniArea draws a small area line only with 5+ closes, in the neutral text colour', async () => {
  const { miniArea } = await import('./renderHome.js');
  assert.equal(miniArea([1, 2, 3]), '');
  const svg = miniArea([100, 101, 99, 102, 104]);
  assert.match(svg, /class="hh-sa"/);
  assert.match(svg, /currentColor/);
});

test('G-281, G-291: with the world snapshot, home is 요약·시장·위원회·이슈; chart boxes on 요약, each number once in 시장', () => {
  const q = (key: string, name: string, value: number, changePct: number) => ({ key, name, country: '미국', iso: 'US', region: '미국', value, change: null, changePct, at: null, open: false, series: [['2026-10-19', value], ['2026-10-20', value]] });
  const world = { generatedAt: '2026-10-20T11:00:00Z', status: [], indices: [q('.INX', 'S&P 500', 7690.73, -1.2), { ...q('.N225', '니케이 225', 1, -1.3), iso: 'JP', region: '아시아' }], macro: [{ ...q('USDKRW', '원/달러', 1452.3, 0.4), group: 'fx', unit: '원' }] };
  const html = renderHome({ entries: [], selection: null, universe: null, pulse: null, world: world as never, indices: [{ symbol: 'KOSPI', name: '코스피', date: '2026-10-20', close: 5668.05, changePct: 2.05, closes: [] }] });
  assert.match(html, /<p class="hm-s">[^<]*증시[^<]*<\/p>/);
  assert.match(html, /1,452\.3/);
  assert.match(html, /data-sheet=/, 'cards open the big chart sheet');
  assert.deepEqual([...html.matchAll(/class="wd-p hm-p" data-wd-p="([a-z]+)"/g)].map((m) => m[1]), ['sum', 'market', 'news']);
  assert.match(html, /data-wd-go="market"/, '시장 전체 opens from 오늘');
  // G-291 (한서님 10/23 '네모박스안에 여러개 배치'): 요약's numbers are chart boxes in two columns again.
  const sum = html.slice(html.indexOf('data-wd-p="sum"'), html.indexOf('data-wd-p="market"'));
  assert.match(sum, /class="km-stats wd-stats"/);
  assert.ok(sum.includes('원/달러') && /S(&amp;|&)P 500/.test(sum), 'S&P 500 and 원/달러 boxes on 요약');
  const market = html.slice(html.indexOf('data-wd-p="market"'), html.indexOf('data-wd-p="news"'));
  assert.doesNotMatch(market, /wd-heat|km-wmap|im-map/, 'no color grid or map in 시장 (the map lives in 이슈 전체)');
  assert.equal(market.split('<b>원/달러</b>').length - 1, 1, '원/달러 shows once in 시장');
  assert.ok(market.indexOf('id="mk-stocks"') < market.indexOf('id="mk-fx"'));
});
