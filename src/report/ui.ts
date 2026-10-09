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
.tip{display:inline-grid;place-items:center;width:17px;height:17px;margin-left:5px;border-radius:50%;border:1px solid var(--line-strong);background:#fff;color:var(--muted);font:700 11px/1 inherit;cursor:help;vertical-align:1px;padding:0;position:relative}.tip::after{content:"";position:absolute;inset:-8px}
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
export const MENU: readonly { title: string; items: readonly [string, string, string][] }[] = [
  // G-138: grouped by what people come for, each item a tile with an icon: the market, finding and AI,
  // their own things, then help and the account.
  { title: '시장', items: [['📊', '시장 데일리', 'market-reports.html'], ['🧭', '테마별 종목', 'themes.html'], ['📡', '공시 레이더', 'signals.html'], ['🗽', '미국 주식', 'screener.html#us'], ['🧺', 'ETF', 'etfs.html'], ['🪙', '코인', 'coins.html']] },
  { title: '찾기·AI 리포트', items: [['🔎', '자세히 검색', 'screener.html'], ['🗂️', 'AI 리포트 모음', 'reports.html'], ['🆕', '오늘 나온 리포트', 'reports.html#today'], ['🎯', '성적표', 'scorecard.html']] },
  { title: '내 것', items: [['⭐', '관심 종목', 'watch.html'], ['🔔', '알림함', 'inbox.html'], ['📄', '내 리포트', 'myreports.html'], ['💬', '내 토론 기록', 'mydebates.html'], ['⚙️', '알림 설정', 'alerts.html']] },
  { title: '도움말', items: [['📘', '사용법', 'guide.html'], ['❓', 'FAQ', 'faq.html'], ['✉️', '1:1 문의', 'faq.html#ask'], ['✨', '업데이트 기록', 'updates.html'], ['📝', '이번 주 설문', 'survey.html?k=weekly']] },
  { title: '계정', items: [['💳', '요금제·크레딧', 'pricing.html'], ['📜', '이용약관·면책', 'terms.html'], ['🏢', 'HANUL 소개', 'hanul.html']] },
];
/** The app's tabs (G-95): the bottom bar on phones, the same links in the top bar on wide screens. 전체 opens the sheet. */
export const TABS: readonly [string, string, string][] = [
  ['홈', 'index.html#top', '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'],
  ['찾기', 'screener.html', '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'],
  ['관심', 'watch.html', '<path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/>'],
  ['리포트', 'reports.html', '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>'],
];
const ALL_ICON = '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>';
const svgI = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
/** One tab bar; `where` = 'top' (wide screens, in the header) or 'bottom' (phones). */
export function tabBar(base: string, where: 'top' | 'bottom'): string {
  return `<nav class="${where === 'top' ? 'top-tabs' : 'bottom-nav'}" aria-label="${where === 'top' ? '주 메뉴' : '빠른 이동'}">${TABS.map(([l, h, d]) => `<a href="${base}${h}" data-tab-link="${h.split('#')[1] ?? h}">${svgI(d)}<span>${l}</span></a>`).join('')}<button type="button" class="nav-all" data-all-menu aria-haspopup="dialog" aria-expanded="false" aria-controls="side-menu">${svgI(ALL_ICON)}<span>전체</span></button></nav>`;
}


/** The ☰ button for the top bar and the drawer it opens (assets/ui.js toggles it). */
export function menuHtml(base: string, archiveHref?: string): { button: string; drawer: string } {
  return {
    button: tabBar(base, 'top'),
    drawer: `<div class="menu-scrim" hidden></div><nav class="side-menu" id="side-menu" aria-label="전체 메뉴" hidden><div class="sm-head"><b>전체</b><button type="button" class="sm-close" aria-label="닫기">×</button></div><div class="sm-group sm-acct"><a href="${base}pricing.html" data-acct-tab="1"><b>내 계정</b><small><span data-plan-name>무료</span> · <span data-credits>0</span> 크레딧</small></a><button type="button" class="sm-install" data-install hidden><b>📲 그노몬 앱 설치</b><small>한 번 누르면 홈 화면에 앱으로 생겨요</small></button></div>${archiveHref ? `<div class="sm-group"><div class="sm-title">이 종목</div><a href="${archiveHref}">지난 리포트</a></div>` : ''}<div class="sm-group sm-view" id="sm-view"><div class="sm-title">내 보기 방식</div>${PERSONA_BAR}<p class="sm-hint">고르면 홈의 '오늘 볼 것'과 종목 화면이 바뀌어요.</p><a href="${base}onboarding.html">설문 다시 하기</a></div><div id="sm-admin"></div>${MENU.map((g) => `<div class="sm-group"><div class="sm-title">${escM(g.title)}</div><div class="sm-grid">${g.items.map(([icon, label, href]) => `<a class="sm-tile" href="${base}${href}"><span class="sm-ic" aria-hidden="true">${icon}</span><span>${escM(label)}</span></a>`).join('')}</div></div>`).join('')}<p class="sm-foot">계산 결과이고, 투자 권유가 아니에요.</p></nav>`,
  };
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
dialog.v2-dialog>header{position:sticky;top:0;z-index:3;background:#fff;margin:0 -16px 10px!important;padding:14px 16px 12px!important;border-bottom:1px solid var(--line)}
dialog.v2-dialog.rj>header{margin:0!important}
.flt-pop{padding:0!important;place-items:stretch!important}.flt-sheet{width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important}
.sheet{align-items:stretch!important}.sheet-body{width:100%!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;padding-top:0!important}.sheet-head{top:0!important;margin:0 -18px 8px!important;padding:14px 18px 12px!important;border-bottom:1px solid var(--line)}
.chat{inset:0!important;left:0!important;right:0!important;top:0!important;bottom:0!important;width:100%!important;max-width:100%!important;height:100dvh!important;border-radius:0!important}
.side-menu{top:0!important;max-height:none!important;height:100dvh;border-radius:0!important;animation:sm-in .18s ease-out}
dialog.v2-dialog>header>.dialog-x,dialog.v2-dialog .rj-head .dialog-x,.flt-top .flt-x,.chat-head .chat-x,.sm-head .sm-close{order:-1;font-size:0!important;width:36px;height:36px;margin:-6px 4px -6px -8px;display:inline-flex;align-items:center;justify-content:center;border:0;background:none;color:var(--fg)}
dialog.v2-dialog>header>.dialog-x::before,dialog.v2-dialog .rj-head .dialog-x::before,.flt-top .flt-x::before,.chat-head .chat-x::before,.sm-head .sm-close::before{content:"‹";font-size:34px;line-height:1;font-weight:300;margin-top:-4px}
dialog.v2-dialog>header,.flt-top,.sm-head{justify-content:flex-start!important;gap:4px!important}.chat-head{gap:6px}.chat-head .chat-x{color:#fff!important}
.ins-pop{align-items:stretch!important}.ins-pop .ins-card{border-radius:0!important;max-width:none!important;display:flex;flex-direction:column;justify-content:center}
.pop-wrap{padding:0!important;place-items:stretch!important}.pop-wrap .pop{width:100%!important;border-radius:0!important;display:flex;flex-direction:column;justify-content:center;align-items:center}
}
@media (min-width:821px){
dialog.v2-dialog[open]{width:min(640px,calc(100% - 48px))!important;height:fit-content!important;max-height:calc(100dvh - 48px)!important}dialog.v2-dialog.rj[open]{width:min(520px,calc(100% - 48px))!important}
dialog.v2-dialog>header{position:sticky;top:-20px;z-index:3;background:#fff;padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:10px}
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
      ['.side-menu:not([hidden])', function (e) { var x = e.querySelector('.sm-close'); if (x) x.click(); }],
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
      document.querySelectorAll('[data-live="' + sym + '"]').forEach(function (el) {
        var f = el.getAttribute('data-live-f'), t = q.changePct > 0 ? 'up' : q.changePct < 0 ? 'down' : '';
        if (f === 'nowlabel') { el.textContent = q.open ? '지금' : '현재가'; return; }
        // The time of the last trade, so the reader sees how fresh the number is (G-128).
        var hm = q.at ? String(q.at).replace(/^.*T(\\d\\d:\\d\\d(:\\d\\d)?).*$/, '$1') : '';
        if (f === 'tag') { el.hidden = false; el.textContent = q.open ? (q.session === 'pre' ? (isUs(sym) ? '● 프리마켓' : '● NXT 프리마켓') : q.session === 'after' ? (isUs(sym) ? '● 애프터마켓' : '● NXT 애프터마켓') : '● 실시간') + (hm && hm.length <= 8 ? ' ' + hm : '') : '장 마감'; el.classList.toggle('on', !!q.open); return; }
        if (f === 'price') el.textContent = won(q.price, sym);
        else if (f === 'pct') el.textContent = (q.changePct > 0 ? '▲ ' : q.changePct < 0 ? '▼ ' : '') + sg(q.changePct);
        else if (f === 'arrowpct') el.textContent = (q.changePct > 0 ? '▲ ' : q.changePct < 0 ? '▼ ' : '') + sg(q.changePct);
        else if (f === 'full') el.textContent = (q.change > 0 ? '▲' : q.change < 0 ? '▼' : '') + ' ' + Math.abs(q.change).toLocaleString('ko-KR', { maximumFractionDigits: 4 }) + ' (' + sg(q.changePct) + ')';
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
      home: [
        ['#top', '검색', '종목·ETF·코인을 이름, 코드, 초성(ㅅㅅㅈㅈ)으로 찾아요. 아래 필터로 시장과 조건을 골라 자세히 찾을 수 있어요.'],
        ['#banner', '배너', '공지, 크레딧 이벤트, 설문, 사용법이 돌아가며 나와요. 이벤트의 받기를 누르면 크레딧이 바로 들어와요.'],
        ['.ix-row', '시장 한눈에', '코스피·코스닥과 시장 온도예요. 시장 온도는 전 종목의 기술 신호를 모은 거예요.'],
        ['#watch', '관심 종목', '어디서든 ☆를 누르면 여기에 모여요. 가격은 장중에 실시간으로 바뀌어요.'],
        ['#today', '오늘 볼 것', '내 보기 방식(초보·단타·스윙·장기)에 맞춰 오늘 볼 종목 네 개를 골라 이유와 함께 보여 줘요.'],
        ['.bottom-nav', '아래 탭', '홈 · 찾기 · 관심 · 리포트, 그리고 전체에서 시장·내 것·도움말·계정 메뉴로 가요.'],
        ['.top-tabs', '위쪽 탭', '홈 · 찾기 · 관심 · 리포트, 그리고 전체에서 시장·내 것·도움말·계정 메뉴로 가요.'],
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
        ['#search', '종목 검색', '이름·코드·초성으로 종목을 찾아요.'],
        ['.find-tabs', '시장 선택', '주식·ETF·코인을 선택하세요. 시장별로 지원되는 조건이 달라요.'],
        ['#sc-filter-open', '필터 · AI 조건', '필터를 누르면 AI 조건(원하는 특징을 문장으로)과 직접 조건을 정하는 화면이 열려요. 결과 보기로 돌아와요.'],
        ['#ai-build', 'AI 조건', '원하는 특징을 문장으로 적고 ✦를 누르세요. 실제 생성 대기에는 Thinking Orbs가 표시돼요.'],
        ['#sc-form', '검토·적용·저장', 'AI 제안을 검토해 적용한 뒤 조건을 직접 수정하고 저장하세요. 완료 안내가 나와야 저장된 상태예요. 오류면 다시 확인하세요.'],
      ],
    };
    var kind = document.getElementById('tab-ai') ? 'report' : document.getElementById('today') ? 'home' : document.getElementById('ai-build') ? 'find' : null;
    if (!kind) return;
    var key = 'gnm-tour-v243-' + kind, forced = /[?&]tour=/.test(location.search), seen = null;
    try { seen = localStorage.getItem(key) || localStorage.getItem('gnm-tour-' + kind) || localStorage.getItem('gnm-tour-done'); } catch (e) {}
    if (seen && !forced) return;
    var steps = STEPS[kind].filter(function (s) { var el = document.querySelector(s[0]); return el && (s[3] || el.getClientRects().length); });
    if (!steps.length) return;
    var i = 0, hole, tip, focusBefore = document.activeElement, originalTab = document.querySelector('.chips [aria-selected=true]');
    var end = function () { try { localStorage.setItem(key, '1'); } catch (e) {} if (hole) hole.remove(); if (tip) tip.remove(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place); window.removeEventListener('keydown', escapeTour); if (originalTab) { if (window.GNM_showTab) window.GNM_showTab(originalTab.getAttribute('aria-controls').replace('tab-','')); else originalTab.click(); } if (focusBefore && focusBefore.isConnected) focusBefore.focus({preventScroll:true}); };
    var escapeTour = function(e){if(e.key === 'Escape') end();};
    var place = function () {
      var el = document.querySelector(steps[i][0]); if (!el) return;
      var r = el.getBoundingClientRect(), pad = 6;
      hole.style.cssText = 'top:' + (r.top - pad) + 'px;left:' + (r.left - pad) + 'px;width:' + (r.width + pad * 2) + 'px;height:' + (r.height + pad * 2) + 'px';
      var below = r.bottom + 180 < innerHeight || r.top < 200;
      tip.style.top = (below ? Math.min(r.bottom + 14, innerHeight - 190) : Math.max(r.top - 14 - tip.offsetHeight, 10)) + 'px';
    };
    var show = function () {
      var s = steps[i]; if (s[3]) { if (window.GNM_showTab) window.GNM_showTab(s[3]); else { var tab = document.getElementById('t-' + s[3]); if (tab) tab.click(); } } var el = document.querySelector(s[0]);
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

export const TOUR_CSS = `.tr-hole{position:fixed;z-index:200;border-radius:14px;box-shadow:0 0 0 9999px rgba(10,20,35,.6);pointer-events:none;transition:all .2s}.tr-tip{position:fixed;z-index:201;left:50%;transform:translateX(-50%);width:min(360px,calc(100vw - 28px));background:#fff;border-radius:16px;padding:14px 16px;box-shadow:0 14px 36px rgba(0,0,0,.25)}.tr-tip b{font-size:16px}.tr-tip p{margin:6px 0 10px;font-size:14px;line-height:1.6;color:var(--fg2)}.tr-n{font-size:11.5px;font-weight:700;color:var(--accent-strong)}.tr-b{display:flex;gap:6px;justify-content:flex-end}.tr-b button{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:6px 13px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.tr-b [data-t=x]{margin-right:auto;border:0;color:var(--muted)}.tr-b .tr-next{background:var(--navy);color:#fff;border-color:var(--navy)}`;

/**
 * Survey card (G-75, G-154): on home only, for signed-in readers, once the tour is out of the way. A small card at
 * the bottom that covers nothing (it used to be a full-screen pop-up on every report page, even logged out). No custom survey yet →
 * ask for the 7-minute one (again three days after "나중에"). Friday to Sunday → this week's 1-minute
 * survey, once per week. Never on the survey pages themselves.
 */
export const SURVEY_POP_JS = `
  (function () {
    var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
    if (!document.getElementById('today') || !get('gnm-session')) return;
    var now = Date.now(), k = new Date(now + 9 * 3600e3), day = k.getUTCDay();
    var week = k.getUTCFullYear() + '-' + Math.ceil(((k - Date.UTC(k.getUTCFullYear(), 0, 1)) / 864e5 + new Date(Date.UTC(k.getUTCFullYear(), 0, 1)).getUTCDay() + 1) / 7);
    var pick = null;
    if (!get('gnm-prefs') && Number(get('gnm-pop-onb') || 0) < now) pick = { key: 'gnm-pop-onb', later: now + 3 * 864e5, icon: '📝', title: '7분 맞춤 설문으로 내 화면 만들기', text: '투자 경험과 스타일을 알려 주시면 보기 방식, 오늘 볼 것, 설명 수준이 나에게 맞춰져요.', href: 'onboarding.html', cta: '설문 하기' };
    else if ((day === 5 || day === 6 || day === 0) && get('gnm-pop-week') !== week) pick = { key: 'gnm-pop-week', later: week, icon: '🗓️', title: '이번 주 설문 (1분)', text: '이번 주에 좋았던 것과 불편했던 것 하나씩만 알려 주세요. 다음 주 개선 순서를 정해요.', href: 'survey.html?k=weekly', cta: '1분 설문 하기' };
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

export const POP_CSS = `.pop-card{position:fixed;left:12px;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:120;max-width:440px;margin:0 auto;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:start;background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 10px 30px rgba(10,20,35,.18);padding:14px;animation:pop-in .2s ease-out}.pc-ic{font-size:22px;line-height:1}.pc-tx b{display:block;font-size:15px}.pc-tx p{margin:4px 0 10px;font-size:13px;line-height:1.55;color:var(--fg2)}.pc-b{display:flex;gap:8px;align-items:center}.pc-b .btn-primary{margin:0;padding:9px 14px;font-size:14px}.pc-b button,.pc-x{border:0;background:none;font:inherit;font-size:13.5px;color:var(--muted);cursor:pointer;min-height:40px;padding:0 8px}.pc-x{font-size:20px;min-width:40px;margin:-8px -8px 0 0}@media (min-width:821px){.pop-card{left:auto;right:24px;bottom:24px}}
.pop-wrap{position:fixed;inset:0;z-index:150;background:rgba(10,20,35,.45);display:grid;place-items:center;padding:16px;animation:pop-in .2s ease-out}.pop{width:min(380px,100%);background:#fff;border-radius:20px;padding:22px 20px 16px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.25)}.pop-ic{font-size:40px}.pop b{display:block;font-size:18px;margin-top:6px}.pop p{font-size:14px;line-height:1.6;color:var(--fg2);margin:8px 0 14px}.pop-b{display:flex;gap:8px;justify-content:center}.pop-b button{flex:none;white-space:nowrap;border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:9px 16px;font:inherit;font-weight:700;cursor:pointer}.pop-b .btn-primary{flex:1;width:auto;margin:0;text-decoration:none;justify-content:center}@keyframes pop-in{from{opacity:0}to{opacity:1}}`;

/** G-83: the loading mark — three soft orbs that breathe in turn, used wherever the page waits on data or AI. */
export const ORBS_CSS = `.rj .rj-orb{min-height:0;padding:26px 8px 6px;gap:14px}.rj .rj-orb .orbs{position:relative;width:96px;height:96px;margin:0;border-radius:50%;background:radial-gradient(circle at 50% 42%,#f3f6fc 0%,#e6edf9 52%,rgba(230,237,249,0) 71%);justify-content:center}.rj .rj-orb .orbs canvas{width:76px;height:76px}.rj .rj-orb .orbs::after{content:"";position:absolute;inset:6px;border-radius:50%;border:1.5px solid rgba(19,41,75,.14);animation:rj-ring 2.4s ease-out infinite}@keyframes rj-ring{0%{transform:scale(.86);opacity:.9}100%{transform:scale(1.12);opacity:0}}@media (prefers-reduced-motion:reduce){.rj .rj-orb .orbs::after{animation:none}}
.rj-status{font-size:15.5px;font-weight:700;color:var(--fg);text-align:center;min-height:2.8em;line-height:1.45;max-width:30em;transition:opacity .18s}.rj-status.swap{opacity:0}
.rj .job-steps{position:relative;margin:6px 0 16px}.rj .job-steps::before{content:"";position:absolute;left:12.5%;right:12.5%;top:13px;height:2px;background:#e3e8f1}.rj .job-steps li{opacity:1;position:relative;color:var(--muted)}.rj .st-dot{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#fff;border:2px solid #d6dde9}.rj .st-dot b{font-size:12px;color:var(--muted)}.rj .st-dot canvas{display:none;width:20px!important;height:20px!important}
.rj .job-steps li.done .st-dot{background:var(--navy,#13294b);border-color:var(--navy,#13294b)}.rj .job-steps li.done .st-dot b{font-size:0}.rj .job-steps li.done .st-dot b::after{content:"✓";font-size:14px;color:#fff}.rj .job-steps li.done .st-l{color:var(--fg2)}
.rj .job-steps li.on .st-dot{border-color:var(--navy,#13294b);box-shadow:0 0 0 4px rgba(19,41,75,.08)}.rj .job-steps li.on .st-dot b{display:none}.rj .job-steps li.on .st-dot canvas{display:block}.rj .job-steps li.on .st-l{color:var(--navy,#13294b);font-weight:800}
.orbs{display:inline-flex;align-items:center;vertical-align:middle;margin-right:6px;width:20px;height:20px;flex:none}.orbs canvas{width:20px;height:20px}.orbs-load{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:110px;padding:20px;color:var(--muted);font-size:13.5px}.orbs-load .orbs{width:64px;height:64px}.deep-loading .deep-lock{display:none}.deep-loader canvas{width:64px;height:64px}.deep-loader{border:1px solid var(--line);border-radius:16px;background:#fff;min-height:190px}.deep-loader span{font-weight:700;color:var(--fg)}.deep-loader small{font-size:12px;color:var(--muted)}.rj{width:min(460px,calc(100% - 24px));padding:0;overflow:hidden}.rj-head{padding:16px 18px 12px;border-bottom:1px solid var(--line);align-items:flex-start!important}.rj-head>div{display:flex;flex-direction:column;gap:2px;min-width:0}.rj-k{font-size:11px;font-weight:800;letter-spacing:.06em;color:var(--muted)}.rj-t{font-size:17px;line-height:1.35}.rj-body{padding:16px 18px 18px}.rj-body .orbs-load{min-height:120px;padding:12px 0 6px;color:var(--fg2);font-weight:700}.rj-intro{display:flex;gap:10px;align-items:flex-start}.rj-intro canvas{width:20px;height:20px;flex:none;margin-top:3px}.rj-intro p{margin:4px 0 0;font-size:13.5px;color:var(--fg2);line-height:1.6}.rj-cost{display:grid;gap:6px;margin:14px 0 8px;padding:12px 14px;background:var(--soft);border:1px solid var(--line);border-radius:12px}.rj-cost div{display:flex;justify-content:space-between;gap:10px;font-size:14px}.rj-cost dt{color:var(--muted)}.rj-cost dd{margin:0;font-weight:800;font-variant-numeric:tabular-nums}.rj-note{font-size:12.5px;color:var(--muted);margin:8px 0 0;line-height:1.55}.rj-err{font-size:13px;color:#b4232b;background:#fdecec;border-radius:10px;padding:8px 10px;margin:10px 0 0}.rj-actions{display:grid;grid-template-columns:1fr 2fr;gap:8px;margin-top:14px}.rj .btn-ghost{border:1px solid var(--line-strong);background:#fff;border-radius:999px;font-weight:700;color:var(--fg)}.rj-actions button{min-height:44px;justify-content:center;display:inline-flex;align-items:center;gap:6px}.rj-actions canvas{width:18px;height:18px}.rj .job-eta{margin-top:6px}.job-steps{list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;padding:0;margin:4px 0 10px}.job-steps li{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11.5px;color:var(--muted);opacity:.45;text-align:center}.job-steps li canvas{width:20px;height:20px}.job-steps li.done{opacity:.75}.job-steps li.on{opacity:1;color:var(--navy);font-weight:800}.orbs-load canvas{width:64px;height:64px}`;
export const ORBS = '<span class="orbs" aria-hidden="true"><canvas data-orb="working" width="40" height="40"></canvas></span>';

export const LIVE_CSS = `.live-tag{font-size:12px;font-weight:700;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:1px 8px;align-self:center}.live-tag.on{color:#1d6b3a;border-color:#bfe3cb;background:#effaf2}.live-up{animation:live-up 1.2s ease-out}.live-down{animation:live-down 1.2s ease-out}@keyframes live-up{0%{background:rgba(209,55,61,.22)}100%{background:transparent}}@keyframes live-down{0%{background:rgba(42,98,201,.22)}100%{background:transparent}}`;

export const MENU_CSS = `.install-btn{border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:13px;font-weight:700;border-radius:999px;padding:6px 11px;cursor:pointer;white-space:nowrap}.install-btn:hover{background:rgba(255,255,255,.18)}.sm-install{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;margin-top:8px;border:1px solid var(--line-strong);background:#f4f7fc;border-radius:12px;padding:10px 12px;font:inherit;text-align:left;cursor:pointer;color:var(--fg)}.sm-install small{color:var(--muted);font-size:12px}.ins-pop{position:fixed;inset:0;z-index:90;background:rgba(10,20,40,.45);display:flex;align-items:flex-end;justify-content:center}.ins-pop .ins-card{background:#fff;border-radius:18px 18px 0 0;padding:20px 20px calc(20px + env(safe-area-inset-bottom));max-width:480px;width:100%}.ins-pop ol{margin:10px 0 14px;padding-left:20px;line-height:1.7}.ins-pop .btn-primary{width:100%;justify-content:center}\n.top-tabs{display:flex;align-items:center;gap:2px;margin-right:6px}.top-tabs a,.top-tabs button{display:flex;align-items:center;gap:6px;border:0;background:none;color:#dbe4f3;font:inherit;font-size:14px;font-weight:700;padding:8px 11px;border-radius:10px;text-decoration:none;cursor:pointer}.top-tabs svg{width:18px;height:18px}.top-tabs a:hover,.top-tabs button:hover,.top-tabs [aria-current=page]{background:rgba(255,255,255,.12);color:#fff}@media(max-width:820px){.top-tabs{display:none}}
.sm-acct a{display:flex!important;justify-content:space-between;align-items:center;background:#f3f6fb;border-radius:12px!important;padding:14px 14px!important}.sm-acct small{font-size:12.5px;color:var(--muted);font-weight:600}.sm-acct{border-top:0!important;padding-top:4px!important}
.menu-scrim{position:fixed;inset:0;background:rgba(10,20,35,.42);z-index:90}.side-menu{position:fixed;top:0;right:0;bottom:0;width:min(300px,86vw);background:#fff;z-index:91;overflow-y:auto;padding:14px 16px 24px;box-shadow:-12px 0 32px rgba(10,20,35,.18);animation:sm-in .18s ease-out}
@keyframes sm-in{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}.sm-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.sm-head b{font-size:17px}.sm-close{border:0;background:none;font-size:26px;line-height:1;cursor:pointer;color:var(--muted);width:38px;height:38px}
.sm-group{border-top:1px solid var(--line);padding:10px 0 6px}.sm-title{font-size:12px;font-weight:800;color:var(--muted);margin:2px 2px 8px}.sm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.side-menu .sm-tile{display:flex!important;flex-direction:column!important;align-items:center;justify-content:center;gap:5px;min-height:74px;padding:10px 6px;border-radius:14px;background:#f5f7fb;text-decoration:none;color:var(--fg);font-size:13px;font-weight:700;text-align:center;line-height:1.3}.side-menu .sm-tile:hover{background:var(--accent-soft)}.sm-ic{font-size:22px;line-height:1}@media(min-width:821px){.sm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}.side-menu a{display:block;padding:10px 6px;border-radius:10px;text-decoration:none;color:var(--fg);font-weight:600;font-size:15px}.side-menu a:hover,.side-menu a[aria-current=page]{background:#eef3fb;color:var(--accent-strong)}.sm-foot{font-size:12px;color:var(--muted);margin-top:12px}.sm-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:4px 0 10px}.side-menu .sm-quick a{display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 2px;border:1px solid var(--line);border-radius:12px;font-size:13px}.sm-quick svg{width:22px;height:22px}
html.menu-open{overflow:hidden}.sm-view .persona-bar{margin:6px 0 4px}.sm-view .persona-bar .lbl{display:none}.sm-hint{font-size:12px;color:var(--muted);margin:4px 2px}
@media(max-width:820px){.side-menu{top:auto;bottom:0;right:0;top:auto;left:0;width:auto;max-height:82vh;border-radius:20px 20px 0 0;padding-bottom:calc(24px + env(safe-area-inset-bottom));animation:sm-up .2s ease-out}}@keyframes sm-up{from{transform:translateY(30px);opacity:.4}to{transform:none;opacity:1}}`;

export const MENU_JS = `
  // 전체 (G-95): the tab bar's last tab opens every other place as a sheet (a side panel on wide screens).
  (function () {
    var btns = [].slice.call(document.querySelectorAll('[data-all-menu]')), nav = document.getElementById('side-menu'), scrim = document.querySelector('.menu-scrim');
    if (!btns.length || !nav) return;
    var here = location.pathname.split('/').pop() || 'index.html', last = null;
    nav.querySelectorAll('a').forEach(function (a) { if (a.getAttribute('href').split('/').pop().split('#')[0] === here && here !== 'index.html') a.setAttribute('aria-current', 'page'); });
    // The current tab: by page, and on home by the section in the hash.
    var mark = function () { var h = location.hash.slice(1); document.querySelectorAll('[data-tab-link]').forEach(function (a) { var k = a.getAttribute('data-tab-link'), on = here === 'index.html' ? (k === (h === 'watch' || h === 'search' ? h : 'top')) : k === here; if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); };
    mark(); window.addEventListener('hashchange', mark);
    document.querySelectorAll('[data-tab-link=search]').forEach(function (a) { a.addEventListener('click', function () { var q = document.getElementById('q'); if (q) setTimeout(function () { q.focus(); }, 60); }); });
    var set = function (open, by) { nav.hidden = !open; scrim.hidden = !open; btns.forEach(function (b) { b.setAttribute('aria-expanded', String(open)); }); document.documentElement.classList.toggle('menu-open', open); if (open) { last = by || null; nav.querySelector('a').focus(); } else if (last) last.focus(); };
    btns.forEach(function (b) { b.addEventListener('click', function () { set(nav.hidden, b); }); });
    scrim.addEventListener('click', function () { set(false); });
    nav.querySelector('.sm-close').addEventListener('click', function () { set(false); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !nav.hidden) set(false); });
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
.bn-dots{position:absolute;left:0;right:0;bottom:0;display:flex;justify-content:center;gap:0}.bn-dots button{width:32px;height:32px;border-radius:50%;border:0;padding:12.5px;background:rgba(255,255,255,.45);background-clip:content-box;cursor:pointer}.bn-dots button[aria-pressed=true]{background:#fff;background-clip:content-box;width:43px;border-radius:16px}
@media (max-width:820px){.banner{margin-top:10px}.bn-slide{grid-template-columns:1fr 64px;padding:22px 18px 36px;min-height:210px;gap:6px 10px}.bn-art{width:64px;height:64px;font-size:36px;grid-row:1/3;align-self:start;box-shadow:none}.bn-slide b{font-size:21px}.bn-text{font-size:14.5px;grid-column:1/3}.bn-cta{grid-column:1/3}}`;

