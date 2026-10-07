// Chart v6 (docs/DESIGN.md §5.12, G-43): drawing tools, a day/week/month switch and a comparison line,
// on top of the chart built by CHART_JS (which exposes window.GNMChart). Drawings are kept in the
// browser: not saved on the free plan, 10 stocks on Plus, unlimited from Pro.

const TOOLS: readonly [string, string, string][] = [
  ['trend', '추세선', '두 점을 눌러 선을 그어요'],
  ['hline', '수평선', '한 점을 눌러 가로선을 그어요'],
  ['rect', '박스', '두 꼭짓점을 눌러 구간을 표시해요'],
  ['fib', '피보나치', '고점과 저점을 차례로 눌러요'],
  ['note', '메모', '누른 자리에 글을 남겨요'],
  ['erase', '지우개', '지울 그림을 눌러요'],
];

const ICON: Record<string, string> = {
  trend: '<path d="M4 18L20 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="4" cy="18" r="2" fill="currentColor"/><circle cx="20" cy="6" r="2" fill="currentColor"/>',
  hline: '<path d="M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  rect: '<rect x="4" y="7" width="16" height="10" rx="1.5" fill="none" stroke="currentColor" stroke-width="2"/>',
  fib: '<path d="M4 5h16M4 9h16M4 13h16M4 19h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  note: '<path d="M5 5h14v10H10l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  erase: '<path d="M8 20h12M5 15l8-8 6 6-6 6H9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
};

/** Toolbar above the chart: timeframe, comparison and drawing tools. */
export function chartToolbar(hasBenchmark: boolean): string {
  const tool = ([k, label, hint]: readonly [string, string, string]) => `<button type="button" class="dt" data-draw="${k}" aria-pressed="false" title="${hint}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg><span>${label}</span></button>`;
  return `<div class="v6-bar"><div class="seg tf" role="group" aria-label="봉 단위"><button type="button" data-tf="D" aria-pressed="true">일봉</button><button type="button" data-tf="W" aria-pressed="false">주봉</button><button type="button" data-tf="M" aria-pressed="false">월봉</button></div>
${hasBenchmark ? '<button type="button" class="chip-toggle" data-compare aria-pressed="false">지수와 겹쳐 보기</button>' : ''}
<div class="draw-tools" role="toolbar" aria-label="그리기 도구">${TOOLS.map(tool).join('')}<button type="button" class="dt" data-draw-clear title="이 종목에 그린 것을 모두 지워요"><span>모두 지우기</span></button></div></div>
<p class="draw-note muted small" id="draw-note" aria-live="polite"></p>`;
}

export const CHART_V6_CSS = `
.coin-tf{max-width:100%;overflow-x:auto;flex-wrap:nowrap;white-space:nowrap}.coin-tf button{flex:none}.dt:disabled{opacity:.4;cursor:not-allowed}
.v6-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:6px 0}
.draw-tools{display:flex;flex-wrap:wrap;gap:4px;margin-left:auto}
.dt{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);background:#fff;border-radius:8px;padding:5px 8px;font:inherit;font-size:12px;font-weight:600;color:var(--fg2);cursor:pointer;min-height:32px}
.dt svg{width:16px;height:16px}.dt:hover{border-color:var(--accent)}.dt[aria-pressed=true]{background:var(--navy);border-color:var(--navy);color:#fff}
.draw-note{min-height:18px;margin:0 0 4px}
.chart-card.drawing #chart{cursor:crosshair}.chart-card.tf-agg #vlines,.chart-card.tf-agg #ev-strip,.chart-card.tf-agg #mark-pop{visibility:hidden}
@media (max-width:820px){.draw-tools{margin-left:0;overflow-x:auto;flex-wrap:nowrap;scrollbar-width:none;width:100%}.dt span{display:none}.dt[data-draw-clear] span{display:inline}}
`;

