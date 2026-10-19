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
/* G-248: one floating bar (한서님 10/18 '통일된 하단바가 인터랙티브하게'): the ✦ AI button and the five tabs, the current tab a dark
   pill with its name. On stock and report pages it turns into an ask bar after the page opens; the grid button brings the tabs back. */
.bottom-nav,html[data-theme] body .bottom-nav{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));transform:none;z-index:40;display:flex;align-items:center;gap:6px;
  width:auto;max-width:520px;margin:0 auto;height:62px;padding:6px;border:1px solid var(--glass-line);border-radius:31px;background:var(--nav-bg);
  box-shadow:0 18px 40px -16px rgba(10,22,38,.38),0 2px 6px rgba(10,22,38,.06);backdrop-filter:blur(24px) saturate(170%);-webkit-backdrop-filter:blur(24px) saturate(170%)}
html{--nav-bg:rgba(255,255,255,.76)}html[data-theme=dark]{--nav-bg:rgba(19,34,58,.78)}
.bottom-nav .nav-spark,.bottom-nav .nav-back{flex:0 0 50px;width:50px;height:50px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;color:#fff;background:var(--brand-grad);
  box-shadow:0 8px 18px -8px rgba(0,166,251,.8);cursor:pointer;transition:transform .2s cubic-bezier(.34,1.5,.64,1)}
.bottom-nav .nav-back{display:none;color:var(--fg);background:var(--soft);box-shadow:none}
.bottom-nav .nav-spark svg,.bottom-nav .nav-back svg{width:22px;height:22px}.bottom-nav .nav-spark:active,.bottom-nav .nav-back:active{transform:scale(.9)}
.nav-tabs{flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between}
.nav-tabs a,html[data-theme] .bottom-nav .nav-tabs a{display:flex;flex-direction:row;align-items:center;gap:5px;height:50px;min-width:0;padding:0 11px;border-radius:25px;color:var(--muted);background:none;
  font-size:13px;font-weight:700;white-space:nowrap;text-decoration:none;transition:background .3s cubic-bezier(.34,1.3,.64,1),color .2s,padding .3s cubic-bezier(.34,1.3,.64,1)}
.nav-tabs a span{display:none}
.nav-tabs [aria-current=page],html[data-theme] .bottom-nav .nav-tabs [aria-current=page]{padding:0 14px 0 12px;color:var(--page);background:var(--fg);font-weight:700;box-shadow:0 6px 14px -8px rgba(10,22,38,.6)}
.nav-tabs [aria-current=page] span{display:inline;animation:nav-in .32s var(--ease-out)}
.nav-tabs a:active{transform:scale(.92);transition-duration:.08s}
.nav-tabs svg{width:23px;height:23px;flex:none}
.bottom-nav .nav-ask{display:none;flex:1;flex-direction:row;min-width:0;height:50px;align-items:center;justify-content:space-between;gap:8px;padding:0 0 0 14px;border:0;background:none;color:var(--muted);font:inherit;font-size:15px;font-weight:500;text-align:left;cursor:pointer}
.nav-ask span{display:block;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-ask i{flex:0 0 42px;height:42px;display:grid;place-items:center;border-radius:50%;color:var(--page);background:var(--fg)}.nav-ask i svg{width:20px;height:20px}
.bottom-nav.asking .nav-tabs,.bottom-nav.asking .nav-spark{display:none}
.bottom-nav.asking .nav-back{display:grid;animation:nav-pop .4s cubic-bezier(.34,1.5,.64,1)}
.bottom-nav.asking .nav-ask{display:flex;animation:nav-in .38s var(--ease-out)}
.bottom-nav:not(.asking) .nav-tabs{animation:nav-in .38s var(--ease-out)}
.bottom-nav.morph{animation:nav-squish .5s var(--ease-out)}
@keyframes nav-in{from{opacity:0;transform:translateX(10px)}}
@keyframes nav-pop{from{opacity:0;transform:scale(.6) rotate(-45deg)}}
@keyframes nav-squish{0%{transform:scaleX(1)}35%{transform:scaleX(.96) scaleY(1.04)}70%{transform:scaleX(1.01)}100%{transform:none}}
body:has(.bottom-nav){padding-bottom:calc(92px + env(safe-area-inset-bottom))}
}
@media (prefers-reduced-motion:reduce){.bottom-nav,.bottom-nav *{animation:none!important}}
@media (prefers-reduced-motion:reduce){.top-tabs a,.top-tabs button{transform:none!important}.bottom-nav a,.bottom-nav button{transition:none}}`;

/**
 * The proximity dock, ported from topDockController.ts (lockTrack mode) to ES5 for assets/ui.js.
 * Only runs where the source runs it: a fine pointer, wider than 600px, motion allowed.
 * Settings are the ones the integration asked for: proximity 122, spring .19, damping .70,
 * width +17, height +16, drop 3.5.
 */
export const COMMAND_BAR_JS = `
(function () {
  // G-248: on stock and report pages the bottom bar turns into the ask bar shortly after the page opens.
  var nav = document.querySelector('.bottom-nav[data-ask-mode]'); if (!nav) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var set = function (on) { nav.classList.toggle('asking', on); nav.classList.remove('morph'); void nav.offsetWidth; if (!still) nav.classList.add('morph'); };
  nav.addEventListener('animationend', function (e) { if (e.target === nav) nav.classList.remove('morph'); });
  var back = nav.querySelector('.nav-back'); if (back) back.addEventListener('click', function () { set(false); clearTimeout(t); });
  var t = setTimeout(function () { set(true); }, still ? 0 : 900);
})();
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

