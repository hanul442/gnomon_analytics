// 알림 (G-97) shared pieces with no imports (the shell pulls these in, so they must not import it back):
// the service worker, the web app manifest, push on/off, and the 가격 알림 button on stock pages.

/** The service worker at the site root: shows a push and opens its page when tapped. */
export const SW_JS = `// GNOMON service worker: notifications only (no offline cache).
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: '그노몬', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || '그노몬 알림', { body: d.body || '', icon: 'assets/gnomon-icon-192.png', badge: 'assets/gnomon-icon-96.png', tag: d.tag || undefined, renotify: !!d.tag, data: { link: d.link || './' } }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.link) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) if (ws[i].url === url && 'focus' in ws[i]) return ws[i].focus();
    return self.clients.openWindow(url);
  }));
});
`;

export const MANIFEST = JSON.stringify({
  name: 'GNOMON', short_name: '그노몬', start_url: './index.html', scope: './', display: 'standalone',
  background_color: '#ffffff', theme_color: '#18143a', lang: 'ko',
  icons: [{ src: 'assets/gnomon-icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'assets/gnomon-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }],
});

/** Push on/off for this browser, shared by the alerts page and the price alert dialog. */
export const PUSH_JS = `
(function () {
  var G = window.GNM = window.GNM || {}, base = document.body.getAttribute('data-base') || '';
  var key = function (s) { var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).split('-').join('+').split('_').join('/')), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; };
  var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var reg = function () { return navigator.serviceWorker.register(base + 'sw.js').then(function () { return navigator.serviceWorker.ready; }); };
  G.push = {
    supported: supported,
    ios: /iPhone|iPad/.test(navigator.userAgent), standalone: window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true,
    state: function () {
      if (!supported) return Promise.resolve({ on: false, permission: 'unsupported' });
      return navigator.serviceWorker.getRegistration(base).then(function (r) { return r ? r.pushManager.getSubscription() : null; }).then(function (s) { return { on: !!s && Notification.permission === 'granted', permission: Notification.permission }; });
    },
    on: function () {
      if (!supported) return Promise.reject(new Error('이 브라우저는 휴대폰 알림을 지원하지 않아요.'));
      return Notification.requestPermission().then(function (p) {
        if (p !== 'granted') throw new Error(p === 'denied' ? '알림이 차단돼 있어요. 브라우저 사이트 설정에서 알림을 허용해 주세요.' : '알림 허용을 눌러야 켜져요.');
        return Promise.all([reg(), G.call('GET', '/push/key')]);
      }).then(function (x) {
        if (!x[1] || !x[1].publicKey) throw new Error('알림 서버에 연결하지 못했어요.');
        return x[0].pushManager.getSubscription().then(function (old) { return old || x[0].pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(x[1].publicKey) }); });
      }).then(function (sub) { return G.call('POST', '/push/subscribe', sub.toJSON()); }).then(function (r) { if (r && r.error) throw new Error(r.message); return true; });
    },
    off: function () {
      return navigator.serviceWorker.getRegistration(base).then(function (r) { return r ? r.pushManager.getSubscription() : null; }).then(function (s) {
        if (!s) return true; var ep = s.endpoint; return s.unsubscribe().then(function () { return G.call('POST', '/push/unsubscribe', { endpoint: ep }); });
      });
    },
  };
})();`;

