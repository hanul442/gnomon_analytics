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

/* G-248: the light theme in the Payrix feel, GNOMON colours (한서님 10/18 '이런 깔끔함을 원해', '우리색으로'): a soft grey ground lit by
   GNOMON-blue glows, frosted white cards with large radii and soft shadows, a near-black ink for pills and buttons, the blue kept
   for links and prices. The header floats as frosted glass. Prices keep red up / blue down. The dark theme keeps its tokens. */
html[data-theme=light]{--page:#EEF0F3;--surface:rgba(255,255,255,.74);--surface-solid:#FFFFFF;--soft:rgba(10,22,38,.045);--line:rgba(10,22,38,.07);--line-strong:rgba(10,22,38,.14);
  --fg:#15171A;--fg2:#4A4F57;--muted:#8E939B;--bar:#0A1626;--accent:#0582CA;--accent-strong:#006494;--accent-soft:#E3F3FD;--accent-line:#B6E0FA;--navy:#0A1626;
  --btn-bg:#0A1626;--btn-fg:#FFFFFF;--on-accent:#FFFFFF;--glass-blur:22px;--focus:#0582CA;--track:rgba(10,22,38,.06);--pill:#FFFFFF;--glass-line:rgba(255,255,255,.75);
  --shadow:0 1px 2px rgba(10,22,38,.04),0 14px 34px -18px rgba(10,22,38,.22);
  --page-grad:radial-gradient(560px 440px at 92% -80px,rgba(0,166,251,.26),transparent 70%),radial-gradient(480px 400px at -120px 120px,rgba(130,205,255,.3),transparent 70%),radial-gradient(700px 520px at 50% 115%,rgba(5,130,202,.14),transparent 70%)}
html[data-theme=light] .card{border-radius:24px;border-color:rgba(255,255,255,.8);box-shadow:var(--shadow)}
html[data-theme=light] .price-bar{color:var(--fg)}html[data-theme=light] .price-bar .up{color:var(--up)}html[data-theme=light] .price-bar .down{color:var(--down)}html[data-theme=light] .price-bar .pb-code{color:var(--muted)}html[data-theme=light] .price-bar .fresh{background:var(--soft);color:var(--fg2)}html[data-theme=light] .top-links a[aria-current=page]{background:var(--soft);color:var(--fg)}
html[data-theme=light] .topbar{background:transparent;color:var(--fg);border-bottom:0}
html[data-theme=light] .topbar::before{display:none}
html[data-theme=light] .brand{color:var(--fg)}html[data-theme=light] .brand small{color:var(--muted)}html[data-theme=light] .gnomon-mark img,html[data-theme=light] .boot-veil img{filter:invert(1)}
html[data-theme=light] .topbar .top-links a,html[data-theme=light] .topbar .top-links button{color:var(--fg);border-color:var(--line-strong);background:transparent}
html[data-theme=light] .topbar>.chips:not(.analysis-tabs){border-color:rgba(255,255,255,.8);background:rgba(255,255,255,.6);box-shadow:var(--shadow)}
html[data-theme=light] .topbar>.chips:not(.analysis-tabs) a{color:var(--muted)}html[data-theme=light] .topbar>.chips:not(.analysis-tabs) a:hover{color:var(--fg)}
html[data-theme=light] .topbar>.chips:not(.analysis-tabs) a[aria-selected=true]{color:#FFFFFF}
html[data-theme=light] .topbar>.chips:not(.has-ind) a[aria-selected=true],html[data-theme=light] .chips-ind{background:#0A1626;box-shadow:none}
html[data-theme=light] .topbar-in{border-color:rgba(255,255,255,.8);background:rgba(255,255,255,.66);box-shadow:var(--shadow);backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%)}
html[data-theme=light] .top-tabs a,html[data-theme=light] .top-tabs button{color:#6B7076}
html[data-theme=light] .top-tabs a:hover,html[data-theme=light] .top-tabs [data-dock-near=true]{color:var(--fg);background:rgba(10,22,38,.05);box-shadow:none;border-color:transparent}
html[data-theme=light] .top-tabs [aria-current=page]{color:#FFFFFF;background:#0A1626;box-shadow:0 10px 22px -12px rgba(10,22,38,.6)}
html[data-theme=light] .top-links .acct{color:#FFFFFF;background:#0A1626;box-shadow:none}html[data-theme=light] .top-links .acct i{color:#B9C0CA}
html[data-theme=light] .chip-toggle[aria-pressed=true]{background:#0A1626;color:#FFFFFF;border-color:#0A1626}
@media (max-width:820px){html[data-theme=light] .topbar{background:rgba(238,240,243,.72);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%)}}
/* G-249 (Payrix 화면 구성, 한서님 10/19): big numbers are thin, a card never holds another bordered card, and the
   scorecard's headline sits in one card. Both themes. ":root body" beats the page rules that load later. */
:root body .hero h1{font-size:23px;font-weight:600;letter-spacing:-.02em;margin:4px 0 2px}
:root body .hero-price{gap:2px 10px}:root body .hero-price b{font-size:44px;font-weight:300;letter-spacing:-.035em;line-height:1.1}:root body .hero-price>span{font-size:14px}:root body .hero-price b *{font-weight:inherit}
:root body .hero-chart{border:0;background:var(--soft);border-radius:18px}
:root body .key-points{border:0;border-top:1px solid var(--line);border-radius:0;background:transparent;padding:14px 2px 0;margin-top:14px}
:root body .big{font-weight:300;letter-spacing:-.02em}
html[data-theme=dark] .card{border-radius:24px}
:root body .sc-hero{padding:20px;border-radius:26px;background:var(--surface);border:1px solid var(--glass-line);box-shadow:var(--shadow)}
:root body .sc-hv b{font-weight:300;letter-spacing:-.04em;color:var(--fg)}
/* G-250 (한서님 10/19 '맨 위에 그노몬 있는거 없애자'): on phones the GNOMON brand row is gone. Login and the app install live in
   the 나 tab; the top bar only appears for a report's tabs, and for its name and price once the price scrolls away. */
@media (max-width:820px){:root body .topbar .brand,:root body .topbar .top-links{display:none}:root body .topbar:not(.scrolled) .topbar-in{display:none}
:root body .topbar:not(:has(>.chips)):not(.scrolled){display:none}:root body .topbar.scrolled .topbar-in{padding-left:16px}}
`;
