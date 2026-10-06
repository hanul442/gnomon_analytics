import { PERSONA_BAR } from './persona.js';
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

const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/></svg>';
/** A watchlist star; the shared script (UI_SCRIPT) toggles it. `symbol` may be empty and set later by a page script. */
export const starButton = (symbol: string, label: string, id = '') => `<button type="button" class="star"${id ? ` id="${id}"` : ''} data-star="${symbol.replace(/"/g, '')}" aria-pressed="false" aria-label="${label.replace(/[<>"&]/g, '')} 관심 종목">${STAR_SVG}</button>`;

export const UI_CSS = `.deep-lock{display:flex;gap:14px;align-items:flex-start;border:1px dashed var(--accent);background:linear-gradient(180deg,#f5f8fd,#fff)}.dl-ic{font-size:26px;line-height:1}.deep-lock b{font-size:16px}.deep-lock p{margin:4px 0 10px}.dl-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.dl-row .btn-primary{margin:0}
#tab-ai .ai-nav{position:sticky;top:var(--sticky-top,104px);z-index:5;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:8px 2px;margin:0 0 6px;background:var(--bg,#f4f6f9)}#tab-ai .ai-nav::-webkit-scrollbar{display:none}#tab-ai .ai-nav a{flex:none;font-size:13px;font-weight:700;text-decoration:none;color:var(--fg2);background:#fff;border:1px solid var(--line-strong);border-radius:999px;padding:6px 12px}#tab-ai .ai-nav a:hover{border-color:var(--accent);color:var(--accent-strong)}
#tab-ai .card,#tab-ai section.block{scroll-margin-top:150px}#tab-ai section.block{margin-top:22px}#tab-ai .card+.card{margin-top:16px}
#tab-ai .card>.head>h2,#tab-ai .block-head>h2{border-left:4px solid var(--accent);padding-left:10px;font-size:18px}
#tab-ai .claims li,#tab-ai .why-col p,#tab-ai .headline{font-size:15px;line-height:1.75}#tab-ai .claims li{margin-bottom:8px}#tab-ai .why-col{padding:14px 16px}#tab-ai .why-col h3{font-size:15px;margin:0 0 8px}
@media (max-width:820px){#tab-ai .why-grid{display:grid!important;grid-template-columns:minmax(0,1fr)!important;overflow:visible!important;margin-left:0!important;margin-right:0!important;padding:0!important}#tab-ai .why-grid>*{flex:none!important;min-width:0!important;width:auto!important}#tab-ai .ai-nav{top:var(--sticky-top,96px)}}
.sc-prob{display:flex;height:26px;border-radius:9px;overflow:hidden;margin:6px 0 4px;font-size:12px;font-weight:700;color:#fff}.sc-prob span{display:grid;place-items:center;min-width:34px}.sp-bull{background:#d1373d}.sp-base{background:#7b8798}.sp-bear{background:#2a62c9}.sc-pct{font-size:13px;font-weight:800;margin-left:4px;opacity:.85}.sub-sh{display:block;font-size:11px;color:var(--muted);font-weight:400}.h1-row{display:flex;align-items:center;gap:6px}.h1-row h1{margin:0}
.star{width:36px;height:36px;border:0;background:none;cursor:pointer;color:#b8c0cc;display:grid;place-items:center;padding:0}.star svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linejoin:round}.star[aria-pressed=true]{color:#e8a20c}.star[aria-pressed=true] svg{fill:currentColor}

:root{--fs-xs:12px;--fs-sm:13px;--fs-base:15px;--fs-md:17px;--fs-lg:20px;--fs-xl:26px;--sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:32px;--r-sm:8px;--r-md:12px;--r-lg:16px}
.top-links a[aria-current=page]{background:rgba(255,255,255,.16);color:#fff}
.price-bar{display:none;flex:1;min-width:0;align-items:center;gap:10px;color:#fff;font-size:var(--fs-sm);overflow:hidden;white-space:nowrap}
.topbar.scrolled .price-bar{display:flex;animation:pb-in .2s var(--ease-out)}@keyframes pb-in{from{opacity:0;transform:translateY(-4px)}}
.price-bar b{font-size:var(--fs-base)}.price-bar .pb-price{font-weight:800;font-variant-numeric:tabular-nums}.price-bar .pb-code{color:#9fb6dc;font-size:var(--fs-xs)}
.price-bar .up{color:#ff9a9e}.price-bar .down{color:#9fc0f5}.price-bar .fresh{background:rgba(255,255,255,.12);color:#fff}
@media (max-width:820px){.topbar.scrolled .brand div{display:none}}
.tip{display:inline-grid;place-items:center;width:17px;height:17px;margin-left:5px;border-radius:50%;border:1px solid var(--line-strong);background:#fff;color:var(--muted);font:700 11px/1 inherit;cursor:help;vertical-align:1px;padding:0}
.tip:hover,.tip[aria-expanded=true]{border-color:var(--accent);color:var(--accent)}
.tip-pop{position:absolute;z-index:70;max-width:300px;background:#0f1b2d;color:#fff;border-radius:var(--r-md);padding:10px 12px;font-size:var(--fs-sm);line-height:1.55;box-shadow:0 12px 30px rgba(0,0,0,.25)}
.tip-pop b{display:block;margin-bottom:2px;color:#9fc0f5}
.skel{position:relative;overflow:hidden;background:#e9edf3;border-radius:var(--r-sm);color:transparent!important}.skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent);animation:shimmer 1.2s infinite}
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
    var plan = document.documentElement.getAttribute('data-plan') || 'free', LIMIT = { free: 5, plus: 30, pro: 100, alpha: 100, max: 1e9 };
    if (i >= 0) w.splice(i, 1);
    else if (w.length >= (LIMIT[plan] || 5)) { if (window.GNM && GNM.toast) GNM.toast('관심 종목은 ' + (LIMIT[plan] || 5) + '개까지예요. 요금제를 올리면 더 담을 수 있어요.'); return; }
    else w.unshift(sym);
    try { localStorage.setItem(WK, JSON.stringify(w)); localStorage.setItem('gnm-watch-at', String(Date.now())); } catch (x) {}
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
  var G = ${JSON.stringify(GLOSSARY)}, keys = Object.keys(G).sort(function (a, b) { return b.length - a.length; }), used = {};
  var pop = null;
  var close = function () { if (pop) { pop.remove(); pop = null; } document.querySelectorAll('.tip[aria-expanded=true]').forEach(function (t) { t.setAttribute('aria-expanded', 'false'); }); };
  document.querySelectorAll('h2, h3, .pl-k, .label, th, .term-cell, .si-name, .hs-k, .kp-title, .sc-k, .opt-t b').forEach(function (el) {
    if (el.querySelector('.tip') || el.closest('.gate-cta, .tip-pop, .price-bar')) return;
    var text = el.textContent || '', k = keys.find(function (key) { return text.indexOf(key) >= 0; });
    var scope = (el.closest('.panel') || document.body).id || 'page', id = scope + ':' + k;
    if (!k || used[id]) return; used[id] = 1;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'tip'; b.textContent = '?'; b.setAttribute('aria-label', '용어 설명: ' + k); b.setAttribute('aria-expanded', 'false'); b.dataset.term = k;
    el.appendChild(b);
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.tip');
    if (!t) { if (!(e.target.closest && e.target.closest('.tip-pop'))) close(); return; }
    e.preventDefault(); e.stopPropagation();
    var was = t.getAttribute('aria-expanded') === 'true'; close(); if (was) return;
    pop = document.createElement('div'); pop.className = 'tip-pop'; pop.setAttribute('role', 'tooltip');
    pop.innerHTML = '<b></b><span></span>'; pop.firstChild.textContent = t.dataset.term; pop.lastChild.textContent = G[t.dataset.term];
    document.body.appendChild(pop);
    var r = t.getBoundingClientRect(), w = Math.min(300, window.innerWidth - 24);
    pop.style.left = Math.max(12, Math.min(window.scrollX + r.left - 12, window.scrollX + window.innerWidth - w - 12)) + 'px';
    pop.style.top = (window.scrollY + r.bottom + 8) + 'px';
    t.setAttribute('aria-expanded', 'true');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  window.addEventListener('scroll', close, { passive: true });
})();
</script>`;

