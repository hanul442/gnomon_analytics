// 관심 (G-133): the 관심 tab opens its own page with only the reader's watched stocks, ETFs and coins: live
// price, today's move, the newest report, new filings and news, and the nearest condition price. The list is
// the same one the ☆ buttons write (this browser, synced to the account when signed in).

import { shell } from './renderHtml.js';

const STYLE = `<style>
.wp-head{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap}.wp-head h1{margin:0}.wp-sum{display:flex;gap:14px;font-size:14px;color:var(--fg2)}.wp-sum b{font-size:18px;color:var(--fg)}
.wp-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:14px 0 10px}.wp-tools select{font:inherit;font-size:14px;border:1px solid var(--line-strong);border-radius:10px;padding:7px 9px;background:#fff}
.wp-list{display:flex;flex-direction:column;gap:10px}.wp-row{display:grid;grid-template-columns:minmax(0,1fr) auto 40px;gap:10px;align-items:center;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 14px 14px 16px}
.wp-row a.wp-main{text-decoration:none;color:inherit;min-width:0}.wp-name{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.wp-name b{font-size:16px}.wp-name small{color:var(--muted)}
.wp-tags{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:6px;font-size:12.5px;font-weight:600}.wp-tags span{border-radius:6px;padding:1px 7px;background:#f1f4f9;color:var(--fg2)}.wp-tags .new{background:#fff3d6;color:#7a4a00}.wp-tags .rep{background:#e8f0ff;color:#1d4ed8}
.wp-px{text-align:right;display:flex;flex-direction:column;gap:2px;font-variant-numeric:tabular-nums}.wp-px b{font-size:16px}.wp-px span{font-size:13px;font-weight:700}
.wp-empty{text-align:center;padding:40px 16px}.wp-empty p{color:var(--fg2)}.wp-empty .btn-primary{display:inline-flex;margin-top:10px}
.wp-row .star svg{width:22px;height:22px}
</style>`;

