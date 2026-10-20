import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heatStyle, kmDonut, kmGauge, kmHeatmap, kmNotchArc, kmSectorMap, kmStatArea, kmSunburst, kmWorldMap, KIT_MARKET_CSS, KIT_MARKET_JS } from './market.js';
import { marketTemperature } from '../marketTemperature.js';
import { miniGauge } from '../renderMarket.js';

const themes = [
  { no: '1', name: 'HBM(고대역폭메모리)', avg: 2.4, value: 900, members: [['005930', '삼성전자', 1, 1.2, 10, 500e12], ['000660', 'SK하이닉스', 1, 3.1, 10, 200e12], ['042700', '한미반도체', 1, -0.5, 10, 10e12]] },
  { no: '2', name: '반도체 장비', avg: -1.1, value: 300, members: [['042700', '한미반도체', 1, -0.5, 10, 10e12], ['000001', '가 장비', 1, -2, 10, 1e12], ['000002', '나 장비', 1, null, 10, 1e12]] },
  { no: '3', name: '인공지능(AI)', avg: 0.8, value: 500, members: [['005930', '삼성전자', 1, 1.2, 10, 500e12], ['035420', 'NAVER', 1, 0.4, 10, 30e12], ['035720', '카카오', 1, -0.2, 10, 20e12]] },
  { no: '4', name: '바이오인식', avg: 5, value: 999, members: [['1', 'a', 1, 1, 1, 1], ['2', 'b', 1, 1, 1, 1], ['3', 'c', 1, 1, 1, 1]] },
];
const words = { '반도체': ['반도체', 'HBM'], '바이오·헬스케어': ['바이오'], '인터넷·게임': ['인공지능'] };
const skip = { '바이오·헬스케어': ['바이오인식'] };

test('the donut draws a slice per part with its share, and the headline in the centre', () => {
  const h = kmDonut([{ label: '상승', value: 75, color: '#f04452', tone: 'up' }, { label: '보합', value: 0, color: 'var(--muted)' }, { label: '하락', value: 25, color: '#3182f6', tone: 'down' }], { v: '75%', l: '오른 종목', tone: 'up' }, '등락');
  assert.equal((h.match(/class="km-sl"/g) ?? []).length, 2);
  assert.match(h, /data-km-tip="상승" data-km-v="75%" data-km-t="up" data-km-s="75개"/);
  assert.match(h, /<b class="km-cv up">75%<\/b><span class="km-cl">오른 종목<\/span>/);
  assert.match(kmDonut([], { v: '-', l: '' }, 'x'), /<circle/);
});

