// G-277 (한서님 10/21: "하나하나 다 클릭해서 볼 수 도 있고"): every small chart opens big.
// A stat card (.km-stat with a data-km-spark area) or any row with data-sheet="[[date, value], …]" opens a bottom
// sheet: the big number, a large area line that draws itself in, the period's high and low marked with arrows
// (with how today compares to each, Uniswap-style), and a finger or mouse scrub that shows each day's value.
// A drag that scrubbed the small card does not count as a tap.

export const KIT_SHEET_CSS = `
.gsh-sheet{position:fixed;inset:auto 0 0 0;margin:0 auto;width:100%;max-width:560px;max-height:92vh;border:0;padding:10px 20px calc(22px + env(safe-area-inset-bottom));border-radius:28px 28px 0 0;background:var(--surface-solid);color:var(--fg);box-shadow:0 -10px 40px rgba(0,0,0,.18)}
.gsh-sheet::backdrop{background:rgba(10,12,16,.38)}
html.mo .gsh-sheet[open]{animation:gsh-up .34s var(--ease-out,cubic-bezier(.2,.8,.2,1))}@keyframes gsh-up{from{transform:translateY(48px);opacity:0}to{transform:none;opacity:1}}
.gsh-grab{width:40px;height:5px;margin:0 auto 12px;border-radius:3px;background:var(--line-strong)}
.gsh-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.gsh-t{font-size:17px;color:var(--fg2)}.gsh-v{font-size:30px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:2px}.gsh-s{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums;margin-top:2px;color:var(--muted)}.gsh-s.up{color:#f04452}.gsh-s.down{color:#3182f6}
.gsh-x{flex:none;width:40px;height:40px;border:0;border-radius:20px;background:var(--soft);color:var(--fg);font-size:21px;line-height:1;cursor:pointer}
.gsh-svg{display:block;width:100%;height:240px;margin-top:12px;touch-action:none;cursor:crosshair;overflow:visible}
.gsh-line{fill:none;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round;vector-effect:non-scaling-stroke}
html.mo .gsh-sheet[open] .gsh-line{stroke-dasharray:1;stroke-dashoffset:1;animation:gsh-draw 1.1s var(--ease-out,cubic-bezier(.3,.7,.2,1)) forwards}@keyframes gsh-draw{to{stroke-dashoffset:0}}
html.mo .gsh-sheet[open] .gsh-fill{opacity:0;animation:gsh-fade .7s .5s forwards}@keyframes gsh-fade{to{opacity:1}}
.gsh-hl{font-size:14px;font-weight:700;font-variant-numeric:tabular-nums}.gsh-hl.up{fill:#e5323f}.gsh-hl.down{fill:#2468d6}
.gsh-ar{fill:none;stroke-width:1.4;stroke-linecap:round}.gsh-ar.up{stroke:#e5323f}.gsh-ar.down{stroke:#2468d6}
.gsh-cross{stroke:var(--fg);stroke-opacity:.25}.gsh-dot{fill:var(--surface-solid);stroke-width:2.5}
.gsh-foot{margin:10px 0 0;font-size:15px;color:var(--muted)}
.km-stat:not(a){cursor:pointer}[data-sheet]{cursor:pointer}
@media (prefers-reduced-motion: reduce){.gsh-sheet[open],.gsh-sheet[open] .gsh-line,.gsh-sheet[open] .gsh-fill{animation:none!important;stroke-dashoffset:0;opacity:1}}
`;

