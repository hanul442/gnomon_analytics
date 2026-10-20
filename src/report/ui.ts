import { ALPHA, WATCH_LIMIT } from './plans.js';
import { WRAPUP } from './wrapup.js';
// Shared UI layer (docs/DESIGN.md §4.5, G-41): design tokens, a sticky price bar for stock pages,
// a glossary ("?" next to financial terms), loading skeletons and the active page in the header.
// Everything here is presentation; it never changes what a page says.

/** Plain-language explanations for the terms the pages use. Shown in a popover from a "?" next to the term. */
export const GLOSSARY: Record<string, string> = {
  'RSI': '최근 오른 폭과 내린 폭의 비율로, 많이 오른 상태(70 위)인지 많이 내린 상태(30 아래)인지 보는 지표예요.',
  'MACD': '짧은 평균과 긴 평균의 차이예요. 시그널선 위로 올라가면 오르는 힘이 커진다고 봐요.',
  '스토캐스틱': '최근 범위에서 지금 가격이 어디쯤인지(0~100) 보는 지표예요. 20 아래는 바닥권, 80 위는 꼭대기권이에요.',
  'CCI': '평균 가격에서 얼마나 벗어났는지 보는 지표예요. ±100 바깥이면 많이 벗어난 상태예요.',
  '스토캐스틱 RSI': 'RSI에 스토캐스틱을 한 번 더 적용해 더 민감하게 만든 지표예요.',
  '윌리엄스': '최근 고가에서 얼마나 내려와 있는지(-100~0) 보는 지표예요.',
  '이동평균': '최근 N일 종가의 평균이에요. 가격이 평균 위에 있으면 상승 흐름으로 봐요.',
  '볼린저': '20일 평균 위아래로 변동 폭(표준편차 2배)을 그린 띠예요. 띠 밖은 평소보다 크게 움직인 거예요.',
  'ATR': '하루 평균 움직임의 크기예요. 손절 폭이나 변동성을 가늠할 때 써요.',
  '피보나치': '직전 큰 오름·내림 폭의 23.6%·38.2%·50%·61.8% 되돌림 가격이에요. 많은 사람이 지지·저항으로 봐요.',
  '지지': '가격이 내려오다 여러 번 멈췄던 가격대예요.',
  '저항': '가격이 오르다 여러 번 막혔던 가격대예요.',
  '기술적 적정가': '최근 거래가 몰린 가격의 중심이에요. 기업 가치 평가가 아니라 가격 기록으로 계산한 기준선이에요.',
  '적정가': '최근 거래가 몰린 가격의 중심이에요. 기업 가치 평가가 아니라 가격 기록으로 계산한 기준선이에요.',
  '예측 범위': '최근 변동성으로 계산한, 실제 가격이 80% 확률로 들어올 것으로 보는 범위예요. 목표가가 아니고, 나중에 채점해요.',
  '예측 가격': '최근 변동성으로 계산한, 실제 가격이 80% 확률로 들어올 것으로 보는 범위예요. 목표가가 아니고, 나중에 채점해요.',
  '검증 구간': '백테스트의 마지막 30%예요. 전략을 고를 때 보지 않은 기간이라, 과거에 맞춘 결과인지 가려 줘요.',
  '몬테카를로': '거래 결과의 순서를 수천 번 섞어 보며, 운이 나빴다면 어땠을지 범위를 보는 방법이에요.',
  '백테스트': '과거 가격에 규칙을 그대로 적용해 봤다면 어땠을지 계산한 거예요. 미래를 보장하지 않아요.',
  '수급 흔적': '거래량, 종가 위치, 외국인·기관 순매수로 본 매집·분산의 흔적이에요. 누가 조작했다는 증거가 아니에요.',
  '매집': '큰 손이 조용히 사 모으는 것처럼 보이는 흔적이에요.',
  '분산': '큰 손이 나눠 파는 것처럼 보이는 흔적이에요.',
  '레드팀': '우세한 의견에 일부러 맞서서 가장 강한 반론을 내는 역할이에요.',
  '시나리오': '강세·기본·약세로 나눠 각각 어떻게 전개될지, 무엇이 나오면 틀린 건지 적은 거예요.',
  '무효화': '이 가격이나 사건이 나오면 그 판단이 틀렸다고 보는 조건이에요.',
  '표 분포': '지표·전략·AI 위원이 각각 강세·중립·약세 중 어디에 표를 던졌는지예요. 다수결로 결론을 내지 않아요.',
  '기간별 신호': '15분봉·60분봉·일봉·주봉·월봉 각각에서 지표 16개를 계산한 종합 신호예요.',
  '컨센서스': '증권사 애널리스트 목표가의 평균이에요.',
  'PER': '주가를 1주당 순이익으로 나눈 값이에요. 이익에 비해 비싼지 보는 기준이에요.',
  'PBR': '주가를 1주당 순자산으로 나눈 값이에요. 장부 가치에 비해 비싼지 보는 기준이에요.',
  '외국인 보유율': '전체 주식 중 외국인이 가진 비율이에요.',
  '순매수': '산 수량에서 판 수량을 뺀 거예요. 플러스면 더 많이 산 거예요.',
  '크레딧': '리포트 요청·AI 질문처럼 AI 비용이 드는 일에 쓰는 단위예요.',
  '전략 챔피언': '전략 8개 가운데 검증 구간 성과가 가장 좋은 전략이에요.',
};

/**
 * G-218: words the committee uses in its debate, explained when tapped inside the text (dotted underline).
 * Kept apart from GLOSSARY so headings like "강세 근거" do not each grow a "?".
 */
export const COMMITTEE_TERMS: Record<string, string> = {
  '강세': '오를 쪽으로 보는 판단이에요.',
  '약세': '내릴 쪽으로 보는 판단이에요.',
  '모멘텀': '가격이 움직이는 힘이에요. 오르던 종목이 계속 오르는 힘을 말할 때 많이 써요.',
  '추세': '가격이 한동안 같은 방향으로 움직이는 흐름이에요.',
  '돌파': '막혀 있던 가격대를 뚫고 지나가는 거예요.',
  '되돌림': '크게 움직인 뒤 반대 방향으로 일부 되돌아오는 움직임이에요.',
  '과매수': '짧은 기간에 너무 많이 올라 쉬어 갈 수 있다고 보는 상태예요.',
  '과매도': '짧은 기간에 너무 많이 내려 반등할 수 있다고 보는 상태예요.',
  '과열': '짧은 기간에 너무 빨리 오른 상태예요.',
  '수급': '외국인·기관·개인이 각각 얼마나 사고파는지예요.',
  '밸류에이션': '회사가 버는 돈이나 가진 자산에 비해 주가가 비싼지 싼지 따지는 거예요.',
  '상대강도': '시장 전체보다 더 올랐는지, 덜 내렸는지 비교한 거예요.',
  '정배열': '짧은 기간 평균선이 긴 기간 평균선보다 위에 차례로 놓인 상태예요. 오르는 흐름에서 자주 나와요.',
  '역배열': '짧은 기간 평균선이 긴 기간 평균선보다 아래에 놓인 상태예요. 내리는 흐름에서 자주 나와요.',
  '골든크로스': '짧은 평균선이 긴 평균선을 아래에서 위로 뚫는 거예요. 오르는 신호로 봐요.',
  '데드크로스': '짧은 평균선이 긴 평균선을 위에서 아래로 뚫는 거예요. 내리는 신호로 봐요.',
  '거래량': '그날 사고판 주식 수예요. 많을수록 관심이 크다는 뜻이에요.',
  '변동성': '가격이 얼마나 크게 오르내리는지예요.',
  '영업이익': '회사가 본업으로 번 돈이에요.',
  '반등': '내리던 가격이 다시 오르는 거예요.',
  '확신도': '그 위원이 자기 판단을 얼마나 믿는지(0~100)예요.',
  '촉매': '주가를 움직일 계기가 될 일(실적 발표, 공시 등)이에요.',
  '박스권': '일정한 가격 범위 안에서 오르내리는 상태예요.',
  '눌림목': '오르던 중 잠깐 내려와 쉬는 자리예요.',
  '이격': '가격이 평균선에서 얼마나 떨어져 있는지예요.',
};

const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/></svg>';
/** A watchlist star; the shared script (UI_SCRIPT) toggles it. `symbol` may be empty and set later by a page script. */
export const starButton = (symbol: string, label: string, id = '') => `<button type="button" class="star"${id ? ` id="${id}"` : ''} data-star="${symbol.replace(/"/g, '')}" aria-pressed="false" aria-label="${label.replace(/[<>"&]/g, '')} 관심 종목">${STAR_SVG}</button>`;

