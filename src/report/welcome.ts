// G-296 (한서님 10/24, 처음 쓰는 사람 안내): closed-beta testers open the app for the first time on 11/20.
// Three pieces, all shown once and remembered under gnm-tour-* keys (so they follow a signed-in account, see SYNC in alpha.ts):
//   1. Home: a full-screen welcome of four cards (what the app is, the AI committee, scoring, the bottom bar + picking
//      stocks to follow). Swipe or 다음; 건너뛰기 closes it. Returning readers (a tour already seen) never get it.
//   2. Stock pages: one card at the top of 위원회 that says which three things to read first. 알겠어요 removes it.
//   3. committee-guide.html (alphaPages.ts): '위원회가 뭐예요?', linked from the welcome, the card and the 위원회 tab.
// No bar at the top, buttons at the bottom, neutral glass with one dark accent, springs from motionTokens.ts.
// Educational tone only: nothing here tells a reader what to buy or sell.

/** Stocks offered on the last welcome card: [watch symbol, name]. Large, well-known names across 한국·미국·ETF·코인. */
export const WELCOME_PICKS: readonly (readonly [string, string])[] = [
  ['005930', '삼성전자'], ['000660', 'SK하이닉스'], ['005380', '현대차'], ['035420', 'NAVER'], ['035720', '카카오'],
  ['NVDA.O', '엔비디아'], ['TSLA.O', '테슬라'], ['069500', 'KODEX 200'], ['KRW-BTC', '비트코인'],
];
/** At most this many picks, the free plan's watch limit. */
export const WELCOME_MAX_PICKS = 5;

