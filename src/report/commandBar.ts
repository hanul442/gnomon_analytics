// G-183: the command bar. Ported from ThreeUI Community's AnimatedTopDock "modern" variant
// (MengTo/threeui, MIT; src/shaders/animated-top-dock): the pill bar, the glass hover cells, the white
// active pill, and the proximity dock whose cells grow towards the pointer on a spring. Re-cut for GNOMON:
// our navy instead of the source's violet aurora, our four tabs + 전체, the account pill as the call to
// action, and on phones the same bar floats at the bottom in place of the old full-width tab strip.
//
// The header stays dark in both themes (--bar), so the bar keeps the source's dark palette everywhere;
// the phone bar uses the same glass so the two read as one control.

/** Styles. Desktop: the header row becomes the pill bar. Phones: the bottom nav becomes a floating pill. */
export const COMMAND_BAR_CSS = `
@media (min-width:821px){
.topbar::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:-1;
  background:radial-gradient(52% 60% at 24% 40%,rgba(0,166,251,.20),transparent 68%),radial-gradient(44% 54% at 78% 22%,rgba(5,130,202,.18),transparent 70%),radial-gradient(36% 46% at 52% 8%,rgba(0,100,148,.22),transparent 72%);filter:blur(10px)}
.topbar{isolation:isolate;border-bottom:0}
.topbar-in{width:max-content;max-width:min(1240px,calc(100% - 48px));margin:10px auto;padding:6px 6px 6px 18px;gap:clamp(14px,2.4vw,40px);
  border:1px solid rgba(255,255,255,.06);border-radius:999px;background:linear-gradient(180deg,rgba(19,34,58,.86),rgba(8,16,28,.82));
  box-shadow:0 22px 52px -24px rgba(0,0,0,.92),inset 0 1px rgba(255,255,255,.05);backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%)}
.topbar-in .brand{flex:none}
.top-tabs{display:flex;flex:none;gap:3px;align-items:flex-start;justify-content:center;height:38px;margin:0}
.top-tabs a,.top-tabs button{display:inline-flex;flex:none;gap:7px;align-items:center;justify-content:center;height:38px;padding:0 15px;border:1px solid transparent;border-radius:999px;
  color:#9AA8B8;background:transparent;font:inherit;font-size:14px;font-weight:600;letter-spacing:-.005em;white-space:nowrap;text-decoration:none;cursor:pointer;outline:none;
  transform-origin:50% 0;will-change:width,height,transform;transition:color .16s,border-color .18s,background .18s,box-shadow .18s}
.top-tabs svg{width:18px;height:18px;opacity:.72;transition:opacity .16s}
.top-tabs [data-dock-near=true],.top-tabs a:hover,.top-tabs button:hover,.top-tabs a:focus-visible,.top-tabs button:focus-visible{color:#F4F7FA;border-color:rgba(255,255,255,.06);background:rgba(255,255,255,.06);
  box-shadow:0 8px 20px -14px rgba(0,0,0,.9),inset 0 1px rgba(255,255,255,.05);backdrop-filter:blur(18px) saturate(170%);-webkit-backdrop-filter:blur(18px) saturate(170%)}
.top-tabs [aria-current=page],.top-tabs [aria-expanded=true]{color:#0A1626;border-color:transparent;background:linear-gradient(180deg,#ffffff,#dfe6f0);box-shadow:0 10px 24px -12px rgba(0,166,251,.7),inset 0 -1px rgba(0,0,0,.14)}
.top-tabs [data-dock-near=true] svg,.top-tabs [aria-current=page] svg,.top-tabs [aria-expanded=true] svg{opacity:1}
.top-tabs a:focus-visible,.top-tabs button:focus-visible{box-shadow:0 0 0 2px #00A6FB}
.top-links{gap:6px;align-items:center}
.top-links .acct{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 16px;border-radius:999px;color:#0A1626;background:linear-gradient(180deg,#ffffff,#d8e2ee);font-weight:700;
  box-shadow:0 10px 26px -14px rgba(0,166,251,.95),inset 0 -1px rgba(0,0,0,.16);transition:transform .18s cubic-bezier(.22,1,.36,1),box-shadow .18s}
.top-links .acct:hover{color:#0A1626;background:linear-gradient(180deg,#ffffff,#d8e2ee);transform:translateY(-1px);box-shadow:0 16px 32px -14px rgba(0,166,251,1),inset 0 -1px rgba(0,0,0,.16)}
.top-links .acct i{font-style:normal;color:#3A4A5C;font-weight:600}
.top-links .bell-btn,.top-links .install-btn{height:38px;border:0;border-radius:999px;color:#C3CDD6;background:transparent;transition:color .16s,background .16s}
.top-links .bell-btn{width:38px}
.top-links .bell-btn:hover,.top-links .install-btn:hover{color:#F4F7FA;background:rgba(255,255,255,.06)}
}
@media (max-width:820px){
.bottom-nav{left:50%;right:auto;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;gap:2px;width:max-content;max-width:calc(100% - 24px);padding:6px;
  border:1px solid rgba(255,255,255,.07);border-radius:999px;background:linear-gradient(180deg,rgba(19,34,58,.92),rgba(6,16,28,.92));
  box-shadow:0 18px 40px -16px rgba(0,0,0,.65),inset 0 1px rgba(255,255,255,.05);backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%)}
html[data-theme=dark] .bottom-nav{background:linear-gradient(180deg,rgba(19,34,58,.92),rgba(6,16,28,.92))}
.bottom-nav a,.bottom-nav button{flex-direction:row;flex:none;gap:6px;height:46px;min-width:48px;padding:0 13px;border-radius:999px;color:#9AA8B8;font-size:13.5px;font-weight:700;
  transition:color .16s,background .2s,transform .32s cubic-bezier(.34,1.56,.64,1)}
.bottom-nav a span,.bottom-nav button span{display:none}
.bottom-nav [aria-current=page] span,.bottom-nav [aria-expanded=true] span{display:inline}
.bottom-nav [aria-current=page],.bottom-nav [aria-expanded=true]{color:#0A1626;font-weight:800;background:linear-gradient(180deg,#ffffff,#dfe6f0);box-shadow:0 10px 22px -12px rgba(0,166,251,.75),inset 0 -1px rgba(0,0,0,.14)}
.bottom-nav a:active,.bottom-nav button:active{transform:scale(.9);transition-duration:.08s}
.bottom-nav svg{width:22px;height:22px}
body:has(.bottom-nav){padding-bottom:calc(76px + env(safe-area-inset-bottom))}
}
@media (prefers-reduced-motion:reduce){.top-tabs a,.top-tabs button{transform:none!important}.bottom-nav a,.bottom-nav button{transition:none}}`;

