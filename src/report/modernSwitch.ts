// G-183: one switch for the whole site. Ported from ThreeUI Community's ModernToggle (MengTo/threeui, MIT;
// src/shaders/skeuomorphic-toggle/modern-toggle.css + ModernToggle.tsx): a hairline-edged track, a knob
// that squashes along its travel on a light spring and settles with one small overshoot, and a mark that
// turns from a dash into a check. Re-cut for GNOMON: our accent instead of the source's #2f6bff, sized by
// the row it sits in, and driven by the state we already have (a checkbox in 알림 설정, aria-pressed on the
// chart's indicator rows) rather than by its own React state. The halo and caption of the demo stage are
// left out: every switch here already sits in a labelled row.

/** The knob and its two marks; goes inside `<i class="mt …">`. */
export const MT_INNER = '<b class="mt-th"><svg viewBox="0 0 24 24" data-mark="check" aria-hidden="true"><path d="M5 12.8 9.6 17.4 19 8"/></svg><svg viewBox="0 0 24 24" data-mark="dash" aria-hidden="true"><path d="M6.5 12h11"/></svg></b>';

/** A switch for a checkbox row: `<span class="sw"><input type="checkbox" …>${MT}</span>`. */
export const MT = `<i class="mt" aria-hidden="true">${MT_INNER}</i>`;

const ON = '.sw input:checked+.mt,.opt[aria-pressed=true] .mt';

export const MODERN_SWITCH_CSS = `
:root{--mt-track:#e6e8ec;--mt-on:var(--accent);--mt-edge:rgba(9,12,20,.09);--mt-edge-on:rgba(9,12,20,.06);--mt-thumb:#ffffff;--mt-mark:#006494;--mt-focus:rgba(5,130,202,.32);
  --mt-shadow:0 1px 1px rgba(9,12,20,.1),0 6px 14px -4px rgba(9,12,20,.28)}
html[data-theme=dark]{--mt-track:#1E2A3B;--mt-on:#0582CA;--mt-edge:rgba(255,255,255,.1);--mt-edge-on:rgba(255,255,255,.16);--mt-thumb:#F2F4F8;--mt-mark:#0582CA;--mt-focus:rgba(0,166,251,.4);
  --mt-shadow:0 1px 1px rgba(0,0,0,.5),0 8px 18px -6px rgba(0,0,0,.7)}
.mt{position:relative;display:block;flex:none;width:46px;aspect-ratio:44/25;border-radius:999px;container-type:inline-size;background:var(--mt-track);box-shadow:inset 0 0 0 1px var(--mt-edge);
  transition:background .46s cubic-bezier(.32,.72,0,1),box-shadow .46s ease}
.mt::after{display:none!important}
${ON}{background:var(--mt-on);box-shadow:inset 0 0 0 1px var(--mt-edge-on)}
.sw input:focus-visible+.mt,.opt:focus-visible .mt{outline:none;box-shadow:inset 0 0 0 1px var(--mt-edge),0 0 0 4px var(--mt-focus)}
.mt-th{position:absolute;top:4.6cqw;left:4.6cqw;width:47.6cqw;height:47.6cqw;display:grid;place-items:center;border-radius:999px;background:var(--mt-thumb);box-shadow:var(--mt-shadow);
  transform:translate3d(calc(var(--p,0) * 43.2cqw),0,0) scale(var(--sx,1),var(--sy,1));transform-origin:var(--o,center);will-change:transform}
${ON.split(',').map((s) => `${s} .mt-th`).join(',')}{--p:1}
.mt-th svg{position:absolute;width:36%;height:36%;fill:none;stroke:var(--mt-mark);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;transition:opacity .28s ease,transform .34s cubic-bezier(.32,.72,0,1)}
.mt-th svg[data-mark=check]{opacity:0;transform:scale(.6) rotate(-18deg)}
.mt-th svg[data-mark=dash]{opacity:.34;transform:scale(1)}
${ON.split(',').map((s) => `${s} .mt-th svg[data-mark=check]`).join(',')}{opacity:1;transform:scale(1) rotate(0deg)}
${ON.split(',').map((s) => `${s} .mt-th svg[data-mark=dash]`).join(',')}{opacity:0;transform:scale(.6)}
.sw .mt{width:46px}.opt .mt{width:42px}
@media (prefers-reduced-motion:reduce){.mt,.mt-th svg{transition-duration:.01ms}}`;

/**
 * The knob's spring (stiffness 210, damping 19.5, squash with speed), from ModernToggle.tsx. It runs
 * only while the knob travels; at rest the CSS state rules above hold the position, so a switch drawn
 * by any page script, or changed with JS off, is still right.
 */
export const MODERN_SWITCH_JS = `
(function () {
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var run = function (track, isOn) {
    var th = track && track.querySelector('.mt-th'); if (!th || (reduce && reduce.matches)) return;
    if (th._raf) cancelAnimationFrame(th._raf);
    var target = isOn() ? 1 : 0, v = th._v != null ? th._v : 1 - target, vel = th._vel || 0, last = performance.now();
    var put = function (p, s) { var lean = Math.min(1, Math.abs(s) / 6); th.style.setProperty('--p', p.toFixed(4)); th.style.setProperty('--sx', (1 + lean * 0.16).toFixed(4)); th.style.setProperty('--sy', (1 - lean * 0.1).toFixed(4)); th.style.setProperty('--o', s >= 0 ? 'right center' : 'left center'); };
    var step = function (now) {
      var dt = Math.min(0.032, (now - last) / 1000); last = now; target = isOn() ? 1 : 0;
      vel += ((target - v) * 210 - vel * 19.5) * dt; v += vel * dt; th._v = v; th._vel = vel; put(v, vel);
      if (Math.abs(target - v) < 0.0006 && Math.abs(vel) < 0.006) { th._v = null; th._vel = 0; th._raf = 0; ['--p', '--sx', '--sy', '--o'].forEach(function (k) { th.style.removeProperty(k); }); return; }
      th._raf = requestAnimationFrame(step);
    };
    th._raf = requestAnimationFrame(step);
  };
  document.addEventListener('change', function (e) { var i = e.target; if (i && i.matches && i.matches('.sw input[type=checkbox]')) run(i.nextElementSibling, function () { return i.checked; }); });
  document.addEventListener('click', function (e) {
    var o = e.target.closest && e.target.closest('.opt'); if (!o || !o.querySelector('.mt')) return;
    var before = o.getAttribute('aria-pressed');
    setTimeout(function () { var after = o.getAttribute('aria-pressed'); if (after !== before) run(o.querySelector('.mt'), function () { return o.getAttribute('aria-pressed') === 'true'; }); }, 0);
  }, true);
})();`;