// The ☰ menu (docs/DESIGN.md §5.20, G-58): every page, all sections in one drawer.
const escM = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
/** Menu groups: [label, href]. Hrefs are relative to the site root. */
export const MENU: readonly { title: string; items: readonly [string, string][] }[] = [
  // The bottom bar's four places sit on top as tiles; everything else is grouped below, once each.
  { title: '찾아보기', items: [['필터로 종목 찾기', 'screener.html'], ['AI 리포트 모음', 'reports.html'], ['ETF', 'etfs.html'], ['코인', 'coins.html']] },
  { title: '알파 테스트', items: [['사용법', 'guide.html'], ['업데이트 기록', 'updates.html'], ['이번 주 설문', 'survey.html?k=weekly']] },
  { title: '고객 지원', items: [['자주 묻는 질문 (FAQ)', 'faq.html'], ['1:1 문의 · Q&A', 'faq.html#ask'], ['HANUL 프로젝트 소개', 'hanul.html']] },
  { title: '계정', items: [['요금제·크레딧', 'pricing.html'], ['이용약관·면책', 'terms.html']] },
];
const QUICK: readonly [string, string, string][] = [
  ['홈', 'index.html#top', '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'],
  ['관심', 'index.html#watch', '<path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/>'],
  ['성적표', 'scorecard.html', '<path d="M5 20V10M10 20V4M15 20v-7M20 20v-11"/>'],
  ['내 계정', 'account.html', '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c1.2-3.6 4-5.2 7-5.2s5.8 1.6 7 5.2"/>'],
];

