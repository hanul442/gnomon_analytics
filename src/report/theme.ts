// G-164 (v3.4.0): one look across every page. Toss-like shapes and greys with a violet accent (--accent).
// The colors live as tokens in renderHtml's :root; this layer is loaded last in the shared stylesheet so the
// shared pieces (cards, buttons, segmented controls, chips, switches, fields) look the same everywhere.
// Presentation only: no element is added, hidden or moved.
export const THEME_CSS = `
.card{background:var(--surface);border-color:var(--line);border-radius:20px;box-shadow:var(--shadow);backdrop-filter:blur(var(--glass-blur));-webkit-backdrop-filter:blur(var(--glass-blur))}
html[data-theme=dark] .card{box-shadow:0 1px 0 rgba(255,255,255,.05) inset}
.hero{border-radius:24px;box-shadow:none}
.btn-primary,.sheet-done,.sc-sheet-go,.credit-btn{background:var(--btn-bg);color:var(--btn-fg);border-radius:999px;transition:background-color .15s,transform .1s,filter .15s}
.btn-primary:hover,.sheet-done:hover,.sc-sheet-go:hover,.credit-btn:hover{background:var(--btn-bg);filter:brightness(.94)}
html[data-theme=dark] .topbar,html[data-theme=dark] .bottom-nav{background:rgba(6,16,28,.92);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}
.btn-primary:active,.sheet-done:active,.sc-sheet-go:active,.credit-btn:active,.pa-save:active,.st-save:active,.more-btn:active,.btn-ghost:active,.chip-toggle:active,.seg button:active{transform:scale(.97)}
.more-btn,.btn-ghost{border-color:transparent;background:var(--soft);color:var(--fg);transition:background-color .15s,transform .1s}
.more-btn:hover,.btn-ghost:hover{background:var(--line)}
.seg{background:var(--soft);border:0;border-radius:999px;padding:3px}
.seg button{border-radius:999px;font-weight:600;color:var(--fg2)}
.seg button:hover{background:var(--line)}
.seg button[aria-pressed=true],.seg button[aria-selected=true]{background:var(--btn-bg);color:var(--btn-fg);box-shadow:0 1px 3px rgba(0,0,0,.12)}
.chip-toggle{border-color:transparent;background:var(--soft);color:var(--fg2);font-weight:600}
.chip-toggle:hover{background:var(--line);color:var(--fg)}
.chip-toggle[aria-pressed=true]{background:var(--accent-soft);color:var(--accent-strong);border-color:var(--accent-line)}
.radio{border-color:var(--line-strong)}
input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
::selection{background:var(--accent-soft);color:var(--fg)}
input[type=checkbox],input[type=radio],input[type=range]{accent-color:var(--accent)}

/* G-246: the light theme, re-cut after the Black Oracle reference (한서님 10/18): a white page with no gradient, near-black
   for the one accent (pills, buttons, the active tab), grey surfaces without shadows, and a white header and tab bar.
   Prices keep red up / blue down. The dark theme is unchanged. */
html[data-theme=light]{--page:#FFFFFF;--surface:#F6F7F9;--surface-solid:#FFFFFF;--soft:#F2F4F6;--line:rgba(17,24,39,.07);--line-strong:rgba(17,24,39,.15);
  --fg:#111418;--fg2:#4B5563;--muted:#8B95A1;--bar:#FFFFFF;--accent:#191F28;--accent-strong:#191F28;--accent-soft:#F2F4F6;--accent-line:#D1D6DB;--navy:#191F28;
  --btn-bg:#191F28;--btn-fg:#FFFFFF;--on-accent:#FFFFFF;--page-grad:none;--shadow:none;--glass-blur:0px;--focus:#0582CA}
html[data-theme=light] body{background:#FFFFFF}
html[data-theme=light] .card{border-color:transparent;box-shadow:none}
html[data-theme=light] .price-bar{color:var(--fg)}html[data-theme=light] .price-bar .up{color:var(--up)}html[data-theme=light] .price-bar .down{color:var(--down)}html[data-theme=light] .price-bar .pb-code{color:var(--muted)}html[data-theme=light] .price-bar .fresh{background:var(--soft);color:var(--fg2)}html[data-theme=light] .top-links a[aria-current=page]{background:var(--soft);color:var(--fg)}
html[data-theme=light] .topbar{background:rgba(255,255,255,.94);color:var(--fg);border-bottom:1px solid var(--line);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
html[data-theme=light] .topbar::before{display:none}
html[data-theme=light] .brand{color:var(--fg)}html[data-theme=light] .brand small{color:var(--muted)}html[data-theme=light] .gnomon-mark img,html[data-theme=light] .boot-veil img{filter:invert(1)}
html[data-theme=light] .topbar .top-links a,html[data-theme=light] .topbar .top-links button{color:var(--fg);border-color:var(--line-strong);background:transparent}
html[data-theme=light] .topbar>.chips:not(.analysis-tabs){border-color:transparent;background:var(--soft);box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}
html[data-theme=light] .topbar>.chips:not(.analysis-tabs) a{color:var(--muted)}html[data-theme=light] .topbar>.chips:not(.analysis-tabs) a:hover{color:var(--fg)}
html[data-theme=light] .topbar>.chips:not(.analysis-tabs) a[aria-selected=true]{color:#FFFFFF}
html[data-theme=light] .topbar>.chips:not(.has-ind) a[aria-selected=true],html[data-theme=light] .chips-ind{background:#191F28;box-shadow:none}
html[data-theme=light] .bottom-nav{border:1px solid var(--line);background:rgba(255,255,255,.94);box-shadow:0 10px 30px -14px rgba(17,24,39,.28);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
html[data-theme=light] .bottom-nav a,html[data-theme=light] .bottom-nav button{color:#8B95A1}
html[data-theme=light] .bottom-nav [aria-current=page]{color:#FFFFFF;background:#191F28;box-shadow:none}
html[data-theme=light] .topbar-in{border-color:var(--line);background:#FFFFFF;box-shadow:0 10px 30px -18px rgba(17,24,39,.25);backdrop-filter:none;-webkit-backdrop-filter:none}
html[data-theme=light] .top-tabs a,html[data-theme=light] .top-tabs button{color:#6B7684}
html[data-theme=light] .top-tabs a:hover,html[data-theme=light] .top-tabs [data-dock-near=true]{color:var(--fg);background:var(--soft);box-shadow:none;border-color:transparent}
html[data-theme=light] .top-tabs [aria-current=page]{color:#FFFFFF;background:#191F28;box-shadow:none}
html[data-theme=light] .top-links .acct{color:#FFFFFF;background:#191F28;box-shadow:none}html[data-theme=light] .top-links .acct i{color:#C9CED6}
html[data-theme=light] .has-thumb>.seg-thumb{box-shadow:none}
html[data-theme=light] .chip-toggle[aria-pressed=true]{background:#191F28;color:#FFFFFF;border-color:#191F28}
`;