export const CHART_V6_JS = `
window.addEventListener('DOMContentLoaded', function () {
  var G = window.GNMChart; if (!G) return;
  var L = G.L, chart = G.chart, candle = G.candle, bars = G.bars;
  var card = document.getElementById('chart-card'), note = document.getElementById('draw-note');
  var symbol = card.getAttribute('data-symbol') || 'x', KEY = 'gnm-draw:' + symbol;
  var plan = function () { return document.documentElement.getAttribute('data-plan') || 'free'; };
  var say = function (t) { if (note) note.textContent = t; };

  // ---- drawings: a series primitive that paints every shape ----
  var shapes = [], preview = null, hidden = false;
  try { shapes = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { shapes = []; }
  var save = function () {
    if (plan() === 'free') { say('무료 요금제에서는 그린 것이 저장되지 않아요. 저장은 플러스부터예요.'); return; }
    try {
      if (plan() === 'plus' && !localStorage.getItem(KEY)) {
        var n = 0; for (var i = 0; i < localStorage.length; i++) if ((localStorage.key(i) || '').indexOf('gnm-draw:') === 0) n++;
        if (n >= 10) { say('플러스는 10종목까지 저장돼요. 프로부터 무제한이에요.'); return; }
      }
      if (shapes.length) localStorage.setItem(KEY, JSON.stringify(shapes)); else localStorage.removeItem(KEY);
    } catch (e) {}
  };
  var FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  var X = function (time) { var x = chart.timeScale().timeToCoordinate(time); return x == null ? null : x; };
  var Y = function (price) { var y = candle.priceToCoordinate(price); return y == null ? null : y; };
  var paint = function (ctx, s, w, r) {
    var x1 = X(s.a.t), y1 = Y(s.a.p), x2 = s.b ? X(s.b.t) : null, y2 = s.b ? Y(s.b.p) : null;
    if (x1 == null || y1 == null) return;
    ctx.save(); ctx.lineWidth = 2 * r; ctx.strokeStyle = s.c || '#0f2244'; ctx.fillStyle = s.c || '#0f2244'; ctx.font = (12 * r) + 'px sans-serif';
    if (s.k === 'trend' && x2 != null && y2 != null) { ctx.beginPath(); ctx.moveTo(x1 * r, y1 * r); ctx.lineTo(x2 * r, y2 * r); ctx.stroke(); }
    if (s.k === 'hline') { ctx.setLineDash([6 * r, 4 * r]); ctx.beginPath(); ctx.moveTo(0, y1 * r); ctx.lineTo(w, y1 * r); ctx.stroke(); ctx.setLineDash([]); ctx.fillText(Math.round(s.a.p).toLocaleString('ko-KR'), 6 * r, (y1 - 4) * r); }
    if (s.k === 'rect' && x2 != null && y2 != null) { ctx.globalAlpha = 0.12; ctx.fillRect(Math.min(x1, x2) * r, Math.min(y1, y2) * r, Math.abs(x2 - x1) * r, Math.abs(y2 - y1) * r); ctx.globalAlpha = 1; ctx.strokeRect(Math.min(x1, x2) * r, Math.min(y1, y2) * r, Math.abs(x2 - x1) * r, Math.abs(y2 - y1) * r); }
    if (s.k === 'fib' && s.b) {
      FIB.forEach(function (f) { var p = s.b.p + (s.a.p - s.b.p) * f, y = Y(p); if (y == null) return; ctx.globalAlpha = f === 0 || f === 1 ? 1 : 0.7; ctx.beginPath(); ctx.moveTo(Math.min(x1, x2 == null ? x1 : x2) * r, y * r); ctx.lineTo(w, y * r); ctx.stroke(); ctx.fillText((f * 100).toFixed(1) + '%  ' + Math.round(p).toLocaleString('ko-KR'), (Math.min(x1, x2 == null ? x1 : x2) + 4) * r, (y - 3) * r); });
      ctx.globalAlpha = 1;
    }
    if (s.k === 'note') { var t = String(s.text || ''); var tw = ctx.measureText(t).width; ctx.globalAlpha = 0.92; ctx.fillStyle = '#fff3d6'; ctx.fillRect(x1 * r, (y1 - 18) * r, tw + 12 * r, 20 * r); ctx.globalAlpha = 1; ctx.fillStyle = '#5b3d00'; ctx.fillText(t, x1 * r + 6 * r, (y1 - 4) * r); }
    ctx.restore();
  };
  var primitive = {
    _req: null,
    attached: function (p) { this._req = p.requestUpdate; },
    detached: function () {},
    updateAllViews: function () {},
    paneViews: function () { return [{ zOrder: function () { return 'top'; }, renderer: function () { return { draw: function (target) {
      if (hidden) return;
      target.useBitmapCoordinateSpace(function (scope) { var all = shapes.concat(preview ? [preview] : []); all.forEach(function (s) { paint(scope.context, s, scope.bitmapSize.width, scope.horizontalPixelRatio); }); });
    } }; } }]; },
  };
  candle.attachPrimitive(primitive);
  var redraw = function () { if (primitive._req) primitive._req(); };

  var mode = null, first = null;
  var setMode = function (k) {
    mode = mode === k ? null : k; first = null; preview = null; redraw();
    document.querySelectorAll('[data-draw]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-draw') === mode)); });
    card.classList.toggle('drawing', !!mode);
    var hint = { trend: '첫 점을 누르세요.', hline: '가로선을 둘 가격을 누르세요.', rect: '첫 꼭짓점을 누르세요.', fib: '고점을 누르세요.', note: '메모를 둘 자리를 누르세요.', erase: '지울 그림을 누르세요.' };
    say(mode ? hint[mode] : '');
  };
  document.querySelectorAll('[data-draw]').forEach(function (b) { b.addEventListener('click', function () { if (tf !== 'D') { say('그리기는 일봉에서 쓸 수 있어요.'); return; } setMode(b.getAttribute('data-draw')); }); });
  var clear = document.querySelector('[data-draw-clear]');
  if (clear) clear.addEventListener('click', function () { if (!shapes.length) return; if (!confirm('이 종목에 그린 것을 모두 지울까요?')) return; shapes = []; save(); redraw(); say('모두 지웠어요.'); });
  var at = function (param) { if (!param || !param.time || !param.point) return null; var p = candle.coordinateToPrice(param.point.y); return p == null ? null : { t: param.time, p: p }; };
  var near = function (pt) {
    var best = -1, bd = 10;
    shapes.forEach(function (s, i) {
      var x1 = X(s.a.t), y1 = Y(s.a.p), x2 = s.b ? X(s.b.t) : x1, y2 = s.b ? Y(s.b.p) : y1; if (x1 == null || y1 == null) return;
      var d;
      if (s.k === 'hline') d = Math.abs(pt.y - y1);
      else if (s.k === 'rect' || s.k === 'fib' || s.k === 'note') d = (pt.x >= Math.min(x1, x2) - 6 && pt.x <= Math.max(x1, x2, x1 + 80) + 6 && pt.y >= Math.min(y1, y2) - 20 && pt.y <= Math.max(y1, y2) + 6) ? 0 : 99;
      else { var dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((pt.x - x1) * dx + (pt.y - y1) * dy) / l)); d = Math.hypot(pt.x - (x1 + u * dx), pt.y - (y1 + u * dy)); }
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  // A quick second click arrives as a double click (no click event), so both go to the same handler.
  var onClick = function (param) {
    if (!mode) return;
    if (mode === 'erase') { var i = param && param.point ? near(param.point) : -1; if (i >= 0) { shapes.splice(i, 1); save(); redraw(); say('지웠어요.'); } return; }
    var pt = at(param); if (!pt) return;
    if (mode === 'hline') { shapes.push({ k: 'hline', a: pt }); save(); redraw(); say('가로선을 그렸어요.'); return; }
    if (mode === 'note') { var text = prompt('메모'); if (text) { shapes.push({ k: 'note', a: pt, text: text.slice(0, 60) }); save(); redraw(); } return; }
    if (!first) { first = pt; say(mode === 'fib' ? '저점을 누르세요.' : '두 번째 점을 누르세요.'); return; }
    shapes.push({ k: mode, a: first, b: pt }); first = null; preview = null; save(); redraw(); say('그렸어요. 이어서 그리거나 도구를 다시 눌러 끄세요.');
  };
  chart.subscribeClick(onClick);
  if (chart.subscribeDblClick) chart.subscribeDblClick(onClick);
  chart.subscribeCrosshairMove(function (param) { if (!mode || !first) return; var pt = at(param); if (!pt) return; preview = { k: mode, a: first, b: pt, c: '#8fa5c3' }; redraw(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mode) setMode(mode); });

  // ---- day / week / month ----
  var tf = 'D', saved = [];
  var bucket = function (date, k) { if (k === 'M') return date.slice(0, 7) + '-01'; var d = new Date(date + 'T00:00:00Z'); var wd = (d.getUTCDay() + 6) % 7; return new Date(d.getTime() - wd * 86400000).toISOString().slice(0, 10); };
  var aggregate = function (k) {
    var out = [], cur = null;
    bars.forEach(function (b) { var key = bucket(b.date, k); if (!cur || cur.time !== key) { cur = { time: key, open: b.open, high: b.high, low: b.low, close: b.close }; out.push(cur); } else { cur.high = Math.max(cur.high, b.high); cur.low = Math.min(cur.low, b.low); cur.close = b.close; } });
    return out;
  };
  var setTf = function (k) {
    if (k === tf) return;
    if (mode) setMode(mode);
    document.querySelectorAll('[data-tf]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tf') === k)); });
    if (tf === 'D') saved = G.series().filter(function (s) { return s !== candle; }).map(function (s) { var v = s.options().visible !== false; s.applyOptions({ visible: false }); return [s, v]; });
    if (k === 'D') {
      candle.setData(bars.map(function (b) { return { time: b.date, open: b.open, high: b.high, low: b.low, close: b.close }; }));
      saved.forEach(function (x) { x[0].applyOptions({ visible: x[1] }); }); saved = []; hidden = false; if(window.GNM_scenarioPause)GNM_scenarioPause(false);
      var r = document.querySelector('[data-range][aria-pressed=true]'); if (r) r.click();
    } else {
      candle.setData(aggregate(k)); hidden = true; if(window.GNM_scenarioPause)GNM_scenarioPause(true); chart.timeScale().fitContent();
      say(k === 'W' ? '주봉이에요. 지표·전략·그림은 일봉에서 보여요.' : '월봉이에요. 지표·전략·그림은 일봉에서 보여요.');
    }
    document.querySelectorAll('[data-range]').forEach(function (b) { b.disabled = k !== 'D'; });
    card.classList.toggle('tf-agg', k !== 'D');
    document.querySelectorAll('[data-ov],[data-pane],[data-vl],[data-sc],[data-strategy],[data-open="strat-sheet"],#ind-reset,[data-draw],[data-draw-clear],[data-compare]').forEach(function(b){b.disabled=k!=='D';});
    tf = k; redraw();
  };
  document.querySelectorAll('[data-tf]').forEach(function (b) { b.addEventListener('click', function () { setTf(b.getAttribute('data-tf')); }); });

  // ---- comparison with the index (both as % change from the first visible bar) ----
  var cmp = document.querySelector('[data-compare]'), lines = null;
  if (cmp) cmp.addEventListener('click', function () {
    var on = cmp.getAttribute('aria-pressed') !== 'true'; cmp.setAttribute('aria-pressed', String(on));
    if (!on) { if (lines) lines.forEach(function (s) { chart.removeSeries(s); }); lines = null; say(''); return; }
    var bm = (JSON.parse(document.getElementById('benchmarks').textContent) || [])[0]; if (!bm) return;
    var opts = { priceScaleId: 'cmp', lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false };
    var me = chart.addSeries(L.LineSeries, Object.assign({ color: '#d97706', title: '이 종목' }, opts)); me.setData(bars.map(function (b) { return { time: b.date, value: b.close }; }));
    var idx = chart.addSeries(L.LineSeries, Object.assign({ color: '#00968a', title: bm.name }, opts)); idx.setData(bm.series.map(function (x) { return { time: x[0], value: x[1] }; }));
    chart.priceScale('cmp').applyOptions({ mode: 2, visible: true, borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.25 } });
    chart.applyOptions({ leftPriceScale: { visible: false } });
    lines = [me, idx];
    say('주황은 이 종목, 청록은 ' + bm.name + '이에요. 화면 왼쪽 첫 봉 대비 등락률(%)로 겹쳐 보여요.');
  });
});
`;