const MENU_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/** The ☰ button for the top bar and the drawer it opens (assets/ui.js toggles it). */
export function menuHtml(base: string, archiveHref?: string): { button: string; drawer: string } {
  return {
    button: `<button type="button" class="menu-btn" aria-label="전체 메뉴" aria-expanded="false" aria-controls="side-menu">${MENU_ICON}</button>`,
    drawer: `<div class="menu-scrim" hidden></div><nav class="side-menu" id="side-menu" aria-label="전체 메뉴" hidden><div class="sm-head"><b>전체 메뉴</b><button type="button" class="sm-close" aria-label="닫기">×</button></div><div class="sm-quick">${QUICK.map(([l, h, d]) => `<a href="${base}${h}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg><span>${l}</span></a>`).join('')}</div>${archiveHref ? `<div class="sm-group"><div class="sm-title">이 종목</div><a href="${archiveHref}">지난 리포트</a></div>` : ''}<div class="sm-group sm-view" id="sm-view"><div class="sm-title">내 보기 방식</div>${PERSONA_BAR}<p class="sm-hint">고르면 홈의 '오늘 볼 것'과 종목 화면이 바뀌어요.</p><a href="${base}onboarding.html">설문 다시 하기</a></div><div id="sm-admin"></div>${MENU.map((g) => `<div class="sm-group"><div class="sm-title">${escM(g.title)}</div>${g.items.map(([label, href]) => `<a href="${base}${href}">${escM(label)}</a>`).join('')}</div>`).join('')}<p class="sm-foot">계산 결과이고, 투자 권유가 아니에요.</p></nav>`,
  };
}

/**
 * Live prices (G-62): any element with data-live="<code or KRW-coin>" and data-live-f="price | pct |
 * arrowpct | full | tag" follows the market. Stocks and ETFs poll the API's /quote every 10 seconds
 * while the page is visible (every 60 outside trading hours); coins stream from Upbit's public WebSocket.
 * Lists drawn later (the watchlist, 찾기) are picked up on the next tick.
 */
