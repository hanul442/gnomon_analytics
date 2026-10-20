import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyCalendar, hitLine, hitSteps, KIT_STOCK_CSS, KIT_STOCK_JS, multiLine, outcomeSunburst, pnlLine, ringChart } from './stock.js';

const day = (i: number) => new Date(Date.UTC(2025, 9, 6) + i * 864e5).toISOString().slice(0, 10);

test('profit-loss line: red above the baseline, blue below, one clip for each side', () => {
  const svg = pnlLine([1, 1.05, 0.97, 1.02], '테스트 곡선');
  assert.match(svg, /class="spark kit-pnl"/);
  assert.match(svg, /aria-label="테스트 곡선"/);
  const clips = [...svg.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(clips.length, 2);
  assert.match(svg, new RegExp(`clip-path="url\\(#${clips[0]}\\)"><path[^>]*/><path class="spark-l"[^>]*stroke="#f04452"`));
  assert.match(svg, new RegExp(`clip-path="url\\(#${clips[1]}\\)"><path[^>]*/><path class="spark-l"[^>]*stroke="#3182f6"`));
  // Ends above 1: the last dot is red.
  assert.match(svg, /<circle [^>]*fill="#f04452"\/><\/svg>$/);
  assert.match(pnlLine([1, 0.9], 'x'), /<circle [^>]*fill="#3182f6"\/><\/svg>$/);
  assert.equal(pnlLine([1], 'x'), '');
});

test('line chart: every series in the legend and in the crosshair data, aligned at the end', () => {
  const html = multiLine([{ name: '가 전략', color: 'var(--accent)', values: [0, 5, 10, 8] }, { name: '보유', color: 'var(--muted)', dash: true, values: [9, 0, -3, -2, 4] }], { label: '비교', x: ['a', 'b', 'c', 'd', 'e'], zero: 0 });
  assert.equal((html.match(/class="kl-l"/g) ?? []).length, 2);
  assert.match(html, /가 전략 <b class="up">\+8%<\/b>/);
  assert.match(html, /보유 <b class="up">\+4%<\/b>/);
  const data = JSON.parse(html.match(/data-lc="([^"]+)"/)![1]!.replace(/&quot;/g, '"'));
  assert.deepEqual(data.x, ['b', 'c', 'd', 'e']);
  assert.deepEqual(data.s[1].v, [0, -3, -2, 4]);
  assert.match(html, /class="kl-g kl-z"/, 'a dashed zero line');
  assert.equal(multiLine([{ name: 'x', color: '#000', values: [1] }], { label: '', x: [] }), '');
});

test('ring chart: one arc per value, empty rings keep their track, centre and legend in words', () => {
  const html = ringChart([{ label: '강세', value: 0.5, color: '#f04452', text: '2명' }, { label: '약세', value: null, color: '#3182f6', text: '채점 전' }], { label: '합의', big: '60%', small: '높을 확률', cls: 'pl-ring' });
  assert.match(html, /^<figure class="kit-ring pl-ring">/);
  assert.equal((html.match(/class="kr-t"/g) ?? []).length, 2);
  assert.equal((html.match(/class="kr-arc"/g) ?? []).length, 1);
  assert.match(html, /pathLength="100" stroke-dasharray="50 100"/);
  assert.match(html, /<b>60%<\/b><small>높을 확률<\/small>/);
  assert.match(html, /<span>약세<\/span><b>채점 전<\/b>/);
});

test('calendar: a square per session on its weekday, coloured by the move, holidays left empty', () => {
  // Weekdays only, one holiday (the 10th weekday) missing.
  const bars: { date: string; close: number }[] = [];
  let c = 100;
  for (let i = 0; bars.length < 80; i += 1) { const d = new Date(Date.UTC(2025, 9, 6) + i * 864e5); if (d.getUTCDay() % 6 === 0 || i === 10) continue; c *= bars.length % 3 ? 1.012 : 0.97; bars.push({ date: d.toISOString().slice(0, 10), close: c }); }
  const html = dailyCalendar(bars);
  assert.equal((html.match(/data-i="/g) ?? []).length, 79);
  assert.equal((html.match(/class="kc e"/g) ?? []).length, 1, 'the one missing weekday');
  assert.match(html, /class="kc u2" data-i/);
  assert.match(html, /class="kc d3" data-i/);
  assert.match(html, /오른 날 <b class="up">\d+일<\/b> · 내린 날 <b class="down">\d+일<\/b>/);
  assert.doesNotMatch(html, />일<\/text>/, 'stocks: Monday to Friday only');
  // Coins trade every day: seven rows.
  const coin = Array.from({ length: 60 }, (_, i) => ({ date: day(i), close: 100 + i }));
  assert.match(dailyCalendar(coin), />일<\/text>/);
  assert.equal(dailyCalendar(coin.slice(0, 20)), '');
});

test('page script is plain JavaScript and the styles keep motion behind html.mo', () => {
  assert.doesNotThrow(() => new Function(KIT_STOCK_JS));
  assert.doesNotMatch(KIT_STOCK_JS, /[`]/);
  for (const rule of KIT_STOCK_CSS.match(/[^{}]*:not\(\.kit-in\)[^{}]*\{/g) ?? []) assert.match(rule, /html\.mo /, rule);
  assert.match(KIT_STOCK_JS, /GNM_kit = \{ scatter: scatter, funnel: funnel \}/);
});

test('G-270 outcomeSunburst splits calls by result, then member, and skips empty data', () => {
  const svg = outcomeSunburst([
    { label: '맞음', key: 'ok', children: [{ label: '추세', value: 3 }, { label: '가치', value: 1 }] },
    { label: '빗나감', key: 'no', children: [{ label: '추세', value: 2 }, { label: '가치', value: 0 }] },
    { label: '대기', key: 'wait', children: [] },
  ], { label: 'x' });
  assert.match(svg, /<b>6<\/b>/);
  assert.equal((svg.match(/ ks-o"/g) ?? []).length, 3);
  assert.doesNotMatch(svg, /대기/);
  assert.equal(outcomeSunburst([{ label: '맞음', key: 'ok', children: [] }], { label: 'x' }), '');
});

test('G-271 hitSteps counts closed trades +1 up / −1 otherwise; hitLine is neutral', () => {
  assert.deepEqual(hitSteps([{ exit: 'a', ret: 0.1 }, { exit: 'b', ret: -0.02 }, { exit: 'c', ret: 0 }, { exit: null, ret: 0.5 }]), [0, 1, 0, -1]);
  const svg = hitLine([0, 1, 2, 1], 'x');
  assert.match(svg, /currentColor/);
  assert.doesNotMatch(svg, /#f04452|#3182f6/);
  assert.equal(hitLine([0], 'x'), '');
});
