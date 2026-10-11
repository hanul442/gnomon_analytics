// 설정 (G-210): every setting in one page — 내 투자 방식 (G-207: view, holding period, explanation depth,
// assets, sectors, watched stocks), 화면 (theme), 알림 (G-97, the alerts page's parts) and 계정 links.
// Profile picks save at once to gnm-prefs/gnm-persona (which follow the account, G-109) and, signed in,
// to the onboarding answers on the server, which AI answers read.

import { esc } from './html.js';
import { shell } from './renderHtml.js';
import { PERSONAS } from './persona.js';
import { SECTORS } from './sectors.js';
import { ASSETS, EXPLAIN, HORIZON } from './profile.js';
import { alertsParts } from './renderAlerts.js';

const group = (key: string, title: string, note: string, type: 'one' | 'many', options: readonly string[]) =>
  `<fieldset class="pf-row" data-k="${key}"><legend>${esc(title)}</legend><p class="pf-note">${esc(note)}</p><div class="pf-opts">${options.map((o) => `<label><input type="${type === 'one' ? 'radio' : 'checkbox'}" name="${key}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('')}</div></fieldset>`;

export function renderSettings(): string {
  const al = alertsParts();
  const body = `${al.css}<style>
.pf{max-width:720px;margin:16px auto 32px}.pf .card{padding:18px;margin-bottom:12px}.pf h1{font-size:23px;margin:2px 0 6px}
.pf-row{border:0;margin:0;padding:16px 0 0;min-width:0}.pf-row+.pf-row{border-top:1px solid var(--line);margin-top:16px}.pf-row legend{font-weight:800;font-size:15.5px;padding:0;float:left;width:100%}
.pf-note{clear:both;color:var(--muted);font-size:13px;margin:2px 0 10px}.pf-opts{display:flex;flex-wrap:wrap;gap:8px}
.pf-opts label{position:relative;display:inline-flex;align-items:center;min-height:44px;border:1px solid var(--line-strong);border-radius:999px;padding:0 14px;font-size:14px;cursor:pointer;background:var(--surface)}
.pf-opts input{position:absolute;opacity:0;pointer-events:none}.pf-opts label:has(input:checked){border-color:var(--btn-bg);background:var(--btn-bg);color:var(--btn-fg)}.pf-opts label:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:2px}
.pf-watch{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.pf-watch b{font-size:15.5px}
.st-nav{position:sticky;top:60px;z-index:3;display:flex;gap:6px;overflow-x:auto;padding:8px 0;margin:0 0 4px;background:var(--page);scrollbar-width:none}.st-nav::-webkit-scrollbar{display:none}
.st-nav a{flex:none;display:inline-flex;align-items:center;min-height:40px;padding:0 14px;border:1px solid var(--line-strong);border-radius:999px;font-size:14px;font-weight:700;color:var(--fg);text-decoration:none;background:var(--surface)}
.st-h{font-size:18px;margin:22px 2px 8px;scroll-margin-top:124px}.pf .al{max-width:none;margin:0}.st-rows a{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:52px;border-top:1px solid var(--line);color:var(--fg);text-decoration:none}.st-rows a:first-child{border-top:0}.st-rows small{display:block;color:var(--muted);font-size:12.5px}
.pf .theme-bar button{min-height:44px;padding:0 16px;font-size:14px}
.pf-state{font-size:13px;color:var(--muted);margin:10px 0 0}.pf-state:empty{display:none}.pf-links{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;margin-top:6px}
</style><div class="pf">
<section class="card"><div class="pl-k">설정</div><h1>설정</h1><p class="muted">투자 방식, 화면, 알림, 계정을 여기서 한 번에 바꿔요. 고르면 바로 저장되고, 로그인하면 다른 기기에서도 같아요.</p></section>
<nav class="st-nav" aria-label="설정 바로가기"><a href="#profile">내 투자 방식</a><a href="#screen">화면</a><a href="#alerts">알림</a><a href="#account">계정</a></nav>
<h2 class="st-h" id="profile">내 투자 방식</h2><p class="muted small">홈 화면, 종목 화면, AI 답변이 이 값을 따라요.</p><p class="pf-state" id="pf-state" aria-live="polite"></p>
<section class="card" id="pf-form">
${group('persona', '보기 방식', '홈과 종목 화면에서 무엇을 먼저 보여 줄지 정해요.', 'one', PERSONAS.map((p) => p.label))}
${group('horizon', '투자 기간', '홈의 내 종목 카드가 이 기간에 맞는 조건을 골라 줘요. AI는 이 기간에서 중요한 것부터 답해요.', 'one', HORIZON)}
${group('explain', '설명 깊이', 'AI 질문의 답이 이 수준으로 와요.', 'one', EXPLAIN)}
${group('assets', '관심 자산', '여러 개 골라도 돼요.', 'many', ASSETS)}
${group('sectors', '관심 업종', '홈의 내 종목 카드에 관련 테마로 바로 가는 칩이 생겨요.', 'many', SECTORS)}
<div class="pf-row"><div class="pf-watch"><div><b>관심 종목</b><p class="pf-note" id="pf-watch">☆를 누른 종목이 여기 모여요.</p></div><a href="index.html#watch">홈에서 보기 ›</a></div></div>
</section>
<h2 class="st-h" id="screen">화면</h2>
<section class="card"><div class="pf-row" style="padding-top:0"><b>화면 색</b><p class="pf-note">이 기기에 저장돼요.</p><div class="theme-bar" role="group" aria-label="화면 색"><button type="button" data-theme-pick="dark">어둡게</button><button type="button" data-theme-pick="light">밝게</button><button type="button" data-theme-pick="auto">기기 설정</button></div></div></section>
<h2 class="st-h" id="alerts">알림</h2><p class="muted small">새 리포트, 스크리너 조건, 내가 건 가격, 요청한 리포트를 🔔과 휴대폰으로 알려 드려요.</p>
<div class="al">${al.html}</div>
<h2 class="st-h" id="account">계정</h2>
<section class="card st-rows"><a href="account.html"><span><b>내 계정</b><small>크레딧, 크레딧 요청, 내 데이터 내려받기</small></span><i aria-hidden="true">›</i></a><a href="pricing.html"><span><b>요금제</b><small>지금 요금제와 쓸 수 있는 기능</small></span><i aria-hidden="true">›</i></a><a href="onboarding.html"><span><b>설문 처음부터 다시 하기</b><small>모든 문항을 다시 골라요</small></span><i aria-hidden="true">›</i></a></section>
</div>${al.script}<script>
document.addEventListener('DOMContentLoaded', function () {
  var G = window.GNM || {}, $ = function (id) { return document.getElementById(id); }, form = $('pf-form');
  var VIEWS = ${JSON.stringify(PERSONAS.map((p) => [p.key, p.label]))};
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var put = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var read = function () { try { return JSON.parse(get('gnm-prefs') || 'null') || {}; } catch (e) { return {}; } };
  var state = function (t) { $('pf-state').textContent = t; };
  // The account's answers (the onboarding survey): a pick on a fresh browser merges into them, never replaces them.
  var server = null, ready = (G.ready || Promise.resolve(null)).then(function (me) {
    var on = me && me.survey && me.survey.onboarding;
    if (on && typeof on === 'object') { server = on; var mix = Object.assign({}, on, read()); put('gnm-prefs', JSON.stringify(mix)); }
    return me;
  }).catch(function () { return null; });
  var fill = function () {
    var a = read(), view = get('gnm-persona') || document.documentElement.getAttribute('data-persona') || '';
    var label = (VIEWS.filter(function (v) { return v[0] === view; })[0] || [])[1];
    form.querySelectorAll('input').forEach(function (i) {
      var k = i.name, v = k === 'persona' ? label : a[k];
      i.checked = Array.isArray(v) ? v.indexOf(i.value) >= 0 : v === i.value;
    });
    var w = []; try { w = JSON.parse(get('gnm-watch') || '[]'); } catch (e) {}
    $('pf-watch').textContent = w.length ? '☆를 누른 종목 ' + w.length + '개가 있어요.' : '아직 없어요. 종목 화면에서 ☆를 누르면 여기 모여요.';
  };
  var sendT = null, pending = false, sent = '';
  var flush = function () {
    clearTimeout(sendT); if (!pending) return; pending = false;
    var answers = Object.assign({}, server || {}, read()), body = JSON.stringify(answers);
    if (body === sent) { state('저장했어요. 다른 기기에서도 같아요.'); return; }
    G.call('POST', '/survey', { kind: 'onboarding', answers: answers }).then(function (r) {
      if (r && r.error) { state('계정에 저장하지 못했어요. 이 기기에는 저장됐어요. 잠시 뒤 다시 골라 주세요.'); return; }
      sent = body; server = answers; state('저장했어요. 다른 기기에서도 같아요.');
    });
  };
  // Signed in, the server copy of the answers follows too (AI answers read it); a quick pick-and-leave still goes.
  var send = function () {
    ready.then(function (me) {
      if (!me || !G.call) { state('이 기기에 저장했어요. 로그인하면 다른 기기에서도 같아져요.'); return; }
      pending = true; state('저장하는 중…'); clearTimeout(sendT); sendT = setTimeout(flush, 800);
    });
  };
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  form.addEventListener('change', function (e) {
    var i = e.target, k = i && i.name; if (!k) return;
    if (G.track) G.track('profile', { k: k });
    if (k === 'persona') {
      var key = (VIEWS.filter(function (v) { return v[1] === i.value; })[0] || [])[0]; if (!key) return;
      put('gnm-persona', key);
      document.documentElement.setAttribute('data-persona', key); window.dispatchEvent(new Event('gnm-persona'));
      if (!pending) ready.then(function (me) { if (!pending) state(me ? '저장했어요. 다른 기기에서도 같아요.' : '이 기기에 저장했어요. 로그인하면 다른 기기에서도 같아져요.'); });
      return;
    }
    var a = read();
    a[k] = i.type === 'checkbox' ? [].map.call(form.querySelectorAll('input[name="' + k + '"]:checked'), function (c) { return c.value; }) : i.value;
    put('gnm-prefs', JSON.stringify(a));
    send();
  });
  fill();
  // The account's copy may land after the page (G-109 sync or the survey answers above).
  ready.then(fill);
});
</script>`;
  return shell('', '설정 | GNOMON', body, { noFeedback: true });
}