export const LIVE_JS = `
  (function () {
    var G = window.GNM || {}, last = {}, ws = null, wsSet = '', timer = 0;
    var won = function (v) { var a = Math.abs(v); return (a >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: a >= 1 ? 2 : 4 })) + '원'; };
    var sg = function (v) { return (v > 0 ? '+' : '') + v.toFixed(2) + '%'; };
    var paint = function (sym, q) {
      var prev = last[sym]; last[sym] = q;
      document.querySelectorAll('[data-live="' + sym + '"]').forEach(function (el) {
        var f = el.getAttribute('data-live-f'), t = q.changePct > 0 ? 'up' : q.changePct < 0 ? 'down' : '';
        if (f === 'tag') { el.hidden = false; el.textContent = q.open ? '● 실시간' : '장 마감'; el.classList.toggle('on', !!q.open); return; }
        if (f === 'price') el.textContent = won(q.price);
        else if (f === 'pct') el.textContent = (q.changePct > 0 ? '▲ ' : q.changePct < 0 ? '▼ ' : '') + sg(q.changePct);
        else if (f === 'arrowpct') el.textContent = (q.changePct > 0 ? '▲ ' : q.changePct < 0 ? '▼ ' : '') + sg(q.changePct);
        else if (f === 'full') el.textContent = (q.change > 0 ? '▲' : q.change < 0 ? '▼' : '') + ' ' + Math.abs(q.change).toLocaleString('ko-KR', { maximumFractionDigits: 4 }) + ' (' + sg(q.changePct) + ')';
        if (f !== 'price') { el.classList.remove('up', 'down'); if (t) el.classList.add(t); }
        if (prev && prev.price !== q.price) { el.classList.remove('live-up', 'live-down'); void el.offsetWidth; el.classList.add(q.price > prev.price ? 'live-up' : 'live-down'); }
      });
      window.dispatchEvent(new CustomEvent('gnm-quote', { detail: { symbol: sym, quote: q } }));
    };
    var symbols = function () { var s = {}; document.querySelectorAll('[data-live]').forEach(function (el) { s[el.getAttribute('data-live')] = 1; }); return Object.keys(s); };
    var trading = function () { var k = new Date(Date.now() + 9 * 3600e3), d = k.getUTCDay(), m = k.getUTCHours() * 60 + k.getUTCMinutes(); return d > 0 && d < 6 && m >= 535 && m <= 940; };
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
      timer = setTimeout(tick, trading() ? 10000 : 60000);
    };
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    // The chart's last daily candle follows the live price on a report page (stocks and ETFs, open market).
    window.addEventListener('gnm-quote', function (e) {
      var C = window.GNMChart, d = e.detail, bar = document.getElementById('price-bar');
      if (!C || !C.candle || !C.bars || !d.quote.open || !bar || !bar.querySelector('[data-live="' + d.symbol + '"]') || d.symbol.indexOf('KRW-') === 0) return;
      try {
        var today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10), b = C.bars[C.bars.length - 1], px = d.quote.price;
        if (!b || b.date > today) return;
        var same = b.date === today;
        C.candle.update({ time: today, open: same ? b.open : px, high: same ? Math.max(b.high, px) : px, low: same ? Math.min(b.low, px) : px, close: px });
      } catch (x) {}
    });
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
    var STEPS = {
      home: [
        ['#top', '검색', '종목·ETF·코인을 이름, 코드, 초성(ㅅㅅㅈㅈ)으로 찾아요. 아래 필터로 시장과 조건을 골라 자세히 찾을 수 있어요.'],
        ['#banner', '배너', '공지, 크레딧 이벤트, 설문, 사용법이 돌아가며 나와요. 이벤트의 받기를 누르면 크레딧이 바로 들어와요.'],
        ['.ix-row', '시장 한눈에', '코스피·코스닥과 시장 온도예요. 시장 온도는 전 종목의 기술 신호를 모은 거예요.'],
        ['#watch', '관심 종목', '어디서든 ☆를 누르면 여기에 모여요. 가격은 장중에 실시간으로 바뀌어요.'],
        ['#today', '오늘 볼 것', '내 보기 방식(초보·단타·스윙·장기)에 맞춰 오늘 볼 종목 네 개를 골라 이유와 함께 보여 줘요.'],
        ['.menu-btn', '☰ 메뉴', '보기 방식을 바꾸거나 설문, 성적표, 내 계정으로 가요.'],
      ],
      report: [
        ['.chips', '탭', '요약 · 차트 · 기술 · AI 위원회 · 수급 · 실적 · 뉴스·공시. 처음엔 요약만 봐도 충분해요.'],
        ['#home-conclusion', '지금 판단', '위아래 테스트 가격과 그때의 시나리오예요. 가격을 넘거나 깨면 어느 쪽으로 갈지, 확률과 함께 보여 줘요.'],
        ['#home-conclusion .cl-row', '줄을 눌러 보세요', '시나리오가 펼쳐져요. 무엇이 나오면 그렇게 되는지, 언제 틀렸다고 볼지가 나와요. 약세 줄 안에는 최악의 경우가 있어요.'],
        ['#t-ai', 'AI 위원회', '분석가 6명과 데스크 5곳의 표결, 서로 반박하는 토론, 근거 정리가 있어요. 토론에 직접 질문할 수도 있어요.'],
        ['#t-flows', '수급 · 실적 · 뉴스', '외국인·기관 수급, 분기 실적과 밸류, 뉴스와 공시는 각자 탭에 있어요.'],
        ['.chat-fab', 'AI 질문', '어느 화면에서든 이 종목에 대해 물어볼 수 있어요.'],
      ],
    };
    var kind = document.getElementById('tab-ai') ? 'report' : document.getElementById('today') ? 'home' : null;
    if (!kind) return;
    var key = 'gnm-tour-' + kind, forced = /[?&]tour=/.test(location.search), seen = null;
    try { seen = localStorage.getItem(key) || localStorage.getItem('gnm-tour-done'); } catch (e) {}
    if (seen && !forced) return;
    var steps = STEPS[kind].filter(function (s) { var el = document.querySelector(s[0]); return el && el.getClientRects().length; });
    if (!steps.length) return;
    var i = 0, hole, tip;
    var end = function () { try { localStorage.setItem(key, '1'); } catch (e) {} if (hole) hole.remove(); if (tip) tip.remove(); window.removeEventListener('resize', place); };
    var place = function () {
      var el = document.querySelector(steps[i][0]); if (!el) return;
      var r = el.getBoundingClientRect(), pad = 6;
      hole.style.cssText = 'top:' + (r.top - pad) + 'px;left:' + (r.left - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px';
      var below = r.bottom + 180 < innerHeight || r.top < 200;
      tip.style.top = (below ? Math.min(r.bottom + 14, innerHeight - 190) : Math.max(r.top - 14 - tip.offsetHeight, 10)) + 'px';
    };
    var show = function () {
      var s = steps[i], el = document.querySelector(s[0]);
      el.scrollIntoView({ block: 'center' });
      tip.innerHTML = '<div class="tr-n">' + (i + 1) + ' / ' + steps.length + '</div><b>' + s[1] + '</b><p>' + s[2] + '</p><div class="tr-b"><button type="button" data-t="x">그만 보기</button>' + (i ? '<button type="button" data-t="p">이전</button>' : '') + '<button type="button" data-t="n" class="tr-next">' + (i === steps.length - 1 ? '끝' : '다음') + '</button></div>';
      setTimeout(place, 60);
    };
    var start = function () {
      hole = document.createElement('div'); hole.className = 'tr-hole';
      tip = document.createElement('div'); tip.className = 'tr-tip'; tip.setAttribute('role', 'dialog'); tip.setAttribute('aria-label', '사용법 둘러보기');
      document.body.appendChild(hole); document.body.appendChild(tip);
      tip.addEventListener('click', function (e) { var t = e.target.getAttribute && e.target.getAttribute('data-t'); if (!t) return; if (t === 'x') return end(); i += t === 'n' ? 1 : -1; if (i >= steps.length) return end(); show(); });
      window.addEventListener('resize', place); window.addEventListener('scroll', place, { passive: true });
      show();
    };
    setTimeout(start, forced ? 300 : 1200);
  })();`;

