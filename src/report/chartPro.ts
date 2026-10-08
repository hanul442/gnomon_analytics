// G-139: the chart is no longer a tab. The 요약 mini chart (and every "차트에서 보기" link) opens the chart panel
// as a full-screen page with its own back button, and adds the tools a chart app is expected to have on top of
// the chart built by CHART_JS / the free chart page (window.GNMChart):
//   - chart type: 캔들 · 하이킨아시 · 바 · 라인 · 영역 · 기준선 (the candle series stays as an invisible anchor,
//     so drawings, indicators, strategy markers and the day/week/month switch keep working on every type);
//   - price axis: 가격 · 로그 · % ;
//   - period high/low marks for whatever range is on screen;
//   - magnet crosshair, save as an image, and landscape / browser full screen.
// Choices are remembered on this device.

export const CHART_PRO_CSS = `
.hc-range{margin:6px 0 0;max-width:520px;width:100%;display:flex}.hc-range button{flex:1}
html.chart-fs,html.chart-fs body{overflow:hidden}
/* G-146: the chart page never scrolls. Fixed on top: back, name and a small live price, then the settings rows;
   the chart takes all the height left; on phones the drawing tools are fixed at the bottom (a left bar on PCs). */
html.chart-fs #tab-chart{position:fixed;inset:0;z-index:75;background:#fff;display:flex;flex-direction:column;overflow:hidden;margin:0;padding:0 0 env(safe-area-inset-bottom);max-width:none;width:auto}
html.chart-fs #tab-chart>.panel-title{display:none}
html.chart-fs #tab-chart>.block{flex:1;min-height:0;display:flex;flex-direction:column;margin:0;padding:0;max-width:none}
html.chart-fs #tab-chart .chart-card{flex:1;min-height:0;display:flex;flex-direction:column;gap:4px;margin:0;border:0;border-radius:0;box-shadow:none;padding:6px 12px 0;max-width:none;overflow:hidden}
html.chart-fs #tab-chart .chart-card>*{order:8;flex:none}
html.chart-fs #tab-chart .chart-head{display:contents}html.chart-fs #tab-chart .chart-head>div:first-child{display:none}
html.chart-fs #tab-chart .chart-head>.seg{order:1}html.chart-fs #tab-chart .chart-head>.fine{order:2;margin:0}
html.chart-fs #tab-chart .pro-bar{order:2;margin:0}html.chart-fs #tab-chart .active-pills{order:3;margin:0}html.chart-fs #tab-chart .chart-context{order:3;margin:0}html.chart-fs #tab-chart .dw-hint{order:3;margin:0}
html.chart-fs #tab-chart .legend-line{order:4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;min-height:16px}html.chart-fs #tab-chart .draw-note{order:4;margin:0;min-height:0}
html.chart-fs #tab-chart .chart-wrap{order:5;flex:1;min-height:0;display:flex;flex-direction:column}
html.chart-fs #tab-chart .chart-body{flex:1;min-height:0}html.chart-fs #tab-chart #chart{height:100%!important}
html.chart-fs #tab-chart .chart-card>.fine,html.chart-fs #tab-chart .strat-info,html.chart-fs #tab-chart .v6-bar[hidden],html.chart-fs #tab-chart .chart-tools[hidden]{display:none}
html.chart-fs #tab-chart .chart-head>.seg,html.chart-fs #tab-chart .active-pills{display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;max-width:100%}html.chart-fs #tab-chart .active-pills>*{flex:none}
html.chart-fs .chat-fab,html.chart-fs .fb-row{display:none!important}html.chart-fs #tab-chart .chart-head>.fine:empty{display:none}
.cfs-head{display:none}
html.chart-fs .cfs-head{flex:none;display:flex;align-items:center;gap:6px;padding:calc(4px + env(safe-area-inset-top)) 12px 4px 4px;background:#fff;border-bottom:1px solid var(--line)}
.cfs-back{flex:none;width:44px;height:44px;display:grid;place-items:center;border:0;background:none;border-radius:12px;font-size:30px;line-height:1;color:var(--fg);cursor:pointer}.cfs-back:hover{background:#eef2f8}
.cfs-t{min-width:0;flex:1;display:flex;align-items:baseline;gap:8px;overflow:hidden;white-space:nowrap}.cfs-t b{font-size:16px;overflow:hidden;text-overflow:ellipsis}.cfs-px{font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}.cfs-px small{font-size:12px;margin-left:4px}
.cfs-hint{font-size:12.5px;color:var(--muted);white-space:nowrap}
.pro-bar{display:flex;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;align-items:center;gap:6px;margin:2px 0 8px}.pro-bar::-webkit-scrollbar{display:none}.pro-bar>*{flex:none}
.pro-bar .seg button{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.pro-bar svg{width:18px;height:18px;flex:none}
.pb-sel{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);border-radius:12px;padding:0 4px 0 8px;background:#fff;min-height:40px}.pb-sel select{font:inherit;font-size:13.5px;font-weight:700;border:0;background:transparent;padding:8px 2px;color:var(--fg)}
.pb-ic{display:inline-flex;align-items:center;gap:5px;min-height:40px;min-width:40px;justify-content:center;border:1px solid var(--line);border-radius:12px;background:#fff;font:inherit;font-size:13px;font-weight:700;color:var(--fg2);cursor:pointer;padding:0 10px;white-space:nowrap}.pb-ic[aria-pressed=true]{background:#e6edfb;border-color:#b9cbf3;color:#1d4ed8}.pb-ic:hover{border-color:var(--accent)}
.pro-bar .chip-toggle{white-space:nowrap}
#tab-chart:fullscreen{background:#fff}
@media (max-width:820px){.pb-ic span{display:none}.pb-ic{padding:0}html.chart-fs #tab-chart .active-pills{display:none}.cfs-hint{display:none}
 html.chart-fs #tab-chart .chart-card{padding:4px 10px 0}html.chart-fs #tab-chart .chart-wrap>.chart-body{order:1}html.chart-fs #tab-chart .chart-wrap>.dw-tools{order:2;margin:4px 0 0}
 html.chart-fs #tab-chart .chart-wrap>.dw{order:3;border-top:1px solid var(--line);margin:0 -10px;padding:2px 6px calc(2px + env(safe-area-inset-bottom));background:#fff}}
@media (orientation:landscape) and (max-height:500px){html.chart-fs #tab-chart .chart-head>.seg,html.chart-fs #tab-chart .legend-line{display:none}html.chart-fs .cfs-head{padding-top:2px;padding-bottom:2px}}
`;