export const UI_CSS = `.deep-lock{display:flex;gap:14px;align-items:flex-start;border:1px dashed var(--accent);background:linear-gradient(180deg,var(--soft),var(--surface))}.dl-ic{font-size:26px;line-height:1}.deep-lock b{font-size:16px}.deep-lock p{margin:4px 0 10px}.dl-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.dl-row .btn-primary{margin:0}
#tab-ai .ai-nav{position:sticky;top:var(--sticky-top,104px);z-index:5;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:8px 2px;margin:0 0 6px;background:var(--page)}#tab-ai .ai-nav::-webkit-scrollbar{display:none}#tab-ai .ai-nav a{flex:none;font-size:13px;font-weight:700;text-decoration:none;color:var(--fg2);background:var(--surface);border:1px solid var(--line-strong);border-radius:999px;padding:6px 12px}#tab-ai .ai-nav a:hover{border-color:var(--accent);color:var(--accent-strong)}
#tab-ai .card,#tab-ai section.block{scroll-margin-top:150px}#tab-ai section.block{margin-top:22px}#tab-ai .card+.card{margin-top:16px}
#tab-ai .card>.head>h2,#tab-ai .block-head>h2{border-left:4px solid var(--accent);padding-left:10px;font-size:18px}
#tab-ai .claims li,#tab-ai .why-col p,#tab-ai .headline{font-size:15px;line-height:1.75}#tab-ai .claims li{margin-bottom:8px}#tab-ai .why-col{padding:14px 16px}#tab-ai .why-col h3{font-size:15px;margin:0 0 8px}
@media (max-width:820px){#tab-ai .why-grid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;overflow:visible!important;margin-left:0!important;margin-right:0!important;padding:0!important}#tab-ai .why-grid>*{flex:none!important;min-width:0!important;width:auto!important}#tab-ai .ai-nav{top:var(--sticky-top,96px)}}
.sc-prob{display:flex;height:26px;border-radius:9px;overflow:hidden;margin:6px 0 4px;font-size:12px;font-weight:700;color:#fff}.sc-prob span{display:grid;place-items:center;min-width:34px}.sp-bull{background:var(--up)}.sp-base{background:#7b8798}.sp-bear{background:var(--down)}.sc-pct{font-size:13px;font-weight:800;margin-left:4px;opacity:.85}.sub-sh{display:block;font-size:11px;color:var(--muted);font-weight:400}.h1-row{display:flex;align-items:center;gap:6px}.h1-row h1{margin:0}
.star{width:36px;height:36px;border:0;background:none;cursor:pointer;color:#b8c0cc;display:grid;place-items:center;padding:0}.star svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}.star[aria-pressed=true]{color:#e8a20c}.star[aria-pressed=true] svg{fill:currentColor}

:root{--fs-xs:12px;--fs-sm:13px;--fs-base:15px;--fs-md:17px;--fs-lg:20px;--fs-xl:26px;--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:32px;--r-sm:8px;--r-md:12px;--r-lg:16px}
.top-links a[aria-current=page]{background:rgba(255,255,255,.16);color:#fff}
.price-bar{display:none;flex:1;min-width:0;align-items:center;gap:10px;color:#fff;font-size:var(--fs-sm);overflow:hidden;white-space:nowrap}
.topbar.scrolled .price-bar{display:flex;animation:pb-in .2s var(--ease-out)}@keyframes pb-in{from{opacity:0;transform:translateY(-4px)}}
.price-bar b{font-size:var(--fs-base)}.price-bar .pb-price{font-weight:800;font-variant-numeric:tabular-nums}.price-bar .pb-code{color:#b3a8ff;font-size:var(--fs-xs)}
.price-bar .up{color:#ff9a9e}.price-bar .down{color:#9fc0f5}.price-bar .fresh{background:rgba(255,255,255,.12);color:#fff}
@media (max-width:820px){.topbar.scrolled .brand div{display:none}}
.tip{display:inline-grid;place-items:center;width:17px;height:17px;margin-left:5px;border-radius:50%;border:1px solid var(--line-strong);background:var(--surface-solid);color:var(--muted);font:700 11px/1 inherit;cursor:help;vertical-align:1px;padding:0;position:relative}.tip::after{content:"";position:absolute;inset:-12px}
.tip:hover,.tip[aria-expanded=true]{border-color:var(--accent);color:var(--accent)}
.tip-pop{position:absolute;z-index:200;max-width:300px;background:#0f1b2d;color:#fff;border-radius:var(--r-md);padding:10px 12px;font-size:var(--fs-sm);line-height:1.55;box-shadow:0 12px 30px rgba(0,0,0,.25)}
.tip-pop b{display:block;margin-bottom:2px;color:#c9bfff}
.skel{position:relative;overflow:hidden;background:var(--soft);border-radius:var(--r-sm);color:transparent!important}.skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);animation:shimmer 1.2s infinite}
@keyframes shimmer{to{transform:translateX(100%)}}
.badge,.tier,.sig,.fresh,.m-kind,.vchip,.dk{line-height:1.5}
.num,td.num{font-variant-numeric:tabular-nums}
@media (max-width:820px){.price-bar .pb-code,.price-bar .fresh{display:none}.block{margin-top:20px}.block-head h2,.card h2,.panel-title{font-size:var(--fs-md)}.hero h1{font-size:28px}}
`;

/** Compact bar with name, price, change and freshness; slides in once the hero scrolls away. */
export function priceBar(opts: { name: string; symbol: string; price: string; change: string; tone: string; badge: string }): string {
  const live = /^[0-9A-Z-]{1,24}$/.test(opts.symbol) ? ` data-live="${opts.symbol}"` : '';
  return `<div class="price-bar" id="price-bar" aria-hidden="true"><b>${opts.name}</b><span class="pb-code">${opts.symbol}</span><span class="pb-price" ${live} data-live-f="price">${opts.price}</span><span class="${opts.tone}" ${live} data-live-f="arrowpct">${opts.change}</span>${opts.badge}</div>`;
}

export const UI_SCRIPT = `<script>
(function () {
  // Watchlist stars (stocks, ETFs and coins) on every page: localStorage gnm-watch, newest first. The alpha
  // layer and the home list listen for the gnm-watch event.
  var WK = 'gnm-watch';
  var readW = function () { try { return JSON.parse(localStorage.getItem(WK) || '[]'); } catch (e) { return []; } };
  var syncStars = function () { var w = readW(); document.querySelectorAll('[data-star]').forEach(function (b) { b.setAttribute('aria-pressed', String(w.indexOf(b.getAttribute('data-star')) >= 0)); }); };
  window.GNM_starSync = syncStars;
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-star]'); if (!b) return;
    e.preventDefault();
    var sym = b.getAttribute('data-star'), w = readW(), i = w.indexOf(sym);
    var plan = document.documentElement.getAttribute('data-plan') || 'free', LIMIT = ${JSON.stringify({ ...WATCH_LIMIT, alpha: WATCH_LIMIT[ALPHA.rankAs] })};
    if (i >= 0) w.splice(i, 1);
    else if (w.length >= (LIMIT[plan] || 5)) { if (window.GNM && GNM.toast) GNM.toast('관심 종목은 ' + (LIMIT[plan] || 5) + '개까지예요. 요금제를 올리면 더 담을 수 있어요.'); return; }
    else w.unshift(sym);
    try { localStorage.setItem(WK, JSON.stringify(w)); localStorage.setItem('gnm-watch-at', String(Date.now())); } catch (x) {if(window.GNM)GNM.toast('관심 목록을 저장하지 못했어요.','error');return;}
    if(window.GNM)GNM.toast(i>=0?'관심 목록에서 뺐어요.':'관심 목록에 담았어요.','success');
    syncStars();
    window.dispatchEvent(new Event('gnm-watch'));
  });
  syncStars();
  // Price in the header: moved next to the brand, shown while the hero is out of view.
  var bar = document.getElementById('price-bar'), hero = document.querySelector('.hero'), top = document.querySelector('.topbar'), brand = document.querySelector('.brand');
  if (bar && hero && top && brand && 'IntersectionObserver' in window) {
    brand.insertAdjacentElement('afterend', bar);
    new IntersectionObserver(function (es) { var off = !es[0].isIntersecting; top.classList.toggle('scrolled', off); bar.setAttribute('aria-hidden', String(!off)); }, { rootMargin: '-80px 0px 0px 0px' }).observe(hero);
  }
  // Glossary: a "?" after the first few headings or labels that name a term.
  var G = ${JSON.stringify({ ...COMMITTEE_TERMS, ...GLOSSARY })}, keys = Object.keys(${JSON.stringify(GLOSSARY)}).sort(function (a, b) { return b.length - a.length; }), used = {};
  // G-218: how plain the committee reads. html[data-explain] = easy | normal | expert, from the level the reader
  // picked (html[data-level] once the level screen sets it, the 보기 방식 초보, or 설명 깊이 in the profile); the
  // debate room's "쉬운 말" button overrides it on this device (gnm-easy, "on:base") until that level changes.
  // Plain lines, member roles and the words' underlines follow it.
  var baseLevel = function () {
    // G-220: html[data-level] is easy | mid | adv | pro (level.ts); a level only counts once picked or derived from the survey.
    var h = document.documentElement, l = h.getAttribute('data-level') || '', x = '', a = {};
    try { a = JSON.parse(localStorage.getItem('gnm-prefs') || 'null') || {}; x = a.explain || ''; } catch (e) {}
    if (!a.level && !a.experience) l = '';
    return l === 'easy' || /아주 쉬운/.test(x) || (!l && h.getAttribute('data-persona') === 'beginner') ? 'easy' : l === 'pro' || /전문 용어/.test(x) ? 'expert' : 'normal';
  };
  var explain = function () {
    var h = document.documentElement, v = baseLevel(), o = '';
    try { o = localStorage.getItem('gnm-easy') || ''; } catch (e) {}
    var p = o.split(':'); if (p[1] === v) v = p[0] === '1' ? 'easy' : v === 'easy' ? 'normal' : v;
    h.setAttribute('data-explain', v);
    document.querySelectorAll('[data-easy-toggle]').forEach(function (b) { b.setAttribute('aria-pressed', String(v === 'easy')); });
    if (v === 'easy') document.querySelectorAll('.ez-how:not([data-seen])').forEach(function (d) { d.open = true; d.setAttribute('data-seen', ''); });
    return v;
  };
  window.GNM_explain = explain;
  explain();
  ['gnm-persona', 'gnm-level', 'storage'].forEach(function (ev) { window.addEventListener(ev, function () { explain(); window.GNM_terms(document); }); });
  // Underline the first few known words in the committee's own sentences; a tap explains them (the same popover).
  var TK = Object.keys(G).sort(function (a, b) { return b.length - a.length; });
  window.GNM_terms = function (root) {
    if (document.documentElement.getAttribute('data-explain') === 'expert' || !root || !root.querySelectorAll) return;
    root.querySelectorAll('[data-term-def]').forEach(function (d) { var k = d.getAttribute('data-term-def'), m = d.querySelector('dd'); if (k && m && !G[k]) { G[k] = m.textContent; TK.push(k); TK.sort(function (a, b) { return b.length - a.length; }); } });
    root.querySelectorAll('.db-bubble, .ez-sum, .is-open li, .is-watch li, .cl-mini p').forEach(function (el) {
      if (el.hasAttribute('data-termed')) return; el.setAttribute('data-termed', '');
      var seen = {}, n = 0, walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: function (t) { return t.parentNode.closest('button, a, .db-quote, .ck, .ev-row, .db-plain b') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } }), nodes = [];
      while (walk.nextNode()) nodes.push(walk.currentNode);
      nodes.forEach(function (t) {
        while (n < 3) {
          var s = t.nodeValue, best = -1, key = '';
          TK.forEach(function (k) { if (seen[k]) return; var i = s.indexOf(k); if (i >= 0 && (best < 0 || i < best)) { best = i; key = k; } });
          if (best < 0) return;
          seen[key] = 1; n++;
          var rest = t.splitText(best), after = rest.splitText(key.length), b = document.createElement('button');
          b.type = 'button'; b.className = 'term'; b.dataset.term = key; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', key + ' 뜻 보기'); b.textContent = key;
          rest.parentNode.replaceChild(b, rest); t = after;
        }
      });
    });
  };
  window.GNM_terms(document);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-easy-toggle]'); if (!b) return;
    var on = document.documentElement.getAttribute('data-explain') !== 'easy';
    try { localStorage.setItem('gnm-easy', (on ? '1:' : '0:') + baseLevel()); } catch (x) {}
    explain(); window.GNM_terms(document);
    if (window.GNM && GNM.track) GNM.track('easy', { on: on ? 1 : 0 });
  });
  var pop = null;
  var close = function () { if (pop) { pop.remove(); pop = null; } document.querySelectorAll('.tip[aria-expanded=true], .term[aria-expanded=true]').forEach(function (t) { t.setAttribute('aria-expanded', 'false'); }); };
  document.querySelectorAll('h2, h3, .pl-k, .label, th, .term-cell, .si-name, .hs-k, .kp-title, .sc-k, .opt-t b').forEach(function (el) {
    if (el.querySelector('.tip') || el.closest('.gate-cta, .tip-pop, .price-bar')) return;
    var text = el.textContent || '', k = keys.find(function (key) { return text.indexOf(key) >= 0; });
    var scope = (el.closest('.panel') || document.body).id || 'page', id = scope + ':' + k;
    if (!k || used[id]) return; used[id] = 1;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'tip'; b.textContent = '?'; b.setAttribute('aria-label', '용어 설명: ' + k); b.setAttribute('aria-expanded', 'false'); b.dataset.term = k;
    el.appendChild(b);
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.tip, .term');
    if (!t) { if (!(e.target.closest && e.target.closest('.tip-pop'))) close(); return; }
    e.preventDefault(); e.stopPropagation();
    var was = t.getAttribute('aria-expanded') === 'true'; close(); if (was) return;
    pop = document.createElement('div'); pop.className = 'tip-pop'; pop.setAttribute('role', 'tooltip');
    pop.innerHTML = '<b></b><span></span>'; pop.firstChild.textContent = t.dataset.term; pop.lastChild.textContent = G[t.dataset.term];
    document.body.appendChild(pop);
    place(t);
    t.setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  // Capture: the debate room scrolls inside itself (and the replay scrolls it on each turn), so the popover
  // follows its word there and closes only once the word leaves the screen.
  var place = function (t) { var r = t.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 24); pop.style.left = Math.max(12, Math.min(window.scrollX + r.left - 12, window.scrollX + window.innerWidth - w - 12)) + 'px'; pop.style.top = (window.scrollY + r.bottom + 8) + 'px'; return r; };
  document.addEventListener('scroll', function () { var t = pop && document.querySelector('.tip[aria-expanded=true], .term[aria-expanded=true]'); if (!t) return close(); var r = place(t); if (r.bottom < 0 || r.top > window.innerHeight) close(); }, { passive: true, capture: true });
})();
</script>`;

