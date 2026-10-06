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

export const UI_CSS = `.h1-row{display:flex;align-items:center;gap:6px}.h1-row h1{margin:0}
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
  return `<div class="price-bar" id="price-bar" aria-hidden="true"><b>${opts.name}</b><span class="pb-code">${opts.symbol}</span><span class="pb-price">${opts.price}</span><span class="${opts.tone}">${opts.change}</span>${opts.badge}</div>`;
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
  { title: '둘러보기', items: [['홈', 'index.html#top'], ['종목 검색', 'index.html#search'], ['매일 AI 리포트', 'index.html#daily'], ['관심 종목', 'index.html#watch']] },
  { title: '시장', items: [['스크리너 (조건 검색)', 'screener.html'], ['ETF', 'etfs.html'], ['코인', 'coins.html']] },
  { title: '기록', items: [['성적표', 'scorecard.html'], ['모의투자', 'paper.html']] },
  { title: '알파 테스트', items: [['사용법', 'guide.html'], ['중간 설문', 'survey.html?k=midterm'], ['주간 설문', 'survey.html?k=weekly'], ['맞춤 설문 수정', 'onboarding.html']] },
  { title: '계정', items: [['내 계정', 'account.html'], ['요금제·크레딧', 'pricing.html'], ['로그인', 'login.html'], ['이용약관·면책', 'terms.html']] },
];

const MENU_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

/** The ☰ button for the top bar and the drawer it opens (assets/ui.js toggles it). */
export function menuHtml(base: string): { button: string; drawer: string } {
  return {
    button: `<button type="button" class="menu-btn" aria-label="전체 메뉴" aria-expanded="false" aria-controls="side-menu">${MENU_ICON}</button>`,
    drawer: `<div class="menu-scrim" hidden></div><nav class="side-menu" id="side-menu" aria-label="전체 메뉴" hidden><div class="sm-head"><b>전체 메뉴</b><button type="button" class="sm-close" aria-label="닫기">×</button></div>${MENU.map((g) => `<div class="sm-group"><div class="sm-title">${escM(g.title)}</div>${g.items.map(([label, href]) => `<a href="${base}${href}">${escM(label)}</a>`).join('')}</div>`).join('')}<p class="sm-foot">계산 결과이고, 투자 권유가 아니에요.</p></nav>`,
  };
}

export const MENU_CSS = `.menu-btn{width:38px;height:38px;border:0;border-radius:10px;background:none;color:#fff;cursor:pointer;display:grid;place-items:center;margin-left:2px}.menu-btn svg{width:22px;height:22px}.menu-btn:hover{background:rgba(255,255,255,.1)}
.menu-scrim{position:fixed;inset:0;background:rgba(10,20,35,.42);z-index:90}.side-menu{position:fixed;top:0;right:0;bottom:0;width:min(300px,86vw);background:#fff;z-index:91;overflow-y:auto;padding:14px 16px 24px;box-shadow:-12px 0 32px rgba(10,20,35,.18);animation:sm-in .18s ease-out}
@keyframes sm-in{from{transform:translateX(24px);opacity:.4}to{transform:none;opacity:1}}.sm-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.sm-head b{font-size:17px}.sm-close{border:0;background:none;font-size:26px;line-height:1;cursor:pointer;color:var(--muted);width:38px;height:38px}
.sm-group{border-top:1px solid var(--line);padding:10px 0 6px}.sm-title{font-size:12px;font-weight:700;color:var(--muted);margin-bottom:2px}.side-menu a{display:block;padding:10px 6px;border-radius:10px;text-decoration:none;color:var(--fg);font-weight:600;font-size:15px}.side-menu a:hover,.side-menu a[aria-current=page]{background:#eef3fb;color:var(--accent-strong)}.sm-foot{font-size:12px;color:var(--muted);margin-top:12px}
html.menu-open{overflow:hidden}`;

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
export const BANNER_CSS = `.bn-slide[hidden]{display:none!important}.banner{position:relative;max-width:1180px;margin:14px auto 0;padding:0 24px}.bn-slide{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:4px 12px;border-radius:16px;padding:14px 18px 22px;text-decoration:none;color:#fff;min-height:68px}
.bn-slide b{font-size:16px}.bn-text{grid-column:2/3;font-size:13px;opacity:.88}.bn-cta{grid-row:1/3;grid-column:3;font-weight:700;font-size:13px;background:rgba(255,255,255,.18);border-radius:999px;padding:7px 12px;white-space:nowrap}.bn-tag{grid-row:1/3;font-size:11px;font-weight:800;background:rgba(255,255,255,.2);border-radius:6px;padding:2px 6px}
.bn-navy{background:linear-gradient(120deg,#13294b,#2a4f8f)}.bn-teal{background:linear-gradient(120deg,#0d5e5a,#1c8c7d)}.bn-amber{background:linear-gradient(120deg,#8a4b06,#c47a12)}.bn-rose{background:linear-gradient(120deg,#7a1d38,#b23a5a)}
.bn-dots{position:absolute;left:0;right:0;bottom:7px;display:flex;justify-content:center;gap:6px}.bn-dots button{width:7px;height:7px;border-radius:50%;border:0;padding:0;background:rgba(255,255,255,.45);cursor:pointer}.bn-dots button[aria-pressed=true]{background:#fff;width:18px;border-radius:4px}
@media (max-width:820px){.banner{padding:0 14px;margin-top:10px}.bn-slide{grid-template-columns:auto 1fr;padding:12px 14px 22px}.bn-cta{grid-row:auto;grid-column:2;justify-self:start;padding:5px 10px}.bn-tag{grid-row:1}.bn-slide b{font-size:15px}}`;