test('the gauge lights the notches from neutral toward the reading, red to the right and blue to the left', () => {
  const lit = (h: string) => (h.match(/class="km-on"/g) ?? []).length;
  assert.equal(lit(kmGauge(0, { v: '0', l: '' }, 'x')), 1);
  assert.equal(lit(kmGauge(1, { v: '', l: '' }, 'x')), 17);
  assert.equal(lit(kmGauge(-0.5, { v: '', l: '' }, 'x')), lit(kmGauge(0.5, { v: '', l: '' }, 'x')));
  assert.match(kmGauge(0.9, { v: '', l: '' }, 'x'), /fill:#f04452/);
  assert.match(kmGauge(-0.9, { v: '', l: '' }, 'x'), /fill:#3182f6/);
  assert.equal(lit(kmGauge(null, { v: '', l: '' }, 'x')), 0);
});

test('the stock page mini gauge keeps its needle and lights only the scored band', () => {
  const arc = kmNotchArc(60, 56, 40, 51, ['#a', '#b', '#c'], [-1, -0.3, 0.3, 1], 0.5, 3);
  assert.equal((arc.match(/class="g-seg"/g) ?? []).length + (arc.match(/class="g-seg on"/g) ?? []).length, 9);
  assert.equal((arc.match(/class="g-seg on"/g) ?? []).length, 3);
  const g = miniGauge(0.4, '일봉 강세');
  assert.match(g, /class="mini-gauge"/);
  assert.match(g, /<g class="needle" style="--r:/);
  assert.doesNotMatch(g, /#18201f/);
});

test('market temperature: gauge and donut with a pulse, donut alone without one', () => {
  const pulse = { date: '2026-10-16', counted: 100, bull: 20, neutral: 10, bear: 70, up20: 0.2, buckets: { STRONG_BULLISH: 5, BULLISH: 10, SLIGHTLY_BULLISH: 5, NEUTRAL: 10, SLIGHTLY_BEARISH: 20, BEARISH: 30, STRONG_BEARISH: 20, WITHHELD: 0 } } as never;
  const h = marketTemperature(pulse, { up: 30, down: 60, flat: 10 }, '코스피');
  assert.match(h, /km-gauge/);
  assert.match(h, /km-donut/);
  assert.match(h, /class="pulse-bar"/);
  assert.match(h, /<b class="km-cv down">-50%p<\/b>/);
  const flat = marketTemperature(null, { up: 30, down: 150, flat: 5 }, '미국');
  assert.match(flat, /미국 · 일간 등락 분포/);
  assert.match(flat, /km-donut/);
  assert.doesNotMatch(flat, /br-bar/);
  assert.match(flat, /하락<\/span><b class="down">150개 · 81%/);
  assert.equal(marketTemperature(null, { up: 0, down: 0, flat: 0 }), '');
});

test('the stat card carries the closes for the finger and says the period move', () => {
  const h = kmStatArea({ title: '코스피', value: 2612.345, change: -0.42, series: [['2026-10-14', 2600], ['2026-10-15', 2650], ['2026-10-16', 2612.345]] });
  assert.match(h, /<span class="km-badge down">▼ -0.42%<\/span>/);
  assert.match(h, /<b class="km-sv" data-v0="2,612\.35">/);
  assert.match(h, /data-km-spark="\[\[&quot;2026-10-14&quot;,2600,0,/);
  assert.match(h, /최근 3거래일 <span class="up">\+0\.5%<\/span>/);
  const bare = kmStatArea({ title: '코인', sub: '비트코인', value: null, change: null });
  assert.doesNotMatch(bare, /km-sa/);
  assert.match(bare, /<span class="km-badge">—<\/span>/);
});

test('the world map colours only the countries it is given', () => {
  const h = kmWorldMap([{ iso: 'KR', country: '한국', index: '코스피', change: 1.2, date: '2026-10-16' }, { iso: 'US', country: '미국', index: 'S&P 500', change: null }], '설명');
  assert.equal((h.match(/class="km-ct"/g) ?? []).length, 2);
  assert.match(h, /data-km-tip="한국 · 코스피" data-km-v="\+1\.20%" data-km-t="up" data-km-s="2026-10-16 종가 기준"/);
  assert.match(h, /data-km-tip="미국 · S&amp;P 500" data-km-v="자료 없음"/);
  assert.ok(h.length < 30_000, `map is ${h.length} bytes`);
  assert.equal(heatStyle(null), 'fill:var(--line-strong);fill-opacity:.5');
  assert.match(heatStyle(5), /fill:#f04452;fill-opacity:0\.92/);
});

test('sector map: themes by word, a stock in one sector only, largest first', () => {
  const rows = kmSectorMap(themes, words, skip);
  assert.deepEqual(rows.map((r) => r.s), ['반도체', '인터넷·게임']);
  assert.deepEqual(rows[0]!.themes.map((t) => t.no), ['1', '2']);
  assert.deepEqual(rows[0]!.stocks.map((s) => s.name), ['삼성전자', 'SK하이닉스', '한미반도체', '가 장비']);
  assert.deepEqual(rows[1]!.stocks.map((s) => s.name), ['NAVER', '카카오']);
});

test('heatmap and sunburst run on their own in the page (no outer helpers) and link to themes and stocks', () => {
  const own = <T>(f: T): T => new Function(`return (${String(f)})`)() as T;
  const rows = own(kmSectorMap)(themes, words, skip);
  const heat = own(kmHeatmap)(rows);
  assert.equal((heat.match(/class="km-cell"/g) ?? []).length, 3);
  assert.match(heat, /<a href="#1" class="km-cell" style="--i:0" data-km-tip="HBM" data-km-v="\+2\.40%" data-km-t="up" data-km-s="반도체 · 3종목">/);
  const sun = own(kmSunburst)(rows);
  assert.equal((sun.match(/class="km-seg"/g) ?? []).length, 2 + 6);
  assert.match(sun, /href="stock\.html\?c=005930"/);
  assert.match(sun, /칸 크기는 시가총액에 비례/);
  assert.match(own(kmSunburst)([{ s: 'x', themes: [], stocks: [{ sym: 'a', name: 'a', ch: 1, cap: null }] }]), /종목 수에 비례/);
  assert.equal(own(kmSunburst)([]), '');
});

test('kit styles and script: motion only under html.mo, Korean up/down colours', () => {
  for (const rule of KIT_MARKET_CSS.match(/[^}]*:not\(\.km-in\)[^{]*/g) ?? []) assert.match(rule, /html\.mo/);
  assert.match(KIT_MARKET_CSS, /#f04452/);
  assert.match(KIT_MARKET_CSS, /#3182f6/);
  assert.doesNotThrow(() => new Function(KIT_MARKET_JS));
});