export const WELCOME_CSS = `
.wc:focus{outline:none}.wc{position:fixed;inset:0;z-index:260;background:var(--page);color:var(--fg);display:flex;flex-direction:column;overflow:hidden;animation:wc-in var(--d-soft) var(--spring-soft)}
.wc.out{opacity:0;transform:translateY(24px);transition:opacity var(--d-out) var(--ease-exit),transform var(--d-out) var(--ease-exit)}
@keyframes wc-in{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:none}}
.wc-track{flex:1;display:flex;min-height:0;transition:transform var(--d-snappy) var(--spring-snappy);touch-action:pan-y}
.wc-track.drag{transition:none}
.wc-card{flex:0 0 100%;box-sizing:border-box;padding:max(56px,env(safe-area-inset-top)) 24px 12px;overflow-y:auto;display:flex;flex-direction:column;max-width:100%}
.wc-card>*{width:100%;max-width:440px;margin-left:auto;margin-right:auto}
.wc-k{font-size:16px;font-weight:700;color:var(--muted)}
.wc h2{margin:12px auto 0;font-size:32px;line-height:1.26;font-weight:800;letter-spacing:-.02em}
.wc-p{margin:14px auto 0;font-size:17.5px;line-height:1.65;color:var(--fg2)}
.wc-box{margin-top:26px;border-radius:24px;background:var(--surface);border:1px solid var(--glass-line,var(--line));box-shadow:var(--shadow);backdrop-filter:blur(var(--glass-blur));-webkit-backdrop-filter:blur(var(--glass-blur))}
.wc-list{display:flex;flex-direction:column;gap:10px;margin-top:34px}
.wc-row{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:18px;background:var(--surface);border:1px solid var(--line);font-size:17px;font-weight:700}
.wc-no{flex:none;width:30px;height:30px;border-radius:10px;background:var(--btn-bg);color:var(--btn-fg);display:grid;place-items:center;font-size:15.5px;font-weight:800}
.wc-on .wc-row{animation:wc-pop var(--d-bouncy) var(--spring-bouncy) both}.wc-on .wc-row:nth-child(2){animation-delay:70ms}.wc-on .wc-row:nth-child(3){animation-delay:140ms}
@keyframes wc-pop{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}
.wc-seats{padding:18px 20px 16px}.wc-seats .wc-cap{display:flex;justify-content:space-between;font-size:15px;color:var(--muted)}
.wc-arc{position:relative;width:280px;height:150px;margin:8px auto 0}
.wc-arc i{position:absolute;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;box-sizing:border-box;transform:scale(0)}
.wc-on .wc-arc i{transform:scale(1);transition:transform var(--d-bouncy) var(--spring-bouncy);transition-delay:calc(var(--i) * 45ms)}
.wc-arc .b{background:var(--fg)}.wc-arc .n{background:var(--line-strong)}.wc-arc .s{background:var(--surface-solid);border:2px solid var(--fg)}
.wc-arc b{position:absolute;left:0;right:0;top:92px;text-align:center;font-size:24px;font-weight:800}.wc-arc small{display:block;font-size:15px;font-weight:500;color:var(--muted);margin-top:2px}
.wc-key{display:flex;justify-content:center;gap:14px;margin-top:8px;font-size:15px;color:var(--fg2)}.wc-key span{display:flex;align-items:center;gap:5px}.wc-key i{width:10px;height:10px;border-radius:50%;box-sizing:border-box}
.wc-more{align-self:flex-start;margin-top:12px;padding:10px 0;font-size:17px;font-weight:700;color:var(--fg);text-decoration:none}
.wc-score .wc-cap{display:flex;justify-content:space-between;padding:16px 20px 8px;font-size:15px;color:var(--muted)}
.wc-score div.r{display:flex;align-items:center;gap:12px;padding:14px 20px;border-top:1px solid var(--line)}.wc-score div.r>span:first-child{flex:1;min-width:0}
.wc-score b{display:block;font-size:17px}.wc-score small{display:block;font-size:15.5px;color:var(--muted);margin-top:2px}
.wc-tag{font-size:15.5px;font-weight:800;padding:6px 12px;border-radius:999px;white-space:nowrap}.wc-tag.ok{background:var(--btn-bg);color:var(--btn-fg)}.wc-tag.no{border:1.5px solid var(--fg);padding:4.5px 10.5px}.wc-tag.wait{background:var(--soft);color:var(--fg2);font-weight:700}
.wc-note{margin:14px auto 0;font-size:15.5px;line-height:1.55;color:var(--muted)}
.wc-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:18px;padding:8px;border-radius:26px;background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow)}
.wc-tabs span{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 0;border-radius:18px;font-size:15px;color:var(--fg2)}.wc-tabs span:first-child{background:var(--surface-solid);color:var(--fg);font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.wc-tabs svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.wc-tabs-say{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 12px;margin-top:12px;font-size:15.5px;line-height:1.45;color:var(--fg2)}.wc-tabs-say b{color:var(--fg)}
.wc-h3{margin:26px auto 0;font-size:19px;font-weight:800}.wc-sub{margin:4px auto 0;font-size:15.5px;color:var(--muted)}
.wc-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.wc-chips button{height:42px;padding:0 16px;border-radius:999px;border:1px solid var(--line-strong);background:var(--surface);color:var(--fg);font:inherit;font-size:16px;cursor:pointer;transition:transform var(--d-bouncy) var(--spring-bouncy),background-color var(--dur-fast),color var(--dur-fast)}
.wc-chips button[aria-pressed=true]{background:var(--btn-bg);color:var(--btn-fg);border-color:var(--btn-bg);font-weight:700}
.wc-chips button[aria-pressed=true]::before{content:'✓ '}
.wc-foot{flex:none;padding:10px 24px max(24px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:14px;width:100%;max-width:488px;margin:0 auto;box-sizing:border-box}
.wc-law{margin:0;font-size:15px;line-height:1.5;color:var(--muted);text-align:center}
.wc-dots{display:flex;justify-content:center;gap:6px}.wc-dots i{width:6px;height:6px;border-radius:3px;background:var(--line-strong);transition:width var(--d-snappy) var(--spring-snappy),background-color var(--dur-base)}.wc-dots i.on{width:20px;background:var(--fg)}
.wc-btns{display:flex;gap:8px}.wc-btns button{height:54px;border-radius:999px;font:inherit;font-size:17px;font-weight:700;cursor:pointer}
.wc-btns .wc-alt{flex:1;border:1px solid var(--line);background:var(--surface);color:var(--fg2)}
.wc-btns .wc-go{flex:2;border:0;background:var(--btn-bg);color:var(--btn-fg);font-size:17.5px;font-weight:800}
/* The stock page's first-visit card (위원회 part). */
/* G-301 (한서님 10/26 '종목 위원회탭 다시 만들어봐'): a sheet that rises once over the page, so it never pushes 위원회 판단 down. */
.fv-scrim{position:fixed;inset:0;z-index:60;background:rgba(10,12,16,.32);animation:fv-fade .2s ease both}
.fv-card{position:fixed;z-index:61;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);max-width:480px;margin:0 auto;padding:18px 18px 16px;border-radius:26px;background:var(--surface-solid,var(--surface));border:1px solid var(--line-strong);box-shadow:0 18px 48px -12px rgba(0,0,0,.35);animation:fv-up var(--d-bouncy,.5s) var(--spring-bouncy,cubic-bezier(.34,1.4,.64,1)) both}
.fv-card.out{opacity:0;transform:translateY(24px);transition:opacity var(--d-out,.18s) var(--ease-exit,ease),transform var(--d-out,.18s) var(--ease-exit,ease)}.fv-scrim.out{opacity:0;transition:opacity .18s}
@keyframes fv-up{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}@keyframes fv-fade{from{opacity:0}}
@media (prefers-reduced-motion:reduce){.fv-card,.fv-scrim{animation:none}}
.fv-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.fv-head b{font-size:17.5px}
.fv-ok{flex:none;height:36px;padding:0 14px;border-radius:999px;border:0;background:var(--btn-bg);color:var(--btn-fg);font:inherit;font-size:15.5px;font-weight:700;cursor:pointer}
.fv-card ol{margin:12px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px}
.fv-card li{display:flex;gap:10px;font-size:16px;line-height:1.5;color:var(--fg2)}.fv-card li b{color:var(--fg)}
.fv-card li>span:first-child{flex:none;width:22px;height:22px;border-radius:50%;background:var(--btn-bg);color:var(--btn-fg);font-size:12px;font-weight:800;display:grid;place-items:center}
.fv-card a{display:inline-block;margin-top:10px;padding:6px 0;font-size:15.5px;font-weight:700;color:var(--fg);text-decoration:none}
`;

