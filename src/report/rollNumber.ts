// G-185: prices and changes roll into place like an odometer. On first sight each digit spins through a few
// numbers and lands, left to right; when a live quote moves, only the digits that changed roll, upwards when the
// price rose and downwards when it fell. The element's text stays the plain number (the spinning digits are a
// CSS pseudo-element), so scripts that read the price back still read "1,842,000원".

export const ROLL_CSS = `
.rl{display:inline-block;position:relative;overflow:hidden;height:1.18em;line-height:1.18;vertical-align:-.2em}
.rl-v{display:inline-block}
.rl.go::before{content:attr(data-seq);position:absolute;left:0;right:0;top:0;white-space:pre;text-align:center;animation:rl-out var(--d,700ms) cubic-bezier(.22,.9,.24,1) var(--dl,0ms) both}
.rl.go .rl-v{animation:rl-in var(--d,700ms) cubic-bezier(.22,.9,.24,1) var(--dl,0ms) both}
.rl.go.dn::before{top:auto;bottom:0;animation-name:rl-out-dn}
.rl.go.dn .rl-v{animation-name:rl-in-dn}
@keyframes rl-out{from{transform:translateY(0)}to{transform:translateY(calc(var(--n) * -1.18em))}}
@keyframes rl-in{from{transform:translateY(calc(var(--n) * 1.18em))}to{transform:none}}
@keyframes rl-out-dn{from{transform:translateY(0)}to{transform:translateY(calc(var(--n) * 1.18em))}}
@keyframes rl-in-dn{from{transform:translateY(calc(var(--n) * -1.18em))}to{transform:none}}
@media (prefers-reduced-motion:reduce){.rl.go::before{display:none}.rl.go .rl-v{animation:none}}`;

export const ROLL_JS = `
(function () {
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  /** Sets el's text, rolling the digits. dir: 1 up, -1 down, 0 first appearance (every digit spins). */
  window.gnmRoll = function (el, text, dir) {
    var old = el.getAttribute('data-rv'); el.setAttribute('data-rv', text);
    if (reduced || old === text) { if (el.textContent !== text) el.textContent = text; return; }
    var nd = text.replace(/[^0-9]/g, ''), od = (old || '').replace(/[^0-9]/g, ''), k = 0, html = '', first = old == null || dir === 0;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (c < '0' || c > '9') { html += esc(c); continue; }
      var fromRight = nd.length - 1 - k, o = od.charAt(od.length - 1 - fromRight), seq = [], down = dir < 0; k++;
      if (first) { var n = 3 + (k % 3) + Math.floor(k / 2); for (var j = 0; j < n; j++) seq.push(String((+c + 3 + j * 7) % 10)); down = false; }
      else if (o === c) { html += '<span class="rl"><span class="rl-v">' + c + '</span></span>'; continue; }
      else { var a = o === '' ? (+c + 5) % 10 : +o, step = down ? -1 : 1; while (a !== +c) { seq.push(String(a)); a = (a + step + 10) % 10; } }
      if (down) seq.reverse();
      var ms = first ? 620 + seq.length * 45 : 420 + seq.length * 40, dl = first ? (k - 1) * 45 : 0;
      html += '<span class="rl go' + (down ? ' dn' : '') + '" style="--n:' + seq.length + ';--d:' + ms + 'ms;--dl:' + dl + 'ms" data-seq="' + seq.join('\\n') + '"><span class="rl-v">' + c + '</span></span>';
    }
    el.innerHTML = html;
  };
  // First sight: the hero's price and change, and anything marked data-roll, roll once when they come into view.
  var seen = window.IntersectionObserver ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (!e.isIntersecting) return; seen.unobserve(e.target); var t = e.target.textContent.trim(); if (/[0-9]/.test(t)) gnmRoll(e.target, t, 0); }); }, { threshold: 0.6 }) : null;
  window.gnmRollIn = function (root) {
    if (!seen) return;
    (root || document).querySelectorAll('.hero-price [data-live-f=price],.hero-price [data-live-f=full],.hero-price>b,.hero-price>span.up,.hero-price>span.down,[data-roll]').forEach(function (el) { if (el.__rl) return; el.__rl = 1; seen.observe(el); });
  };
  gnmRollIn();
})();`;
