// G-183: the market temperature dial on 시장 데일리. Ported from ThreeUI Community's Performance Gauges,
// Turbo Boost dial (MengTo/threeui, MIT; src/shaders/neuform-isolated/sources/performance-gauges.html):
// the screwed mounting plate, the knurled metal bezel, the navy dial face, ticks and numerals on a
// 270° sweep, a coloured zone band, the needle's self-test sweep and idle flutter, the count-up readout,
// glass and dust, and the pulsing over-limit lamp. Re-cut for GNOMON: the boost bar scale (−1.0…1.5,
// wastegate 1.2) becomes the market's temperature (−100…+100: strong-signal stocks minus weak ones, as
// a share of all), the vacuum half reads 약세 (our down blue), the pressure half 강세 (our up red), and
// the lamp lights at +60 as 과열. Ticks and numerals are drawn here instead of by script, the Iconify
// glyph is an inline thermometer, there is no Tailwind, and the self-test runs once each time the dial
// scrolls into view rather than every eight seconds.
import type { MarketPulse } from '../analysis/quickCalc.js';
import { esc } from './html.js';

const SPEC = { start: -135, sweep: 270, min: -100, max: 100, majorStep: 50, minorPerMajor: 5, hot: 60 };
const angleFor = (v: number) => SPEC.start + ((v - SPEC.min) / (SPEC.max - SPEC.min)) * SPEC.sweep;
const ZONES: [number, number, string][] = [[-100, 0, 'rgba(92,187,255,.55)'], [0, SPEC.hot, 'rgba(255,122,122,.55)'], [SPEC.hot, 100, 'rgba(220,38,38,.9)']];
const tickColor = (v: number) => (v >= SPEC.hot ? 'rgba(248,113,113,.95)' : v < 0 ? 'rgba(143,208,255,.75)' : 'rgba(255,155,155,.8)');
const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0');

/** The temperature: (strong-signal minus weak-signal stocks) / counted, as −100…+100. */
export function temperatureOf(p: MarketPulse): number {
  return p.counted ? Math.round(((p.bull - p.bear) / p.counted) * 100) : 0;
}

function ticks(): string {
  const step = SPEC.majorStep / SPEC.minorPerMajor, count = Math.round((SPEC.max - SPEC.min) / step);
  let out = '';
  for (let i = 0; i <= count; i += 1) {
    const v = SPEC.min + i * step;
    out += `<div class="tg-spoke" style="transform:rotate(${angleFor(v).toFixed(2)}deg)"><i class="tg-tick ${i % SPEC.minorPerMajor === 0 ? 'major' : 'minor'}" style="background:${tickColor(v)}"></i></div>`;
  }
  return out;
}

function numerals(): string {
  let out = '';
  for (let v = SPEC.min; v <= SPEC.max; v += SPEC.majorStep) {
    const a = angleFor(v);
    out += `<div class="tg-spoke" style="transform:rotate(${a.toFixed(2)}deg)"><span class="tg-num" style="transform:translateX(-50%) rotate(${(-a).toFixed(2)}deg)">${signed(v)}</span></div>`;
  }
  return out;
}

const band = () => ZONES.map(([from, to, color]) => {
  const span = ((to - from) / (SPEC.max - SPEC.min)) * SPEC.sweep;
  return `conic-gradient(from ${angleFor(from).toFixed(2)}deg, ${color} 0deg, ${color} ${span.toFixed(2)}deg, transparent ${span.toFixed(2)}deg)`;
}).join(', ');

const THERMO = '<svg class="tg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14.6V5a2 2 0 1 1 4 0v9.6a4 4 0 1 1-4 0Z"/><path d="M12 9v7"/></svg>';

