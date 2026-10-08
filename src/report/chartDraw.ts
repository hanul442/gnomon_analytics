// G-145: drawing tools v7 — what people expect from a chart app before they stop opening another one.
// Phones get a Toss-style tool row under the chart (draw with a finger: drag, or tap point by point, with a
// floating price/date tip above the finger); wide screens get a TradingView-style tool bar on the left of the
// chart with keyboard shortcuts. Shapes are anchored to (bar date, price), with an offset in bars past the last
// one for points drawn into the future, so they stay put across zoom and later sessions.
//
// Tools: lines (trend, ray, extended, horizontal, horizontal ray, vertical, parallel channel, arrow), Fibonacci and
// Gann (retracement, trend-based extension, time zones, fan), measure and positions (price/time range, long, short
// with entry, target and stop), shapes and text (box, text, callout, up/down marks, pen). A selected shape gets a
// small floating bar: colour, width, dashed, lock, copy, delete (and edit text). Undo/redo, magnet (snap to the
// bar's open/high/low/close), hide all, lock all, clear all (undoable — no confirm box).
//
// Saving: on this device for everyone; following the account to other devices is a paid feature (alpha.ts
// leaves gnm-draw:* out of the sync for the free plan, the API refuses them too).

type Tool = { key: string; label: string; n: number; hint: string; icon: string };
const I = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const L = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
export const DRAW_GROUPS: { key: string; label: string; tools: Tool[] }[] = [
  { key: 'line', label: '선', tools: [
    { key: 'trend', label: '추세선', n: 2, hint: '시작점을 누르거나 끌어서 그려요', icon: I(`<path ${L} d="M4 19L20 5"/><circle cx="4" cy="19" r="1.8" fill="currentColor"/><circle cx="20" cy="5" r="1.8" fill="currentColor"/>`) },
    { key: 'ray', label: '레이', n: 2, hint: '시작점과 방향을 정해요. 오른쪽 끝까지 이어져요', icon: I(`<path ${L} d="M4 18L22 6"/><circle cx="4" cy="18" r="1.8" fill="currentColor"/>`) },
    { key: 'ext', label: '연장선', n: 2, hint: '두 점을 지나 양쪽 끝까지 이어져요', icon: I(`<path ${L} d="M2 20L22 4"/><circle cx="8" cy="15" r="1.8" fill="currentColor"/><circle cx="16" cy="9" r="1.8" fill="currentColor"/>`) },
    { key: 'hline', label: '수평선', n: 1, hint: '가로선을 둘 가격을 눌러요', icon: I(`<path ${L} d="M2 12h20"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>`) },
    { key: 'hray', label: '수평 레이', n: 1, hint: '여기서부터 오른쪽으로 가로선을 그어요', icon: I(`<path ${L} d="M6 12h16"/><circle cx="6" cy="12" r="1.8" fill="currentColor"/>`) },
    { key: 'vline', label: '수직선', n: 1, hint: '날짜를 눌러 세로선을 그어요', icon: I(`<path ${L} d="M12 2v20"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>`) },
    { key: 'channel', label: '평행 채널', n: 3, hint: '두 점으로 선을 긋고 세 번째 점으로 폭을 정해요', icon: I(`<path ${L} d="M3 15L15 5M9 19L21 9"/>`) },
    { key: 'arrow', label: '화살표 선', n: 2, hint: '시작점에서 끝점으로 화살표를 그어요', icon: I(`<path ${L} d="M4 20L19 5M12 5h7v7"/>`) },
  ] },
  { key: 'fib', label: '피보나치', tools: [
    { key: 'fib', label: '피보나치 되돌림', n: 2, hint: '고점(또는 저점)에서 반대쪽 끝까지 이어요', icon: I(`<path ${L} d="M3 5h18M3 9h18M3 13h18M3 19h18"/>`) },
    { key: 'fibext', label: '피보나치 확장', n: 3, hint: '추세 시작·끝·되돌림 지점을 차례로 눌러요', icon: I(`<path ${L} d="M3 18l6-10 4 6M13 4h8M13 9h8M13 14h8"/>`) },
    { key: 'fibtime', label: '피보나치 시간대', n: 2, hint: '시작 봉과 한 칸 길이를 정해요', icon: I(`<path ${L} d="M4 3v18M7 3v18M10 3v18M15 3v18M22 3v18"/>`) },
    { key: 'gann', label: '갠 팬', n: 2, hint: '기준점과 1×1 선이 지날 점을 정해요', icon: I(`<path ${L} d="M3 21L21 3M3 21L21 11M3 21L13 3M3 21h18"/>`) },
  ] },
  { key: 'measure', label: '측정', tools: [
    { key: 'measure', label: '가격·기간 측정', n: 2, hint: '두 점 사이의 가격 차이·등락률·봉 수를 재요', icon: I(`<path ${L} d="M4 20V8h16M4 20h16V8M8 14h8M12 10v8"/>`) },
    { key: 'long', label: '롱 포지션', n: 2, hint: '진입가를 누르고 목표가로 끌어요. 손절선은 끌어서 옮겨요', icon: I(`<path fill="#1b9e5a" opacity=".35" d="M4 4h16v8H4z"/><path fill="#d1373d" opacity=".35" d="M4 12h16v6H4z"/><path ${L} d="M4 12h16"/>`) },
    { key: 'short', label: '숏 포지션', n: 2, hint: '진입가를 누르고 목표가로 끌어요. 손절선은 끌어서 옮겨요', icon: I(`<path fill="#d1373d" opacity=".35" d="M4 6h16v6H4z"/><path fill="#1b9e5a" opacity=".35" d="M4 12h16v8H4z"/><path ${L} d="M4 12h16"/>`) },
  ] },
  { key: 'shape', label: '도형·글', tools: [
    { key: 'rect', label: '박스', n: 2, hint: '두 꼭짓점으로 구간을 표시해요', icon: I(`<rect x="4" y="6" width="16" height="12" rx="1.5" ${L}/>`) },
    { key: 'text', label: '텍스트', n: 1, hint: '글을 둘 자리를 누르고 바로 입력해요', icon: I(`<path ${L} d="M5 6V4h14v2M12 4v16M9 20h6"/>`) },
    { key: 'note', label: '메모', n: 1, hint: '말풍선을 둘 자리를 누르고 입력해요', icon: I(`<path ${L} d="M4 5h16v10H10l-5 4V5z"/>`) },
    { key: 'up', label: '위 표시', n: 1, hint: '매수·반등 자리를 표시해요', icon: I(`<path fill="#d1373d" d="M12 4l7 10h-4v6H9v-6H5z"/>`) },
    { key: 'down', label: '아래 표시', n: 1, hint: '매도·하락 자리를 표시해요', icon: I(`<path fill="#2a62c9" d="M12 20l7-10h-4V4H9v6H5z"/>`) },
    { key: 'brush', label: '펜', n: 0, hint: '손가락이나 마우스로 자유롭게 그려요', icon: I(`<path ${L} d="M3 17c3-6 6 2 9-4s6-2 9-8"/>`) },
  ] },
];

