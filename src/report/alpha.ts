// Closed alpha in the browser (docs/DESIGN.md §5.13, G-44): sign-in state, the account badge, credit
// spending through the API, usage events, in-place feedback and the weekly pulse survey.
// Only active when the site is built with an API address (gnm.config.json or GNM_API_URL);
// otherwise every page keeps the browser-only MOCK from plans.ts.

/** Set once by the build before pages are rendered. */
export const SITE_CONFIG: { apiUrl: string } = { apiUrl: '' };

export function apiMeta(): string {
  return /^https:\/\/[a-z0-9.-]+(:\d+)?\/?$|^http:\/\/localhost:\d+\/?$/.test(SITE_CONFIG.apiUrl) ? `<meta name="gnm-api" content="${SITE_CONFIG.apiUrl.replace(/\/$/, '')}">` : '';
}

export const ALPHA_CSS = `
.alpha-bar{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;background:#e8eef7;color:#1d3a6e;font-size:13px;padding:8px 14px;border-bottom:1px solid #c9d6ee}.alpha-bar a{font-weight:700}.alpha-bar button{border:0;background:none;color:inherit;font-size:16px;cursor:pointer}
.fb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:18px;padding:10px 12px;border:1px dashed var(--line-strong);border-radius:12px;font-size:13px;color:var(--muted)}
.fb-row button{border:1px solid var(--line);background:#fff;border-radius:8px;padding:3px 9px;cursor:pointer;font:inherit}.fb-row button[aria-pressed=true]{border-color:var(--accent);background:var(--accent-soft)}
.fb-row form{display:flex;gap:6px;flex:1 1 100%}.fb-row input{flex:1;border:1px solid var(--line-strong);border-radius:8px;padding:6px 9px;font:inherit}
.wk-pulse{position:fixed;left:20px;bottom:20px;z-index:65;width:min(360px,calc(100vw - 28px));background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 44px rgba(15,27,45,.22);padding:14px}
.wk-pulse h3{margin:0 0 6px;font-size:15px}.wk-pulse .nps{display:grid;grid-template-columns:repeat(11,1fr);gap:3px;margin:6px 0 2px}.wk-pulse .nps button{border:1px solid var(--line);background:#fff;border-radius:6px;padding:5px 0;font:inherit;font-size:12px;cursor:pointer}
.wk-pulse .nps button[aria-pressed=true]{background:var(--navy);color:#fff;border-color:var(--navy)}.wk-pulse .ends{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}
.wk-pulse textarea{width:100%;margin-top:8px;border:1px solid var(--line-strong);border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;min-height:54px}.wk-pulse .row{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
.wk-pulse .row button{border:0;border-radius:10px;padding:8px 12px;font:inherit;font-weight:700;cursor:pointer}.wk-pulse .row .later{background:#eef1f5;color:var(--fg2)}.wk-pulse .row .go{background:var(--navy);color:#fff}
@media (max-width:820px){.wk-pulse{left:14px;bottom:78px}}
.bell-btn{position:relative;border:1px solid rgba(255,255,255,.28);background:none;color:#fff;border-radius:999px;width:32px;height:30px;cursor:pointer;font-size:14px}.bell-btn i{position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;border-radius:8px;background:#e5484d;color:#fff;font:700 10px/16px inherit;font-style:normal;padding:0 4px}
.bell-pop{position:absolute;right:16px;top:58px;z-index:70;width:min(360px,calc(100vw - 24px));max-height:70vh;overflow:auto;background:#fff;color:var(--fg);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 44px rgba(15,27,45,.22);padding:8px}
.bell-pop a{display:block;padding:9px 10px;border-radius:10px;text-decoration:none;color:inherit}.bell-pop a:hover{background:var(--accent-soft)}.bell-pop a.unread b::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:#e5484d;margin-right:6px;vertical-align:1px}.bell-pop small{display:block;color:var(--muted)}
`;

