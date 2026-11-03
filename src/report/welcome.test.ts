import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WELCOME_JS, WELCOME_MAX_PICKS, WELCOME_PICKS, welcomeCards } from './welcome.js';
import { renderCommitteeGuide } from './alphaPages.js';

test('G-296: the welcome script parses and keeps its keys syncable with the account', () => {
  assert.doesNotThrow(() => new Function(WELCOME_JS));
  assert.match(WELCOME_JS, /gnm-tour-welcome/);
  assert.match(WELCOME_JS, /gnm-tour-stockhint/);
});

test('G-296: four cards, every pick offered, and the educational line', () => {
  const html = welcomeCards('');
  assert.equal(html.match(/class="wc-card"/g)?.length, 4);
  for (const [sym] of WELCOME_PICKS) assert.match(html, new RegExp(`data-wc-pick="${sym.replace('.', '\\.')}"`));
  assert.ok(WELCOME_MAX_PICKS <= 5, 'no more picks than the free watch limit');
  assert.match(WELCOME_JS, /사라·팔라고 권하지 않아요/);
});

test('G-296: 위원회가 뭐예요? page says what the committee does not do', () => {
  const page = renderCommitteeGuide();
  assert.match(page, /<h1>위원회가 뭐예요\?<\/h1>/);
  assert.match(page, /나에게 맞춘 매수·매도 조언/);
  assert.match(page, /href="scorecard.html"/);
});
