// G-187: one set of motion tokens and the interaction layer that uses them. Durations: fast 120ms (presses, colour),
// base 200ms (hover, small moves), slow 320ms (panels, tab content, dialogs). Curves: --ease-out (in STYLE's :root)
// for things arriving, --ease-spring for things that should feel physical (a press springing back).
// Every selector, pseudo-classes included, sits inside :where() (zero specificity), so a component that sets its own
// transform, transition or animation keeps it — e.g. a button centred with translate(-50%) is never scaled on press.
// Reduced motion is handled site-wide (STYLE turns animations and transitions off).

export const MOTION_TOKENS_CSS = `
:root{--dur-fast:120ms;--dur-base:200ms;--dur-slow:320ms;--ease-in-out:cubic-bezier(.65,0,.35,1);--ease-spring:cubic-bezier(.34,1.56,.64,1)}
:where(button,.btn-primary,.btn-ghost,.chip-toggle,.seg button,.more-link,a.card,.ms-row,.rr-main,.wl a,.cl-row){transition:transform var(--dur-base) var(--ease-spring),background-color var(--dur-base) var(--ease-out),border-color var(--dur-base) var(--ease-out),color var(--dur-fast) var(--ease-out),box-shadow var(--dur-base) var(--ease-out),opacity var(--dur-fast) var(--ease-out)}
:where(button:not(:disabled):not(.gen-btn):active,.btn-primary:active,.btn-ghost:active,.chip-toggle:not(:disabled):active,.seg button:not(:disabled):active){transform:scale(.97)}
:where(a.card:active,.ms-row:active,.rr-main:active,.cl-row:not(:disabled):active){transform:scale(.99)}
:where([role=tabpanel]:not([hidden]):not(#tab-chart)){animation:mt-tab var(--dur-slow) var(--ease-out)}
@keyframes mt-tab{from{opacity:0}to{opacity:1}}
:where(details[open]>:not(summary)){animation:mt-open var(--dur-base) var(--ease-out)}
@keyframes mt-open{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
:where(dialog[open]){animation:mt-dlg var(--dur-slow) var(--ease-out)}
:where(dialog[open])::backdrop{animation:mt-fade var(--dur-base) var(--ease-out)}
@keyframes mt-dlg{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes mt-fade{from{opacity:0}to{opacity:1}}`;
