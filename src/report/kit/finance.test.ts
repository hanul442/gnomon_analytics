import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composedChart, depthBar, incomeSankey, radarChart, KIT_FINANCE_CSS, KIT_FINANCE_JS } from './finance.js';

const short = (v: number) => `${Math.round(v)}`;

test('composedChart: bars wear the .mo-bars contract and the margin is a smooth line with a right axis', () => {
  const html = composedChart({ labels: ['25.03', '25.06', '25.09'], bars: [{ label: '매출', color: '#2e4268', values: [100, 120, 130] }, { label: '영업이익', color: '#f04452', values: [10, -5, 20] }], line: { label: '영업이익률', values: [10, -4.2, 15.4] }, short, money: (v) => `${v}원` });
  assert.match(html, /class="ig-bars mo-bars kf-cc" data-tip="/);
  assert.equal((html.match(/class="kf-face/g) ?? []).length, 6);
  assert.equal((html.match(/class="kf-glass/g) ?? []).length, 6, 'every bar has its glass');
  assert.match(html, /class="kf-face neg" data-g="1"/, 'a loss grows down');
  assert.match(html, /<path d="M[^"]*C[^"]*" class="kf-ln"\/>/);
  assert.equal((html.match(/class="kf-pt" data-g=/g) ?? []).length, 3);
  assert.match(html, /15\.4%/);
  const tip = JSON.parse(html.match(/data-tip="([^"]*)"/)![1]!.replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  assert.deepEqual(tip.y, ['25.03', '25.06', '25.09']);
  assert.deepEqual(tip.s.map((s: { l: string }) => s.l), ['매출', '영업이익', '영업이익률']);
  assert.deepEqual(tip.s[2].v, ['10.0%', '-4.2%', '15.4%']);
});

test('composedChart: nothing without two quarters of margin', () => {
  assert.equal(composedChart({ labels: ['a', 'b'], bars: [{ label: '매출', color: '#000', values: [1, 2] }], line: { label: '영업이익률', values: [null, 3] }, short, money: short }), '');
});

test('depthBar: the face and its glass share the bar index and size', () => {
  const b = depthBar({ x: 1, y: 2, w: 10, h: 30, neg: false, fill: '#f04452', g: 3, i: 7, title: '<x>', glass: 'gl1' });
  assert.match(b, /<rect class="kf-face" data-g="3" style="--i:7" x="1.0" y="2.0" width="10.0" height="30.0"/);
  assert.match(b, /<rect class="kf-glass" data-g="3" style="--i:7" x="1.0" y="2.0" width="10.0" height="30.0" rx="[0-9.]+" fill="url\(#gl1\)"/);
  assert.match(b, /&lt;x&gt;/);
});

const flow = { year: '2025', short };

test('incomeSankey: 매출 → 매출원가/매출총이익 → 판관비/영업이익 → 법인세·기타/당기순이익', () => {
  const html = incomeSankey({ ...flow, rev: 1000, cogs: 600, gp: 400, op: 150, net: 100 });
  for (const id of ['rev', 'gp', 'cogs', 'op', 'opex', 'net', 'tax']) assert.match(html, new RegExp(`data-id="${id}"`), id);
  assert.equal((html.match(/class="kf-sk-l"/g) ?? []).length, 6);
  assert.match(html, /판관비/);
  assert.match(html, /매출 100원 중 영업이익으로 15원, 순이익으로 10원이 남았어요/);
});

test('incomeSankey: a 순이익 above 영업이익 comes in as 영업외 이익; no 매출원가 row means one step fewer', () => {
  const gain = incomeSankey({ ...flow, rev: 1000, cogs: null, gp: null, op: 150, net: 180 });
  assert.match(gain, /data-id="gain"/);
  assert.match(gain, /영업비용/);
  assert.doesNotMatch(gain, /data-id="gp"/);
  assert.match(gain, /data-a="gain" data-b="net"/);
});

test('incomeSankey: left out when the rows do not read as a flow', () => {
  assert.equal(incomeSankey({ ...flow, rev: 1000, cogs: 600, gp: 400, op: -20, net: -30 }), '', 'operating loss');
  assert.equal(incomeSankey({ ...flow, rev: null, cogs: 600, gp: 400, op: 100, net: 80 }), '', 'no revenue');
  assert.equal(incomeSankey({ ...flow, rev: 1000, cogs: null, gp: null, op: 1200, net: 80 }), '', 'profit above revenue');
  // A gross profit that does not sit between 영업이익 and 매출 is dropped, not drawn.
  assert.doesNotMatch(incomeSankey({ ...flow, rev: 1000, cogs: null, gp: 90, op: 100, net: 80 }), /data-id="gp"/);
  // A net loss ends the flow at 영업이익.
  assert.doesNotMatch(incomeSankey({ ...flow, rev: 1000, cogs: 600, gp: 400, op: 100, net: -50 }), /data-id="net"/);
});

test('radarChart keeps motion.ts\'s contract and draws round rings', () => {
  const svg = radarChart([{ label: '성장', score: 80 }, { label: '수익성', score: null }, { label: '안정성', score: 50 }, { label: '수급', score: 20 }, { label: '가치', score: 65 }]);
  assert.match(svg, /^<svg class="ig-radar kf-radar" viewBox="0 0 220 210"/);
  assert.equal((svg.match(/<circle cx="110" cy="104" r="[0-9.]+" class="grid/g) ?? []).length, 4);
  assert.match(svg, /class="area" fill="url\(#ig-rg-80-x-50-20-65\)"/);
  assert.equal((svg.match(/class="dot" data-i=/g) ?? []).length, 4, 'no dot for a missing axis');
  assert.match(svg, /class="na">수익성/);
});

test('motion lives under html.mo only, and the page script parses', () => {
  for (const rule of KIT_FINANCE_CSS.split('\n').filter((l) => /clip-path:inset\(0 100%|opacity:0\}/.test(l))) assert.match(rule, /^html\.mo /, rule);
  assert.doesNotThrow(() => new Function(KIT_FINANCE_JS));
});