/**
 * The proximity dock, ported from topDockController.ts (lockTrack mode) to ES5 for assets/ui.js.
 * Only runs where the source runs it: a fine pointer, wider than 600px, motion allowed.
 * Settings are the ones the integration asked for: proximity 122, spring .19, damping .70,
 * width +17, height +16, drop 3.5.
 */
export const COMMAND_BAR_JS = `
(function () {
  var root = document.querySelector('.top-tabs'); if (!root || !window.matchMedia) return;
  var O = { proximity: 122, spring: 0.19, damping: 0.7, widthGrowth: 17, heightGrowth: 16, drop: 3.5 };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)'), precise = matchMedia('(hover:hover) and (pointer:fine)');
  var els = Array.prototype.slice.call(root.querySelectorAll('a,button'));
  els.forEach(function (e) { e.setAttribute('data-dock-item', ''); });
  var items = els.map(function (e) { return { el: e, w: 0, h: 0, cx: 0, v: 0, vel: 0, t: 0 }; });
  var enabled = false, active = false, dirty = false, frame = 0;
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var can = function () { return !reduced.matches && root.clientWidth > 0 && window.innerWidth > 600 && precise.matches; };
  var measure = function () {
    enabled = can(); root.style.width = '';
    items.forEach(function (s) { s.el.style.width = ''; s.el.style.height = ''; s.el.style.transform = ''; s.el.setAttribute('data-dock-near', 'false'); });
    items.forEach(function (s) { var r = s.el.getBoundingClientRect(); s.w = r.width; s.h = r.height; s.cx = r.left + r.width / 2 - root.getBoundingClientRect().left; s.v = 0; s.vel = 0; s.t = 0; });
    active = false; dirty = false;
    root.style.width = root.getBoundingClientRect().width.toFixed(2) + 'px';
    root.setAttribute('data-dock-state', enabled ? 'idle' : 'static');
  };
  var targets = function (x) {
    if (!enabled) return;
    // distances from the rest centres: the row grows around a locked track, so live centres would move under a still pointer
    var left = root.getBoundingClientRect().left;
    items.forEach(function (s) {
      var p = clamp(1 - Math.abs(x - (left + s.cx)) / Math.max(1, O.proximity), 0, 1), f = p * p * (3 - 2 * p);
      s.t = f; s.el.setAttribute('data-dock-near', f > 0.08 ? 'true' : 'false');
    });
    active = true; dirty = true; root.setAttribute('data-dock-state', 'active'); kick();
  };
  var focusItem = function (el) {
    if (!enabled) return;
    var i = els.indexOf(el); if (i < 0) return;
    items.forEach(function (s, j) { s.t = j === i ? 1 : Math.abs(j - i) === 1 ? 0.24 : 0; s.el.setAttribute('data-dock-near', s.t > 0.08 ? 'true' : 'false'); });
    active = false; dirty = true; root.setAttribute('data-dock-state', 'focus'); kick();
  };
  var reset = function () { active = false; dirty = true; items.forEach(function (s) { s.t = 0; s.el.setAttribute('data-dock-near', 'false'); }); kick(); };
  // the frame loop runs only while a cell is still moving (the source kept it running for the page's life)
  var kick = function () { if (!frame && enabled) frame = requestAnimationFrame(draw); };
  var layout = function () {
    items.forEach(function (s) {
      var v = clamp(s.v, 0, 1.08), ew = Math.min(O.widthGrowth, s.w * 0.24);
      s.el.style.width = (s.w + ew * v).toFixed(2) + 'px';
      s.el.style.height = (s.h + O.heightGrowth * v).toFixed(2) + 'px';
      s.el.style.transform = 'translateY(' + (v * O.drop).toFixed(2) + 'px)';
    });
  };
  var draw = function () {
    if (enabled && dirty) {
      var moving = false;
      items.forEach(function (s) {
        s.vel += (s.t - s.v) * O.spring; s.vel *= O.damping; s.v += s.vel;
        if (Math.abs(s.t - s.v) < 0.001 && Math.abs(s.vel) < 0.001) { s.v = s.t; s.vel = 0; } else moving = true;
      });
      layout();
      if (!moving) { dirty = false; if (items.every(function (s) { return s.t === 0; })) root.setAttribute('data-dock-state', 'idle'); }
    }
    frame = dirty ? requestAnimationFrame(draw) : 0;
  };
  root.addEventListener('pointermove', function (e) { targets(e.clientX); });
  root.addEventListener('pointerleave', reset);
  root.addEventListener('focusin', function (e) { var it = e.target.closest && e.target.closest('[data-dock-item]'); if (it) focusItem(it); });
  root.addEventListener('focusout', function () { requestAnimationFrame(function () { if (!root.contains(document.activeElement)) reset(); }); });
  root.addEventListener('click', reset);
  window.addEventListener('pointermove', function (e) {
    if (!active) return;
    var r = root.getBoundingClientRect(), bottom = r.bottom;
    items.forEach(function (s) { bottom = Math.max(bottom, s.el.getBoundingClientRect().bottom); });
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > bottom) reset();
  }, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if (window.ResizeObserver) new ResizeObserver(measure).observe(root.parentElement || root);
  if (reduced.addEventListener) { reduced.addEventListener('change', measure); precise.addEventListener('change', measure); }
  measure();
})();`;
