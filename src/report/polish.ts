// G-227: one look, and small motions that make the screens feel alive.
// Loaded after every other layer (THEME_CSS, MOTION_TOKENS_CSS, SEG_THUMB_CSS), so it settles the places where pages
// drifted apart: search fields, the selected tab in a tab row, the ad strip, sticky tab bars. Page <style> blocks come
// after the shared stylesheet, so rules that must beat them start with `:root body` (one class more than a page rule like `.top-search .search-box`).
// Motion: cards rise in as they scroll into view (only those below the first screen, once), the star pops when a stock
// is added, fields light their ring softly. Reduced motion is handled site-wide (STYLE turns animation off) and the
// script below does nothing then.

/** Line icons for the home quick links (same 24px grid and 1.8 stroke as the bottom bar). */
export const QUICK_ICONS = {
  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  themes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><circle cx="16.5" cy="16.5" r="3.5"/></svg>',
  radar: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12l5.5-5.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
} as const;

export const POLISH_CSS = `
:root{--r-field:14px;--field-bg:var(--surface);--field-line:var(--line-strong);--ring:0 0 0 4px var(--accent-soft)}
/* Fields: one search field everywhere (home, 찾기, 테마) — quiet border, accent ring on focus. */
:root body .search-box,:root body .tm-tools input[type=search]{background:var(--field-bg);border:1px solid var(--field-line);border-radius:var(--r-field);box-shadow:none;transition:border-color var(--dur-base) var(--ease-out),box-shadow var(--dur-base) var(--ease-out),background-color var(--dur-base) var(--ease-out)}
:root body .tm-tools input[type=search]{color:var(--fg);padding:13px 14px}
:root body .search-box:focus-within,:root body .tm-tools input[type=search]:focus{border-color:var(--accent);box-shadow:var(--ring);outline:0}
:root body .search-box svg{color:var(--muted);transition:color var(--dur-base) var(--ease-out),transform var(--dur-base) var(--ease-spring)}
:root body .search-box:focus-within svg{color:var(--accent-strong);transform:scale(1.08)}
/* The selected tab in a tab row looks the same on every page: the primary pill (white on dark, accent on light). */
.find-tabs>.seg-thumb,.adm-tabs>.seg-thumb{background:var(--btn-bg);box-shadow:0 1px 3px rgba(0,0,0,.18)}
:root body .find-tabs [aria-selected=true]{background:var(--btn-bg);color:var(--btn-fg);border-color:transparent}
:root body .find-tabs>:not(.seg-thumb){border-color:transparent;background:var(--soft)}
/* Ad strip: one quiet surface for every ad; the advertiser's colour stays only as a small dot. */
.ad-s,.ad-s.ad-ink,.ad-s.ad-teal,.ad-s.ad-navy,.ad-s.ad-rose{background:var(--surface);border:1px solid var(--line);color:var(--fg)}
.ad-s::before{content:"";flex:none;width:8px;height:8px;border-radius:50%;background:var(--ad-dot,var(--accent))}
.ad-ink{--ad-dot:#8593A1}.ad-teal{--ad-dot:#2BB39A}.ad-navy{--ad-dot:#00A6FB}.ad-rose{--ad-dot:#E5577E}
.ad-s .ad-tag{color:var(--muted);border-color:var(--line-strong);opacity:1}.ad-s .ad-t{color:var(--fg2)}.ad-s .ad-cta{color:var(--accent-strong)}
.ad-strip .ad-x{color:var(--muted)}.ad-strip .ad-x:hover{color:var(--fg)}
/* Sticky tab bars under the top bar: frosted like the top bar and edge to edge, not a hard box. */
:root body .st-nav{background:color-mix(in srgb,var(--page) 88%,transparent);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);box-shadow:0 0 0 100vmax color-mix(in srgb,var(--page) 88%,transparent);clip-path:inset(0 -100vmax)}
/* Home quick links: three soft pills with line icons instead of emoji. */
:root body .find-row{gap:8px;margin:12px 0 0}
:root body .find-row .flt-btn,:root body .find-row .find-link{display:inline-flex;align-items:center;gap:6px;min-height:36px;margin:0;padding:0 14px 0 11px;border-radius:999px;background:var(--soft);color:var(--fg);font-size:13.5px;font-weight:700;text-decoration:none}
:root body .find-row svg{width:17px;height:17px;flex:none;fill:none;stroke:var(--accent-strong);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
:root body .find-row a:hover{background:var(--line)}
/* ---- motion ---- */
@keyframes pl-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
html.pl .pl-rv{opacity:0}
html.pl .pl-rv.pl-in{animation:pl-rise 560ms var(--ease-out) both;animation-delay:calc(var(--pl-i,0) * 60ms)}
.star svg{transition:transform var(--dur-base) var(--ease-spring)}
.star:active svg{transform:scale(.82)}
:where(.star){position:relative}
.star.pl-pop svg{animation:pl-pop 520ms var(--ease-spring)}
.star.pl-pop::after{content:"";position:absolute;inset:4px;border-radius:50%;border:2px solid #e8a20c;pointer-events:none;animation:pl-ring 520ms var(--ease-out) forwards}
@keyframes pl-pop{0%{transform:scale(.6)}45%{transform:scale(1.28) rotate(-8deg)}100%{transform:none}}
@keyframes pl-ring{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(1.5)}}
`;

export const POLISH_JS = `
(function () {
  var root = document.documentElement, reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A star that turns on pops with a ring; the shared watchlist handler runs first and sets aria-pressed.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.star[data-star]'); if (!b || reduce) return;
    setTimeout(function () { if (b.getAttribute('aria-pressed') !== 'true') return; b.classList.remove('pl-pop'); void b.offsetWidth; b.classList.add('pl-pop'); setTimeout(function () { b.classList.remove('pl-pop'); }, 560); }, 0);
  });
  // Cards below the first screen rise in once as they arrive; then the classes go, so no transform is left behind.
  if (reduce || !('IntersectionObserver' in window)) return;
  var vh = window.innerHeight || root.clientHeight;
  var els = Array.prototype.filter.call(document.querySelectorAll('main .card, main .tp'), function (el) {
    if (el.closest('dialog,[hidden],.chat-panel,.page-load') || el.closest('.pl-rv')) return false;
    var r = el.getBoundingClientRect(); return r.height > 0 && r.top > vh;
  });
  if (!els.length) return;
  root.classList.add('pl');
  var batch = 0, timer = null;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return; var el = e.target; io.unobserve(el);
      el.style.setProperty('--pl-i', String(Math.min(batch++, 5))); el.classList.add('pl-in');
      var done = function () { el.classList.remove('pl-rv', 'pl-in'); el.style.removeProperty('--pl-i'); };
      el.addEventListener('animationend', function f(ev) { if (ev.target !== el) return; el.removeEventListener('animationend', f); done(); });
      setTimeout(done, 1400);
    });
    clearTimeout(timer); timer = setTimeout(function () { batch = 0; }, 120);
  }, { rootMargin: '0px 0px -8% 0px' });
  els.forEach(function (el) { el.classList.add('pl-rv'); io.observe(el); });
})();
`;