/** The dial for one market; empty without a pulse. */
export function tempGauge(p: MarketPulse | null | undefined, name: string): string {
  if (!p || !p.counted) return '';
  const t = temperatureOf(p), tone = t > 0 ? 'up' : t < 0 ? 'down' : '';
  // the same ±10% line as the temperature card beside it (marketTemperature: lean vs counted × 0.1)
  const say = t >= SPEC.hot ? '과열이에요' : t > 10 ? '강세 쪽이에요' : t < -10 ? '약세 쪽이에요' : '엇갈려요';
  name = esc(name);
  const screws = [['12deg', 'top', 'left'], ['-40deg', 'top', 'right'], ['29deg', 'bottom', 'left'], ['-6deg', 'bottom', 'right']]
    .map(([a, y, x]) => `<span class="tg-screw" style="--a:${a};${y}:6.4cqw;${x}:6.4cqw"></span>`).join('');
  return `<figure class="tg-card" data-temp-gauge data-value="${t}" data-hot="${SPEC.hot}" role="img" aria-label="${name} 온도 ${signed(t)}점, ${say}. 강세 ${p.bull}종목, 약세 ${p.bear}종목, 전체 ${p.counted}종목 기준">
<div class="tg-plate">${screws}<div class="tg-shell"><div class="tg-bezel"><div class="tg-face">
<div class="tg-layer tg-rays"></div><div class="tg-layer tg-band" style="background:${band()}"></div>
<div class="tg-layer">${ticks()}</div><div class="tg-layer">${numerals()}</div>
<div class="tg-stack" style="top:30%">${THERMO}<span class="tg-cap" style="margin-top:1.62cqw">${name} 온도</span></div>
<div class="tg-stack" style="top:57%"><span class="tg-read ${tone}" data-readout>${signed(t)}</span><span class="tg-cap tg-unit" style="margin-top:1.85cqw">점</span></div>
<div class="tg-stack" style="top:79%"><div class="tg-limit"><span class="tg-lamp" data-overboost${t >= SPEC.hot ? '' : ' hidden'}></span><span>과열 +${SPEC.hot}</span></div></div>
<div class="tg-needle" data-needle style="--angle:${angleFor(t).toFixed(2)}deg"><div class="tg-flutter" data-live><i class="tg-blade"></i><i class="tg-tail"></i></div></div>
<div class="tg-hub"><span></span></div><div class="tg-grain"></div><div class="tg-glass"></div><div class="tg-dust"></div>
</div></div></div></div><figcaption class="tg-say ${tone}">${say}</figcaption></figure>`;
}

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23g)'/%3E%3C/svg%3E\")";
const METAL = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='m'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.008 1.5' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23m)'/%3E%3C/svg%3E\")";
const DUST = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='d'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.014' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeComponentTransfer%3E%3CfeFuncA type='linear' slope='0.6'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23d)'/%3E%3C/svg%3E\")";

