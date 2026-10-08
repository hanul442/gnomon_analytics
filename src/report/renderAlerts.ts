// 알림 (G-97): the phone push switch, what to hear about, screener alerts and price alerts in one page,
// plus the service worker, the web app manifest, and the 가격 알림 button on every stock page.

import { shell } from './renderHtml.js';
export { SW_JS, MANIFEST } from './pushParts.js';

export function renderAlerts(): string {
  const PREFS: [string, string, string][] = [
    ['daily', '매일 리포트', '장 마감 뒤 그날 리포트가 나오면 알려요. 관심 종목 리포트가 있으면 그 종목을 먼저 알려요.'],
    ['watchReport', '관심 종목 새 리포트', '☆ 해 둔 종목의 리포트가 새로 나오면'],
    ['screen', '스크리너 조건', '저장한 조건에 새로 걸린 종목이 생기면 (조건별 켜기는 아래에서)'],
    ['price', '가격 알림 · 장중 급변', '내가 건 가격에 닿거나, 관심 종목이 장중 크게 움직이면'],
    ['request', '요청한 리포트', '즉시 생성하거나 요청한 리포트가 완성되면(실패하면 그 이유도)'],
    ['update', '업데이트 소식', '새 기능이나 바뀐 점이 배포되면 한 번 알려요'],
  ];
  const body = `<style>
.al{max-width:760px;margin:16px auto 32px}.al .card{padding:18px;margin-bottom:12px}.al h1{font-size:23px;margin:2px 0 6px}.al h2{font-size:17px;margin:0 0 8px}.al p{line-height:1.6}
.al-push{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.al-state{font-weight:800}.al-state.on{color:#0f766e}.al-btns{display:flex;gap:6px;flex-wrap:wrap}.al-btns button{font:inherit;font-weight:800;border-radius:12px;padding:10px 14px;cursor:pointer;border:1.5px solid var(--navy);background:var(--navy);color:#fff}.al-btns .ghost{background:#fff;color:var(--navy)}.al-btns button[hidden]{display:none}
.al-help{font-size:12.5px;color:var(--muted);margin:10px 0 0;line-height:1.6}.al-help b{color:var(--fg2)}
.al-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}.al-row:first-of-type{border-top:0}.al-row b{display:block;font-size:15px}.al-row small{color:var(--muted);font-size:12.5px;line-height:1.5}
.sw{position:relative;width:46px;height:28px;flex:none}.sw input{opacity:0;width:0;height:0;position:absolute}.sw i{position:absolute;inset:0;border-radius:999px;background:#cbd3df;transition:.15s}.sw i::after{content:'';position:absolute;left:3px;top:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:.15s;box-shadow:0 1px 3px rgba(0,0,0,.2)}.sw input:checked+i{background:var(--navy)}.sw input:checked+i::after{transform:translateX(18px)}.sw input:focus-visible+i{outline:2px solid var(--accent);outline-offset:2px}
.al-list .al-item{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}.al-list .al-item:first-child{border-top:0}.al-item a{font-weight:700}.al-item small{display:block;color:var(--muted);font-size:12px}.al-item button{font:inherit;font-size:12.5px;border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:5px 10px;cursor:pointer}.al-done{opacity:.6}
.al-add{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.al-add input,.al-add select{font:inherit;padding:10px;border:1px solid var(--line-strong);border-radius:10px;min-width:0}.al-add .wide{grid-column:1/-1}.al-add button{grid-column:1/-1;font:inherit;font-weight:800;border:0;border-radius:12px;padding:11px;background:var(--navy);color:#fff;cursor:pointer}.al-sugg{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px}.al-sugg button{grid-column:auto;background:#eef3fb;color:var(--fg);font-weight:700;font-size:13px;padding:6px 10px;border-radius:999px}
.al-plan{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:13.5px}.al-plan b{font-size:15px}.al-plan span{color:var(--fg2)}.al-plan a{font-weight:800;margin-left:auto}.al-lock{opacity:.55}.al-lock small::after{content:' · 플러스부터';font-weight:700;color:var(--accent-strong)}
.al-quiet{display:flex;gap:12px;flex-wrap:wrap;padding-top:4px}.al-quiet label{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--fg2)}.al-quiet input{font:inherit;padding:8px 10px;border:1px solid var(--line-strong);border-radius:10px}
.al-msg{font-size:13px;color:var(--muted);min-height:1.4em;margin:6px 0 0}.al-login{text-align:center}
</style><div class="al">
<section class="card"><div class="pl-k">알림</div><h1>알림 설정</h1><p class="muted">새 리포트, 스크리너 조건, 내가 건 가격, 요청한 리포트를 🔔과 휴대폰으로 알려 드려요.</p></section>
<section class="card al-login" id="al-login" hidden><p>알림은 로그인한 계정으로 받아요.</p><a class="btn" href="login.html?return=alerts.html">로그인</a></section>
<div id="al-body" hidden>
<section class="card"><div class="al-push"><div><h2>휴대폰 알림</h2><span class="al-state" id="al-state">확인 중…</span></div><div class="al-btns"><button type="button" id="al-on">이 기기에서 켜기</button><button type="button" class="ghost" id="al-test" hidden>테스트 알림</button><button type="button" class="ghost" id="al-off" hidden>끄기</button></div></div>
<p class="al-msg" id="al-push-msg" role="status"></p>
<p class="al-help" id="al-help"><b>안드로이드</b> 크롬·삼성 인터넷은 바로 켜져요. <b>Brave</b>는 설정 → 개인정보 보호 → 'Google 서비스를 푸시 메시지에 사용'을 켜야 와요.<br><b>아이폰</b>은 Safari에서 공유 → '홈 화면에 추가'를 한 뒤, 홈 화면의 그노몬 아이콘으로 열어서 켜 주세요(iOS 16.4 이상).</p></section>
<section class="card al-plan" id="al-plan" hidden></section>
<section class="card"><h2>받을 알림</h2>${PREFS.map(([k, t, d]) => `<label class="al-row"><span><b>${t}</b><small>${d}</small></span><span class="sw"><input type="checkbox" data-pref="${k}" checked><i></i></span></label>`).join('')}<p class="al-msg" id="al-pref-msg" role="status"></p></section>
<section class="card"><label class="al-row"><span><b>조용한 시간</b><small>이 시간에는 휴대폰으로 울리지 않고 🔔 알림함에만 쌓아요. 미국 장 시간처럼 밤에 오는 알림을 미뤄 둘 때 써요.</small></span><span class="sw"><input type="checkbox" data-pref="quiet"><i></i></span></label><div class="al-quiet"><label>시작 <input type="time" data-qt="quietFrom" value="23:00"></label><label>끝 <input type="time" data-qt="quietTo" value="07:00"></label></div></section>
<section class="card"><h2>스크리너 조건 알림</h2><div class="al-list" id="al-screens"><p class="muted small">불러오는 중…</p></div><p class="al-help">조건은 <a href="screener.html">필터로 종목 찾기</a>에서 저장해요. 매일 장 마감 뒤 새로 걸린 종목을 알려요.</p></section>
<section class="card"><h2>가격 알림</h2><div class="al-list" id="al-prices"><p class="muted small">불러오는 중…</p></div>
<form class="al-add" id="al-add"><input class="wide" name="q" placeholder="종목·ETF·코인 이름이나 코드" autocomplete="off" aria-label="종목"><div class="al-sugg" id="al-sugg"></div><input name="price" inputmode="decimal" placeholder="가격(원, 미국은 달러)" aria-label="가격"><select name="op" aria-label="조건"><option value=">=">이상이 되면</option><option value="<=">이하가 되면</option></select><button type="submit">가격 알림 걸기</button></form>
<p class="al-msg" id="al-add-msg" role="status"></p><p class="al-help">종목 화면의 🔔 가격 알림 버튼으로도 걸 수 있어요. 강세·약세 시나리오 가격대에 들어오면 알려 주는 빠른 선택이 있어요. 주식·ETF는 장중, 미국 주식은 프리·정규·애프터마켓, 코인은 언제든 10분마다 확인해요.</p></section>
</div></div><script>
document.addEventListener('DOMContentLoaded', function () {
  var G = window.GNM || {}, $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var US = function (s) { return /^[A-Z]/.test(s) && s.indexOf('KRW-') !== 0; };
  var price = function (v, s) { return US(s) ? '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : won(v); };
  var won = function (v) { return v >= 100 ? Math.round(v).toLocaleString('ko-KR') + '원' : Number(v).toLocaleString('ko-KR', { maximumFractionDigits: 4 }) + '원'; };
  var href = function (s) { return s.indexOf('KRW-') === 0 ? 'coin.html?m=' + s : US(s) ? 'us.html?s=' + encodeURIComponent(s) : 'stock.html?c=' + s; };
  var paintPush = function () {
    if (!G.push || G.pushLocked) return;
    if (!G.push.supported) { $('al-state').textContent = G.push.ios && !G.push.standalone ? '아이폰은 홈 화면에 추가한 뒤 켤 수 있어요' : '이 브라우저는 휴대폰 알림을 지원하지 않아요'; $('al-on').hidden = true; return; }
    G.push.state().then(function (s) { $('al-state').textContent = s.on ? '이 기기로 받고 있어요' : s.permission === 'denied' ? '알림이 차단돼 있어요 (브라우저 사이트 설정에서 허용)' : '꺼져 있어요'; $('al-state').className = 'al-state' + (s.on ? ' on' : ''); $('al-on').hidden = s.on; $('al-off').hidden = !s.on; $('al-test').hidden = !s.on; });
  };
  var loadPrices = function () {
    G.call('GET', '/alerts/price').then(function (r) {
      if (r.error) return; var items = r.items || [];
      $('al-prices').innerHTML = items.length ? items.map(function (a) { return '<div class="al-item' + (a.fired_at ? ' al-done' : '') + '"><div><a href="' + href(a.symbol) + '">' + esc(a.name || a.symbol) + '</a> ' + price(a.price, a.symbol) + ' ' + (a.op === '>=' ? '이상' : '이하') + '<small>' + (a.fired_at ? '도달 · ' + price(a.fired_price, a.symbol) + ' · ' + new Date(a.fired_at).toLocaleString('ko-KR') : (a.note ? esc(a.note) + ' · ' : '') + '기다리는 중') + '</small></div><button type="button" data-del="' + a.id + '">지우기</button></div>'; }).join('') : '<p class="muted small">걸어 둔 가격 알림이 없어요.</p>';
      $('al-prices').querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { G.call('POST', '/alerts/price/' + b.getAttribute('data-del') + '/delete').then(loadPrices); }; });
    });
  };
  var start = function (me) {
    if (!me) { $('al-login').hidden = false; return; }
    $('al-body').hidden = false; paintPush(); loadPrices();
    G.call('GET', '/notify/prefs').then(function (r) {
      if (r.error) return;
      var L = r.limits || {}, planName = { free: '무료', plus: '플러스', pro: '프로', max: '맥스', alpha: '알파' }[r.plan] || r.plan;
      $('al-plan').hidden = false;
      $('al-plan').innerHTML = '<b>' + esc(planName) + ' 요금제 알림</b><span>휴대폰 ' + (L.push ? '✓' : '—') + '</span><span>가격 알림 ' + L.priceAlerts + '개</span><span>스크리너 ' + (L.screenAlerts || '—') + (L.screenAlerts ? '개' : '') + '</span><span>장중 급변 ' + (L.intraday ? '✓' : '—') + '</span>' + (r.plan === 'free' || r.plan === 'plus' ? '<a href="pricing.html">요금제별 알림 비교 ›</a>' : '');
      if (!L.push) { G.pushLocked = true; $('al-on').hidden = true; $('al-state').textContent = '휴대폰 알림은 플러스부터예요. 지금은 🔔 알림함으로 받아요.'; }
      if (!L.watchReport) { var w = document.querySelector('[data-pref=watchReport]'); w.disabled = true; w.checked = false; w.closest('.al-row').classList.add('al-lock'); }
      if (!L.intraday) { var pr = document.querySelector('[data-pref=price]'); pr.closest('.al-row').querySelector('small').textContent = '내가 건 가격에 닿으면 (장중 급변 알림은 프로부터)'; }
      document.querySelectorAll('[data-qt]').forEach(function (t) { var k = t.getAttribute('data-qt'); if (r.prefs[k]) t.value = r.prefs[k]; t.onchange = function () { if (!/^\\d\\d:\\d\\d$/.test(t.value)) return; var p = {}; p[k] = t.value; G.call('POST', '/notify/prefs', { prefs: p }).then(function (x) { $('al-pref-msg').textContent = x.error ? x.message : '조용한 시간을 저장했어요.'; }); }; });
      document.querySelectorAll('[data-pref]').forEach(function (i) { i.checked = i.getAttribute('data-pref') === 'quiet' ? r.prefs.quiet === true : r.prefs[i.getAttribute('data-pref')] !== false; i.onchange = function () { var p = {}; p[i.getAttribute('data-pref')] = i.checked; G.call('POST', '/notify/prefs', { prefs: p }).then(function (x) { $('al-pref-msg').textContent = x.error ? x.message : '저장했어요.'; }); }; });
      var sc = r.screens || [];
      $('al-screens').innerHTML = sc.length ? sc.map(function (s) { return '<label class="al-row"><span><b>' + esc(s.name) + '</b></span><span class="sw"><input type="checkbox" data-screen="' + s.id + '"' + (s.alert ? ' checked' : '') + '><i></i></span></label>'; }).join('') : '<p class="muted small">저장한 조건이 없어요.</p>';
      $('al-screens').querySelectorAll('[data-screen]').forEach(function (i) { i.onchange = function () { G.call('POST', '/screens/' + i.getAttribute('data-screen'), { alert: i.checked }).then(function (x) { if (x.error) { i.checked = !i.checked; $('al-pref-msg').textContent = x.message; } }); }; });
    });
  };
  $('al-on').onclick = function () { $('al-push-msg').textContent = '켜는 중…'; G.push.on().then(function () { $('al-push-msg').textContent = '켜졌어요. 테스트 알림으로 확인해 보세요.'; paintPush(); }).catch(function (e) { $('al-push-msg').textContent = e.message || '켜지 못했어요.'; paintPush(); }); };
  $('al-off').onclick = function () { G.push.off().then(function () { $('al-push-msg').textContent = '이 기기의 알림을 껐어요.'; paintPush(); }); };
  $('al-test').onclick = function () { $('al-push-msg').textContent = '보내는 중…'; G.call('POST', '/push/test').then(function (r) { $('al-push-msg').textContent = r.error ? r.message : '보냈어요. 몇 초 안에 와요.'; }); };
  // Pick the stock from the site's search list.
  var list = null, chosen = null, f = $('al-add');
  f.q.addEventListener('input', function () {
    chosen = null; var q = f.q.value.trim().toLowerCase(); if (q.length < 1) { $('al-sugg').innerHTML = ''; return; }
    (list ? Promise.resolve(list) : Promise.all([fetch('search.json').then(function (r) { return r.json(); }), fetch('usstocks.json').then(function (r) { return r.ok ? r.json() : { rows: [] }; }).catch(function () { return { rows: [] }; })]).then(function (j) { list = (j[0].items || []).concat((j[1].rows || []).map(function (u) { return [u[0], u[1] + ' ' + String(u[2]).split(' · ')[0]]; })); return list; })).then(function (items) {
      var hit = items.filter(function (it) { return String(it[0]).toLowerCase().indexOf(q) === 0 || String(it[1]).toLowerCase().indexOf(q) >= 0; }).slice(0, 6);
      $('al-sugg').innerHTML = hit.map(function (it, i) { return '<button type="button" data-i="' + i + '">' + esc(it[1]) + ' <small>' + esc(it[0]) + '</small></button>'; }).join('');
      $('al-sugg').querySelectorAll('[data-i]').forEach(function (b) { b.onclick = function () { var it = hit[Number(b.getAttribute('data-i'))]; chosen = { symbol: String(it[0]), name: String(it[1]) }; f.q.value = it[1] + ' (' + it[0] + ')'; $('al-sugg').innerHTML = ''; f.price.focus(); }; });
    });
  });
  f.addEventListener('submit', function (e) {
    e.preventDefault(); var v = Number(String(f.price.value).replace(/[^0-9.]/g, ''));
    if (!chosen) { $('al-add-msg').textContent = '목록에서 종목을 골라 주세요.'; return; }
    if (!(v > 0)) { $('al-add-msg').textContent = '가격을 적어 주세요.'; return; }
    G.call('POST', '/alerts/price', { symbol: chosen.symbol, name: chosen.name, op: f.op.value, price: v }).then(function (r) { $('al-add-msg').textContent = r.error ? r.message : '걸었어요.'; if (!r.error) { f.reset(); chosen = null; loadPrices(); } });
  });
  if (G.ready) G.ready.then(start); else start(null);
});
</script>`;
  return shell('', '알림 설정 | GNOMON', body, { noFeedback: true });
}

