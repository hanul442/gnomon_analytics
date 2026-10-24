import test from 'node:test';
import assert from 'node:assert/strict';
import { MICRO_MOTION_CSS, MICRO_MOTION_JS } from './microMotion.js';
import { MOTION_SYSTEM_CSS, MOTION_SYSTEM_JS } from './motionSystem.js';
import { ROLL_CSS } from './rollNumber.js';
import { APP_CSS, UI_JS } from './renderHtml.js';

test('G-296: the library motions ship last in the shared bundle and parse', () => {
  assert.ok(APP_CSS.includes(MICRO_MOTION_CSS) && APP_CSS.indexOf(MICRO_MOTION_CSS) > APP_CSS.indexOf(MOTION_SYSTEM_CSS));
  assert.ok(UI_JS.includes(MICRO_MOTION_JS) && UI_JS.indexOf(MICRO_MOTION_JS) > UI_JS.indexOf(MOTION_SYSTEM_JS));
  assert.doesNotThrow(() => new Function(MICRO_MOTION_JS));
});

test('G-296: decoration only under html.ms, and the picks are all there', () => {
  // Beam, words, skeleton morph and the star pop animate only when motionSystem has added html.ms.
  for (const sel of ['html.ms .gnm-busy:not(#main)::after', 'html.ms .mm-words>span', 'html.ms .mm-unskel', 'html.ms .star.mm-pop svg']) assert.ok(MICRO_MOTION_CSS.includes(sel), sel);
  assert.match(MICRO_MOTION_JS, /prefers-reduced-motion: reduce/);
  for (const part of ['mm-deck', 'mm-pblur', 'mm-ptr', 'mm-wheel', 'mm-stk', 'mm-knob', 'mm-goo', 'mm-face']) assert.ok(MICRO_MOTION_JS.includes(part), part);
  // No blue-and-orange accents: the beam is a neutral grey light in both themes.
  assert.match(MICRO_MOTION_CSS, /--mm-beam:rgba\(17,19,24,/);
  assert.match(MICRO_MOTION_CSS, /html\[data-theme=dark\]\{--mm-beam:rgba\(255,255,255,/);
});

test('G-296: big numbers roll like the price, on the snappy spring', () => {
  assert.match(MOTION_SYSTEM_JS, /if \(window\.gnmRoll\) \{ el\.removeAttribute\('data-rv'\); gnmRoll\(el, t\.trim\(\), 0\); return; \}/);
  assert.ok(ROLL_CSS.includes('var(--spring-snappy,'));
});
