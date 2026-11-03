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
  --page-grad:radial-gradient(620px 460px at 90% -90px,rgba(255,255,255,.95),transparent 70%),radial-gradient(520px 420px at -120px 140px,rgba(255,255,255,.7),transparent 70%),linear-gradient(180deg,#F4F5F7,#ECEEF1);border-color:rgba(255,255,255,.8);box-shadow:var(--shadow)}
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
:root body .hero-price{gap:2px 10px}:root body .hero-price b{font-size:44px;font-weight:300;letter-spacing:-.035em;line-height:1.1}:root body .hero-price>span{font-size:16px}:root body .hero-price b *{font-weight:inherit}
:root body .hero-chart{border:0;background:var(--soft);border-radius:18px}
:root body .key-points{border:0;border-top:1px solid var(--line);border-radius:0;background:transparent;padding:14px 2px 0;margin-top:14px}
:root body .big{font-weight:300;letter-spacing:-.02em}
html[data-theme=dark] .card{border-radius:24px}
:root body .sc-hero{padding:20px;border-radius:26px;background:var(--surface);border:1px solid var(--glass-line);box-shadow:var(--shadow)}
:root body .sc-hv b{font-weight:300;letter-spacing:-.04em;color:var(--fg)}
/* G-252 (한서님 10/19 '맨 위에 그노몬 있는거 없애자'): on phones the GNOMON brand row is gone. Login and the app install live in
   the 나 tab; the top bar only appears for a report's tabs, and for its name and price once the price scrolls away. */
@media (max-width:820px){:root body .topbar .brand,:root body .topbar .top-links{display:none}:root body .topbar:not(.scrolled) .topbar-in{display:none}
:root body .topbar:not(:has(>.chips)):not(.scrolled){display:none}:root body .topbar.scrolled .topbar-in{padding-left:16px}}
/* G-259 (한서님 10/19 '무채색 ㄱ'): the dark theme loses its navy. Near-black ground, grey surfaces, no blue glow. */
:root[data-theme=dark]{--page:#0F1012;--surface-solid:#1B1D21;--bar:#0B0C0E;--tip-bg:rgba(30,32,36,.95);--ink:#E6E8EB;--btn-fg:#111214;--on-accent:#111214;--seat-ring:#111214;
  --page-grad:radial-gradient(900px 600px at 85% -20%,rgba(255,255,255,.07),transparent 60%),radial-gradient(800px 600px at -10% 30%,rgba(255,255,255,.035),transparent 60%)}
:root[data-theme=dark] .topbar,:root[data-theme=dark] body .topbar{background:rgba(15,16,18,.86)}
:root[data-theme=dark] .topbar>.chips:not(.analysis-tabs){background:linear-gradient(180deg,rgba(38,40,44,.92),rgba(20,21,24,.92))}
/* G-267 (한서님 10/20 'ㄱㄱ', 덜어내기 기준): one quiet accent, near-black in light and near-white in dark, so links, chips,
   selected states and the chart kit stop using blue. Blue stays only for falling prices (--down). */
html:root[data-theme=light]{--accent:#141416;--accent-strong:#141416;--accent-soft:rgba(20,20,22,.06);--accent-line:rgba(20,20,22,.18);--focus:#141416;--brand-grad:linear-gradient(135deg,#2A2C31 0%,#141416 100%)}
html:root[data-theme=dark]{--accent:#ECEDEF;--accent-strong:#ECEDEF;--accent-soft:rgba(255,255,255,.08);--accent-line:rgba(255,255,255,.22);--focus:#ECEDEF;--brand-grad:linear-gradient(135deg,#F4F5F7 0%,#C9CCD1 100%)}
/* G-301 (한서님 10/25 '너무 멀리서 보이는거아닌가 시인성 전체적으로 개선', '한단계 더 키워'): darker greys so helper text reaches about
   4.5:1 on the page (was 2.7:1), plus one size step up across the app (done in each page's own font sizes). The dimmed seats
   (위원회 표결, other factions) stay readable, and the network "불러오는 중이에요" pill sits under the header instead of over the text. */
html:root[data-theme=light]{--muted:#686D75;--fg2:#33373D}
html:root[data-theme=dark]{--muted:#A3A8B0;--fg2:#D4D7DC}
:root body .seat.is-dim{fill-opacity:.38;stroke-opacity:.85}
:root body .gnm-network{top:calc(env(safe-area-inset-top,0px) + 70px);bottom:auto}
/* G-301 (한서님 10/26 '순서 배치 크기 이상한거 다 조정'): places the bigger type squeezed or clipped at 390px. */
:root body .ask-filing{width:auto;min-width:30px;padding:0 10px;border-radius:999px;white-space:nowrap}
:root body .rs-bar.rs-none,:root body #tab-home .rs-bar.rs-none{grid-template-columns:auto minmax(0,1fr)!important}:root body .rs-bar.rs-none .gen-wrap,:root body #tab-home .rs-bar.rs-none .gen-wrap{grid-column:1/-1!important;justify-self:start}
:root body td.num small{white-space:nowrap}
:root body #signals td:first-child{min-width:7.5em}:root body #signals th,:root body #signals td:not(:first-child){white-space:nowrap}
@media (max-width:520px){:root body .sc-hero .kr-half{flex-wrap:wrap;justify-content:center}:root body .sc-hero .kr-half .kr-leg{flex-basis:100%}}
/* G-301 (한서님 10/26 '레퍼런스 참고해서 모든 화면 시인성과 애니메이션 점검'): every row and banner that opens something
   answers the finger the same way (spring press), plain text links dim while pressed */
:root body :is(a.ia-t,a.iss-r,a.ad-s,a.cs-htop,a.cs-hrow,a.me-plan,a.ia-chip,a.ia-lead-a,summary){transition:transform var(--dur-base,200ms) var(--spring-press,ease),background-color var(--dur-base,200ms) ease}
:root body :is(a.ia-t,a.iss-r,a.cs-htop,a.cs-hrow,a.me-plan,a.ia-lead-a,summary):active{transform:scale(.98)}
:root body :is(a.ad-s,a.ia-chip):active{transform:scale(.97)}
:root body main p a:not([class]):active,:root body main li a:not([class]):active{opacity:.55}
/* G-308: dark mode's up/down are light pastels, so white text on them drops to ~2:1 (위원 자리 글자, 차트 기간 선택 칩). Dark ink there. */
html[data-theme=dark] .cs-seat.s-bull,html[data-theme=dark] .cs-seat.s-bear,html[data-theme=dark] body #main .rh-per button[aria-pressed=true]{color:#0A1626}
`;
