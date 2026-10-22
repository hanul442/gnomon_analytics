import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderWorldPage, worldSentence, bands } from './renderWorld.js';
import { parseIndexBars, parseIndexBasic, parseMarketIndexMajors, parseMarketIndexPrices, type WorldMarkets, type WorldIndexQuote, type WorldMacroQuote } from '../sources/naverGlobal.js';
import { rankWorldIssues, topicsOf } from '../analysis/worldNews.js';
import { kmWorldMapAll } from './kit/worldMap.js';
import { marketWorld, renderMarketReport, type MarketReport } from './marketReport.js';

const ix = (key: string, name: string, country: string, iso: WorldIndexQuote['iso'], region: WorldIndexQuote['region'], changePct: number | null, open = false): WorldIndexQuote =>
  ({ key, name, country, iso, region, value: 100, change: null, changePct, at: '2026-10-20T15:30:00+09:00', open, series: [['2026-10-19', 99], ['2026-10-20', 100]] });
const mc = (key: string, name: string, group: WorldMacroQuote['group'], changePct: number | null, change: number | null = null, unit = '$'): WorldMacroQuote =>
  ({ key, name, group, unit, value: 108.6, change, changePct, at: null, open: true, series: [['2026-10-19', 103], ['2026-10-20', 108.6]] });

const markets: WorldMarkets = {
  generatedAt: '2026-10-20T11:00:00Z',
  indices: [ix('KOSPI', '코스피', '한국', 'KR', '한국', -3.73), ix('.INX', 'S&P 500', '미국', 'US', '미국', 0.41), ix('.N225', '니케이 225', '일본', 'JP', '아시아', -1.3), ix('.HSI', '항셍', '홍콩', 'HK', '아시아', -1.32), ix('.GDAXI', 'DAX', '독일', 'DE', '유럽', -0.75, true)],
  macro: [mc('WTI', 'WTI 유가', 'energy', 4.77), mc('US10Y', '미국', 'bond', -0.21, -0.0108, '%'), mc('FED', '미국 연준', 'policy', null, 0.25, '%')],
  status: [],
};

test('naverGlobal parsers read bars, quotes, the market-index answer and its history', () => {
  assert.deepEqual(parseIndexBars([{ localDate: '20261019', closePrice: 1 }, { localDate: '20261020', closePrice: '2,000.5' }, { localDate: 'x', closePrice: 3 }]), [['2026-10-19', 1], ['2026-10-20', 2000.5]]);
  assert.deepEqual(parseIndexBasic({ closePrice: '7,690.73', compareToPreviousClosePrice: '31.2', fluctuationsRatio: '0.41', marketStatus: 'CLOSE', localTradedAt: '2026-10-19T16:44:14-04:00' }), { value: 7690.73, change: 31.2, changePct: 0.41, at: '2026-10-19T16:44:14-04:00', open: false });
  assert.equal(parseIndexBasic({}), null);
  const rows = parseMarketIndexMajors({ result: { energy: [{ reutersCode: 'CLcv1', closePrice: '108.60' }], majors: [{ reutersCode: 'CLcv1', closePrice: '1' }] } });
  assert.equal(rows.get('CLcv1')?.closePrice, '108.60');
  assert.throws(() => parseMarketIndexMajors({}));
  assert.deepEqual(parseMarketIndexPrices({ result: [{ localTradedAt: '2026-10-20', closePrice: '1,328.30' }, { localTradedAt: '2026-10-19T16:00:00-05:00', closePrice: '103.66' }] }), [['2026-10-19', 103.66], ['2026-10-20', 1328.3]]);
});