const ICON = {
  magnet: I(`<path ${L} d="M6 4v8a6 6 0 0012 0V4M6 8h4M14 8h4"/>`),
  undo: I(`<path ${L} d="M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2"/>`),
  redo: I(`<path ${L} d="M15 7l5 5-5 5M20 12H9a5 5 0 000 10h2"/>`),
  eye: I(`<path ${L} d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" ${L}/>`),
  lock: I(`<rect x="5" y="11" width="14" height="9" rx="2" ${L}/><path ${L} d="M8 11V8a4 4 0 018 0v3"/>`),
  trash: I(`<path ${L} d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>`),
  copy: I(`<rect x="8" y="8" width="12" height="12" rx="2" ${L}/><path ${L} d="M16 8V4H4v12h4"/>`),
  cursor: I(`<path fill="currentColor" d="M5 3l14 8-6 2-2 6z"/>`),
};

/** The toolbar: group buttons (with the tools of the open group in .dw-tools), then the toggles. */
export function drawToolbar(): string {
  const group = (g: (typeof DRAW_GROUPS)[number]) => `<button type="button" class="dw-b dw-g" data-dw-group="${g.key}" aria-expanded="false" title="${g.label}">${g.tools[0]!.icon}<span>${g.label}</span><i class="dw-chev" aria-hidden="true"></i></button>`;
  const t = (k: string, label: string, icon: string, extra = '') => `<button type="button" class="dw-b" data-dw="${k}" title="${label}"${extra}>${icon}<span>${label}</span></button>`;
  return `<div class="dw" id="dw" role="toolbar" aria-label="그리기 도구"><button type="button" class="dw-b" data-dw="select" aria-pressed="true" title="선택 (Esc)">${ICON.cursor}<span>선택</span></button>${DRAW_GROUPS.map(group).join('')}<i class="dw-sep" aria-hidden="true"></i>${t('magnet', '자석', ICON.magnet, ' aria-pressed="false"')}${t('undo', '되돌리기', ICON.undo)}${t('redo', '다시 하기', ICON.redo)}${t('hideall', '모두 숨기기', ICON.eye, ' aria-pressed="false"')}${t('lockall', '모두 잠금', ICON.lock, ' aria-pressed="false"')}${t('clear', '모두 지우기', ICON.trash)}</div><div class="dw-tools" id="dw-tools" role="group" aria-label="도구 고르기" hidden></div>`;
}

export const CHART_DRAW_CSS = `
.dw{display:flex;gap:4px;align-items:center;overflow-x:auto;scrollbar-width:none;padding:6px 0;-webkit-overflow-scrolling:touch}.dw::-webkit-scrollbar{display:none}
.dw-b{flex:none;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:52px;min-height:48px;padding:4px 6px;border:0;border-radius:12px;background:transparent;color:var(--fg2);font:inherit;font-size:11px;font-weight:700;cursor:pointer;position:relative}
.dw-b svg{width:22px;height:22px}.dw-b:hover{background:#eef2f8}.dw-b[aria-pressed=true],.dw-b.on{background:#e6edfb;color:#1d4ed8}.dw-b:disabled{opacity:.35;cursor:not-allowed}
.dw-chev{position:absolute;right:4px;bottom:4px;width:5px;height:5px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);opacity:.6}
.dw-sep{flex:none;width:1px;height:28px;background:var(--line);margin:0 4px}
.dw-tools{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding:4px;background:#f4f6fb;border-radius:14px;margin:0 0 6px}.dw-tools::-webkit-scrollbar{display:none}
.dw-tools .dw-b{min-width:64px;background:#fff;border:1px solid var(--line)}.dw-tools .dw-b span{white-space:nowrap}
.dw-hint{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#0f2244;color:#fff;border-radius:12px;padding:8px 12px;font-size:13px;margin:0 0 6px}.dw-hint[hidden]{display:none}.dw-hint button{border:0;background:rgba(255,255,255,.18);color:#fff;font:inherit;font-weight:700;border-radius:8px;padding:6px 12px;cursor:pointer;min-height:36px}
.dw-cap{position:absolute;left:0;top:0;z-index:4;touch-action:none;cursor:crosshair}.dw-cap[hidden]{display:none}
.dw-tip{position:absolute;z-index:6;pointer-events:none;background:#0f2244;color:#fff;border-radius:8px;padding:4px 8px;font-size:12px;font-weight:700;white-space:nowrap;transform:translate(-50%,-100%)}.dw-tip[hidden]{display:none}
.dw-edit{position:absolute;z-index:7;left:50%;top:8px;transform:translateX(-50%);display:flex;align-items:center;gap:2px;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 6px 20px rgba(15,34,68,.16);padding:4px;max-width:calc(100% - 16px);overflow-x:auto;scrollbar-width:none}.dw-edit[hidden]{display:none}
.dw-edit button{flex:none;min-width:40px;min-height:40px;border:0;background:transparent;border-radius:10px;cursor:pointer;display:grid;place-items:center;font:inherit;font-size:12px;font-weight:800;color:var(--fg2)}.dw-edit button:hover{background:#eef2f8}.dw-edit button[aria-pressed=true]{background:#e6edfb;color:#1d4ed8}.dw-edit svg{width:20px;height:20px}
.dw-edit .sw{width:22px;height:22px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px var(--line)}.dw-edit button[aria-pressed=true] .sw{box-shadow:0 0 0 2px #1d4ed8}
.dw-input{position:absolute;z-index:8;min-width:140px;font:inherit;font-size:14px;padding:8px 10px;border:2px solid #1d4ed8;border-radius:10px;background:#fff;box-shadow:0 6px 20px rgba(15,34,68,.18)}
.chart-body{position:relative}
@media (min-width:821px){html.chart-fs #tab-chart .chart-wrap{display:grid;grid-template-columns:52px minmax(0,1fr);grid-template-rows:auto minmax(0,1fr) auto;grid-template-areas:"dw ev" "dw body" "dw pop";column-gap:6px}
 html.chart-fs #tab-chart .chart-wrap>.dw{grid-area:dw;flex-direction:column;align-self:start;overflow-y:auto;overflow-x:visible;max-height:100%;background:#fff;border:1px solid var(--line);border-radius:16px;padding:6px 4px}
 html.chart-fs #tab-chart .chart-wrap>.dw .dw-sep{width:28px;height:1px;margin:4px 0}html.chart-fs #tab-chart .chart-wrap>.dw>.dw-b{min-width:42px;min-height:40px;padding:2px}html.chart-fs #tab-chart .chart-wrap>.dw>.dw-b span{display:none}html.chart-fs #tab-chart .chart-wrap>.ev-strip{grid-area:ev}html.chart-fs #tab-chart .chart-wrap>.chart-body{grid-area:body}html.chart-fs #tab-chart .chart-wrap>.mark-pop{grid-area:pop}
 html.chart-fs #tab-chart .chart-wrap>.dw-tools{position:absolute;z-index:9;left:60px;flex-direction:column;align-items:stretch;background:#fff;border:1px solid var(--line);box-shadow:0 10px 30px rgba(15,34,68,.18);border-radius:14px;padding:6px;width:200px}
 html.chart-fs #tab-chart .chart-wrap>.dw-tools .dw-b{flex-direction:row;justify-content:flex-start;gap:10px;font-size:13px;min-height:40px;border:0;background:transparent}html.chart-fs #tab-chart .chart-wrap>.dw-tools .dw-b:hover{background:#eef2f8}
 html.chart-fs #tab-chart .chart-wrap{position:relative}html.chart-fs #tab-chart .dw-b kbd{margin-left:auto;font:inherit;font-size:11px;color:var(--muted)}}
@media (max-width:820px){.dw-b kbd{display:none}.dw>[data-dw]:not([data-dw=select]) span{display:none}.dw>[data-dw]:not([data-dw=select]){min-width:44px}.dw-b{min-height:44px}}
`;