/** The 11 seats of the example vote on the second card: [stance, x, y] on a half circle (5 강세, 4 중립, 2 약세). */
const SEATS = Array.from({ length: 11 }, (_, i) => {
  const a = Math.PI - (i * Math.PI) / 10;
  return [i < 5 ? 'b' : i < 9 ? 'n' : 's', Math.round(140 + 124 * Math.cos(a)), Math.round(138 - 124 * Math.sin(a))] as const;
});
const icon = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const TAB_ICONS = [
  ['홈', '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>'],
  ['찾기', '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>'],
  ['위원회', '<rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9.5 4h5v3h-5zM9 13.5l2 2 4-4"/>'],
  ['나', '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'],
] as const;

/** The four welcome cards as HTML; `base` is the site root (links). */
export function welcomeCards(base: string): string {
  const seats = SEATS.map(([s, x, y], i) => `<i class="${s}" style="left:${x}px;top:${y}px;--i:${i}"></i>`).join('');
  return [
    `<section class="wc-card" aria-label="1/4"><span class="wc-k">GNOMON 베타</span><h2>아침마다<br>1분이면 충분해요.</h2><p class="wc-p">그노몬은 오늘 시장과 내 종목을 AI 위원회가 근거와 함께 정리해 주는 앱이에요.</p>
<div class="wc-list"><div class="wc-row"><span class="wc-no">1</span>오늘 세계·한국 시장 한 줄</div><div class="wc-row"><span class="wc-no">2</span>내 종목에 무슨 일이 있었는지</div><div class="wc-row"><span class="wc-no">3</span>AI 위원회는 어떻게 보는지</div></div></section>`,
    `<section class="wc-card" aria-label="2/4"><span class="wc-k">AI 위원회</span><h2>AI 11명이<br>각자 보고, 토론해요.</h2><p class="wc-p">추세·실적·수급·뉴스처럼 맡은 분야가 다른 AI들이 같은 종목을 따로 판단한 뒤, 서로 반박하며 결론을 정리해요.</p>
<div class="wc-box wc-seats"><div class="wc-cap"><span>표결 (예시)</span><span>11석</span></div><div class="wc-arc" role="img" aria-label="의석 11개 예시: 강세 5, 중립 4, 약세 2">${seats}<b>강세 5<small>중립 4 · 약세 2</small></b></div>
<div class="wc-key"><span><i class="b" style="background:var(--fg)"></i>강세</span><span><i style="background:var(--line-strong)"></i>중립</span><span><i style="border:1.5px solid var(--fg)"></i>약세</span></div></div>
<a class="wc-more" href="${base}committee-guide.html" data-wc-leave>위원회가 뭐예요? 자세히 보기 ›</a></section>`,
    `<section class="wc-card" aria-label="3/4"><span class="wc-k">성적표</span><h2>말한 건 그대로 남고,<br>나중에 채점돼요.</h2><p class="wc-p">위원회 판단은 만든 날 그대로 저장되고, 20거래일 뒤 실제 가격으로 맞았는지 공개해요. 틀린 것도 지우지 않아요.</p>
<div class="wc-box wc-score"><div class="wc-cap"><span>판단 기록 (예시)</span><span>20거래일 뒤</span></div>
<div class="r"><span><b>종목 A</b><small>강세 쪽이 많았어요</small></span><span class="wc-tag ok">맞음</span></div>
<div class="r"><span><b>종목 B</b><small>약세 쪽이 많았어요</small></span><span class="wc-tag no">틀림</span></div>
<div class="r"><span><b>종목 C</b><small>의견이 갈렸어요</small></span><span class="wc-tag wait">채점 중</span></div></div>
<p class="wc-note">그래서 위원회 말을 얼마나 믿을지 직접 판단할 수 있어요. 성적표는 위원회 탭에 있어요.</p></section>`,
    `<section class="wc-card" aria-label="4/4"><h2 style="font-size:28px;margin-top:0">아래 바 하나로<br>다 움직여요.</h2>
<div class="wc-tabs" aria-hidden="true">${TAB_ICONS.map(([l, d]) => `<span>${icon(d)}${l}</span>`).join('')}</div>
<div class="wc-tabs-say"><span><b>홈</b> 오늘 시장과 내 종목</span><span><b>찾기</b> 종목·ETF·코인 검색</span><span><b>위원회</b> AI 리포트와 성적표</span><span><b>나</b> 알림·설정·사용법</span></div>
<div class="wc-h3" id="wc-pick-h">자주 볼 종목을 골라 주세요</div><div class="wc-sub">홈에 바로 떠요. ${WELCOME_MAX_PICKS}개까지, 나중에 ☆로 언제든 바꿀 수 있어요.</div>
<div class="wc-chips" role="group" aria-labelledby="wc-pick-h">${WELCOME_PICKS.map(([s, n]) => `<button type="button" data-wc-pick="${s}" aria-pressed="false">${n}</button>`).join('')}</div></section>`,
  ].join('');
}

