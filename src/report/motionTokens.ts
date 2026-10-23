// G-187: one set of motion tokens and the interaction layer that uses them. Durations: fast 120ms (presses, colour),
// base 200ms (hover, small moves), slow 320ms (panels, tab content, dialogs). Curves: --ease-out (in STYLE's :root)
// for things arriving, --ease-spring for things that should feel physical (a press springing back).
// Every selector, pseudo-classes included, sits inside :where() (zero specificity), so a component that sets its own
// transform, transition or animation keeps it — e.g. a button centred with translate(-50%) is never scaled on press.
// Reduced motion is handled site-wide (STYLE turns animations and transitions off).
//
// G-286 (한서님 10/23 '전체적으로 애니메이션이 쫀득하게'): four springs instead of the 17 hand-picked curves the
// screens had drifted into. Each is the step response of a damped spring (stiffness/damping below), sampled into a CSS
// linear() curve, so a move overshoots and settles the way a finger expects:
//   --spring-press  300ms  critically damped, no overshoot   presses letting go, switches
//   --spring-snappy 500ms  ζ .72, 4% overshoot                 the bottom bar pill, sheets, part switches
//   --spring-bouncy 700ms  ζ .5, 16% overshoot                an icon popping, a card let go, the star
//   --spring-soft   550ms  ζ .95, no overshoot, long tail      page moves, charts drawing, text arriving
// Browsers without linear() (iOS 16 and older) get the nearest cubic-bezier, never a broken transition: a var() that
// resolves to an unknown function would reset the whole transition shorthand.
// Pressing goes in fast (--press-in) and comes back on a spring, so a tap feels like squeezing something soft.
// Demo and audit: https://claude.ai/artifact/EUYq685WEVuHrKk8gdDHck

/** The four springs as CSS linear() curves (generated from a damped spring, 33 samples each). */
export const SPRINGS = {
  press: 'linear(0,0.033,0.11,0.207,0.31,0.41,0.503,0.585,0.657,0.719,0.771,0.814,0.85,0.88,0.904,0.923,0.939,0.952,0.962,0.97,0.976,0.981,0.985,0.988,0.991,0.993,0.994,0.996,0.997,0.997,0.998,0.998,1)',
  snappy: 'linear(0,0.05,0.168,0.317,0.471,0.613,0.736,0.835,0.911,0.965,1.001,1.023,1.035,1.038,1.037,1.033,1.027,1.021,1.016,1.011,1.007,1.004,1.002,1,0.999,0.999,0.999,0.999,0.999,0.999,0.999,0.999,1)',
  bouncy: 'linear(0,0.082,0.275,0.51,0.737,0.923,1.055,1.132,1.162,1.156,1.129,1.091,1.053,1.021,0.996,0.981,0.974,0.974,0.977,0.983,0.99,0.995,1,1.002,1.004,1.004,1.004,1.003,1.002,1.001,1,1,1)',
  soft: 'linear(0,0.025,0.086,0.167,0.256,0.347,0.435,0.517,0.591,0.657,0.715,0.764,0.806,0.842,0.872,0.897,0.917,0.934,0.948,0.959,0.968,0.975,0.981,0.985,0.989,0.991,0.994,0.995,0.996,0.997,0.998,0.999,1)',
} as const;

export const MOTION_TOKENS_CSS = `
:root{--dur-fast:120ms;--dur-base:200ms;--dur-slow:320ms;--ease-in-out:cubic-bezier(.65,0,.35,1);
--d-press:300ms;--d-snappy:500ms;--d-bouncy:700ms;--d-soft:550ms;--d-out:180ms;
--press-in:cubic-bezier(.2,0,.2,1);--ease-exit:cubic-bezier(.4,0,1,1);
--spring-press:cubic-bezier(.25,.8,.3,1);--spring-snappy:cubic-bezier(.3,1.25,.5,1);--spring-bouncy:cubic-bezier(.34,1.56,.64,1);--spring-soft:cubic-bezier(.16,1,.3,1);
--ease-spring:var(--spring-bouncy);--press-card:.97;--press-btn:.95}
@supports (transition-timing-function:linear(0,1)){:root{--spring-press:${SPRINGS.press};--spring-snappy:${SPRINGS.snappy};--spring-bouncy:${SPRINGS.bouncy};--spring-soft:${SPRINGS.soft}}}
/* Presses: in fast, back on a spring. Cards and rows sink a little (0.97), buttons a little more (0.95). */
:where(button,.btn-primary,.btn-ghost,.chip-toggle,.seg button,.more-link,a.card,.ms-row,.rr-main,.wl a,.cl-row,.mk-tile,.hm-call,.tm-item,.km-cell,li.tap-card,.iss-c,a.sl,.hm-go,.me-acct,.bn-slide,.km-stat,[data-sheet]){transition:transform var(--d-bouncy) var(--spring-bouncy),background-color var(--dur-base) var(--ease-out),border-color var(--dur-base) var(--ease-out),color var(--dur-fast) var(--ease-out),box-shadow var(--dur-base) var(--ease-out),opacity var(--dur-fast) var(--ease-out)}
:where(button:not(:disabled):not(.gen-btn):active,.btn-primary:active,.btn-ghost:active,.chip-toggle:not(:disabled):active,.seg button:not(:disabled):active){transform:scale(var(--press-btn));transition:transform 90ms var(--press-in)}
:where(a.card:active,.ms-row:active,.rr-main:active,.cl-row:not(:disabled):active,.mk-tile:active,.hm-call:active,.tm-item:active,.km-cell:active,li.tap-card:active,.iss-c:active,a.sl:active,.hm-go:active,.me-acct:active,.bn-slide:active,.km-stat:active,[data-sheet]:not(tr):active){transform:scale(var(--press-card));transition:transform 110ms var(--press-in)}
/* A part that opens slides in from the side it lives on (motionSystem.ts sets data-ms-from); a plain tab fades. */
:where([role=tabpanel]:not([hidden]):not(#tab-chart)){animation:mt-tab var(--dur-slow) var(--ease-out)}
@keyframes mt-tab{from{opacity:0}to{opacity:1}}
:where(details[open]>:not(summary)){animation:mt-open var(--d-snappy) var(--spring-snappy)}
@keyframes mt-open{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
:where(dialog[open]){animation:mt-dlg var(--d-snappy) var(--spring-snappy)}
:where(dialog[open])::backdrop{animation:mt-fade var(--dur-base) var(--ease-out)}
@keyframes mt-dlg{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:none}}
@keyframes mt-fade{from{opacity:0}to{opacity:1}}`;
