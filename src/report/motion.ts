// G-158: infographics that move. Each picture draws itself when it scrolls into view (lines trace from the left, bars
// grow from the axis, the health radar opens from the middle, gauges swing to their value, numbers count up), and
// answers a finger or a mouse: the scenario and summary mini charts follow the pointer with the date and price,
// the statement bars light up one year with its values, the radar and its list point at each other.
// Readers who ask their system for less motion get the finished pictures at once; the touch values stay.
// G-170: a picture plays once it is well on screen, a little slower, and plays again after it was scrolled away or its tab hidden.

export const MOTION_CSS = `
html.mo .mo-line,html.mo .hero-chart:not(.mo-in) polyline,html.mo .hero-chart:not(.mo-in) polygon,html.mo .flow-chart:not(.mo-in) polyline{clip-path:inset(0 100% 0 0)}
html.mo .mo-in .mo-line,html.mo .hero-chart.mo-in polyline,html.mo .hero-chart.mo-in polygon,html.mo .flow-chart.mo-in polyline{clip-path:inset(0 0 0 0);transition:clip-path 1.4s var(--ease-out)}
html.mo .flow-chart:not(.mo-in) .flow-label{opacity:0}html.mo .flow-chart.mo-in .flow-label{opacity:1;transition:opacity .4s 1.1s}
html.mo .scenario-band{opacity:0;transform:scaleY(.2);transform-box:fill-box;transform-origin:center}
html.mo .mo-in .scenario-band{opacity:1;transform:none;transition:opacity .6s .9s,transform .8s .9s var(--ease-out)}
html.mo .scenario-figure:not(.mo-in) .mo-dot,html.mo .scenario-figure:not(.mo-in) .mo-pulse{opacity:0}
html.mo .scenario-figure.mo-in .mo-dot{transition:opacity .3s 1.3s}
.mo-pulse{transform-box:fill-box;transform-origin:center;animation:mo-pulse 2.2s ease-out 1s infinite}
@keyframes mo-pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.4);opacity:0}}
html.mo .mo-bars rect{transform:scaleY(0);transform-box:fill-box;transform-origin:50% 100%}
html.mo .mo-bars rect.neg{transform-origin:50% 0}
html.mo .mo-bars.mo-in rect{transform:none;transition:transform .9s var(--ease-out) calc(min(var(--i,0),12) * 70ms),opacity .15s}
html.mo .mo-bars .ig-bl{opacity:0}html.mo .mo-bars.mo-in .ig-bl{opacity:1;transition:opacity .5s .9s}
.mo-bars rect{transition:opacity .15s}.mo-bars[data-hi] rect:not(.hi){opacity:.28}
.mo-bars svg,.mo-scrub,.hero-chart svg{touch-action:pan-y;cursor:crosshair}.mo-bars svg:focus-visible,.mo-scrub:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:6px}
html.mo .ig-radar .area{transform:scale(0);transform-box:view-box;transform-origin:110px 104px;opacity:0}
html.mo .ig-radar.mo-in .area{transform:none;opacity:1;transition:transform 1.1s var(--ease-out),opacity .5s}
html.mo .ig-radar .dot{opacity:0}html.mo .ig-radar.mo-in .dot{opacity:1;transition:opacity .35s calc(.8s + var(--i,0) * 90ms),r .15s}
.ig-radar .dot{transition:r .15s}.ig-radar .dot.hi{r:6.5px;fill:var(--accent)}
.ig-hl li{transition:background .15s}.ig-hl li.hi{background:var(--accent-soft);border-radius:10px}
html.mo .ig-bs-bar i{transform:scaleX(0);transform-origin:left}
html.mo .ig-bs.mo-in .ig-bs-bar i{transform:none;transition:transform 1s var(--ease-out) calc(var(--i,0) * 120ms)}
html.mo .mini-gauge:not(.mo-in) .needle,html.mo .gauge:not(.mo-in) .needle{animation:none;transform:rotate(0deg)}
html.mo .gbars:not(.mo-in) .track i{transform:scaleX(0)}.gbars .track i{transform-origin:left;transition:transform .9s var(--ease-out)}.gbars .gbar+.gbar .track i{transition-delay:.15s}
html.mo .si-card:not(.mo-in) .si-c{opacity:0;transform:translateY(6px)}
html.mo .si-card.mo-in .si-c{transition:opacity .55s calc(min(var(--i,0),10) * 60ms),transform .7s var(--ease-out) calc(min(var(--i,0),10) * 60ms)}
html.mo .si-card:not(.mo-in) .si-rbar{transform:scaleX(0)}.si-rbar{transform-origin:left;transition:transform 1s var(--ease-out)}
html.mo .si-card:not(.mo-in) .si-rbar i{left:0!important;opacity:0}.si-rbar i{transition:left 1.3s var(--ease-out) .5s,opacity .3s .5s}
html.mo .si-card:not(.mo-in) .si-fbar i{transform:scaleX(0)}.si-fbar i{transition:transform 1s var(--ease-out) calc(var(--i,0) * 90ms)}.si-fbar i.pos{transform-origin:left}.si-fbar i.neg{transform-origin:right}
html.mo .si-card:not(.mo-in) .si-cols i{transform:scaleY(0)}.si-cols i{transform-origin:bottom;transition:transform 1s var(--ease-out) calc(var(--i,0) * 110ms)}
html.mo .si-card:not(.mo-in) .si-cols span{opacity:0}.si-cols span{transition:opacity .4s calc(.6s + var(--i,0) * 110ms)}
html.mo .fc-card:not(.mo-in) .fc-rng{transform:scaleX(0)}.fc-rng{transition:transform 1s var(--ease-out) calc(var(--i,0) * 130ms)}
html.mo .fc-card:not(.mo-in) .fc-mid{opacity:0;transform:scale(.4)}.fc-mid{transition:opacity .35s calc(.7s + var(--i,0) * 130ms),transform .45s var(--ease-spring) calc(.7s + var(--i,0) * 130ms)}
.mo-tip{position:absolute;z-index:6;left:0;top:0;pointer-events:none;background:var(--tip-bg,#0A1626);color:var(--tip-fg,#fff);border:1px solid var(--line-strong);border-radius:10px;padding:6px 10px;font-size:12.5px;font-weight:500;line-height:1.55;white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.28);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);transform:translate(-50%,calc(-100% - 10px))}
.mo-tip.below{transform:translate(-50%,12px)}.mo-tip[hidden]{display:none}.mo-tip b{font-weight:800}.mo-tip .up{color:#FF8A8F}.mo-tip .down{color:#8db4ff}
.mo-tip i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:0}
.mo-hdot{position:absolute;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:var(--surface-solid);border:2.5px solid currentColor;pointer-events:none;box-sizing:border-box}
.mo-hline{position:absolute;width:0;border-left:1px dashed var(--muted);pointer-events:none}.mo-hdot[hidden],.mo-hline[hidden]{display:none}
`;