test('the sentence names regions that moved together and one big commodity move, and no cause', () => {
  assert.equal(worldSentence(markets), '아시아·유럽 증시가 함께 내렸고, 유가는 하루에 4.8% 올랐어요.');
  assert.equal(worldSentence({ ...markets, indices: markets.indices.map((x) => ({ ...x, changePct: 0.1 })), macro: [] }), '세계 증시가 크게 움직이지 않은 하루예요.');
  const b = bands(markets.indices);
  assert.deepEqual(b.map((x) => [x.name, x.total, x.down, x.open]), [['아시아', 3, 3, false], ['유럽', 1, 1, true], ['미국', 1, 0, false]]);
});

test('world issues: stories ranked by outlets, tagged by topic, with the markets the topic names', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 20, h)).toISOString();
  const item = (title: string, publisher: string, h: number, n: number) => ({ url: `https://x/${n}`, title, publisher, publishedAt: at(h), source: 't', retrievedAt: at(10) });
  const board = rankWorldIssues([
    item('후티 반군, 사우디 공격 확대…유가 급등', '연합뉴스', 5, 1), item('후티 반군 사우디 공격 확대, 유가 급등', '한국경제', 6, 2), item('후티 반군의 사우디 공격 확대로 유가 급등', '뉴스핌', 7, 3),
    item('캐나다 앨버타 주민투표 부결', '조선비즈', 8, 4),
  ], new Date(Date.UTC(2026, 9, 20, 10)));
  assert.equal(board.issues[0]!.outlets, 3);
  assert.equal(board.issues[0]!.tag, '지정학');
  assert.deepEqual(board.issues[0]!.markets, ['WTI', 'BRENT']);
  assert.equal(board.issues[1]!.tag, null);
  assert.ok(!topicsOf('Shanghai port reopens').some((t) => t.label === '반도체·AI'), 'AI must be a word, not the end of Shanghai');
});

test('the world map colours each country and labels the big ones', () => {
  const html = kmWorldMapAll([{ iso: 'KR', country: '한국', index: '코스피', change: -3.7 }, { iso: 'HK', country: '홍콩', index: '항셍', change: -1.3 }], '설명');
  assert.match(html, /data-km-tip="한국 · 코스피"/);
  assert.match(html, /<circle cx="588"/);
  assert.match(html, /wm-pin r/);
  assert.ok(!html.includes('미국'), 'a country without a row stays grey and unlabelled');
});

test('the page has five tabs, the map and numbers, and an empty state', () => {
  const html = renderWorldPage({ markets, news: { from: null, to: null, articles: 0, issues: [] } });
  for (const t of ['요약', '증시', '금리·환율', '원자재', '뉴스']) assert.match(html, new RegExp(`data-wd="[a-z]+" aria-selected="(true|false)">${t}<`));
  assert.match(html, /세계 증시 지도/);
  assert.match(html, /−1\.1bp/);
  assert.match(html, /사고팔라는 뜻이 아니에요/);
  assert.match(renderWorldPage(null), /아직 받지 못했어요/);
});

test('G-276: the market daily uses the world snapshot for its 13-country map and rate cards; old reports keep theirs', () => {
  const w = marketWorld(markets)!;
  assert.ok(w.indices.every((x) => !('series' in x)), 'indices are kept without their lines');
  assert.deepEqual(w.macro.map((x) => x.key), ['US10Y', 'WTI']);
  const base: MarketReport = { schema: 'curia.market-report.v4', date: '2026-10-20', from: '2026-10-20', generatedAt: '2026-10-20T11:00:00Z', period: 'daily', groups: [], ai: { status: 'SKIPPED' } };
  const html = renderMarketReport({ ...base, world: w }, '../');
  assert.match(html, /wm-map/);
  assert.match(html, /하루 등락 · 5곳/);
  assert.match(html, /<h2>금리·환율·원자재<\/h2>/);
  assert.match(html, /href="\.\.\/index\.html#stocks"/);
  const old = renderMarketReport({ ...base, macro: [{ id: 'DGS10', label: '미국 10년', unit: '%', date: '2026-10-17', value: 4.1, chg20: 0.1, spark: [] }] }, '../');
  assert.ok(!old.includes('wm-map') && old.includes('금리·환율·변동성'));
});