const escM = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** G-211, G-245: the help links, now rows at the bottom of the 나 tab. */
export const MENU_FOOT: readonly [string, string][] = [['FAQ·1:1 문의', 'faq.html'], ['업데이트 기록', 'updates.html'], ['이번 주 설문', 'survey.html?k=weekly'], ['이용약관', 'terms.html'], ['개인정보처리방침', 'privacy.html'], ['HANUL 소개', 'hanul.html']];
/** The app's tabs (G-95, G-245): the bottom bar on phones, the same links in the top bar on wide screens. Five tabs, one per
 * group of the feature map (홈 · 찾기 · 내 종목 · 위원회 · 나); the old 전체 sheet is gone and its pages live inside these tabs. */
export const TABS: readonly [string, string, string][] = [
  ['홈', 'index.html#top', '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'],
  ['찾기', 'screener.html', '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'],
  ['위원회', 'reports.html', '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9.5 4h5v3h-5zM9 13.5l2 2 4-4"/>'],
  ['나', 'settings.html', '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'],
];
/**
 * G-245: inside a tab, sibling pages are modes of one screen, switched with the chewy pill (G-189) instead of
 * more menus. Each group: [label, href]; the first page of a group is the tab's own page.
 */
export const MODE_GROUPS: readonly { key: string; label: string; modes: readonly [string, string][] }[] = [
  { key: 'find', label: '찾기', modes: [['주식', 'screener.html'], ['미국 주식', 'screener.html#us'], ['ETF', 'screener.html#etf'], ['코인', 'screener.html#coin'], ['테마', 'themes.html'], ['공시', 'signals.html']] },
  // G-255: 내 종목 is no longer a tab; its pages are 나's 내 기록 (관심 종목 itself lives on 홈).
  { key: 'record', label: '내 기록', modes: [['알림함', 'inbox.html'], ['내 리포트', 'myreports.html'], ['내 토론', 'mydebates.html']] },
  { key: 'committee', label: '위원회', modes: [['AI 리포트', 'reports.html'], ['성적표', 'scorecard.html'], ['시장 데일리', 'market-reports.html']] },
];
/** Pages that belong to the 나 tab (account, money, help). */
const ME_PAGES = ['account.html', 'pricing.html', 'login.html', 'onboarding.html', 'checkout.html', 'guide.html', 'faq.html', 'updates.html', 'survey.html', 'terms.html', 'privacy.html', 'hanul.html'];
/** page file → the tab link (data-tab-link) it lights up. */
const GROUP_TAB: Record<string, string> = { find: 'screener.html', committee: 'reports.html', record: 'settings.html' };
const TAB_OF: Record<string, string> = Object.fromEntries([
  ...MODE_GROUPS.flatMap((g) => g.modes.map(([, h]) => [h.split('#')[0], GROUP_TAB[g.key] ?? g.modes[0]![1]] as const)),
  ...ME_PAGES.map((p) => [p, 'settings.html'] as const),
  ['watch.html', 'top'] as const,
]);
const svgI = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SPARK_ICON = '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>';
const GRID_ICON = '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>';
const DOCK_ICONS: Record<string, string> = {
  'reports.html': '<path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20z"/><path d="M14 3.5V8h4M10 12h5M10 15.5h5"/>',
  'scorecard.html': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  'vs.html': '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7"/>',
  'market-reports.html': '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  'inbox.html': '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  'myreports.html': '<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/><path d="M12 8v4l3 2"/>',
  'settings.html': '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
};
const FILTER_ICON = '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>';
/** G-258: which screen's own bar a page gets: 찾기 a search field, 위원회 and 나 their icons. */
function dockOf(page: string): 'find' | 'committee' | 'me' | undefined {
  const g = MODE_GROUPS.find((x) => x.modes.some(([, h]) => h.split('#')[0] === page));
  if (g?.key === 'find' || page === 'screener.html') return 'find';
  if (g?.key === 'committee') return 'committee';
  if (g?.key === 'record' || page === 'settings.html' || ME_PAGES.includes(page)) return 'me';
  return undefined;
}
/** The 종목 bar's question chips (G-258): one tap opens the chat with the question typed in. */
/**
 * One tab bar; `where` = 'top' (wide screens, in the header) or 'bottom' (phones).
 * G-258: the phone bar is one glass pill. Icons only, the current one named in a small bubble. With `ask` (stock and
 * report pages) or a `page` that has its own bar, the right side turns into that screen's bar after the page opens.
 */
export function tabBar(base: string, where: 'top' | 'bottom', ask?: string, page?: string): string {
  const links = TABS.map(([l, h, d]) => `<a href="${base}${h}" aria-label="${l}" data-tab-link="${h.split('#')[1] ?? h}">${svgI(d)}<span>${l}</span></a>`).join('');
  if (where === 'top') return `<nav class="top-tabs" aria-label="주 메뉴">${links}</nav>`;
  const chat = 'data-open-chat aria-haspopup="dialog" aria-controls="chat"';
  const dock = ask ? 'ask' : page ? dockOf(page) : undefined;
  const seg = (rows: readonly (readonly [string, string, boolean, string?])[]) => `<div class="nav-seg">${rows.map(([l, h, on, extra]) => `<a href="${base}${h}" aria-label="${escM(l)}"${on ? ' aria-current="page"' : ''}>${svgI(DOCK_ICONS[h] ?? '')}<span>${escM(l)}</span>${extra ?? ''}</a>`).join('')}</div>`;
  let ctx = '';
  if (dock === 'ask') ctx = `<button type="button" class="nav-ask" ${chat} aria-label="${escM(ask!)}에 대해 물어보기">${svgI(ASK_ICON)}<span>물어보기</span><i aria-hidden="true">${svgI('<path d="M12 19V5M6 11l6-6 6 6"/>')}</i></button>`;
  else if (dock === 'find') ctx = `<button type="button" class="nav-field" data-dock-search>${svgI('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>')}<span>종목·ETF·코인</span></button><button type="button" class="nav-round" data-dock-filter aria-label="필터">${svgI(FILTER_ICON)}</button>`;
  else if (dock === 'committee') ctx = seg(MODE_GROUPS.find((g) => g.key === 'committee')!.modes.map(([l, h]) => [l, h, h === page] as const));
  else if (dock === 'me') ctx = seg([['알림함', 'inbox.html', page === 'inbox.html', '<i data-dock-unread hidden></i>'], ['내 기록', 'myreports.html', page === 'myreports.html' || page === 'mydebates.html'], ['설정', 'settings.html', page !== 'inbox.html' && page !== 'myreports.html' && page !== 'mydebates.html']]);
  const back = dock ? `<button type="button" class="nav-back" aria-label="탭 4개 보기">${svgI(GRID_ICON)}</button>` : '';
  return `<nav class="bottom-nav" aria-label="빠른 이동"${dock ? ` data-dock="${dock}"` : ''}>${back}<button type="button" class="nav-spark" ${chat} aria-label="AI에게 묻기">${svgI(SPARK_ICON)}</button><div class="nav-tabs">${links}</div>${dock ? `<div class="nav-ctx">${ctx}</div>` : ''}</nav>`;
}
const ASK_ICON = '<path d="M5 5h14v10h-8l-4 4v-4H5z"/>';
/**
 * G-262 (was G-247 before beta took that number): one header block per screen (한서님 10/18 '바가 너무 많다'): the screen's name, then one row of text tabs whose
 * underline is the chewy pill (G-189). On phones it replaces the top bar; it sits at the start of <main>.
 * `tabs` overrides the row (찾기 keeps its in-page market buttons); with neither a group nor `tabs` only the title shows.
 */
export function pageHead(base: string, opts: { page?: string; title?: string; tabs?: string }): string {
  const g = opts.page ? MODE_GROUPS.find((x) => x.modes.some(([, h]) => h === opts.page)) : undefined;
  const title = opts.title ?? g?.label ?? '';
  const tabs = opts.tabs ?? (g ? `<nav class="mode-tabs" aria-label="${escM(g.label)}">${g.modes.map(([l, h]) => `<a href="${base}${h}"${h === opts.page ? ' aria-current="page"' : ''}>${escM(l)}</a>`).join('')}</nav>` : '');
  return `<div class="pg-title"><h1>${escM(title)}</h1><button type="button" class="pg-ask" data-open-chat aria-haspopup="dialog" aria-controls="chat" aria-label="AI에게 묻기">${svgI(ASK_ICON)}</button></div>${tabs}`;
}
/** Kept for callers that only want the row: the same text tabs as pageHead. */
export function modeBar(base: string, page: string): string {
  const g = MODE_GROUPS.find((x) => x.modes.some(([, h]) => h === page));
  return g ? pageHead(base, { page }).replace(/^<div class="pg-title">.*?<\/div>/, '') : '';
}

/** The top bar's tabs (wide screens). G-245: there is no 전체 sheet any more; `drawer` stays empty for old callers. */
export function menuHtml(base: string): { button: string; drawer: string } {
  return { button: tabBar(base, 'top'), drawer: '' };
}

