// G-286 (한서님 10/23 '전체적으로 애니메이션이 쫀득하게', '모든 ui 한번 점검하고 통일성과 애니메이션', '직관적이지 않고
// 통일되지 않은것도 점검'): the motion that ties the screens together, on the spring tokens in motionTokens.ts, and the
// look rules the screen audit found drifting (https://claude.ai/artifact/EUYq685WEVuHrKk8gdDHck).
//
// Motion
//  - Bottom bar: the chosen icon's pill slides to the next one and stretches on the way (segThumb.ts drives it, the
//    same chewy pill as every segmented control) and the icon pops. The pill takes the button's own height, so it fits
//    both the icon-only bar and the bar with names under the icons.
//  - Parts and tabs: the part that opens comes in from the side it lives on (right of the old one → from the right).
//  - Sheets: the chart sheet rises from the bottom on a spring, leaves downward, and can be dragged down to close;
//    dialogs and sheets on phones rise in on the same spring.
//  - Big numbers count up once when they come into view, and again when their part opens; charts open from the left.
//  - Only transform, opacity and clip-path move, so mid-range Android phones keep 60fps. Readers who ask for less
//    motion get none: STYLE zeroes every duration and the script below does nothing.
// Look (audit U1–U7): one weight for the big number of a screen, one segmented control (grey track + white pill),
// three corner radii (cards 20, inner blocks 14, pills round), white cards only, two badge kinds (state dark,
// category grey; red and blue stay for prices), links in section heads look like links, notes look like notes.
// The AI chat has its own motion (thread 'AI 질문 채팅 인터랙션') and is left alone here.

