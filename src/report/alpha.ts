import {ORBS} from './ui.js';
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
.bell-btn.push-on::after{content:'';position:absolute;left:-2px;bottom:-2px;width:9px;height:9px;border-radius:50%;background:#22c55e;border:2px solid var(--navy)}.bell-push{margin:2px 0 8px;padding:10px;border-radius:12px;background:#eef3fb;font-size:13px;display:flex;flex-direction:column;gap:6px}.bell-push.on{flex-direction:row;justify-content:space-between;align-items:center;background:#ecfdf3;color:#166534;font-weight:700}.bell-push button{font:inherit;font-weight:800;border-radius:10px;cursor:pointer}.bell-allow{border:0;background:var(--navy);color:#fff;padding:11px;font-size:14.5px}.bell-push.on button{border:1px solid #86efac;background:#fff;padding:5px 10px;font-size:12.5px;color:#166534}.bell-push small{color:var(--muted)}.home-alerts{display:block;margin:-4px 0 10px;padding:9px 12px;border-radius:12px;background:#fff7e6;border:1px solid #f4dca6;font-size:13.5px;text-decoration:none;color:var(--fg)}.home-alerts.on{background:#ecfdf3;border-color:#bbf7d0}
.bell-pop{position:absolute;right:16px;top:58px;z-index:70;width:min(360px,calc(100vw - 24px));max-height:70vh;overflow:auto;background:#fff;color:var(--fg);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 44px rgba(15,27,45,.22);padding:8px}
.bell-head{display:flex;justify-content:space-between;align-items:center;padding:6px 10px 4px;font-size:13px}.bell-head button{border:0;background:none;color:var(--muted);font:inherit;font-size:12.5px;cursor:pointer;text-decoration:underline}.bell-item{display:flex;align-items:flex-start;gap:2px}.bell-item a{flex:1;min-width:0}.bell-x{border:0;background:none;color:var(--muted);font-size:18px;line-height:1;padding:8px 6px;cursor:pointer;border-radius:8px}.bell-x:hover{background:#eef1f6;color:var(--fg)}.bell-pop a{display:block;padding:9px 10px;border-radius:10px;text-decoration:none;color:inherit}.bell-pop a:hover{background:var(--accent-soft)}.bell-pop a.unread b::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:#e5484d;margin-right:6px;vertical-align:1px}.bell-pop small{display:block;color:var(--muted)}
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
  G.askStream = function (body, onText) {
    var session=get(SK), h={'Content-Type':'application/json'};if(session)h.Authorization='Bearer '+session;
    return fetch(API+'/ask/stream',{method:'POST',headers:h,body:JSON.stringify(body)}).then(async function(res){
      if(!res.ok)return res.json();
      var reader=res.body.getReader(), decoder=new TextDecoder(), pending='', answer='', terminal=null;
      while(true){var part=await reader.read();pending+=decoder.decode(part.value||new Uint8Array(),{stream:!part.done});var blocks=pending.split('\\n\\n');pending=blocks.pop();
        blocks.forEach(function(block){var event=(/^event: (.+)$/m.exec(block)||[])[1], data=(/^data: (.+)$/m.exec(block)||[])[1];if(!data)return;var value=JSON.parse(data);if(event==='delta'){answer+=value.text;if(onText)onText(answer);}else if(event==='done'||event==='error')terminal=value;});
        if(part.done)break;
      }
      return terminal||{error:'NETWORK',message:'답변 연결이 끊겼어요. 계정의 질문 기록을 확인해 주세요.'};
    }).catch(function(){return {error:'NETWORK',message:'답변 연결이 끊겼어요. 계정의 질문 기록을 확인해 주세요.'};});
  };
  try { G.me = get(SK) ? JSON.parse(get(MK) || 'null') : null; } catch (e) { G.me = null; }
  if (G.me && (!G.me.user || !G.me.credits)) { G.me = null; set(MK, null); }
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
    return G.call('GET', '/me').then(function (r) { if (!r.error && r.user && r.credits) { G.me = r; set(MK, JSON.stringify(r)); paint(); } return G.me; });
  };
  // G-101: on home, a line under 관심 종목 says what this account will hear about, so turning alerts on is visible.
  var paintHomeAlerts = function () {
    var watch = document.getElementById('watch'); if (!watch || !G.me) return;
    var line = document.getElementById('home-alerts');
    if (!line) { line = document.createElement('a'); line.id = 'home-alerts'; line.className = 'home-alerts'; line.href = base + 'alerts.html'; var head = watch.querySelector('.block-head'); (head || watch).after(line); }
    Promise.all([G.push && G.push.supported ? G.push.state() : Promise.resolve({ on: false }), G.call('GET', '/alerts/price')]).then(function (x) {
      var open = (x[1].items || []).filter(function (a) { return !a.fired_at; }).length;
      line.className = 'home-alerts' + (x[0].on ? ' on' : '');
      line.innerHTML = (x[0].on ? '🔔 <b>휴대폰 알림 켜짐</b>' : '🔕 <b>휴대폰 알림 꺼짐</b> · 눌러서 켜기') + ' · 가격 알림 ' + open + '개 걸림 ›';
    });
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
      if (G.push && G.push.supported) G.push.state().then(function (st) { if (st.on) b.classList.add('push-on'); });
      b.addEventListener('click', function () {
        if (pop) { pop.remove(); pop = null; return; }
        pop = document.createElement('div'); pop.className = 'bell-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', '알림');
        var EMPTY = '<p class="muted small bell-empty" style="padding:10px">알림이 없어요. 새 리포트, 스크리너 조건, 가격 알림, 요청한 리포트가 여기와 휴대폰으로 와요.</p>';
        pop.innerHTML = r.items.length ? '<div class="bell-head"><b>알림 ' + r.items.length + '개</b><button type="button" data-bell-clear>모두 지우기</button></div>' + r.items.map(function (n) { return '<div class="bell-item" data-nid="' + n.id + '"><a class="' + (n.read_at ? '' : 'unread') + '" href="' + base + esc(n.link || '') + '"><b>' + esc(n.title) + '</b><small>' + esc(n.body) + '</small></a><button type="button" class="bell-x" data-bell-del="' + n.id + '" aria-label="이 알림 지우기">×</button></div>'; }).join('') : EMPTY;
        // G-105: clear one or all; the list updates right away and the server follows.
        pop.addEventListener('click', function (e) {
          var del = e.target.closest('[data-bell-del]'), all = e.target.closest('[data-bell-clear]');
          if (!del && !all) return;
          e.preventDefault();
          if (all) { r.items = []; pop.querySelectorAll('.bell-item,.bell-head').forEach(function (x) { x.remove(); }); var bpush = pop.querySelector('.bell-push'); if (bpush) bpush.insertAdjacentHTML('afterend', EMPTY); else pop.insertAdjacentHTML('afterbegin', EMPTY); G.call('POST', '/notifications/clear', {}).then(function (x) { if (x.error) toast(x.message || '지우지 못했어요.'); else toast('알림을 모두 지웠어요.'); }); return; }
          var id = Number(del.getAttribute('data-bell-del')); r.items = r.items.filter(function (n) { return n.id !== id; });
          var row = del.closest('.bell-item'); if (row) row.remove();
          var head = pop.querySelector('.bell-head b'); if (head) head.textContent = '알림 ' + r.items.length + '개';
          if (!r.items.length) { var h = pop.querySelector('.bell-head'); if (h) { h.insertAdjacentHTML('afterend', EMPTY); h.remove(); } }
          G.call('POST', '/notifications/clear', { id: id }).then(function (x) { if (x.error) toast(x.message || '지우지 못했어요.'); });
        });
        pop.insertAdjacentHTML('beforeend', '<a class="bell-set" href="' + base + 'alerts.html"><b>⚙︎ 알림 설정</b></a>');
        // G-101: the phone switch comes first — one tap asks the browser, the result shows right there.
        pop.insertAdjacentHTML('afterbegin', '<div class="bell-push" hidden></div>');
        var bp = pop.querySelector('.bell-push'), paintPush = function () {
          if (!G.push || !G.push.supported) { bp.hidden = false; bp.innerHTML = '<span>' + (G.push && G.push.ios && !G.push.standalone ? '아이폰은 공유 → 홈 화면에 추가 후 그 아이콘으로 열면 휴대폰 알림을 켤 수 있어요.' : '이 브라우저는 휴대폰 알림을 지원하지 않아요. 🔔 알림함으로 받아요.') + '</span>'; return; }
          G.push.state().then(function (st) {
            bp.hidden = false;
            if (st.on) { bp.className = 'bell-push on'; bp.innerHTML = '<span>✓ 이 기기로 휴대폰 알림을 받고 있어요</span><button type="button" data-push-test>테스트</button>'; bp.querySelector('[data-push-test]').onclick = function () { G.call('POST', '/push/test').then(function (x) { toast(x.error ? x.message : '테스트 알림을 보냈어요.'); }); }; return; }
            bp.className = 'bell-push';
            bp.innerHTML = st.permission === 'denied' ? '<span>알림이 차단돼 있어요. 브라우저 주소창의 사이트 설정에서 알림을 허용해 주세요.</span>' : '<button type="button" class="bell-allow" data-push-on>📲 휴대폰 알림 허용하기</button><small>새 리포트·가격 도달·요청한 리포트를 바로 알려 드려요</small>';
            var on = bp.querySelector('[data-push-on]');
            if (on) on.onclick = function () { on.disabled = true; on.textContent = '허용 창을 확인해 주세요…'; G.push.on().then(function () { toast('휴대폰 알림을 켰어요.'); G.call('POST', '/push/test'); paintPush(); paintHomeAlerts(); }).catch(function (e) { toast(e.message || '켜지 못했어요.'); paintPush(); }); };
          });
        };
        paintPush();
        document.querySelector('.topbar').appendChild(pop);
        if (r.unread) { G.call('POST', '/notifications/read'); var i = b.querySelector('i'); if (i) i.remove(); r.unread = 0; }
        G.track('bell_open', {});
      });
    });
  };
  // Watchlist sync (G-52): the newer side wins; local changes are pushed as they happen.
  // G-109: a new browser takes the account's list; the page repaints once (reload) so stars and lists show it.
  var watchSync = function () {
    if (!G.me) return Promise.resolve(false);
    var local = []; try { local = JSON.parse(get('gnm-watch') || '[]'); } catch (e) {}
    var at = Number(get('gnm-watch-at') || 0);
    return G.call('GET', '/watch').then(function (r) {
      if (r.error) return false;
      var serverAt = r.updatedAt ? Date.parse(r.updatedAt) : 0;
      if (serverAt > at && JSON.stringify(r.symbols) !== JSON.stringify(local)) { set('gnm-watch', JSON.stringify(r.symbols)); set('gnm-watch-at', String(serverAt)); return true; }
      if (at > serverAt || (!serverAt && local.length)) G.call('POST', '/watch', { symbols: local });
      return false;
    }).catch(function () { return false; });
  };
  // G-109: settings that follow the account — view, chart indicators and drawings, dismissed tours and popups.
  // Writes to these keys while signed in are noticed wherever they happen and sent a moment later; on a new
  // browser the account's copy is applied and the page reloads once. Changes made signed out stay local.
  var SYNC = /^gnm-(persona|prefs|ind|pop-week|pop-onb|draw:[0-9A-Z-]{1,20}|tour[a-z0-9-]{0,40}|version-dismissed-[0-9.]{1,12})$/, SAT = 'gnm-settings-at', applying = false, pushT = null;
  var syncKeys = function () { var out = {}; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && SYNC.test(k)) out[k] = localStorage.getItem(k); } } catch (e) {} return out; };
  var pushSettings = function () { clearTimeout(pushT); pushT = setTimeout(function () { if (G.me) G.call('POST', '/me/settings', { data: syncKeys() }).then(function (r) { if (r && r.updatedAt) set(SAT, String(Date.parse(r.updatedAt))); }); }, 1500); };
  try {
    var S = Storage.prototype, rawSet = S.setItem, rawDel = S.removeItem;
    S.setItem = function (k, v) { rawSet.call(this, k, v); if (!applying && this === window.localStorage && SYNC.test(k) && get(SK)) { rawSet.call(this, SAT, String(Date.now())); pushSettings(); } };
    S.removeItem = function (k) { rawDel.call(this, k); if (!applying && this === window.localStorage && SYNC.test(k) && get(SK)) { rawSet.call(this, SAT, String(Date.now())); pushSettings(); } };
  } catch (e) {}
  var settingsSync = function () {
    if (!G.me) return Promise.resolve(false);
    var at = Number(get(SAT) || 0);
    return G.call('GET', '/me/settings').then(function (r) {
      if (r.error) return false;
      var serverAt = r.updatedAt ? Date.parse(r.updatedAt) : 0, local = syncKeys(), data = r.data || {}, changed = false;
      if (serverAt > at) {
        applying = true;
        try {
          Object.keys(local).forEach(function (k) { if (!(k in data)) { localStorage.removeItem(k); changed = true; } });
          Object.keys(data).forEach(function (k) { if (SYNC.test(k) && typeof data[k] === 'string' && local[k] !== data[k]) { localStorage.setItem(k, data[k]); changed = true; } });
        } catch (e) {}
        applying = false; set(SAT, String(serverAt));
        return changed;
      }
      if (at > serverAt || (!serverAt && Object.keys(local).length)) pushSettings();
      return false;
    }).catch(function () { return false; });
  };
  var syncAll = function () {
    var ww = document.getElementById('watch-where'); if (ww && G.me) ww.textContent = '계정에 저장돼요 · 다른 기기에서도 보여요';
    return Promise.all([watchSync(), settingsSync()]).then(function (r) {
      if (!r[0] && !r[1]) return;
      // Once per page: the reload shows the account's copy; the guard stops a loop if storage is blocked.
      var key = 'gnm-sync-reload:' + location.pathname; try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch (e) { return; }
      location.reload();
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
    if (['report','brief','upgrade'].indexOf(kind)>=0 && G.startReport) return G.startReport(kind,sym,name);
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
  // G-80: asking in the debate. The committee or an invited expert answers right away, as a new turn
  // at the bottom of the debate ('작성 중…' while it thinks). Experts cost the invite price (Pro).
  var md = function (t) { return esc(t).replace(/\\*\\*([^*]+)\\*\\*/g, '<b>$1</b>').split(/\\n{2,}/).map(function (p) { return '<p>' + p.replace(/\\n/g, '<br>') + '</p>'; }).join(''); };
  document.querySelectorAll('form.join').forEach(function (f) {
    var dlg=f.querySelector('dialog'), chooser=f.querySelector('[data-pick-expert]');
    var custom=[],selectedKey='committee';
    var picked=function(){var r=f.querySelector('input[name=expert]:checked');return {key:r?r.value:'committee',name:r?r.closest('label').querySelector('b').textContent:'위원회 전체'};};
    var costNote=function(){var p=picked(),cost=p.key==='committee'?(G.me?.costs?.standard||10):(G.me?.costs?.invite||40);f.querySelector('[data-selected-expert]').textContent=p.name+' · '+cost+'크레딧 / 질문';};
    var bindChoices=function(){dlg.querySelectorAll('input[name=expert]').forEach(function(r){r.onchange=function(){selectedKey=r.value;costNote();dlg.close();};});};
    var showCustom=function(){var host=dlg.querySelector('[data-custom-list]');host.innerHTML=custom.map(function(x){return '<div class="custom-expert-row"><label class="ex"><input type="radio" name="expert" value="custom:'+esc(x.id)+'"><span><b>'+esc(x.name)+'</b><small>'+esc(x.focus)+'</small></span></label><button type="button" data-delete-expert="'+esc(x.id)+'" aria-label="'+esc(x.name)+' 삭제">×</button></div>';}).join('');var selected=dlg.querySelector('input[value="'+selectedKey+'"]');if(selected)selected.checked=true;bindChoices();host.querySelectorAll('[data-delete-expert]').forEach(function(b){b.onclick=function(){b.disabled=true;G.call('DELETE','/experts/'+encodeURIComponent(b.dataset.deleteExpert)).then(function(r){if(r.error){toast(r.message);b.disabled=false;return;}custom=custom.filter(function(x){return x.id!==b.dataset.deleteExpert;});selectedKey='committee';f.querySelector('input[value=committee]').checked=true;showCustom();costNote();});};});};
    if(dlg&&chooser){
     bindChoices();chooser.onclick=function(){dlg.showModal();if(G.me)G.call('GET','/experts').then(function(r){if(!r.error){custom=r.items||[];showCustom();}});};
     dlg.querySelector('[data-close-expert]').onclick=function(){dlg.close();};dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close();});
     var editor=dlg.querySelector('[data-expert-editor]'),error=dlg.querySelector('[data-expert-error]');
     var newExpert=dlg.querySelector('[data-new-expert]'),grid=dlg.querySelector('.ex-grid');dlg.insertBefore(newExpert,grid);newExpert.after(editor);editor.after(dlg.querySelector('[data-custom-list]'));
     dlg.querySelector('[data-new-expert]').onclick=function(){editor.hidden=false;dlg.querySelector('[name=custom-name]').focus();};
     dlg.querySelector('[data-cancel-expert]').onclick=function(){editor.hidden=true;};
     dlg.querySelector('[data-save-expert]').onclick=function(){var b=this;b.disabled=true;error.textContent='';G.call('POST','/experts',{name:dlg.querySelector('[name=custom-name]').value,focus:dlg.querySelector('[name=custom-focus]').value,style:dlg.querySelector('[name=custom-style]').value}).then(function(r){b.disabled=false;if(r.error){error.textContent=r.message;return;}custom.push(r.expert);editor.hidden=true;showCustom();var rdo=dlg.querySelector('input[value="custom:'+r.expert.id+'"]');rdo.checked=true;selectedKey=rdo.value;costNote();dlg.close();toast('내 전문가를 저장했어요.','success');}).catch(function(){b.disabled=false;error.textContent='연결을 확인해 주세요.';});};
    }
    var wrapper=f.closest('.join-wrap'),panel=f.closest('.panel'),debate=panel&&panel.querySelector('.card.debate');
    if(wrapper&&debate){debate.appendChild(f.closest('.db-join'));wrapper.remove();}
    costNote();
    // G-93: my questions and their answers stay in this browser, per stock, and come back on the next visit.
    var SKEY='gnm-debate:'+(f.getAttribute('data-symbol')||location.pathname);
    var saved=function(){try{return JSON.parse(localStorage.getItem(SKEY)||'[]');}catch(e){return [];}};
    var keep=function(x){var all=saved();all.push(x);try{localStorage.setItem(SKEY,JSON.stringify(all.slice(-20)));}catch(e){}};
    var spot=function(){var p=f.closest('.panel')||(f.closest('.join-wrap')||{}).parentNode,d=p&&p.querySelector('.card.debate'),box=d||f.closest('.card')||f.parentNode,a=box.querySelector('.db-ev');if(!a){a=document.createElement('div');a.className='db-ev';box.appendChild(a);}return a;};
    var mineTurn=function(q,who){var d=document.createElement('div');d.className='db-turn db-bear db-guest db-me';d.innerHTML='<div class="db-who"><b>나</b> · '+esc(who)+'에게</div><div class="db-bubble">'+esc(q)+'</div>';return d;};
    var answerTurn=function(x){var d=document.createElement('div');d.className='db-turn db-mid db-guest db-answer';d.innerHTML='<div class="db-who"><b>'+esc(x.speaker)+'</b> · '+(x.key==='committee'?'위원회 답변':'초청 전문가')+'</div><div class="db-bubble md">'+md(x.a)+'</div><div class="db-cost muted small">'+(x.at?esc(x.at)+' · ':'')+x.credits+'크레딧</div>';return d;};
    // Drawn again whenever the debate is rebuilt (a report made on request replaces it).
    var renderPast=function(){
     document.querySelectorAll('[data-past]').forEach(function(n){n.remove();});
     var past=saved();if(!past.length)return;
     var a0=spot(),head=document.createElement('div');head.className='db-past';head.setAttribute('data-past','');head.textContent='내가 한 질문 '+past.length+'개 · 이 기기에 저장돼요';a0.parentNode.insertBefore(head,a0);
     past.forEach(function(x){var m=mineTurn(x.q,x.who),t=answerTurn(x);m.setAttribute('data-past','');t.setAttribute('data-past','');a0.parentNode.insertBefore(m,a0);a0.parentNode.insertBefore(t,a0);});
    };
    renderPast();window.GNM_pastQA=renderPast;

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var pick = f.querySelector('input[name=expert]:checked'), key = pick ? pick.value : 'committee', who = pick ? pick.closest('label').querySelector('b').textContent : 'AI 위원회';
      var qa = f.querySelector('textarea[name=q]'), q = qa ? qa.value.trim().slice(0, 600) : '';
      if (q.length < 2) { toast('무엇이 궁금한지 적어 주세요.'); if (qa) qa.focus(); return; }
      if (!G.me) { location.href = base + 'login.html?return=' + encodeURIComponent(location.pathname.split('/').slice(-2).join('/')); return; }
      var panel=f.closest('.panel')||f.closest('.join-wrap')?.parentNode, debate=panel&&panel.querySelector('.card.debate');
      var box = debate || f.closest('.card') || f.parentNode, anchor = spot();
      var mine = mineTurn(q, who);
      var wait = document.createElement('div'); wait.className = 'db-turn db-mid db-guest db-wait'; wait.innerHTML = '<div class="db-who"><b>' + esc(who) + '</b></div><div class="db-bubble"><div class="chat-progress">${ORBS.replace('data-orb=', 'data-size="64" data-orb=')}<span>질문을 읽고 생각하는 중</span></div><div class="stream-answer"></div></div>';wait.setAttribute('aria-busy','true');wait.setAttribute('aria-live','polite');
      anchor.parentNode.insertBefore(mine, anchor); anchor.parentNode.insertBefore(wait, anchor);
      wait.scrollIntoView({ block: 'center', behavior: 'smooth' });
      var btn = f.querySelector('[type=submit]'); btn.disabled = true;
      var said = [].map.call(box.querySelectorAll('.db-turn:not(.db-typing):not(.db-wait)'), function (t) { var w = t.querySelector('.db-who b'), x = t.querySelector('.db-bubble'); return (w ? w.textContent : '') + ': ' + (x ? x.textContent.replace(/\\s+/g, ' ').trim() : ''); }).join('\\n').slice(-5000);
      G.askStream({ tier: 'standard', expert: key, question: q, symbol: f.getAttribute('data-symbol'), page: '이 종목 AI 위원회 토론:\\n' + said },function(text){wait.querySelector('.stream-answer').textContent=text;wait.querySelector('.chat-progress span:not(.orbs)').textContent='답변 쓰는 중';wait.querySelector('canvas').dataset.orb='composing';}).then(function (r) {
        btn.disabled = false; wait.remove();
        if (r.error) { mine.remove(); toast(r.message); if (r.error === 'NO_CREDITS' || r.error === 'PLAN_REQUIRED') location.href = base + 'pricing.html'; return; }
        var x = { q: q, who: who, key: key, speaker: r.speaker || who, a: r.answer, credits: r.credits, at: new Date().toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) };
        var t = answerTurn(x); t.classList.add('db-in'); t.querySelector('.db-cost').textContent = r.credits + '크레딧 · 남은 ' + r.balance + '개';
        anchor.parentNode.insertBefore(t, anchor); if (qa) qa.value = ''; keep(x); mine.setAttribute('data-past', ''); t.setAttribute('data-past', ''); if (!document.querySelector('.db-past')) renderPast();
        G.track('debate_ask', { expert: key }); G.refresh();
      }).catch(function(){btn.disabled=false;wait.remove();toast('연결이 끊겼어요. 다시 확인해 주세요.');});
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
  G.ready = G.refresh().then(function () { feedback(); nudges(); bell(); paintHomeAlerts(); G.track('page_view', { plan: G.me ? G.me.user.plan : 'signed_out' }); flush(); return syncAll().then(function () { return G.me; }, function () { return G.me; }); });
})();
</script>`;
