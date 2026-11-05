// G-330 (한서님 11/3 "디자인 시스템을 아예 로빈후드 느낌으로 재개편해 싹다 갈아엎어", 11/4 시안 A "흰 바탕, 상자 없음").
// Measured from the Robinhood app (App Store 2026) and robinhood.com at 390px, then fitted to GNOMON:
// - Ground: white (light) / pure black (dark). No shadows, no frosted glass anywhere.
// - Type: big but medium weight. Page title 32/500, section title 24/500, list names 500. Bold stays on prices and changes.
// - Boxes: none. Cards become rows on the ground, split by one 1px line. The only boxes are the market index tiles (radius 8).
// - Accent: Robin Neon #CCFF00, always next to black (light: black button with neon text, ✦ black with neon star;
//   dark: neon fill with black text). Up red ▲ / down blue ▼ stay (Korean convention), so neon never means "up".
// - Shapes: full pills for buttons and chips (chips are 1px outlines), radius 8 for small shapes.
// - Bottom bar: flat, edge to edge, one line on top. PC rail: flat, one line on the right.
// Loaded last (after RULES_CSS). Page <style> blocks come later and several set padding/weight with ids, so the type, box,
// chip and button rules carry !important; the bars do not need it.
const R = 'html:root body';
const M = 'html:root body #main';
const BOXES = ':is(.card,.mi-card,.cs-home,.iss-c,.sc-hero,.hm-card,.my-card,.st-group,.st-rows):not(.km-stat):not(.debate):not(.chart-card)';

export const RH_NEON = '#CCFF00';

export const RH_SYSTEM_CSS = `
html:root[data-theme=light]{--page:#FFFFFF;--page-grad:none;--fg:#000000;--fg2:#24272B;--muted:#5F656C;--line:#E6E8EB;--line-strong:#D2D5D9;--soft:#F2F3F5;
  --surface:#FFFFFF;--surface-solid:#FFFFFF;--shadow:none;--glass-blur:0px;--glass-bg:#FFFFFF;--glass-soft:transparent;--glass-edge:var(--line);
  --rh-box:#F2F3F5;--rh-neon:${RH_NEON};--rh-btn:#000000;--rh-btn-fg:${RH_NEON}}
html:root[data-theme=dark]{--page:#000000;--page-grad:none;--fg:#FFFFFF;--fg2:#E3E6E8;--muted:#919FA6;--line:#30363A;--line-strong:#40494E;--soft:#1E2225;
  --surface:#000000;--surface-solid:#000000;--shadow:none;--glass-blur:0px;--glass-bg:#000000;--glass-soft:transparent;--glass-edge:var(--line);
  --rh-box:#1E2225;--rh-neon:${RH_NEON};--rh-btn:${RH_NEON};--rh-btn-fg:#000000}
${R}{background:var(--page)}
${M} *,${R} .bottom-nav,${R} .bottom-nav *{box-shadow:none!important}
/* frosted glass off by token (--glass-blur:0px); backdrop-filter itself stays, since some menus rely on the stacking context it makes */
${R} .bottom-nav{-webkit-backdrop-filter:none;backdrop-filter:none}
${R} .mm-pblur{display:none}

/* ── 글자: 크게, 덜 굵게 ── */
${M} h1{font-size:32px!important;font-weight:500!important;letter-spacing:-.02em!important;line-height:1.25!important}
${M} h2,${M} .st-h{font-size:24px!important;font-weight:500!important;letter-spacing:-.01em!important}
${M} .hm-s{font-size:28px!important;font-weight:500!important;letter-spacing:-.02em!important;line-height:1.3!important}
${M} :is(.cs-htitle,.cl-line){font-weight:500!important}
${M} :is(.wl>a>b,tr.tap-card td>a>b,.me-acct b,.st-fold>summary b,.cs-hrow b,.rr-name b,.st-rows b,.mi-top b,.km-st-t,.ia-t,.pf-row legend){font-weight:500!important}
${M} .hero-main h1,${M} .hero-main .hero-price>b{font-size:32px!important;font-weight:500!important}

/* ── 상자 없음: 줄 하나로 나눔 ── */
${M} ${BOXES}{background:transparent!important;border:0!important;border-radius:0!important;padding-left:0!important;padding-right:0!important;border-bottom:1px solid var(--line)!important}
${M} .st-group .st-rows{border-bottom:0!important}
${M} :is(.st-rows>*,.st-fold>summary){padding-left:0!important;padding-right:0!important}
${M} .me-acct{background:transparent!important;border:0!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;padding-left:0!important;padding-right:0!important}
${M} .cl-head{background:transparent!important;padding-left:0!important;padding-right:0!important}
${M} .cs-dis{background:transparent!important;border-left:2px solid var(--fg)!important;border-radius:0!important}
${M} tr.tap-card td:first-child{padding-left:0!important}${M} tr.tap-card td:last-child{padding-right:0!important}
${M} .km-stat{background:var(--rh-box)!important;border:0!important;border-radius:8px!important}

/* ── 칩: 외곽선 알약 ── */
${M} :is(.ia-from,.badge,.chip-toggle,.theme-chips a,.theme-chips button,.live-tag):not(.eyebrow *){background:transparent!important;border:1px solid var(--line-strong)!important;color:var(--fg)!important;border-radius:999px!important}
${M} .chip-toggle[aria-pressed=true]{background:var(--fg)!important;color:var(--page)!important;border-color:var(--fg)!important}

/* ── 버튼: 알약, 라임은 검정 옆에만 ── */
${M} :is(.btn-primary,.gen-btn,.credit-btn,.sheet-done,.sc-sheet-go){background:var(--rh-btn)!important;color:var(--rh-btn-fg)!important;border-radius:999px!important;font-weight:600!important}
${M} :is(.gen-btn,.credit-btn) *{color:inherit!important}
${M} :is(.more-btn,.btn-ghost){background:transparent!important;border:1px solid var(--fg)!important;border-radius:999px!important}
${M} .rh-per button{font-size:13px!important;letter-spacing:1px!important;border-radius:6px!important}
${M} .wl-pill{border-radius:8px!important}

/* ── 아래 바: 화면 끝까지 붙은 평평한 바 ── */
@media (max-width:820px){
${R} .bottom-nav{left:0;right:0;bottom:0;border-radius:0;background:var(--page);border:0;border-top:1px solid var(--line);padding:6px 12px calc(8px + env(safe-area-inset-bottom))}
${R} .bottom-nav::before{display:none}
${R} .bottom-nav .seg-thumb{display:none}
}
${R} .bottom-nav :is(.nav-tabs,.nav-parts) a{color:var(--muted)}
${R} .bottom-nav :is(.nav-tabs,.nav-parts) :is(a[aria-current=page],a[aria-selected=true],a.active){color:var(--fg)}
${R} .bottom-nav :is(.nav-spark,.nav-ask-r){background:var(--rh-btn);color:var(--rh-btn-fg);border:0}
${R} .bottom-nav :is(.nav-back,.nav-return,.nav-round:not(.nav-ask-r)){background:transparent;border:1px solid var(--line-strong)}

/* ── PC 왼쪽 바: 평평하게, 오른쪽 선 하나 ── */
@media (min-width:821px){
${R} .bottom-nav{top:0;bottom:0;left:0;border:0;border-right:1px solid var(--line);border-radius:0;background:var(--page)}
${R} .bottom-nav::before{display:none}
}
`;