export const TOUR_CSS = `.tr-hole{position:fixed;z-index:200;border-radius:14px;box-shadow:0 0 0 9999px rgba(10,20,35,.6);pointer-events:none;transition:all .2s}.tr-tip{position:fixed;z-index:201;left:50%;transform:translateX(-50%);width:min(360px,calc(100vw - 28px));background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 14px 36px rgba(0,0,0,.25)}.tr-tip b{font-size:16px}.tr-tip p{margin:6px 0 10px;font-size:14px;line-height:1.6;color:var(--fg2)}.tr-n{font-size:11.5px;font-weight:700;color:var(--accent-strong)}.tr-b{display:flex;gap:6px;justify-content:flex-end}.tr-b button{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:6px 13px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.tr-b [data-t=x]{margin-right:auto;border:0;color:var(--muted)}.tr-b .tr-next{background:var(--navy);color:#fff;border-color:var(--navy)}`;

/**
 * Survey pop-up (G-75): on home and report pages, once the tour is out of the way. No custom survey yet →
 * ask for the 7-minute one (again three days after "나중에"). Friday to Sunday → this week's 1-minute
 * survey, once per week. Never on the survey pages themselves.
 */
export const SURVEY_POP_JS = `
  (function () {
    if (!document.getElementById('today') && !document.getElementById('tab-ai')) return;
    var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
    var now = Date.now(), k = new Date(now + 9 * 3600e3), day = k.getUTCDay();
    var week = k.getUTCFullYear() + '-' + Math.ceil(((k - Date.UTC(k.getUTCFullYear(), 0, 1)) / 864e5 + new Date(Date.UTC(k.getUTCFullYear(), 0, 1)).getUTCDay() + 1) / 7);
    var pick = null;
    if (!get('gnm-prefs') && Number(get('gnm-pop-onb') || 0) < now) pick = { key: 'gnm-pop-onb', later: now + 3 * 864e5, icon: '📝', title: '7분 맞춤 설문으로 내 화면 만들기', text: '투자 경험과 스타일을 알려 주시면 보기 방식, 오늘 볼 것, 설명 수준이 나에게 맞춰져요.', href: 'onboarding.html', cta: '설문 하기' };
    else if ((day === 5 || day === 6 || day === 0) && get('gnm-pop-week') !== week) pick = { key: 'gnm-pop-week', later: week, icon: '🗓️', title: '이번 주 설문 (1분)', text: '이번 주에 좋았던 것과 불편했던 것 하나씩만 알려 주세요. 다음 주 개선 순서를 정해요.', href: 'survey.html?k=weekly', cta: '1분 설문 하기' };
    if (!pick) return;
    var base = document.body.getAttribute('data-base') || '';
    var open = function () {
      if (document.querySelector('.tr-tip') || document.querySelector('.side-menu:not([hidden])')) return setTimeout(open, 4000);
      var d = document.createElement('div'); d.className = 'pop-wrap'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', pick.title);
      d.innerHTML = '<div class="pop"><div class="pop-ic" aria-hidden="true">' + pick.icon + '</div><b>' + pick.title + '</b><p>' + pick.text + '</p><div class="pop-b"><button type="button" data-p="later">나중에</button><a class="btn-primary" href="' + base + pick.href + '">' + pick.cta + ' ›</a></div></div>';
      var close = function () { set(pick.key, String(pick.later)); d.remove(); };
      d.addEventListener('click', function (e) { if (e.target === d || (e.target.getAttribute && e.target.getAttribute('data-p') === 'later')) close(); });
      d.querySelector('a').addEventListener('click', function () { set(pick.key, String(pick.later)); });
      document.body.appendChild(d);
    };
    setTimeout(open, 6000);
  })();`;

