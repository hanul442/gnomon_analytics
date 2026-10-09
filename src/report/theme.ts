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
.tog{background:var(--line-strong)}.radio{border-color:var(--line-strong)}
input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
::selection{background:var(--accent-soft);color:var(--fg)}
input[type=checkbox],input[type=radio],input[type=range]{accent-color:var(--accent)}
`;
