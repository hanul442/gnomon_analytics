import assert from 'node:assert/strict';
import test from 'node:test';
import { renderHome } from './renderHome.js';
import { marketPulse } from '../analysis/quickCalc.js';

test('the home folds a US temperature card under 미국 when the US rows carry signals (G-179, G-244)', () => {
  const base = { entries: [], selection: null, universe: null, pulse: null, indices: [] };
  const calcs = [['BULLISH', 80, 3.1], ['STRONG_BULLISH', 95, 8.2], ['BEARISH', 20, -4.0], ['NEUTRAL', 50, 0.4]].map(([level, score, r20]) => ({ date: '2026-10-08', signal: { level, score: Number(score) / 100 }, moves: [{ days: 20, pct: r20 }] }));
  const html = renderHome({ ...base, us: { pulse: marketPulse(calcs as never), date: '2026-10-08', up: 120, down: 70, flat: 10 } });
  assert.match(html, /class="mh-us" id="mh-us" hidden/);
  assert.match(html, /미국 온도/);
  assert.match(html, /href="screener\.html#us"/);
  assert.match(html, /▲120/);
  // Without US rows there is no 미국 button.
  const plain = renderHome({ ...base, us: null });
  assert.doesNotMatch(plain, /미국 온도|id="mh-us"/);
  // Breadth alone (no signals) still says how the day went.
  assert.match(renderHome({ ...base, us: { pulse: null, date: '2026-10-08', up: 30, down: 150, flat: 5 } }), /미국 · 일간 등락 분포/);
});
