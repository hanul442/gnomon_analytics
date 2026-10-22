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
/* G-258 (한서님 10/19 '글래스모피즘으로', '화면마다 인터랙티브하게', '아이콘으로, 글자는 작게'): one glass pill. Icons only; the
   current one sits in a snug white pill with its name in a small bubble above. Each screen swaps the right side (.nav-ctx):
   찾기 a search field, 종목 the ask bar, 위원회 and 나 their own icons. The grid button opens the four tabs; tapping the
   current tab goes back. Reading down shrinks the bar. */
.bottom-nav,html[data-theme] body .bottom-nav{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:40;display:flex;align-items:center;gap:4px;
  width:auto;max-width:520px;margin:0 auto;height:64px;padding:0 7px;border:1px solid var(--glass-edge);border-radius:32px;background:var(--glass-bg);
  box-shadow:0 18px 40px -16px rgba(10,22,38,.38),inset 0 1px 0 var(--glass-hi),inset 0 -1px 0 rgba(255,255,255,.18);backdrop-filter:blur(24px) saturate(190%);-webkit-backdrop-filter:blur(24px) saturate(190%);
  transform-origin:50% 100%;transition:transform .38s cubic-bezier(.34,1.3,.64,1),opacity .3s}
.bottom-nav::before{content:"";position:absolute;inset:0;border-radius:inherit;background:radial-gradient(120% 90% at 20% -30%,var(--glass-hi),transparent 55%);opacity:.6;pointer-events:none}
html{--glass-bg:linear-gradient(180deg,rgba(255,255,255,.86),rgba(255,255,255,.68));--glass-edge:rgba(255,255,255,.75);--glass-hi:rgba(255,255,255,.9);--glass-pill:rgba(255,255,255,.95);--glass-soft:rgba(255,255,255,.7)}
html[data-theme=dark]{--glass-bg:linear-gradient(180deg,rgba(40,48,60,.82),rgba(18,22,30,.74));--glass-edge:rgba(255,255,255,.12);--glass-hi:rgba(255,255,255,.14);--glass-pill:rgba(255,255,255,.16);--glass-soft:rgba(255,255,255,.08)}
.bottom-nav.mini{transform:scale(.86) translateY(4px)}
.bottom-nav button{font:inherit}
.bottom-nav .nav-spark,.bottom-nav .nav-back,.bottom-nav .nav-round{position:relative;flex:0 0 50px;width:50px;height:50px;display:grid;place-items:center;padding:0;border:0;border-radius:50%;cursor:pointer;transition:transform .2s cubic-bezier(.34,1.5,.64,1)}
/* 한서님 10/19: no blue/orange glow; the ✦ is a plain dark glass button. */
.bottom-nav .nav-spark{color:var(--page);background:var(--fg);box-shadow:0 8px 18px -8px rgba(10,22,38,.55),inset 0 1px 0 rgba(255,255,255,.18)}
.bottom-nav .nav-back,.bottom-nav .nav-round{display:none;color:var(--fg);background:var(--glass-soft);border:1px solid var(--glass-edge)}
.bottom-nav .nav-round{display:grid}
.bottom-nav svg{width:23px;height:23px;flex:none}.bottom-nav .nav-spark svg,.bottom-nav .nav-back svg,.bottom-nav .nav-round svg{width:22px;height:22px}
.bottom-nav .nav-spark:active,.bottom-nav .nav-back:active,.bottom-nav .nav-round:active{transform:scale(.9)}
.nav-tabs,.nav-seg{position:relative;flex:1;min-width:0;display:flex;align-items:center;gap:2px}
.nav-ctx{display:none;flex:1;min-width:0;align-items:center;gap:4px}
.nav-tabs a,.nav-seg a,html[data-theme] .bottom-nav .nav-tabs a{position:relative;flex:1;min-width:0;height:50px;display:grid;place-items:center;padding:0;border-radius:25px;color:var(--muted);background:none;text-decoration:none;
  transition:color .2s,transform .2s}