/** Home: the welcome, once. Stock pages: the 위원회 card, once. ?welcome=1 shows the welcome again (사용법 page). */
export function welcomeJs(base0 = ''): string {
  return `
(function () {
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var base = document.body.getAttribute('data-base') || ${JSON.stringify(base0)};
  var CARDS = ${JSON.stringify(welcomeCards('@@BASE@@'))}, PICK_MAX = ${WELCOME_MAX_PICKS}, WKEY = 'gnm-tour-welcome', HKEY = 'gnm-tour-stockhint';
  var welcome = function () {
    var forced = /[?&]welcome=/.test(location.search);
    // A reader who has already been around (any tour seen) knows the app; only new readers get it.
    if (!forced && (get(WKEY) || get('gnm-tour-done') || get('gnm-tour-v243-home') || get('gnm-tour-home') || get('gnm-tour-v243-report'))) return;
    var i = 0, n = 4, picks = [], before = document.activeElement;
    var d = document.createElement('div'); d.className = 'wc'; d.tabIndex = -1; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', '그노몬 처음 안내');
    d.innerHTML = '<div class="wc-track">' + CARDS.split('@@BASE@@').join(base) + '</div><div class="wc-foot"><p class="wc-law" hidden>그노몬은 공부를 돕는 정보예요. 특정 종목을 사라·팔라고 권하지 않아요.</p><div class="wc-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div><div class="wc-btns"><button type="button" class="wc-alt" data-wc="alt">건너뛰기</button><button type="button" class="wc-go" data-wc="go">다음</button></div></div>';
    var track = d.querySelector('.wc-track'), cards = d.querySelectorAll('.wc-card'), dots = d.querySelectorAll('.wc-dots i'), alt = d.querySelector('[data-wc=alt]'), go = d.querySelector('[data-wc=go]'), law = d.querySelector('.wc-law');
    var paint = function () {
      track.style.transform = 'translateX(' + (-i * 100) + '%)';
      [].forEach.call(cards, function (c, k) { c.classList.toggle('wc-on', k === i); c.setAttribute('aria-hidden', String(k !== i)); c.inert = k !== i; });
      [].forEach.call(dots, function (x, k) { x.classList.toggle('on', k === i); });
      alt.textContent = i ? '이전' : '건너뛰기';
      go.textContent = i < n - 1 ? '다음' : picks.length ? picks.length + '개 담고 시작하기' : '그냥 시작하기';
      law.hidden = i !== n - 1;
    };
    var close = function () {
      if (!d.isConnected) return;
      set(WKEY, '1');
      if (picks.length) {
        var w = []; try { w = JSON.parse(get('gnm-watch') || '[]') || []; } catch (e) {}
        picks.slice().reverse().forEach(function (s) { if (w.indexOf(s) < 0) w.unshift(s); });
        set('gnm-watch', JSON.stringify(w)); set('gnm-watch-at', String(Date.now()));
        window.dispatchEvent(new Event('gnm-watch')); if (window.GNM_starSync) window.GNM_starSync();
        if (window.GNM && GNM.toast) GNM.toast('관심 목록에 ' + picks.length + '개 담았어요.', 'success');
      }
      d.classList.add('out'); setTimeout(function () { d.remove(); if (before && before.focus) before.focus({ preventScroll: true }); }, 200);
    };
    window.GNM_welcomeClose = close;
    d.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button,a'); if (!b) return;
      if (b.hasAttribute('data-wc-leave')) { set(WKEY, '1'); return; }
      var p = b.getAttribute('data-wc-pick');
      if (p) { var k = picks.indexOf(p); if (k >= 0) picks.splice(k, 1); else if (picks.length < PICK_MAX) picks.push(p); else { if (window.GNM && GNM.toast) GNM.toast('처음에는 ' + PICK_MAX + '개까지 고를 수 있어요.'); return; } b.setAttribute('aria-pressed', String(picks.indexOf(p) >= 0)); paint(); return; }
      var t = b.getAttribute('data-wc');
      if (t === 'go') { if (i < n - 1) { i++; paint(); } else close(); }
      else if (t === 'alt') { if (i) { i--; paint(); } else close(); }
    });
    d.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight' && i < n - 1) { i++; paint(); } else if (e.key === 'ArrowLeft' && i) { i--; paint(); } else if (e.key === 'Escape') close(); });
    // Swipe: the cards follow the finger and spring to the nearest one on release.
    var x0 = null, y0 = 0, dx = 0, lock = null;
    track.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' || (e.target.closest && e.target.closest('button,a'))) return; x0 = e.clientX; y0 = e.clientY; dx = 0; lock = null; });
    track.addEventListener('pointermove', function (e) {
      if (x0 === null) return; dx = e.clientX - x0;
      if (lock === null && (Math.abs(dx) > 8 || Math.abs(e.clientY - y0) > 8)) lock = Math.abs(dx) > Math.abs(e.clientY - y0);
      if (!lock) return;
      var edge = (i === 0 && dx > 0) || (i === n - 1 && dx < 0) ? 0.3 : 1;
      track.classList.add('drag'); track.style.transform = 'translateX(calc(' + (-i * 100) + '% + ' + Math.round(dx * edge) + 'px))';
    });
    var up = function () { if (x0 === null) return; x0 = null; track.classList.remove('drag'); if (lock && dx < -50 && i < n - 1) i++; else if (lock && dx > 50 && i) i--; paint(); };
    track.addEventListener('pointerup', up); track.addEventListener('pointercancel', up);
    document.body.appendChild(d); paint(); d.focus({ preventScroll: true });
  };
  var stockHint = function () {
    var part = document.getElementById('tab-home');
    if (!part || !document.getElementById('tab-ai') || get(HKEY)) return;
    var c = document.createElement('section'); c.className = 'fv-card'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', '처음 보는 분을 위한 안내');
    var third = (document.querySelector('[data-nav=fundamentals]') || {}).getAttribute ? document.querySelector('[data-nav=fundamentals]').getAttribute('aria-label') : '기업';
    c.innerHTML = '<div class="fv-head"><b>처음이면 이 세 가지만 보세요</b><button type="button" class="fv-ok">알겠어요</button></div><ol><li><span>1</span><span><b>위원회 판단</b>: 한 줄 결론과 그렇게 본 이유예요.</span></li><li><span>2</span><span><b>세 갈래 확률</b>: 강세·기본·약세 중 어디에 무게가 있는지 봐요.</span></li><li><span>3</span><span><b>' + third + '</b>: ' + (third === '체력' ? '아래 바에서 거래량과 매집 흔적을 봐요.' : '아래 바에서 회사 정보와 재무를 봐요.') + '</span></li></ol><a href="' + base + 'committee-guide.html">위원회가 뭐예요? ›</a>';
    var scrim = document.createElement('div'); scrim.className = 'fv-scrim';
    var shut = function () { set(HKEY, '1'); c.classList.add('out'); scrim.classList.add('out'); document.removeEventListener('keydown', esc); setTimeout(function () { c.remove(); scrim.remove(); }, 200); };
    var esc = function (e) { if (e.key === 'Escape') shut(); };
    c.querySelector('.fv-ok').addEventListener('click', shut); scrim.addEventListener('click', shut); document.addEventListener('keydown', esc);
    c.querySelector('a').addEventListener('click', function () { set(HKEY, '1'); });
    // After the boot veil lifts, so the sheet rises over a page that is already there.
    setTimeout(function () { if (get(HKEY)) return; document.body.appendChild(scrim); document.body.appendChild(c); c.querySelector('.fv-ok').focus({ preventScroll: true }); }, 1100);
  };
  var run = function () { if (document.getElementById('mkt-hero')) welcome(); else stockHint(); };
  // A signed-in reader on a new device first takes the account's settings (what was already seen comes with them).
  var go = function () { if (get('gnm-session') && window.GNM && window.GNM.ready) window.GNM.ready.then(run, run); else run(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();`;
}
export const WELCOME_JS = welcomeJs();
