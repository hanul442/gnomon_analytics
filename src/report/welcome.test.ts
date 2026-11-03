import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WELCOME_CSS, WELCOME_JS, WELCOME_MAX_PICKS, WELCOME_PICKS, welcomeCards } from './welcome.js';
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

test('G-320: 시작하기 3단계 starts only after the welcome, ticks itself off, and never pushes a trade', () => {
  assert.match(WELCOME_JS, /gnm-tour-start/);
  assert.match(WELCOME_JS, /set\(SKEY, '0'\)/, 'only a reader who just saw the welcome gets the steps');
  for (const t of ['자주 볼 종목 고르기', '위원회 판단 하나 읽어 보기', '아침 8시 알림 켜기', '준비 끝났어요', '나중에']) assert.ok(WELCOME_JS.includes(t), t);
  assert.match(WELCOME_JS, /사라는 말, 팔라는 말은 하지 않아요/);
  assert.match(WELCOME_CSS, /prefers-reduced-motion:reduce\)\{\.st-card/);
});
