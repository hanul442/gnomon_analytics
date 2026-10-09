import assert from 'node:assert/strict';
import test from 'node:test';
import { renderHome } from './renderHome.js';
import { marketPulse } from '../analysis/quickCalc.js';

test('the home shows a US temperature card beside the Korean one when the US rows carry signals (G-179)', () => {
  const base = { entries: [], selection: null, universe: null, pulse: null, indices: [] };
  const calcs = [['BULLISH', 80, 3.1], ['STRONG_BULLISH', 95, 8.2], ['BEARISH', 20, -4.0], ['NEUTRAL', 50, 0.4]].map(([level, score, r20]) => ({ date: '2026-10-08', signal: { level, score: Number(score) / 100 }, moves: [{ days: 20, pct: r20 }] }));
  const html = renderHome({ ...base, us: { pulse: marketPulse(calcs as never), date: '2026-10-08', up: 120, down: 70, flat: 10 } });
  assert.match(html, /class="block ix-row ix-4"/);
  assert.match(html, /미국 온도/);
  assert.match(html, /href="us\.html"/);
  assert.match(html, /▲120/);
  // Without US rows the strip is the Korean one only.
  const plain = renderHome({ ...base, us: null });
  assert.doesNotMatch(plain, /미국 온도|class="block ix-row ix-4"/);
  // Breadth alone (no signals) still says how the day went.
  assert.match(renderHome({ ...base, us: { pulse: null, date: '2026-10-08', up: 30, down: 150, flat: 5 } }), /미국 · 일간 등락 분포/);
});