export const POP_CSS = `.pop-wrap{position:fixed;inset:0;z-index:150;background:rgba(10,20,35,.45);display:grid;place-items:center;padding:16px;animation:pop-in .2s ease-out}.pop{width:min(380px,100%);background:#fff;border-radius:20px;padding:22px 20px 16px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.25)}.pop-ic{font-size:40px}.pop b{display:block;font-size:18px;margin-top:6px}.pop p{font-size:14px;line-height:1.6;color:var(--fg2);margin:8px 0 14px}.pop-b{display:flex;gap:8px;justify-content:center}.pop-b button{flex:none;white-space:nowrap;border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:9px 16px;font:inherit;font-weight:700;cursor:pointer}.pop-b .btn-primary{flex:1;width:auto;margin:0;text-decoration:none;justify-content:center}@keyframes pop-in{from{opacity:0}to{opacity:1}}`;

/** G-83: the loading mark — three soft orbs that breathe in turn, used wherever the page waits on data or AI. */
export const ORBS_CSS = `.orbs{display:inline-flex;align-items:center;vertical-align:middle;margin-right:6px;width:20px;height:20px;flex:none}.orbs canvas{width:20px;height:20px}.orbs-load{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:110px;padding:20px;color:var(--muted);font-size:13.5px}.orbs-load .orbs{width:64px;height:64px}.orbs-load canvas{width:64px;height:64px}`;
export const ORBS = '<span class="orbs" aria-hidden="true"><canvas data-orb="working" width="40" height="40"></canvas></span>';

