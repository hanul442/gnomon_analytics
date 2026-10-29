// G-303 (한서님 10/28 "로빈후드거 참고해서 딱 그거 따라하자", "다른것들도 다 바꿔야함"): one reference, copied.
// What Robinhood does, in our light neutral theme (up red / down blue stay, Korean convention):
// - Stock hero: name and price stacked at the same size, change lines under it, an edge-to-edge raw line chart with a
//   dotted start line and a dot at the end, period chips under it; dragging the chart shows that day's price.
// - Market: small cards in one row that scrolls sideways (name → mini chart → value → change).
// - Lists: rows with a mini chart and a coloured price pill; tapping a pill switches every pill to the change.
// - No white cards anywhere else: sections sit on the page and are split by one thin line; headings 22px/700.
// Loaded last (after COMPOSITION_CSS). Page <style> blocks come later, so rules start with `:root body #main`.
const M = ':root body #main';
const FLAT = ':is(.card,.mi-card,.cs-home,.iss-c,.sc-hero)';
const KEEP = ':not(.km-stat):not(.bn-slide):not(.hm-bn):not(.rh-keep):not(.debate):not(#db-room *):not(.chart-card)'; // the debate room and the chart card keep their own layout

export const ROBINHOOD_CSS = `
${M}{--rh-base:var(--line-strong)}
/* ── 종목 hero ── */
${M} section.hero{background:transparent;box-shadow:none;border:0;-webkit-backdrop-filter:none;backdrop-filter:none;padding:8px 0 0;overflow:visible}
${M} section.hero .orb{display:none}
${M} section.hero:has(.rh-chart){display:block}
${M} section.hero .hero-main{display:flex;flex-direction:column}
${M} .hero-main .h1-row{order:1;margin:0}
${M} .hero-main h1{font-size:30px;font-weight:500;letter-spacing:-.02em;line-height:1.2}
${M} .hero-main .hero-price{order:2;display:block;margin:0}
${M} .hero-main .hero-price>b{display:block;font-size:30px;font-weight:500;letter-spacing:-.02em;line-height:1.25}
${M} .hero-main:has(.rh-chart) .hero-price>span[data-live-f=full],${M} .hero-main:has(.rh-chart) .hero-sub{display:none}
${M} .rh-chg{order:3;margin:10px 0 0;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
${M} .rh-chg2{order:4;margin:2px 0 0;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
${M} .rh-chg span,${M} .rh-chg2 span{font-weight:500;margin-left:4px}
${M} .rh-chg span{color:var(--fg)}${M} .rh-chg2 span{color:var(--muted)}
${M} .rh-chart{order:5;position:relative;margin:24px -20px 0;height:200px;touch-action:pan-y;cursor:crosshair}
@media (min-width:821px){${M} .rh-chart{margin-left:0;margin-right:0}}
${M} .rh-chart svg{display:block;width:100%;height:100%;overflow:visible}
${M} .rh-base{stroke:var(--rh-base);stroke-width:1.3;stroke-dasharray:1.5 4;stroke-linecap:round}
${M} .rh-l{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
${M} .rh-x{stroke:var(--muted);stroke-width:1}
${M} .rh-halo{opacity:.18}
${M} .rh-per{order:6;display:flex;justify-content:space-between;margin:18px 0 0}
${M} .rh-per button{border:0;background:none;font:inherit;font-size:15px;font-weight:700;line-height:1;min-height:36px;padding:0 10px;border-radius:7px;cursor:pointer;color:var(--rh-c)}
${M} .rh-per button[aria-pressed=true]{background:var(--rh-c);color:#fff}
${M} .hero-main .eyebrow{order:7;margin:22px 0 0;gap:0;font-size:14px;color:var(--muted)}
${M} .hero-main .eyebrow>span{background:none;border:0;padding:0;margin:0;font-size:14px;font-weight:500;color:var(--muted)}
${M} .hero-main .eyebrow>span:not([hidden])~span:not([hidden])::before{content:"·";margin:0 6px}
${M} .hero-main .eyebrow .fresh{gap:0}${M} .hero-main .eyebrow .fresh i{display:none}
${M} .hero-main .theme-chips{order:8;margin:12px 0 0}
${M} .hero-main .hero-line{order:9}
${M} .hero-main>:not(.eyebrow):not(.h1-row):not(.hero-price):not(.rh-chg):not(.rh-chg2):not(.rh-chart):not(.rh-per):not(.theme-chips):not(.hero-line){order:10}
${M} section.hero .kp-line{padding-left:0;padding-right:0}

/* ── 시장 카드: 한 줄, 옆으로 넘김 ── */
${M} .km-stats{gap:10px}
${M} .km-stat{display:flex;flex-direction:column;padding:16px 14px 14px;border:1px solid var(--line);border-radius:12px;background:var(--surface-solid);box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
${M} .hm-p>.km-stats,${M} .wd-p>.km-stats{display:flex;grid-template-columns:none;overflow-x:auto;scroll-snap-type:x mandatory;margin-right:-20px;padding-right:20px;scrollbar-width:none}
${M} .hm-p>.km-stats::-webkit-scrollbar,${M} .wd-p>.km-stats::-webkit-scrollbar{display:none}
${M} .hm-p>.km-stats>.km-stat,${M} .wd-p>.km-stats>.km-stat{flex:0 0 150px;scroll-snap-align:start}
@media (min-width:821px){${M} .hm-p>.km-stats,${M} .wd-p>.km-stats{margin-right:0;padding-right:0}}
${M} .km-stat:has(.rh-sp) .km-st-h{display:contents}
${M} .km-stat:has(.rh-sp) .km-st-t{order:1;font-size:15px;font-weight:600;color:var(--fg)}
${M} .km-stat:has(.rh-sp) .km-sa{display:none}
${M} .km-stat .rh-sp{order:2;display:block;width:100%;height:58px;margin:14px 0 12px;overflow:visible}
${M} .km-stat:has(.rh-sp) .km-st-v{order:3;margin:0}
${M} .km-stat:has(.rh-sp) .km-st-v b{font-size:17px;font-weight:600}
${M} .km-stat:has(.rh-sp) .km-st-v small{display:none}
${M} .km-stat:has(.rh-sp) .km-badge{order:4;background:none;padding:0;margin:4px 0 0;font-size:15px;font-weight:500;border:0}
${M} .km-stat:has(.rh-sp)>:not(.km-st-h):not(.rh-sp):not(.km-st-v):not(.km-sa){order:5}
${M} .rh-sp path{fill:none;stroke-width:1.6;stroke-linejoin:round;vector-effect:non-scaling-stroke}
${M} .rh-sp line,${M} .wl-sp line{vector-effect:non-scaling-stroke}
${M} :is(.rh-sp,.wl-sp).up path{stroke:var(--up)}${M} :is(.rh-sp,.wl-sp).up circle{fill:var(--up)}
${M} :is(.rh-sp,.wl-sp).down path{stroke:var(--down)}${M} :is(.rh-sp,.wl-sp).down circle{fill:var(--down)}

/* ── 줄 목록: 이름 · 미니차트 · 가격 칩 ── */
${M} .wl{display:grid;grid-template-columns:minmax(0,1fr) 72px 104px;gap:12px;align-items:center;padding:16px 0;border-top:1px solid var(--line)}
${M} .wl:first-child{border-top:0}
${M} .wl>a{min-width:0;display:block;text-decoration:none;color:inherit}
${M} .wl>a>b{font-size:17px;font-weight:600}
${M} .wl .wl-lv{display:flex;flex-direction:column;margin-top:2px;font-size:13.5px;line-height:1.4;color:var(--muted)}
${M} .wl .wl-new{display:block;margin-top:2px;padding:0;background:none;border:0;font-size:13.5px;font-weight:600;color:var(--fg)}
${M} .wl>.star{display:none}
${M} .wl-sp{display:block;width:72px;height:34px;overflow:visible}
${M} .wl-sp path{fill:none;stroke-width:1.6;stroke-linejoin:round}
${M} .wl-pill{display:block;width:100%;min-height:40px;padding:0 6px;border:0;border-radius:8px;background:var(--fg2);color:#fff;font:600 15px/1 inherit;font-variant-numeric:tabular-nums;text-align:center;cursor:pointer;white-space:nowrap}
${M} .wl-pill:not(:has(span)){background:var(--soft);color:var(--muted)}${M} .wl-pill:has(.up){background:var(--up)}${M} .wl-pill:has(.down){background:var(--down)}
${M} .wl-pill>b{font-weight:600;color:inherit}
${M} .wl-pill>span{display:none;color:inherit!important}
${M} .rh-pct .wl-pill>b{display:none}${M} .rh-pct .wl-pill>span{display:inline}
${M} #watch .my-card,${M} #watch #watch-list{padding-left:0;padding-right:0;margin-left:0;margin-right:0}
${M} #feed-sum{font-size:14px;color:var(--muted)}

/* ── 카드 없애기: 섹션은 가는 선 하나로 ── */
${M} ${FLAT}${KEEP}{background:transparent;box-shadow:none;border:0;border-radius:0;-webkit-backdrop-filter:none;backdrop-filter:none;padding-left:0;padding-right:0}
${M} ${FLAT}${KEEP}:not(${FLAT} *){border-top:1px solid var(--line);padding-top:24px;padding-bottom:8px}
#main#main :is(h2,.st-h,.panel-title,.block-head,.hm-h,.sub-h)+${FLAT},#main#main :is(.block-head,.hm-h)+* ${FLAT}{border-top:0;padding-top:4px}
${M} ${FLAT} .head h2,${M} ${FLAT}>h2,${M} .panel-title,${M} .sub-h,${M} .si-card h2{font-size:22px;font-weight:700;letter-spacing:-.01em}
${M} .cs-home{padding-bottom:20px}
${M} .ig-words{display:grid;grid-template-columns:1fr 1fr;column-gap:24px;row-gap:0}
${M} .ig-words li a{background:none;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:14px 0;display:flex;justify-content:space-between}
${M} .ig-words li a b{font-weight:500;color:var(--muted)}
${M} .ig-words .ig-v{background:none;padding:0;font-weight:600;color:var(--fg)}
${M} .seg{background:none;padding:0;gap:4px;border:0;box-shadow:none}
${M} .seg>button{background:none;box-shadow:none;border:0;border-radius:7px;font-weight:700;font-size:14px;padding:8px 12px;color:var(--fg)}
${M} .seg>button[aria-selected=true],${M} .seg>button[aria-pressed=true]{background:var(--fg);color:var(--surface-solid)}
${M} .seg .seg-thumb{display:none}
${M} .story{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:8px;padding:16px 0;border-top:1px solid var(--line)}
${M} .story>div:first-child{order:1}
${M} .story .tag{background:none;padding:0;font-size:13.5px;font-weight:600;color:var(--fg)}
${M} .story .why{order:2;margin:0}
${M} .story .why .meta{font-size:13.5px;color:var(--muted)}
${M} .story .story-title{order:3;flex-basis:100%;margin-top:6px;font-size:16.5px;font-weight:600;line-height:1.45}
${M} .story>:not(div:first-child):not(.why):not(.story-title){order:4;flex-basis:100%}
${M} .me-acct-w,${M} .me-acct{background:transparent;box-shadow:none;border:0;-webkit-backdrop-filter:none;backdrop-filter:none;padding-left:0;padding-right:0}
#main#main#main .st-group{padding-left:0;padding-right:0}
#main#main#main .st-group .st-fold>summary,#main#main#main .st-group .st-rows>a,#main#main .st-rows>a{padding:16px 0;margin:0}
${M} .st-rows>a,${M} .st-group summary{border-top:1px solid var(--line)}
${M} .st-rows>a:first-child{border-top:0}
/* ── 관심 종목 페이지: 같은 줄 + 가격 칩 ── */
${M} .wp-list{gap:0}
${M} .wp-row{grid-template-columns:minmax(0,1fr) 64px 100px 32px;gap:10px;background:transparent;border:0;border-top:1px solid var(--line);border-radius:0;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;padding:16px 0}
${M} .wp-row:first-child{border-top:0}
${M} .wp-row .wl-sp{width:64px;height:32px}
${M} .wp-tags{display:flex;flex-wrap:wrap;gap:2px 8px;margin-top:4px}${M} .wp-tags span{white-space:nowrap;background:none!important;padding:0;margin-right:8px;font-size:13.5px;font-weight:500;color:var(--muted)}
${M} .wp-tags span.new{color:var(--fg);font-weight:600}
${M} .wp-px{display:block;min-height:40px;line-height:40px;padding:0 6px;border-radius:8px;background:var(--fg2);color:#fff;text-align:center;white-space:nowrap;cursor:pointer}
${M} .wp-px:has(.up){background:var(--up)}${M} .wp-px:has(.down){background:var(--down)}
${M} .wp-px:has(.muted){background:none;color:var(--muted);cursor:default}
${M} .wp-px b{font-size:15px;font-weight:600;color:inherit}${M} .wp-px>span:not(.muted){display:none;font-size:15px;font-weight:600;color:inherit!important}
${M} .rh-pct .wp-px>b{display:none}${M} .rh-pct .wp-px>span:not(.muted){display:inline}
/* ── 남은 카드들: 테마·공시 목록, 위원회 양쪽 상자 ── */
${M} :is(.tm-item,.sg-item){background:transparent;border:0;border-top:1px solid var(--line);border-radius:0;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none;padding-left:0;padding-right:0;margin:0}
${M} :is(.tm-list,#sg-list){gap:0}
${M} .cs-side{background:transparent;border-radius:0;padding-left:0;padding-right:0}
`;