/**
 * 알림함 (G-135): the 🔔 opens this page instead of a popup over the screen. Newest first, grouped by day,
 * one tap opens the note's page; × or 모두 지우기 clears; reading the page marks everything read.
 */
export function renderInbox(): string {
  const body = `<style>.ib{max-width:760px;margin:0 auto}.ib-head{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;flex-wrap:wrap}.ib-head h1{margin:0}.ib-tools{display:flex;gap:8px;flex-wrap:wrap}
.ib-day{font-size:12.5px;font-weight:800;color:var(--muted);margin:18px 4px 6px}.ib-item{display:grid;grid-template-columns:28px minmax(0,1fr) 36px;gap:8px;align-items:start;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;margin-bottom:8px}
.ib-item a{text-decoration:none;color:inherit;min-width:0}.ib-item b{display:block;font-size:15px}.ib-item small{display:block;color:var(--fg2);font-size:13px;margin-top:2px;line-height:1.5}.ib-item time{display:block;font-size:11.5px;color:var(--muted);margin-top:4px}
.ib-ic{font-size:18px;line-height:1.4;text-align:center}.ib-item.new{border-color:#b9cbea;background:#f6f9ff}.ib-x{border:0;background:none;font-size:20px;color:var(--muted);cursor:pointer;border-radius:8px}.ib-empty{text-align:center;padding:40px 16px;color:var(--fg2)}</style>
<div class="ib"><section class="hero"><div class="hero-main ib-head"><div><div class="eyebrow"><span>알림</span></div><h1>알림함</h1></div><div class="ib-tools"><button type="button" class="chip-toggle" id="ib-clear" hidden>모두 지우기</button><a class="chip-toggle" href="alerts.html">⚙︎ 알림 설정</a></div></div></section>
<section class="block" id="ib-list"><p class="muted">불러오는 중이에요.</p></section></div>
<script>
(function () {
  var G = window.GNM || {}, box = document.getElementById('ib-list'), clear = document.getElementById('ib-clear');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ICON = { watchReport: '⭐', daily: '📰', request: '📄', price: '🔔', screen: '🔎', update: '✨', intraday: '⚡' };
  var kst = function (t) { var d = new Date(Date.parse(t) + 9 * 3600e3).toISOString(); return { day: d.slice(0, 10), hm: d.slice(11, 16) }; };
  var items = [];
  var paint = function () {
    clear.hidden = !items.length;
    if (!items.length) { box.innerHTML = '<div class="ib-empty card">알림이 없어요.<br>새 리포트, 관심 종목, 가격 알림, 스크리너 조건, 업데이트 소식이 여기와 휴대폰으로 와요.</div>'; return; }
    var last = '';
    box.innerHTML = items.map(function (n) { var t = kst(n.created_at), head = t.day !== last ? '<div class="ib-day">' + t.day.slice(5).replace('-', '/') + '</div>' : ''; last = t.day;
      return head + '<div class="ib-item' + (n.read_at ? '' : ' new') + '" data-nid="' + n.id + '"><span class="ib-ic" aria-hidden="true">' + (ICON[n.kind] || '🔔') + '</span><a href="' + esc(n.link || '#') + '"><b>' + esc(n.title) + '</b><small>' + esc(n.body) + '</small><time>' + t.hm + '</time></a><button type="button" class="ib-x" data-del="' + n.id + '" aria-label="이 알림 지우기">×</button></div>'; }).join('');
  };
  box.addEventListener('click', function (e) {
    var del = e.target.closest && e.target.closest('[data-del]'); if (!del) return;
    var id = Number(del.getAttribute('data-del')); items = items.filter(function (n) { return n.id !== id; }); paint();
    G.call('POST', '/notifications/clear', { id: id });
  });
  clear.addEventListener('click', function () { items = []; paint(); G.call('POST', '/notifications/clear', {}); });
  (G.ready || Promise.resolve(null)).then(function (me) {
    if (!G.api || !me) { box.innerHTML = '<div class="ib-empty card">알림은 로그인한 계정으로 받아요.<br><a class="btn-primary" href="login.html?return=inbox.html" style="display:inline-flex;margin-top:12px">로그인</a></div>'; return; }
    G.call('GET', '/notifications').then(function (r) { if (r.error) { box.innerHTML = '<div class="ib-empty card">알림을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.</div>'; return; }
      items = r.items || []; paint(); if (r.unread) G.call('POST', '/notifications/read'); });
  });
})();
</script>`;
  return shell('', '알림함 | GNOMON', body, { ads: false });
}
