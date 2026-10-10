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
.gen-l{position:relative;display:inline-block;color:#ffffffa8;animation:gen-letter 2s ease-in-out infinite;transition:color var(--gt),text-shadow var(--gt),opacity var(--gt)}
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
/* G-185: work happens inside the button. A fill grows with the job (or sweeps while the length is unknown), a small
   spinner turns, and the label says what is happening and how long is left. */
[data-job]{position:relative}
[data-job] .job-main,[data-job] .job-sub,[data-job] .job-spin,[data-job] .job-ok{position:relative;z-index:1}
.job-main{font-weight:800;white-space:nowrap}
.job-sub{font-size:12px;font-weight:600;opacity:.82;font-variant-numeric:tabular-nums;white-space:nowrap}
.job-fill{position:absolute;left:0;top:0;bottom:0;z-index:0;min-width:18px;border-radius:var(--gr,999px) 4px 4px var(--gr,999px);pointer-events:none;overflow:hidden;
  background:linear-gradient(90deg,rgba(0,166,251,.16),rgba(0,166,251,.46));box-shadow:inset -1px 0 rgba(143,208,255,.85);transition:width .9s linear}
.job-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.28) 50%,transparent 70%);background-size:220% 100%;animation:job-sheen 1.6s linear infinite}
.job-fill.indet{width:100%!important;background:linear-gradient(90deg,transparent,rgba(0,166,251,.38),transparent);background-size:45% 100%;background-repeat:no-repeat;box-shadow:none;animation:job-sweep 1.3s ease-in-out infinite}
.job-fill.indet::after{display:none}
@keyframes job-sheen{from{background-position:120% 0}to{background-position:-120% 0}}
@keyframes job-sweep{from{background-position:-60% 0}to{background-position:160% 0}}
.job-spin{flex:none;width:15px;height:15px;border-radius:50%;border:2px solid rgba(255,255,255,.22);border-top-color:#8FD0FF;animation:job-spin .8s linear infinite}
@keyframes job-spin{to{transform:rotate(360deg)}}
.job-ok{flex:none;display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#86E3B5;color:#0A1626;font-size:11px;font-weight:900}
[data-job=running],[data-job=sending]{cursor:progress}
.gen-btn[data-job=confirm]{border-color:rgba(0,166,251,.75);animation:job-ask 1.4s ease-in-out infinite}
@keyframes job-ask{50%{box-shadow:0 0 0 4px rgba(0,166,251,.22),inset 0 1px 1px rgba(255,255,255,.2)}}
.gen-btn[data-job=done]{border-color:rgba(134,227,181,.6)}
.gen-btn[data-job=short],.gen-btn[data-job=failed]{border-color:rgba(255,122,122,.55)}
.job-cancel{margin-left:8px;height:32px;padding:0 12px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.06);color:#C3CDD6;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;vertical-align:middle}
.gen-wrap>.job-cancel{position:absolute;right:8px;top:50%;margin:0;transform:translateY(-50%);z-index:2}.gen-btn[data-job=confirm]{padding-right:76px}
.rs-bar .sa-tx small{transition:opacity .16s}.rs-bar .sa-tx small.swap{opacity:0}
.job-float{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:6px;max-width:calc(100% - 24px);animation:job-rise .35s cubic-bezier(.16,1,.3,1)}
.job-float .job-x{width:34px;height:34px;border:0;border-radius:50%;background:rgba(10,22,38,.8);color:#fff;font-size:18px;cursor:pointer}
@keyframes job-rise{from{opacity:0;transform:translate(-50%,16px)}}
@media (min-width:821px){.job-float{bottom:24px}}
@media (prefers-reduced-motion:reduce){.gen-l,.gen-svg,.gen-t1,.job-fill::after,.gen-btn[data-job=confirm]{animation:none!important;color:#fff}.job-fill.indet{animation-duration:3s}}`;

/** A press marks the button for one burst (the source used :focus, which a mouse click only briefly holds). */
export const GEN_BUTTON_JS = `
// G-185: gnmBusy(button, label) shows short work (a few seconds, length unknown) inside the button: a sweeping
// light, a spinner, the label and the seconds so far. gnmBusy(button, false) puts the button back.
window.gnmBusy = function (b, label) {
  if (!b) return;
  if (label === false) { clearInterval(b._bz); if (b._tk) { b._tk.stop(); b._tk = null; } if (b._bo != null) { b.innerHTML = b._bo; b._bo = null; } b.style.minWidth = ''; delete b.dataset.job; b.removeAttribute('aria-busy'); return; }
  if (b._bo == null) { b._bo = b.innerHTML; b.style.minWidth = b.offsetWidth ? b.offsetWidth + 'px' : ''; }
  b.dataset.job = 'running'; b.setAttribute('aria-busy', 'true');
  b.innerHTML = '<i class="job-fill indet"></i><span class="job-spin" aria-hidden="true"></span><span class="job-main"></span><small class="job-sub">0초</small>';
  b.querySelector('.job-main').textContent = label; var t0 = Date.now();
  // The ThreeUI Thinking light runs round the button while it works (G-185); the label counts the seconds.
  if (window.gnmThinking && !b._tk) b._tk = gnmThinking(b, label);
  clearInterval(b._bz); b._bz = setInterval(function () { var s = b.querySelector('.job-sub'); if (!s) { clearInterval(b._bz); return; } var n = Math.round((Date.now() - t0) / 1000); s.textContent = n + '초'; if (b._tk) b._tk.text(label + ' · ' + n + '초'); }, 1000);
};
document.addEventListener('pointerdown', function (e) {
  var b = e.target.closest && e.target.closest('.gen-btn'); if (!b) return;
  b.removeAttribute('data-pressed'); void b.offsetWidth; b.setAttribute('data-pressed', '');
  clearTimeout(b._gp); b._gp = setTimeout(function () { b.removeAttribute('data-pressed'); }, 2200);
});`;