/** 🔔 가격 알림 next to the ☆ on stock, ETF and coin pages: quick picks from the scenario ranges, or any price. */
export const PRICE_ALERT_JS = `
(function () {
  var star = document.querySelector('.hero .star, #sp-star'); if (!star) return;
  var G = window.GNM || {}, base = document.body.getAttribute('data-base') || '';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // G-152: a US stock's alert is in dollars.
  var US = !!new URLSearchParams(location.search).get('s') && /us\\.html$/.test(location.pathname);
  var won = function (v) { return US ? '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v >= 100 ? Math.round(v).toLocaleString('ko-KR') + '원' : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 }) + '원'; };
  var b = document.createElement('button'); b.type = 'button'; b.className = 'pa-btn'; b.innerHTML = '🔔'; b.title = '가격 알림 걸기'; b.setAttribute('aria-label', '가격 알림 걸기');
  star.after(b);
  var symbol = function () { return star.getAttribute('data-star') || new URLSearchParams(location.search).get('c') || new URLSearchParams(location.search).get('m') || new URLSearchParams(location.search).get('s') || ''; };
  var name = function () { var h = document.querySelector('.hero h1, #sp-name'); return h ? h.textContent.trim() : symbol(); };
  var price = function () {
    var live = document.querySelector('[data-live-f="price"]'), t = live && live.textContent.replace(/[^0-9.]/g, '');
    if (t && Number(t) > 0) return Number(t);
    try { var bars = JSON.parse(document.getElementById('bars').textContent); return bars[bars.length - 1].close; } catch (e) { return 0; }
  };
  // G-159: Toss-style — the price now, one target price with − / + in real tick steps, the gap in %, and the
  // direction picked from it (above now → 이상, below → 이하). Quick chips, and this stock's open alerts below.
  var COIN = /^KRW-/.test(symbol());
  var tick = function (v) {
    if (US) return 0.01;
    if (COIN) return v >= 1e6 ? 1000 : v >= 1e5 ? 50 : v >= 1e4 ? 10 : v >= 1000 ? 1 : v >= 100 ? 0.1 : v >= 10 ? 0.01 : 0.0001;
    return v < 2000 ? 1 : v < 5000 ? 5 : v < 20000 ? 10 : v < 50000 ? 50 : v < 200000 ? 100 : v < 500000 ? 500 : 1000;
  };
  var snap = function (v) { var t = tick(v), d = String(t).split('.')[1]; return Number((Math.round(v / t) * t).toFixed(d ? d.length : 0)); };
  b.addEventListener('click', function () {
    if (!G.me) { location.href = base + 'login.html?return=' + encodeURIComponent(location.pathname.split('/').slice(-2).join('/') + location.search); return; }
    var now = price(), scen = []; try { scen = JSON.parse(document.getElementById('scen').textContent) || []; } catch (e) {}
    var chips = [];
    if (now) [-10, -5, 5, 10].forEach(function (p) { chips.push([(p > 0 ? '+' : '') + p + '%', snap(now * (1 + p / 100)), '지금보다 ' + Math.abs(p) + '% ' + (p > 0 ? '오르면' : '내리면')]); });
    // A scenario chip only when the price is outside that range and moving into it means crossing its near edge:
    // below the bull range → its lower edge (이상); above the bear range → its upper edge (이하). Inside or past it, no chip.
    scen.forEach(function (x) {
      if (!x.zone || !now) return; var lo = Math.min(x.zone[0], x.zone[1]), hi = Math.max(x.zone[0], x.zone[1]), rng = won(lo) + '~' + won(hi);
      if (x.kind === 'BULL' && now < lo) chips.push(['강세 가격대', snap(lo), '강세 가격대(' + rng + ')에 들어오면']);
      if (x.kind === 'BEAR' && now > hi) chips.push(['약세 가격대', snap(hi), '약세 가격대(' + rng + ')에 들어오면']);
    });
    var d = document.createElement('dialog'); d.className = 'v2-dialog pa-dialog';
    d.innerHTML = '<header><b>' + esc(name()) + ' 가격 알림</b><button type="button" class="dialog-x" aria-label="닫기">×</button></header>' +
      '<div class="pa-now"><span>현재가</span><b>' + (now ? won(now) : '확인 중') + '</b></div>' +
      '<label class="pa-label" for="pa-price">이 가격이 되면 알려 주세요</label>' +
      '<div class="pa-target"><button type="button" data-step="-1" aria-label="한 호가 내리기">−</button><input id="pa-price" name="price" inputmode="decimal" autocomplete="off"><span class="pa-unit">' + (US ? '달러' : '원') + '</span><button type="button" data-step="1" aria-label="한 호가 올리기">+</button></div>' +
      '<p class="pa-hint" aria-live="polite"></p>' +
      '<div class="pa-chips" role="group" aria-label="빠른 선택">' + chips.map(function (c, i) { return '<button type="button" data-chip="' + i + '">' + esc(c[0]) + '</button>'; }).join('') + '</div>' +
      '<button type="button" class="pa-save">알림 받기</button><p class="pa-msg muted small" role="status"></p>' +
      '<div class="pa-mine" hidden><b>이 종목에 건 알림</b><div class="pa-list"></div></div>' +
      '<a class="pa-all" href="' + base + 'alerts.html">내 알림 모두 보기 · 휴대폰 알림 켜기 ›</a>';
    document.body.appendChild(d); d.showModal();
    var inp = d.querySelector('#pa-price'), hint = d.querySelector('.pa-hint'), msg = d.querySelector('.pa-msg'), saveB = d.querySelector('.pa-save'), note = '';
    var val = function () { return Number(String(inp.value).replace(/[^0-9.]/g, '')); };
    var fmtIn = function (v) { return US || v < 100 ? String(v) : Math.round(v).toLocaleString('ko-KR'); };
    var op = function () { var v = val(); return !now || !(v > 0) || v === now ? '' : v > now ? '>=' : '<='; };
    var paint = function () {
      var v = val(), o = op();
      if (!(v > 0)) { hint.textContent = '받고 싶은 가격을 적어 주세요.'; saveB.disabled = true; return; }
      if (!now) { hint.textContent = '현재가를 불러오지 못했어요. 이 가격 이상이 되면 알려 드려요.'; saveB.disabled = false; return; }
      if (!o) { hint.textContent = '현재가와 같아요. 조금 올리거나 내려 주세요.'; saveB.disabled = true; return; }
      var g = (v / now - 1) * 100;
      hint.innerHTML = '현재가보다 <b class="' + (g > 0 ? 'up' : 'down') + '">' + (g > 0 ? '+' : '') + g.toFixed(1) + '%</b> ' + (g > 0 ? '높아요' : '낮아요') + ' · 이 가격 <b>' + (o === '>=' ? '이상</b>이' : '이하</b>가') + ' 되면 알려 드려요';
      saveB.disabled = false; saveB.textContent = won(v) + ' ' + (o === '>=' ? '이상' : '이하') + '에서 알림 받기';
      if (note) hint.innerHTML += '<br><small>' + esc(note) + '</small>';
    };
    var setV = function (v, n) { inp.value = fmtIn(v); note = n || ''; d.querySelectorAll('[data-chip]').forEach(function (c) { c.setAttribute('aria-pressed', String(chips[Number(c.getAttribute('data-chip'))][1] === v)); }); paint(); };
    setV(now ? snap(now * 1.05) : 0, now ? '지금보다 5% 오르면' : '');
    inp.addEventListener('input', function () { note = ''; d.querySelectorAll('[data-chip]').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); }); paint(); });
    d.querySelectorAll('[data-step]').forEach(function (x) { x.addEventListener('click', function () { var v = val() || now || 0, t = tick(v), dir = Number(x.getAttribute('data-step')); setV(Math.max(t, snap(v + dir * t)), ''); }); });
    d.querySelectorAll('[data-chip]').forEach(function (x) { x.addEventListener('click', function () { var c = chips[Number(x.getAttribute('data-chip'))]; setV(c[1], c[2]); }); });
    var mine = function () {
      G.call('GET', '/alerts/price').then(function (r) {
        var items = (r.items || []).filter(function (a) { return a.symbol === symbol().toUpperCase() && !a.fired_at; }), box = d.querySelector('.pa-mine');
        box.hidden = !items.length;
        box.querySelector('.pa-list').innerHTML = items.map(function (a) { return '<div class="pa-item"><span><b>' + won(a.price) + '</b> ' + (a.op === '>=' ? '이상' : '이하') + (a.note ? '<small>' + esc(a.note) + '</small>' : '') + '</span><button type="button" data-del="' + a.id + '" aria-label="' + esc(won(a.price)) + ' 알림 지우기">지우기</button></div>'; }).join('');
        box.querySelectorAll('[data-del]').forEach(function (x) { x.onclick = function () { if (!confirm('이 가격 알림을 지울까요?')) return; G.call('POST', '/alerts/price/' + x.getAttribute('data-del') + '/delete').then(function () { msg.textContent = '지웠어요.'; mine(); }); }; });
      });
    };
    saveB.addEventListener('click', function () {
      var v = val(), o = op() || '>='; if (!(v > 0)) return;
      msg.textContent = '거는 중…'; saveB.disabled = true;
      G.call('POST', '/alerts/price', { symbol: symbol(), name: name(), op: o, price: Math.round(v * 10000) / 10000, note: note }).then(function (r) {
        saveB.disabled = false;
        if (r.error) { msg.textContent = r.message; return; }
        msg.textContent = won(v) + ' ' + (o === '>=' ? '이상이' : '이하가') + ' 되면 🔔으로 알려 드려요.'; mine();
        if (G.push) G.push.state().then(function (s) { if (!s.on) msg.innerHTML = esc(msg.textContent) + ' <a href="' + base + 'alerts.html">휴대폰 알림도 켜기 ›</a>'; });
      });
    });
    mine();
    d.querySelector('.dialog-x').onclick = function () { d.close(); };
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });
})();`;

