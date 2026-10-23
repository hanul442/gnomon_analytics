import test from 'node:test';
import assert from 'node:assert/strict';
import { SPRINGS, MOTION_TOKENS_CSS } from './motionTokens.js';
import { MOTION_SYSTEM_CSS, MOTION_SYSTEM_JS } from './motionSystem.js';
import { APP_CSS, UI_JS } from './renderHtml.js';

test('G-286: four spring curves that start at 0, end at 1, and overshoot only where they should', () => {
  const peak = (s: string) => Math.max(...(s.match(/[\d.]+/g) ?? []).map(Number));
  for (const s of Object.values(SPRINGS)) { assert.match(s, /^linear\(0,.*,1\)$/); }
  assert.equal(peak(SPRINGS.press), 1); assert.equal(peak(SPRINGS.soft), 1);
  assert.ok(peak(SPRINGS.snappy) > 1.02 && peak(SPRINGS.snappy) < 1.06, 'snappy overshoots about 4%');
  assert.ok(peak(SPRINGS.bouncy) > 1.12 && peak(SPRINGS.bouncy) < 1.2, 'bouncy overshoots about 16%');
  // Browsers without linear() keep a cubic-bezier: the linear() values only apply inside @supports.
  assert.match(MOTION_TOKENS_CSS, /--spring-snappy:cubic-bezier\(/);
  assert.match(MOTION_TOKENS_CSS, /@supports \(transition-timing-function:linear\(0,1\)\)\{:root\{--spring-press:linear\(/);
});

test('G-286: the motion layer ships in the shared bundle, after the polish layer, and parses', () => {
  assert.ok(APP_CSS.includes(MOTION_SYSTEM_CSS) && APP_CSS.indexOf(MOTION_SYSTEM_CSS) > APP_CSS.indexOf('@view-transition'));
  assert.ok(UI_JS.includes(MOTION_SYSTEM_JS));
  assert.doesNotThrow(() => new Function(MOTION_SYSTEM_JS));
  // It reads the reader's reduced-motion setting and only the chart sheet closes with a delay.
  assert.match(MOTION_SYSTEM_JS, /prefers-reduced-motion: reduce/);
  assert.match(MOTION_SYSTEM_JS, /ANIM = '\.gsh-sheet';/);
});
