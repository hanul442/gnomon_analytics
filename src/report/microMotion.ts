// G-296 (한서님 10/24, libraries.dev · bencho.dev · morphin.dev 릴스 → 후보 16개 중 '10빼고 다 ㄱㄱ'): small motions
// picked from those three UI libraries, rebuilt for GNOMON in plain CSS/JS on the spring tokens (motionTokens.ts).
// Demo page the picks came from: https://claude.ai/artifact/E8LWYsSqeByXmmTR6zAmF4
//
// Licences: libraries.dev (Jakub Antalik) is MIT: Border Beam, Bots and Gooey are re-cut here from their ideas, no
// React. bencho.dev and morphin.dev have paid tiers, so only the ideas are borrowed; every line below is our own.
//
//  2  테두리 빛        a grey light runs around a card while the committee or the AI is working (Border Beam, MIT)
//  3  흐림에서 또렷하게  the committee's verdict line arrives word by word, from blur (bencho Text blur)
//  4  뼈대가 내용으로    a loading skeleton grows into its text instead of popping; loaded cards arrive from blur
//  5  당겨서 새로고침    pull the page down at the top: a sundial shadow turns, let go to reload (phones)
//  6  넘기는 카드        the committee's members as a deck under the vote bar, swiped one by one (bencho Swipe deck)
//  7  끝이 흐려지는 유리  content blurs a little more the closer it gets to the bottom bar (bencho Progressive blur)
//  9  별 톡             the watchlist star pops and throws six sparks when it is filled (bencho Like)
// 11  위원 얼굴         debate and deck avatars get two blinking eyes; the one typing bobs (Bots, MIT)
// 12  돌려서 가격 정하기  a picker wheel under the price alert's input (bencho Picker wheel)
// 13  업종 지도 꾹       a heat tile you touch lifts and the others fade (bencho Heat map)
// 14  겹친 이슈 펼치기    issue ranking rows after the top three sit as a stack until tapped (morphin Card stack)
// 15  밀어서 확인        a credit-spending button in its "press again" state can also be slid to confirm (Slide to confirm)
// 16  ✦ 갈라지기        the bar's ✦ splits, gooey, into this screen's first questions and 직접 묻기 (Gooey, MIT)
// 1 (숫자 굴러가기) lives in rollNumber.ts / motionSystem.ts and 8 (알림 쌓기) in plans.ts' toast.
//
// Decoration runs only under html.ms (motionSystem adds it unless the reader asks for less motion). The parts that
// are controls (pull, deck, wheel, slide, ✦ menu) keep working without motion, they just move instantly.