export const MOTION_SYSTEM_CSS = `
:root{--seg-pill:#ffffff;--seg-pill-shadow:0 1px 2px rgba(10,22,38,.10),0 4px 12px -6px rgba(10,22,38,.25)}
html[data-theme=dark]{--seg-pill:rgba(255,255,255,.16);--seg-pill-shadow:0 1px 2px rgba(0,0,0,.3)}
/* ---- one segmented control: grey track, white pill that slides (themes' black pill and the 기업 tabs' still box were different) ---- */
:root body .has-thumb>.seg-thumb,:root body .find-tabs>.seg-thumb,:root body .adm-tabs>.seg-thumb{background:var(--seg-pill);box-shadow:var(--seg-pill-shadow)}
:root body .seg.has-thumb:not(.thumb-off)>[aria-pressed=true],:root body .seg.has-thumb:not(.thumb-off)>[aria-selected=true],:root body .find-tabs.has-thumb:not(.thumb-off)>[aria-selected=true],:root body .subtabs.has-thumb:not(.thumb-off)>[aria-pressed=true],:root body .wd-filter.has-thumb:not(.thumb-off)>[aria-pressed=true]{color:var(--fg)!important}
:root body .wd-filter{display:inline-flex;flex-wrap:nowrap;gap:2px;padding:3px;border-radius:999px;background:var(--soft)}
:root body .wd-filter button{min-height:32px;border:0;background:transparent;color:var(--fg2)}
:root body .subtabs{border-radius:999px;padding:3px}:root body .subtabs button{border-radius:999px;background:transparent}
html.chart-fs .cfs-foot>.seg>.seg-thumb,.bn-dots>.seg-thumb{box-shadow:none}
/* ---- bottom bar: the pill is the sliding thumb; the old per-icon pills step aside ---- */
@media (max-width:820px){
:root body .bottom-nav .has-thumb>a::before,:root body .bottom-nav .has-thumb>button::before{display:none}
:root body .bottom-nav .has-thumb>.seg-thumb{background:var(--glass-pill);box-shadow:0 6px 16px -8px rgba(10,22,38,.45),inset 0 -1px 0 rgba(0,0,0,.06);border-radius:25px;margin:0 3px}
:root body .bottom-nav .has-thumb>.seg-thumb.squish{animation:ms-bar-squish var(--d-snappy) var(--spring-snappy)}
@keyframes ms-bar-squish{0%{transform:scaleY(1)}40%{transform:scaleY(.9)}100%{transform:none}}
.bottom-nav .ms-pop svg{animation:ms-pop var(--d-bouncy) var(--spring-bouncy)}
@keyframes ms-pop{from{transform:scale(.72)}to{transform:none}}
}
/* ---- parts and tabs come in from their side ---- */
html.ms .ms-in{animation:ms-in-r var(--d-soft) var(--spring-soft) both!important}
html.ms .ms-in[data-ms-from=l]{animation-name:ms-in-l!important}
@keyframes ms-in-r{from{opacity:0;transform:translate3d(28px,0,0)}}
@keyframes ms-in-l{from{opacity:0;transform:translate3d(-28px,0,0)}}
/* ---- sheets ---- */
html.mo .gsh-sheet[open]{animation:ms-sheet-up var(--d-snappy) var(--spring-snappy)}
@keyframes ms-sheet-up{from{transform:translate3d(0,100%,0)}to{transform:none}}
.gsh-sheet{box-shadow:0 -10px 40px rgba(0,0,0,.18),0 60px 0 0 var(--surface-solid)}
.gsh-sheet .gsh-grab,.gsh-sheet .gsh-top{touch-action:none;cursor:grab}
.gsh-sheet.ms-drag{animation:none!important;transition:none!important}
html.mo .gsh-sheet[open]::backdrop{transition:opacity var(--dur-base) var(--ease-out)}
html.mo dialog.ms-closing{animation:none!important;transition:transform var(--d-out) var(--ease-exit),opacity var(--d-out) var(--ease-exit)!important;opacity:0;transform:translate3d(0,24px,0)}
html.mo .gsh-sheet.ms-closing{opacity:1;transform:translate3d(0,105%,0);transition-duration:240ms!important}
html.mo dialog.ms-closing::backdrop{opacity:0}
@media (max-width:820px){html.mo .sheet:not([hidden]) .sheet-body,html.mo dialog.v2-dialog[open]:not(.ms-closing){animation:ms-rise var(--d-snappy) var(--spring-snappy)}}
@keyframes ms-rise{from{opacity:0;transform:translate3d(0,40px,0)}to{opacity:1;transform:none}}
/* ---- charts open from the left ---- */
html.ms .ms-reveal{clip-path:inset(0 100% 0 0)}
html.ms .ms-reveal.ms-go{clip-path:inset(0 0 0 0);transition:clip-path 900ms var(--spring-soft)}
/* ---- one look ---- */
/* U1: the big number of a screen is thin and large; numbers in lists stay bold. */
:root body .sl-v,:root body .gsh-v{font-weight:300;letter-spacing:-.03em}:root body .sl-v{font-size:34px;color:var(--fg)}:root body .gsh-v{font-size:34px}
/* U3: three radii. Cards 20, blocks inside a card 14, pills round. */
:root body main .card,:root body main section.hero,:root body .sc-hero,:root body .iss-c,:root body .pl-figure,:root body .pn-more,:root body .hm-go{border-radius:20px}
:root body .cl-check,:root body .ia-fig,:root body .gate-cta,:root body .more-btn,:root body .ad-s,:root body .tm-item,:root body .me-acct,:root body a.sl,:root body .dv-t,:root body .cl-deep,:root body .rs-bar,:root body .mk-tile{border-radius:14px}
/* U4: cards are white; grey is only for blocks inside a card. */
:root body .me-acct,:root body a.sl{background:var(--surface);box-shadow:var(--shadow-sm,0 1px 2px rgba(10,22,38,.04))}
/* U5: two badge kinds. State (위원회 날짜, 오늘 이슈 n위, 중요) is dark; category (코인, 한국·세계, 실적, 새 뉴스, 시장) is grey. */
:root body .tier,:root body .ia-from,:root body .badge,:root body .tag,:root body .mkt-chip,:root body .iss-k b{display:inline-flex;align-items:center;min-height:20px;padding:0 8px;border:0!important;border-radius:999px;font-size:11.5px;font-weight:700;line-height:1;vertical-align:1px}
:root body .tier,:root body .ia-from,:root body .ia-from.w,:root body .badge,:root body .tag,:root body .mkt-chip{background:var(--soft);color:var(--fg2)}
:root body .tier.t-core,:root body .badge.b-HIGH,:root body .iss-k b{background:var(--fg);color:var(--page)}
:root body .ia-new,:root body .wd-new{font-weight:800;color:var(--fg)}
/* U7: a link in a section head is dark and bold with ›; a note is small and grey. */
:root body .wd-link,:root body .block-head a,:root body .head a.more{color:var(--fg);font-weight:700;font-size:13px}
:root body .block-head .muted,:root body .head .sub{font-size:12.5px;font-weight:500}
/* I6: on phones 찾기's summary line still opens the filter sheet, but the filter icon lives only in the bar. */
@media (max-width:600px){body:has(.bottom-nav [data-dock-filter]) .sc-sum svg{display:none}}
/* I8: home's title says which part is open. */
.ms-part{display:inline-block;margin-left:8px;font-size:.62em;font-weight:600;color:var(--muted);letter-spacing:0;vertical-align:.1em}
html.ms .ms-part.ms-swap{animation:ms-word var(--d-snappy) var(--spring-snappy)}
@keyframes ms-word{from{opacity:0;transform:translateY(8px)}}
`;

