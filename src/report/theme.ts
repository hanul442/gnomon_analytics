// G-164 (v3.4.0): one look across every page. Toss-like shapes and greys with a violet accent (--accent).
// The colors live as tokens in renderHtml's :root; this layer is loaded last in the shared stylesheet so the
// shared pieces (cards, buttons, segmented controls, chips, switches, fields) look the same everywhere.
// Presentation only: no element is added, hidden or moved.
export const THEME_CSS = `
.card{border-color:var(--line);border-radius:20px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.hero{border-radius:24px;box-shadow:none}
.btn-primary,.sheet-done,.sc-sheet-go,.credit-btn{background:var(--accent);border-radius:14px;transition:background-color .15s,transform .1s}
.btn-primary:hover,.sheet-done:hover,.sc-sheet-go:hover,.credit-btn:hover{background:var(--accent-strong)}
.btn-primary:active,.sheet-done:active,.sc-sheet-go:active,.credit-btn:active,.pa-save:active,.st-save:active,.more-btn:active,.btn-ghost:active,.chip-toggle:active,.seg button:active{transform:scale(.97)}
.more-btn,.btn-ghost{border-color:transparent;background:#f2f4f6;color:var(--fg);transition:background-color .15s,transform .1s}
.more-btn:hover,.btn-ghost:hover{background:#e5e8eb}
.seg{background:#f2f4f6;border:0;border-radius:12px;padding:3px}
.seg button{border-radius:10px;font-weight:600;color:var(--fg2)}
.seg button:hover{background:rgba(0,0,0,.04)}
.seg button[aria-pressed=true],.seg button[aria-selected=true]{background:#fff;color:var(--fg);box-shadow:0 1px 3px rgba(0,0,0,.1)}
.chip-toggle{border-color:transparent;background:#f2f4f6;color:var(--fg2);font-weight:600}
.chip-toggle:hover{background:#e5e8eb;color:var(--fg)}
.chip-toggle[aria-pressed=true]{background:var(--accent-soft);color:var(--accent-strong);border-color:var(--accent-line)}
.tog{background:#e5e8eb}.radio{border-color:#d1d6db}
input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
::selection{background:var(--accent-soft);color:var(--fg)}
input[type=checkbox],input[type=radio],input[type=range]{accent-color:var(--accent)}
`;