export const MICRO_MOTION_CSS = `
:root{--mm-beam:rgba(17,19,24,.8);--mm-face:#fff}
html[data-theme=dark]{--mm-beam:rgba(255,255,255,.75)}
/* ---- 2 테두리 빛 ---- */
@property --mm-a{syntax:"<angle>";inherits:false;initial-value:0deg}
html.ms .gnm-busy:not(#main),html.ms .msg.wait,html.ms .db-typing .db-bubble{position:relative}
html.ms .gnm-busy:not(#main)::after,html.ms .msg.wait::after,html.ms .db-typing .db-bubble::after{content:"";position:absolute;inset:0;z-index:2;border-radius:inherit;padding:2px;pointer-events:none;
 background:conic-gradient(from var(--mm-a),transparent 0 62%,var(--mm-beam) 82%,transparent 100%);
 -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0);
 animation:mm-beam 2.4s linear infinite,mm-fade-in .4s ease-out both}
html.ms .gnm-busy:not(#main){border-radius:var(--r-card,20px)}
@keyframes mm-beam{to{--mm-a:360deg}}
@keyframes mm-fade-in{from{opacity:0}}
/* ---- 3 흐림에서 또렷하게 ---- */
html.ms .mm-words>span{display:inline-block;animation:mm-word .7s var(--spring-soft) both;animation-delay:calc(var(--i) * 32ms)}
@keyframes mm-word{from{opacity:0;filter:blur(7px);transform:translateY(5px)}}
/* ---- 4 뼈대가 내용으로 ---- */
html.ms .mm-unskel{animation:mm-unskel .6s var(--spring-snappy) both}
@keyframes mm-unskel{0%{background-color:var(--soft);color:transparent;clip-path:inset(0 38% 0 0 round 8px)}55%{color:transparent}100%{background-color:transparent;clip-path:inset(0 0 0 0 round 0)}}
html.ms .mm-arrive>*{animation:mm-arrive .6s var(--spring-soft) both}
html.ms .mm-arrive>:nth-child(2){animation-delay:40ms}html.ms .mm-arrive>:nth-child(3){animation-delay:80ms}html.ms .mm-arrive>:nth-child(n+4){animation-delay:120ms}
@keyframes mm-arrive{from{opacity:0;filter:blur(6px);transform:translateY(6px)}}
/* ---- 5 당겨서 새로고침 ---- */
.mm-ptr{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:75;width:38px;height:38px;margin-left:-19px;border-radius:50%;background:var(--surface-solid,var(--surface));color:var(--fg);box-shadow:0 1px 2px rgba(10,12,16,.08),0 8px 20px -10px rgba(10,12,16,.4);display:grid;place-items:center;pointer-events:none;opacity:0;transform:translateY(-48px) scale(.6)}
.mm-ptr svg{width:22px;height:22px}.mm-ptr .mm-gn{transform-origin:12px 12px}
.mm-ptr.mm-spin .mm-gn{animation:mm-sun .9s linear infinite}
@keyframes mm-sun{to{transform:rotate(360deg)}}
/* ---- 6 넘기는 카드 ---- */
.mm-deck{margin-top:14px}
.mm-deck-h{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px;color:var(--muted);font-weight:600;margin-bottom:8px}
.mm-deck-st{position:relative;height:150px;touch-action:pan-y;outline:none}
.mm-deck-st:focus-visible{outline:2px solid var(--fg);outline-offset:4px;border-radius:20px}
.mm-dk{position:absolute;inset:0 6px 12px;background:var(--surface-solid,var(--surface));border-radius:20px;padding:14px 16px;display:grid;grid-template-columns:40px 1fr;gap:4px 12px;align-content:start;box-shadow:0 1px 2px rgba(10,12,16,.06),0 10px 24px -16px rgba(10,12,16,.45);border:1px solid var(--line);cursor:grab;user-select:none;-webkit-user-select:none}
html.ms .mm-dk{transition:transform var(--d-snappy) var(--spring-snappy),opacity .3s}
.mm-dk.mm-drag{transition:none!important;cursor:grabbing}
.mm-dk .db-av{grid-row:span 2;width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border-radius:14px;background:var(--muted);--mm-s:40px}.mm-dk .db-av-bull{background:var(--up)}.mm-dk .db-av-bear{background:var(--down)}
.mm-dk b{font-size:15px;align-self:center}.mm-dk em{font-style:normal;font-size:12px;font-weight:800;margin-left:6px}
.mm-dk p{grid-column:1/-1;margin:6px 0 0;font-size:14px;line-height:1.5;color:var(--fg2);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
/* ---- 7 끝이 흐려지는 유리 ---- */
.mm-pblur{position:fixed;left:0;right:0;bottom:0;pointer-events:none;display:none}
.mm-pblur i{position:absolute;inset:0}
.mm-pblur i:nth-child(1){-webkit-backdrop-filter:blur(1px);backdrop-filter:blur(1px);-webkit-mask:linear-gradient(transparent,#000 30%,#000 55%,transparent 80%);mask:linear-gradient(transparent,#000 30%,#000 55%,transparent 80%)}
.mm-pblur i:nth-child(2){-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);-webkit-mask:linear-gradient(transparent 30%,#000 60%,#000 80%,transparent);mask:linear-gradient(transparent 30%,#000 60%,#000 80%,transparent)}
.mm-pblur i:nth-child(3){-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);-webkit-mask:linear-gradient(transparent 55%,#000 85%);mask:linear-gradient(transparent 55%,#000 85%)}
@media (max-width:820px){html.ms:not(.chart-fs):not(.chat-open) .mm-pblur.mm-on{display:block}}
/* ---- 9 별 톡 ---- */
.star{position:relative;overflow:visible}
html.ms .star.mm-pop svg{animation:mm-star var(--d-bouncy) var(--spring-bouncy)}
@keyframes mm-star{0%{transform:scale(.55)}100%{transform:none}}
.star .mm-spk{position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px;border-radius:50%;background:currentColor;opacity:0;pointer-events:none}
html.ms .star.mm-pop .mm-spk{animation:mm-spark .6s var(--spring-soft) both}
@keyframes mm-spark{0%{opacity:1;transform:rotate(var(--r)) translateY(-6px) scale(1)}100%{opacity:0;transform:rotate(var(--r)) translateY(-24px) scale(.3)}}
/* ---- 11 위원 얼굴 ---- */
.db-av.mm-face{position:relative;font-size:0;color:transparent}
.db-av.mm-face .mm-eyes{position:absolute;left:50%;top:47%;display:flex;gap:calc(var(--mm-s,36px) * .2);transform:translate(-50%,-50%)}
.db-av.mm-face .mm-eyes i{display:block;width:calc(var(--mm-s,36px) * .15);height:calc(var(--mm-s,36px) * .22);border-radius:99px;background:var(--mm-face)}
html.ms .db-av.mm-face .mm-eyes i{animation:mm-blink 4.6s infinite;animation-delay:var(--mm-bd,0s)}
@keyframes mm-blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.12)}}
html.ms .db-typing .db-av.mm-face,html.ms .mm-dk.mm-top .db-av.mm-face{animation:mm-talk 1.1s var(--spring-soft) infinite alternate}
@keyframes mm-talk{from{transform:translateY(0)}to{transform:translateY(-3px)}}
.db-avs .db-av.mm-face{--mm-s:30px}
/* ---- 12 돌려서 가격 정하기 ---- */
.mm-wheel{position:relative;height:150px;margin:10px 0 2px;border-radius:14px;background:var(--soft);overflow:hidden}
.mm-wheel-hl{position:absolute;left:8px;right:8px;top:50%;height:36px;margin-top:-18px;border-radius:11px;background:var(--surface-solid,var(--surface));box-shadow:0 1px 2px rgba(10,12,16,.06)}
.mm-wheel-sc{position:absolute;inset:0;overflow-y:auto;scroll-snap-type:y mandatory;scrollbar-width:none;overscroll-behavior:contain;-webkit-mask:linear-gradient(transparent,#000 28%,#000 72%,transparent);mask:linear-gradient(transparent,#000 28%,#000 72%,transparent)}
.mm-wheel-sc::-webkit-scrollbar{display:none}
.mm-wheel-sc .mm-pad{height:57px}
.mm-wheel-sc button{display:block;width:100%;height:36px;border:0;background:none;scroll-snap-align:center;font:inherit;font-size:17px;font-variant-numeric:tabular-nums;color:var(--muted);cursor:pointer;position:relative}
.mm-wheel-sc button.mm-sel{color:var(--fg);font-weight:800;font-size:19px}
.mm-wheel-sc button small{font-size:11.5px;font-weight:700;margin-left:8px}
/* ---- 13 업종 지도 꾹 ---- */
.km-heat .km-cell{transform-box:fill-box;transform-origin:center}
html.ms .km-heat .km-cell,html.ms .wd-heat>span{transition:transform var(--d-snappy) var(--spring-snappy),opacity .2s}
.km-heat svg:has(.km-cell:hover) .km-cell:not(:hover),.km-heat svg:has(.km-cell:focus-visible) .km-cell:not(:focus-visible),.wd-heat.mm-pick>span:not(.mm-on){opacity:.35}
.km-heat .km-cell:hover,.km-heat .km-cell:focus-visible{transform:scale(1.07)}
.wd-heat>span{cursor:pointer;position:relative}.wd-heat>span.mm-on{transform:scale(1.08);z-index:2;box-shadow:0 8px 20px -10px rgba(10,12,16,.45)}
/* ---- 14 겹친 이슈 펼치기 ---- */
.ia-list .mm-stk{position:relative}
html.ms .ia-list .mm-stk{transition:margin-top var(--d-snappy) var(--spring-snappy),transform var(--d-snappy) var(--spring-snappy),opacity .25s}
.ia-list.mm-closed .mm-stk{margin-inline:-8px;padding-inline:8px;background:var(--surface-solid,var(--surface));border-radius:14px;box-shadow:0 1px 2px rgba(10,12,16,.05),0 8px 18px -14px rgba(10,12,16,.4)}
.ia-list.mm-closed .mm-stk:not(.mm-stk0){pointer-events:none}
.ia-list.mm-closed .mm-stk0{cursor:pointer}
.mm-stk-more{display:flex;justify-content:center;margin:10px 0 0;font-size:13px;font-weight:700;color:var(--fg)}
.mm-stk-more button{border:0;background:var(--soft);color:inherit;font:inherit;padding:8px 14px;border-radius:999px;cursor:pointer}
/* ---- 15 밀어서 확인 ---- */
[data-job=confirm]{position:relative}
[data-job=confirm]:has(>.mm-slide){padding-left:calc(var(--mm-kh,44px) + 14px)!important}
.mm-slide{position:absolute;left:4px;top:4px;bottom:4px;z-index:3;display:flex;align-items:stretch;pointer-events:none}
.mm-slide-tr{position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:999px;background:rgba(255,255,255,.14)}
.mm-knob{position:relative;aspect-ratio:1;height:100%;border-radius:999px;background:var(--page);color:var(--fg);display:grid;place-items:center;font-size:14px;font-weight:800;pointer-events:auto;touch-action:none;cursor:grab;box-shadow:0 2px 8px rgba(0,0,0,.25)}
html.ms .mm-knob:not(.mm-drag){transition:transform var(--d-bouncy) var(--spring-bouncy)}
html.ms .mm-knob.mm-hint{animation:mm-nudge 1.4s var(--spring-bouncy) .3s 2}
@keyframes mm-nudge{0%,100%{transform:none}30%{transform:translateX(14px)}}
/* ---- 16 ✦ 갈라지기 ---- */
.mm-goo{position:fixed;inset:0;z-index:58;pointer-events:none}
.mm-goo.mm-open{pointer-events:auto}
.mm-goo-scrim{position:absolute;inset:0;background:rgba(10,12,16,.18);opacity:0;transition:opacity .25s}
.mm-goo.mm-open .mm-goo-scrim{opacity:1}
.mm-goo-f{position:absolute;inset:0;filter:url(#mm-goo-f)}
.mm-goo-b{position:absolute;border-radius:999px;background:var(--fg);color:var(--page);display:grid;place-items:center;font-size:24px;font-weight:300;line-height:1}
.mm-goo-o{position:absolute;right:0;bottom:0;display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;border:0;border-radius:22px;background:var(--fg);color:var(--page);font:inherit;font-size:14px;font-weight:700;white-space:nowrap;cursor:pointer;transform:translate(0,0) scale(.3);opacity:0}
html.ms .mm-goo-o{transition:transform var(--d-bouncy) var(--spring-bouncy),opacity .2s}
.mm-goo.mm-open .mm-goo-o{opacity:1}
.mm-goo-o:focus-visible{outline:2px solid var(--page);outline-offset:-4px}
@media print{.mm-ptr,.mm-pblur,.mm-goo{display:none!important}}
`;