.nav-tabs a svg,.nav-seg a svg{position:relative;z-index:1}
.nav-tabs a[aria-current=page]::before,.nav-seg a[aria-current=page]::before{content:"";position:absolute;left:50%;top:50%;width:58px;height:46px;margin:-23px 0 0 -29px;border-radius:23px;background:var(--glass-pill);
  box-shadow:0 6px 16px -8px rgba(10,22,38,.45),inset 0 -1px 0 rgba(0,0,0,.06);animation:nav-pill .38s cubic-bezier(.34,1.4,.64,1)}
.nav-tabs a[aria-current=page],.nav-seg a[aria-current=page],html[data-theme] .bottom-nav .nav-tabs a[aria-current=page]{color:var(--fg);background:none;box-shadow:none}
.nav-tabs a span,.nav-seg a span{position:absolute;z-index:2;bottom:47px;left:50%;transform:translateX(-50%);display:none;padding:3px 8px;border-radius:9px;font-size:11.5px;font-weight:700;line-height:1.3;white-space:nowrap;color:#fff;background:rgba(10,22,38,.84);box-shadow:0 4px 10px -4px rgba(0,0,0,.4);pointer-events:none}
.nav-tabs a span::after,.nav-seg a span::after{content:"";position:absolute;left:50%;top:100%;margin-left:-4px;border:4px solid transparent;border-top-color:rgba(10,22,38,.84)}
.nav-tabs a[aria-current=page] span,.nav-seg a[aria-current=page] span{display:block;animation:nav-tip .32s var(--ease-out)}
.bottom-nav.mini .nav-tabs a span,.bottom-nav.mini .nav-seg a span{display:none}
.nav-tabs a:active,.nav-seg a:active{transform:scale(.9);transition-duration:.08s}
.nav-seg a i{position:absolute;z-index:2;top:5px;left:calc(50% + 6px);min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#E5484D;color:#fff;font:800 10.5px/16px sans-serif;font-style:normal;text-align:center}
.bottom-nav .nav-field{flex-direction:row;justify-content:flex-start;flex:1;min-width:0;height:50px;display:flex;align-items:center;gap:9px;padding:0 16px;border:1px solid var(--glass-edge);border-radius:25px;background:var(--glass-soft);color:var(--muted);font-size:13px;text-align:left;cursor:text}
.nav-field svg{width:20px;height:20px}
.nav-round .nav-n{position:absolute;top:4px;right:4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--fg);color:var(--page);font:800 10.5px/16px sans-serif;font-style:normal;text-align:center}
body:has(.bottom-nav[data-dock=find]) .find-head{display:none}
/* G-263: 위원회 switches its pages from the bar, so the row of text tabs at the top goes on phones. */
body:has(.bottom-nav[data-dock=committee]) .mode-tabs{display:none}
/* G-277: a stock switches 위원회 · 차트 · 소식 from the bar, so its tab row at the top goes on phones. */
body:has(.bottom-nav[data-dock=ask]) .topbar>.chips:not(.analysis-tabs){display:none}
body:has(.bottom-nav[data-dock=parts]) .mode-tabs{display:none}
body:has(.bottom-nav:is([data-dock=find],[data-dock=me])) .mode-tabs{display:none}
.bottom-nav .nav-kind{flex:none;flex-direction:row;height:50px;display:flex;align-items:center;gap:2px;padding:0 8px 0 13px;border:1px solid var(--glass-edge);border-radius:25px;background:var(--glass-soft);color:var(--fg);font-size:13.5px;cursor:pointer}
.nav-kind b{white-space:nowrap}.nav-kind svg{width:16px!important;height:16px!important;transition:transform .2s}.nav-kind[aria-expanded=true] svg{transform:rotate(180deg)}
.nav-menu{position:absolute;right:8px;bottom:72px;z-index:3;display:grid;min-width:168px;padding:6px;border:1px solid var(--glass-edge);border-radius:22px;background:var(--surface-solid);box-shadow:0 22px 44px -18px rgba(10,22,38,.5);animation:nav-up .22s var(--ease-out)}
.nav-menu[hidden]{display:none}
.bottom-nav .nav-menu a{display:flex;justify-content:flex-start;align-items:center;width:auto;height:auto;min-height:44px;padding:0 14px;border-radius:16px;color:var(--fg);font-size:15px;font-weight:600;text-decoration:none}
.nav-menu a[aria-current=page]{background:var(--soft)}
.nav-menu a:active{transform:scale(.97)}
.nav-parts button{position:relative;flex:1;min-width:0;height:50px;display:grid;place-items:center;padding:0;border:0;border-radius:25px;color:var(--muted);background:none;cursor:pointer;transition:color .2s,transform .2s}
.nav-parts button svg{position:relative;z-index:1}
.nav-parts button[aria-selected=true]{color:var(--fg)}
.nav-parts button[aria-selected=true]::before{content:"";position:absolute;left:50%;top:50%;width:48px;height:46px;margin:-23px 0 0 -24px;border-radius:23px;background:var(--glass-pill);box-shadow:0 6px 16px -8px rgba(10,22,38,.45),inset 0 -1px 0 rgba(0,0,0,.06);animation:nav-pill .38s cubic-bezier(.34,1.4,.64,1)}
.nav-parts button span{position:absolute;z-index:2;bottom:47px;left:50%;transform:translateX(-50%);display:none;padding:3px 8px;border-radius:9px;font-size:11.5px;font-weight:700;line-height:1.3;white-space:nowrap;color:#fff;background:rgba(10,22,38,.84);pointer-events:none}
.nav-parts button[aria-selected=true] span{display:block;animation:nav-tip .32s var(--ease-out)}
.bottom-nav.mini .nav-parts button span{display:none}
.nav-parts button:active{transform:scale(.9);transition-duration:.08s}
.nav-parts a[aria-current=page]::before{width:52px;margin-left:-26px}
.bottom-nav .nav-ask-r{color:var(--page);background:var(--fg);border:0;box-shadow:0 8px 18px -8px rgba(10,22,38,.55)}
body.dock-searching .find-head{display:block!important;position:fixed;z-index:45;left:12px;right:12px;top:calc(10px + env(safe-area-inset-top));margin:0;animation:nav-up .3s var(--ease-out)}
body.dock-searching .find-head .search-results{max-height:calc(100dvh - 180px);overflow:auto}
body.dock-searching .find-head .search-box,body.dock-searching .find-head .search-results{background:var(--surface-solid,#fff)}
body.dock-searching::before{content:"";position:fixed;inset:0;z-index:44;background:rgba(10,12,16,.28);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:nav-up .25s}
.bottom-nav .nav-ask{flex-direction:row;justify-content:flex-start;flex:1;min-width:0;height:50px;display:flex;align-items:center;gap:9px;padding:0 5px 0 16px;border:1px solid var(--glass-edge);border-radius:25px;background:var(--glass-soft);color:var(--muted);font-size:13px;text-align:left;cursor:pointer}
.nav-ask svg{width:20px;height:20px}.nav-ask span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-ask i{flex:0 0 40px;height:40px;display:grid;place-items:center;border-radius:50%;color:var(--page);background:var(--fg)}.nav-ask i svg{width:19px;height:19px}
.nav-chips{position:absolute;left:0;right:0;bottom:74px;display:none;gap:7px;overflow-x:auto;scrollbar-width:none}
.nav-chips::-webkit-scrollbar{display:none}
.bottom-nav .nav-chips button{flex:none;flex-direction:row;min-height:0;height:32px;padding:0 12px;border:1px solid var(--glass-edge);border-radius:16px;background:var(--glass-bg);color:var(--fg);font-size:12.5px;font-weight:600;cursor:pointer;
  backdrop-filter:blur(18px) saturate(180%);-webkit-backdrop-filter:blur(18px) saturate(180%);box-shadow:0 8px 20px -12px rgba(10,22,38,.4)}
.bottom-nav.ctx .nav-tabs,.bottom-nav.ctx .nav-spark{display:none}
.bottom-nav.ctx .nav-back{display:grid;animation:nav-pop .4s cubic-bezier(.34,1.5,.64,1)}
.bottom-nav.ctx .nav-ctx{display:flex;animation:nav-in .38s var(--ease-out)}
/* G-267: the question chips no longer float over the page; the chat opens with its own suggested questions. */
.bottom-nav:not(.ctx) .nav-tabs{animation:nav-in .38s var(--ease-out)}
.bottom-nav.morph{animation:nav-squish .5s var(--ease-out)}
@keyframes nav-in{from{opacity:0;transform:translateX(10px)}}
@keyframes nav-up{from{opacity:0;transform:translateY(8px)}}
@keyframes nav-pop{from{opacity:0;transform:scale(.6) rotate(-45deg)}}
@keyframes nav-pill{from{opacity:0;transform:scale(.7)}}
@keyframes nav-tip{from{opacity:0;transform:translate(-50%,4px)}}
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
  // G-258: each screen's own bar (.nav-ctx) slides in shortly after the page opens; the grid button shows the four
  // tabs and tapping the current tab goes back. Reading down shrinks the bar, scrolling up grows it.
  var nav = document.querySelector('.bottom-nav'); if (!nav) return;
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var set = function (on) { nav.classList.toggle('ctx', on); nav.classList.remove('morph'); void nav.offsetWidth; if (!still) nav.classList.add('morph'); };
  nav.addEventListener('animationend', function (e) { if (e.target === nav) nav.classList.remove('morph'); });
  var lastY = window.scrollY || 0, ticking = false;
  window.addEventListener('scroll', function () { if (ticking) return; ticking = true; requestAnimationFrame(function () { var y = window.scrollY || 0; if (Math.abs(y - lastY) > 6) { nav.classList.toggle('mini', y > lastY && y > 80); lastY = y; } ticking = false; }); }, { passive: true });
  if (!nav.hasAttribute('data-dock')) return;
  var t = setTimeout(function () { set(true); }, still ? 0 : 600);
  var back = nav.querySelector('.nav-back'); if (back) back.addEventListener('click', function () { clearTimeout(t); set(false); });
  nav.querySelectorAll('.nav-tabs a').forEach(function (a) { a.addEventListener('click', function (e) { if (a.getAttribute('aria-current') === 'page' && !nav.classList.contains('ctx')) { e.preventDefault(); set(true); } }); });
  var field = nav.querySelector('[data-dock-search]');
  // G-260: on phones 찾기's own search box hides; the bar's field opens it at the top of the screen.
  var q = document.getElementById('q'), head = document.querySelector('.find-head');
  var search = function () { if (!q) { location.href = (document.body.getAttribute('data-base') || '') + 'screener.html#search'; return; } document.body.classList.add('dock-searching'); q.focus(); };
  if (field) field.addEventListener('click', search);
  if (q && head && field) {
    q.addEventListener('blur', function () { setTimeout(function () { if (!q.value && document.activeElement !== q) document.body.classList.remove('dock-searching'); }, 200); });
    q.addEventListener('keydown', function (e) { if (e.key === 'Escape') { q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); q.blur(); document.body.classList.remove('dock-searching'); } });
    if (location.hash === '#search') setTimeout(search, 300);
  }
  // G-277: 찾기's kind menu in the bar. On screener.html the four markets switch in place through the (hidden) row.
  var kind = nav.querySelector('[data-dock-kind]'), menu = nav.querySelector('.nav-menu');
  if (kind && menu) {
    var shut = function () { menu.hidden = true; kind.setAttribute('aria-expanded', 'false'); };
    kind.addEventListener('click', function (e) { e.stopPropagation(); var open = menu.hidden; menu.hidden = !open; kind.setAttribute('aria-expanded', String(open)); });
    document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target)) shut(); });
    var label = function (k) { var a = menu.querySelector('[data-find-go="' + k + '"]'); if (!a) return; kind.querySelector('b').textContent = a.textContent; menu.querySelectorAll('a').forEach(function (x) { if (x === a) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); }); };
    menu.querySelectorAll('[data-find-go]').forEach(function (a) { a.addEventListener('click', function (e) { var k = a.getAttribute('data-find-go'), t = document.querySelector('.mode-tabs [data-find="' + k + '"]'); if (!t) return; e.preventDefault(); t.click(); label(k); shut(); window.scrollTo({ top: 0, behavior: 'smooth' }); }); });
    var on = document.querySelector('.mode-tabs [data-find][aria-selected=true]'); if (on) label(on.getAttribute('data-find'));
    if (window.MutationObserver) document.querySelectorAll('.mode-tabs [data-find]').forEach(function (t) { new MutationObserver(function () { if (t.getAttribute('aria-selected') === 'true') label(t.getAttribute('data-find')); }).observe(t, { attributes: true, attributeFilter: ['aria-selected'] }); });
  }
  var flt = nav.querySelector('[data-dock-filter]'), open = document.getElementById('sc-filter-open');
  // G-260: the filter count rides on the bar's filter button.
  if (flt) { if (open) { flt.addEventListener('click', function () { open.click(); }); var n = document.getElementById('sc-filter-n'), badge = document.createElement('i'); badge.className = 'nav-n'; flt.appendChild(badge); var sync = function () { badge.textContent = n ? n.textContent : ''; badge.hidden = !badge.textContent; }; sync(); if (n && window.MutationObserver) new MutationObserver(sync).observe(n, { childList: true, characterData: true, subtree: true }); } else flt.remove(); }
  nav.querySelectorAll('[data-q]').forEach(function (b) { b.addEventListener('click', function () { var q = b.getAttribute('data-q'); setTimeout(function () { var box = document.getElementById('chat-q'); if (box) { box.value = q; box.dispatchEvent(new Event('input', { bubbles: true })); box.focus(); } }, 60); }); });
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
/* G-277 (한서님 10/21 '종목 탭도 와...진짜 너무 길더라'): the shorter 위원회 part. */
.kp-line{margin:8px 0 0;font-size:13px;color:var(--muted);line-height:1.5}.kp-line b{color:var(--fg2);font-weight:700}
.vf .card{padding:18px 18px 6px}.vf-h{margin:0;font-size:16px}.vf-bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;margin:12px 0 6px}.vf-bar i{background:var(--line-strong)}.vf-bar i.up{background:var(--up)}.vf-bar i.down{background:var(--down)}
.vf-l{display:flex;justify-content:space-between;font-size:13px;font-weight:700}.vf-l .up{color:var(--up)}.vf-l .down{color:var(--down)}
.ai-fold,.cal-fold{margin-top:10px;border-top:1px solid var(--line)}.ai-fold>summary,.cal-fold>summary{display:flex;align-items:center;justify-content:space-between;min-height:52px;font-size:15px;font-weight:600;cursor:pointer;list-style:none}
.ai-fold>summary::-webkit-details-marker,.cal-fold>summary::-webkit-details-marker{display:none}.ai-fold>summary::after,.cal-fold>summary::after{content:"⌄";color:var(--muted);transition:transform .2s}.ai-fold[open]>summary::after,.cal-fold[open]>summary::after{transform:rotate(180deg)}
.ai-fold[open]>summary{border-bottom:1px solid var(--line);margin-bottom:8px}.ai-in{margin:0 -4px}
.cal-fold{margin:16px 0;padding:0 18px;border:0;border-radius:24px;background:var(--surface)}
#tab-ai .ai-nav{position:static!important}.ai-in #conclusion{display:none}
.lv-foot{border:0!important;padding:0!important;margin:12px 0!important}.lv-foot>p,.lv-foot>.lv-pick{display:none!important}
.cfs-foot .cfs-sig{width:auto!important;padding:0 12px!important;font-size:13.5px;font-weight:700;color:var(--fg);text-decoration:none;display:inline-flex;align-items:center}
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