/** G-245: the top of the 나 tab — the account row, the app install, the ops link for admins (filled by alpha.ts). */
export function meHead(base: string): string {
  return `<div class="me-head"><a class="me-acct" href="${base}pricing.html" data-acct-tab="1"><span><b>내 계정</b><small><span data-plan-name>무료</span> · <span data-credits>0</span> 크레딧</small></span><i aria-hidden="true">›</i></a><button type="button" class="me-install" data-install hidden>그노몬 앱 설치<small>한 번 누르면 홈 화면에 앱으로 생겨요</small></button><div id="sm-admin"></div></div>`;
}
/** G-255: 나's 내 기록 rows — what used to be the 내 종목 tab, one tap each. */
export function meRecord(base: string): string {
  const rows: readonly [string, string, string][] = [['관심 종목', 'watch.html', '☆를 누른 종목'], ['알림함', 'inbox.html', '가격·리포트·공시 알림'], ['내 리포트', 'myreports.html', '내가 요청한 리포트'], ['내 토론', 'mydebates.html', '위원회에 한 질문']];
  return `<section class="card st-rows me-rec">${rows.map(([l, h, d]) => `<a href="${base}${h}"><span><b>${escM(l)}</b><small>${escM(d)}</small></span><i aria-hidden="true">›</i></a>`).join('')}</section>`;
}
/** G-245: the 나 tab's help rows (사용법 and what used to be the small links under the 전체 sheet). */
export function meHelp(base: string): string {
  const rows: readonly [string, string][] = [['사용법', 'guide.html'], ...MENU_FOOT];
  return `<section class="card st-rows">${rows.map(([l, h]) => `<a href="${base}${h}"><span><b>${escM(l)}</b></span><i aria-hidden="true">›</i></a>`).join('')}</section>`;
}

/**
 * Live prices (G-62): any element with data-live="<code or KRW-coin>" and data-live-f="price | pct |
 * arrowpct | full | tag" follows the market. Stocks and ETFs poll the API's /quote every 10 seconds
 * while the page is visible (every 60 outside trading hours); coins stream from Upbit's public WebSocket.
 * Lists drawn later (the watchlist, 찾기) are picked up on the next tick.
 */
/**
 * Full-screen layers (G-121): what used to open as a small popup now takes the whole phone screen like a page
 * (a fixed top bar, content below) and a tall centred panel on wide screens. The phone's back button closes the
 * top layer instead of leaving the page. Small explanations (용어 풀이, 근거 칩) stay as tooltips.
 */
export const FS_CSS = `.tap-card{cursor:pointer;-webkit-tap-highlight-color:rgba(19,41,75,.06)}.tap-card:active{background-color:rgba(19,41,75,.03)}@media (hover:hover){tr.tap-card:hover,li.tap-card:hover{background:var(--accent-soft)}}
@media (max-width:820px){
dialog.v2-dialog[open]{position:fixed!important;inset:0!important;margin:0!important;width:100%!important;max-width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;padding:0 16px calc(16px + env(safe-area-inset-bottom))!important}
dialog.v2-dialog.rj[open]{padding:0!important}
dialog.v2-dialog>header{position:sticky;top:0;z-index:3;background:var(--surface-solid);margin:0 -16px 10px!important;padding:14px 16px 12px!important;border-bottom:1px solid var(--line)}
dialog.v2-dialog.rj>header{margin:0!important}
.flt-pop{padding:0!important;place-items:stretch!important}.flt-sheet{width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important}
.sheet{align-items:stretch!important}.sheet-body{width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;padding-top:0!important}.sheet-head{top:0!important;margin:0 -18px 8px!important;padding:14px 18px 12px!important;border-bottom:1px solid var(--line)}
.chat{inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:100%!important;max-width:100%!important;height:100dvh!important;border-radius:0!important}
dialog.v2-dialog>header>.dialog-x,dialog.v2-dialog .rj-head .dialog-x,.flt-top .flt-x,.chat-head .chat-x,.sm-head .sm-close{order:-1;font-size:0!important;width:36px;height:36px;margin:-6px 4px -6px -8px;display:inline-flex;align-items:center;justify-content:center;border:0;background:none;color:var(--fg)}
dialog.v2-dialog>header>.dialog-x::before,dialog.v2-dialog .rj-head .dialog-x::before,.flt-top .flt-x::before,.chat-head .chat-x::before,.sm-head .sm-close::before{content:"‹";font-size:34px;line-height:1;font-weight:300;margin-top:-4px}
dialog.v2-dialog>header,.flt-top,.sm-head{justify-content:flex-start!important;gap:4px!important}.chat-head{gap:6px}.chat-head .chat-x{color:#fff!important}
.ins-pop{align-items:stretch!important}.ins-pop .ins-card{border-radius:0!important;max-width:none!important;display:flex;flex-direction:column;justify-content:center}
.pop-wrap{padding:0!important;place-items:stretch!important}.pop-wrap .pop{width:100%!important;border-radius:0!important;display:flex;flex-direction:column;justify-content:center;align-items:center}
}
@media (min-width:821px){
dialog.v2-dialog[open]{width:min(640px,calc(100% - 48px))!important;height:fit-content!important;max-height:calc(100dvh - 48px)!important}dialog.v2-dialog.rj[open]{width:min(520px,calc(100% - 48px))!important}
dialog.v2-dialog>header{position:sticky;top:-20px;z-index:3;background:var(--surface-solid);padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:10px}
dialog.v2-dialog.rj>header{top:0}
.sheet-body{width:min(640px,94vw)!important;max-height:calc(100dvh - 48px)!important}
.flt-sheet{width:min(1180px,100%)!important;height:calc(100dvh - 40px)!important}
}
html.layer-open{overflow:hidden}dialog.v2-dialog .dialog-x{border-radius:10px}dialog.v2-dialog .dialog-x:focus:not(:focus-visible){outline:none}`;

/** Back button and scroll lock for the full-screen layers. */
export const FS_JS = `
  (function () {
    var L = [
      ['dialog.v2-dialog[open]', function (e) { e.close(); }],
      ['.bell-pop', function () { var b = document.getElementById('bell'); if (b) b.click(); }],
      ['.flt-pop', function (e) { var x = e.querySelector('.flt-x'); if (x) x.click(); }],
      ['.sc-sheet.open', function (e) { var x = e.querySelector('.sc-sheet-x'); if (x) x.click(); }],
      ['.sheet:not([hidden])', function (e) { var x = e.querySelector('[data-close]'); if (x) x.click(); }],
      ['section.chat:not([hidden])', function (e) { var x = e.querySelector('.chat-x'); if (x) x.click(); }],
      ['.ins-pop', function (e) { e.remove(); }],
      ['.db-room:not([hidden])', function (e) { var x = e.querySelector('[data-room-close]'); if (x) x.click(); }],
      ['.pop-wrap', function (e) { var x = e.querySelector('[data-p=later]'); if (x) x.click(); else e.remove(); }]
    ];
    var open = function () { var out = []; L.forEach(function (l) { document.querySelectorAll(l[0]).forEach(function (e) { if (e.offsetParent !== null || getComputedStyle(e).position === 'fixed') out.push([e, l[1]]); }); }); return out; };
    // Each open layer adds one history entry. Closing with × leaves its entry behind; history only moves when the
    // reader presses back (so it never races a link they tap next), and a press that lands on a stale entry skips it.
    var t = null, lvl = function () { return (history.state && history.state.gnmLayer) || 0; };
    var sync = function () {
      t = null; var n = open().length;
      document.documentElement.classList.toggle('layer-open', n > 0);
      if (n > lvl()) history.pushState({ gnmLayer: n }, '');
    };
    new MutationObserver(function () { if (!t) t = setTimeout(sync, 30); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] });
    window.addEventListener('popstate', function () {
      var o = open();
      if (o.length > lvl()) { var top = o[o.length - 1]; top[1](top[0]); }
      setTimeout(function () { if (lvl() > open().length) history.back(); }, 60);
    });
  })();`;

/**
 * Whole-card taps (G-123): a card, list row or table row that leads to exactly one place opens it wherever it is
 * tapped, not only on its small link. Rows with several destinations, forms, charts or their own buttons keep
 * their parts. Applied again when parts of the page are drawn later.
 */
export const TAP_JS = `
  (function () {
    var BOX = '.card, .tp-card, .mi-card, .tm-item, .tm-row, .bell-item, .feed-item, .list-row, li, tr, .st-item, .row-link, [data-tap]';
    var SKIP = 'canvas, svg.chart, form, input, select, textarea, .tv-lightweight-charts, .chart-wrap, dialog, .sheet, .chat, .side-menu';
    var hrefs = function (el) { var s = {}; el.querySelectorAll('a[href]').forEach(function (a) { var h = a.getAttribute('href'); if (h && h.charAt(0) !== '#' && !/^(javascript|mailto|tel):/.test(h)) s[a.href] = a; }); return s; };
    var mark = function () {
      document.querySelectorAll(BOX).forEach(function (el) {
        if (el.hasAttribute('data-tap-done')) return; var hh = el.getBoundingClientRect().height; if (!hh) return; el.setAttribute('data-tap-done', '');
        if (el.querySelector(SKIP) || el.closest('dialog, .sheet, .chat, .side-menu, .bell-pop, nav')) return;
        var h = hrefs(el), keys = Object.keys(h);
        if (keys.length !== 1 || el.querySelectorAll('button').length > 1) return;
        // A card holding other cards is a list: its rows decide.
        if (el.querySelector('.card, li, tr') && el.querySelectorAll('.card, li, tr').length > 1) return;
        // Only when that link is what the box is about: it holds the box's name, or the box is a short row.
        var link = h[keys[0]], named = !!link.querySelector('b, strong, h2, h3, h4, .name, .tp-name') || /^(B|STRONG|H2|H3|H4)$/.test((link.firstElementChild || {}).tagName || '');
        if (!named && hh > 180) return;
        el.classList.add('tap-card'); el.setAttribute('data-tap-href', keys[0]);
      });
    };
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      var el = e.target.closest && e.target.closest('.tap-card'); if (!el) return;
      if (e.target.closest('a, button, input, select, textarea, label, summary, details > *:not(summary) a, [role=button], [role=tab], [contenteditable]')) return;
      if (window.getSelection && String(window.getSelection()).length > 2) return;
      var a = el.querySelector('a[href]'); var url = el.getAttribute('data-tap-href');
      if (e.metaKey || e.ctrlKey) { window.open(url, '_blank'); return; }
      if (a && a.target === '_blank') window.open(url, '_blank', 'noopener'); else location.href = url;
    });
    var t = null; new MutationObserver(function () { if (!t) t = setTimeout(function () { t = null; mark(); }, 120); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
    mark();
  })();`;

/** Captures the browser's install offer as early as possible (it can fire before ui.js loads). */
export const INSTALL_BOOT = `<script>window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__gnmInstall=e;window.dispatchEvent(new Event('gnm-installable'));});</script>`;

/**
 * One-tap install (G-120): Chrome, Edge and Samsung Internet install from the 📲 button directly; iPhone has no
 * install API, so the button shows the two Safari steps instead. Hidden once the app runs installed.
 */
