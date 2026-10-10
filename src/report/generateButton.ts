// G-183: the "make an AI report" button. Ported from ThreeUI Community's Generate button
// (MengTo/threeui, MIT; src/shaders/neuform-isolated/sources/generate-button.html): a glossy near-black
// pill with layered inner light, a prismatic rim that lights from below on hover, a flickering sparkle,
// and lettering that breathes one letter after another (and bursts when pressed). Re-cut for GNOMON:
// Pretendard instead of Poppins, the glow hue moved to our accent (#00A6FB ≈ 200°), Korean labels split
// per syllable, the credit price kept beside the label, and no Tailwind (the source only used it for
// padding). The source's second label ("Generating" on focus) is left out: the click opens a credit
// confirmation first, so nothing is generating yet when the button is pressed.

const LETTER_DELAYS = Array.from({ length: 16 }, (_, i) => i);

/** Splits a label into breathing letters (a space becomes a gap, not a letter). */
const letters = (label: string) => Array.from(label).map((ch) => (ch === ' ' ? '<span class="gen-l gen-sp"> </span>' : `<span class="gen-l">${ch.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)}</span>`)).join('');

const SPARKLE = '<svg class="gen-svg" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"/></svg>';

/**
 * The button. `attrs` is pasted into the <button> tag as-is (data-create-report, data-symbol …), so the
 * existing click handlers keep working; `small` is the price shown after the label.
 */
export function genButton(label: string, attrs: string, small = ''): string {
  return `<span class="gen-wrap"><button type="button" class="gen-btn" ${attrs} aria-label="${label.replace(/"/g, '&quot;')}${small ? ` ${small.replace(/<[^>]+>/g, '')}` : ''}">${SPARKLE}<span class="gen-txt"><span class="gen-t1">${letters(label)}</span></span>${small ? `<small>${small}</small>` : ''}</button></span>`;
}

/** The same markup for page scripts (ES5), so a bar drawn in the browser looks the same. */
export const GEN_BUTTON_JS_FN = `function gnmGenButton(label, attrs, small) { var L = function (s) { return s.split('').map(function (c) { return c === ' ' ? '<span class="gen-l gen-sp"> </span>' : '<span class="gen-l">' + c.replace(/[&<>"]/g, function (x) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[x]; }) + '</span>'; }).join(''); };
  return '<span class="gen-wrap"><button type="button" class="gen-btn" ' + attrs + ' aria-label="' + label + (small ? ' ' + String(small).replace(/<[^>]+>/g, '') : '') + '">' + ${JSON.stringify(SPARKLE)} + '<span class="gen-txt"><span class="gen-t1">' + L(label) + '</span></span>' + (small ? '<small>' + small + '</small>' : '') + '</button></span>'; }`;

