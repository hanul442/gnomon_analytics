// 설정 (G-210): every setting in one page — 내 투자 방식 (G-207: view, holding period, explanation depth,
// assets, sectors, watched stocks), 화면 (theme), 알림 (G-97, the alerts page's parts) and 계정 links.
// Profile picks save at once to gnm-prefs/gnm-persona (which follow the account, G-109) and, signed in,
// to the onboarding answers on the server, which AI answers read.

import { esc } from './html.js';
import { shell } from './renderHtml.js';
import { PERSONAS } from './persona.js';
import { SECTORS } from './sectors.js';
import { ASSETS, EXPLAIN, HORIZON } from './profile.js';
import { CREDIT_COST, EXPERTS } from './plans.js';
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
.cm-list{display:flex;flex-direction:column;gap:8px}.cm-item{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:12px;padding:6px 6px 6px 12px;background:var(--surface)}.cm-item b{flex:1;min-width:0;font-size:14.5px}.cm-item small{display:block;color:var(--muted);font-size:12px;font-weight:400}.cm-n{flex:none;width:22px;color:var(--muted);font-weight:800}
.cm-item button{flex:none;width:44px;height:44px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--fg);font:inherit;font-size:16px;cursor:pointer}.cm-item button:disabled{opacity:.35;cursor:default}
.cm-add{display:flex;flex-wrap:wrap;gap:8px}.cm-add button{min-height:44px;border:1px dashed var(--line-strong);border-radius:999px;padding:0 14px;background:transparent;color:var(--fg);font:inherit;font-size:14px;cursor:pointer}.cm-add button:disabled{opacity:.4;cursor:default}
.cm-new{display:grid;gap:8px;margin-top:10px}.cm-new label{display:grid;gap:4px;font-size:13px;font-weight:700}.cm-new input,.cm-new textarea,.cm-new select{font:inherit;font-weight:400;padding:10px 12px;border:1px solid var(--line-strong);border-radius:10px;background:var(--surface);color:var(--fg)}.cm-new button{min-height:44px;border:0;border-radius:12px;background:var(--btn-bg);color:var(--btn-fg);font:inherit;font-weight:800;cursor:pointer}.cm-err{color:var(--up-strong);font-size:13px;min-height:0;margin:0}.cm-err:empty{display:none}
.pf-state{font-size:13px;color:var(--muted);margin:10px 0 0}.pf-state:empty{display:none}.pf-links{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;margin-top:6px}
</style><div class="pf">
<section class="card"><div class="pl-k">설정</div><h1>설정</h1><p class="muted">투자 방식, 화면, 알림, 계정을 여기서 한 번에 바꿔요. 고르면 바로 저장되고, 로그인하면 다른 기기에서도 같아요.</p></section>
<nav class="st-nav" aria-label="설정 바로가기"><a href="#profile">내 투자 방식</a><a href="#committee">내 위원회</a><a href="#screen">화면</a><a href="#alerts">알림</a><a href="#account">계정</a></nav>
<h2 class="st-h" id="profile">내 투자 방식</h2><p class="muted small">홈 화면, 종목 화면, AI 답변이 이 값을 따라요.</p><p class="pf-state" id="pf-state" aria-live="polite"></p>
<section class="card" id="pf-form">
${group('persona', '보기 방식', '홈과 종목 화면에서 무엇을 먼저 보여 줄지 정해요.', 'one', PERSONAS.map((p) => p.label))}
${group('horizon', '투자 기간', '홈의 내 종목 카드가 이 기간에 맞는 조건을 골라 줘요. AI는 이 기간에서 중요한 것부터 답해요.', 'one', HORIZON)}
${group('explain', '설명 깊이', 'AI 질문의 답이 이 수준으로 와요.', 'one', EXPLAIN)}
${group('assets', '관심 자산', '여러 개 골라도 돼요.', 'many', ASSETS)}
${group('sectors', '관심 업종', '홈의 내 종목 카드에 관련 테마로 바로 가는 칩이 생겨요.', 'many', SECTORS)}
<div class="pf-row"><div class="pf-watch"><div><b>관심 종목</b><p class="pf-note" id="pf-watch">☆를 누른 종목이 여기 모여요.</p></div><a href="index.html#watch">홈에서 보기 ›</a></div></div>
</section>
<h2 class="st-h" id="committee">내 위원회</h2><p class="muted small">리포트 토론의 질문 칸 위에 이 순서대로 나와서 한 번에 골라 물어볼 수 있어요. 5명까지 고르고, 다른 기기에서도 같아요. 위원회 전체는 플러스부터 ${CREDIT_COST.standard}크레딧, 전문가 초청은 프로부터 ${CREDIT_COST.invite}크레딧이에요(질문당).</p>
<section class="card" id="cm"><div class="pf-row" style="padding-top:0"><b>내가 고른 위원</b><p class="pf-note" id="cm-empty">아직 없어요. 아래에서 골라 주세요.</p><div class="cm-list" id="cm-list"></div></div>
<div class="pf-row"><b>더할 수 있는 위원</b><p class="pf-note">눌러서 내 위원회에 넣어요.</p><div class="cm-add" id="cm-add"></div></div>
<div class="pf-row"><details id="cm-make"><summary><b>내 전문가 만들기</b></summary><p class="pf-note">이름과 보는 관점을 정하면 그 관점으로 답해요. 로그인하면 계정에 저장돼요(20명까지).</p><form class="cm-new" id="cm-new"><label>이름<input name="name" maxlength="40" placeholder="예: 보수적인 반도체 전문가" required></label><label>분석 관점<textarea name="focus" maxlength="600" rows="3" placeholder="예: 설비투자와 현금흐름 중심으로 위험을 점검" required></textarea></label><label>답변 스타일<select name="style"><option>짧고 쉽게</option><option>숫자와 근거 중심</option><option>반대 근거와 위험 중심</option></select></label><p class="cm-err" id="cm-err" role="alert"></p><button type="submit">만들고 내 위원회에 넣기</button></form></details></div></section>
<h2 class="st-h" id="screen">화면</h2>
<section class="card"><div class="pf-row" style="padding-top:0"><b>화면 색</b><p class="pf-note">이 기기에 저장돼요.</p><div class="theme-bar" role="group" aria-label="화면 색"><button type="button" data-theme-pick="dark">어둡게</button><button type="button" data-theme-pick="light">밝게</button><button type="button" data-theme-pick="auto">기기 설정</button></div></div></section>
<h2 class="st-h" id="alerts">알림</h2><p class="muted small">새 리포트, 스크리너 조건, 내가 건 가격, 요청한 리포트를 🔔과 휴대폰으로 알려 드려요.</p>
<div class="al">${al.html}</div>
<h2 class="st-h" id="account">계정</h2>
<section class="card st-rows"><a href="account.html"><span><b>내 계정</b><small>크레딧, 크레딧 요청, 내 데이터 내려받기</small></span><i aria-hidden="true">›</i></a><a href="pricing.html"><span><b>요금제</b><small>지금 요금제와 쓸 수 있는 기능</small></span><i aria-hidden="true">›</i></a><a href="onboarding.html"><span><b>설문 처음부터 다시 하기</b><small>모든 문항을 다시 골라요</small></span><i aria-hidden="true">›</i></a></section>
</div>${al.script}<script>
// G-212: 내 위원회 — up to five answerers in order, kept in gnm-committee ([{k, n}]; follows the account, G-109).
document.addEventListener('DOMContentLoaded', function () {
  var G = window.GNM || {}, $ = function (id) { return document.getElementById(id); }, MAX = 5, BUILT = ${JSON.stringify(EXPERTS.map((e) => ({ k: e.key, n: e.name, f: e.focus })))}, custom = [];
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var read = function () { try { var a = JSON.parse(localStorage.getItem('gnm-committee') || '[]'); return Array.isArray(a) ? a.filter(function (x) { return x && typeof x.k === 'string' && typeof x.n === 'string'; }).slice(0, MAX) : []; } catch (e) { return []; } };
  var save = function (a) { try { localStorage.setItem('gnm-committee', JSON.stringify(a.slice(0, MAX))); } catch (e) {} paint(); };
  var pool = function () { return BUILT.concat(custom.map(function (x) { return { k: 'custom:' + x.id, n: x.name, f: x.focus, mine: 1 }; })); };
  var nameOf = function (x) { var p = pool().filter(function (q) { return q.k === x.k; })[0]; return p ? p.n : x.n; };
  var focusOf = function (k) { var x = pool().filter(function (p) { return p.k === k; })[0]; return x ? x.f : ''; };
  var paint = function () {
    var a = read().map(function (x) { return { k: x.k, n: nameOf(x) }; }), list = $('cm-list');
    $('cm-empty').hidden = !!a.length;
    list.innerHTML = a.map(function (x, i) {
      return '<div class="cm-item"><span class="cm-n">' + (i + 1) + '</span><b>' + esc(x.n) + '<small>' + esc(focusOf(x.k)) + '</small></b>'
        + '<button type="button" data-up="' + i + '" aria-label="' + esc(x.n) + ' 위로"' + (i ? '' : ' disabled') + '>↑</button>'
        + '<button type="button" data-down="' + i + '" aria-label="' + esc(x.n) + ' 아래로"' + (i < a.length - 1 ? '' : ' disabled') + '>↓</button>'
        + '<button type="button" data-out="' + i + '" aria-label="' + esc(x.n) + ' 빼기">×</button></div>';
    }).join('');
    var have = {}; a.forEach(function (x) { have[x.k] = 1; });
    $('cm-add').innerHTML = pool().filter(function (p) { return !have[p.k]; }).map(function (p) {
      return '<button type="button" data-add="' + esc(p.k) + '"' + (a.length >= MAX ? ' disabled' : '') + ' title="' + esc(p.f) + '">+ ' + esc(p.n) + (p.mine ? ' · 내 전문가' : '') + '</button>';
    }).join('') || '<p class="pf-note">모두 넣었어요.</p>';
  };
  $('cm').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button'); if (!b || b.disabled) return;
    var a = read(), i;
    if (b.hasAttribute('data-add')) { var k = b.getAttribute('data-add'), p = pool().filter(function (x) { return x.k === k; })[0]; if (p && a.length < MAX) { a.push({ k: p.k, n: p.n }); save(a); } }
    else if (b.hasAttribute('data-up')) { i = +b.getAttribute('data-up'); if (i > 0) { a.splice(i - 1, 0, a.splice(i, 1)[0]); save(a); } }
    else if (b.hasAttribute('data-down')) { i = +b.getAttribute('data-down'); if (i < a.length - 1) { a.splice(i + 1, 0, a.splice(i, 1)[0]); save(a); } }
    else if (b.hasAttribute('data-out')) { a.splice(+b.getAttribute('data-out'), 1); save(a); }
  });
  $('cm-new').addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target, btn = f.querySelector('button'); $('cm-err').textContent = '';
    if (!G.me || !G.call) { location.href = 'login.html?return=' + encodeURIComponent('settings.html#committee'); return; }
    btn.disabled = true;
    G.call('POST', '/experts', { name: f.name.value, focus: f.focus.value, style: f.style.value }).then(function (r) {
      btn.disabled = false;
      if (r.error) { $('cm-err').textContent = r.message || '저장하지 못했어요. 잠시 뒤 다시 해 주세요.'; return; }
      custom.push(r.expert); f.reset(); $('cm-make').open = false; $('cm-err').textContent = '';
      var a = read(); if (a.length < MAX) { a.push({ k: 'custom:' + r.expert.id, n: r.expert.name }); save(a); } else { paint(); $('cm-err').textContent = '만들었어요. 내 위원회가 가득 차서(5명) 넣지는 못했어요. 한 명을 빼고 더해 주세요.'; $('cm-make').open = true; }
    });
  });
  paint();
  (G.ready || Promise.resolve(null)).then(function (me) {
    paint();
    if (!me || !G.call) return;
    G.call('GET', '/experts').then(function (r) {
      if (r.error) return; custom = r.items || [];
      // A custom expert deleted elsewhere leaves the committee too (not while viewing as someone else).
      if (localStorage.getItem('gnm-view-as')) { paint(); return; }
      var ids = {}; custom.forEach(function (x) { ids['custom:' + x.id] = 1; });
      var a = read(), kept = a.filter(function (x) { return x.k.indexOf('custom:') !== 0 || ids[x.k]; });
      if (kept.length !== a.length) save(kept); else paint();
    });
  });
});
</script><script>
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