export const INSTALL_JS = `
  (function () {
    var standalone = function () { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; };
    var ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var base = document.body.dataset.base || '';
    // The service worker makes the site installable everywhere (it is also what carries push).
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration(base + 'sw.js').then(function (r) { if (!r) navigator.serviceWorker.register(base + 'sw.js').catch(function () {}); }).catch(function () {});
    var show = function () { var on = !standalone() && (!!window.__gnmInstall || ios); document.querySelectorAll('[data-install]').forEach(function (b) { b.hidden = !on; }); };
    var iosSteps = function () {
      var pop = document.createElement('div'); pop.className = 'ins-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-modal', 'true'); pop.setAttribute('aria-label', '앱 설치');
      pop.innerHTML = '<div class="ins-card"><b>아이폰에 그노몬 설치</b><p class="muted small">아이폰은 Safari에서만 설치할 수 있어요. 두 번만 누르면 돼요.</p><ol><li>아래 <b>공유</b> 버튼(네모에 위 화살표)을 눌러요</li><li><b>홈 화면에 추가</b>를 눌러요</li></ol><button type="button" class="btn-primary">알겠어요</button></div>';
      pop.addEventListener('click', function (e) { if (e.target === pop || e.target.tagName === 'BUTTON') pop.remove(); });
      document.body.appendChild(pop); pop.querySelector('button').focus();
    };
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-install]'); if (!b) return;
      var ev = window.__gnmInstall;
      if (ev) { ev.prompt(); ev.userChoice.then(function (c) { if (c && c.outcome === 'accepted') { window.__gnmInstall = null; show(); } }).catch(function () {}); return; }
      if (ios) { iosSteps(); return; }
      if (window.GNM && GNM.toast) GNM.toast('이 브라우저는 바로 설치를 지원하지 않아요. 크롬이나 삼성 인터넷에서 열어 주세요.');
    });
    window.addEventListener('gnm-installable', show);
    window.addEventListener('appinstalled', function () { window.__gnmInstall = null; show(); if (window.GNM && GNM.toast) GNM.toast('그노몬 앱을 설치했어요. 홈 화면에서 열 수 있어요.'); });
    show();
  })();`;

export const LIVE_JS = `
  (function () {
    var G = window.GNM || {}, last = {}, ws = null, wsSet = '', timer = 0;
    // 3.0 (G-143): US codes start with a letter (AAPL.O, TSM); Korean ones with a digit, coins with KRW-.
    var isUs = function (s) { return /^(?!KRW-)[A-Z][A-Z0-9-]{0,9}(\\.[A-Z])?$/.test(s); };
    var won = function (v, sym) { var a = Math.abs(v); if (sym && isUs(sym)) return (v < 0 ? '-$' : '$') + a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: a < 1 ? 4 : 2 }); return (a >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: a >= 1 ? 2 : 4 })) + '원'; };
    var sg = function (v) { return (v > 0 ? '+' : '') + v.toFixed(2) + '%'; };
    var paint = function (sym, q) {
      var prev = last[sym]; last[sym] = q;
      // G-185: positions are read once before any write (no layout thrash), and an element rolls at most every 1.5 s
      // so a fast feed (Upbit) sets the text instead of restarting the roll.
      var els = [].slice.call(document.querySelectorAll('[data-live="' + sym + '"]')), nowMs = Date.now();
      var shown = els.map(function (el) { var r = el.getBoundingClientRect(); return !!(r.width && r.bottom > 0 && r.top < innerHeight); });
      els.forEach(function (el, idx) {
        var f = el.getAttribute('data-live-f'), t = q.changePct > 0 ? 'up' : q.changePct < 0 ? 'down' : '';
        if (f === 'nowlabel') { el.textContent = q.open ? '지금' : '현재가'; return; }
        // The time of the last trade, so the reader sees how fresh the number is (G-128).
        var hm = q.at ? String(q.at).replace(/^.*T(\\d\\d:\\d\\d(:\\d\\d)?).*$/, '$1') : '';
        if (f === 'tag') { el.hidden = false; el.textContent = q.open ? (q.session === 'pre' ? (isUs(sym) ? '● 프리마켓' : '● NXT 프리마켓') : q.session === 'after' ? (isUs(sym) ? '● 애프터마켓' : '● NXT 애프터마켓') : '● 실시간') + (hm && hm.length <= 8 ? ' ' + hm : '') : '장 마감'; el.classList.toggle('on', !!q.open); return; }
        // G-185: numbers on screen roll to the new value (up or down with the tick); off screen they are just set.
        var dir = prev ? (q.price > prev.price ? 1 : q.price < prev.price ? -1 : 0) : 1, put = function (t) { if (window.gnmRoll && shown[idx] && nowMs - (el.__rlAt || 0) > 1500) { el.__rlAt = nowMs; gnmRoll(el, t, dir || 1); } else if (el.getAttribute('data-rv') !== t || el.textContent !== t) { el.textContent = t; el.setAttribute('data-rv', t); } };
        if (f === 'price') put(won(q.price, sym));
        else if (f === 'pct') put((q.changePct > 0 ? '▲ ' : q.changePct < 0 ? '▼ ' : '') + sg(q.changePct));
        else if (f === 'arrowpct') put((q.changePct > 0 ? '▲ ' : q.changePct < 0 ? '▼ ' : '') + sg(q.changePct));
        else if (f === 'full') put((q.change > 0 ? '▲' : q.change < 0 ? '▼' : '') + ' ' + (isUs(sym) ? won(Math.abs(q.change), sym) : Math.abs(q.change).toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + ' (' + sg(q.changePct) + ')');
        if (f !== 'price') { el.classList.remove('up', 'down'); if (t) el.classList.add(t); }
        if (prev && prev.price !== q.price) { el.classList.remove('live-up', 'live-down'); void el.offsetWidth; el.classList.add(q.price > prev.price ? 'live-up' : 'live-down'); }
      });
      window.dispatchEvent(new CustomEvent('gnm-quote', { detail: { symbol: sym, quote: q } }));
    };
    var symbols = function () { var s = {}; document.querySelectorAll('[data-live]').forEach(function (el) { s[el.getAttribute('data-live')] = 1; }); return Object.keys(s); };
    // KRX 09:00–15:30 plus Nextrade's 08:00–20:00 (G-128).
    // US pre-market 04:00 to after-market 20:00, New York time.
    var usTrading = function () { try { var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date()), g = function (t) { return (p.filter(function (x) { return x.type === t; })[0] || {}).value; }; var m = Number(g('hour')) % 24 * 60 + Number(g('minute')); return ['Sat', 'Sun'].indexOf(g('weekday')) < 0 && m >= 240 && m <= 1200; } catch (e) { return true; } };
    var trading = function () { var k = new Date(Date.now() + 9 * 3600e3), d = k.getUTCDay(), m = k.getUTCHours() * 60 + k.getUTCMinutes(); return d > 0 && d < 6 && m >= 475 && m <= 1205; };
    var coins = function (list) {
      var want = list.filter(function (x) { return x.indexOf('KRW-') === 0; }).sort().join(',');
      if (!want || want === wsSet || !('WebSocket' in window)) return;
      wsSet = want; if (ws) try { ws.close(); } catch (e) {}
      ws = new WebSocket('wss://api.upbit.com/websocket/v1'); ws.binaryType = 'arraybuffer';
      ws.onopen = function () { ws.send(JSON.stringify([{ ticket: 'gnm-' + Date.now() }, { type: 'ticker', codes: want.split(',') }, { format: 'SIMPLE' }])); };
      ws.onmessage = function (e) {
        try { var d = JSON.parse(typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data));
          paint(d.cd, { price: d.tp, change: d.scp, changePct: d.scr * 100, open: true }); } catch (x) {}
      };
      ws.onclose = function () { if (wsSet === want) { wsSet = ''; setTimeout(function () { coins(symbols()); }, 5000); } };
    };
    var tick = function () {
      clearTimeout(timer);
      var list = symbols(); coins(list);
      var codes = list.filter(function (x) { return /^[0-9A-Z]{6}$/.test(x); });
      if (G.api && codes.length && !document.hidden) {
        fetch(G.api + '/quote?s=' + codes.slice(0, 40).join(',')).then(function (r) { return r.json(); }).then(function (d) { (d.quotes || []).forEach(function (q) { paint(q.symbol, q); }); }).catch(function () {});
      }
      var us = list.filter(isUs);
      if (G.api && us.length && !document.hidden) {
        fetch(G.api + '/quote?u=' + us.slice(0, 20).join(',')).then(function (r) { return r.json(); }).then(function (d) { (d.quotes || []).forEach(function (q) { paint(q.symbol, q); }); }).catch(function () {});
      }
      timer = setTimeout(tick, trading() || (us.length && usTrading()) ? 4000 : 60000);
    };
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    // The chart's last daily candle follows the live price on a report page (stocks and ETFs, open market).
    window.addEventListener('gnm-quote', function (e) {
      var C = window.GNMChart, d = e.detail, bar = document.getElementById('price-bar');
      if (!C || !C.candle || !C.bars || !d.quote.open || (d.quote.session && d.quote.session !== 'regular') || !bar || !bar.querySelector('[data-live="' + d.symbol + '"]') || d.symbol.indexOf('KRW-') === 0 || isUs(d.symbol)) return;
      try {
        var today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), b = C.bars[C.bars.length - 1], px = d.quote.price;
        if (!b || b.date > today) return;
        var same = b.date === today;
        C.candle.update({ time: today, open: same ? b.open : px, high: same ? Math.max(b.high, px) : px, low: same ? Math.min(b.low, px) : px, close: px });
      } catch (x) {}
    });
    // Parts drawn later (AI fragments, the unlocked deep report, a free page that learns its code from data) get the
    // last known price right away, and a symbol never fetched yet is asked for now instead of at the next slow tick.
    var again = null; new MutationObserver(function (list) { if (again || !list.some(function (m) { return m.type === 'attributes' || [].some.call(m.addedNodes, function (n) { return n.nodeType === 1 && (n.matches('[data-live]') || n.querySelector('[data-live]')); }); })) return; again = setTimeout(function () { again = null; Object.keys(last).forEach(function (sym) { paint(sym, last[sym]); }); if (symbols().some(function (x) { return !last[x]; })) tick(); }, 100); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-live'] });
    window.GNM_live = { tick: tick, last: last };
    setTimeout(tick, 300);
  })();`;

/**
 * The guided tour (G-74): on the real page, a dimmed screen with a hole around one part and a bubble
 * that says what it is. Home and report pages each have their own steps. It starts once on the first
 * visit, or any time with ?tour=1 (the guide's buttons), and remembers when it was finished or skipped.
 */