const SCRIPT = `<script>
(function () {
  var KEY = 'gnm-watch', box = document.getElementById('wp-list'), sortSel = document.getElementById('wp-sort');
  var read = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var isUs = function (s) { return /^(?!KRW-)[A-Z][A-Z0-9-]{0,9}(\\.[A-Z])?$/.test(s); };
  var won = function (p, s) { if (s && isUs(s)) return '$' + p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (Math.abs(p) >= 100 ? Math.round(p).toLocaleString('ko-KR') : p.toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + '원'; };
  var items = null, info = null, live = {};
  try { sortSel.value = localStorage.getItem('gnm-watch-sort') || 'added'; } catch (e) {}
  var row = function (sym, i) {
    var it = (items || []).find(function (x) { return x[0] === sym; }) || [sym, sym, '', null, null, 0];
    var coin = sym.indexOf('KRW-') === 0, us = isUs(sym), href = it[5] ? sym + '/index.html' : coin ? 'coin.html?m=' + sym : us ? 'us.html?s=' + encodeURIComponent(sym) : 'stock.html?c=' + sym;
    var q = live[sym], p = q ? q.price : it[3], ch = q ? q.changePct : it[4], wi = info && info[sym], tags = [];
    if (wi && wi.d) tags.push('<span class="rep">리포트 ' + esc(wi.d.slice(5).replace('-', '/')) + '</span>');
    if (wi && wi.f) tags.push('<span class="new">새 공시 ' + wi.f + '</span>');
    if (wi && wi.n) tags.push('<span class="new">새 뉴스 ' + wi.n + '</span>');
    if (wi && p) { [['▲', wi.up], ['▼', wi.dn]].forEach(function (x) { if (x[1]) tags.push('<span class="' + (x[0] === '▲' ? 'up' : 'down') + '">' + x[0] + ' ' + won(x[1], sym) + ' (' + ((x[1] / p - 1) * 100 > 0 ? '+' : '') + ((x[1] / p - 1) * 100).toFixed(1) + '%)</span>'); }); }
    return '<div class="wp-row" data-i="' + i + '"><a class="wp-main" href="' + href + '"><div class="wp-name"><b>' + esc(it[1]) + '</b><small>' + esc(coin ? sym.replace('KRW-', '') + ' · 코인' : us ? sym.split('.')[0] + ' · 미국' : sym + (it[2] === 'ETF' ? ' · ETF' : '')) + '</small></div>' + (tags.length ? '<div class="wp-tags">' + tags.join('') + '</div>' : '') + '</a>' +
      '<div class="wp-px">' + (p == null ? '<span class="muted">가격 확인 중</span>' : '<b data-live="' + esc(sym) + '" data-live-f="price">' + won(p, sym) + '</b>') + (ch == null ? '' : '<span class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '" data-live="' + esc(sym) + '" data-live-f="pct">' + (ch > 0 ? '▲ +' : ch < 0 ? '▼ ' : '') + ch.toFixed(2) + '%</span>') + '</div>' +
      '<button type="button" class="star" data-star="' + esc(sym) + '" aria-pressed="true" aria-label="관심 종목에서 빼기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/></svg></button></div>';
  };
  var draw = function () {
    var w = read(), by = sortSel.value;
    document.getElementById('wp-n').textContent = w.length;
    if (!w.length) { box.innerHTML = '<div class="wp-empty card"><p>아직 관심 종목이 없어요.<br>종목·ETF·코인 화면의 ☆를 누르면 여기에 모여요.</p><a class="btn-primary" href="screener.html">종목 찾아보기</a></div>'; document.getElementById('wp-up').textContent = '0'; document.getElementById('wp-down').textContent = '0'; return; }
    var info2 = function (s) { var it = (items || []).find(function (x) { return x[0] === s; }) || []; var q = live[s]; return { name: it[1] || s, ch: q ? q.changePct : it[4], rep: info && info[s] ? info[s].d : '' }; };
    var order = w.map(function (s, i) { return [s, i]; });
    if (by === 'chg') order.sort(function (a, b) { return (info2(b[0]).ch ?? -999) - (info2(a[0]).ch ?? -999); });
    if (by === 'chga') order.sort(function (a, b) { return (info2(a[0]).ch ?? 999) - (info2(b[0]).ch ?? 999); });
    if (by === 'name') order.sort(function (a, b) { return info2(a[0]).name.localeCompare(info2(b[0]).name, 'ko'); });
    if (by === 'report') order.sort(function (a, b) { return String(info2(b[0]).rep).localeCompare(String(info2(a[0]).rep)); });
    if (by === 'recent') order.reverse();
    box.innerHTML = order.map(function (x) { return row(x[0], x[1]); }).join('');
    var up = 0, dn = 0; w.forEach(function (s) { var c = info2(s).ch; if (c > 0) up++; else if (c < 0) dn++; });
    document.getElementById('wp-up').textContent = up; document.getElementById('wp-down').textContent = dn;
  };
  sortSel.addEventListener('change', function () { try { localStorage.setItem('gnm-watch-sort', sortSel.value); } catch (e) {} draw(); });
  window.addEventListener('gnm-watch', draw);
  window.addEventListener('storage', function (e) { if (e.key === KEY) draw(); });
  window.addEventListener('gnm-quote', function (e) { var d = e.detail; live[d.symbol] = d.quote; });
  draw();
  var list = function (url, kind) { return fetch(url).then(function (r) { return r.json(); }).then(function (d) { return (d.rows || []).map(function (x) { return [x[0], x[1], kind, x[4], x[5], 0]; }); }).catch(function () { return []; }); };
  Promise.all([fetch('search.json').then(function (r) { return r.json(); }).then(function (d) { return d.items; }).catch(function () { return []; }), list('etfs.json', 'ETF'), list('coins.json', 'COIN'), list('usstocks.json', 'US'), fetch('watchinfo.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })]).then(function (all) {
    var seen = {}; items = []; info = all[4];
    all.slice(0, 4).forEach(function (xs) { (xs || []).forEach(function (x) { if (!seen[x[0]]) { seen[x[0]] = 1; items.push(x); } }); });
    draw();
  });
})();
</script>`;

export function renderWatchPage(): string {
  const body = `${STYLE}<section class="hero" id="top"><div class="hero-main wp-head"><div><div class="eyebrow"><span>관심</span></div><h1>내 관심 종목</h1></div><div class="wp-sum"><span>관심 <b id="wp-n">0</b></span><span class="up">▲ <b id="wp-up">0</b></span><span class="down">▼ <b id="wp-down">0</b></span></div></div></section>
<section class="block"><div class="wp-tools"><label class="sc-inline">정렬 <select id="wp-sort" aria-label="정렬"><option value="added">추가한 순</option><option value="recent">최근 추가 먼저</option><option value="chg">오늘 많이 오른 순</option><option value="chga">오늘 많이 내린 순</option><option value="report">최신 리포트 순</option><option value="name">이름</option></select></label><a class="chip-toggle" href="alerts.html">🔔 가격 알림</a><a class="chip-toggle" href="reports.html#today">오늘 나온 리포트</a></div>
<div class="wp-list" id="wp-list"></div>
<p class="fine">☆로 넣고 빼요. 로그인하면 계정에 저장돼서 다른 기기에서도 보여요. 가격은 장중 4초마다 새로 받아요.</p></section>`;
  return shell('', '관심 종목 | GNOMON', body, { active: 'watch', scripts: SCRIPT });
}
