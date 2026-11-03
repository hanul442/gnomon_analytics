import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_RULES, RULES_CSS } from './designRules.js';

test('G-313: twelve design rules, and the light ground is white', () => {
  assert.equal(DESIGN_RULES.length, 12);
  assert.match(RULES_CSS, /--page:#FFFFFF/);
});