export const KIT_SHEET_JS = `
(function () {
  if (typeof HTMLDialogElement !== 'function') return;
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var fmt = function (v, d) { return Number(v).toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: Math.min(d, 2) }); };
  var day = function (d) { d = String(d || ''); return /^\\d{4}-\\d{2}-\\d{2}/.test(d) ? Number(d.slice(5, 7)) + '월 ' + Number(d.slice(8, 10)) + '일' : d; };
  var W = 340, H = 240, T = 30, B = 30, dlg = null, cur = null;
  var build = function () {
    dlg = document.createElement('dialog'); dlg.className = 'gsh-sheet'; dlg.setAttribute('aria-label', '차트 크게 보기');
    dlg.innerHTML = '<div class="gsh-grab" aria-hidden="true"></div><div class="gsh-top"><div><div class="gsh-t"></div><div class="gsh-v"></div><div class="gsh-s"></div></div><button type="button" class="gsh-x" aria-label="닫기">×</button></div><div class="gsh-c"></div><p class="gsh-foot">차트 위를 손가락으로 훑으면 그날 값이 위에 보여요.</p>';
    document.body.appendChild(dlg);
    dlg.querySelector('.gsh-x').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    var c = dlg.querySelector('.gsh-c');
    var move = function (e) { var s = c.querySelector('svg'); if (!s || !cur) return; var r = s.getBoundingClientRect(); show(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (cur.D.length - 1))); };
    c.addEventListener('pointermove', move); c.addEventListener('pointerdown', move);
    c.addEventListener('pointerleave', function () { show(-1); });
  };
  var show = function (i) {
    if (!cur) return; var D = cur.D, n = D.length - 1, last = i < 0 ? n : i, v = D[last][1], prev = last ? D[last - 1][1] : v, ch = (v / prev - 1) * 100;
    dlg.querySelector('.gsh-v').textContent = fmt(v, cur.d) + (cur.unit || '');
    var s = dlg.querySelector('.gsh-s'); s.textContent = (i < 0 ? cur.sub : day(D[last][0]) + '  ' + (ch > 0 ? '+' : '') + ch.toFixed(2) + '%'); s.className = 'gsh-s ' + (i < 0 ? cur.subTone : ch > 0 ? 'up' : ch < 0 ? 'down' : '');
    var x = cur.P[last][0], y = cur.P[last][1], cr = dlg.querySelector('.gsh-cross'), dt = dlg.querySelector('.gsh-dot');
    cr.setAttribute('x1', x); cr.setAttribute('x2', x); cr.style.opacity = i < 0 ? 0 : 1; dt.setAttribute('cx', x); dt.setAttribute('cy', y);
  };
  var open = function (o) {
    var D = (o.series || []).filter(function (p) { return isFinite(p[1]); }); if (D.length < 2) return; if (!dlg) build();
    var vs = D.map(function (p) { return p[1]; }), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), sp = hi - lo || 1, now = vs[vs.length - 1];
    var P = D.map(function (p, k) { return [+(k / (D.length - 1) * W).toFixed(1), +(T + (1 - (p[1] - lo) / sp) * (H - T - B)).toFixed(1)]; });
    var line = 'M' + P.map(function (p) { return p[0] + ' ' + p[1]; }).join(' L'), up = now >= vs[0], col = up ? '#e5323f' : '#2468d6', id = 'gshg' + Date.now();
    var hiI = vs.indexOf(hi), loI = vs.indexOf(lo), anc = function (x) { return x < 90 ? 'start' : x > W - 90 ? 'end' : 'middle'; };
    var rel = function (w) { var g = (now / w - 1) * 100; return (g > 0 ? '+' : g < 0 ? '−' : '') + Math.abs(g).toFixed(1) + '%'; };
    var arrow = function (x, a, b) { var d = b > a ? -4 : 4; return 'M' + x + ' ' + a + ' L' + x + ' ' + b + ' M' + (x - 3) + ' ' + (b + d) + ' L' + x + ' ' + b + ' L' + (x + 3) + ' ' + (b + d); };
    var hp = P[hiI], lp = P[loI];
    var svg = '<svg class="gsh-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(o.title + ' 최근 ' + D.length + '일. 최고 ' + fmt(hi, o.d) + ', 최저 ' + fmt(lo, o.d)) + '">'
      + '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".22"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>'
      + '<path class="gsh-fill" d="' + line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z" fill="url(#' + id + ')"/>'
      + '<path class="gsh-line" pathLength="1" d="' + line + '" stroke="' + col + '"/>'
      + '<path class="gsh-ar up" d="' + arrow(hp[0], 16, hp[1] - 6) + '"/><text class="gsh-hl up" x="' + hp[0] + '" y="11" text-anchor="' + anc(hp[0]) + '">최고 ' + esc(fmt(hi, o.d)) + ' (' + rel(hi) + ', ' + esc(day(D[hiI][0])) + ')</text>'
      + '<path class="gsh-ar down" d="' + arrow(lp[0], H - 16, lp[1] + 6) + '"/><text class="gsh-hl down" x="' + lp[0] + '" y="' + (H - 3) + '" text-anchor="' + anc(lp[0]) + '">최저 ' + esc(fmt(lo, o.d)) + ' (' + rel(lo) + ', ' + esc(day(D[loI][0])) + ')</text>'
      + '<line class="gsh-cross" x1="0" x2="0" y1="' + (T - 8) + '" y2="' + (H - B + 8) + '"/><circle class="gsh-dot" r="5" stroke="' + col + '"/></svg>';
    var c = dlg.querySelector('.gsh-c'); c.innerHTML = svg;
    dlg.querySelector('.gsh-t').textContent = o.title;
    var first = vs[0], g = (now / first - 1) * 100;
    cur = { D: D, P: P, d: o.d, unit: o.unit || '', sub: o.sub || ('최근 ' + D.length + '일 ' + (g > 0 ? '+' : '') + g.toFixed(1) + '%'), subTone: o.subTone || (g > 0 ? 'up' : g < 0 ? 'down' : '') };
    show(-1);
    if (dlg.open) dlg.close(); dlg.showModal();
  };
  window.gnmSheet = open;
  // A scrub on a small card is not a tap: remember where the pointer went down.
  var down = null;
  document.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; }, true);
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest || (dlg && dlg.contains(t))) return;
    if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 8) return;
    if (t.closest('a, button:not([data-sheet]), input, select, summary, label')) { if (!t.closest('[data-sheet]')) return; }
    var row = t.closest('[data-sheet]');
    if (row) { var S = []; try { S = JSON.parse(row.getAttribute('data-sheet') || '[]'); } catch (x) {} e.preventDefault(); open({ title: row.getAttribute('data-sheet-title') || '', d: Number(row.getAttribute('data-sheet-digits') || 2), unit: row.getAttribute('data-sheet-unit') || '', series: S }); return; }
    var card = t.closest('.km-stat'); if (!card || card.tagName === 'A') return;
    var svg = card.querySelector('[data-km-spark]'); if (!svg) return;
    var D = []; try { D = JSON.parse(svg.getAttribute('data-km-spark') || '[]'); } catch (x) {}
    var name = card.querySelector('.km-st-t'), badge = card.querySelector('.km-badge');
    open({ title: name ? name.textContent : '', d: Number(svg.getAttribute('data-km-digits') || 2), series: D.map(function (p) { return [p[0], p[1]]; }), sub: badge ? '오늘 ' + badge.textContent.replace(/[▲▼]\\s*/, '') : '', subTone: badge ? (badge.classList.contains('up') ? 'up' : badge.classList.contains('down') ? 'down' : '') : '' });
  });
})();
`;