export const MOTION_JS = `
(function () {
  var root = document.documentElement, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) root.classList.add('mo');
  var SEL = '.scenario-figure, .hero-chart, .flow-chart, .mo-bars, .ig-radar, .ig-bs, .mini-gauge, .ig-hc, .si-card, .fc-card, .lv-card, .gbars, .gauge';
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (v) { if (root.getAttribute('data-ccy') === 'USD') return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + '원'; };
  var day = function (d) { d = String(d || ''); return /^\\d{4}-\\d{2}-\\d{2}/.test(d) ? d.slice(2, 4) + '.' + d.slice(5, 7) + '.' + d.slice(8, 10) : d; };
  // ---- numbers count up from zero, keeping their commas, decimals and units ----
  var count = function (el) {
    if (el.dataset.moDone) return; el.dataset.moDone = '1'; if (el.dataset.moText == null) el.dataset.moText = el.textContent; if (reduce) return;
    var t = el.dataset.moText, m = t.match(/-?[0-9][0-9,]*(\\.[0-9]+)?/); if (!m || (t.match(/[0-9][0-9,.]*/g) || []).length > 1) return;
    var end = Number(m[0].replace(/,/g, '')); if (!isFinite(end) || end === 0) return;
    var dec = m[1] ? m[1].length - 1 : 0, comma = m[0].indexOf(',') >= 0, pre = t.slice(0, m.index), post = t.slice(m.index + m[0].length), t0 = null;
    var fmt = function (v) { var s = v.toFixed(dec); if (comma) { var p = s.split('.'); p[0] = Number(p[0]).toLocaleString('en-US'); s = p.join('.'); } return pre + s + post; };
    var step = function (ts) { if (t0 == null) t0 = ts; var k = Math.min(1, (ts - t0) / 1100); el.textContent = k < 1 ? fmt(end * (1 - Math.pow(1 - k, 3))) : t; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  var NUMS = '.mo-count, .ig-hl em, .si-c b, .si-target b';
  var show = function (el) { if (el.classList.contains('mo-in')) return; el.classList.add('mo-in'); el.querySelectorAll(NUMS).forEach(count); };
  // G-170: a picture that leaves the screen, or whose tab is hidden, goes back to its start, so it plays again on the way back.
  var reset = function (el) { if (!el.classList.contains('mo-in')) return; el.classList.remove('mo-in'); el.querySelectorAll(NUMS).forEach(function (n) { if (n.dataset.moText != null) n.textContent = n.dataset.moText; delete n.dataset.moDone; }); };
  var pend = typeof WeakMap === 'function' ? new WeakMap() : null, vh = function () { return window.innerHeight || root.clientHeight; };
  // It plays once a good part of it is on screen (not when its top edge peeks in at the bottom), after a short beat for the eye.
  var io = !reduce && pend && 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) {
    var el = e.target, t = pend.get(el);
    if (!e.isIntersecting) { if (t) { clearTimeout(t); pend.delete(el); } reset(el); return; }
    if (t || el.classList.contains('mo-in') || !(e.intersectionRatio >= 0.45 || e.intersectionRect.height >= vh() * 0.4)) return;
    pend.set(el, setTimeout(function () { pend.delete(el); show(el); }, 180));
  }); }, { threshold: [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1] }) : null;
  // A card's own tabs (재무제표 손익·부채비율·당좌비율·현금흐름) play the picture again when switched.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-fs]'); if (!b || reduce) return; var c = b.closest('.card'); if (!c) return;
    var els = (c.matches(SEL) ? [c] : []).concat(Array.prototype.slice.call(c.querySelectorAll(SEL)));
    els.forEach(reset); void c.offsetWidth; requestAnimationFrame(function () { requestAnimationFrame(function () { els.forEach(function (x) { if (x.offsetParent) show(x); }); }); });
  });
  // ---- a value bubble above a point ----
  var mkTip = function (host) { if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; var t = document.createElement('div'); t.className = 'mo-tip'; t.hidden = true; t.setAttribute('role', 'status'); host.appendChild(t); return t; };
  // Above the point when there is room, else just below it, so the bubble never covers what it describes.
  var place = function (t, host, x, y) { t.hidden = false; var w = t.offsetWidth, hw = host.clientWidth; t.style.left = Math.max(w / 2 + 2, Math.min(hw - w / 2 - 2, x)) + 'px'; t.classList.toggle('below', y - t.offsetHeight - 12 < 0); t.style.top = y + 'px'; };
  // ---- scenario mini chart: date and close under the finger; the shaded range says what it is ----
  var scen = function (svg) {
    var pts = [], band = null; try { pts = JSON.parse(svg.getAttribute('data-pts') || '[]'); band = JSON.parse(svg.getAttribute('data-band') || 'null'); } catch (e) {} if (!pts.length) return;
    var fig = svg.closest('figure') || svg.parentNode, tp = mkTip(fig), NS = 'http://www.w3.org/2000/svg', g = document.createElementNS(NS, 'g'), idx = -1;
    g.setAttribute('class', 'mo-cross'); g.style.display = 'none'; g.innerHTML = '<line y1="24" y2="198" stroke="#191f28" stroke-opacity=".55" stroke-dasharray="2 3"/><circle r="5.5" fill="#fff" stroke="#183556" stroke-width="2.5"/>'; svg.appendChild(g);
    var geo = function () { var r = svg.getBoundingClientRect(), f = fig.getBoundingClientRect(), s = Math.min(r.width / 420, r.height / 232); return { r: r, s: s, ox: r.left - f.left + (r.width - 420 * s) / 2, oy: r.top - f.top + (r.height - 232 * s) / 2 }; };
    var hide = function () { g.style.display = 'none'; tp.hidden = true; };
    var at = function (i) {
      idx = Math.max(0, Math.min(pts.length - 1, i)); var p = pts[idx], q = geo(), ln = g.querySelector('line'), c = g.querySelector('circle');
      g.style.display = ''; ln.setAttribute('x1', p[1]); ln.setAttribute('x2', p[1]); c.setAttribute('cx', p[1]); c.setAttribute('cy', p[2]);
      var ch = idx ? (p[3] / pts[idx - 1][3] - 1) * 100 : null;
      tp.innerHTML = esc(day(p[0])) + ' 종가 <b>' + money(p[3]) + '</b>' + (ch == null ? '' : ' <span class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' + (ch > 0 ? '+' : '') + ch.toFixed(1) + '%</span>');
      place(tp, fig, q.ox + p[1] * q.s, q.oy + p[2] * q.s);
    };
    var move = function (e) {
      var q = geo(), x = (e.clientX - q.r.left - (q.r.width - 420 * q.s) / 2) / q.s;
      if (band && x > 232) { g.style.display = 'none'; tp.innerHTML = '예상 가격대 <b>' + money(band[0]) + ' ~ ' + money(band[1]) + '</b>'; place(tp, fig, q.ox + 264 * q.s, q.oy + band[2] * q.s); return; }
      var best = 0, bd = 1e9; pts.forEach(function (p, i) { var d = Math.abs(p[1] - x); if (d < bd) { bd = d; best = i; } }); at(best);
    };
    svg.addEventListener('pointermove', move); svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
    svg.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); at(idx < 0 ? pts.length - 1 : idx + (e.key === 'ArrowRight' ? 1 : -1)); } else if (e.key === 'Escape') hide(); });
    svg.addEventListener('blur', hide);
    document.addEventListener('pointerdown', function (e) { if (!fig.contains(e.target)) hide(); });
  };
  // ---- summary mini chart: drag (or hover) for the price on each day; a plain tap still opens the full chart ----
  var hero = function (a) {
    var svg = a.querySelector('svg'); if (!svg) return;
    var tp = mkTip(a), dot = document.createElement('i'), vl = document.createElement('i'), sx = null, dragged = false, timer = null;
    dot.className = 'mo-hdot'; vl.className = 'mo-hline'; dot.hidden = vl.hidden = true; a.appendChild(vl); a.appendChild(dot);
    var data = function () { var c = [], d = []; try { c = JSON.parse(a.getAttribute('data-c') || '[]'); d = JSON.parse(a.getAttribute('data-d') || '[]'); } catch (e) {} var on = a.nextElementSibling && a.nextElementSibling.querySelector('[aria-pressed=true][data-hc]'), n = on ? Number(on.getAttribute('data-hc')) : 63; return { c: c.slice(-n), d: d.slice(-n) }; };
    var hide = function () { tp.hidden = dot.hidden = vl.hidden = true; };
    var at = function (cx) {
      var D = data(); if (D.c.length < 2) return;
      var r = svg.getBoundingClientRect(), ar = a.getBoundingClientRect(), i = Math.max(0, Math.min(D.c.length - 1, Math.round((cx - r.left) / r.width * (D.c.length - 1))));
      var lo = Math.min.apply(null, D.c), hi = Math.max.apply(null, D.c), sp = hi - lo || 1, x = r.left - ar.left + i / (D.c.length - 1) * r.width, y = r.top - ar.top + (68 - (D.c[i] - lo) / sp * 62) / 72 * r.height;
      dot.style.color = (D.c[D.c.length - 1] >= D.c[0]) ? '#f04452' : '#3182f6'; dot.hidden = vl.hidden = false; dot.style.left = x + 'px'; dot.style.top = y + 'px'; vl.style.left = x + 'px'; vl.style.top = (r.top - ar.top) + 'px'; vl.style.height = r.height + 'px';
      tp.innerHTML = '<b>' + money(D.c[i]) + '</b>' + (D.d[i] ? ' · ' + esc(day(D.d[i])) : ''); place(tp, a, x, y);
    };
    svg.addEventListener('pointerdown', function (e) { sx = e.clientX; dragged = false; });
    svg.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse') { at(e.clientX); return; } if (sx != null && Math.abs(e.clientX - sx) > 6) { dragged = true; at(e.clientX); } });
    svg.addEventListener('pointerup', function (e) { sx = null; if (e.pointerType !== 'mouse') { clearTimeout(timer); timer = setTimeout(hide, 1600); } });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
    a.addEventListener('click', function (e) { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  };
  // ---- statement bars: one year lit, its values in a bubble ----
  var bars = function (fig) {
    var D = null; try { D = JSON.parse(fig.getAttribute('data-tip') || 'null'); } catch (e) {} var svg = fig.querySelector('svg'); if (!D || !svg) return;
    var tp = mkTip(fig), cur = -1; svg.setAttribute('tabindex', '0');
    var off = function () { cur = -1; fig.removeAttribute('data-hi'); svg.querySelectorAll('rect.hi').forEach(function (x) { x.classList.remove('hi'); }); tp.hidden = true; };
    var on = function (i) {
      cur = Math.max(0, Math.min(D.y.length - 1, i)); fig.setAttribute('data-hi', String(cur));
      var top = Infinity; svg.querySelectorAll('rect[data-g]').forEach(function (x) { var hit = x.getAttribute('data-g') === String(cur); x.classList.toggle('hi', hit); if (hit) top = Math.min(top, x.getBoundingClientRect().top); });
      tp.innerHTML = '<b>' + esc(D.y[cur]) + '</b>' + D.s.map(function (s) { return s.v[cur] == null ? '' : '<br><i style="background:' + esc(s.c) + '"></i>' + esc(s.l) + ' <b>' + esc(s.v[cur]) + '</b>'; }).join('');
      var r = svg.getBoundingClientRect(), f = fig.getBoundingClientRect(); place(tp, fig, r.left - f.left + (cur + 0.5) * r.width / D.y.length, (isFinite(top) ? top : r.top) - f.top);
    };
    var pick = function (e) { var r = svg.getBoundingClientRect(); on(Math.floor((e.clientX - r.left) / r.width * D.y.length)); };
    svg.addEventListener('pointermove', pick); svg.addEventListener('pointerdown', pick);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') off(); });
    svg.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); on(cur < 0 ? D.y.length - 1 : cur + (e.key === 'ArrowRight' ? 1 : -1)); } else if (e.key === 'Escape') off(); });
    svg.addEventListener('blur', off);
    document.addEventListener('pointerdown', function (e) { if (!fig.contains(e.target)) off(); });
  };
  // ---- health radar and its list point at each other ----
  var radar = function (svg) {
    var box = svg.closest('.ig-health'); if (!box) return;
    var set = function (i) { svg.querySelectorAll('.dot').forEach(function (d) { d.classList.toggle('hi', d.getAttribute('data-i') === i); }); box.querySelectorAll('.ig-hl li').forEach(function (l) { l.classList.toggle('hi', l.getAttribute('data-i') === i); }); };
    box.addEventListener('pointerover', function (e) { var t = e.target.closest && e.target.closest('[data-i]'); set(t ? t.getAttribute('data-i') : null); });
    box.addEventListener('pointerleave', function () { set(null); });
    box.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-i]'); if (t) set(t.getAttribute('data-i')); });
    box.addEventListener('focusout', function () { set(null); });
  };
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  var scan = function () {
    document.querySelectorAll(SEL).forEach(function (el) {
      if (seen ? seen.has(el) : el.dataset.moSeen) return; if (seen) seen.add(el); else el.dataset.moSeen = '1';
      if (el.matches('.si-card')) { el.querySelectorAll('.si-c').forEach(function (c, i) { c.style.setProperty('--i', i); }); el.querySelectorAll('.si-flow').forEach(function (r, i) { var b = r.querySelector('.si-fbar i'); if (b) b.style.setProperty('--i', i); }); el.querySelectorAll('.si-cols').forEach(function (g) { Array.prototype.forEach.call(g.children, function (col, i) { col.style.setProperty('--i', i); }); }); }
      if (io) io.observe(el); else show(el);
      if (el.matches('.hero-chart')) hero(el);
      else if (el.matches('.mo-bars')) bars(el);
      else if (el.matches('.ig-radar')) radar(el);
      else if (el.matches('.scenario-figure')) { var s = el.querySelector('svg.mo-scrub'); if (s) scen(s); }
    });
  };
  // The summary chart redraws for another period: trace the new line again.
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-hc]'); if (!b || reduce) return; var a = b.closest('.hc-range'); a = a && a.previousElementSibling; if (!a || !a.classList.contains('hero-chart')) return; a.classList.remove('mo-in'); void a.offsetWidth; requestAnimationFrame(function () { a.classList.add('mo-in'); }); });
  // G-160: the chat button steps aside while the page scrolls down (it covered the ends of list rows on phones)
  // and comes back when scrolling stops or turns up.
  var lastY = window.scrollY, fabT = null;
  window.addEventListener('scroll', function () {
    var fab = document.querySelector('.chat-fab'); if (!fab) return;
    var y = window.scrollY, dy = y - lastY; lastY = y;
    if (dy > 4 && y > 120) fab.classList.add('fab-away'); else if (dy < -4 || y <= 120) fab.classList.remove('fab-away');
    clearTimeout(fabT); fabT = setTimeout(function () { fab.classList.remove('fab-away'); }, 900);
  }, { passive: true });
  var queued = false;
  new MutationObserver(function () { if (queued) return; queued = true; setTimeout(function () { queued = false; scan(); }, 120); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();
`;