/**
 * G-185: the report's own tabs (요약·타이밍·기업 체력·AI 위원회·뉴스·공시) sit in the same floating glass pill as the
 * phone's bottom bar, and the white pill slides from tab to tab on a spring instead of jumping.
 */
export const REPORT_TABS_CSS = `
.chips [role=tab][hidden]{display:none!important}
.topbar>.chips:not(.analysis-tabs){position:relative;width:max-content;max-width:calc(100% - 24px);margin:2px auto 10px;padding:5px;gap:2px;
  border:1px solid rgba(255,255,255,.07);border-radius:999px;background:linear-gradient(180deg,rgba(19,34,58,.92),rgba(6,16,28,.92));
  box-shadow:0 14px 32px -16px rgba(0,0,0,.7),inset 0 1px rgba(255,255,255,.05);backdrop-filter:blur(22px) saturate(150%);-webkit-backdrop-filter:blur(22px) saturate(150%);overflow-x:auto;scrollbar-width:none}
.topbar>.chips:not(.analysis-tabs)::-webkit-scrollbar{display:none}
.topbar>.chips:not(.analysis-tabs) a{position:relative;z-index:1;display:inline-flex;align-items:center;height:38px;min-height:0;padding:0 15px;border:0;border-radius:999px;background:transparent;color:#9AA8B8;font-size:14px;font-weight:700;white-space:nowrap;
  transition:color .25s,transform .32s var(--ease-spring)}
.topbar>.chips:not(.analysis-tabs) a:hover{background:transparent;color:#F4F7FA}
.topbar>.chips:not(.analysis-tabs) a[aria-selected=true]{color:#0A1626;background:transparent}
.topbar>.chips:not(.has-ind) a[aria-selected=true]{background:linear-gradient(180deg,#ffffff,#dfe6f0)}
.topbar>.chips:not(.analysis-tabs) a:active{transform:scale(.92);transition-duration:.08s}
.topbar>.chips:not(.analysis-tabs) a:focus-visible{outline:2px solid #00A6FB;outline-offset:-2px}
.chips-ind{position:absolute;z-index:0;top:5px;bottom:5px;left:0;width:0;border-radius:999px;pointer-events:none;background:linear-gradient(180deg,#ffffff,#dfe6f0);
  box-shadow:0 10px 22px -12px rgba(0,166,251,.75),inset 0 -1px rgba(0,0,0,.14);transition:transform .46s cubic-bezier(.34,1.32,.64,1),width .46s cubic-bezier(.34,1.32,.64,1)}
@media (max-width:820px){.topbar>.chips:not(.analysis-tabs){margin:0 auto 8px}.topbar>.chips:not(.analysis-tabs) a{height:36px;padding:0 11px;font-size:13.5px}}
@media (max-width:360px){.topbar>.chips:not(.analysis-tabs) a{padding:0 9px;font-size:13px}}
@media (prefers-reduced-motion:reduce){.chips-ind{transition:none}.topbar>.chips:not(.analysis-tabs) a{transition:none}}`;

export const REPORT_TABS_JS = `
(function () {
  var bar = document.querySelector('.topbar>.chips:not(.analysis-tabs)'); if (!bar) return;
  var ind = document.createElement('i'); ind.className = 'chips-ind'; ind.setAttribute('aria-hidden', 'true'); bar.insertBefore(ind, bar.firstChild); bar.classList.add('has-ind');
  var place = function () {
    var on = bar.querySelector('a[aria-selected=true]'); if (!on || !on.offsetWidth) { ind.style.width = '0'; return; }
    ind.style.width = on.offsetWidth + 'px'; ind.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    var l = on.offsetLeft - 12, r = on.offsetLeft + on.offsetWidth + 12;
    if (l < bar.scrollLeft) bar.scrollTo({ left: l, behavior: 'smooth' }); else if (r > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: r - bar.clientWidth, behavior: 'smooth' });
  };
  ind.style.transition = 'none'; place(); void ind.offsetWidth; ind.style.transition = '';
  if (window.MutationObserver) new MutationObserver(place).observe(bar, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'hidden'] });
  window.addEventListener('resize', place); if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
})();`;