export const MOTION_SYSTEM_JS = `
(function () {
  var root = document.documentElement, mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = function () { return !!(mq && mq.matches); };
  if (!reduce()) root.classList.add('ms');
  var raf2 = function (f) { requestAnimationFrame(function () { requestAnimationFrame(f); }); };

  // ---- numbers count up (from 60% of the value, so they settle rather than race), keeping commas, decimals, units ----
  var BIG = '.sc-hv b,.sl-v,.mk-tile b,.mh-big b,.gsh-v,[data-count]';
  var count = function (el) {
    if (reduce() || el.closest('[data-no-roll],.rl') || el.__msBusy) return;
    var t = el.textContent, m = t.match(/-?[0-9][0-9,]*(\\.[0-9]+)?/); if (!m || (t.match(/[0-9][0-9,.]*/g) || []).length > 1) return;
    var end = Number(m[0].replace(/,/g, '')); if (!isFinite(end) || end === 0) return;
    var dec = m[1] ? m[1].length - 1 : 0, comma = m[0].indexOf(',') >= 0, pre = t.slice(0, m.index), post = t.slice(m.index + m[0].length), t0 = null, shown = null;
    var fmt = function (v) { var s = v.toFixed(dec); if (comma) { var p = s.split('.'); p[0] = Number(p[0]).toLocaleString('en-US'); s = p.join('.'); } return pre + s + post; };
    el.__msBusy = 1;
    var step = function (ts) {
      if (shown != null && el.textContent !== shown) { el.__msBusy = 0; return; } // the page wrote a new value: it wins
      if (t0 == null) t0 = ts; var k = Math.min(1, (ts - t0) / 750), e = 1 - Math.pow(1 - k, 4);
      shown = k < 1 ? fmt(end * (0.6 + 0.4 * e)) : t; el.textContent = shown;
      if (k < 1) requestAnimationFrame(step); else el.__msBusy = 0;
    };
    requestAnimationFrame(step);
  };
  // ---- charts open from the left, once in view and again when their part opens ----
  // Not the candle chart: clip-path also clips hit-testing, and a finger that drags it right away must reach it.
  var CHARTS = '.kv-plot';
  var reveal = function (el) {
    if (reduce() || el.__msRev) return; el.__msRev = 1;
    el.classList.add('ms-reveal'); raf2(function () { el.classList.add('ms-go'); });
    setTimeout(function () { el.classList.remove('ms-reveal', 'ms-go'); el.__msRev = 0; }, 1000);
  };
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(e.target); if (e.target.matches(CHARTS)) reveal(e.target); else count(e.target); });
  }, { threshold: 0.5 }) : null;
  var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
  var watch = function () {
    if (!io || !seen) return;
    document.querySelectorAll(BIG + ',' + CHARTS).forEach(function (el) { if (seen.has(el)) return; seen.add(el); io.observe(el); });
  };

  // ---- a part that opens comes in from its side ----
  var PANELS = '[role=tabpanel],[data-wd-p]';
  var sibs = function (p) { return Array.prototype.filter.call(p.parentNode.children, function (c) { return c.matches(PANELS); }); };
  var last = typeof WeakMap === 'function' ? new WeakMap() : null, booted = false;
  var opened = function (p) {
    var host = p.parentNode; if (!host || !last) return;
    var list = sibs(p), i = list.indexOf(p), j = last.has(host) ? last.get(host) : -1; last.set(host, i);
    if (!booted || reduce() || j < 0 || j === i || p.id === 'tab-chart' || p.id === 'tab-filings') return;
    p.setAttribute('data-ms-from', i > j ? 'r' : 'l'); p.classList.remove('ms-in'); void p.offsetWidth; p.classList.add('ms-in');
    var done = function () { p.classList.remove('ms-in'); p.removeAttribute('data-ms-from'); };
    p.addEventListener('animationend', function f(ev) { if (ev.target !== p) return; p.removeEventListener('animationend', f); done(); }); setTimeout(done, 900);
    p.querySelectorAll(BIG).forEach(function (n) { if (n.getClientRects().length) count(n); });
    p.querySelectorAll(CHARTS).forEach(function (c) { if (c.getClientRects().length) reveal(c); });
  };
  document.querySelectorAll(PANELS).forEach(function (p) { if (!p.hidden && last && p.parentNode) last.set(p.parentNode, sibs(p).indexOf(p)); });

  // ---- bottom bar: the new icon pops (names under the icons are the bar's own, G-289) ----
  var nav = document.querySelector('.bottom-nav');
  var pop = function (el) { if (reduce()) return; el.classList.remove('ms-pop'); void el.offsetWidth; el.classList.add('ms-pop'); setTimeout(function () { el.classList.remove('ms-pop'); }, 800); };

  // ---- home: the title names the open part ----
  var homeTitle = function (label) {
    var h = document.querySelector('main .pg-title h1'); if (!h || !document.querySelector('[data-wd-p]')) return;
    var s = h.querySelector('.ms-part'); if (!s) { s = document.createElement('span'); s.className = 'ms-part'; h.appendChild(s); }
    if (s.textContent === label) return; s.textContent = label; s.classList.remove('ms-swap'); void s.offsetWidth; s.classList.add('ms-swap');
  };
  var homeSync = function () { var t = document.querySelector('.bottom-nav [data-wd][aria-selected=true]') || document.querySelector('[data-wd][aria-selected=true]'); if (t) homeTitle(t.textContent.trim() || t.getAttribute('aria-label') || ''); };
  homeSync();

  if (window.MutationObserver) new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      var el = m.target; if (m.type !== 'attributes' || el.nodeType !== 1) return;
      if (m.attributeName === 'hidden' && !el.hidden && el.matches(PANELS)) opened(el);
      else if ((m.attributeName === 'aria-selected' || m.attributeName === 'aria-current') && nav && nav.contains(el) && (el.getAttribute(m.attributeName) === 'true' || el.getAttribute(m.attributeName) === 'page')) { pop(el); if (el.hasAttribute('data-wd')) homeSync(); }
      else if (m.attributeName === 'aria-selected' && el.hasAttribute('data-wd') && el.getAttribute('aria-selected') === 'true') homeSync();
    });
  }).observe(document.body || root, { subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-selected', 'aria-current'] });
  var queued = false;
  if (window.MutationObserver) new MutationObserver(function () { if (queued) return; queued = true; setTimeout(function () { queued = false; watch(); }, 150); }).observe(document.body || root, { childList: true, subtree: true });
  watch(); setTimeout(function () { booted = true; }, 400);

  // ---- dialogs leave instead of vanishing; the chart sheet can be dragged down ----
  var D = window.HTMLDialogElement && HTMLDialogElement.prototype;
  if (D && !D.__msPatched) {
    D.__msPatched = 1;
    var realClose = D.close, realModal = D.showModal, ANIM = '.gsh-sheet'; // only the chart sheet: other dialogs' code expects close() to be immediate
    var finish = function (d, v) { clearTimeout(d.__msT); d.__msT = 0; d.classList.remove('ms-closing'); d.style.transform = ''; realClose.call(d, v); };
    D.close = function (v) {
      var d = this;
      if (!d.open || reduce() || !root.classList.contains('mo') || !d.matches(ANIM)) { if (d.__msT) { finish(d, v); return; } return realClose.apply(d, arguments); }
      if (d.__msT) return;
      d.classList.add('ms-closing'); d.__msT = setTimeout(function () { finish(d, v); }, d.matches('.gsh-sheet') ? 240 : 180);
    };
    // A sheet reopened while it is still leaving closes for real first (showModal on an open dialog would throw).
    D.showModal = function () { if (this.__msT) finish(this); return realModal.apply(this, arguments); };
    document.addEventListener('cancel', function (e) { var d = e.target; if (d && d.matches && d.matches(ANIM) && !reduce()) { e.preventDefault(); d.close(); } }, true);
  }
  // Drag the chart sheet down by its handle or head: it follows the finger (a little resistance upward) and closes past
  // 90px or on a quick flick; otherwise it springs back.
  var drag = null;
  document.addEventListener('pointerdown', function (e) {
    var h = e.target.closest && e.target.closest('.gsh-sheet .gsh-grab,.gsh-sheet .gsh-top'); if (!h || e.target.closest('button') || reduce()) return;
    var d = h.closest('dialog'); drag = { d: d, y: e.clientY, t: performance.now(), dy: 0, id: e.pointerId }; d.classList.add('ms-drag');
  });
  document.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return; var dy = e.clientY - drag.y; drag.dy = dy;
    drag.d.style.transform = 'translate3d(0,' + (dy < 0 ? -Math.pow(-dy, 0.7) : dy) + 'px,0)';
  }, { passive: true });
  var up = function (e) {
    if (!drag || (e && e.pointerId !== drag.id)) return; var g = drag; drag = null; g.d.classList.remove('ms-drag');
    var v = g.dy / Math.max(1, performance.now() - g.t);
    if (g.dy > 90 || (g.dy > 24 && v > 0.6)) { g.d.style.transform = ''; g.d.close(); }
    else { g.d.style.transition = 'transform var(--d-snappy) var(--spring-snappy)'; g.d.style.transform = ''; setTimeout(function () { g.d.style.transition = ''; }, 520); }
  };
  document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  // The sheet's big number counts up each time it opens.
  document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('[data-sheet],.km-stat')) return; setTimeout(function () { var v = document.querySelector('.gsh-sheet[open] .gsh-v'); if (v) count(v); }, 30); });
})();
`;
