// 알림 (G-97) shared pieces with no imports (the shell pulls these in, so they must not import it back):
// the service worker, the web app manifest, push on/off, and the 가격 알림 button on stock pages.

/** The service worker at the site root: shows a push and opens its page when tapped. */
export const SW_JS = `// Gnomon Analytics service worker: notifications only (no offline cache).
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
  name: 'Gnomon Analytics', short_name: '그노몬', start_url: './index.html', scope: './', display: 'standalone',
  background_color: '#ffffff', theme_color: '#13294b', lang: 'ko',
  icons: [{ src: 'assets/gnomon-icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'assets/gnomon-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
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
  var won = function (v) { return v >= 100 ? Math.round(v).toLocaleString('ko-KR') + '원' : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 }) + '원'; };
  var b = document.createElement('button'); b.type = 'button'; b.className = 'pa-btn'; b.innerHTML = '🔔'; b.title = '가격 알림 걸기'; b.setAttribute('aria-label', '가격 알림 걸기');
  star.after(b);
  var symbol = function () { return star.getAttribute('data-star') || new URLSearchParams(location.search).get('c') || new URLSearchParams(location.search).get('m') || ''; };
  var name = function () { var h = document.querySelector('.hero h1, #sp-name'); return h ? h.textContent.trim() : symbol(); };
  var price = function () {
    var live = document.querySelector('[data-live-f="price"]'), t = live && live.textContent.replace(/[^0-9.]/g, '');
    if (t && Number(t) > 0) return Number(t);
    try { var bars = JSON.parse(document.getElementById('bars').textContent); return bars[bars.length - 1].close; } catch (e) { return 0; }
  };
  b.addEventListener('click', function () {
    if (!G.me) { location.href = base + 'login.html?return=' + encodeURIComponent(location.pathname.split('/').slice(-2).join('/') + location.search); return; }
    var now = price(), scen = []; try { scen = JSON.parse(document.getElementById('scen').textContent) || []; } catch (e) {}
    var picks = [];
    scen.forEach(function (x) { if (x.kind === 'BULL') picks.push(['>=', x.zone[0], '강세 가격대에 들어오면']); if (x.kind === 'BEAR') picks.push(['<=', x.zone[1], '약세 가격대에 들어오면']); });
    if (now) { picks.push(['>=', now * 1.05, '지금보다 5% 오르면']); picks.push(['<=', now * 0.95, '지금보다 5% 내리면']); }
    var d = document.createElement('dialog'); d.className = 'v2-dialog pa-dialog';
    d.innerHTML = '<header><b>' + esc(name()) + ' 가격 알림</b><button type="button" class="dialog-x" aria-label="닫기">×</button></header>' +
      '<p class="muted small">지금 ' + (now ? won(now) : '가격 확인 중') + ' · 닿으면 🔔과 휴대폰으로 한 번 알려 드려요.</p>' +
      '<div class="pa-picks">' + picks.map(function (p, i) { return '<button type="button" data-pick="' + i + '"><b>' + esc(p[2]) + '</b><span>' + won(p[1]) + ' ' + (p[0] === '>=' ? '이상' : '이하') + '</span></button>'; }).join('') + '</div>' +
      '<form class="pa-own"><label>직접 정하기<input name="price" inputmode="decimal" placeholder="가격(원)" value="' + (now ? Math.round(now) : '') + '"></label><select name="op"><option value=">=">이상이 되면</option><option value="<=">이하가 되면</option></select><button type="submit">알림 걸기</button></form>' +
      '<p class="pa-msg muted small" role="status"></p><a class="pa-all" href="' + base + 'alerts.html">내 알림 모두 보기 · 휴대폰 알림 켜기 ›</a>';
    document.body.appendChild(d); d.showModal();
    var msg = d.querySelector('.pa-msg');
    var save = function (op, p, note) {
      msg.textContent = '거는 중…';
      G.call('POST', '/alerts/price', { symbol: symbol(), name: name(), op: op, price: Math.round(p * 10000) / 10000, note: note || '' }).then(function (r) {
        if (r.error) { msg.textContent = r.message; return; }
        msg.textContent = won(p) + ' ' + (op === '>=' ? '이상' : '이하') + '이 되면 알려 드려요.';
        if (G.push) G.push.state().then(function (s) { if (!s.on) msg.innerHTML = esc(msg.textContent) + ' <a href="' + base + 'alerts.html">휴대폰 알림도 켜기 ›</a>'; });
      });
    };
    d.querySelectorAll('[data-pick]').forEach(function (x) { x.addEventListener('click', function () { var p = picks[Number(x.getAttribute('data-pick'))]; save(p[0], p[1], p[2]); }); });
    d.querySelector('.pa-own').addEventListener('submit', function (e) { e.preventDefault(); var v = Number(String(this.price.value).replace(/[^0-9.]/g, '')); if (!(v > 0)) { msg.textContent = '가격을 적어 주세요.'; return; } save(this.op.value, v, ''); });
    d.querySelector('.dialog-x').onclick = function () { d.close(); };
    d.addEventListener('close', function () { d.remove(); });
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });
})();`;

export const ALERTS_CSS = `.pa-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border:0;background:none;border-radius:50%;padding:0;font:inherit;font-size:17px;cursor:pointer;margin-left:2px;vertical-align:middle;opacity:.55;filter:grayscale(1)}.pa-btn:hover,.pa-btn:focus-visible{opacity:1;filter:none;background:#eef1f6}
.pa-picks{display:grid;gap:6px;margin:10px 0}.pa-picks button{display:flex;justify-content:space-between;gap:8px;align-items:center;border:1px solid var(--line);background:#fff;border-radius:12px;padding:11px 12px;font:inherit;cursor:pointer;text-align:left}.pa-picks button:hover{border-color:var(--accent)}.pa-picks span{font-size:13px;color:var(--fg2);white-space:nowrap}
.pa-own{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:end}.pa-own label{grid-column:1/-1;display:grid;gap:4px;font-size:13px;font-weight:700}.pa-own input,.pa-own select{font:inherit;padding:9px 10px;border:1px solid var(--line-strong);border-radius:10px}.pa-own button{font:inherit;font-weight:800;border:0;border-radius:10px;padding:10px 14px;background:var(--navy);color:#fff;cursor:pointer}.pa-all{display:block;margin-top:8px;font-size:13px;font-weight:700}`;