export const MICRO_MOTION_JS = `
(function () {
  var root = document.documentElement, mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = function () { return !!(mq && mq.matches); };
  var phone = function () { return window.matchMedia && matchMedia('(max-width:820px)').matches; };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var once = function (el, cls, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); clearTimeout(el['__mm' + cls]); el['__mm' + cls] = setTimeout(function () { el.classList.remove(cls); }, ms); };

  // ---- 3 흐림에서 또렷하게: the verdict line arrives word by word the first time it is seen ----
  var WORDS = '.cl-line,.cm-sum,.hm-s,.hm-cn small,.pl-detail .need-plus p,#sp-line';
  var words = function (el) {
    if (reduce() || el.__mmW || el.children.length || el.closest('[data-no-words]')) return;
    var t = el.textContent; if (!t || t.length > 260 || !/\\S/.test(t)) return; el.__mmW = 1;
    var parts = t.split(/(\\s+)/), k = 0, html = '';
    for (var i = 0; i < parts.length; i++) html += /^\\s+$/.test(parts[i]) || !parts[i] ? parts[i] : '<span style="--i:' + (k++) + '">' + esc(parts[i]) + '</span>';
    el.innerHTML = html; el.classList.add('mm-words');
    // Back to plain text once it has arrived, so other scripts (and copy) see the sentence as it was.
    setTimeout(function () { if (el.classList.contains('mm-words')) { el.classList.remove('mm-words'); el.textContent = t; } }, 700 + k * 32 + 100);
  };
  var wio = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { wio.unobserve(e.target); words(e.target); } }); }, { threshold: 0.4 }) : null;
  var watchWords = function () { if (!wio) return; document.querySelectorAll(WORDS).forEach(function (el) { if (el.__mmWo) return; el.__mmWo = 1; wio.observe(el); }); };

  // ---- 11 위원 얼굴: avatars get two eyes that blink, each on its own beat ----
  var faces = function (scope) {
    (scope || document).querySelectorAll('.db-av:not(.mm-face)').forEach(function (a, i) {
      var d = (((a.textContent || '').charCodeAt(0) || i) % 7 * 0.6).toFixed(1) + 's';
      a.classList.add('mm-face'); a.insertAdjacentHTML('beforeend', '<span class="mm-eyes" style="--mm-bd:' + d + '" aria-hidden="true"><i></i><i></i></span>');
    });
  };

  // ---- 6 넘기는 카드: the members as a deck under the vote bar ----
  var SIDE = { bull: ['강세', 'var(--up)'], bear: ['약세', 'var(--down)'], neutral: ['중립', 'var(--muted)'] };
  var deck = function () {
    var vf = document.querySelector('.vf .card,.vf'), data = document.querySelector('script.pl-data');
    if (!vf || !data || vf.querySelector('.mm-deck')) return;
    var list; try { list = JSON.parse(data.textContent || '[]'); } catch (e) { return; }
    list = (list || []).filter(function (m) { return m && m.n; }); if (list.length < 2) return;
    var box = document.createElement('div'); box.className = 'mm-deck';
    box.innerHTML = '<div class="mm-deck-h"><span>위원 한 명씩 넘겨 보기</span><span class="mm-deck-n"></span></div><div class="mm-deck-st" tabindex="0" role="group" aria-roledescription="카드 묶음" aria-label="위원 카드. 옆으로 밀거나 화살표 키로 넘겨요"></div>';
    var after = vf.querySelector('.vf-l'); if (after) after.after(box); else vf.appendChild(box);
    var st = box.querySelector('.mm-deck-st'), num = box.querySelector('.mm-deck-n'), at = 0;
    var card = function (m) {
      var s = SIDE[m.s] || SIDE.neutral, side = m.s === 'bull' ? 'bull' : m.s === 'bear' ? 'bear' : 'mid', line = (m.l || [])[0] || '';
      return '<span class="db-av db-av-' + side + '" aria-hidden="true">' + esc(String(m.n).replace(/^AI\\s*/, '').charAt(0)) + '</span><b>' + esc(m.n) + '<em style="color:' + s[1] + '">' + esc(m.w || s[0]) + '</em></b><small class="muted">' + esc(m.f || '') + '</small><p>' + esc(line) + '</p>';
    };
    var paint = function () {
      st.innerHTML = '';
      for (var j = 2; j >= 0; j--) {
        var m = list[(at + j) % list.length], c = document.createElement('div'); c.className = 'mm-dk' + (j === 0 ? ' mm-top' : '');
        c.innerHTML = card(m); c.style.zIndex = String(10 - j); c.style.transform = 'translateY(' + (j * 8) + 'px) scale(' + (1 - j * 0.045) + ')'; c.style.opacity = j === 2 ? '.55' : '1';
        if (j) c.setAttribute('aria-hidden', 'true'); st.appendChild(c);
      }
      faces(st); num.textContent = (at + 1) + ' / ' + list.length;
      bind(st.lastChild);
    };
    var go = function (dir, top) {
      top = top || st.lastChild;
      var fly = function () { at = (at + (dir > 0 ? 1 : list.length - 1)) % list.length; paint(); };
      if (reduce()) { fly(); return; }
      top.style.transition = 'transform 380ms cubic-bezier(.3,.7,.4,1),opacity 380ms';
      top.style.transform = 'translate(' + (dir * 420) + 'px,-16px) rotate(' + (dir * 22) + 'deg)'; top.style.opacity = '0';
      setTimeout(fly, 260);
    };
    var bind = function (top) {
      var d = null;
      top.addEventListener('pointerdown', function (e) { d = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, id: e.pointerId, lock: 0 }; });
      top.addEventListener('pointermove', function (e) {
        if (!d || e.pointerId !== d.id) return; var dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (!d.lock) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; d.lock = Math.abs(dx) > Math.abs(dy) ? 1 : -1; if (d.lock > 0) { top.setPointerCapture(e.pointerId); top.classList.add('mm-drag'); } }
        if (d.lock < 0) return; d.dx = dx; top.style.transform = 'translate(' + dx + 'px,' + (dy * 0.2) + 'px) rotate(' + (dx / 18) + 'deg)';
      });
      var up = function () {
        if (!d) return; var g = d; d = null; top.classList.remove('mm-drag'); if (g.lock <= 0) return;
        var v = Math.abs(g.dx) / Math.max(1, performance.now() - g.t);
        if (Math.abs(g.dx) > 80 || (Math.abs(g.dx) > 28 && v > 0.5)) go(g.dx > 0 ? 1 : -1, top); else top.style.transform = 'translateY(0) scale(1)';
      };
      top.addEventListener('pointerup', up); top.addEventListener('pointercancel', up);
    };
    st.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); } });
    paint();
  };

  // ---- 9 별 톡: the star pops when the reader fills it (not when the page syncs it on load) ----
  var starTap = 0;
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.star[data-star]')) starTap = Date.now(); }, true);
  var starPop = function (b) {
    if (reduce() || Date.now() - starTap > 1200) return;
    if (!b.querySelector('.mm-spk')) for (var i = 0; i < 6; i++) { var s = document.createElement('i'); s.className = 'mm-spk'; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--r', (i * 60) + 'deg'); b.appendChild(s); }
    once(b, 'mm-pop', 800);
  };

  // ---- 4 뼈대가 내용으로 ----
  var unskel = function (el) { if (reduce()) return; once(el, 'mm-unskel', 700); };
  var arrive = function (el) { if (reduce() || el.id === 'main' || !el.isConnected) return; once(el, 'mm-arrive', 900); };

  // ---- 12 돌려서 가격 정하기 ----
  var NICE = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100, 500, 1000, 5000, 10000, 50000];
  var wheel = function (dlg) {
    if (dlg.__mmWheel) return; var inp = dlg.querySelector('#pa-price'), target = dlg.querySelector('.pa-target'), nowEl = dlg.querySelector('.pa-now b'); if (!inp || !target || !nowEl) return;
    var now = Number((nowEl.textContent || '').replace(/[^0-9.]/g, '')); if (!(now > 0)) return; dlg.__mmWheel = 1;
    var want = now * 0.005, step = NICE[0]; for (var i = 0; i < NICE.length; i++) if (NICE[i] <= want) step = NICE[i];
    var dec = step < 1 ? (step < 0.1 ? 2 : 1) : 0, base = Math.round(now / step) * step, vals = [];
    for (var k = 30; k >= -30; k--) vals.push(+(base + k * step).toFixed(dec));
    var unit = (dlg.querySelector('.pa-unit') || {}).textContent || '';
    var box = document.createElement('div'); box.className = 'mm-wheel';
    box.innerHTML = '<div class="mm-wheel-hl" aria-hidden="true"></div><div class="mm-wheel-sc" tabindex="-1" aria-hidden="true"><div class="mm-pad"></div>' + vals.map(function (v) {
      var p = (v - now) / now * 100; return '<button type="button" tabindex="-1" data-v="' + v + '">' + v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + '<small style="color:var(' + (p > 0 ? '--up' : p < 0 ? '--down' : '--muted') + ')">' + (p > 0 ? '+' : '') + p.toFixed(1) + '%</small></button>';
    }).join('') + '<div class="mm-pad"></div></div>';
    target.after(box);
    var sc = box.querySelector('.mm-wheel-sc'), btns = sc.querySelectorAll('button'), H = 36, quiet = false, timer = 0, last = -1;
    var mark = function (i) { if (i === last) return; if (last >= 0 && btns[last]) btns[last].classList.remove('mm-sel'); if (btns[i]) btns[i].classList.add('mm-sel'); last = i; };
    var idx = function () { return Math.max(0, Math.min(btns.length - 1, Math.round(sc.scrollTop / H))); };
    sc.addEventListener('scroll', function () {
      var i = idx(); mark(i); if (quiet) return; clearTimeout(timer);
      timer = setTimeout(function () { var v = btns[idx()].getAttribute('data-v'); if (inp.value !== v) { inp.value = v; inp.dispatchEvent(new Event('input', { bubbles: true })); } if (navigator.vibrate && !reduce()) try { navigator.vibrate(4); } catch (e) {} }, 120);
    }, { passive: true });
    sc.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; sc.scrollTo({ top: Array.prototype.indexOf.call(btns, b) * H, behavior: reduce() ? 'auto' : 'smooth' }); });
    var follow = function () { var v = Number(String(inp.value).replace(/[^0-9.]/g, '')); if (!(v > 0)) return; var best = 0; for (var j = 0; j < vals.length; j++) if (Math.abs(vals[j] - v) < Math.abs(vals[best] - v)) best = j; if (best === idx()) return; quiet = true; sc.scrollTop = best * H; mark(best); setTimeout(function () { quiet = false; }, 60); };
    inp.addEventListener('input', function (e) { if (e.isTrusted !== false) follow(); });
    dlg.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-chip],[data-step]')) setTimeout(follow, 0); });
    requestAnimationFrame(function () { quiet = true; var v = Number(String(inp.value).replace(/[^0-9.]/g, '')); var j0 = v > 0 ? -1 : 30; if (j0 < 0) { follow(); } else { sc.scrollTop = j0 * H; mark(j0); } setTimeout(function () { quiet = false; }, 80); });
  };

  // ---- 13 업종 지도 꾹: world heat tiles lift on a tap (the 업종 heatmap does it on hover/focus in CSS) ----
  document.addEventListener('click', function (e) {
    var s = e.target.closest && e.target.closest('.wd-heat>span'), host = s ? s.parentNode : null;
    document.querySelectorAll('.wd-heat.mm-pick').forEach(function (h) { if (h !== host) { h.classList.remove('mm-pick'); h.querySelectorAll('.mm-on').forEach(function (x) { x.classList.remove('mm-on'); }); } });
    if (!s) return; var was = s.classList.contains('mm-on'); host.querySelectorAll('.mm-on').forEach(function (x) { x.classList.remove('mm-on'); });
    host.classList.toggle('mm-pick', !was); if (!was) s.classList.add('mm-on');
  });

  // ---- 14 겹친 이슈 펼치기: rows after the top three stack until tapped ----
  var stacks = function () {
    document.querySelectorAll('.ia-list').forEach(function (ol) {
      if (ol.__mmStk === 'open') return; var rows = Array.prototype.filter.call(ol.children, function (li) { return li.classList.contains('ia-row') && !li.hidden && li.offsetParent !== null; });
      var rest = rows.slice(3);
      Array.prototype.forEach.call(ol.children, function (li) { if (rest.indexOf(li) < 0) { li.classList.remove('mm-stk', 'mm-stk0'); li.style.marginTop = ''; li.style.transform = ''; li.style.opacity = ''; li.style.zIndex = ''; li.removeAttribute('aria-hidden'); li.inert = false; } });
      var more = ol.nextElementSibling && ol.nextElementSibling.classList.contains('mm-stk-more') ? ol.nextElementSibling : null;
      if (rest.length < 2) { ol.classList.remove('mm-closed'); if (more) more.remove(); return; }
      ol.__mmStk = 'closed'; ol.classList.add('mm-closed');
      rest.forEach(function (li, j) {
        li.classList.add('mm-stk'); li.classList.toggle('mm-stk0', j === 0); li.style.zIndex = String(20 - j);
        if (j) { li.style.marginTop = (-(li.offsetHeight) + 9) + 'px'; li.style.transform = 'scale(' + (1 - Math.min(j, 3) * 0.04) + ')'; li.style.opacity = j > 2 ? '0' : String(1 - j * 0.25); li.setAttribute('aria-hidden', 'true'); li.inert = true; }
      });
      if (!more) { more = document.createElement('div'); more.className = 'mm-stk-more'; ol.after(more); }
      more.innerHTML = '<button type="button" aria-expanded="false">' + (rows.length > 3 ? (4) + '위부터 ' + rest.length + '개 더 펼치기' : '더 펼치기') + '</button>';
      more.querySelector('button').onclick = function () { open(ol); };
    });
  };
  var open = function (ol) {
    ol.__mmStk = 'open'; ol.classList.remove('mm-closed');
    ol.querySelectorAll('.mm-stk').forEach(function (li, j) { li.style.transitionDelay = (reduce() ? 0 : j * 30) + 'ms'; li.style.marginTop = ''; li.style.transform = ''; li.style.opacity = ''; li.removeAttribute('aria-hidden'); li.inert = false; setTimeout(function () { li.style.transitionDelay = ''; li.classList.remove('mm-stk', 'mm-stk0'); li.style.zIndex = ''; }, 700 + j * 30); });
    var m = ol.nextElementSibling; if (m && m.classList.contains('mm-stk-more')) m.remove();
  };
  document.addEventListener('click', function (e) {
    var li = e.target.closest && e.target.closest('.ia-list.mm-closed .mm-stk0'); if (!li) return;
    e.preventDefault(); e.stopPropagation(); open(li.parentNode);
  }, true);
  // The 전체·한국·세계 filter hides rows: the stack is laid out again over what is left.
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-wd-tag]')) setTimeout(function () { document.querySelectorAll('.ia-list').forEach(function (ol) { if (ol.__mmStk === 'closed') ol.__mmStk = ''; }); stacks(); }, 30); });

  // ---- 15 밀어서 확인: a button waiting for its second press also takes a slide ----
  var slide = function (b) {
    if (b.querySelector('.mm-slide') || !b.offsetWidth) return;
    var s = document.createElement('span'); s.className = 'mm-slide'; s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<span class="mm-slide-tr"></span><span class="mm-knob">›</span>'; b.appendChild(s);
    var k = s.querySelector('.mm-knob'), tr = s.querySelector('.mm-slide-tr'), d = null, max = function () { return b.clientWidth - k.offsetWidth - 8; };
    tr.style.width = k.offsetWidth + 'px'; b.style.setProperty('--mm-kh', k.offsetWidth + 'px'); if (!reduce()) once(k, 'mm-hint', 3200);
    var put = function (x) { k.style.transform = 'translateX(' + x + 'px)'; tr.style.width = (k.offsetWidth + x) + 'px'; };
    k.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); d = { x: e.clientX, id: e.pointerId, moved: 0 }; k.setPointerCapture(e.pointerId); k.classList.add('mm-drag'); k.classList.remove('mm-hint'); });
    k.addEventListener('pointermove', function (e) { if (!d || e.pointerId !== d.id) return; var x = Math.max(0, Math.min(max(), e.clientX - d.x)); d.moved = Math.max(d.moved, x); put(x); });
    var up = function (e) {
      if (!d) return; var x = Math.max(0, Math.min(max(), e.clientX - d.x)), moved = d.moved; d = null; k.classList.remove('mm-drag');
      b.__mmSwallow = Date.now();
      if (x >= max() * 0.82) { put(max()); if (navigator.vibrate && !reduce()) try { navigator.vibrate(10); } catch (er) {} setTimeout(function () { b.__mmSwallow = 0; if (b.dataset.job === 'confirm') b.click(); }, reduce() ? 0 : 160); }
      else { put(0); tr.style.transition = 'width var(--d-bouncy) var(--spring-bouncy)'; setTimeout(function () { tr.style.transition = ''; }, 700); if (moved < 4) b.__mmSwallow = 0; }
    };
    k.addEventListener('pointerup', up); k.addEventListener('pointercancel', up);
  };
  // The click that ends a slide that fell short must not count as the second press.
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-job=confirm]'); if (b && b.__mmSwallow && Date.now() - b.__mmSwallow < 500) { e.preventDefault(); e.stopImmediatePropagation(); b.__mmSwallow = 0; } }, true);

  // ---- 2·4·6·9·11·12·14·15: one observer for what appears and changes ----
  var queued = false, scan = function () { queued = false; watchWords(); faces(); deck(); stacks(); document.querySelectorAll('dialog.pa-dialog[open]').forEach(wheel); };
  if (window.MutationObserver) new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i], el = m.target; if (m.type !== 'attributes' || el.nodeType !== 1) continue;
      if (m.attributeName === 'class') {
        var was = m.oldValue || '';
        if (/(^|\\s)skel(\\s|$)/.test(was) && !el.classList.contains('skel')) unskel(el);
        if (/(^|\\s)gnm-busy(\\s|$)/.test(was) && !el.classList.contains('gnm-busy')) arrive(el);
      } else if (m.attributeName === 'aria-pressed' && el.matches('.star[data-star]') && el.getAttribute('aria-pressed') === 'true' && m.oldValue !== 'true') starPop(el);
      else if (m.attributeName === 'data-job' && el.getAttribute('data-job') === 'confirm') slide(el);
      else if (m.attributeName === 'open' && el.matches('dialog.pa-dialog') && el.open) wheel(el);
      else if (m.attributeName === 'hidden' && !el.hidden && !queued) { queued = true; setTimeout(scan, 60); }
    }
  }).observe(document.body || root, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'aria-pressed', 'data-job', 'open', 'hidden'] });
  if (window.MutationObserver) new MutationObserver(function () { if (queued) return; queued = true; setTimeout(scan, 160); }).observe(document.body || root, { childList: true, subtree: true });
  scan();

  // ---- 7 끝이 흐려지는 유리: layers of blur under the bottom bar, stronger toward the edge ----
  var nav = document.querySelector('.bottom-nav');
  if (nav && CSS.supports && (CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)'))) {
    var pb = document.createElement('div'); pb.className = 'mm-pblur'; pb.setAttribute('aria-hidden', 'true'); pb.innerHTML = '<i></i><i></i><i></i>'; document.body.appendChild(pb);
    var fit = function () {
      var r = nav.getBoundingClientRect(); if (!r.height || getComputedStyle(nav).display === 'none') { pb.classList.remove('mm-on'); return; }
      var z = parseInt(getComputedStyle(nav).zIndex, 10); pb.style.zIndex = String((isFinite(z) ? z : 40) - 1);
      pb.style.height = Math.max(0, innerHeight - r.top + 40) + 'px'; pb.classList.add('mm-on');
    };
    fit(); addEventListener('resize', fit); setTimeout(fit, 600);
  }

  // ---- 5 당겨서 새로고침 (phones): pull at the very top, let go past the line to reload ----
  var ptr = null, pull = null, busy = false;
  var SUN = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" opacity=".35"/><g class="mm-gn"><path d="M12 12V4.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></g><circle cx="12" cy="12" r="1.6" fill="currentColor"/></svg>';
  var SKIP = 'input,textarea,select,dialog,[role=dialog],.chat,.sheet,.bottom-nav,.kv-plot,canvas,svg,[data-no-ptr],.wd-filter,.nav-seg,.mm-deck,.mm-wheel,[data-job]';
  var scrolled = function (el) { for (; el && el !== document.body; el = el.parentElement) { if (el.scrollTop > 0) return true; } return false; };
  var show = function (y, t) {
    if (!ptr) { ptr = document.createElement('div'); ptr.className = 'mm-ptr'; ptr.setAttribute('role', 'status'); ptr.setAttribute('aria-label', '아래로 당겨서 새로고침'); ptr.innerHTML = SUN; document.body.appendChild(ptr); }
    var k = Math.min(1, y / 72), main = document.querySelector('main');
    ptr.style.transition = t || 'none'; ptr.style.opacity = String(k); ptr.style.transform = 'translateY(' + (y * 0.5 - 48 + 8) + 'px) scale(' + (0.6 + 0.4 * k) + ')';
    ptr.querySelector('.mm-gn').style.transform = busy ? '' : 'rotate(' + Math.round(k * 300) + 'deg)';
    if (main && !reduce()) { main.style.transition = t ? 'transform var(--d-bouncy) var(--spring-bouncy)' : 'none'; main.style.transform = y ? 'translateY(' + (y * 0.4) + 'px)' : ''; }
  };
  var openLayer = function () { return root.classList.contains('chat-open') || root.classList.contains('chart-fs') || document.querySelector('dialog[open],.cm-page:not([hidden])'); };
  document.addEventListener('touchstart', function (e) {
    if (busy || e.touches.length !== 1 || !phone() || window.scrollY > 0 || openLayer()) return;
    var t = e.target; if (t.closest && t.closest(SKIP)) return; if (scrolled(t)) return;
    pull = { y: e.touches[0].clientY, x: e.touches[0].clientX, dy: 0, on: false };
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!pull) return; var dy = e.touches[0].clientY - pull.y, dx = Math.abs(e.touches[0].clientX - pull.x);
    if (!pull.on) { if (dy < 8 || dx > dy || window.scrollY > 0) { if (dy < -4 || dx > 12) pull = null; return; } pull.on = true; root.style.overscrollBehaviorY = 'contain'; }
    pull.dy = dy; show(Math.min(140, Math.pow(Math.max(0, dy), 0.82)));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  var release = function () {
    if (!pull) return; var p = pull; pull = null; if (!p.on) return; var y = Math.min(140, Math.pow(Math.max(0, p.dy), 0.82));
    if (y >= 64) { busy = true; show(64, 'transform var(--d-snappy) var(--spring-snappy),opacity .2s'); ptr.classList.add('mm-spin'); setTimeout(function () { location.reload(); }, reduce() ? 100 : 650); }
    else { show(0, 'transform var(--d-bouncy) var(--spring-bouncy),opacity .25s'); root.style.overscrollBehaviorY = ''; }
  };
  document.addEventListener('touchend', release); document.addEventListener('touchcancel', release);

  // ---- 16 ✦ 갈라지기: the bar's ✦ opens a gooey menu of this screen's first questions ----
  var goo = null, gooFrom = null;
  var gooClose = function () {
    if (!goo || !goo.classList.contains('mm-open')) return; goo.classList.remove('mm-open');
    goo.querySelectorAll('.mm-goo-o').forEach(function (o, i, all) { o.style.transitionDelay = ((all.length - 1 - i) * 30) + 'ms'; o.style.transform = 'translate(0,0) scale(.3)'; });
    if (gooFrom) { gooFrom.setAttribute('aria-expanded', 'false'); gooFrom.focus({ preventScroll: true }); }
  };
  var gooOpen = function (btn) {
    var chips = (window.gnmChat && gnmChat.chips()) || []; chips = chips.slice(0, 2);
    if (!goo) {
      goo = document.createElement('div'); goo.className = 'mm-goo'; document.body.appendChild(goo);
      goo.addEventListener('click', function (e) {
        var o = e.target.closest('.mm-goo-o'); if (!o) { gooClose(); return; }
        var q = o.getAttribute('data-q'); gooClose();
        if (q && window.gnmChat) gnmChat.ask(q); else if (gooFrom) { gooFrom.__mmPass = 1; gooFrom.click(); }
      });
      goo.addEventListener('keydown', function (e) { if (e.key === 'Escape') gooClose(); });
    }
    var r = btn.getBoundingClientRect(), right = innerWidth - r.right, bottom = innerHeight - r.bottom, items = chips.concat(['직접 물어보기']);
    goo.innerHTML = '<div class="mm-goo-scrim"></div><div class="mm-goo-f"><span class="mm-goo-b" style="right:' + right + 'px;bottom:' + bottom + 'px;width:' + r.width + 'px;height:' + r.height + 'px" aria-hidden="true">×</span>' +
      items.map(function (t, i) { return '<button type="button" class="mm-goo-o" style="right:' + right + 'px;bottom:' + (bottom + (r.height - 44) / 2) + 'px"' + (i < chips.length ? ' data-q="' + esc(t) + '"' : '') + '>' + esc(t) + '</button>'; }).join('') +
      '</div><svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="mm-goo-f"><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -8" result="g"/><feComposite in="SourceGraphic" in2="g" operator="atop"/></filter></svg>';
    gooFrom = btn; btn.setAttribute('aria-expanded', 'true');
    void goo.offsetWidth; goo.classList.add('mm-open');
    var opts = goo.querySelectorAll('.mm-goo-o');
    opts.forEach(function (o, i) { var up = (opts.length - i) * 54; o.style.transitionDelay = (i * 45) + 'ms'; o.style.transform = 'translate(0,' + (-up) + 'px) scale(1)'; });
    setTimeout(function () { if (opts[0]) opts[0].focus({ preventScroll: true }); }, 60);
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.bottom-nav [data-open-chat]'); if (!b) return;
    if (b.__mmPass) { b.__mmPass = 0; return; }
    if (!window.gnmChat || !(gnmChat.chips() || []).length) return; // nothing to offer: the ✦ opens the chat as before
    e.preventDefault(); e.stopImmediatePropagation();
    if (goo && goo.classList.contains('mm-open')) gooClose(); else gooOpen(b);
  }, true);
})();`;
