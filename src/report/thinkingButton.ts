// G-185: ThreeUI Community's ShaderButtons "Thinking" (MengTo/threeui, MIT, Copyright (c) 2026 Meng To;
// src/shaders/neuform-isolated/sources/thinking-button.html, SHA-256 194da352…fb11a): a raised blue plate with a light
// that runs round it on a faint track, a hot head and a long uneven tail, and a shimmer that sweeps the label twice a lap.
// Ported as authored: the reference frame (2048 units), track gap, stroke widths, lap time (2.70 s), tail length,
// the sampled brightness taper, the comet colours and blur passes (and the no-filter fallback), the plate gradient and
// its neumorphic edge light, the shimmer colours and turn phase. Re-cut for GNOMON: it is drawn over a busy button
// instead of on a stage, so the plate takes the button's size (the source's 976×345 plate is the default shape) and the
// label is ours ("조건을 만드는 중") instead of "Uploading"; the source's hand-drawn double-storey g only applied to that word.

export const THINKING_JS = `
(function () {
  var TRACK_W = 13, CORE_W = 14, GLOW_W = 12, GAP = 50, DUR = 2.70, TAIL = 0.389, SHIM_OFF = 0.898, TXT_CAP = 120;
  var FONT = '300 100px -apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Inter, system-ui, "Segoe UI", Roboto, "Pretendard Variable", Pretendard, sans-serif';
  var TAPER = [1.16,1.09,1.03,1.00,1.02,1.00,1.00,1.00,1.00,0.98,0.97,0.94,0.91,0.89,0.84,0.77,0.74,0.65,0.61,0.52,0.43,0.40,0.27,0.23,0.17,0.12,0.075,0.02,0];
  var TSTEP = TAIL / (TAPER.length - 1);
  var taper = function (u) { if (u < 0 || u >= TAIL) return 0; var f = u / TSTEP, i = Math.floor(f); return TAPER[i] + (TAPER[i + 1] - TAPER[i]) * (f - i); };
  var canFilter = (function () { var t = document.createElement('canvas').getContext('2d'); if (!t) return false; t.filter = 'blur(2px)'; return t.filter !== 'none'; })();
  var rrPath = function (c, cx, cy, w, h, r) { var x = cx - w / 2, y = cy - h / 2; c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r); c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath(); };

  /** gnmThinking(button, label) draws the light over the button until .stop(); .text(s) changes the label. */
  window.gnmThinking = function (btn, text) {
    var host = btn && btn.parentNode; if (!host) return null;
    var cv = document.createElement('canvas'), ctx = cv.getContext('2d'); if (!ctx) return null;
    var gl = document.createElement('canvas'), gx = gl.getContext('2d'), co = document.createElement('canvas'), cox = co.getContext('2d');
    cv.className = 'tk-cv'; cv.setAttribute('aria-hidden', 'true');
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    host.appendChild(cv); btn.classList.add('has-thinking');
    var k = 1, dpr = 1, PW = 976, PH = 345, PR = 100, CX = 0, CY = 0, M = 0, TW, TH, TR, SW, SH, ARC, PERIM, L, T, R, B, fontPx = 40, textX = 0, textW = 0, base = 0;
    var ptAt = function (s) {
      s = s - Math.floor(s / PERIM) * PERIM; var a;
      if (s < SW) return [L + TR + s, T]; s -= SW;
      if (s < ARC) { a = s / TR; return [R - TR + TR * Math.sin(a), T + TR - TR * Math.cos(a)]; } s -= ARC;
      if (s < SH) return [R, T + TR + s]; s -= SH;
      if (s < ARC) { a = s / TR; return [R - TR + TR * Math.cos(a), B - TR + TR * Math.sin(a)]; } s -= ARC;
      if (s < SW) return [R - TR - s, B]; s -= SW;
      if (s < ARC) { a = s / TR; return [L + TR - TR * Math.sin(a), B - TR + TR * Math.cos(a)]; } s -= ARC;
      if (s < SH) return [L, B - TR - s]; s -= SH;
      a = s / TR; return [L + TR - TR * Math.cos(a), T + TR - TR * Math.sin(a)];
    };
    var fitText = function () {
      var probe = 200; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.font = FONT.replace('100px', probe + 'px');
      var cap = ctx.measureText('U').actualBoundingBoxAscent || probe * 0.7;
      fontPx = probe * (TXT_CAP * k) / cap; ctx.font = FONT.replace('100px', fontPx + 'px');
      var m = ctx.measureText(text); textW = m.width; textX = CX * k - textW / 2; base = CY * k + (TXT_CAP * k) / 2;
    };
    // The plate is the button: its size in reference units, with the track GAP outside it and room for the glow.
    var resize = function () {
      var r = btn.getBoundingClientRect(), hr = host.getBoundingClientRect(); if (!r.width) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      k = (r.height * dpr) / PH; PW = Math.max(PH, (r.width * dpr) / k);
      var radius = parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 24; PR = Math.min(PH / 2, (radius * dpr) / k);
      M = GAP + 60; TW = PW + 2 * GAP; TH = PH + 2 * GAP; TR = PR + GAP;
      SW = TW - 2 * TR; SH = TH - 2 * TR; ARC = Math.PI * TR / 2; PERIM = 2 * SW + 2 * SH + 4 * ARC;
      var w = Math.round((PW + 2 * M) * k), h = Math.round((PH + 2 * M) * k);
      cv.width = gl.width = co.width = w; cv.height = gl.height = co.height = h;
      cv.style.width = w / dpr + 'px'; cv.style.height = h / dpr + 'px';
      cv.style.left = (r.left - hr.left) - (M * k) / dpr + 'px'; cv.style.top = (r.top - hr.top) - (M * k) / dpr + 'px';
      CX = PW / 2 + M; CY = PH / 2 + M; L = CX - TW / 2; T = CY - TH / 2; R = CX + TW / 2; B = CY + TH / 2;
      fitText();
    };
    var paintComet = function (c, head, col, hot, width) {
      c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.lineCap = 'round'; c.lineWidth = width * k;
      var step = 6, n = Math.ceil(TAIL * PERIM / step);
      for (var i = n; i >= 1; i--) {
        var s1 = head - i * step, s0 = head - (i - 1) * step, a = taper((i * step) / PERIM);
        if (a <= 0.002) continue;
        var f = Math.min(a, 1.30), x = Math.max(0, f - 1);
        var rr = Math.round(Math.min(255, col[0] * f + hot[0] * x)), g = Math.round(Math.min(255, col[1] * f + hot[1] * x)), b = Math.round(Math.min(255, col[2] * f + hot[2] * x));
        var p1 = ptAt(s1), mid = ptAt((s1 + s0) / 2), p0 = ptAt(s0);
        c.strokeStyle = 'rgb(' + rr + ',' + g + ',' + b + ')'; c.beginPath(); c.moveTo(p1[0] * k, p1[1] * k); c.lineTo(mid[0] * k, mid[1] * k); c.lineTo(p0[0] * k, p0[1] * k); c.stroke();
      }
    };
    var plate = function (c) {
      var y = CY - PH / 2, grd = c.createLinearGradient(0, y * k, 0, (y + PH) * k);
      grd.addColorStop(0, '#2e3242'); grd.addColorStop(0.55, '#2b2f3c'); grd.addColorStop(1, '#272c36');
      rrPath(c, CX * k, CY * k, PW * k, PH * k, PR * k); c.fillStyle = grd; c.fill();
      c.lineWidth = 5 * k; var hg = c.createLinearGradient(0, y * k, 0, (y + PH) * k);
      hg.addColorStop(0, 'rgba(226,233,255,0.125)'); hg.addColorStop(0.10, 'rgba(226,233,255,0)'); hg.addColorStop(0.90, 'rgba(80,100,255,0)'); hg.addColorStop(1, 'rgba(80,100,255,0.22)');
      rrPath(c, CX * k, CY * k, (PW - 13) * k, (PH - 13) * k, Math.max(0, (PR - 6.5)) * k); c.strokeStyle = hg; c.stroke();
    };
    var label = function (c, ph) {
      var q = ph - SHIM_OFF; q -= Math.floor(q); var u = q < 0.5 ? q / 0.5 : (1 - q) / 0.5;
      var bc = textX + textW * (-0.2375 + 1.475 * u), bw = textW * 0.22, g = c.createLinearGradient(bc - bw, 0, bc + bw, 0);
      g.addColorStop(0, 'rgb(83,92,135)'); g.addColorStop(0.30, 'rgb(97,106,150)'); g.addColorStop(0.5, 'rgb(133,141,189)'); g.addColorStop(0.70, 'rgb(97,106,150)'); g.addColorStop(1, 'rgb(83,92,135)');
      c.fillStyle = g; c.strokeStyle = g; c.font = FONT.replace('100px', fontPx + 'px'); c.textBaseline = 'alphabetic';
      c.fillText(text, textX, base); c.lineWidth = 1.9 * k; c.strokeText(text, textX, base);
    };
    var render = function (t) {
      if (!PERIM) return;
      var ph = (t / DUR) % 1; if (ph < 0) ph += 1; var head = ph * PERIM;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.clearRect(0, 0, cv.width, cv.height);
      rrPath(ctx, CX * k, CY * k, TW * k, TH * k, TR * k); ctx.lineWidth = TRACK_W * k; ctx.strokeStyle = 'rgba(120,140,255,0.048)'; ctx.stroke();
      paintComet(gx, head, [95, 125, 242], [50, 70, 120], GLOW_W); paintComet(cox, head, [82, 90, 110], [70, 60, 40], CORE_W);
      ctx.globalCompositeOperation = 'lighter';
      if (canFilter) { ctx.filter = 'blur(' + (28 * k) + 'px)'; ctx.globalAlpha = 0.62; ctx.drawImage(gl, 0, 0); ctx.filter = 'blur(' + (8 * k) + 'px)'; ctx.globalAlpha = 0.45; ctx.drawImage(gl, 0, 0); ctx.filter = 'blur(' + (1.8 * k) + 'px)'; ctx.globalAlpha = 1; ctx.drawImage(co, 0, 0); ctx.filter = 'none'; }
      else { ctx.shadowColor = 'rgba(88,122,255,0.9)'; ctx.shadowBlur = 26 * k; ctx.globalAlpha = 0.7; ctx.drawImage(gl, 0, 0); ctx.shadowBlur = 8 * k; ctx.globalAlpha = 0.8; ctx.drawImage(gl, 0, 0); ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.drawImage(co, 0, 0); }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      plate(ctx); label(ctx, ph);
    };
    var now = 0, last = null, raf = 0, alive = true, reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Reduced motion: one still frame, redrawn only when the label or the size changes.
    var frame = function (ts) { if (!alive) return; if (last != null) now = (now + (ts - last) / 1000) % DUR; last = ts; render(now); raf = requestAnimationFrame(frame); };
    var redraw = function () { resize(); if (reduced && alive) render(now); };
    var ro = window.ResizeObserver ? new ResizeObserver(redraw) : null; if (ro) ro.observe(btn); window.addEventListener('resize', redraw);
    resize(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (alive) { fitText(); if (reduced) render(now); } });
    if (reduced) render(now); else raf = requestAnimationFrame(frame);
    return {
      text: function (s) { if (s !== text) { text = s; fitText(); if (reduced) render(now); } },
      stop: function () { alive = false; cancelAnimationFrame(raf); if (ro) ro.disconnect(); window.removeEventListener('resize', redraw); cv.remove(); btn.classList.remove('has-thinking'); }
    };
  };
})();`;

export const THINKING_CSS = `
.tk-cv{position:absolute;z-index:3;pointer-events:none}
.has-thinking{color:transparent!important}
.has-thinking *{visibility:hidden}`;