export const TEMP_GAUGE_CSS = `
.mk-temp{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:16px;align-items:center}
@media (max-width:820px){.mk-temp{grid-template-columns:1fr;justify-items:center}.mk-temp>.card{width:100%}}
.tg-card{--tex-grain:${GRAIN};--tex-metal:${METAL};--tex-dust:${DUST};container-type:inline-size;position:relative;width:100%;max-width:300px;aspect-ratio:1;margin:0;color-scheme:dark}
.tg-plate{position:absolute;inset:0;border-radius:11.5cqw;background:radial-gradient(120% 100% at 30% 0%,#121215 0%,#09090A 55%,#060607 100%);border:1px solid rgba(255,255,255,.03);
  box-shadow:0 1px 1px -.5px rgba(0,0,0,.5),0 3px 3px -1.5px rgba(0,0,0,.4),0 6px 6px -3px rgba(0,0,0,.35),0 12px 12px -6px rgba(0,0,0,.3),0 24px 24px -12px rgba(0,0,0,.25);transition:border-color .5s}
.tg-plate::before{content:"";position:absolute;inset:0;border-radius:inherit;background-image:var(--tex-grain),var(--tex-dust);background-size:34cqw 34cqw,170% 170%;background-blend-mode:soft-light,normal;mix-blend-mode:screen;opacity:.07;pointer-events:none}
.tg-card:hover .tg-plate{border-color:rgba(255,255,255,.08)}
.tg-shell{position:absolute;inset:13cqw;border-radius:50%;padding:2.2%;background:var(--tex-metal),conic-gradient(from 210deg,#3a3a3d 0deg,#17171a 60deg,#2c2c30 130deg,#0d0d0f 200deg,#313135 280deg,#131316 340deg,#3a3a3d 360deg);
  background-size:100% 100%,auto;background-blend-mode:overlay,normal;box-shadow:0 18px 40px -12px rgba(0,0,0,.9),0 2px 0 rgba(255,255,255,.05),inset 0 2px 6px rgba(255,255,255,.10),inset 0 -6px 14px rgba(0,0,0,.65)}
.tg-bezel{position:relative;width:100%;height:100%;border-radius:50%;padding:3.4%;background:radial-gradient(closest-side,#0b0b0d 76%,#212125 92%,#08080a 100%);box-shadow:inset 0 1px 1px rgba(255,255,255,.10),inset 0 -3px 8px rgba(0,0,0,.8)}
.tg-bezel::before{content:"";position:absolute;inset:0;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.16) 0deg .5deg,rgba(0,0,0,0) .5deg 2.2deg);
  -webkit-mask-image:radial-gradient(closest-side,transparent 92%,#000 93.5%,#000 99%,transparent 100%);mask-image:radial-gradient(closest-side,transparent 92%,#000 93.5%,#000 99%,transparent 100%);opacity:.45;pointer-events:none}
.tg-bezel::after{content:"";position:absolute;inset:0;border-radius:50%;background-image:var(--tex-metal);background-size:100% 100%;
  -webkit-mask-image:radial-gradient(closest-side,transparent 95%,#000 96.5%,#000 100%);mask-image:radial-gradient(closest-side,transparent 95%,#000 96.5%,#000 100%);mix-blend-mode:overlay;opacity:.55;pointer-events:none}
.tg-screw{position:absolute;width:5cqw;aspect-ratio:1;border-radius:50%;
  background:radial-gradient(circle at 34% 26%,rgba(255,255,255,.55) 0%,rgba(255,255,255,.08) 26%,rgba(255,255,255,0) 46%),radial-gradient(closest-side,rgba(0,0,0,0) 58%,rgba(0,0,0,.45) 84%,rgba(0,0,0,.7) 100%),
    conic-gradient(from calc(var(--a,0deg) - 52deg),#9a9ba1 0deg,#43444a 34deg,#c3c4ca 74deg,#4d4e55 118deg,#a7a8ae 168deg,#37383d 214deg,#b2b3b9 262deg,#45464c 312deg,#9a9ba1 360deg);
  box-shadow:0 0 0 .16cqw rgba(0,0,0,.6),0 .12cqw 0 .16cqw rgba(255,255,255,.05),0 .3cqw .6cqw rgba(0,0,0,.75),inset 0 -.16cqw .32cqw rgba(0,0,0,.6),inset 0 .12cqw .24cqw rgba(255,255,255,.4)}
.tg-screw::before{content:"";position:absolute;inset:22%;transform:rotate(var(--a,0deg));
  background:linear-gradient(#050506,#1e1e23) center/100% 20% no-repeat,linear-gradient(#050506,#1e1e23) center/20% 100% no-repeat,linear-gradient(rgba(255,255,255,.62),rgba(255,255,255,.62)) center calc(50% + .11cqw)/100% 20% no-repeat,linear-gradient(rgba(255,255,255,.62),rgba(255,255,255,.62)) calc(50% + .11cqw) center/20% 100% no-repeat}
.tg-screw::after{content:"";position:absolute;inset:0;border-radius:50%;background-image:var(--tex-metal);background-size:100% 100%;mix-blend-mode:overlay;opacity:.45}
.tg-face{container-type:inline-size;position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;background:radial-gradient(closest-side at 50% 26%,#17324F 0%,#0F172A 48%,#030816 100%);box-shadow:inset 0 5px 16px rgba(0,0,0,.5),inset 0 -2px 9px rgba(0,0,0,.4)}
.tg-layer{position:absolute;inset:0;pointer-events:none}
.tg-rays{background:repeating-conic-gradient(from 0deg,rgba(0,166,251,.06) 0deg 1.4deg,rgba(0,0,0,0) 1.4deg 2.8deg);-webkit-mask-image:radial-gradient(closest-side,#000 0%,#000 56%,transparent 64%);mask-image:radial-gradient(closest-side,#000 0%,#000 56%,transparent 64%)}
.tg-band{-webkit-mask-image:radial-gradient(closest-side,transparent 88%,#000 89%,#000 95.5%,transparent 96.5%);mask-image:radial-gradient(closest-side,transparent 88%,#000 89%,#000 95.5%,transparent 96.5%)}
.tg-spoke{position:absolute;inset:0}
.tg-tick{position:absolute;left:50%;transform:translateX(-50%);border-radius:1px}
.tg-tick.minor{top:9%;width:.9%;height:2.8%;opacity:.5}.tg-tick.major{top:8%;width:1.8%;height:6.4%}
.tg-num{position:absolute;left:50%;top:17.5%;line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums;font-size:5.2cqw;font-weight:400;color:rgba(255,255,255,.7)}
.tg-needle{position:absolute;inset:0;transform:rotate(var(--angle,0deg));transition:transform var(--needle-duration,1200ms) var(--needle-ease,cubic-bezier(.16,1.32,.4,1));will-change:transform}
.tg-flutter{position:absolute;inset:0}
.tg-blade{position:absolute;left:50%;top:11.5%;bottom:50%;width:3.2%;transform:translateX(-50%);clip-path:polygon(41% 0,59% 0,100% 97%,100% 100%,0 100%,0 97%);
  background:linear-gradient(#5CC8FF,#00A6FB 50%,#006494);filter:drop-shadow(0 0 8px rgba(0,166,251,.65))}
.tg-blade::after{content:"";position:absolute;inset:7% 40% 20% 40%;border-radius:999px;background:linear-gradient(rgba(255,255,255,.34),rgba(255,255,255,0))}
.tg-tail{position:absolute;left:50%;top:50%;width:2%;height:9.5%;transform:translateX(-50%);border-radius:0 0 999px 999px;background:linear-gradient(#0582CA,#003554);filter:drop-shadow(0 2px 4px rgba(0,0,0,.5))}
.tg-hub{position:absolute;left:50%;top:50%;width:9%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle at 34% 30%,#5c5c63,#1b1b1f 60%,#050506);box-shadow:0 3px 8px rgba(0,0,0,.75),inset 0 1px 2px rgba(255,255,255,.35);display:grid;place-items:center}
.tg-hub span{display:block;width:38%;aspect-ratio:1;border-radius:50%;background:rgba(0,166,251,.85);box-shadow:0 0 6px rgba(0,166,251,.85)}
.tg-glass{position:absolute;inset:0;border-radius:50%;background:radial-gradient(120% 78% at 22% 6%,rgba(255,255,255,.20) 0%,rgba(255,255,255,.05) 32%,rgba(255,255,255,0) 56%),linear-gradient(148deg,rgba(255,255,255,.12) 0%,rgba(255,255,255,0) 40%);mix-blend-mode:screen;pointer-events:none}
.tg-glass::after{content:"";position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 20px rgba(0,0,0,.5),inset 0 1px 1px rgba(255,255,255,.2)}
.tg-dust{position:absolute;inset:0;border-radius:50%;background-image:var(--tex-dust),var(--tex-grain);background-size:130% 130%,30.03cqw 30.03cqw;mix-blend-mode:soft-light;opacity:.3;pointer-events:none}
.tg-grain{position:absolute;inset:0;background-image:var(--tex-grain);background-size:25.4cqw 25.4cqw;mix-blend-mode:overlay;opacity:.13;pointer-events:none}
.tg-stack{position:absolute;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center}
.tg-ic{width:6.47cqw;height:6.47cqw;fill:none;stroke:rgba(92,200,255,.8);stroke-width:1.6;stroke-linecap:round}
.tg-cap{font-size:3.7cqw;font-weight:600;letter-spacing:.12em;text-indent:.12em;line-height:1;color:rgba(255,255,255,.45);white-space:nowrap}
.tg-unit{color:rgba(92,200,255,.7)}
.tg-read{font-size:8.55cqw;font-weight:300;line-height:1;font-variant-numeric:tabular-nums;color:#CFE3FF;text-shadow:0 0 12px rgba(0,166,251,.5)}
.tg-read.up{color:#FF9B9B;text-shadow:0 0 12px rgba(255,122,122,.5)}.tg-read.down{color:#8FD0FF;text-shadow:0 0 12px rgba(92,187,255,.5)}
.tg-limit{display:flex;align-items:center;gap:1.62cqw;font-size:3.1cqw;font-weight:600;letter-spacing:.08em;color:rgba(255,255,255,.5);white-space:nowrap}
.tg-lamp{display:block;width:2.3cqw;height:2.3cqw;border-radius:50%;background:#ef4444;animation:tg-pulse 1.4s ease-in-out infinite}
.tg-lamp[hidden]{display:none}
.tg-say{position:absolute;left:0;right:0;bottom:-26px;text-align:center;font-size:13px;font-weight:700;color:var(--fg2)}
.tg-say.up{color:var(--up)}.tg-say.down{color:var(--down)}
.mk-temp .tg-card{margin-bottom:26px}
@keyframes tg-flutter{0%,100%{transform:rotate(-.4deg)}50%{transform:rotate(.4deg)}}
.tg-flutter[data-live]{animation:tg-flutter 2.6s ease-in-out infinite}
@keyframes tg-pulse{0%,100%{opacity:.35}50%{opacity:1}}
@media (prefers-reduced-motion:reduce){.tg-needle{transition:none!important}.tg-flutter[data-live],.tg-lamp{animation:none!important}}`;