export const GEN_BUTTON_CSS = `
.gen-wrap{position:relative;display:inline-block;isolation:isolate;flex:none}
.gen-btn{--gr:24px;--gp:4px;--gt:.4s;--gc:#101010;--gh:200deg;user-select:none;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:9px 16px;
  font:inherit;font-size:14.5px;font-weight:700;color:#fff;background-color:var(--gc);border:solid 1px #ffffff22;border-radius:var(--gr);cursor:pointer;outline:none;
  box-shadow:inset 0 1px 1px rgba(255,255,255,.2),inset 0 2px 2px rgba(255,255,255,.15),inset 0 4px 4px rgba(255,255,255,.1),inset 0 8px 8px rgba(255,255,255,.05),inset 0 16px 16px rgba(255,255,255,.05),
    0 -1px 1px rgba(0,0,0,.02),0 -2px 2px rgba(0,0,0,.03),0 -4px 4px rgba(0,0,0,.05),0 -8px 8px rgba(0,0,0,.06),0 -16px 16px rgba(0,0,0,.08);
  transition:box-shadow var(--gt),border var(--gt),background-color var(--gt)}
.gen-btn::before{content:"";position:absolute;top:calc(0px - var(--gp));left:calc(0px - var(--gp));width:calc(100% + var(--gp) * 2);height:calc(100% + var(--gp) * 2);
  border-radius:calc(var(--gr) + var(--gp));pointer-events:none;background-image:linear-gradient(0deg,#0004,#000a);z-index:-1;transition:box-shadow var(--gt),filter var(--gt);
  box-shadow:0 -8px 8px -6px #0000 inset,0 -16px 16px -8px #00000000 inset,1px 1px 1px #fff2,2px 2px 2px #fff1,-1px -1px 1px #0002,-2px -2px 2px #0001}
.gen-btn::after{content:"";position:absolute;inset:0;border-radius:var(--gr);pointer-events:none;
  background-image:linear-gradient(0deg,#fff,hsl(var(--gh),100%,70%),hsla(var(--gh),100%,70%,50%),8%,transparent);opacity:0;transition:opacity var(--gt),filter var(--gt)}
.gen-l{position:relative;display:inline-block;color:#ffffff55;animation:gen-letter 2s ease-in-out infinite;transition:color var(--gt),text-shadow var(--gt),opacity var(--gt)}
.gen-sp{width:.3em}
@keyframes gen-letter{50%{text-shadow:0 0 3px #ffffff88;color:#fff}}
.gen-svg{flex:none;width:22px;height:22px;fill:#e8e8e8;animation:gen-flicker 2s linear infinite;animation-delay:.5s;filter:drop-shadow(0 0 2px #ffffff99);transition:fill var(--gt),filter var(--gt),opacity var(--gt)}
@keyframes gen-flicker{50%{opacity:.3}}
.gen-txt{position:relative;display:flex;align-items:center}
.gen-t1{word-spacing:-1em;white-space:nowrap}
.gen-t1{animation:gen-appear 1s ease-in-out forwards}
@keyframes gen-appear{0%{opacity:0}100%{opacity:1}}
.gen-btn small{font-size:12px;font-weight:600;color:#ffffff99}
.gen-btn:focus-visible .gen-l,.gen-btn[data-pressed] .gen-l{animation:gen-burst 1s ease-in-out forwards,gen-letter 1.2s ease-in-out infinite;animation-delay:0s,1s}
@keyframes gen-burst{0%,100%{filter:blur(0)}50%{transform:scale(2);filter:blur(10px) brightness(150%) drop-shadow(-36px 12px 12px hsl(var(--gh),100%,70%))}}
.gen-btn:focus-visible .gen-svg,.gen-btn[data-pressed] .gen-svg{animation-duration:1.2s;animation-delay:.2s}
.gen-btn:focus-visible::before,.gen-btn[data-pressed]::before{box-shadow:0 -8px 12px -6px #fff3 inset,0 -16px 16px -8px hsla(var(--gh),100%,70%,20%) inset,1px 1px 1px #fff3,2px 2px 2px #fff1,-1px -1px 1px #0002,-2px -2px 2px #0001}
.gen-btn:focus-visible::after,.gen-btn[data-pressed]::after{opacity:.6;-webkit-mask-image:linear-gradient(0deg,#fff,transparent);mask-image:linear-gradient(0deg,#fff,transparent);filter:brightness(100%)}
${LETTER_DELAYS.slice(1).map((i) => `.gen-l:nth-child(${i + 1}){animation-delay:${(i * 0.08).toFixed(2)}s}`).join('')}
${LETTER_DELAYS.slice(1).map((i) => `.gen-btn:focus-visible .gen-l:nth-child(${i + 1}),.gen-btn[data-pressed] .gen-l:nth-child(${i + 1}){animation-delay:${(i * 0.08).toFixed(2)}s,${(i * 0.08 + 1).toFixed(2)}s}`).join('')}
.gen-btn:active{border:solid 1px hsla(var(--gh),100%,80%,.7);background-color:hsla(var(--gh),50%,20%,.5)}
.gen-btn:active::before{box-shadow:0 -8px 12px -6px #fffa inset,0 -16px 16px -8px hsla(var(--gh),100%,70%,.8) inset,1px 1px 1px #fff4,2px 2px 2px #fff2,-1px -1px 1px #0002,-2px -2px 2px #0001}
.gen-btn:active::after{opacity:1;-webkit-mask-image:linear-gradient(0deg,#fff,transparent);mask-image:linear-gradient(0deg,#fff,transparent);filter:brightness(200%)}
.gen-btn:active .gen-l{text-shadow:0 0 1px hsla(var(--gh),100%,90%,.9);animation:none}
.gen-btn:hover{border:solid 1px hsla(var(--gh),100%,80%,.4)}
.gen-btn:hover::before{box-shadow:0 -8px 8px -6px #fffa inset,0 -16px 16px -8px hsla(var(--gh),100%,70%,.3) inset,1px 1px 1px #fff2,2px 2px 2px #fff1,-1px -1px 1px #0002,-2px -2px 2px #0001}
.gen-btn:hover::after{opacity:1;-webkit-mask-image:linear-gradient(0deg,#fff,transparent);mask-image:linear-gradient(0deg,#fff,transparent)}
.gen-btn:hover .gen-svg{fill:#fff;filter:drop-shadow(0 0 3px hsl(var(--gh),100%,70%)) drop-shadow(0 -4px 6px #0009);animation:none}
.gen-btn:focus-visible{outline:2px solid #00A6FB;outline-offset:4px}
@media (prefers-reduced-motion:reduce){.gen-l,.gen-svg,.gen-t1{animation:none!important;color:#fff}}`;

/** A press marks the button for one burst (the source used :focus, which a mouse click only briefly holds). */
export const GEN_BUTTON_JS = `
document.addEventListener('pointerdown', function (e) {
  var b = e.target.closest && e.target.closest('.gen-btn'); if (!b) return;
  b.removeAttribute('data-pressed'); void b.offsetWidth; b.setAttribute('data-pressed', '');
  clearTimeout(b._gp); b._gp = setTimeout(function () { b.removeAttribute('data-pressed'); }, 2200);
});`;