export const LIVE_CSS = `.live-tag{font-size:12px;font-weight:700;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:1px 8px;align-self:center}.live-tag.on{color:#1d6b3a;border-color:#bfe3cb;background:#effaf2}.live-up{animation:live-up 1.2s ease-out}.live-down{animation:live-down 1.2s ease-out}@keyframes live-up{0%{background:rgba(209,55,61,.22)}100%{background:transparent}}@keyframes live-down{0%{background:rgba(42,98,201,.22)}100%{background:transparent}}`;

export const MENU_CSS = `.menu-btn{width:38px;height:38px;border:0;border-radius:10px;background:none;color:#fff;cursor:pointer;display:grid;place-items:center;margin-left:2px}.menu-btn svg{width:22px;height:22px}.menu-btn:hover{background:rgba(255,255,255,.1)}
.menu-scrim{position:fixed;inset:0;background:rgba(10,20,35,.42);z-index:90}.side-menu{position:fixed;top:0;right:0;bottom:0;width:min(300px,86vw);background:#fff;z-index:91;overflow-y:auto;padding:14px 16px 24px;box-shadow:-12px 0 32px rgba(10,20,35,.18);animation:sm-in .18s ease-out}
@keyframes sm-in{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}.sm-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.sm-head b{font-size:17px}.sm-close{border:0;background:none;font-size:26px;line-height:1;cursor:pointer;color:var(--muted);width:38px;height:38px}
.sm-group{border-top:1px solid var(--line);padding:10px 0 6px}.sm-title{font-size:12px;font-weight:700;color:var(--muted);margin-bottom:2px}.side-menu a{display:block;padding:10px 6px;border-radius:10px;text-decoration:none;color:var(--fg);font-weight:600;font-size:15px}.side-menu a:hover,.side-menu a[aria-current=page]{background:#eef3fb;color:var(--accent-strong)}.sm-foot{font-size:12px;color:var(--muted);margin-top:12px}.sm-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:4px 0 10px}.side-menu .sm-quick a{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 2px;border:1px solid var(--line);border-radius:12px;font-size:13px}.sm-quick svg{width:22px;height:22px}
html.menu-open{overflow:hidden}.sm-view .persona-bar{margin:6px 0 4px}.sm-view .persona-bar .lbl{display:none}.sm-hint{font-size:12px;color:var(--muted);margin:4px 2px}`;

export const MENU_JS = `
  // The ☰ menu: opens the drawer, closes on the scrim, the × button, Escape or a link.
  (function () {
    var btn = document.querySelector('.menu-btn'), nav = document.getElementById('side-menu'), scrim = document.querySelector('.menu-scrim');
    if (!btn || !nav) return;
    var here = location.pathname.split('/').pop() || 'index.html';
    nav.querySelectorAll('a').forEach(function (a) { if (a.getAttribute('href').split('/').pop().split('#')[0] === here && here !== 'index.html') a.setAttribute('aria-current', 'page'); });
    var set = function (open) { nav.hidden = !open; scrim.hidden = !open; btn.setAttribute('aria-expanded', String(open)); document.documentElement.classList.toggle('menu-open', open); if (open) nav.querySelector('a').focus(); };
    btn.addEventListener('click', function () { set(nav.hidden); });
    scrim.addEventListener('click', function () { set(false); });
    nav.querySelector('.sm-close').addEventListener('click', function () { set(false); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !nav.hidden) { set(false); btn.focus(); } });
  })();`;