export const TOUR_JS = `
  (function () {
    var run = function () {
    var STEPS = {
      // G-244: three stops, not seven: the market line, the reader's own stocks and the menu.
      home: [
        ['#mkt-hero', '오늘 시장', '날짜 아래에 코스피·코스닥을 한 줄로 보여줘요. 누르면 시장 리포트가 열려요.'],
        ['#watch', '내 종목', '어디서든 ☆를 누른 종목과 설문에서 고른 종목이 여기 모여요. 가격은 장중에 실시간으로 바뀌어요.'],
        ['.bottom-nav', '아래 탭', '다섯 탭이 전부예요. 찾기에서 주식·ETF·코인·테마·공시를 바꿔 가며 보고, 위원회에서 AI 리포트와 성적표를 봐요.'],
        ['.top-tabs', '위쪽 탭', '찾기에서 종목·ETF·코인을 검색하고 조건으로 골라요. 테마와 공시 레이더도 찾기에 있어요.'],
      ],
      report: [
        ['.chips', '다섯 탭', '요약 · 타이밍(기술 신호와 전략) · 기업 체력(종목정보·재무제표·수급) · AI 위원회 · 뉴스·공시가 같은 위치에 있어요. 차트는 요약의 작은 차트를 누르면 전체 화면으로 열려요. 리포트가 없으면 AI 분석은 잠금으로 보여요.'],
        ['#home-conclusion', '조건 가격', '큰 가격은 강세·약세 전개를 검토하는 조건이에요. 전망 범위와는 달라요. 분석 날짜·당시 종가와 조건 출처도 확인하세요.', 'home'],
        ['.hero-chart', '차트 자세히 보기', '작은 차트를 누르면 전체 화면 차트가 열려요. 캔들·하이킨아시·바·라인·영역·기준선, 지표, 그리기, 지수 비교, 최고·최저 표시를 쓸 수 있고 ‹나 뒤로 가기로 닫아요.', 'home'],
        ['#tab-technical', '지표 선택', '피보나치·RSI 등 지표 본문에서 차트 연결을 누르면 해당 지표만 켜져요. 기술로 돌아가기로 보던 위치에 복귀해요.', 'technical'],
        ['#tab-fundamentals', '기업 체력', '성장·수익성·안정성·수급·가치를 한눈에 보고, 재무제표와 수급을 이어서 확인해요.', 'fundamentals'],
        ['#tab-ai', '토론과 질문', '전체 토론은 2초 생각 → 발언 → 2초 쉼으로 재생돼요. 바로 아래 입력창에서 질문하고 +로 답변자나 내 전문가를 고르세요. 전송 전 작은 크레딧 안내를 확인하세요.', 'ai'],
        ['#tab-news', '뉴스·공시', '제목으로 원문을 확인하고 더 보기로 나머지를 펼쳐요. 기업 이벤트와 테마 확장은 준비 중이에요.', 'news'],
      ],
      find: [
        ['#search|.bottom-nav .nav-field', '종목 검색', '이름·코드·초성으로 종목을 찾아요.'],
        ['.mode-tabs', '모드 선택', '주식·ETF·코인·테마·공시를 바꿔 가며 보세요. 시장별로 지원되는 조건이 달라요.'],
        ['#sc-filter-open|.bottom-nav [data-dock-filter]', '필터 · AI 조건', '필터를 누르면 AI 조건(원하는 특징을 문장으로)과 직접 조건을 정하는 화면이 열려요. 결과 보기로 돌아와요.'],
        ['#ai-build', 'AI 조건', '원하는 특징을 문장으로 적고 ✦를 누르세요. 실제 생성 대기에는 Thinking Orbs가 표시돼요.'],
        ['#sc-form', '검토·적용·저장', 'AI 제안을 검토해 적용한 뒤 조건을 직접 수정하고 저장하세요. 완료 안내가 나와야 저장된 상태예요. 오류면 다시 확인하세요.'],
      ],
    };
    var kind = document.getElementById('tab-ai') ? 'report' : document.getElementById('mkt-hero') ? 'home' : document.getElementById('ai-build') ? 'find' : null;
    if (!kind) return;
    var key = 'gnm-tour-v243-' + kind, forced = /[?&]tour=/.test(location.search), seen = null;
    try { seen = localStorage.getItem(key) || localStorage.getItem('gnm-tour-' + kind) || localStorage.getItem('gnm-tour-done'); } catch (e) {}
    if (seen && !forced) return;
    // G-260: a step may name 'page part|bar part'; on phones the part in the bottom bar is used (and the bar shows its own row).
    var pick = function (sel) { var xs = sel.split('|'); for (var k = 0; k < xs.length; k++) { var e = document.querySelector(xs[k]); if (e && /bottom-nav/.test(xs[k])) { var nv = e.closest('.bottom-nav'); if (nv && nv.hasAttribute('data-dock')) nv.classList.add('ctx'); } if (e && e.getClientRects().length) return e; } return document.querySelector(xs[0]); };
    var steps = STEPS[kind].filter(function (s) { var el = pick(s[0]); return el && (s[3] || el.getClientRects().length); });
    if (!steps.length) return;
    var i = 0, hole, tip, focusBefore = document.activeElement, originalTab = document.querySelector('.chips [aria-selected=true]');
    var end = function () { try { localStorage.setItem(key, '1'); } catch (e) {} if (hole) hole.remove(); if (tip) tip.remove(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place); window.removeEventListener('keydown', escapeTour); if (originalTab) { if (window.GNM_showTab) window.GNM_showTab(originalTab.getAttribute('aria-controls').replace('tab-','')); else originalTab.click(); } if (focusBefore && focusBefore.isConnected) focusBefore.focus({preventScroll:true}); };
    var escapeTour = function(e){if(e.key === 'Escape') end();};
    var place = function () {
      var el = pick(steps[i][0]); if (!el) return;
      var r = el.getBoundingClientRect(), pad = 6;
      // G-196: moved with transform, not top/left, so the spotlight never counts as the page jumping (it was nearly all the layout shift on a first visit).
      // The first placement snaps (no fly-in from the corner); later steps glide.
      var first = !hole.dataset.on; if (first) { hole.classList.add('still'); tip.classList.add('still'); }
      hole.style.cssText = 'transform:translate(' + Math.round(r.left - pad) + 'px,' + Math.round(r.top - pad) + 'px);width:' + Math.round(r.width + pad * 2) + 'px;height:' + Math.round(r.height + pad * 2) + 'px';
      var below = r.bottom + 180 < innerHeight || r.top < 200;
      tip.style.transform = 'translate(-50%,' + Math.round(below ? Math.min(r.bottom + 14, innerHeight - 190) : Math.max(r.top - 14 - tip.offsetHeight, 10)) + 'px)'; tip.classList.add('on');
      if (first) { void hole.offsetWidth; hole.dataset.on = '1'; hole.classList.remove('still'); tip.classList.remove('still'); }
    };
    var show = function () {
      var s = steps[i]; if (s[3]) { if (window.GNM_showTab) window.GNM_showTab(s[3]); else { var tab = document.getElementById('t-' + s[3]); if (tab) tab.click(); } } var el = pick(s[0]);
      el.scrollIntoView({ block: 'center' });
      tip.innerHTML = '<div class="tr-n">' + (i + 1) + ' / ' + steps.length + '</div><b>' + s[1] + '</b><p>' + s[2] + '</p><div class="tr-b"><button type="button" data-t="x">그만 보기</button>' + (i ? '<button type="button" data-t="p">이전</button>' : '') + '<button type="button" data-t="n" class="tr-next">' + (i === steps.length - 1 ? '끝' : '다음') + '</button></div>';
      tip.querySelector('[data-t=n]').focus({preventScroll:true}); setTimeout(place, 60);
    };
    var start = function () {
      hole = document.createElement('div'); hole.className = 'tr-hole';
      tip = document.createElement('div'); tip.className = 'tr-tip'; tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-label', '사용법 둘러보기');
      document.body.appendChild(hole); document.body.appendChild(tip);
      tip.addEventListener('click', function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-t'); if (!t) return; if (t === 'x') return end(); i += t === 'n' ? 1 : -1; if (i >= steps.length) return end(); show(); });
      window.addEventListener('resize', place); window.addEventListener('scroll', place, { passive: true }); window.addEventListener('keydown', escapeTour);
      show();
    };
    // Not over a full-screen chart or layer: wait until the reader is back on the page.
    var later = function () { if (/(^| )(chart-fs|layer-open)( |$)/.test(document.documentElement.className)) return setTimeout(later, 1000); start(); };
    setTimeout(later, forced ? 300 : 1200);
    };
    // G-112: a signed-in visitor on a new device first takes the account's settings (tours already seen
    // come with them), so the tour waits for that before deciding to start.
    var session = null; try { session = localStorage.getItem('gnm-session'); } catch (e) {}
    var go = function () { if (session && window.GNM && window.GNM.ready) window.GNM.ready.then(run, run); else run(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else setTimeout(go, 0);
  })();`;

export const TOUR_CSS = `.tr-hole{position:fixed;top:0;left:0;z-index:200;border-radius:14px;box-shadow:0 0 0 9999px rgba(10,20,35,.6);pointer-events:none;transition:transform .28s var(--ease-out,ease-out),width .28s var(--ease-out,ease-out),height .28s var(--ease-out,ease-out)}@media (prefers-reduced-motion:reduce){.tr-hole,.tr-tip{transition:none}}.tr-hole.still{transition:none}.tr-tip.still{transition:opacity .2s var(--ease-out,ease-out)}.tr-tip.on{opacity:1}.tr-tip{position:fixed;z-index:201;top:0;left:50%;transform:translateX(-50%);opacity:0;transition:opacity .2s var(--ease-out,ease-out),transform .28s var(--ease-out,ease-out);width:min(360px,calc(100vw - 28px));background:var(--surface-solid);border-radius:16px;padding:14px 16px;box-shadow:0 14px 36px rgba(0,0,0,.25)}.tr-tip b{font-size:16px}.tr-tip p{margin:6px 0 10px;font-size:14px;line-height:1.6;color:var(--fg2)}.tr-n{font-size:11.5px;font-weight:700;color:var(--accent-strong)}.tr-b{display:flex;gap:6px;justify-content:flex-end}.tr-b button{border:1px solid var(--line-strong);background:var(--surface);color:var(--fg2);border-radius:999px;padding:6px 13px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.tr-b [data-t=x]{margin-right:auto;border:0;color:var(--muted)}.tr-b .tr-next{background:var(--navy);color:var(--on-accent);border-color:var(--navy)}`;

/**
 * Survey card (G-75, G-154): on home only, for signed-in readers, once the tour is out of the way. A small card at
 * the bottom that covers nothing (it used to be a full-screen pop-up on every report page, even logged out). No custom survey yet →
 * ask for the 7-minute one (again three days after "나중에"). Friday to Sunday → this week's 1-minute
 * survey, once per week. Never on the survey pages themselves.
 */