export const CHART_DRAW_JS = `
(function () {
  var GROUPS = ${JSON.stringify(DRAW_GROUPS.map((g) => ({ key: g.key, label: g.label, tools: g.tools })))};
  var TOOL = {}; GROUPS.forEach(function (g) { g.tools.forEach(function (t) { t.g = g.key; TOOL[t.key] = t; }); });
  var KEYS = { t: 'trend', h: 'hline', v: 'vline', f: 'fib', c: 'channel', r: 'rect', m: 'measure', l: 'long', s: 'short', x: 'text', p: 'brush' };
  var COLORS = ['#2563eb', '#d1373d', '#16a34a', '#f59e0b', '#7c3aed', '#0f2244'];
  var FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1], FIBX = [0, 0.618, 1, 1.272, 1.618, 2, 2.618], FIBT = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89], GANN = [[8, '1×8'], [4, '1×4'], [3, '1×3'], [2, '1×2'], [1, '1×1'], [0.5, '2×1'], [1 / 3, '3×1'], [0.25, '4×1'], [0.125, '8×1']];
  var G = null;
  var init = function () {
    var g = window.GNMChart; if (!g || g === G || !g.candle) return;
    var panel = document.getElementById('tab-chart'), host = document.getElementById('chart'); if (!panel || !host || !panel.contains(host)) return;
    G = g;
    // Same structure on every page: .chart-wrap > [tools, .chart-body > #chart] (free pages have a bare #chart).
    if (!host.parentElement.classList.contains('chart-body')) { var cb = document.createElement('div'); cb.className = 'chart-body'; host.parentElement.insertBefore(cb, host); cb.appendChild(host); }
    if (!host.closest('.chart-wrap')) { var cw = document.createElement('div'); cw.className = 'chart-wrap'; var cbd = host.parentElement; cbd.parentElement.insertBefore(cw, cbd); cw.appendChild(cbd); }
    var chart = g.chart, candle = g.candle, ts = chart.timeScale(), body = host.parentElement;
    var params = new URLSearchParams(location.search), card = panel.querySelector('.chart-card');
    var sym = ((card && card.getAttribute('data-symbol')) || params.get('c') || params.get('m') || params.get('s') || 'x').toUpperCase(), KEY = 'gnm-draw:' + sym;
    var plan = function () { return document.documentElement.getAttribute('data-plan') || 'free'; };
    var toast = function (t) { if (window.GNM && GNM.toast) GNM.toast(t); };
    // ---- mount: toolbar, hint, capture layer, tip, edit bar ----
    var old = panel.querySelector('.draw-tools'); if (old) old.remove();
    var oldClear = panel.querySelector('[data-draw-clear]'); if (oldClear) oldClear.remove();
    var wrap = host.closest('.chart-wrap');
    var tmp = document.createElement('div'); tmp.innerHTML = ${JSON.stringify(drawToolbar())};
    var bar = tmp.firstElementChild, tools = tmp.lastElementChild;
    wrap.insertBefore(bar, wrap.firstChild); wrap.insertBefore(tools, bar.nextSibling);
    var hintEl = document.createElement('div'); hintEl.className = 'dw-hint'; hintEl.hidden = true; hintEl.innerHTML = '<span></span><button type="button">취소</button>';
    wrap.parentElement.insertBefore(hintEl, wrap);
    var cap = document.createElement('div'); cap.className = 'dw-cap'; cap.hidden = true; body.appendChild(cap);
    var tip = document.createElement('div'); tip.className = 'dw-tip'; tip.hidden = true; body.appendChild(tip);
    var edit = document.createElement('div'); edit.className = 'dw-edit'; edit.hidden = true; edit.setAttribute('role', 'toolbar'); edit.setAttribute('aria-label', '그림 편집'); body.appendChild(edit);

    // ---- state ----
    var shapes = [], sel = -1, tool = null, draft = null, step = 0, magnet = false, hideAll = false, suspended = false, undo = [], redo = [], drag = null, lastGroupTool = {};
    try { shapes = JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { shapes = []; }
    // v6 shapes: {k, a:{t,p}, b:{t,p}, c, text}
    shapes = shapes.map(function (s) { return s.pts ? s : { k: s.k === 'note' ? 'note' : s.k, pts: [s.a].concat(s.b ? [s.b] : []), st: { c: s.c || '#2563eb', w: 2 }, text: s.text }; }).filter(function (s) { return TOOL[s.k] && s.pts && s.pts.length; });
    try { magnet = localStorage.getItem('gnm-draw-magnet') === '1'; } catch (e) {}
    var saveHint = false;
    var save = function () {
      try { if (shapes.length) localStorage.setItem(KEY, JSON.stringify(shapes)); else localStorage.removeItem(KEY); } catch (e) { toast('그림을 저장하지 못했어요. 기기 저장 공간을 확인해 주세요.'); }
      if (!saveHint && plan() === 'free' && shapes.length) { saveHint = true; try { if (!localStorage.getItem('gnm-draw-hint')) { localStorage.setItem('gnm-draw-hint', '1'); toast('그림은 이 기기에 저장돼요. 다른 기기와 동기화는 플러스부터예요.'); } } catch (e) {} }
    };
    var snap = function () { return JSON.stringify(shapes); };
    var commit = function (before) { undo.push(before); if (undo.length > 60) undo.shift(); redo = []; save(); paint(); };

    // ---- coordinates ----
    var data = function () { try { return candle.data(); } catch (e) { return []; } };
    var idxOf = function (t) { var d = data(); for (var i = d.length - 1; i >= 0; i--) if (JSON.stringify(d[i].time) === JSON.stringify(t)) return i; return -1; };
    var X = function (pt) {
      if (pt.t != null) { var x = ts.timeToCoordinate(pt.t); if (x != null) return x; var i = idxOf(pt.t); if (i >= 0) return ts.logicalToCoordinate(i); }
      if (pt.d != null) return ts.logicalToCoordinate(data().length - 1 + pt.d);
      return null;
    };
    var Y = function (pt) { var y = candle.priceToCoordinate(pt.p); return y == null ? null : y; };
    var paneH = function () { try { return chart.panes()[0].getHeight(); } catch (e) { return host.clientHeight; } };
    var paneW = function () { try { return host.clientWidth - chart.priceScale('right').width(); } catch (e) { return host.clientWidth - 60; } };
    var fromXY = function (x, y) {
      var d = data(), n = d.length - 1, l = ts.coordinateToLogical(x); if (l == null || n < 0) return null;
      var p = candle.coordinateToPrice(y); if (p == null) return null;
      var i = Math.round(l), pt;
      if (i <= n) { i = Math.max(0, i); pt = { t: d[i].time, p: p };
        if (magnet && d[i].open != null) { var best = null, bd = 28; ['open', 'high', 'low', 'close'].forEach(function (k) { var yy = candle.priceToCoordinate(d[i][k]); if (yy != null && Math.abs(yy - y) < bd) { bd = Math.abs(yy - y); best = d[i][k]; } }); if (best != null) pt.p = best; }
      } else pt = { t: null, d: i - n, p: p };
      return pt;
    };
    var won = function (v) { var usd = document.documentElement.getAttribute('data-ccy') === 'USD'; if (usd) return '$' + v.toFixed(2); var a = Math.abs(v); return a >= 1000 ? Math.round(v).toLocaleString('ko-KR') : a >= 1 ? v.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : v.toLocaleString('ko-KR', { maximumFractionDigits: 6 }); };
    var dayOf = function (pt) { if (pt.t == null) return '+' + pt.d + '봉'; var t = pt.t; if (typeof t === 'object' && t.year) return t.month + '/' + t.day; var s = String(t); return /^\\d{4}-/.test(s) ? Number(s.slice(5, 7)) + '/' + Number(s.slice(8, 10)) : s; };
    var barsBetween = function (a, b) { var xa = X(a), xb = X(b); if (xa == null || xb == null) return 0; var la = ts.coordinateToLogical(xa), lb = ts.coordinateToLogical(xb); return la == null || lb == null ? 0 : Math.round(lb - la); };

    // ---- painting ----
    var hexA = function (c, a) { var n = parseInt(c.slice(1), 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; };
    var label = function (ctx, r, text, x, y, color, align, boxed) {
      ctx.font = '600 ' + (11.5 * r) + 'px sans-serif'; var w = ctx.measureText(text).width, h = 16 * r, px = align === 'right' ? x - w - 8 * r : align === 'center' ? x - w / 2 - 4 * r : x + 4 * r;
      if (boxed) { ctx.fillStyle = color; ctx.globalAlpha = 0.92; ctx.fillRect(px - 4 * r, y - h / 2 - 1 * r, w + 8 * r, h + 2 * r); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; } else ctx.fillStyle = color;
      ctx.textBaseline = 'middle'; ctx.fillText(text, px, y);
    };
    var edgeLine = function (x1, y1, x2, y2, W, H, both) {
      var dx = x2 - x1, dy = y2 - y1; if (!dx && !dy) return [x1, y1, x2, y2];
      var k = 1e4 / Math.max(Math.abs(dx), Math.abs(dy), 1e-6), ex = x2 + dx * k, ey = y2 + dy * k;
      return both ? [x1 - dx * k, y1 - dy * k, ex, ey] : [x1, y1, ex, ey];
    };
    var drawShape = function (ctx, s, r, W, H, selected) {
      var P = s.pts.map(function (pt) { return [X(pt), Y(pt)]; }); if (P.some(function (p) { return p[0] == null || p[1] == null; })) return;
      var c = (s.st && s.st.c) || '#2563eb', lw = ((s.st && s.st.w) || 2) * r;
      ctx.save(); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw; ctx.setLineDash(s.st && s.st.dash ? [6 * r, 4 * r] : []);
      var line = function (a, b) { ctx.beginPath(); ctx.moveTo(a[0] * r, a[1] * r); ctx.lineTo(b[0] * r, b[1] * r); ctx.stroke(); };
      var A = P[0], B = P[1] || P[0], k = s.k;
      if (k === 'trend' || k === 'arrow') { line(A, B); if (k === 'arrow') { var ang = Math.atan2(B[1] - A[1], B[0] - A[0]), al = 12; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(B[0] * r, B[1] * r); ctx.lineTo((B[0] - al * Math.cos(ang - 0.45)) * r, (B[1] - al * Math.sin(ang - 0.45)) * r); ctx.lineTo((B[0] - al * Math.cos(ang + 0.45)) * r, (B[1] - al * Math.sin(ang + 0.45)) * r); ctx.closePath(); ctx.fill(); }
        if (selected && s.pts[1]) { var pc = (s.pts[1].p / s.pts[0].p - 1) * 100; label(ctx, r, (pc > 0 ? '+' : '') + pc.toFixed(2) + '% · ' + barsBetween(s.pts[0], s.pts[1]) + '봉', B[0] * r, (B[1] - 14) * r, c, 'center', true); } }
      else if (k === 'ray' || k === 'ext') { var e = edgeLine(A[0], A[1], B[0], B[1], W, H, k === 'ext'); line([e[0], e[1]], [e[2], e[3]]); }
      else if (k === 'hline' || k === 'hray') { line([k === 'hline' ? 0 : A[0], A[1]], [W / r, A[1]]); label(ctx, r, won(s.pts[0].p), W - 4 * r, A[1] * r - 10 * r, c, 'right', true); }
      else if (k === 'vline') { line([A[0], 0], [A[0], H / r]); label(ctx, r, dayOf(s.pts[0]), A[0] * r, H - 12 * r, c, 'center', true); }
      else if (k === 'channel') { line(A, B); if (P[2]) { var t2 = (P[2][0] - A[0]) / ((B[0] - A[0]) || 1), yl = A[1] + (B[1] - A[1]) * t2, off = P[2][1] - yl; line([A[0], A[1] + off], [B[0], B[1] + off]); ctx.setLineDash([4 * r, 4 * r]); ctx.globalAlpha = 0.6; line([A[0], A[1] + off / 2], [B[0], B[1] + off / 2]); ctx.globalAlpha = 0.08; ctx.beginPath(); ctx.moveTo(A[0] * r, A[1] * r); ctx.lineTo(B[0] * r, B[1] * r); ctx.lineTo(B[0] * r, (B[1] + off) * r); ctx.lineTo(A[0] * r, (A[1] + off) * r); ctx.closePath(); ctx.fill(); } }
      else if (k === 'rect') { ctx.globalAlpha = 0.12; ctx.fillRect(Math.min(A[0], B[0]) * r, Math.min(A[1], B[1]) * r, Math.abs(B[0] - A[0]) * r, Math.abs(B[1] - A[1]) * r); ctx.globalAlpha = 1; ctx.strokeRect(Math.min(A[0], B[0]) * r, Math.min(A[1], B[1]) * r, Math.abs(B[0] - A[0]) * r, Math.abs(B[1] - A[1]) * r); }
      else if (k === 'fib' && P[1]) { var x0 = Math.min(A[0], B[0]); FIB.forEach(function (f, i) { var p = s.pts[1].p + (s.pts[0].p - s.pts[1].p) * f, y = candle.priceToCoordinate(p); if (y == null) return; if (i) { var pp = s.pts[1].p + (s.pts[0].p - s.pts[1].p) * FIB[i - 1], yp = candle.priceToCoordinate(pp); if (yp != null) { ctx.globalAlpha = 0.06 + (i % 2) * 0.04; ctx.fillRect(x0 * r, Math.min(y, yp) * r, W - x0 * r, Math.abs(yp - y) * r); } } ctx.globalAlpha = f === 0 || f === 1 ? 1 : 0.75; line([x0, y], [W / r, y]); ctx.globalAlpha = 1; label(ctx, r, (f * 100).toFixed(1) + '%  ' + won(p), x0 * r, (y - 8) * r, c); }); ctx.globalAlpha = 0.5; ctx.setLineDash([4 * r, 4 * r]); line(A, B); }
      else if (k === 'fibext' && P[2]) { line(A, B); line(B, P[2]); var mv = s.pts[1].p - s.pts[0].p; FIBX.forEach(function (f) { var p = s.pts[2].p + mv * f, y = candle.priceToCoordinate(p); if (y == null) return; ctx.globalAlpha = 0.8; line([P[2][0], y], [W / r, y]); ctx.globalAlpha = 1; label(ctx, r, f.toFixed(3).replace(/0+$/, '').replace(/\\.$/, '') + '  ' + won(p), P[2][0] * r, (y - 8) * r, c); }); }
      else if (k === 'fibtime' && P[1]) { var la = ts.coordinateToLogical(A[0]), lb = ts.coordinateToLogical(B[0]); if (la != null && lb != null) { var u = Math.max(1, Math.round(lb - la)); line([A[0], 0], [A[0], H / r]); FIBT.forEach(function (f) { var xx = ts.logicalToCoordinate(la + u * f); if (xx == null || xx * r > W) return; ctx.globalAlpha = 0.7; line([xx, 0], [xx, H / r]); ctx.globalAlpha = 1; label(ctx, r, String(f), xx * r, 12 * r, c, 'center'); }); } }
      else if (k === 'gann' && P[1]) { var gdx = B[0] - A[0], gdy = B[1] - A[1]; GANN.forEach(function (gg) { var e2 = edgeLine(A[0], A[1], A[0] + gdx, A[1] + gdy * gg[0], W, H, false); ctx.globalAlpha = gg[0] === 1 ? 1 : 0.55; line([e2[0], e2[1]], [e2[2], e2[3]]); ctx.globalAlpha = 1; var lx = A[0] + gdx * 1.15, ly = A[1] + gdy * gg[0] * 1.15; label(ctx, r, gg[1], lx * r, ly * r, c); }); }
      else if (k === 'measure' && P[1]) { var up = s.pts[1].p >= s.pts[0].p, mc = up ? '#d1373d' : '#2a62c9'; ctx.fillStyle = mc; ctx.globalAlpha = 0.14; ctx.fillRect(Math.min(A[0], B[0]) * r, Math.min(A[1], B[1]) * r, Math.abs(B[0] - A[0]) * r, Math.abs(B[1] - A[1]) * r); ctx.globalAlpha = 1; ctx.strokeStyle = mc; line([A[0], (A[1] + B[1]) / 2], [B[0], (A[1] + B[1]) / 2]); line([(A[0] + B[0]) / 2, A[1]], [(A[0] + B[0]) / 2, B[1]]);
        var dv = s.pts[1].p - s.pts[0].p, dp = dv / s.pts[0].p * 100, nb = barsBetween(s.pts[0], s.pts[1]); label(ctx, r, (dv > 0 ? '+' : '') + won(dv) + ' (' + (dp > 0 ? '+' : '') + dp.toFixed(2) + '%) · ' + nb + '봉', (A[0] + B[0]) / 2 * r, (Math.min(A[1], B[1]) - 12) * r, mc, 'center', true); }
      else if ((k === 'long' || k === 'short') && P[1]) { var entry = s.pts[0].p, tgt = s.pts[1].p, stop = s.stop != null ? s.stop : entry - (tgt - entry) / 2, ye = A[1], yt = B[1], yst = candle.priceToCoordinate(stop); var xl = Math.min(A[0], B[0]), xr = Math.max(A[0], B[0], A[0] + 40);
        if (yst != null) { ctx.setLineDash([]); ctx.globalAlpha = 0.2; ctx.fillStyle = '#16a34a'; ctx.fillRect(xl * r, Math.min(ye, yt) * r, (xr - xl) * r, Math.abs(yt - ye) * r); ctx.fillStyle = '#d1373d'; ctx.fillRect(xl * r, Math.min(ye, yst) * r, (xr - xl) * r, Math.abs(yst - ye) * r); ctx.globalAlpha = 1; ctx.strokeStyle = '#0f2244'; line([xl, ye], [xr, ye]);
          var gain = (tgt / entry - 1) * 100 * (k === 'short' ? -1 : 1), loss = (stop / entry - 1) * 100 * (k === 'short' ? -1 : 1), rr = loss ? Math.abs(gain / loss) : 0;
          label(ctx, r, '목표 ' + won(tgt) + ' (' + (gain > 0 ? '+' : '') + gain.toFixed(2) + '%)', (xl + xr) / 2 * r, (yt + (yt < ye ? -10 : 10)) * r, '#16a34a', 'center', true);
          label(ctx, r, '손절 ' + won(stop) + ' (' + (loss > 0 ? '+' : '') + loss.toFixed(2) + '%)', (xl + xr) / 2 * r, (yst + (yst < ye ? -10 : 10)) * r, '#d1373d', 'center', true);
          label(ctx, r, (k === 'long' ? '롱' : '숏') + ' 진입 ' + won(entry) + ' · 손익비 ' + rr.toFixed(2), xr * r, ye * r, '#0f2244', 'right', true); } }
      else if (k === 'text' || k === 'note') { var t = String(s.text || ''); ctx.setLineDash([]); ctx.font = '600 ' + (13 * r) + 'px sans-serif'; var tw = ctx.measureText(t).width; if (k === 'note') { ctx.fillStyle = '#fff3d6'; ctx.strokeStyle = '#e0b04a'; ctx.lineWidth = r; ctx.beginPath(); ctx.rect(A[0] * r, (A[1] - 28) * r, tw + 16 * r, 22 * r); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo((A[0] + 6) * r, (A[1] - 6) * r); ctx.lineTo(A[0] * r, A[1] * r); ctx.lineTo((A[0] + 14) * r, (A[1] - 6) * r); ctx.fill(); ctx.fillStyle = '#5b3d00'; ctx.textBaseline = 'middle'; ctx.fillText(t, (A[0] + 8) * r, (A[1] - 17) * r); } else { ctx.fillStyle = c; ctx.textBaseline = 'middle'; ctx.fillText(t, A[0] * r, A[1] * r); } }
      else if (k === 'up' || k === 'down') { var dir = k === 'up' ? 1 : -1, mc2 = k === 'up' ? '#d1373d' : '#2a62c9', sz = 9; ctx.fillStyle = mc2; ctx.beginPath(); ctx.moveTo(A[0] * r, A[1] * r); ctx.lineTo((A[0] - sz) * r, (A[1] + dir * sz * 1.6) * r); ctx.lineTo((A[0] + sz) * r, (A[1] + dir * sz * 1.6) * r); ctx.closePath(); ctx.fill(); if (s.text) label(ctx, r, s.text, A[0] * r, (A[1] + dir * 26) * r, mc2, 'center'); }
      else if (k === 'brush' && P.length > 1) { ctx.beginPath(); ctx.moveTo(P[0][0] * r, P[0][1] * r); for (var j = 1; j < P.length; j++) ctx.lineTo(P[j][0] * r, P[j][1] * r); ctx.stroke(); }
      if (selected) { ctx.setLineDash([]); handles(s).forEach(function (h) { ctx.beginPath(); ctx.arc(h[0] * r, h[1] * r, 6 * r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2 * r; ctx.strokeStyle = c; ctx.stroke(); }); }
      ctx.restore();
    };
    var handles = function (s) {
      if (s.k === 'brush') { var P0 = [X(s.pts[0]), Y(s.pts[0])]; return P0[0] == null ? [] : [P0]; }
      var hs = s.pts.map(function (pt) { return [X(pt), Y(pt)]; }).filter(function (h) { return h[0] != null && h[1] != null; });
      if ((s.k === 'long' || s.k === 'short') && s.pts[1]) { var stop = s.stop != null ? s.stop : s.pts[0].p - (s.pts[1].p - s.pts[0].p) / 2, ys = candle.priceToCoordinate(stop), xb = X(s.pts[1]); if (ys != null && xb != null) hs.push([xb, ys]); }
      return hs;
    };
    var req = null;
    candle.attachPrimitive({
      attached: function (p) { req = p.requestUpdate; }, detached: function () {}, updateAllViews: function () {},
      paneViews: function () { return [{ zOrder: function () { return 'top'; }, renderer: function () { return { draw: function (target) {
        if (suspended) return;
        target.useBitmapCoordinateSpace(function (sc) { var W = sc.bitmapSize.width, H = sc.bitmapSize.height, r = sc.horizontalPixelRatio;
          if (!hideAll) shapes.forEach(function (s, i) { if (!s.hidden) drawShape(sc.context, s, r, W, H, i === sel); });
          if (draft) drawShape(sc.context, draft, r, W, H, true); });
      } }; } }]; }
    });
    var paint = function () { if (req) req(); renderEdit(); };

    // ---- hit test ----
    var near = function (x, y) {
      for (var i = shapes.length - 1; i >= 0; i--) {
        var s = shapes[i]; if (s.hidden || hideAll) continue;
        var hs = handles(s); for (var h = 0; h < hs.length; h++) if (Math.hypot(hs[h][0] - x, hs[h][1] - y) < 14) return { i: i, h: h };
      }
      var best = -1, bd = 10;
      shapes.forEach(function (s, i) { if (s.hidden || hideAll) return; var d = dist(s, x, y); if (d < bd) { bd = d; best = i; } });
      return best >= 0 ? { i: best, h: -1 } : null;
    };
    var segD = function (x, y, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)); return Math.hypot(x - (a[0] + u * dx), y - (a[1] + u * dy)); };
    var dist = function (s, x, y) {
      var P = s.pts.map(function (pt) { return [X(pt), Y(pt)]; }); if (P.some(function (p) { return p[0] == null || p[1] == null; })) return 99;
      var A = P[0], B = P[1] || P[0], k = s.k;
      if (k === 'hline') return Math.abs(y - A[1]); if (k === 'hray') return x >= A[0] - 6 ? Math.abs(y - A[1]) : 99; if (k === 'vline') return Math.abs(x - A[0]);
      if (k === 'ray' || k === 'ext' || k === 'gann') { var e = edgeLine(A[0], A[1], B[0], B[1], 9e3, 9e3, k === 'ext'); return segD(x, y, [e[0], e[1]], [e[2], e[3]]); }
      if (k === 'brush') { var m = 99; for (var j = 1; j < P.length; j++) m = Math.min(m, segD(x, y, P[j - 1], P[j])); return m; }
      if (k === 'text' || k === 'note' || k === 'up' || k === 'down') return (x >= A[0] - 12 && x <= A[0] + 140 && y >= A[1] - 30 && y <= A[1] + 30) ? 4 : 99;
      if (k === 'fib' || k === 'rect' || k === 'measure' || k === 'long' || k === 'short' || k === 'fibext') { var xs = P.map(function (p) { return p[0]; }), ys = P.map(function (p) { return p[1]; }); if (k === 'fib' || k === 'fibext') xs.push(paneW()); return (x >= Math.min.apply(null, xs) - 6 && x <= Math.max.apply(null, xs.concat([A[0] + 40])) + 6 && y >= Math.min.apply(null, ys) - 8 && y <= Math.max.apply(null, ys) + 8) ? 5 : 99; }
      if (k === 'channel' && P[2]) { var t2 = (P[2][0] - A[0]) / ((B[0] - A[0]) || 1), off = P[2][1] - (A[1] + (B[1] - A[1]) * t2); return Math.min(segD(x, y, A, B), segD(x, y, [A[0], A[1] + off], [B[0], B[1] + off])); }
      if (k === 'fibtime') return Math.abs(x - A[0]);
      return segD(x, y, A, B);
    };

    // ---- tool selection, hint, toolbar ----
    var hint = function (t) { hintEl.hidden = !t; hintEl.querySelector('span').textContent = t || ''; };
    var setTool = function (k) {
      if (k && k !== 'select' && (suspended || candle.options().visible === false)) { toast('그리기는 일봉에서 쓸 수 있어요.'); return; }
      tool = k && k !== 'select' ? k : null; draft = null; step = 0; cap.hidden = !tool; tip.hidden = true;
      bar.querySelectorAll('[data-dw]').forEach(function (b) { var key = b.getAttribute('data-dw'); if (key === 'select') b.setAttribute('aria-pressed', String(!tool)); });
      bar.querySelectorAll('[data-dw-group]').forEach(function (b) { var on = !!tool && TOOL[tool].g === b.getAttribute('data-dw-group'); b.classList.toggle('on', on); if (on) b.querySelector('svg').outerHTML = TOOL[tool].icon; });
      tools.querySelectorAll('[data-dw-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-dw-tool') === tool)); });
      if (tool) { lastGroupTool[TOOL[tool].g] = tool; select(-1); }
      hint(tool ? TOOL[tool].label + ' · ' + TOOL[tool].hint : '');
      sizeCap(); paint();
    };
    var openGroup = null;
    var showGroup = function (g) {
      openGroup = openGroup === g ? null : g;
      bar.querySelectorAll('[data-dw-group]').forEach(function (b) { b.setAttribute('aria-expanded', String(b.getAttribute('data-dw-group') === openGroup)); });
      if (!openGroup) { tools.hidden = true; return; }
      var grp = GROUPS.filter(function (x) { return x.key === g; })[0], sc = { trend: 'Alt+T', hline: 'Alt+H', vline: 'Alt+V', fib: 'Alt+F', channel: 'Alt+C', rect: 'Alt+R', measure: 'Alt+M', long: 'Alt+L', short: 'Alt+S', text: 'Alt+X', brush: 'Alt+P' };
      tools.innerHTML = grp.tools.map(function (t) { return '<button type="button" class="dw-b" data-dw-tool="' + t.key + '" aria-pressed="' + (t.key === tool) + '">' + t.icon + '<span>' + t.label + '</span>' + (sc[t.key] ? '<kbd>' + sc[t.key] + '</kbd>' : '') + '</button>'; }).join('');
      tools.hidden = false;
      var b = bar.querySelector('[data-dw-group="' + g + '"]'); if (window.matchMedia('(min-width: 821px)').matches && b) tools.style.top = (b.offsetTop) + 'px'; else tools.style.top = '';
    };
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      var g = b.getAttribute('data-dw-group'), k = b.getAttribute('data-dw');
      if (g) { showGroup(g); return; }
      if (k === 'select') { setTool(null); showGroup(openGroup); return; }
      if (k === 'magnet') { magnet = !magnet; b.setAttribute('aria-pressed', String(magnet)); try { localStorage.setItem('gnm-draw-magnet', magnet ? '1' : '0'); } catch (x) {} toast(magnet ? '자석: 점이 봉의 시가·고가·저가·종가에 붙어요.' : '자석을 껐어요.'); return; }
      if (k === 'undo') { doUndo(); return; } if (k === 'redo') { doRedo(); return; }
      if (k === 'hideall') { hideAll = !hideAll; b.setAttribute('aria-pressed', String(hideAll)); select(-1); paint(); return; }
      if (k === 'lockall') { var before = snap(), lock = !shapes.every(function (s) { return s.locked; }); shapes.forEach(function (s) { s.locked = lock; }); b.setAttribute('aria-pressed', String(lock)); commit(before); toast(lock ? '모든 그림을 잠갔어요.' : '잠금을 풀었어요.'); return; }
      if (k === 'clear') { if (!shapes.length) return; var b4 = snap(); shapes = []; select(-1); commit(b4); toast('모두 지웠어요. 되돌리기로 살릴 수 있어요.'); return; }
    });
    tools.addEventListener('click', function (e) { var b = e.target.closest('[data-dw-tool]'); if (!b) return; setTool(b.getAttribute('data-dw-tool')); showGroup(openGroup); });
    hintEl.querySelector('button').addEventListener('click', function () { setTool(null); });
    bar.querySelector('[data-dw="magnet"]').setAttribute('aria-pressed', String(magnet));
    var doUndo = function () { if (!undo.length) return; redo.push(snap()); shapes = JSON.parse(undo.pop()); select(-1); save(); paint(); };
    var doRedo = function () { if (!redo.length) return; undo.push(snap()); shapes = JSON.parse(redo.pop()); select(-1); save(); paint(); };

    // ---- the capture layer: drawing with mouse, pen or finger ----
    var sizeCap = function () { cap.style.width = paneW() + 'px'; cap.style.height = paneH() + 'px'; };
    window.addEventListener('resize', function () { setTimeout(sizeCap, 50); });
    var local = function (e) { var r = host.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    var showTip = function (pt, xy, touch) { if (!pt) { tip.hidden = true; return; } tip.hidden = false; tip.textContent = won(pt.p) + ' · ' + dayOf(pt); tip.style.left = xy[0] + 'px'; tip.style.top = (xy[1] - (touch ? 46 : 14)) + 'px'; };
    var finish = function () { if (!draft) return; var before = snap(); var s = draft; draft = null; step = 0; if (s.k === 'long' || s.k === 'short') s.stop = s.pts[0].p - (s.pts[1].p - s.pts[0].p) / 2; shapes.push(s); commit(before); tip.hidden = true; var i = shapes.length - 1; setTool(null); select(i); if (s.k === 'text' || s.k === 'note') editText(i, true); };
    var newShape = function (pt) { var t = TOOL[tool]; return { k: tool, pts: t.n === 1 ? [pt] : [pt, { t: pt.t, d: pt.d, p: pt.p }], st: { c: tool === 'text' ? '#0f2244' : COLORS[0], w: tool === 'brush' ? 3 : 2 } }; };
    // A press that starts a shape and is dragged places its second point on release; a press without a drag
    // waits for the next tap (or click) for each further point, with a live preview under the mouse.
    var down = null;
    var nextPoint = function () {
      var n = TOOL[draft.k].n;
      if (step + 1 >= n) { finish(); return; }
      step += 1; var prev = draft.pts[step - 1]; draft.pts[step] = { t: prev.t, d: prev.d, p: prev.p };
      hint(TOOL[draft.k].label + ' · ' + (draft.k === 'channel' ? '세 번째 점으로 채널 폭을 정해요' : '세 번째 점을 눌러요'));
    };
    cap.addEventListener('pointerdown', function (e) {
      if (!tool) return; e.preventDefault(); try { cap.setPointerCapture(e.pointerId); } catch (x) {}
      var xy = local(e), pt = fromXY(xy[0], xy[1]); if (!pt) return;
      down = { xy: xy, moved: false, created: !draft };
      if (!draft) { draft = newShape(pt); step = 1; if (TOOL[tool].n === 1) { down = null; finish(); return; } }
      else draft.pts[step] = pt;
      showTip(pt, xy, e.pointerType !== 'mouse'); paint();
    });
    cap.addEventListener('pointermove', function (e) {
      if (!tool) return; var xy = local(e), pt = fromXY(xy[0], xy[1]); if (!pt) return; var touch = e.pointerType !== 'mouse';
      if (down && Math.hypot(xy[0] - down.xy[0], xy[1] - down.xy[1]) > 6) down.moved = true;
      if (draft) { if (draft.k === 'brush') { if (down) draft.pts.push(pt); } else draft.pts[step] = pt; showTip(pt, xy, touch); paint(); }
      else if (!touch) showTip(pt, xy, false);
    });
    cap.addEventListener('pointerup', function (e) {
      var d0 = down; down = null; if (!tool || !draft || !d0) return;
      if (draft.k === 'brush') { if (draft.pts.length > 2) finish(); else { draft = null; paint(); } return; }
      var xy = local(e), pt = fromXY(xy[0], xy[1]); if (pt) draft.pts[step] = pt;
      if (d0.created && !d0.moved) { paint(); return; }
      nextPoint(); paint();
    });
    cap.addEventListener('pointerleave', function () { if (!draft) tip.hidden = true; });

    // ---- selecting, moving and reshaping existing shapes (no tool active) ----
    var grab = false;
    host.addEventListener('pointerdown', function (e) {
      if (tool || hideAll || suspended || e.target === cap || e.button > 0) return;
      var xy = local(e); if (xy[1] > paneH() || xy[0] > paneW()) return;
      var hit = near(xy[0], xy[1]);
      if (!hit) { if (sel >= 0) select(-1); return; }
      select(hit.i);
      var s = shapes[hit.i]; if (s.locked) return;
      grab = true; e.preventDefault(); e.stopPropagation();
      drag = { i: hit.i, h: hit.h, start: xy, before: snap(), orig: JSON.parse(JSON.stringify(s)) };
    }, true);
    ['mousedown', 'touchstart'].forEach(function (ev) { host.addEventListener(ev, function (e) { if (grab) { e.stopPropagation(); if (ev === 'touchstart') e.preventDefault(); } }, { capture: true, passive: false }); });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return; var xy = local(e), s = shapes[drag.i], o = drag.orig;
      if (drag.h >= 0) {
        var isStop = (s.k === 'long' || s.k === 'short') && drag.h === 2;
        var pt = fromXY(xy[0], xy[1]); if (!pt) return;
        if (isStop) s.stop = pt.p; else if (s.k === 'brush') { var dx0 = xy[0] - drag.start[0], dy0 = xy[1] - drag.start[1]; moveAll(s, o, dx0, dy0); } else s.pts[drag.h] = pt;
      } else { moveAll(s, o, xy[0] - drag.start[0], xy[1] - drag.start[1]); }
      showTip(fromXY(xy[0], xy[1]), xy, e.pointerType !== 'mouse'); paint();
    });
    var moveAll = function (s, o, dx, dy) {
      s.pts = o.pts.map(function (pt) { var x = X(pt), y = Y(pt); if (x == null || y == null) return pt; var n = fromXY(x + dx, y + dy); return n || pt; });
      if (o.stop != null) { var ys = candle.priceToCoordinate(o.stop); if (ys != null) { var np = candle.coordinateToPrice(ys + dy); if (np != null) s.stop = np; } }
    };
    window.addEventListener('pointerup', function () { if (!drag) return; var before = drag.before; drag = null; grab = false; tip.hidden = true; if (before !== snap()) commit(before); else paint(); });
    window.addEventListener('pointercancel', function () { drag = null; grab = false; });
    host.addEventListener('contextmenu', function (e) { if (tool) { e.preventDefault(); setTool(null); return; } var xy = local(e), hit = near(xy[0], xy[1]); if (hit) { e.preventDefault(); select(hit.i); } });

    // ---- the floating edit bar ----
    var select = function (i) { sel = i; renderEdit(); if (req) req(); };
    var renderEdit = function () {
      var s = shapes[sel]; if (!s || hideAll) { edit.hidden = true; return; }
      var st = s.st || (s.st = { c: COLORS[0], w: 2 });
      edit.innerHTML = COLORS.map(function (c) { return '<button type="button" data-e="c" data-v="' + c + '" aria-pressed="' + (st.c === c) + '" title="색"><span class="sw" style="background:' + c + '"></span></button>'; }).join('') +
        '<button type="button" data-e="w" title="굵기">' + (st.w || 2) + 'px</button><button type="button" data-e="dash" aria-pressed="' + !!st.dash + '" title="점선">┄</button>' +
        (s.k === 'text' || s.k === 'note' || s.k === 'up' || s.k === 'down' ? '<button type="button" data-e="text" title="글 고치기">글</button>' : '') +
        '<button type="button" data-e="lock" aria-pressed="' + !!s.locked + '" title="잠금">' + ${JSON.stringify(ICON.lock)} + '</button><button type="button" data-e="copy" title="복사">' + ${JSON.stringify(ICON.copy)} + '</button><button type="button" data-e="del" title="삭제 (Delete)">' + ${JSON.stringify(ICON.trash)} + '</button>';
      edit.hidden = false;
    };
        edit.addEventListener('click', function (e) {
      var b = e.target.closest('[data-e]'); if (!b) return; var s = shapes[sel]; if (!s) return; var before = snap(), k = b.getAttribute('data-e');
      if (k === 'c') s.st.c = b.getAttribute('data-v');
      if (k === 'w') s.st.w = (s.st.w || 2) % 4 + 1;
      if (k === 'dash') s.st.dash = !s.st.dash;
      if (k === 'lock') s.locked = !s.locked;
      if (k === 'copy') { var c = JSON.parse(JSON.stringify(s)); c.locked = false; c.pts = c.pts.map(function (pt) { var x = X(pt), y = Y(pt); return x == null ? pt : (fromXY(x + 16, y + 16) || pt); }); shapes.push(c); sel = shapes.length - 1; }
      if (k === 'del') { shapes.splice(sel, 1); sel = -1; }
      if (k === 'text') { editText(sel, false); return; }
      commit(before);
    });
    var editText = function (i, fresh) {
      var s = shapes[i]; if (!s) return; var x = X(s.pts[0]), y = Y(s.pts[0]); if (x == null) return;
      var inp = document.createElement('input'); inp.className = 'dw-input'; inp.maxLength = 80; inp.value = s.text || ''; inp.placeholder = s.k === 'up' || s.k === 'down' ? '표시 이름 (비워 둬도 돼요)' : '글을 입력하세요';
      inp.style.left = Math.max(4, Math.min(x, host.clientWidth - 160)) + 'px'; inp.style.top = Math.max(4, y - 44) + 'px'; body.appendChild(inp); inp.focus();
      var done = false, end = function (keep) { if (done) return; done = true; var before = snap(); if (keep) s.text = inp.value.trim().slice(0, 80); inp.remove(); if ((s.k === 'text' || s.k === 'note') && !s.text) { shapes.splice(shapes.indexOf(s), 1); sel = -1; } commit(fresh ? before : before); };
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') end(true); if (e.key === 'Escape') end(false); e.stopPropagation(); });
      inp.addEventListener('blur', function () { end(true); });
    };

    // ---- keyboard (wide screens) ----
    document.addEventListener('keydown', function (e) {
      if (panel.hidden || /input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
      if (e.key === 'Escape' && (tool || sel >= 0)) { e.stopImmediatePropagation(); if (tool) setTool(null); else select(-1); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel >= 0) { e.preventDefault(); var b = snap(); shapes.splice(sel, 1); sel = -1; commit(b); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); return; }
      var ck = (e.code || '').replace(/^Key/, '').toLowerCase();
      if (e.altKey && !e.ctrlKey && !e.metaKey && KEYS[ck]) { e.preventDefault(); setTool(KEYS[ck]); }
    }, true);

    // ---- hooks for the day/week/month switch and minute candles ----
    window.GNM_draw = {
      suspend: function (on) { suspended = !!on; if (on) { setTool(null); select(-1); } bar.querySelectorAll('button').forEach(function (b) { b.disabled = !!on; }); paint(); },
      cancel: function () { setTool(null); },
      shapes: function () { return shapes; }, tool: function () { return tool; }, select: select, setTool: setTool, undo: doUndo, redo: doRedo,
      key: KEY,
    };
    sizeCap(); paint();
  };
  var tries = 0, poll = setInterval(function () { init(); if (G || ++tries > 60) clearInterval(poll); }, 500);
  window.addEventListener('DOMContentLoaded', init);
})();
`;

/**
 * G-145: the free plan keeps two extra indicators on the chart at once (moving averages and volume don't count);
 * a third asks for Plus instead of turning on.
 */
export const IND_LIMIT_JS = `
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('#ind-sheet [data-ov], #ind-sheet [data-pane]'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
  var plan = document.documentElement.getAttribute('data-plan') || 'free'; if (plan !== 'free') return;
  var BASIC = /^(ma5|ma20|ma60|ma120|volume)$/, key = function (x) { return x.getAttribute('data-ov') || x.getAttribute('data-pane'); };
  if (BASIC.test(key(b))) return;
  var on = [].slice.call(document.querySelectorAll('#ind-sheet [data-ov][aria-pressed=true], #ind-sheet [data-pane][aria-pressed=true]')).filter(function (x) { return !BASIC.test(key(x)); });
  if (on.length < 2) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (window.GNM && GNM.toast) GNM.toast('무료는 보조 지표를 2개까지 함께 켤 수 있어요. 하나를 끄거나 플러스로 더 켜 보세요.');
}, true);
`;