export const ALERTS_CSS = `.pa-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:0;background:none;border-radius:50%;padding:0;font:inherit;font-size:17px;cursor:pointer;margin-left:2px;vertical-align:middle;opacity:.55;filter:grayscale(1)}.pa-btn:hover,.pa-btn:focus-visible{opacity:1;filter:none;background:#eef1f6}
.pa-now{display:flex;justify-content:space-between;align-items:baseline;margin:6px 0 14px;font-size:14px;color:var(--fg2)}.pa-now b{font-size:20px;color:var(--fg);font-variant-numeric:tabular-nums}
.pa-label{display:block;font-size:13px;font-weight:700;color:var(--fg2);margin-bottom:6px}
.pa-target{display:flex;align-items:center;background:#f2f4f6;border-radius:14px;padding:4px}.pa-target button{flex:none;width:48px;height:48px;border:0;border-radius:12px;background:#fff;font:inherit;font-size:24px;color:#4e5968;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.06)}.pa-target button:hover{background:var(--accent-soft);color:var(--accent-strong)}
.pa-target input{flex:1;min-width:0;border:0;background:none;text-align:right;font:inherit;font-size:22px;font-weight:800;color:var(--fg);padding:0 4px;font-variant-numeric:tabular-nums}.pa-target input:focus{outline:none}.pa-unit{font-size:16px;font-weight:700;color:var(--fg2);margin-right:10px}
.pa-hint{margin:8px 2px 10px;font-size:13.5px;color:var(--fg2);min-height:20px}
.pa-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}.pa-chips button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:0 14px;min-height:36px;font:inherit;font-size:13.5px;font-weight:700;color:var(--fg2);cursor:pointer}.pa-chips button[aria-pressed=true]{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-strong)}
.pa-save{display:block;width:100%;min-height:52px;border:0;border-radius:14px;background:var(--accent);color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer}.pa-save:disabled{background:#c9d4e3;cursor:not-allowed}
.pa-mine{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}.pa-mine>b{font-size:13px;color:var(--fg2)}.pa-item{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #f2f4f6}.pa-item small{display:block;font-size:12px;color:var(--muted)}.pa-item button{border:1px solid var(--line);background:#fff;border-radius:10px;min-height:36px;padding:0 12px;font:inherit;font-size:13px;font-weight:700;color:var(--fg2);cursor:pointer}
.pa-msg{margin:8px 0 0}.pa-dialog .pa-target button{font-size:26px;font-weight:600;line-height:1}.pa-dialog .pa-save{font-size:16px;font-weight:800}.pa-all{display:block;margin-top:8px;font-size:13px;font-weight:700}`;