export const ALPHA_SCRIPT = `<script>
(function () {
  var meta = document.querySelector('meta[name=gnm-api]');
  if (!meta) return;
  var API = meta.content, SK = 'gnm-session', MK = 'gnm-me', base = document.body.getAttribute('data-base') || '';
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var set = function (k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var G = window.GNM = window.GNM || {};
  var toast = G.toast || function (m) { alert(m); };
  G.api = API;
  G.call = function (method, path, body) {
    var s = get(SK), h = { 'Content-Type': 'application/json' };
    if (s) h.Authorization = 'Bearer ' + s;
    return fetch(API + path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined, keepalive: method === 'POST' && path === '/events' }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        j = j || {}; j._status = r.status;
        if (r.status === 401 && s) { set(SK, null); set(MK, null); G.me = null; paint(); }
        return j;
      });
    }, function () { return { error: 'NETWORK', message: '연결이 끊겼어요. 잠시 뒤 다시 해 주세요.', _status: 0 }; });
  };
  try { G.me = get(SK) ? JSON.parse(get(MK) || 'null') : null; } catch (e) { G.me = null; }
  G.read = function () { var m = G.me; return { plan: m ? m.user.rankAs : 'free', credits: m ? m.credits.balance : 0, trial: 0, grants: [], claimed: [], log: [], requests: [] }; };
  G.spend = function () { toast('크레딧은 서버에서 차감돼요.'); return false; };
  var paint = G.paint = function () {
    var m = G.me;
    document.documentElement.setAttribute('data-plan', m ? m.user.rankAs : 'free');
    document.querySelectorAll('[data-plan-name]').forEach(function (el) { el.textContent = m ? m.user.planName : '무료'; });
    document.querySelectorAll('[data-credits]').forEach(function (el) { el.textContent = m ? m.credits.balance.toLocaleString('ko-KR') : '0'; });
    document.querySelectorAll('[data-trial]').forEach(function (el) { el.textContent = ''; });
    document.querySelectorAll('.acct').forEach(function (a) {
      if (m) { a.href = base + 'account.html'; a.setAttribute('aria-label', '내 계정과 크레딧'); a.innerHTML = '<span>' + esc(m.user.planName) + '</span><i>' + m.credits.balance.toLocaleString('ko-KR') + ' 크레딧</i>'; }
      else { a.href = base + 'login.html'; a.setAttribute('aria-label', '로그인'); a.innerHTML = '<span>로그인</span>'; }
    });
    document.querySelectorAll('[data-acct-tab]').forEach(function (a) { a.href = base + (m ? 'account.html' : 'login.html'); });
    var nav = document.querySelector('.top-links'), adm = document.getElementById('nav-admin');
    if (m && m.user.admin && !adm) { var slot = document.getElementById('sm-admin'); if (slot) slot.innerHTML = '<div class="sm-group"><div class="sm-title">운영</div><a id="nav-admin" href="' + base + 'admin.html">운영 화면</a></div>'; }
    // Locked sections point signed-out visitors to the alpha sign-in instead of the price list.
    document.querySelectorAll('.gate-cta .btn-primary').forEach(function (b) { if (!m) { b.href = base + 'login.html'; b.textContent = '알파 로그인'; } });
  };
  G.refresh = function () {
    if (!get(SK)) { G.me = null; paint(); return Promise.resolve(null); }
    return G.call('GET', '/me').then(function (r) { if (!r.error) { G.me = r; set(MK, JSON.stringify(r)); paint(); } return G.me; });
  };
  // Notifications (screener alerts): a bell next to the account badge.
  var bell = function () {
    var nav = document.querySelector('.top-links'), acct = nav && nav.querySelector('.acct');
    if (!G.me || !acct || document.getElementById('bell')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'bell'; b.className = 'bell-btn'; b.setAttribute('aria-label', '알림'); b.innerHTML = '🔔';
    nav.insertBefore(b, acct);
    var pop = null;
    G.call('GET', '/notifications').then(function (r) {
      if (r.error) return;
      if (r.unread) b.insertAdjacentHTML('beforeend', '<i>' + r.unread + '</i>');
      b.addEventListener('click', function () {
        if (pop) { pop.remove(); pop = null; return; }
        pop = document.createElement('div'); pop.className = 'bell-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', '알림');
        pop.innerHTML = r.items.length ? r.items.map(function (n) { return '<a class="' + (n.read_at ? '' : 'unread') + '" href="' + base + esc(n.link || '') + '"><b>' + esc(n.title) + '</b><small>' + esc(n.body) + '</small></a>'; }).join('') : '<p class="muted small" style="padding:10px">알림이 없어요. 스크리너에서 저장한 조건의 🔔를 켜면 매일 장 마감 뒤 새로 걸린 종목을 알려 드려요.</p>';
        document.querySelector('.topbar').appendChild(pop);
        if (r.unread) { G.call('POST', '/notifications/read'); var i = b.querySelector('i'); if (i) i.remove(); r.unread = 0; }
        G.track('bell_open', {});
      });
    });
  };
  // Watchlist sync (G-52): the newer side wins; local changes are pushed as they happen.
  var watchSync = function () {
    if (!G.me) return;
    var local = []; try { local = JSON.parse(get('gnm-watch') || '[]'); } catch (e) {}
    var at = Number(get('gnm-watch-at') || 0);
    G.call('GET', '/watch').then(function (r) {
      if (r.error) return;
      var serverAt = r.updatedAt ? Date.parse(r.updatedAt) : 0;
      if (serverAt > at && JSON.stringify(r.symbols) !== JSON.stringify(local)) { set('gnm-watch', JSON.stringify(r.symbols)); set('gnm-watch-at', String(serverAt)); }
      else if (at > serverAt) G.call('POST', '/watch', { symbols: local });
    });
  };
  window.addEventListener('gnm-watch', function () { if (!G.me) return; var w = []; try { w = JSON.parse(get('gnm-watch') || '[]'); } catch (e) {} G.call('POST', '/watch', { symbols: w }); });
  G.signIn = function (session, me) { set(SK, session); G.me = me; set(MK, JSON.stringify(me)); paint(); };
  G.signOut = function () { return G.call('POST', '/auth/logout').then(function () { set(SK, null); set(MK, null); G.me = null; paint(); }); };
  // Usage events, batched (what people actually open and use).
  var queue = [], flush = function () {
    if (!queue.length || !get(SK)) { queue = []; return; }
    G.call('POST', '/events', { events: queue.splice(0, 20) });
  };
  G.track = function (name, props) { if (G.me) { queue.push({ name: name, page: location.pathname.slice(-120), props: props || {} }); if (queue.length >= 20) flush(); } };
  setInterval(flush, 10000);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[role=tab], .gate-cta a, [data-track]');
    if (!t) return;
    if (t.getAttribute('role') === 'tab') G.track('tab_open', { tab: (t.getAttribute('aria-controls') || t.textContent).replace('tab-', '') });
    else if (t.closest('.gate-cta')) G.track('gate_click', { need: t.closest('.gate').getAttribute('data-need') });
    else G.track(t.getAttribute('data-track'), {});
  });
  // Credit actions through the server: report requests, upgrades, expert invitations.
  var WORD = { report: '심층 리포트 요청', brief: '요약 리포트 요청', upgrade: '심층 리포트로 업그레이드', invite: '전문가 AI 초청' };
  var action = function (kind, sym, name, detail) {
    if (!G.me) { location.href = base + 'login.html'; return Promise.resolve(false); }
    var c = G.me.costs[kind];
    if (!confirm(name + ' ' + WORD[kind] + (detail ? ' (' + detail + ')' : '') + ': ' + c + '크레딧을 쓸까요? 알파에서는 운영자가 확인하고 처리해요.')) return Promise.resolve(false);
    return G.call('POST', '/actions', { kind: kind, symbol: sym, detail: detail || '' }).then(function (r) {
      if (r.error) { toast(r.message); if (r.error === 'NO_CREDITS') { var b = document.querySelector('[data-open-chat]'); if (b) b.click(); } return false; }
      toast('접수했어요. 남은 크레딧 ' + r.balance + '개'); G.track('action', { kind: kind, symbol: sym }); G.refresh(); return true;
    });
  };
  document.querySelectorAll('[data-spend]').forEach(function (b) {
    var kind = b.getAttribute('data-spend'); if (!WORD[kind]) return;
    b.addEventListener('click', function () {
      var sym = b.getAttribute('data-symbol') || new URLSearchParams(location.search).get('c') || '';
      if (sym) action(kind, sym, b.getAttribute('data-name') || sym);
    });
  });
  document.querySelectorAll('form.invite').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var pick = f.querySelector('input[name=expert]:checked'), who = pick ? pick.closest('label').querySelector('b').textContent : '전문가';
      action('invite', f.getAttribute('data-symbol'), f.getAttribute('data-name'), who + (f.querySelector('input[name=standing]').checked ? ' (정기)' : '')).then(function (ok) {
        if (ok) { var out = f.querySelector('.ask-out'); out.hidden = false; out.innerHTML = '<p><b>' + esc(who) + '</b> 초청을 접수했어요. 의견은 운영자가 처리한 뒤 이 종목 리포트에 실려요.</p>'; }
      });
    });
  });
  // In-place feedback under each report tab (and once per other page).
  var feedback = function () {
    if (!G.me || document.querySelector('.fb-row')) return;
    var spots = [].slice.call(document.querySelectorAll('.panel[id^=tab-]'));
    if (!spots.length) { var main = document.getElementById('main'); if (main && !document.body.hasAttribute('data-no-feedback')) spots = [main]; }
    spots.forEach(function (p) {
      var target = p.id && p.id.indexOf('tab-') === 0 ? 'tab:' + p.id.slice(4) : 'page';
      var row = document.createElement('div'); row.className = 'fb-row';
      row.innerHTML = '<span>이 화면, 도움이 됐나요?</span><button type="button" data-r="1" aria-pressed="false">👍 도움됨</button><button type="button" data-r="-1" aria-pressed="false">👎 아쉬움</button>';
      var anchor = p.querySelector('.site-links'); if (anchor) p.insertBefore(row, anchor); else p.appendChild(row);
      row.querySelectorAll('[data-r]').forEach(function (b) {
        b.addEventListener('click', function () {
          row.querySelectorAll('[data-r]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
          var r = Number(b.getAttribute('data-r'));
          G.call('POST', '/feedback', { page: location.pathname, target: target, rating: r });
          if (row.querySelector('form')) return;
          var f = document.createElement('form');
          f.innerHTML = '<input maxlength="500" placeholder="' + (r > 0 ? '어떤 점이 좋았나요? (선택)' : '무엇이 아쉬웠나요? 한 줄이면 충분해요') + '"><button type="submit">보내기</button>';
          row.appendChild(f); f.querySelector('input').focus();
          f.addEventListener('submit', function (e) { e.preventDefault(); var v = f.querySelector('input').value.trim(); if (v) G.call('POST', '/feedback', { page: location.pathname, target: target, rating: r, text: v }); f.outerHTML = '<span>고마워요! 다음 개선에 반영할게요.</span>'; });
        });
      });
    });
  };
  // Nudges: the onboarding survey once, the weekly pulse when it's due.
  var nudges = function () {
    var m = G.me, path = location.pathname;
    if (!m || /(login|onboarding|admin)\\.html$/.test(path)) return;
    if (!m.survey.onboarding && !document.querySelector('.alpha-bar') && sessionStorage.getItem('gnm-nudge') !== '1') {
      var bar = document.createElement('div'); bar.className = 'alpha-bar';
      bar.innerHTML = '<span>1분 설문에 답하면 홈 화면을 내 관심 종목과 투자 스타일에 맞춰 드려요.</span><a href="' + base + 'onboarding.html">설문 시작</a><button type="button" aria-label="닫기">×</button>';
      document.body.insertBefore(bar, document.body.firstChild);
      bar.querySelector('button').addEventListener('click', function () { bar.remove(); try { sessionStorage.setItem('gnm-nudge', '1'); } catch (e) {} });
    }
    if (m.survey.pulseDue && !document.querySelector('.wk-pulse') && sessionStorage.getItem('gnm-pulse') !== 'later') {
      var p = document.createElement('section'); p.className = 'wk-pulse'; p.setAttribute('aria-label', '이번 주 설문');
      var nps = ''; for (var i = 0; i <= 10; i += 1) nps += '<button type="button" data-n="' + i + '" aria-pressed="false">' + i + '</button>';
      p.innerHTML = '<h3>이번 주 그노몬, 어땠어요?</h3><div class="muted small">투자하는 친구에게 추천할 만한가요?</div><div class="nps">' + nps + '</div><div class="ends"><span>전혀 아님</span><span>꼭 추천</span></div><textarea maxlength="500" placeholder="이번 주 가장 아쉬웠던 점 한 가지"></textarea><textarea maxlength="500" placeholder="가장 좋았던 점 (선택)"></textarea><div class="row"><button type="button" class="later">나중에</button><button type="button" class="go">보내기</button></div>';
      document.body.appendChild(p);
      var score = null;
      p.querySelectorAll('[data-n]').forEach(function (b) { b.addEventListener('click', function () { score = Number(b.getAttribute('data-n')); p.querySelectorAll('[data-n]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); });
      p.querySelector('.later').addEventListener('click', function () { p.remove(); try { sessionStorage.setItem('gnm-pulse', 'later'); } catch (e) {} });
      p.querySelector('.go').addEventListener('click', function () {
        if (score === null) { toast('0~10 중 하나를 골라 주세요.'); return; }
        var t = p.querySelectorAll('textarea');
        G.call('POST', '/survey', { kind: 'pulse', answers: { nps: score, worst: t[0].value.trim(), best: t[1].value.trim(), page: location.pathname } }).then(function () { p.remove(); toast('고마워요! 매주 바뀐 점을 알려 드릴게요.'); G.refresh(); });
      });
    }
  };
  paint();
  G.ready = G.refresh().then(function () { feedback(); nudges(); bell(); watchSync(); G.track('page_view', { plan: G.me ? G.me.user.plan : 'signed_out' }); flush(); return G.me; });
})();
</script>`;