export const ROBINHOOD_JS = `(function () {
  var NS = 'http://www.w3.org/2000/svg';
  var fmt = function (v) { return Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 2 }); };
  var chg = function (a, b) { var d = b - a, p = a ? d / a * 100 : 0; return { up: d > 0, dn: d < 0, t: (d > 0 ? '▲ ' : d < 0 ? '▼ ' : '') + fmt(Math.abs(d)) + ' (' + Math.abs(p).toFixed(2) + '%)' }; };
  var tone = function (c) { return c.dn ? 'var(--down)' : c.up ? 'var(--up)' : 'var(--fg)'; };
  /* Raw line (no smoothing), dotted start line, dot at the end. */
  var spark = function (v, w, h, cls) {
    var lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), r = hi - lo || 1;
    var X = function (i) { return (i / (v.length - 1) * (w - 4)).toFixed(1); }, Y = function (x) { return (3 + (hi - x) / r * (h - 6)).toFixed(1); };
    return '<svg class="' + cls + ' ' + (v[v.length - 1] >= v[0] ? 'up' : 'down') + '" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><line class="rh-base" x1="0" x2="' + w + '" y1="' + Y(v[0]) + '" y2="' + Y(v[0]) + '"/><path d="' + v.map(function (x, i) { return (i ? 'L' : 'M') + X(i) + ',' + Y(x); }).join('') + '"/><circle cx="' + X(v.length - 1) + '" cy="' + Y(v[v.length - 1]) + '" r="2.6"/></svg>';
  };
  var dressCards = function (root) {
    (root || document).querySelectorAll('.km-stat [data-km-spark]').forEach(function (sa) {
      if (sa.nextElementSibling && sa.nextElementSibling.classList.contains('rh-sp')) return;
      var pts; try { pts = JSON.parse(sa.getAttribute('data-km-spark')).map(function (p) { return p[1]; }); } catch (e) { return; }
      if (pts.length > 1) sa.insertAdjacentHTML('afterend', spark(pts, 120, 58, 'rh-sp'));
    });
  };
  /* Tapping a price pill switches every pill on the list between price and change, like Robinhood. */
  document.addEventListener('click', function (e) {
    var p = e.target.closest && e.target.closest('.wl-pill,.wp-px'); if (!p || p.querySelector('.muted')) return;
    e.preventDefault(); var box = p.closest('#watch-list,#wp-list,.list,main'); if (box) box.classList.toggle('rh-pct');
  });
  var hero = function () {
    var barsEl = document.getElementById('bars'), hm = document.querySelector('section.hero .hero-main');
    if (!barsEl || !hm || hm.querySelector('.rh-chart')) return;
    var bars; try { bars = JSON.parse(barsEl.textContent || '[]'); } catch (e) { return; }
    if (!bars || bars.length < 6) return;
    var priceB = hm.querySelector('.hero-price>b'), today = hm.querySelector('.hero-price [data-live-f=full]');
    if (!priceB) return;
    var dateK = function (s) { var p = String(s).split('-'); return +p[1] + '월 ' + +p[2] + '일'; };
    var c1 = document.createElement('p'); c1.className = 'rh-chg'; c1.setAttribute('aria-live', 'polite');
    var c2 = document.createElement('p'); c2.className = 'rh-chg2';
    var drawToday = function () {
      if (!today) { c2.hidden = true; return; }
      var t = today.textContent.replace('+', ''), up = today.classList.contains('up'), dn = today.classList.contains('down');
      c2.innerHTML = '<b style="color:' + (dn ? 'var(--down)' : up ? 'var(--up)' : 'inherit') + ';font-weight:600"></b><span></span>';
      c2.firstChild.textContent = t; c2.lastChild.textContent = '오늘 · ' + dateK(bars[bars.length - 1].date) + ' 종가';
    };
    drawToday();
    if (today && window.MutationObserver) new MutationObserver(drawToday).observe(today, { childList: true, characterData: true, subtree: true, attributes: true });
    var box = document.createElement('div'); box.className = 'rh-chart';
    var per = document.createElement('div'); per.className = 'rh-per'; per.setAttribute('role', 'group'); per.setAttribute('aria-label', '차트 기간');
    var P = [['1주', 5], ['1달', 21], ['3달', 63], ['6달', 126], ['1년', 250], ['전체', 99999]].filter(function (p, i, a) { return p[1] <= bars.length || i === a.length - 1; });
    var def = P.length > 2 ? 2 : P.length - 1;
    per.innerHTML = P.map(function (p, i) { return '<button type="button" data-n="' + p[1] + '" aria-pressed="' + (i === def) + '">' + p[0] + '</button>'; }).join('');
    hm.append(c1, c2, box, per);
    var H = 200, cur = null, base = priceB.textContent;
    var setChg = function (c, lab) { c1.innerHTML = '<b style="color:' + tone(c) + ';font-weight:600"></b><span></span>'; c1.firstChild.textContent = c.t; c1.lastChild.textContent = lab; };
    var draw = function (n, label) {
      var bs = bars.slice(-Math.min(n + 1, bars.length)), v = bs.map(function (b) { return b.close; });
      var c = chg(v[0], v[v.length - 1]), col = tone(c);
      hm.style.setProperty('--rh-c', col);
      var W = box.clientWidth || 390, lo = Math.min.apply(null, v), hi = Math.max.apply(null, v), r = hi - lo || 1;
      var X = function (i) { return i / (v.length - 1) * (W - 16); }, Y = function (x) { return 14 + (hi - x) / r * (H - 28); };
      var d = v.map(function (x, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(x).toFixed(1); }).join('');
      var ex = X(v.length - 1), ey = Y(v[v.length - 1]), by = Y(v[0]).toFixed(1);
      box.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="최근 ' + label + ' 종가 ' + c.t + '"><line class="rh-base" x1="0" x2="' + W + '" y1="' + by + '" y2="' + by + '"/><path class="rh-l" d="' + d + '" style="stroke:' + col + '"/><line class="rh-x" x1="0" x2="0" y1="0" y2="' + H + '" style="display:none"/><circle class="rh-halo" cx="' + ex + '" cy="' + ey + '" r="9" style="fill:' + col + '"/><circle class="rh-dot" cx="' + ex + '" cy="' + ey + '" r="4" style="fill:' + col + '"/></svg>';
      setChg(c, '최근 ' + label);
      cur = { bs: bs, v: v, X: X, Y: Y, n: n, label: label };
    };
    var scrub = function (e) {
      if (!cur) return;
      var rc = box.getBoundingClientRect(), x = Math.max(0, Math.min(rc.width, e.clientX - rc.left));
      var i = Math.max(0, Math.min(cur.v.length - 1, Math.round(x / Math.max(1, rc.width - 16) * (cur.v.length - 1))));
      var svg = box.querySelector('svg'); if (!svg) return;
      var px = cur.X(i), py = cur.Y(cur.v[i]), ln = svg.querySelector('.rh-x');
      ln.style.display = ''; ln.setAttribute('x1', px); ln.setAttribute('x2', px);
      ['.rh-dot', '.rh-halo'].forEach(function (s) { var c = svg.querySelector(s); c.setAttribute('cx', px); c.setAttribute('cy', py); });
      priceB.textContent = fmt(cur.v[i]) + '원';
      setChg(chg(cur.v[0], cur.v[i]), dateK(cur.bs[i].date));
    };
    var end = function () { if (!cur) return; priceB.textContent = base; draw(cur.n, cur.label); };
    box.addEventListener('pointermove', scrub); box.addEventListener('pointerdown', scrub);
    box.addEventListener('pointerleave', end); box.addEventListener('pointercancel', end);
    box.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') end(); });
    per.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      per.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      draw(+b.getAttribute('data-n'), b.textContent);
    });
    /* The live price can change the big number; keep it as the resting value. */
    if (window.MutationObserver) new MutationObserver(function () { if (!box.querySelector('.rh-x[style=""]')) base = priceB.textContent; }).observe(priceB, { childList: true, characterData: true, subtree: true });
    draw(P[def][1], P[def][0]);
    var rw = 0; addEventListener('resize', function () { if (cur && box.clientWidth !== rw) { rw = box.clientWidth; draw(cur.n, cur.label); } });
  };
  var run = function () { dressCards(); hero(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  /* Cards added later (시장 전체, stock pages filled by script) get the same mini chart. */
  if (window.MutationObserver) { var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 60); }).observe(document.documentElement, { childList: true, subtree: true }); }
})();`;
