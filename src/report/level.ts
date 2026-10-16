// 화면 수준 (G-219): 초보자·중급자·고급·전문가 see a different stock page from the same report. The level is
// one answer in gnm-prefs (the settings page or the switch at the foot of each tab; it follows the account,
// G-109) and, until picked, comes from the survey's 투자 경험. html[data-level] decides, in CSS:
// - 초보자: a plain-words line at the top of each tab, the "쉽게 보면" card, and only the core cards; the
//   rest wait behind "자세한 분석 더 보기" at the foot of the tab.
// - 중급자: today's page minus the heaviest analysis (backtests, multi-timeframe table, short selling).
// - 고급: everything, with the glossary "?" kept.
// - 전문가: everything, tighter, numbers first (both number cards on 요약), no glossary "?" or plain notes.
// Nothing is removed from the page: every level can open everything, and the report's content is the same.

import { esc } from './html.js';
import { EXPERIENCE, EXPLAIN, LEVEL } from './profile.js';

export type Level = 'easy' | 'mid' | 'adv' | 'pro';
export const LEVELS: readonly { key: Level; label: (typeof LEVEL)[number]; note: string }[] = [
  { key: 'easy', label: '초보자', note: '쉬운 말 풀이와 꼭 볼 카드만 보여요.' },
  { key: 'mid', label: '중급자', note: '자주 보는 분석까지 보여요. 무거운 분석은 접혀 있어요.' },
  { key: 'adv', label: '고급', note: '모든 분석을 펼쳐서 보여요.' },
  { key: 'pro', label: '전문가', note: '모든 분석을 숫자 위주로 촘촘하게 보여요. 용어 풀이는 숨겨요.' },
];

/**
 * Cards shown from a level up (2 = 중급자, 3 = 고급). Each selector names a card; the script hides the
 * outermost wrapper that holds nothing else (a plan gate around it, say), so no empty frame is left.
 */
export const DEPTH: Record<2 | 3, readonly string[]> = {
  2: ['#structure', '#value'],
  3: ['#tab-strategy', '#horizons', '.sh-card'],
};

/** One line per tab, for 초보자: what the tab answers, in plain words. A coin's 기업 체력 tab is 수급. */
export function levelGuide(tab: string, kind?: string, report = true): string {
  const text: Record<string, string> = {
    // Only a report page has the "쉽게 보면" card (personaCards).
    home: report ? '맨 위 숫자가 오늘 가격이에요. 조금 내리면 나오는 "쉽게 보면" 카드가 지금 상태를 쉬운 말로 풀어 줘요. 모르는 말은 옆의 ? 를 누르면 풀이가 나와요.'
      : '맨 위 숫자가 오늘 가격이고, 그 아래 작은 차트가 최근 흐름이에요. 모르는 말은 옆의 ? 를 누르면 풀이가 나와요.',
    technical: '타이밍은 가격 흐름과 지표로 지금이 오르는 흐름(강세)인지 내리는 흐름(약세)인지 보는 탭이에요. 앞날을 맞힌다는 뜻은 아니에요.',
    fundamentals: kind === 'coin'
      ? '수급은 누가 얼마나 사고팔았는지, 돈이 들어오는 쪽인지 나가는 쪽인지 보는 탭이에요.'
      : '기업 체력은 회사가 돈을 잘 버는지(실적), 이익에 비해 주가가 비싼지(PER·PBR), 누가 사고파는지(수급)를 보는 탭이에요.',
    news: kind === 'coin' ? '이 코인에 관한 뉴스를 모았어요. 제목만 보고 판단하지 말고 원문을 열어 확인해 주세요.'
      : '이 회사 뉴스와, 회사가 법에 따라 직접 알린 공시를 모았어요. 공시가 원문이라 뉴스보다 정확해요.',
  };
  return text[tab] ? `<p class="lv-guide"><b>쉽게 보기</b>${esc(text[tab])}</p>` : '';
}

// The survey's 투자 경험, in order, and the explanation depth's ends stand in until a level is picked.
const FROM_EXPERIENCE: Record<string, Level> = Object.fromEntries(EXPERIENCE.map((e, i) => [e, (['easy', 'mid', 'adv', 'pro', 'pro'] as const)[i]!]));
const FROM_EXPLAIN: Record<string, Level> = { [EXPLAIN[0]]: 'easy', [EXPLAIN[2]]: 'pro' };

/** In <head>, after the persona boot: html[data-level] before paint (default 중급자). */
export const LEVEL_BOOT = `<script>(function(){var l='mid';try{var a=JSON.parse(localStorage.getItem('gnm-prefs')||'null')||{},L=${JSON.stringify(Object.fromEntries(LEVELS.map((x) => [x.label, x.key])))},E=${JSON.stringify(FROM_EXPERIENCE)},X=${JSON.stringify(FROM_EXPLAIN)};l=L[a.level]||E[a.experience]||X[a.explain]||'mid';}catch(x){}document.documentElement.setAttribute('data-level',l);})();</script>`;

