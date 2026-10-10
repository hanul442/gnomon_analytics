// G-185: the glass panels answer the pointer. On a fine pointer a soft light follows the cursor across the card it
// is over (a background layer, so no card changes its layout), and every glass panel has a lit top edge.
// Nothing moves by itself; phones and reduced motion keep the plain glass.

export const GLASS_CSS = `
html[data-theme=dark] .card{box-shadow:inset 0 1px rgba(255,255,255,.06),0 20px 50px -34px rgba(0,0,0,.8)}
@media (hover:hover) and (pointer:fine){
.card.gl-on{background-image:radial-gradient(420px circle at var(--mx,-999px) var(--my,-999px),rgba(0,166,251,.075),transparent 42%)}
html:not([data-theme=dark]) .card.gl-on{background-image:radial-gradient(420px circle at var(--mx,-999px) var(--my,-999px),rgba(5,130,202,.06),transparent 42%)}
}
@media (prefers-reduced-motion:reduce){.card.gl-on{background-image:none}}`;

export const GLASS_JS = `
(function () {
  if (!window.matchMedia || !matchMedia('(hover:hover) and (pointer:fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cur = null, raf = 0, x = 0, y = 0;
  var paint = function () { raf = 0; if (!cur) return; var r = cur.getBoundingClientRect(); cur.style.setProperty('--mx', (x - r.left).toFixed(0) + 'px'); cur.style.setProperty('--my', (y - r.top).toFixed(0) + 'px'); };
  document.addEventListener('pointermove', function (e) {
    var c = e.target.closest && e.target.closest('.card');
    if (c !== cur) { if (cur) cur.classList.remove('gl-on'); cur = c; if (cur) cur.classList.add('gl-on'); }
    x = e.clientX; y = e.clientY; if (cur && !raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  var off = function () { if (cur) cur.classList.remove('gl-on'); cur = null; };
  document.addEventListener('pointerout', function (e) { if (!e.relatedTarget) off(); }, { passive: true });
  window.addEventListener('blur', off);
})();`;