/** The home banner's styles (markup and script in alphaPages.ts); here so the shared CSS has no import cycle. */
export const BANNER_CSS = `.bn-slide[hidden]{display:none!important}.banner{position:relative;margin:14px 0 0;padding:0}.bn-slide{position:relative;overflow:hidden;display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto auto 1fr;align-content:center;gap:8px 20px;border-radius:22px;padding:34px 36px 44px;text-decoration:none;color:#fff;min-height:236px;box-sizing:border-box}
.bn-tag{grid-column:1;justify-self:start;font-size:11.5px;font-weight:800;background:rgba(255,255,255,.22);border-radius:6px;padding:3px 8px}.bn-slide b{grid-column:1;font-size:28px;line-height:1.3}.bn-text{grid-column:1;font-size:16px;opacity:.92;line-height:1.55;max-width:640px}
.bn-cta{grid-column:1;justify-self:start;margin-top:6px;font:inherit;font-weight:800;font-size:14px;color:inherit;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:9px 16px;white-space:nowrap;cursor:pointer}.bn-cta:disabled{opacity:.7;cursor:default}
.bn-benefits{grid-column:1/-1}.bn-benefits summary{display:list-item;width:fit-content}.bn-benefits ul{margin:12px 0;padding-left:20px;line-height:1.7;font-size:14px}.bn-benefits p{max-width:640px;font-size:12px;line-height:1.6;opacity:.8}.bn-benefits .bn-cta{margin-top:6px}
.bn-art{grid-column:2;grid-row:1/5;align-self:center;font-size:76px;line-height:1;width:132px;height:132px;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 10px rgba(255,255,255,.06)}
.bn-navy{background:linear-gradient(120deg,#13294b,#2a4f8f)}.bn-teal{background:linear-gradient(120deg,#0d5e5a,#1c8c7d)}.bn-amber{background:linear-gradient(120deg,#8a4b06,#c47a12)}.bn-rose{background:linear-gradient(120deg,#7a1d38,#b23a5a)}
.bn-hanul{background:#000;grid-template-columns:minmax(0,1fr) minmax(160px,32%)}.bn-hanul .bn-logo{grid-column:2;grid-row:1/5;width:100%;height:auto;align-self:center}.bn-hanul .bn-tag{background:#262626;color:#eee}.bn-hanul .bn-cta{background:#fff;color:#111;border-color:#fff}.bn-hanul b{font-size:25px;overflow-wrap:anywhere}.bn-hanul:focus-visible{outline:3px solid #668bc6;outline-offset:3px}
@media(max-width:820px){.bn-slide.bn-hanul{grid-template-columns:minmax(0,1fr);gap:8px;min-height:290px}.bn-hanul .bn-logo{grid-column:1;grid-row:2;width:220px;max-width:80%;justify-self:start}.bn-hanul .bn-text,.bn-hanul .bn-cta{grid-column:1}.bn-hanul b{font-size:21px}}
.bn-dots{position:absolute;left:0;right:0;bottom:10px;display:flex;justify-content:center;gap:6px}.bn-dots button{width:7px;height:7px;border-radius:50%;border:0;padding:0;background:rgba(255,255,255,.45);cursor:pointer}.bn-dots button[aria-pressed=true]{background:#fff;width:18px;border-radius:4px}
@media (max-width:820px){.banner{margin-top:10px}.bn-slide{grid-template-columns:1fr 64px;padding:22px 18px 36px;min-height:210px;gap:6px 10px}.bn-art{width:64px;height:64px;font-size:36px;grid-row:1/3;align-self:start;box-shadow:none}.bn-slide b{font-size:21px}.bn-text{font-size:14.5px;grid-column:1/3}.bn-cta{grid-column:1/3}}`;