const closed = (lv: string, d: string) => `html[data-level=${lv}] [role=tabpanel]:not(.lv-open) .lv-d${d}`;
export const LEVEL_CSS = `${[closed('easy', '2'), closed('easy', '3'), closed('mid', '3')].join(',')}{display:none!important}
.lv-guide{display:none}html[data-level=easy] .lv-guide{display:flex;gap:10px;align-items:baseline;margin:0 0 14px;padding:12px 14px;border:1px solid var(--accent-line,var(--line));border-radius:12px;background:var(--accent-soft,var(--soft));font-size:14.5px;line-height:1.65;color:var(--fg)}.lv-guide b{flex:none;font-size:12px;color:var(--accent-strong)}
html[data-level=easy] .pc-beginner{display:block}html[data-level=easy] .pc-trader,html[data-level=easy] .pc-long{display:none}
html[data-level=pro] .pc-trader,html[data-level=pro] .pc-long{display:block}html[data-level=pro] .pc-beginner{display:none}
html[data-level=pro] .pc-rows small,html[data-level=pro] [role=tabpanel] .tip{display:none}html[data-level=pro] .pc .card{padding:12px 14px}html[data-level=pro] .pc h2{font-size:16px;margin-bottom:8px}
html[data-level=pro] [role=tabpanel] .card{padding:12px 14px}html[data-level=pro] [role=tabpanel] .block{margin-top:12px}html[data-level=pro] [role=tabpanel]{font-variant-numeric:tabular-nums}
.lv-foot{margin:22px 0 6px;padding:14px 16px;border:1px dashed var(--line-strong);border-radius:14px;display:grid;gap:10px}.lv-foot p{margin:0;font-size:13px;color:var(--muted);line-height:1.6}.lv-foot p b{color:var(--fg)}
.lv-pick{display:flex;flex-wrap:wrap;gap:6px}.lv-pick button{min-height:44px;padding:0 14px;border:1px solid var(--line-strong);border-radius:999px;background:var(--surface);color:var(--fg);font:inherit;font-size:14px;cursor:pointer}.lv-pick button[aria-pressed=true]{background:var(--btn-bg);color:var(--btn-fg);border-color:var(--btn-bg)}
.lv-more{justify-self:start;min-height:44px;padding:0 16px;border:1px solid var(--accent);border-radius:12px;background:transparent;color:var(--accent-strong);font:inherit;font-size:14px;font-weight:700;cursor:pointer}.lv-more[hidden]{display:none}
.lv-pick button:focus-visible,.lv-more:focus-visible{outline:2px solid var(--accent);outline-offset:2px}`;

