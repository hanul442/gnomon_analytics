// G-183: the upgrade button on 요금제. Ported from ThreeUI Community's Floating Dots CTA
// (MengTo/threeui, MIT; src/shaders/neuform-isolated/sources/floating-dots-cta.html): a saturated blue
// button lit from below, a glass highlight on top, ten points of light rising through it, and an arrow
// that draws itself on hover. Re-cut for GNOMON: the blue and the under-glow moved to our palette
// (#0582CA body, #00A6FB glow), full width inside a plan card, and the points stop for reduced motion.

/** An <a> styled as the glowing CTA; the label is plain text. */
export function glowCta(href: string, label: string): string {
  return `<a class="glow-cta" href="${href}"><span class="glow-pts" aria-hidden="true">${'<i></i>'.repeat(10)}</span><span class="glow-in">${label}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span></a>`;
}

const PTS: [string, number, number, number][] = [
  ['10%', 1, 2.35, 0.2], ['30%', 0.7, 2.5, 0.5], ['25%', 0.8, 2.2, 0.1], ['44%', 0.6, 2.05, 0], ['50%', 1, 1.9, 0],
  ['75%', 0.5, 1.5, 1.5], ['88%', 0.9, 2.2, 0.2], ['58%', 0.8, 2.25, 0.2], ['98%', 0.6, 2.6, 0.1], ['65%', 1, 2.5, 0.2],
];

export const GLOW_CTA_CSS = `
.glow-cta{--gl:0,166,251;--gb:#0582CA;cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;width:100%;min-height:48px;padding:12px 18px;
  border:none;border-radius:.75rem;outline:none;text-decoration:none;transition:all .25s ease;
  background:radial-gradient(65.28% 65.28% at 50% 100%,rgba(var(--gl),.8) 0%,rgba(var(--gl),0) 100%),linear-gradient(0deg,var(--gb),var(--gb))}
.glow-cta::before,.glow-cta::after{content:"";position:absolute;transition:all .5s ease-in-out;z-index:0}
.glow-cta::before{inset:1px;background:linear-gradient(177.95deg,rgba(255,255,255,.19) 0%,rgba(255,255,255,0) 100%);border-radius:calc(.75rem - 1px)}
.glow-cta::after{inset:2px;background:radial-gradient(65.28% 65.28% at 50% 100%,rgba(var(--gl),.8) 0%,rgba(var(--gl),0) 100%),linear-gradient(0deg,var(--gb),var(--gb));border-radius:calc(.75rem - 2px)}
.glow-cta:active{transform:scale(.95)}
.glow-cta:focus-visible{outline:2px solid #00A6FB;outline-offset:3px}
.glow-pts{overflow:hidden;width:100%;height:100%;pointer-events:none;position:absolute;inset:0;z-index:1}
.glow-pts i{bottom:-10px;position:absolute;animation:glow-rise infinite ease-in-out;pointer-events:none;width:2px;height:2px;background-color:#fff;border-radius:9999px}
@keyframes glow-rise{0%{transform:translateY(0)}85%{opacity:0}100%{transform:translateY(-55px);opacity:0}}
${PTS.map(([left, o, d, delay], i) => `.glow-pts i:nth-child(${i + 1}){left:${left};opacity:${o};animation-duration:${d}s${delay ? `;animation-delay:${delay}s` : ''}}`).join('\n')}
.glow-in{z-index:2;gap:6px;position:relative;width:100%;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;line-height:1.5;transition:color .2s ease-in-out}
.glow-in svg{width:18px;height:18px;transition:transform .3s ease;stroke:#fff;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.glow-cta:hover .glow-in svg{transform:translateX(2px)}
.glow-cta:hover .glow-in svg path{animation:glow-dash .8s linear forwards}
@keyframes glow-dash{0%{stroke-dasharray:0,20;stroke-dashoffset:0}50%{stroke-dasharray:10,10;stroke-dashoffset:-5}100%{stroke-dasharray:20,0;stroke-dashoffset:-10}}
@media (prefers-reduced-motion:reduce){.glow-pts{display:none}.glow-cta:hover .glow-in svg path{animation:none}}`;
