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
html.chart-fs #tab-chart{position:fixed;inset:0;z-index:75;background:var(--bg,#f4f6fa);overflow-y:auto;overscroll-behavior:contain;margin:0;padding:0 0 calc(16px + env(safe-area-inset-bottom));max-width:none;width:auto}
html.chart-fs #tab-chart>.panel-title{display:none}
html.chart-fs #tab-chart *{scroll-margin-top:64px}
html.chart-fs #tab-chart .block{margin:0;padding:0;max-width:none}
html.chart-fs #tab-chart .chart-card{margin:0;border:0;border-radius:0;box-shadow:none;padding:10px 16px 14px;max-width:none}
html.chart-fs #tab-chart #chart{height:max(360px,calc(100dvh - 300px))!important}
html.chart-fs .chat-fab{display:none}
.cfs-head{display:none}
html.chart-fs .cfs-head{position:sticky;top:0;z-index:6;display:flex;align-items:center;gap:6px;padding:calc(6px + env(safe-area-inset-top)) 12px 6px 4px;background:rgba(255,255,255,.96);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.cfs-back{flex:none;width:44px;height:44px;display:grid;place-items:center;border:0;background:none;border-radius:12px;font-size:30px;line-height:1;color:var(--fg);cursor:pointer}.cfs-back:hover{background:#eef2f8}
.cfs-t{min-width:0;flex:1;display:flex;align-items:baseline;gap:8px;overflow:hidden;white-space:nowrap}.cfs-t b{font-size:17px;overflow:hidden;text-overflow:ellipsis}.cfs-t small{color:var(--muted);font-size:13px}
.cfs-hint{font-size:12.5px;color:var(--muted);white-space:nowrap}
.pro-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;margin:2px 0 8px}
.pro-bar .seg button{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}.pro-bar svg{width:16px;height:16px;flex:none}
.pro-bar .chip-toggle{white-space:nowrap}
.pro-bar .pb-sep{width:1px;align-self:stretch;background:var(--line)}
#tab-chart:fullscreen{background:var(--bg,#f4f6fa);overflow-y:auto}
/* Phones: like Toss, the chart sits right under the price and the tools follow it. */
@media (max-width:820px){html.chart-fs #tab-chart .chart-card{display:flex;flex-direction:column;gap:6px}
 html.chart-fs #tab-chart .chart-card>*{order:6}html.chart-fs #tab-chart .chart-head{display:contents}
 html.chart-fs #tab-chart .chart-head>div:first-child{order:0}html.chart-fs #tab-chart .chart-context{order:1}html.chart-fs #tab-chart .legend-line{order:2}
 html.chart-fs #tab-chart .chart-wrap,html.chart-fs #tab-chart .chart-card>#chart{order:3}
 html.chart-fs #tab-chart .chart-head>.seg,html.chart-fs #tab-chart .chart-head>.coin-tf,html.chart-fs #tab-chart .chart-head>.fine{order:4}
 html.chart-fs #tab-chart .pro-bar{order:5}html.chart-fs #tab-chart .chart-card>.fine{order:9}
 html.chart-fs #tab-chart .chart-head>.seg{overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;max-width:100%}}
@media (max-width:820px){.pro-bar{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:2px -12px 4px;padding:0 12px}.pro-bar::-webkit-scrollbar{display:none}.pro-bar>*{flex:none}.cfs-hint{display:none}
 html.chart-fs #tab-chart .chart-card{padding:8px 12px 12px}html.chart-fs #tab-chart #chart{height:max(300px,calc(100dvh - 290px))!important}}
@media (orientation:landscape) and (max-height:500px){html.chart-fs #tab-chart #chart{height:max(240px,calc(100dvh - 120px))!important}html.chart-fs #tab-chart .chart-head,html.chart-fs #tab-chart .fine{display:none}}
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

export const CHART_PRO_BAR = `<div class="pro-bar" role="toolbar" aria-label="차트 보기 도구"><div class="seg ct" role="group" aria-label="차트 종류">${TYPES.map(([k, l]) => `<button type="button" data-ct="${k}" aria-pressed="${k === 'candle'}" title="${l}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg><span>${l}</span></button>`).join('')}</div>
<div class="seg" role="group" aria-label="가격 축"><button type="button" data-scale="0" aria-pressed="true">가격</button><button type="button" data-scale="1" aria-pressed="false" title="로그 눈금: 오래 오른 종목을 비율로 봐요">로그</button><button type="button" data-scale="2" aria-pressed="false" title="화면 왼쪽 첫 봉 대비 %">%</button></div>
<button type="button" class="chip-toggle" data-hilo aria-pressed="true">최고·최저</button><button type="button" class="chip-toggle" data-magnet aria-pressed="false" title="십자선이 봉의 종가에 붙어요">자석 십자선</button><button type="button" class="chip-toggle" data-shot>사진 저장</button><button type="button" class="chip-toggle" data-land>가로로 보기</button></div>`;

/** G-141: period chips under the 요약 mini chart, Toss-style; the chart itself still opens the full-screen one. */
export const HERO_RANGE_JS = `
(function () {
  var won = function (v) { return (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + '원'; };
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
  var PREF = 'gnm-chart-pro', pref = { ct: 'candle', scale: 0, hilo: true, magnet: false };
  try { var sp = JSON.parse(localStorage.getItem(PREF) || 'null'); if (sp) for (var k in sp) pref[k] = sp[k]; } catch (e) {}
  var keep = function () { try { localStorage.setItem(PREF, JSON.stringify(pref)); } catch (e) {} };
  var toast = function (t) { if (window.GNM && GNM.toast) GNM.toast(t); };
  var mobile = window.matchMedia('(max-width: 820px)').matches;

  // ---- full-screen page: header with a back button, opened instead of a tab ----
  var title = (document.querySelector('.hero h1') || {}).textContent || document.title.split('|')[0];
  var head = document.createElement('div'); head.className = 'cfs-head';
  head.innerHTML = '<button type="button" class="cfs-back" aria-label="차트 닫기">‹</button><div class="cfs-t"><b></b><small>차트</small></div><span class="cfs-hint">Esc로 닫기</span>';
  head.querySelector('b').textContent = String(title).trim();
  panel.insertBefore(head, panel.firstChild);
  var panels = Array.prototype.slice.call(document.querySelectorAll('[role=tabpanel]'));
  var lastTab = 'tab-home', isOpen = false;
  var close = function () { history.back(); setTimeout(function () { if (!panel.hidden && window.GNM_showTab) GNM_showTab(lastTab.replace('tab-', '')); }, 250); };
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
      bar.querySelectorAll('[data-ct]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ct') === k)); });
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
      if (b.hasAttribute('data-ct')) setType(b.getAttribute('data-ct'));
      else if (b.hasAttribute('data-scale')) setScale(Number(b.getAttribute('data-scale')));
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
    var land = bar.querySelector('[data-land]'); land.textContent = mobile ? '가로로 보기' : '브라우저 전체 화면';
    document.addEventListener('fullscreenchange', function () { land.textContent = document.fullscreenElement ? '전체 화면 끝내기' : mobile ? '가로로 보기' : '브라우저 전체 화면'; setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 60); });
    bar.querySelector('[data-hilo]').setAttribute('aria-pressed', String(pref.hilo));
    if (pref.ct !== 'candle') setType(pref.ct); if (pref.scale) setScale(pref.scale); if (pref.magnet) setMagnet(true);
    window.GNM_chartPro = { type: setType, scale: setScale, view: function () { return view; }, extremes: ext };
  };
  // The free chart pages build GNMChart after their data arrives; try again until it exists.
  var tries = 0, poll = setInterval(function () { init(); if (G || ++tries > 60) clearInterval(poll); }, 500);
  window.addEventListener('DOMContentLoaded', init);
})();
`.replace(JSON.stringify('__BAR__'), JSON.stringify(CHART_PRO_BAR).replace(/</g, '\\u003c'));
