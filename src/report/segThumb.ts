// G-189: every segmented control (.seg, the screener's market tabs, the ops menu, the home banner's dots) gets one pill that slides to the
// chosen button instead of the colour jumping. The move is "chewy": the leading edge leaves first and stops dead at
// the new button, the trailing edge follows a beat later on a spring that overshoots inward, so the pill stretches,
// then snaps back narrower than its width before settling, and squashes a little on the way. Only the trailing edge
// overshoots, so the pill never pokes out of the track at either end. Pressing a different button already leans the pill toward it.
// A group where more than one button is on at once (toggles, not a choice) keeps its own per-button colours.
// The report's top tabs (.topbar>.chips) keep their own pill (REPORT_TABS_JS).

export const SEG_THUMB_CSS = `
:where(.has-thumb){position:relative;isolation:isolate}
.has-thumb>.seg-thumb{position:absolute;z-index:0;left:0;right:100%;top:0;height:0;border-radius:999px;pointer-events:none;opacity:0;
  background:var(--btn-bg);box-shadow:0 1px 3px rgba(0,0,0,.12),0 8px 18px -10px rgba(0,166,251,.55),inset 0 -1px rgba(0,0,0,.08);
  transition:left .42s cubic-bezier(.34,1.4,.64,1),right .42s cubic-bezier(.34,1.4,.64,1),top .3s var(--ease-out),height .3s var(--ease-out),opacity var(--dur-fast) var(--ease-out)}
.has-thumb>.seg-thumb.on{opacity:1}
.has-thumb>.seg-thumb[data-dir=r]{transition:right .3s cubic-bezier(.2,.9,.3,1),left .55s cubic-bezier(.34,1.32,.64,1) .06s,top .3s var(--ease-out),height .3s var(--ease-out),opacity var(--dur-fast) var(--ease-out)}
.has-thumb>.seg-thumb[data-dir=l]{transition:left .3s cubic-bezier(.2,.9,.3,1),right .55s cubic-bezier(.34,1.32,.64,1) .06s,top .3s var(--ease-out),height .3s var(--ease-out),opacity var(--dur-fast) var(--ease-out)}
.has-thumb>.seg-thumb.squish{animation:seg-squish .5s var(--ease-out)}
@keyframes seg-squish{0%{transform:scaleY(1)}35%{transform:scaleY(.84)}70%{transform:scaleY(1.04)}100%{transform:scaleY(1)}}
.has-thumb>.seg-thumb.still{transition:none!important}
.has-thumb>:not(.seg-thumb){position:relative;z-index:1}
.has-thumb:not(.thumb-off)>[aria-pressed=true],.has-thumb:not(.thumb-off)>[aria-selected=true]{background:transparent!important;box-shadow:none!important;border-color:transparent!important}
.thumb-off>.seg-thumb{display:none}
html.chart-fs .cfs-foot>.seg>.seg-thumb{background:var(--soft);box-shadow:none}
.bn-dots>.seg-thumb{height:6px!important;margin:10px 8px 0;background:#fff;box-shadow:0 0 10px rgba(255,255,255,.45)}
.find-tabs>.seg-thumb,.adm-tabs>.seg-thumb{background:var(--navy);box-shadow:0 8px 18px -10px rgba(0,166,251,.6)}
@media (prefers-reduced-motion:reduce){.has-thumb>.seg-thumb{transition:none!important;animation:none!important}}`;

export const SEG_THUMB_JS = `
(function () {
  var SEL = '.seg,.find-tabs,.adm-tabs,.bn-dots';
  var ON = '[aria-pressed=true],[aria-selected=true]';
  var kids = function (g) { var out = [], c = g.children; for (var i = 0; i < c.length; i++) if (c[i] !== g.__thumb) out.push(c[i]); return out; };
  var place = function (g, lean) {
    var t = g.__thumb; if (!t) return;
    var on = kids(g).filter(function (b) { return b.matches(ON); });
    g.classList.toggle('thumb-off', on.length > 1);
    var b = on.length === 1 ? on[0] : null;
    if (!b || !b.offsetWidth) { t.classList.remove('on'); g.__box = null; return; }
    var L = b.offsetLeft, R = g.clientWidth - L - b.offsetWidth, T = b.offsetTop, H = b.offsetHeight;
    if (lean) { if (lean > 0) R -= 6; else L -= 6; }
    var prev = g.__box;
    if (prev && !lean && prev.L !== L) {
      t.setAttribute('data-dir', L > prev.L ? 'r' : 'l');
      t.classList.remove('squish'); void t.offsetWidth; t.classList.add('squish');
    }
    t.style.left = L + 'px'; t.style.right = R + 'px'; t.style.top = T + 'px'; t.style.height = H + 'px';
    if (!lean) g.__box = { L: L };
    if (!t.classList.contains('on')) { t.classList.add('still'); t.classList.add('on'); void t.offsetWidth; t.classList.remove('still'); }
  };
  var setup = function (g) {
    if (g.__thumb) return;
    var t = document.createElement('i'); t.className = 'seg-thumb'; t.setAttribute('aria-hidden', 'true');
    g.insertBefore(t, g.firstChild); g.__thumb = t; g.classList.add('has-thumb');
    t.addEventListener('animationend', function () { t.classList.remove('squish'); });
    var settle = function () { place(g); };
    if (window.MutationObserver) new MutationObserver(settle).observe(g, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected', 'hidden'] });
    if (window.ResizeObserver) new ResizeObserver(function () { var t2 = g.__thumb; t2.classList.add('still'); place(g); void t2.offsetWidth; t2.classList.remove('still'); }).observe(g);
    g.addEventListener('pointerdown', function (e) {
      var b = e.target.closest && e.target.closest('button,a'); if (!b || b.parentNode !== g || b.matches(ON) || b.disabled || !g.__box) return;
      place(g, b.offsetLeft > g.__box.L ? 1 : -1);
    });
    // After the click: by then a changed choice has already moved the pill, so this only undoes a lean that led nowhere.
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (k) { g.addEventListener(k, function () { setTimeout(settle, 0); }); });
    place(g);
  };
  var start = function () {
    var all = document.querySelectorAll(SEL); for (var i = 0; i < all.length; i++) setup(all[i]);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { var l = document.querySelectorAll('.has-thumb'); for (var i = 0; i < l.length; i++) place(l[i]); });
    if (!window.MutationObserver) return;
    // Groups built later (the coin chart's units, lists filled by script): one query per frame that added elements,
    // for groups not yet set up, rather than a scan of every added node.
    var raf = 0, NEW = SEL.split(',').map(function (x) { return x + ':not(.has-thumb)'; }).join(',');
    new MutationObserver(function (ms) {
      if (raf) return;
      for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) if (ms[i].addedNodes[j].nodeType === 1) {
        raf = requestAnimationFrame(function () { raf = 0; var l = document.querySelectorAll(NEW); for (var k = 0; k < l.length; k++) setup(l[k]); });
        return;
      }
    }).observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();`;