/** Tags the cards by DEPTH, adds the foot (switch + "더 보기") to each tab that has a guide, and saves picks. */
export const LEVEL_JS = `
(function () {
  var root = document.documentElement, LV = ${JSON.stringify(LEVELS.map((x) => [x.key, x.label, x.note]))}, DEPTH = ${JSON.stringify(DEPTH)};
  var panels = [].slice.call(document.querySelectorAll('[role=tabpanel]')); if (!panels.length) return;
  var heads = function (el) { return el.querySelectorAll('h2').length; };
  var tag = function () {
    Object.keys(DEPTH).forEach(function (d) {
      DEPTH[d].forEach(function (sel) {
        document.querySelectorAll('[role=tabpanel] ' + sel).forEach(function (el) {
          if (el.closest('.lv-d2,.lv-d3')) return;
          // Climb while the parent holds no other heading, so a wrapper around the card goes with it.
          var n = heads(el), w = el, up;
          while (n && (up = w.parentElement) && up.getAttribute('role') !== 'tabpanel' && !up.classList.contains('sub-sec') && heads(up) === n) w = up;
          w.classList.add('lv-d' + d);
        });
      });
    });
    // A plan gate around several cards goes when all of them go: at the shallowest of their depths.
    document.querySelectorAll('[role=tabpanel] .gate:not(.lv-d2):not(.lv-d3)').forEach(function (g) {
      var hs = [].slice.call(g.querySelectorAll('h2')); if (!hs.length) return;
      var ds = hs.map(function (h) { var t = h.closest('.lv-d2,.lv-d3'); return t && g.contains(t) ? (t.classList.contains('lv-d2') ? 2 : 3) : 0; });
      if (ds.indexOf(0) < 0) g.classList.add('lv-d' + Math.min.apply(null, ds));
    });
  };
  tag();
  var cur = function () { return root.getAttribute('data-level') || 'mid'; };
  // Cards the level hides, counted once (not those inside another hidden one, nor ones with nothing to show yet).
  var hiddenIn = function (p) {
    var l = cur(); if (l === 'adv' || l === 'pro') return 0;
    var sel = l === 'easy' ? '.lv-d2,.lv-d3' : '.lv-d3';
    var cards = [].filter.call(p.querySelectorAll(sel), function (el) { return !el.classList.contains('gate'); });
    return cards.filter(function (el) { return !el.hidden && !cards.some(function (o) { return o !== el && o.contains(el); }); }).length;
  };
  // 초보자 reads the plain-words card ("쉽게 보면") before the scenarios; other levels keep the report's order.
  var pcs = document.querySelector('#tab-home .pc-wrap'), mark = pcs && document.createComment('pc-wrap');
  if (mark) pcs.parentNode.insertBefore(mark, pcs); // pcs sits right after the mark when not moved
  var place = function () { var c = document.getElementById('home-conclusion'); if (!pcs || !c) return; if (cur() === 'easy') { if (c.previousElementSibling !== pcs) c.parentNode.insertBefore(pcs, c); } else if (mark.nextSibling !== pcs) mark.parentNode.insertBefore(pcs, mark.nextSibling); };
  var paint = function () {
    place();
    var l = cur(), info = LV.filter(function (x) { return x[0] === l; })[0] || LV[1];
    document.querySelectorAll('.lv-foot').forEach(function (f) {
      var p = f.closest('[role=tabpanel]'), n = hiddenIn(p), more = f.querySelector('.lv-more');
      f.querySelector('p').innerHTML = '화면 수준 <b>' + info[1] + '</b> · ' + info[2];
      f.querySelectorAll('[data-level-pick]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-level-pick') === l ? 'true' : 'false'); });
      more.hidden = !n || p.classList.contains('lv-open');
      more.textContent = '이 탭의 자세한 분석 ' + n + '개 더 보기';
    });
  };
  panels.forEach(function (p) {
    if (!p.querySelector('.lv-guide')) return;
    var f = document.createElement('div'); f.className = 'lv-foot';
    f.innerHTML = '<p></p><div class="lv-pick" role="group" aria-label="화면 수준">' + LV.map(function (x) { return '<button type="button" data-level-pick="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><button type="button" class="lv-more" hidden></button>';
    p.appendChild(f);
  });
  document.addEventListener('click', function (e) {
    var more = e.target.closest && e.target.closest('.lv-more');
    if (more) {
      var p = more.closest('[role=tabpanel]'); p.classList.add('lv-open'); paint();
      var first = p.querySelector('.lv-d2,.lv-d3'); if (first) first.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (window.GNM && GNM.track) GNM.track('level-more', { l: cur() });
      return;
    }
    var b = e.target.closest && e.target.closest('[data-level-pick]'); if (!b) return;
    var key = b.getAttribute('data-level-pick'), info = LV.filter(function (x) { return x[0] === key; })[0]; if (!info) return;
    var a = {}; try { a = JSON.parse(localStorage.getItem('gnm-prefs') || 'null') || {}; } catch (x) {}
    a.level = info[1]; try { localStorage.setItem('gnm-prefs', JSON.stringify(a)); } catch (x) {}
    // Signed in, the account's answers follow too (AI answers read them), as the settings page does.
    var G = window.GNM;
    if (G && G.me && G.call) { var on = (G.me.survey && G.me.survey.onboarding) || {}, answers = Object.assign({}, on, a); G.call('POST', '/survey', { kind: 'onboarding', answers: answers }).then(function (r) { if (r && !r.error && G.me.survey) G.me.survey.onboarding = answers; }); }
    root.setAttribute('data-level', key); panels.forEach(function (p) { p.classList.remove('lv-open'); });
    window.dispatchEvent(new Event('gnm-level')); paint();
    if (window.GNM && GNM.track) GNM.track('level', { l: key });
  });
  // A link to a folded card (#tab-strategy, say) opens its tab's folded cards first.
  var reveal = function () {
    var id = (location.hash || '').slice(1), el = id && document.getElementById(id), t = el && el.closest('.lv-d2,.lv-d3');
    if (t) { var p = t.closest('[role=tabpanel]'); if (p && !p.classList.contains('lv-open')) { p.classList.add('lv-open'); paint(); } }
  };
  window.addEventListener('hashchange', reveal);
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href^="#"]'); if (a) { var h = a.getAttribute('href'); if (h.length > 1) { var el = document.getElementById(h.slice(1)), t = el && el.closest('.lv-d2,.lv-d3'); if (t) { var p = t.closest('[role=tabpanel]'); if (p) p.classList.add('lv-open'); } } } }, true);
  // Parts filled in later (a report made on this page, short selling data) are tagged and counted too.
  if (window.MutationObserver) { var mt = null; panels.forEach(function (p) { new MutationObserver(function (rs) { if (!rs.some(function (r) { return !(r.target.closest && r.target.closest('.lv-foot')); })) return; clearTimeout(mt); mt = setTimeout(function () { tag(); paint(); }, 150); }).observe(p, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] }); }); }
  paint(); reveal();
})();`;
