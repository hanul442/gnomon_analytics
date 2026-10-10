// G-187: one set of motion tokens and the interaction layer that uses them. Durations: fast 120ms (presses, colour),
// base 200ms (hover, small moves), slow 320ms (panels, tab content, dialogs). Curves: --ease-out for things arriving,
// --ease-spring for things that should feel physical (a press springing back, a dialog settling).
// Every rule here sits in :where() (zero specificity), so any component that already defines its own motion keeps it;
// this only fills the gaps so presses, tab changes, opened sections and dialogs all move the same way.

export const MOTION_TOKENS_CSS = `
:root{--dur-fast:120ms;--dur-base:200ms;--dur-slow:320ms;--ease-out:cubic-bezier(.16,1,.3,1);--ease-in-out:cubic-bezier(.65,0,.35,1);--ease-spring:cubic-bezier(.34,1.56,.64,1)}
:where(button,.btn-primary,.btn-ghost,.chip-toggle,.seg button,.more-link,a.card,.ms-row,.rr-main,.wl a,.cl-row){transition:transform var(--dur-base) var(--ease-spring),background-color var(--dur-base) var(--ease-out),border-color var(--dur-base) var(--ease-out),color var(--dur-fast) var(--ease-out),box-shadow var(--dur-base) var(--ease-out),opacity var(--dur-fast) var(--ease-out)}
:where(button,.btn-primary,.btn-ghost,.chip-toggle,.seg button):where(:not(:disabled)):active{transform:scale(.97);transition-duration:var(--dur-fast)}
:where(a.card,.ms-row,.rr-main,.cl-row):active{transform:scale(.99);transition-duration:var(--dur-fast)}
:where([role=tabpanel]:not([hidden])){animation:mt-tab var(--dur-slow) var(--ease-out)}
@keyframes mt-tab{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
:where(details[open]>:not(summary)){animation:mt-open var(--dur-base) var(--ease-out)}
@keyframes mt-open{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
:where(dialog[open]){animation:mt-dlg var(--dur-slow) var(--ease-spring)}
:where(dialog[open])::backdrop{animation:mt-fade var(--dur-base) var(--ease-out)}
@keyframes mt-dlg{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}
@keyframes mt-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion:reduce){:where([role=tabpanel],details[open]>:not(summary),dialog[open],dialog[open]::backdrop){animation:none}:where(button,.btn-primary,.btn-ghost,.chip-toggle,.seg button,a.card,.ms-row,.rr-main,.cl-row):active{transform:none}}`;
