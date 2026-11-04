import test from 'node:test';
import assert from 'node:assert/strict';
import { RH_SYSTEM_CSS, RH_NEON } from './rhSystem.js';

test('G-330: Robinhood system — white/black grounds, neon accent, no shadows, flat boxes', () => {
  assert.match(RH_SYSTEM_CSS, /\[data-theme=light\]\{--page:#FFFFFF/);
  assert.match(RH_SYSTEM_CSS, /\[data-theme=dark\]\{--page:#000000/);
  assert.equal(RH_NEON, '#CCFF00');
  assert.match(RH_SYSTEM_CSS, /box-shadow:none!important/);
  assert.match(RH_SYSTEM_CSS, /\.km-stat\{background:var\(--rh-box\)!important;border:0!important;border-radius:8px!important\}/);
  // the template must not leak an unfilled placeholder
  assert.doesNotMatch(RH_SYSTEM_CSS, /\$\{/);
});