/**
 * The instrument's self-test (full-scale sweep, back to rest, settle on the reading, then flutter), with
 * the readout counting along, from the source's runInstrument. It runs when a dial scrolls into view,
 * and again if it leaves and comes back; reduced motion shows the reading at once.
 */
export const TEMP_GAUGE_JS = `
(function () {
  var cards = document.querySelectorAll('[data-temp-gauge]'); if (!cards.length) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var S = { start: -135, sweep: 270, min: -100, max: 100 };
  var ang = function (v) { return S.start + ((v - S.min) / (S.max - S.min)) * S.sweep; };
  var fmt = function (v) { v = Math.round(v); return v > 0 ? '+' + v : v < 0 ? '\\u2212' + Math.abs(v) : '0'; };
  var run = function (card) {
    var value = +card.getAttribute('data-value'), hot = +card.getAttribute('data-hot'), needle = card.querySelector('[data-needle]'), flutter = card.querySelector('.tg-flutter'), out = card.querySelector('[data-readout]'), lamp = card.querySelector('[data-overboost]');
    if (card._t) card._t.forEach(clearTimeout); card._t = []; var run_id = card._run = (card._run || 0) + 1;
    var sweep = function (v, ms) { needle.style.setProperty('--needle-duration', ms + 'ms'); needle.style.setProperty('--angle', ang(v) + 'deg'); if (lamp) lamp.hidden = v < hot; };
    var count = function (from, to, ms) { var t0 = performance.now(); var step = function (now) { if (card._run !== run_id) return; var p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3); out.textContent = fmt(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); };
    flutter.removeAttribute('data-live');
    sweep(S.max, 1100); count(S.min, S.max, 1100);
    card._t.push(setTimeout(function () { sweep(S.min, 900); count(S.max, S.min, 900); }, 1350));
    card._t.push(setTimeout(function () { sweep(value, 1200); count(S.min, value, 1200); }, 2500));
    card._t.push(setTimeout(function () { flutter.setAttribute('data-live', ''); }, 3900));
  };
  if (reduce || !window.IntersectionObserver) return;
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var c = e.target;
      if (e.isIntersecting && e.intersectionRatio >= 0.6 && !c._seen) { c._seen = true; run(c); }
      else if (!e.isIntersecting) c._seen = false;
    });
  }, { threshold: [0, 0.6] });
  cards.forEach(function (c) { io.observe(c); });
})();`;