const ICONS: Record<string, string> = {
  candle: '<path d="M7 3v4M7 17v4M17 3v6M17 15v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="4.5" y="7" width="5" height="10" rx="1" fill="currentColor"/><rect x="14.5" y="9" width="5" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  ha: '<path d="M7 4v16M17 4v16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="4.5" y="9" width="5" height="8" rx="1" fill="currentColor"/><rect x="14.5" y="6" width="5" height="8" rx="1" fill="currentColor" opacity=".55"/>',
  bar: '<path d="M8 4v16M5 8h3M8 15h3M16 6v14M13 10h3M16 17h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  line: '<path d="M3 17l5-6 4 3 4-7 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  area: '<path d="M3 17l5-6 4 3 4-7 5 5v8H3z" fill="currentColor" opacity=".25"/><path d="M3 17l5-6 4 3 4-7 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  base: '<path d="M3 12h18" stroke="currentColor" stroke-width="1.4" stroke-dasharray="3 2"/><path d="M3 15l4-5 4 4 4-8 6 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};
const TYPES: readonly [string, string][] = [['candle', '캔들'], ['ha', '하이킨아시'], ['bar', '바'], ['line', '라인'], ['area', '영역'], ['base', '기준선']];

const PB = (k: string, label: string, icon: string, extra = '') => `<button type="button" class="pb-ic" ${k} title="${label}" aria-label="${label}"${extra}><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg><span>${label}</span></button>`;
const PL = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
export const CHART_PRO_BAR = `<div class="pro-bar" role="toolbar" aria-label="차트 보기 도구"><label class="pb-sel" title="차트 종류"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.candle}</svg><select data-ct-select aria-label="차트 종류">${TYPES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
<div class="seg pb-scale" role="group" aria-label="가격 축"><button type="button" data-scale="0" aria-pressed="true">가격</button><button type="button" data-scale="1" aria-pressed="false" title="로그 눈금: 오래 오른 종목을 비율로 봐요">로그</button><button type="button" data-scale="2" aria-pressed="false" title="화면 왼쪽 첫 봉 대비 %">%</button></div>
${PB('data-hilo', '최고·최저', `<path ${PL} d="M12 3v6M9 6l3-3 3 3M12 21v-6M9 18l3 3 3-3M4 12h16"/>`, ' aria-pressed="true"')}${PB('data-magnet', '자석 십자선', `<path ${PL} d="M6 4v8a6 6 0 0012 0V4M6 8h4M14 8h4"/>`, ' aria-pressed="false"')}${PB('data-shot', '사진 저장', `<path ${PL} d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5" ${PL}/>`)}${PB('data-land', '가로로 보기', `<rect x="3" y="7" width="18" height="10" rx="2" ${PL}/><path ${PL} d="M7 4l-3 3 3 3"/>`)}</div>`;

/** G-141: period chips under the 요약 mini chart, Toss-style; the chart itself still opens the full-screen one. */
export const HERO_RANGE_JS = `
(function () {
  var won = function (v) { if (document.documentElement.getAttribute('data-ccy') === 'USD') return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + '원'; };
  var P = [['1주', 5], ['1달', 21], ['3달', 63], ['6달', 126], ['1년', 250]], n0 = 63;
  try { n0 = Number(localStorage.getItem('gnm-hero-range')) || 63; } catch (e) {}
  var draw = function (a, n) {
    var all = []; try { all = JSON.parse(a.getAttribute('data-c') || '[]'); } catch (e) {}
    var c = all.slice(-n); if (c.length < 3) return;
    var lo = Math.min.apply(null, c), hi = Math.max.apply(null, c), sp = hi - lo || 1, w = 320, h = 72;
    var pts = c.map(function (v, i) { return (i / (c.length - 1) * w).toFixed(1) + ',' + (h - 4 - (v - lo) / sp * (h - 10)).toFixed(1); }).join(' ');
    var g = (c[c.length - 1] / c[0] - 1) * 100, col = g >= 0 ? '#d1373d' : '#2a62c9', id = 'hcg' + Math.random().toString(36).slice(2, 7);
    var label = (P.filter(function (p) { return p[1] === n; })[0] || ['', 0])[0];
    a.querySelector('svg').innerHTML = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".22"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs><polygon points="0,' + h + ' ' + pts + ' ' + w + ',' + h + '" fill="url(#' + id + ')"/><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>';
    var meta = a.querySelector('.hc-meta > span'); if (meta) meta.innerHTML = label + ' <b class="' + (g > 0 ? 'up' : g < 0 ? 'down' : '') + '">' + (g > 0 ? '▲ +' : g < 0 ? '▼ ' : '') + g.toFixed(1) + '%</b> · 최고 ' + won(hi) + ' · 최저 ' + won(lo);
    a.setAttribute('aria-label', '최근 ' + label + ' 차트, 눌러서 전체 화면 차트 열기');
  };
  window.GNM_heroRange = function (a) {
    if (!a || a.nextElementSibling && a.nextElementSibling.classList.contains('hc-range')) return;
    var len = 0; try { len = JSON.parse(a.getAttribute('data-c') || '[]').length; } catch (e) {}
    var ps = P.filter(function (p) { return len >= Math.min(p[1], 5) && (p[1] <= len || p[1] - len < p[1] * 0.2); }); if (ps.length < 2) return;
    var n = ps.some(function (p) { return p[1] === n0; }) ? n0 : 63;
    var box = document.createElement('div'); box.className = 'seg hc-range'; box.setAttribute('role', 'group'); box.setAttribute('aria-label', '미니 차트 기간');
    box.innerHTML = ps.map(function (p) { return '<button type="button" data-hc="' + p[1] + '" aria-pressed="' + (p[1] === n) + '">' + p[0] + '</button>'; }).join('');
    a.insertAdjacentElement('afterend', box);
    box.addEventListener('click', function (e) { var b = e.target.closest('[data-hc]'); if (!b) return; var k = Number(b.getAttribute('data-hc')); box.querySelectorAll('[data-hc]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); try { localStorage.setItem('gnm-hero-range', String(k)); } catch (x) {} draw(a, k); });
    if (n !== 63) draw(a, n);
  };
  var boot = function () { document.querySelectorAll('.hero-chart[data-c]').forEach(window.GNM_heroRange); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
`;

export const CHART_PRO_JS = `
(function () {
  var panel = document.getElementById('tab-chart'); if (!panel) return;
  var root = document.documentElement, UP = '#d1373d', DOWN = '#2a62c9', NAVY = '#2e4268', T = 'rgba(0,0,0,0)';
  var ICON_CT = ${JSON.stringify(ICONS)};
  var PREF = 'gnm-chart-pro', pref = { ct: 'candle', scale: 0, hilo: true, magnet: false };
  try { var sp = JSON.parse(localStorage.getItem(PREF) || 'null'); if (sp) for (var k in sp) pref[k] = sp[k]; } catch (e) {}
  var keep = function () { try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) {} };
  var toast = function (t) { if (window.GNM && GNM.toast) GNM.toast(t); };
  var mobile = window.matchMedia('(max-width: 820px)').matches;

  // ---- full-screen page: header with a back button, opened instead of a tab ----
  var title = (document.querySelector('.hero h1') || {}).textContent || document.title.split('|')[0];
  var head = document.createElement('div'); head.className = 'cfs-head';
  head.innerHTML = '<button type="button" class="cfs-back" aria-label="차트 닫기">‹</button><div class="cfs-t"><b></b><span class="cfs-px"><span data-live-f="price"></span><small data-live-f="arrowpct"></small></span></div><span class="cfs-hint">Esc로 닫기</span>';
  head.querySelector('b').textContent = String(title).trim();
  panel.insertBefore(head, panel.firstChild);
  var panels = Array.prototype.slice.call(document.querySelectorAll('[role=tabpanel]'));
  var lastTab = 'tab-home', isOpen = false;
  // Back is the way out; only when it never arrives (no entry to go back to) is the tab switched directly.
  var close = function () {
    var moved = false, mark = function () { moved = true; }; window.addEventListener('popstate', mark, { once: true });
    history.back();
    setTimeout(function () { window.removeEventListener('popstate', mark); if (!moved && !panel.hidden && window.GNM_showTab) GNM_showTab(lastTab.replace('tab-', '')); }, 1500);
  };
  head.querySelector('.cfs-back').addEventListener('click', close);
  var watch = function () {
    var on = !panel.hidden;
    panels.forEach(function (p) { if (p !== panel && !p.hidden) lastTab = p.id; });
    if (on === isOpen) return; isOpen = on;
    root.classList.toggle('chart-fs', on);
    if (!on) { if (document.fullscreenElement) document.exitFullscreen().catch(function () {}); return; }
    // Every way in (link, indicator button, a shared #tab-chart address) leaves one history entry, so the phone's
    // back button closes the chart and lands on the tab the reader came from.
    if (!(history.state && history.state.gnmChart)) { history.replaceState(history.state, '', '#' + lastTab); history.pushState({ gnmChart: 1 }, '', '#tab-chart'); }
    panel.scrollTop = 0; init(); setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 30);
  };
  panels.forEach(function (p) { new MutationObserver(watch).observe(p, { attributes: true, attributeFilter: ['hidden'] }); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !isOpen) return;
    if (document.querySelector('.sheet:not([hidden]), .chart-card.drawing, dialog[open]')) return;
    close();
  });
  setTimeout(watch, 0);
  // In-page links open it without their own hash entry; watch() adds exactly one.
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href="#tab-chart"]'); if (!a || !window.GNM_showTab) return; e.preventDefault(); GNM_showTab('chart'); }, true);

  // ---- tools on top of window.GNMChart ----
  var G = null;
  var init = function () {
    var g = window.GNMChart; if (!g || g === G || !g.candle) return; G = g;
    var L = G.L, chart = G.chart, candle = G.candle, card = panel.querySelector('.chart-card');
    if (card && !card.querySelector('.pro-bar')) { var at = card.querySelector('.chart-head'); var wrap = document.createElement('div'); wrap.innerHTML = ${JSON.stringify('__BAR__')}; if (at) at.insertAdjacentElement('afterend', wrap.firstChild); else card.insertBefore(wrap.firstChild, card.firstChild); }
    var bar = panel.querySelector('.pro-bar'); if (!bar) return;
    // One swipeable row for every chart setting: 봉 단위, 차트 종류, 가격 축, 지표, 전략, toggles (G-146).
    var gather = function () {
      var tf = card.querySelector('.chart-head > .coin-tf') || card.querySelector('.v6-bar .seg.tf'); if (tf && tf.parentElement !== bar) bar.insertBefore(tf, bar.firstChild);
      var cmp = card.querySelector('.v6-bar [data-compare]'); if (cmp) bar.appendChild(cmp);
      var ct = card.querySelector('.chart-tools'); if (ct) { [].slice.call(ct.querySelectorAll('[data-open="ind-sheet"], #ind-reset, .strat-pick')).forEach(function (b) { bar.appendChild(b); }); ct.hidden = true; }
      var v6 = card.querySelector('.v6-bar'); if (v6 && !v6.querySelector('button, select')) v6.hidden = true;
    };
    if (card) { gather(); var hd = card.querySelector('.chart-head'); if (hd) new MutationObserver(gather).observe(hd, { childList: true }); }
    // The small live price in the header: the last close until the live feed answers (LIVE_JS fills [data-live]).
    var px = head.querySelector('.cfs-px'), sym = ((card && card.getAttribute('data-symbol')) || new URLSearchParams(location.search).get('c') || new URLSearchParams(location.search).get('m') || new URLSearchParams(location.search).get('s') || '').toUpperCase();
    try { var dd = candle.data(), lc = dd[dd.length - 1], pc0 = dd[dd.length - 2]; if (lc) { var usd = root.getAttribute('data-ccy') === 'USD'; px.firstChild.textContent = usd ? '$' + lc.close.toFixed(2) : (Math.abs(lc.close) >= 100 ? Math.round(lc.close).toLocaleString('ko-KR') : lc.close.toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + '원'; if (pc0) { var ch0 = (lc.close / pc0.close - 1) * 100; px.lastChild.textContent = (ch0 > 0 ? '▲ +' : ch0 < 0 ? '▼ ' : '') + ch0.toFixed(2) + '%'; px.lastChild.className = ch0 > 0 ? 'up' : ch0 < 0 ? 'down' : ''; } } } catch (e) {}
    if (sym) [].forEach.call(px.children, function (el) { el.setAttribute('data-live', sym); });
    var orig = candle.options(), cur = [], view = null, shown = true;
    var plain = function (b) { return { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }; };
    try { cur = candle.data().map(plain); } catch (e) { cur = []; }
    var ha = function (d) { var o = [], po = 0, pc = 0; d.forEach(function (b, i) { var c = (b.open + b.high + b.low + b.close) / 4, op = i ? (po + pc) / 2 : (b.open + b.close) / 2; o.push({ time: b.time, open: op, high: Math.max(b.high, op, c), low: Math.min(b.low, op, c), close: c }); po = op; pc = c; }); return o; };
    var closes = function (d) { return d.map(function (b) { return { time: b.time, value: b.close }; }); };
    var conv = function (d) { return pref.ct === 'ha' || pref.ct === 'bar' ? (pref.ct === 'ha' ? ha(d) : d) : closes(d); };
    // The day/week/month switch hides every series but the candle; the chart type rides on the candle instead.
    var series0 = G.series; G.series = function () { return series0.call(G).filter(function (s) { return s !== view; }); };
    var setData = candle.setData.bind(candle), update = candle.update.bind(candle), apply = candle.applyOptions.bind(candle);
    var baseAt = function () { if (!view || pref.ct !== 'base' || !cur.length) return; var r = chart.timeScale().getVisibleLogicalRange(), i = r ? Math.max(0, Math.min(cur.length - 1, Math.ceil(r.from))) : 0; view.applyOptions({ baseValue: { type: 'price', price: cur[i].close } }); };
    var sync = function () { if (view) { view.setData(conv(cur)); baseAt(); } };
    candle.setData = function (d) { cur = (d || []).map(plain); setData(d); sync(); };
    candle.update = function (b) { var l = cur[cur.length - 1]; if (l && JSON.stringify(l.time) === JSON.stringify(b.time)) cur[cur.length - 1] = plain(b); else cur.push(plain(b)); update(b); if (view) { if (pref.ct === 'ha') sync(); else view.update(conv([plain(b)])[0]); } };
    candle.applyOptions = function (o) { apply(o); if (o && 'visible' in o) { shown = o.visible !== false; if (view) view.applyOptions({ visible: shown }); } };
    var setType = function (k) {
      pref.ct = k; keep();
      var sl = bar.querySelector('[data-ct-select]'); if (sl) { sl.value = k; var ic = bar.querySelector('.pb-sel svg'); if (ic && ICON_CT[k]) ic.innerHTML = ICON_CT[k]; }
      if (view) { chart.removeSeries(view); view = null; }
      if (k === 'candle') { apply({ upColor: orig.upColor, downColor: orig.downColor, wickUpColor: orig.wickUpColor, wickDownColor: orig.wickDownColor, wickVisible: true, borderVisible: orig.borderVisible, lastValueVisible: true, priceLineVisible: true }); return; }
      apply({ upColor: T, downColor: T, wickUpColor: T, wickDownColor: T, borderUpColor: T, borderDownColor: T, wickVisible: false, borderVisible: false, lastValueVisible: false, priceLineVisible: false });
      var o = { priceLineVisible: true, lastValueVisible: true, visible: shown };
      if (k === 'ha') view = chart.addSeries(L.CandlestickSeries, Object.assign({ upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN }, o));
      if (k === 'bar') view = chart.addSeries(L.BarSeries, Object.assign({ upColor: UP, downColor: DOWN, thinBars: false }, o));
      if (k === 'line') view = chart.addSeries(L.LineSeries, Object.assign({ color: NAVY, lineWidth: 2 }, o));
      if (k === 'area') view = chart.addSeries(L.AreaSeries, Object.assign({ lineColor: NAVY, topColor: 'rgba(46,66,104,.28)', bottomColor: 'rgba(46,66,104,.02)', lineWidth: 2 }, o));
      if (k === 'base') view = chart.addSeries(L.BaselineSeries, Object.assign({ topLineColor: UP, topFillColor1: 'rgba(209,55,61,.22)', topFillColor2: 'rgba(209,55,61,.03)', bottomLineColor: DOWN, bottomFillColor1: 'rgba(42,98,201,.03)', bottomFillColor2: 'rgba(42,98,201,.22)', lineWidth: 2 }, o));
      sync();
    };
    var setScale = function (n) {
      pref.scale = n; keep(); chart.priceScale('right').applyOptions({ mode: n });
      bar.querySelectorAll('[data-scale]').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-scale')) === n)); });
    };
    var setMagnet = function (on) { pref.magnet = on; keep(); chart.applyOptions({ crosshair: { mode: on ? 1 : 0 } }); bar.querySelector('[data-magnet]').setAttribute('aria-pressed', String(on)); };

    // ---- high / low of the range on screen ----
    var won = function (v) { return Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: Math.abs(v) >= 1 ? 2 : 4 }); };
    var day = function (t) { if (typeof t === 'number') { var d = new Date(t * 1000); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); } if (t && t.year) return t.month + '/' + t.day; var s = String(t); return Number(s.slice(5, 7)) + '/' + Number(s.slice(8, 10)); };
    var req = null, ext = function () {
      var r = chart.timeScale().getVisibleLogicalRange(); if (!r || !cur.length) return null;
      var a = Math.max(0, Math.ceil(r.from)), b = Math.min(cur.length - 1, Math.floor(r.to)); if (b <= a) return null;
      var hi = a, lo = a; for (var i = a; i <= b; i++) { if (cur[i].high > cur[hi].high) hi = i; if (cur[i].low < cur[lo].low) lo = i; }
      return { hi: cur[hi], lo: cur[lo] };
    };
    var mark = function (ctx, r, w, b, price, top) {
      var x = chart.timeScale().timeToCoordinate(b.time), y = candle.priceToCoordinate(price); if (x == null || y == null) return;
      var t = (top ? '최고 ' : '최저 ') + won(price) + ' · ' + day(b.time);
      ctx.font = '600 ' + (11.5 * r) + 'px sans-serif'; var tw = ctx.measureText(t).width, left = x * r + tw + 40 * r > w;
      var yy = (top ? y - 8 : y + 8) * r, x0 = x * r, x1 = left ? x0 - 18 * r : x0 + 18 * r;
      ctx.strokeStyle = ctx.fillStyle = top ? UP : DOWN; ctx.lineWidth = r;
      ctx.beginPath(); ctx.moveTo(x0, (top ? y - 2 : y + 2) * r); ctx.lineTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
      ctx.textBaseline = 'middle'; ctx.fillText(t, left ? x1 - tw - 4 * r : x1 + 4 * r, yy);
    };
    candle.attachPrimitive({
      attached: function (p) { req = p.requestUpdate; }, detached: function () {}, updateAllViews: function () {},
      paneViews: function () { return [{ zOrder: function () { return 'top'; }, renderer: function () { return { draw: function (target) {
        if (!pref.hilo || !shown) return; var e = ext(); if (!e) return;
        target.useBitmapCoordinateSpace(function (s) { s.context.save(); mark(s.context, s.horizontalPixelRatio, s.bitmapSize.width, e.hi, e.hi.high, true); mark(s.context, s.horizontalPixelRatio, s.bitmapSize.width, e.lo, e.lo.low, false); s.context.restore(); });
      } }; } }]; }
    });
    var t = null; chart.timeScale().subscribeVisibleLogicalRangeChange(function () { if (req) req(); if (!t) t = setTimeout(function () { t = null; baseAt(); }, 120); });

    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-scale')) setScale(Number(b.getAttribute('data-scale')));
      else if (b.hasAttribute('data-hilo')) { pref.hilo = !pref.hilo; keep(); b.setAttribute('aria-pressed', String(pref.hilo)); if (req) req(); }
      else if (b.hasAttribute('data-magnet')) setMagnet(!pref.magnet);
      else if (b.hasAttribute('data-shot')) {
        try { chart.takeScreenshot().toBlob(function (blob) { if (!blob) return; var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = String(title).trim().replace(/\\s+/g, '_') + '-chart.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); toast('차트 사진을 저장했어요.'); }); } catch (x) { toast('이 브라우저에서는 사진 저장이 안 돼요.'); }
      }
      else if (b.hasAttribute('data-land')) {
        if (document.fullscreenElement) { document.exitFullscreen().catch(function () {}); return; }
        var go = function () { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () {}); };
        if (panel.requestFullscreen) panel.requestFullscreen().then(go).catch(function () { toast('휴대폰을 가로로 돌리면 차트가 넓게 보여요.'); });
        else toast('휴대폰을 가로로 돌리면 차트가 넓게 보여요.');
      }
    });
    var land = bar.querySelector('[data-land]'), landT = function (t) { land.querySelector('span').textContent = t; land.setAttribute('aria-label', t); land.title = t; }; landT(mobile ? '가로로 보기' : '브라우저 전체 화면');
    bar.querySelector('[data-ct-select]').addEventListener('change', function (e) { setType(e.target.value); });
    document.addEventListener('fullscreenchange', function () { landT(document.fullscreenElement ? '전체 화면 끝내기' : mobile ? '가로로 보기' : '브라우저 전체 화면'); setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60); });
    bar.querySelector('[data-hilo]').setAttribute('aria-pressed', String(pref.hilo));
    if (pref.ct !== 'candle') setType(pref.ct); if (pref.scale) setScale(pref.scale); if (pref.magnet) setMagnet(true);
    window.GNM_chartPro = { type: setType, scale: setScale, view: function () { return view; }, extremes: ext };
  };
  // The free chart pages build GNMChart after their data arrives; try again until it exists.
  var tries = 0, poll = setInterval(function () { init(); if (G || ++tries > 60) clearInterval(poll); }, 500);
  window.addEventListener('DOMContentLoaded', init);
})();
`.replace(JSON.stringify('__BAR__'), JSON.stringify(CHART_PRO_BAR).replace(/</g, '\\u003c'));