export const SURVEY_POP_JS = `
  (function () {
    var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
    if (!(document.getElementById('mkt-hero') || document.getElementById('today')) || !get('gnm-session')) return;
    var now = Date.now(), k = new Date(now + 9 * 3600e3), day = k.getUTCDay();
    var week = k.getUTCFullYear() + '-' + Math.ceil(((k - Date.UTC(k.getUTCFullYear(), 0, 1)) / 864e5 + new Date(Date.UTC(k.getUTCFullYear(), 0, 1)).getUTCDay() + 1) / 7);
    var pick = null;
    if (!get('gnm-prefs') && Number(get('gnm-pop-onb') || 0) < now) pick = { key: 'gnm-pop-onb', later: now + 3 * 864e5, icon: '📝', title: '7분 맞춤 설문으로 내 화면 만들기', text: '투자 경험과 스타일을 알려 주시면 보기 방식, 오늘 볼 것, 설명 수준이 나에게 맞춰져요.', href: 'onboarding.html', cta: '설문 하기' };
    else if ((day === 5 || day === 6 || day === 0) && get('gnm-pop-week') !== week && !(now >= ${Date.parse(WRAPUP.from)} && now < ${Date.parse(WRAPUP.until)})) pick = { key: 'gnm-pop-week', later: week, icon: '🗓️', title: '이번 주 설문 (1분)', text: '이번 주에 좋았던 것과 불편했던 것 하나씩만 알려 주세요. 다음 주 개선 순서를 정해요.', href: 'survey.html?k=weekly', cta: '1분 설문 하기' };
    if (!pick) return;
    var base = document.body.getAttribute('data-base') || '';
    var open = function () {
      if (document.querySelector('.tr-tip') || document.querySelector('.side-menu:not([hidden])')) return setTimeout(open, 4000);
      var d = document.createElement('aside'); d.className = 'pop-card'; d.setAttribute('aria-label', pick.title);
      d.innerHTML = '<span class="pc-ic" aria-hidden="true">' + pick.icon + '</span><div class="pc-tx"><b>' + pick.title + '</b><p>' + pick.text + '</p><div class="pc-b"><a class="btn-primary" href="' + base + pick.href + '">' + pick.cta + ' ›</a><button type="button" data-p="later">나중에</button></div></div><button type="button" class="pc-x" data-p="later" aria-label="닫기">×</button>';
      var close = function () { set(pick.key, String(pick.later)); d.remove(); };
      d.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-p=later]'); if (b) close(); });
      d.querySelector('a').addEventListener('click', function () { set(pick.key, String(pick.later)); });
      document.body.appendChild(d);
    };
    setTimeout(open, 6000);
  })();`;

export const POP_CSS = `.pop-card{position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:120;max-width:440px;margin:0 auto;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;background:var(--surface-solid);border:1px solid var(--line);border-radius:16px;box-shadow:0 10px 30px rgba(10,20,35,.18);padding:14px;animation:pop-in .2s ease-out}.pc-ic{font-size:22px;line-height:1}.pc-tx b{display:block;font-size:15px}.pc-tx p{margin:4px 0 10px;font-size:13px;line-height:1.55;color:var(--fg2)}.pc-b{display:flex;gap:8px;align-items:center}.pc-b .btn-primary{margin:0;padding:9px 14px;font-size:14px}.pc-b button,.pc-x{border:0;background:none;font:inherit;font-size:13.5px;color:var(--muted);cursor:pointer;min-height:40px;padding:0 8px}.pc-x{font-size:20px;min-width:40px;margin:-8px -8px 0 0}@media (min-width:821px){.pop-card{left:auto;right:24px;bottom:24px}}
.pop-wrap{position:fixed;inset:0;z-index:150;background:rgba(10,20,35,.45);display:grid;place-items:center;padding:16px;animation:pop-in .2s ease-out}.pop{width:min(380px,100%);background:var(--surface-solid);border-radius:20px;padding:22px 20px 16px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.25)}.pop-ic{font-size:40px}.pop b{display:block;font-size:18px;margin-top:6px}.pop p{font-size:14px;line-height:1.6;color:var(--fg2);margin:8px 0 14px}.pop-b{display:flex;gap:8px;justify-content:center}.pop-b button{flex:none;white-space:nowrap;border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:9px 16px;font:inherit;font-weight:700;cursor:pointer}.pop-b .btn-primary{flex:1;width:auto;margin:0;text-decoration:none;justify-content:center}@keyframes pop-in{from{opacity:0}to{opacity:1}}`;

/** G-83: the loading mark — three soft orbs that breathe in turn, used wherever the page waits on data or AI. */
export const ORBS_CSS = `.rj .rj-orb{min-height:0;padding:26px 8px 6px;gap:14px}.rj .rj-orb .orbs{position:relative;width:96px;height:96px;margin:0;border-radius:50%;background:radial-gradient(circle at 50% 42%,#f3f6fc 0%,#e6edf9 52%,rgba(230,237,249,0) 71%);justify-content:center}.rj .rj-orb .orbs canvas{width:76px;height:76px}.rj .rj-orb .orbs::after{content:"";position:absolute;inset:6px;border-radius:50%;border:1.5px solid rgba(19,41,75,.14);animation:rj-ring 2.4s ease-out infinite}@keyframes rj-ring{0%{transform:scale(.86);opacity:.9}100%{transform:scale(1.12);opacity:0}}@media (prefers-reduced-motion:reduce){.rj .rj-orb .orbs::after{animation:none}}
.rj-status{font-size:15.5px;font-weight:700;color:var(--fg);text-align:center;min-height:2.8em;line-height:1.45;max-width:30em;transition:opacity .18s}.rj-status.swap{opacity:0}
.rj .job-steps{position:relative;margin:6px 0 16px}.rj .job-steps::before{content:"";position:absolute;left:12.5%;right:12.5%;top:13px;height:2px;background:var(--line)}.rj .job-steps li{opacity:1;position:relative;color:var(--muted)}.rj .st-dot{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:var(--surface);border:2px solid #d6dde9}.rj .st-dot b{font-size:12px;color:var(--muted)}.rj .st-dot canvas{display:none;width:20px!important;height:20px!important}
.rj .job-steps li.done .st-dot{background:var(--navy,#13294b);border-color:var(--navy,#13294b)}.rj .job-steps li.done .st-dot b{font-size:0}.rj .job-steps li.done .st-dot b::after{content:"✓";font-size:14px;color:#fff}.rj .job-steps li.done .st-l{color:var(--fg2)}
.rj .job-steps li.on .st-dot{border-color:var(--navy,#13294b);box-shadow:0 0 0 4px rgba(107,78,255,.14)}.rj .job-steps li.on .st-dot b{display:none}.rj .job-steps li.on .st-dot canvas{display:block}.rj .job-steps li.on .st-l{color:var(--navy,#13294b);font-weight:800}
.orbs{display:inline-flex;align-items:center;vertical-align:middle;margin-right:6px;width:20px;height:20px;flex:none}.orbs canvas{width:20px;height:20px}.orbs-load{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:110px;padding:20px;color:var(--muted);font-size:13.5px}.orbs-load .orbs{width:64px;height:64px}.deep-loading .deep-lock{display:none}.deep-loader canvas{width:64px;height:64px}.deep-loader{border:1px solid var(--line);border-radius:16px;background:var(--surface);min-height:190px}.deep-loader span{font-weight:700;color:var(--fg)}.deep-loader small{font-size:12px;color:var(--muted)}.rj{width:min(460px,calc(100% - 24px));padding:0;overflow:hidden}.rj-head{padding:16px 18px 12px;border-bottom:1px solid var(--line);align-items:flex-start!important}.rj-head>div{display:flex;flex-direction:column;gap:2px;min-width:0}.rj-k{font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--muted)}.rj-t{font-size:17px;line-height:1.35}.rj-body{padding:16px 18px 18px}.rj-body .orbs-load{min-height:120px;padding:12px 0 6px;color:var(--fg2);font-weight:700}.rj-intro{display:flex;gap:10px;align-items:flex-start}.rj-intro canvas{width:20px;height:20px;flex:none;margin-top:3px}.rj-intro p{margin:4px 0 0;font-size:13.5px;color:var(--fg2);line-height:1.6}.rj-cost{display:grid;gap:6px;margin:14px 0 8px;padding:12px 14px;background:var(--soft);border:1px solid var(--line);border-radius:12px}.rj-cost div{display:flex;justify-content:space-between;gap:10px;font-size:14px}.rj-cost dt{color:var(--muted)}.rj-cost dd{margin:0;font-weight:800;font-variant-numeric:tabular-nums}.rj-note{font-size:12.5px;color:var(--muted);margin:8px 0 0;line-height:1.55}.rj-err{font-size:13px;color:var(--up-strong);background:var(--up-soft);border-radius:10px;padding:8px 10px;margin:10px 0 0}.rj-actions{display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:14px}.rj .btn-ghost{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;font-weight:700;color:var(--fg)}
/* G-197: every pill button is at least 40px tall. :where keeps this at zero specificity, so a page's own button rules (a full-width CTA, its padding) still win. */
:where(a.btn-ghost,a.btn-primary,button.btn-ghost,button.btn-primary){min-height:40px}:where(a.btn-ghost,a.btn-primary){display:inline-flex;align-items:center;justify-content:center;text-decoration:none}.rj-actions button{min-height:44px;justify-content:center;display:inline-flex;align-items:center;gap:6px}.rj-actions canvas{width:18px;height:18px}.rj .job-eta{margin-top:6px}.job-steps{list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:0;margin:4px 0 10px}.job-steps li{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11.5px;color:var(--muted);opacity:.45;text-align:center}.job-steps li canvas{width:20px;height:20px}.job-steps li.done{opacity:.75}.job-steps li.on{opacity:1;color:var(--navy);font-weight:800}.orbs-load canvas{width:64px;height:64px}`;
export const ORBS = '<span class="orbs" aria-hidden="true"><canvas data-orb="working" width="40" height="40"></canvas></span>';

export const LIVE_CSS = `.live-tag{font-size:12px;font-weight:700;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:1px 8px;align-self:center}.live-tag.on{color:var(--good-strong);border-color:#bfe3cb;background:var(--good-soft)}.live-up{animation:live-up 1.2s ease-out}.live-down{animation:live-down 1.2s ease-out}@keyframes live-up{0%{background:rgba(240,68,82,.22)}100%{background:transparent}}@keyframes live-down{0%{background:rgba(49,130,246,.22)}100%{background:transparent}}`;

export const MENU_CSS = `.install-btn{border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:13px;font-weight:700;border-radius:999px;padding:6px 11px;cursor:pointer;white-space:nowrap}.install-btn:hover{background:rgba(255,255,255,.18)}.sm-install{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;margin-top:8px;border:1px solid var(--line-strong);background:var(--soft);border-radius:12px;padding:10px 12px;font:inherit;text-align:left;cursor:pointer;color:var(--fg)}.sm-install small{color:var(--muted);font-size:12px}.ins-pop{position:fixed;inset:0;z-index:90;background:rgba(10,20,40,.45);display:flex;align-items:flex-end;justify-content:center}.ins-pop .ins-card{background:var(--surface-solid);border-radius:18px 18px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom));max-width:480px;width:100%}.ins-pop ol{margin:10px 0 14px;padding-left:20px;line-height:1.7}.ins-pop .btn-primary{width:100%;justify-content:center}\n.top-tabs{display:flex;align-items:center;gap:2px;margin-right:6px}.top-tabs a,.top-tabs button{display:flex;align-items:center;gap:6px;border:0;background:none;color:#dbe4f3;font:inherit;font-size:14px;font-weight:700;padding:8px 11px;border-radius:10px;text-decoration:none;cursor:pointer}.top-tabs svg{width:18px;height:18px}.top-tabs a:hover,.top-tabs button:hover,.top-tabs [aria-current=page]{background:rgba(255,255,255,.12);color:#fff}@media(max-width:820px){.top-tabs{display:none}}
/* G-245: the 나 tab's head (account, install, ops) and the mode rows (sibling pages as one screen, G-189 pill). */
.me-head{display:flex;flex-direction:column;gap:8px;margin:0 0 12px}.me-acct{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:60px;padding:12px 16px;border-radius:14px;background:var(--soft);color:var(--fg);text-decoration:none}.me-acct b{display:block;font-size:16px}.me-acct small{color:var(--muted);font-size:13px;font-weight:600}.me-acct i{font-style:normal;color:var(--muted);font-size:18px}
.me-install{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;border:1px solid var(--line-strong);background:transparent;border-radius:14px;padding:12px 16px;font:inherit;font-weight:700;text-align:left;cursor:pointer;color:var(--fg)}.me-install[hidden]{display:none}.me-install small{color:var(--muted);font-size:12.5px;font-weight:400}#sm-admin:empty{display:none}#sm-admin .sm-title{font-size:12px;font-weight:800;color:var(--muted);margin:6px 2px}#sm-admin a{display:flex;align-items:center;min-height:44px}
.pg-title{display:flex;align-items:center;justify-content:space-between;max-width:1180px;margin:0 auto;padding:22px 24px 4px}.pg-title h1{margin:0;font-size:32px;font-weight:300;letter-spacing:-.035em;line-height:1.15}
.pg-ask{display:none;width:46px;height:46px;border:1px solid var(--glass-line);border-radius:50%;background:var(--surface);color:var(--fg);cursor:pointer;align-items:center;justify-content:center;box-shadow:var(--shadow);backdrop-filter:blur(var(--glass-blur));-webkit-backdrop-filter:blur(var(--glass-blur))}.pg-ask svg{width:22px;height:22px}
/* G-248: the mode row is a segmented track with the chewy white pill (G-189) instead of underlined text. */
.mode-tabs{position:sticky;top:8px;z-index:20;display:flex;gap:2px;width:max-content;max-width:calc(100% - 48px);margin:10px 24px 14px;padding:4px;overflow-x:auto;scrollbar-width:none;border-radius:999px;background:var(--track);backdrop-filter:blur(var(--glass-blur));-webkit-backdrop-filter:blur(var(--glass-blur))}.mode-tabs::-webkit-scrollbar{display:none}
@media (min-width:1228px){.mode-tabs{margin-left:calc(50% - 566px)}}
.mode-tabs>a,.mode-tabs>button{flex:none;display:inline-flex;align-items:center;gap:4px;min-height:38px;padding:0 15px;border:0;border-radius:999px;background:none!important;font:inherit;font-size:14.5px;font-weight:600;color:var(--muted);text-decoration:none;cursor:pointer;white-space:nowrap;transition:color .2s}
.mode-tabs>[aria-current=page],.mode-tabs>[aria-selected=true]{color:var(--fg)}.mode-tabs .muted{display:none}
.mode-tabs>.seg-thumb{background:var(--pill)!important;box-shadow:0 1px 2px rgba(10,22,38,.08),0 6px 16px -8px rgba(10,22,38,.25)!important}
@media (min-width:821px){.mode-tabs{top:72px}}
@media (max-width:820px){body:has(.pg-title) .topbar{display:none}.pg-title{padding:18px 20px 0}.pg-ask{display:inline-flex}.mode-tabs{margin:12px 16px 14px;max-width:calc(100% - 32px)}body:has(.bottom-nav) .chat-fab{display:none!important}}`;

export const MENU_JS = `
  // G-245: the five tabs light up by page (sibling pages light their group's tab), and a mode row moves its pill
  // to the tapped mode before the next page opens, so switching modes feels like one screen.
  (function () {
    var here = location.pathname.split('/').pop() || 'index.html', TAB_OF = ${JSON.stringify(TAB_OF)};
    var mark = function () { var h = location.hash.slice(1); document.querySelectorAll('[data-tab-link]').forEach(function (a) { var k = a.getAttribute('data-tab-link'), on = here === 'index.html' ? k === 'top' : (k === here || TAB_OF[here] === k); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); };
    mark(); window.addEventListener('hashchange', mark);
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('.mode-tabs').forEach(function (bar) { var a = bar.querySelector('[aria-current=page]'); if (a) bar.scrollLeft += a.getBoundingClientRect().left - bar.getBoundingClientRect().left - (bar.clientWidth - a.offsetWidth) / 2; });
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.find-tabs a[href], .mode-tabs a[href]'); if (!a || a.getAttribute('aria-current') === 'page') return;
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;
      var url = a.href; if (url.split('#')[0] === location.href.split('#')[0]) return;
      e.preventDefault();
      [].forEach.call(a.parentNode.children, function (b) { if (b === a) return; b.removeAttribute('aria-current'); if (b.hasAttribute('aria-selected')) b.setAttribute('aria-selected', 'false'); });
      a.setAttribute('aria-current', 'page');
      setTimeout(function () { location.href = url; }, still ? 0 : 260);
    });
  })();`;


/** The home banner's styles (markup and script in alphaPages.ts); here so the shared CSS has no import cycle. */
export const BANNER_CSS = `.bn-slide[hidden]{display:none!important}.banner{position:relative;margin:14px 0 0;padding:0}.bn-slide{position:relative;overflow:hidden;display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto auto 1fr;align-content:center;gap:8px 20px;border-radius:22px;padding:34px 36px 44px;text-decoration:none;color:#fff;min-height:236px;box-sizing:border-box}
.bn-tag{grid-column:1;justify-self:start;font-size:11.5px;font-weight:800;background:rgba(255,255,255,.22);border-radius:6px;padding:3px 8px}.bn-slide b{grid-column:1;font-size:28px;line-height:1.3}.bn-text{grid-column:1;font-size:16px;opacity:.92;line-height:1.55;max-width:640px}
.bn-cta{grid-column:1;justify-self:start;margin-top:6px;font:inherit;font-weight:800;font-size:14px;color:inherit;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:9px 16px;white-space:nowrap;cursor:pointer}.bn-cta:disabled{opacity:.7;cursor:default}
.bn-benefits{grid-column:1/-1}.bn-benefits summary{display:list-item;width:fit-content}.bn-benefits ul{margin:12px 0;padding-left:20px;line-height:1.7;font-size:14px}.bn-benefits p{max-width:640px;font-size:12px;line-height:1.6;opacity:.8}.bn-benefits .bn-cta{margin-top:6px}
.bn-art{grid-column:2;grid-row:1/5;align-self:center;font-size:76px;line-height:1;width:132px;height:132px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 10px rgba(255,255,255,.06)}
.bn-navy{background:linear-gradient(120deg,#4a2fd6,var(--accent))}.bn-teal{background:linear-gradient(120deg,#0d5e5a,#1c8c7d)}.bn-amber{background:linear-gradient(120deg,#8a4b06,#c47a12)}.bn-rose{background:linear-gradient(120deg,#7a1d38,#b23a5a)}
.bn-hanul{background:#000;grid-template-columns:minmax(0,1fr) minmax(160px,32%)}.bn-hanul .bn-logo{grid-column:2;grid-row:1/5;width:100%;height:auto;align-self:center}.bn-hanul .bn-tag{background:#262626;color:#eee}.bn-hanul .bn-cta{background:#fff;color:#111;border-color:#fff}.bn-hanul b{font-size:25px;overflow-wrap:anywhere}.bn-hanul:focus-visible{outline:3px solid #668bc6;outline-offset:3px}
@media(max-width:820px){.bn-slide.bn-hanul{grid-template-columns:minmax(0,1fr);gap:8px;min-height:290px}.bn-hanul .bn-logo{grid-column:1;grid-row:2;width:220px;max-width:80%;justify-self:start}.bn-hanul .bn-text,.bn-hanul .bn-cta{grid-column:1}.bn-hanul b{font-size:21px}}
.bn-dots{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);display:flex;gap:0;padding:0 5px;border-radius:999px;background:rgba(0,0,0,.16)}.bn-dots button{position:relative;width:24px;height:26px;border:0;padding:0;background:none;cursor:pointer}.bn-dots button::before{content:'';position:absolute;left:9px;right:9px;top:10px;height:6px;border-radius:3px;background:rgba(255,255,255,.45);transition:opacity var(--dur-fast)}.bn-dots button[aria-pressed=true]{width:36px}.bn-dots button[aria-pressed=true]::before{background:#fff}.bn-dots.has-thumb>[aria-pressed=true]::before{opacity:0}
.bn-slide.bn-img{display:block;padding:0;min-height:0;background:#02040a;aspect-ratio:4/1}.bn-img picture,.bn-img .bn-pic{display:block;width:100%;height:100%;object-fit:cover}.bn-alt{display:none}.bn-img:focus-visible{outline:3px solid #668bc6;outline-offset:3px}.bn-play{position:absolute;right:16px;bottom:14px;display:inline-flex;align-items:center;gap:6px;padding:7px 12px 7px 10px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);color:#fff;font-size:13px;font-weight:700;backdrop-filter:blur(6px)}
.bn-film{padding:0;border:0;border-radius:18px;background:#000;width:min(420px,92vw);max-height:92vh;overflow:visible}.bn-film::backdrop{background:rgba(0,0,0,.78)}.bn-film video{display:block;width:100%;max-height:92vh;aspect-ratio:9/16;border-radius:18px;background:#000}.bn-film-x{position:absolute;top:-14px;right:-14px;width:40px;height:40px;border-radius:50%;border:0;background:#fff;color:#111;font-size:24px;line-height:1;cursor:pointer;z-index:1}.bn-film-x:focus-visible{outline:3px solid #668bc6;outline-offset:2px}
@media (max-width:820px){.bn-play{right:10px;bottom:30px;font-size:12px;padding:5px 10px 5px 8px}.bn-film-x{top:8px;right:8px;background:rgba(255,255,255,.9)}}
@media (max-width:820px){.bn-slide.bn-img{aspect-ratio:12/7;min-height:0;padding:0}}
@media (max-width:820px){.banner{margin-top:10px}.bn-slide{grid-template-columns:1fr 64px;padding:22px 18px 36px;min-height:210px;gap:6px 10px}.bn-art{width:64px;height:64px;font-size:36px;grid-row:1/3;align-self:start;box-shadow:none}.bn-slide b{font-size:21px}.bn-text{font-size:14.5px;grid-column:1/3}.bn-cta{grid-column:1/3}}`;

