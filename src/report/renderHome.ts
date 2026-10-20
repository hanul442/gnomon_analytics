import type { MarketReport } from './marketReport.js';
// Site front page as a market dashboard (docs/DESIGN.md §3.7, G-31). It answers
// "what should I look at now?" (BOR North Star §2): the indices and breadth,
// the market's temperature from every stock's free computation, this week's AI
// reports as one-line rows, today's movers, a watchlist kept in the browser,
// the scorecard summary and this week's filings. Pure rendering.

import { NEWS_ISSUES_CARD, NEWS_ISSUES_SCRIPT } from './newsIssues.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { MarketPulse, StockCalc } from '../analysis/quickCalc.js';
import { madeOn, shell, type HomeEntry } from './renderHtml.js';
import { ALPHA_BANNERS, BANNER_JS, bannerHtml, eventBanners, wrapupBanners, type Banner } from './alphaPages.js';
import { openEvents } from './events.js';
import { esc } from './html.js';
import { won, tone, move as signed } from './format.js';

// G-84: a move always carries its arrow (▲ red up, ▼ blue down) next to the number.

export interface IndexQuote { symbol: string; name: string; date: string; close: number; changePct: number | null; closes: number[] }

export interface HomeData {
  marketReports?: readonly MarketReport[];
  /** G-179: the US market's temperature (signal buckets over the US universe) and today's breadth. */
  us?: UsTemp | null;
  entries: readonly HomeEntry[];
  selection: { date: string; eligible: number; universe: number } | null;
  universe: readonly UniverseRow[] | null;
  pulse: MarketPulse | null;
  calcs?: ReadonlyMap<string, StockCalc>;
  indices: readonly IndexQuote[];
  /** KST date of the run (credit events in the banner). */
  today?: string;
  /** Notices from banners.json, shown before the alpha guide and surveys. */
  banners?: readonly Banner[];
}

export interface UsTemp { pulse: MarketPulse | null; date: string; up: number; down: number; flat: number }

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/></svg>';
const star = (symbol: string, name: string) => `<button type="button" class="star" data-star="${esc(symbol)}" aria-pressed="false" aria-label="${esc(name)} 관심 종목">${STAR}</button>`;



/** The newest market daily (G-122): the home temperature card opens it. */
const latestDaily = (data: HomeData): string => { const d = data.marketReports?.filter((r) => r.period === 'daily').sort((a, b) => b.date.localeCompare(a.date))[0]; return d ? `market/daily-${d.date}.html` : 'market-reports.html'; };

const GROUP = { core: '위원회', weekly: '간단(이전)', request: '요청', data: '', past: '', daily: '' } as const;
/**
 * G-175 (v3.5.5): which AI a row carries, from the report itself — every new report is the full committee (G-168)
 * and there are no weekly reports (G-174), so the old 위원회 전체/요약 split by selection group no longer holds.
 */
function aiKind(e: HomeEntry): 'core' | 'weekly' | 'request' | 'data' {
  const c = e.report?.commentary;
  if (e.group === 'request') return 'request';
  if (c?.status !== 'OK') return 'data';
  return c.tier === 'brief' ? 'weekly' : 'core';
}
/** The tier pill: kind plus the report date (MM/DD) for committee reports. */
function aiPill(e: HomeEntry): string {
  const k = aiKind(e), d = madeOn(e);
  if (k === 'data') return '';
  return `<span class="tier t-${k}">${GROUP[k]}${k === 'core' && d ? ` ${esc(d.slice(5).replace('-', '/'))}` : ''}</span>`;
}
const KIND = { stock: '주식', etf: 'ETF', coin: '코인' } as const;

/** Daily picks of the last seven days (G-56), newest day first. */
function dailyRows(entries: readonly HomeEntry[]): string {
  if (!entries.length) return '';
  const days = [...new Set(entries.map((e) => e.pickDate ?? ''))].sort().reverse();
  const row = (e: HomeEntry) => {
    const r = e.report, p = r?.price, c = r?.commentary?.status === 'OK' ? r.commentary : undefined;
    const line = (c?.summary?.text ?? r?.headline ?? '').split(/(?<=요\.)\s/)[0] ?? '';
    return `<div class="rr" data-kind="${aiKind(e)}"><a class="rr-main" href="${esc(e.href)}"><div class="rr-name"><b>${esc(e.name)}</b><span class="tier t-k">${KIND[e.kind ?? 'stock']}</span>${aiPill(e)}</div><p class="rr-line">${esc(line || (e.reasons?.[0] ?? ''))}</p></a>
<div class="rr-side">${p ? `<b>${won(p.close)}</b><span class="${tone(p.changePct)}">${signed(p.changePct)}</span>` : ''}</div>${star(e.symbol, e.name)}</div>`;
  };
  return `<section class="block" id="daily"><div class="block-head"><h2>매일 AI 리포트</h2><span class="muted">평일 주식 2 + 미국 1 + ETF(월·수·금)·코인(화·목) 1, 주말 코인 1</span></div>
<details class="card"><summary>선정 기준과 반복 종목 안내</summary><p>주식은 스크리너 추천 조건에 걸린 종목(과열·위험 조건과 시가총액 1,000억 원 미만 제외) 가운데 날짜마다 2개를 뽑아요. 후보에 시가총액 1조 원 이상 종목이 있으면 하나는 그중에서 고르고, 두 종목은 되도록 서로 다른 조건에서 골라요. ETF는 거래대금 상위 20개(레버리지·인버스·채권형 제외), 코인은 거래대금 상위 15개(스테이블코인 제외)에서 하나를 골라요. 추적 종목과 최근 28일 안에 리포트가 나온 종목은 빼고, 후보가 모자라면 그날은 덜 뽑아요.</p><p>모두 AI 위원회 심층 리포트예요. 아래 목록은 최근 7일 기록이에요.</p></details><div class="card list rr-list">${days.map((d, i) => `<div class="dl-day${i ? ' dl-old' : ''}">${esc(d.slice(5).replace('-', '/'))}${i ? '' : ' · 최신'}</div>${entries.filter((e) => e.pickDate === d).sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'deep' ? -1 : 1)).map(row).join('')}`).join('')}</div>
<p class="muted small">스크리너 상위 종목, 거래대금 상위 ETF·코인 가운데 무작위로 골라요. 시나리오 해설이고, 투자 권유가 아니에요.</p></section>`;
}

function reportRows(entries: readonly HomeEntry[], selection: HomeData['selection']): string {
  const rows = entries.map((e) => {
    const r = e.report, p = r?.price;
    const mid = r?.market?.horizons.find((h) => h.key === 'MEDIUM')?.summary;
    const c = r?.commentary?.status === 'OK' ? r.commentary : undefined;
    const line = (c?.summary?.text ?? r?.headline ?? '').split(/(?<=요\.)\s/)[0] ?? '';
    const kind = aiKind(e);
    const lean = mid?.score == null ? '' : mid.score >= 0.1 ? 'bull' : mid.score <= -0.1 ? 'bear' : 'flat';
    return `<div class="rr" data-kind="${kind}" data-lean="${lean}"><a class="rr-main" href="${esc(e.href)}"><div class="rr-name"><b>${esc(e.name)}</b>${aiPill(e)}</div><p class="rr-line">${esc(line)}</p></a>
<div class="rr-side">${p ? `<b>${won(p.close)}</b><span class="${tone(p.changePct)}">${signed(p.changePct)}</span>` : '<span class="muted small">가격 기록 없음</span>'}</div>${star(e.symbol, e.name)}</div>`;
  }).join('');
  const chip = (f: string, label: string, n?: number) => `<button type="button" class="chip-toggle" data-rf="${f}" aria-pressed="${f === ''}">${label}${n === undefined ? '' : ` ${n}`}</button>`;
  const count = (k: string) => entries.filter((e) => aiKind(e) === k).length;
  return `<section class="block" id="reports"><div class="block-head"><h2>추적 종목 ${entries.length}개</h2><span class="muted">${selection ? `${esc(selection.date)} 선정 · ` : ''}가격·지표는 매일 바뀌어요</span></div>
<div class="card list rr-list"><div class="pl-chips rr-chips" role="group" aria-label="리포트 거르기">${chip('', '전체', entries.length)}${count('core') ? chip('core', '위원회', count('core')) : ''}${count('weekly') ? chip('weekly', '간단(이전)', count('weekly')) : ''}${count('request') ? chip('request', '요청', count('request')) : ''}</div>${rows || '<p class="empty">아직 리포트가 없어요.</p>'}</div>
<p class="muted small">대표 종목과 시가총액·거래대금·공시·움직임으로 고른 종목이에요. 가격·지표는 매일 바뀌고, AI 리포트는 표시된 날짜에 쓴 내용이에요(매일 리포트나 요청으로 새로 만들어요).</p></section>`;
}

/**
 * G-125: everything that came out on the newest report day, in one list. The 🔔 notes link here
 * (reports.html?hl=<symbols>#today): the reader's watched stocks come first, marked, and the rest of the day follows.
 */
function todayRows(entries: readonly HomeEntry[]): string {
  // G-231: by the day each report was made, not the live page's date (every run rebuilds it with the run's date).
  const withDate = entries.filter((e) => e.report && madeOn(e) && e.group !== 'past');
  const day = withDate.map(madeOn).sort().at(-1);
  if (!day) return '';
  const seen = new Set<string>();
  const list = withDate.filter((e) => madeOn(e) === day && !seen.has(e.symbol) && seen.add(e.symbol));
  const deep = (e: HomeEntry) => aiKind(e) === 'core';
  list.sort((a, b) => Number(deep(b)) - Number(deep(a)) || a.name.localeCompare(b.name, 'ko'));
  const row = (e: HomeEntry) => {
    const r = e.report!, p = r.price, c = r.commentary?.status === 'OK' ? r.commentary : undefined;
    const line = (c?.summary?.text ?? r.headline ?? '').split(/(?<=요\.)\s/)[0] ?? '';
    return `<div class="rr" data-sym="${esc(e.symbol)}"><a class="rr-main" href="${esc(e.href)}"><div class="rr-name"><b>${esc(e.name)}</b>${e.kind && e.kind !== 'stock' ? `<span class="tier t-k">${KIND[e.kind]}</span>` : ''}${aiPill(e)}</div><p class="rr-line">${esc(line)}</p></a>
<div class="rr-side">${p ? `<b>${won(p.close)}</b><span class="${tone(p.changePct)}">${signed(p.changePct)}</span>` : ''}</div>${star(e.symbol, e.name)}</div>`;
  };
  return `<section class="block" id="today"><div class="block-head"><h2>${esc(day.slice(5).replace('-', '/'))} 나온 리포트 ${list.length}개</h2><span class="muted">${esc(day)} 장 마감 기준</span></div>
<p class="muted small td-note" hidden></p><div class="card list rr-list" id="today-list">${list.map(row).join('')}</div></section>`;
}

/** Watched stocks (from the 🔔 link or this browser's ☆ list) go to the top of today's list, marked. */
const TODAY_LIST_SCRIPT = `<script>
(function () {
  var box = document.getElementById('today-list'); if (!box) return;
  var hl = (new URLSearchParams(location.search).get('hl') || '').split(',').filter(Boolean), mine = {};
  hl.forEach(function (s) { mine[s] = 1; });
  try { (JSON.parse(localStorage.getItem('gnm-watch') || '[]') || []).forEach(function (s) { mine[s] = mine[s] || 2; }); } catch (e) {}
  var rows = [].slice.call(box.querySelectorAll('.rr[data-sym]')), n = 0;
  rows.filter(function (r) { return mine[r.getAttribute('data-sym')]; }).reverse().forEach(function (r) {
    n++; box.insertBefore(r, box.firstChild); r.classList.add('rr-mine');
    var name = r.querySelector('.rr-name b'); if (name) name.insertAdjacentHTML('afterend', '<span class="tier t-mine">내 관심</span>');
  });
  var note = document.querySelector('.td-note');
  if (note && n) { note.hidden = false; note.textContent = '내 관심 종목 ' + n + '개를 맨 위에 모았어요. 아래는 같은 날 나온 다른 리포트예요.'; }
  if (hl.length && location.hash !== '#today') { var t = document.getElementById('today'); if (t) t.scrollIntoView(); }
})();
</script>`;

/** Every daily pick of the last week and this week's reports, off the front page (G-64). */
export function renderReportsPage(data: HomeData): string {
  const entries = data.entries.filter((e) => e.group !== 'past' && e.group !== 'daily' && e.group !== 'request');
  const daily = data.entries.filter((e) => e.group === 'daily');
  const order = { core: 0, weekly: 1, request: 2, past: 3, daily: 4 } as const;
  const sorted = [...entries].sort((a, b) => order[a.group] - order[b.group] || (a.tier === b.tier ? 0 : a.tier === 'deep' ? -1 : 1));
  const latest = [...new Set(daily.map((e) => e.pickDate ?? ''))].sort().at(-1);
  const tile = (href: string, title: string, sub: string) => `<a href="${href}"><b>${title}</b><small>${sub}</small></a>`;
  const head = `<section class="card rp-head"><div class="pl-k">AI 리포트 모음</div><h1>최근 AI 리포트</h1><p class="muted">매일 고른 종목과 추적 종목의 AI 리포트를 한곳에 모았어요. 시장 데일리는 위 탭에 있어요. 다른 종목은 검색에서 찾을 수 있어요.</p>
<nav class="rp-links" aria-label="리포트 바로가기">${tile('#today', '최근 나온 리포트', '내 관심 종목 먼저')}${daily.length ? tile('#daily', '매일 AI 리포트', `${latest ? esc(latest.slice(5).replace('-', '/')) + ' 최신 · ' : ''}${daily.length}건`) : ''}${tile('#reports', '추적 종목', `${sorted.length}개`)}</nav></section>`;
  return shell('', 'AI 리포트 모음 | GNOMON', `${HOME_STYLE}<style>.rr-mine{background:var(--accent-soft)}.t-mine{background:var(--down-soft);color:var(--accent-strong)}</style>${head}${todayRows(data.entries)}${dailyRows(daily)}${reportRows(sorted, data.selection)}`, { scripts: HOME_SCRIPT + TODAY_LIST_SCRIPT, mode: 'reports.html' });
}


// G-201: one "내 종목" card: the stocks starred (☆) and the ones named in the survey, then the survey's sector chips
// (each opens its strongest theme today) and the screener preset that fits the holding period.
const WATCH = `<section class="block" id="watch"><span id="feed" class="anchor" aria-hidden="true"></span><div class="block-head"><h2>내 종목 오늘</h2><span class="muted" id="watch-where">로그인하면 계정에 저장돼요</span></div><div class="card my-card"><p class="feed-sum" id="feed-sum" hidden></p><div class="list" id="watch-list"><p class="empty">☆를 눌러 관심 종목·ETF·코인을 모아 보세요.</p></div><div id="feed-chips" class="feed-chips"></div><a class="feed-redo" href="settings.html#profile" id="feed-redo">내 투자 방식 바꾸기 ›</a></div></section>`;




export function renderHome(data: HomeData): string {
  // Reports someone requested stay off the front page (G-61): they are found by search and opened with credits.
  const entries = data.entries.filter((e) => e.group !== 'past' && e.group !== 'daily' && e.group !== 'request');
  const order = { core: 0, weekly: 1, request: 2, past: 3, daily: 4 } as const;
  const sorted = [...entries].sort((a, b) => order[a.group] - order[b.group] || (a.tier === b.tier ? 0 : a.tier === 'deep' ? -1 : 1));
  // G-266 (UI 덜어내기): four blocks: the date with the market in one line, my stocks, three issues, the scorecard line.
  // The notices sit as one slim line right under the date (한서님 10/20).
  // Search lives in 찾기; picks, saved screens, filings, the plan card and 더 보기 moved to their own tabs.
  const day = data.pulse?.date ?? data.indices[0]?.date ?? '';
  const body = `${HOME_STYLE}${marketLine(data.indices, latestDaily(data), day)}
${bannerHtml([...wrapupBanners(data.today ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)), ...(data.banners ?? []).map((b) => ({ kind: 'notice' as const, ...b })), ...eventBanners(openEvents(data.today ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10))), ...ALPHA_BANNERS])}
<i id="watch-slot" hidden></i>${WATCH}
<div class="home-grid"><div class="home-main">${NEWS_ISSUES_CARD}${scoreLine(sorted)}</div></div>
<footer id="sources" style="padding:24px 0 0"><p>데이터: Naver 금융, 네이버 증권, OpenDART, 네이버 뉴스 검색과 RSS. 계산 결과이고, 투자 권유가 아니에요.</p></footer>`;
  return shell('', 'GNOMON | 오늘 시장', body, { active: 'home', scripts: NEWS_ISSUES_SCRIPT + HOME_SCRIPT + FEED_SCRIPT + BANNER_JS });
}

/**
 * G-266 (UI 덜어내기, 한서님 10/20): the market as one line under the date. The big index card, the market sentence,
 * the bar and the four shortcuts are gone; the indices link to the market report.
 */
function marketLine(indices: readonly IndexQuote[], href: string, day: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일` : '오늘';
  const ix = indices.slice(0, 2).map((i) => `<span class="hh-ix">${esc(i.name)} <b>${i.close.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> <span class="${tone(i.changePct)}">${signed(i.changePct)}</span></span>`).join('');
  return `<section class="block hh" id="mkt-hero"><h1 class="hh-d">${d}</h1>${ix ? `<a class="hh-ixs" href="${esc(href)}">${ix}<span class="hh-go" aria-hidden="true">›</span></a>` : ''}</section>`;
}

/** G-244: the scorecard's headline as one line in the page (the full card stays in the wide screen's side rail). */
function scoreLine(entries: readonly HomeEntry[]): string {
  let scored = 0, inside = 0;
  for (const e of entries) for (const s of e.report?.market?.forecastScores ?? []) { scored += s.scored; inside += (s.coverage ?? 0) * s.scored; }
  if (!scored) return '';
  return `<section class="block sl-wrap"><a class="sl" href="scorecard.html"><b class="sl-v">${Math.round((inside / scored) * 100)}%</b><span><b>위원회 예측 범위 적중률</b><small>채점 ${scored.toLocaleString('ko-KR')}건 · 정직하면 80% 근처예요</small></span><span class="sl-go" aria-hidden="true">›</span></a></section>`;
}

/** The survey's part of 내 종목 (G-46, G-201): the note on top, the holding-period preset and the sector chips. */
const FEED_SCRIPT = `<script>
(function () {
  var prefs = null; try { prefs = JSON.parse(localStorage.getItem('gnm-prefs') || 'null'); } catch (e) {}
  var chipsEl = document.getElementById('feed-chips'), redo = document.getElementById('feed-redo'); if (!chipsEl) return;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // Without answers the card invites the survey (G-190).
  if (!prefs || !prefs.tickers && !prefs.sectors && !prefs.horizon) { if (redo) { redo.textContent = '설문하고 내 종목·관심 업종 채우기 ›'; redo.href = 'onboarding.html'; } return; }
  // Say at the top that this page follows their answers, with a way to change them.
  var bits = [prefs.experience && '경험 ' + prefs.experience, prefs.horizon && '보유 ' + prefs.horizon, (prefs.sectors || []).length && '관심 ' + prefs.sectors.slice(0, 2).join('·') + (prefs.sectors.length > 2 ? ' 외 ' + (prefs.sectors.length - 2) : '')].filter(Boolean);
  var note = document.getElementById('pz-note');
  if (note && bits.length) { document.getElementById('pz-text').innerHTML = '<b>내 설문에 맞춘 화면이에요.</b> ' + bits.map(function (b) { return String(b).replace(/[&<>"]/g, ''); }).join(' · ') + ' 기준으로 추천을 바꿨어요.'; note.hidden = false; }
  // A screener preset that fits how long they hold.
  var h = prefs.horizon || '', preset = /며칠/.test(h) ? ['hot', '거래 급증·급등'] : /몇 주/.test(h) ? ['rebound', '반등 후보'] : /몇 달/.test(h) ? ['value', '적정가 아래'] : /1년/.test(h) ? ['large', '대형주 강세'] : null;
  var chips = [];
  if (preset) chips.push('<a class="feed-preset" href="screener.html#' + preset[0] + '"><small>보유 기간 ' + esc(h) + '에 맞는 조건</small><b>' + preset[1] + ' 종목 보기 ›</b></a>');
  // G-201: a sector chip opens its strongest theme today (themes-home.json, built each day); no theme, 테마 전체.
  var sectors = (prefs.sectors || []).slice(0, 4);
  sectors.forEach(function (s, i) { chips.push('<a class="chip-link sec-chip" data-sec="' + i + '" href="themes.html"><b>' + esc(s) + '</b></a>'); });
  chipsEl.innerHTML = chips.join('');
  if (sectors.length) (window.gnmThemesHome = window.gnmThemesHome || fetch('themes-home.json').then(function (r) { return r.ok ? r.json() : null; })).then(function (j) {
    var map = (j && j.sectors) || {};
    sectors.forEach(function (s, i) {
      var t = (map[s] || [])[0], a = chipsEl.querySelector('[data-sec="' + i + '"]'); if (!t || !a) return;
      a.href = 'themes.html#' + encodeURIComponent(t[0]);
      a.setAttribute('aria-label', s + ' 관련 테마 ' + t[1] + ' 보기');
      a.innerHTML = '<b>' + esc(s) + '</b><small>' + esc(t[1]) + (t[2] == null ? '' : ' <i class="' + (t[2] > 0 ? 'up' : t[2] < 0 ? 'down' : '') + '">' + (t[2] > 0 ? '+' : '') + Number(t[2]).toFixed(1) + '%</i>') + '</small>';
    });
  }).catch(function () {});
})();
</script>`;


const HOME_STYLE = `<style>.wl-rail{position:relative;display:block;height:6px;margin:7px 0 3px;max-width:180px;border-radius:3px;background:linear-gradient(90deg,var(--down-soft,rgba(5,130,202,.18)) 0 33%,var(--track,rgba(0,0,0,.07)) 33% 67%,var(--up-soft,rgba(229,57,53,.16)) 67%)}.wl-rail i{position:absolute;top:50%;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:50%;background:var(--fg);box-shadow:0 0 0 2px var(--surface-solid,#fff)}
.wl-st{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12.5px;font-weight:600;margin-top:2px}.wl-new{color:var(--warn-strong);background:var(--warn-soft);border-radius:6px;padding:0 6px}
.tier.t-mine{background:var(--warn-soft);color:var(--warn-strong)}#sig-list{padding:6px 12px}#sig-list .row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 2px;border-top:1px solid var(--line);text-decoration:none;color:inherit;font-size:14px}#sig-list .row:first-child{border-top:0}#sig-list .row small{font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62vw}#sig-list .row>span:last-child{white-space:nowrap;font-weight:700}
.find-row{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;margin:8px 0 0}.find-row .flt-btn{margin:0}@media(max-width:820px){.find-row{gap:4px 8px}.find-row .find-link,.find-row .flt-btn{font-size:12px;white-space:nowrap}}.find-link{display:inline-flex;align-items:center;min-height:36px;font-size:14px;font-weight:800;text-decoration:none;color:var(--accent-strong)}
.flt-btn{display:flex;align-items:baseline;gap:8px;margin:8px 0 0;border:0;background:none;font:inherit;font-size:14px;font-weight:800;color:var(--accent-strong);cursor:pointer;padding:4px 2px}.flt-btn small{font-weight:500;color:var(--muted)}.flt{margin-top:6px;padding:14px 16px}.flt-k{font-size:12.5px;font-weight:800;color:var(--muted);margin:2px 0 6px}.flt-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}.flt-seg{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;background:var(--soft);border-radius:12px;padding:4px;margin-bottom:12px}.flt-seg a{text-align:center;padding:8px 4px;border-radius:9px;font-size:13.5px;font-weight:800;text-decoration:none;color:var(--fg)}.flt-seg a:hover{background:var(--surface)}.flt-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px;margin-bottom:12px}.flt-list a{display:flex;flex-direction:column;gap:2px;border:1px solid var(--line);border-radius:12px;padding:9px 12px;text-decoration:none;color:var(--fg);background:var(--surface)}.flt-list a:hover{border-color:var(--accent)}.flt-list b{font-size:14px}.flt-list small{font-size:12px;color:var(--muted);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.flt-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.flt-actions .flt-more{display:block;text-align:center;border-radius:12px;padding:10px;background:var(--navy);color:var(--on-accent);text-decoration:none;font-size:14px}.flt-actions .ai{background:var(--surface);color:var(--accent-strong);border:1.5px solid var(--accent)}.flt-foot{font-size:12px;color:var(--muted);margin:8px 0 0}.flt-row a{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:6px 12px;font-size:13.5px;font-weight:700;text-decoration:none;color:var(--fg)}.flt-row a:hover{border-color:var(--accent);color:var(--accent-strong)}.flt-more{font-weight:800;font-size:14px}.flt-pop{position:fixed;inset:0;z-index:160;background:rgba(10,20,35,.5);display:grid;place-items:center;padding:20px}.flt-sheet{width:min(1080px,100%);height:min(88vh,900px);background:var(--surface-solid);border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3)}.flt-top{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}.flt-top b{font-size:17px}.flt-x{border:0;background:none;font-size:28px;line-height:1;cursor:pointer;color:var(--muted)}.flt-sheet iframe{flex:1;border:0;width:100%}@media (max-width:820px){.flt-pop{padding:0;place-items:end stretch}.flt-sheet{height:92vh;border-radius:18px 18px 0 0}}
.ms-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.ms-grid.ms-single{grid-template-columns:minmax(0,1fr)}.ms-card{padding:12px 14px}.ms-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}.ms-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line);text-decoration:none;color:inherit;font-size:14px}
.ms-bell{font-size:13px}
.ms-stat{display:flex;align-items:baseline;gap:14px;margin:2px 0 8px;font-size:13px;color:var(--fg2)}.ms-n{font-size:26px;font-weight:800;color:var(--fg);margin-right:3px;font-variant-numeric:tabular-nums}
.ms-fresh{color:var(--accent-strong);font-weight:700}.ms-fresh b{font-size:15px}
.ms-l{display:flex;flex-direction:column;gap:3px;min-width:0}.ms-l b{display:flex;align-items:center;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ms-new{font-style:normal;font-size:10.5px;font-weight:800;padding:1px 6px;border-radius:999px;background:var(--accent-soft);color:var(--accent-strong)}
.ms-lv{font-style:normal;font-size:11.5px;font-weight:700;color:var(--fg2)}.ms-lv.up{color:var(--up)}.ms-lv.down{color:var(--down)}
.ms-r{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:none}.ms-px{display:flex;gap:6px;font-variant-numeric:tabular-nums;white-space:nowrap}
.ms-52{position:relative;display:block;width:72px;height:4px;border-radius:4px;background:linear-gradient(90deg,var(--down-soft),var(--soft),var(--up-soft))}.ms-52 i{position:absolute;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;background:var(--fg);box-shadow:0 0 0 2px var(--surface-solid)}
.ms-row:hover b{color:var(--accent-strong)}.ms-more{display:flex;align-items:center;min-height:36px;margin-top:2px;font-size:13px;font-weight:700}.ms-note{grid-column:1/-1}
.pw{display:none}html[data-persona=beginner] .pw-beginner,html[data-persona=trader] .pw-trader,html[data-persona=swing] .pw-swing,html[data-persona=all] .pw-swing,html[data-persona=long] .pw-long,html:not([data-persona]) .pw-swing{display:inline}.tp[hidden]{display:none}.tp-lead{margin:-4px 0 10px;font-size:13px;color:var(--fg2)}.tp-lead a{font-weight:700;margin-left:6px}
.tmp{text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:7px}.tmp:hover{border-color:var(--accent)}.tmp-v{font-size:19px}.tmp .pulse-bar{height:12px}.tmp-n{display:flex;justify-content:space-between;font-size:13px;font-weight:700}
.tp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.tp{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 44px 14px 16px}.tp:hover{border-color:var(--accent)}.tp .star{position:absolute;top:8px;right:6px}.tp-main{text-decoration:none;color:inherit;display:block}.tp-top{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.tp-why{font-size:12px;color:var(--accent-strong);font-weight:700}.tp-name{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.tp-name>b{font-size:17px}.tp-px{font-size:14px}.tp-line{margin:6px 0 0;font-size:14px;line-height:1.6;color:var(--fg2);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.top-search{margin:14px 0 0;padding:0}.top-search .search-box{background:var(--surface);border:1px solid var(--line-strong)}.top-search .search-box input{font-size:16px}
.home-mkt{margin-top:12px}.home-mkt .mkt-tabs{margin-top:0}.ph-off{display:none!important}.show-more{text-align:center;margin:18px 0 6px}.btn-ghost{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:10px 18px;font:inherit;font-weight:700;cursor:pointer}
.pz-note .persona-bar{margin-left:auto}@media (max-width:820px){.top-search{margin-top:10px}.pz-note .persona-bar{margin-left:0}}
.pz-note{max-width:1180px;margin:10px auto 0;padding:0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--fg2)}.pz-note>span{flex:1;min-width:200px;background:var(--soft);border-radius:12px;padding:9px 12px}.pz-note b{color:var(--accent-strong)}.pz-edit{font-weight:700;font-size:13px;text-decoration:none;border:1px solid var(--accent);color:var(--accent-strong);border-radius:999px;padding:7px 12px;background:var(--surface);white-space:nowrap}@media (max-width:820px){.pz-note{padding:0 14px}}
.dl-day{font-size:12px;font-weight:700;color:var(--accent-strong);padding:10px 0 2px}.dl-old{border-top:1px solid var(--line);margin-top:4px;color:var(--muted)}.tier.t-k{background:var(--soft);color:var(--fg2)}
.mkt-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.mkt-tabs a{display:flex;flex-direction:column;gap:1px;border:1px solid var(--line-strong);border-radius:12px;padding:9px 12px;background:var(--surface);text-decoration:none;color:var(--fg);font-weight:700;font-size:14px}.mkt-tabs a small{font-weight:500;font-size:11px;color:var(--muted)}.mkt-tabs a:hover{border-color:var(--accent)}

.feed-redo{flex:none;font-size:13px;font-weight:700;color:var(--fg2)}
.feed-sum{margin:12px 0 2px;font-size:13.5px;color:var(--fg2)}.feed-sum b{color:var(--fg)}
/* G-201 */ .my-card{padding-top:6px}.my-card .feed-sum{margin:6px 0 4px}.my-card .feed-redo{display:inline-block;margin-top:12px;font-size:13px;font-weight:700;color:var(--fg2);text-decoration:none}.anchor{display:block;position:relative;top:-80px}
.sec-chip{display:inline-flex;flex-direction:column;align-items:flex-start;gap:1px;padding:8px 14px;border-radius:14px;text-decoration:none;line-height:1.3}.sec-chip b{font-size:14px}.sec-chip small{font-size:12px;color:var(--muted);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sec-chip small i{font-style:normal;font-weight:800}.sec-chip small i.up{color:var(--up-strong)}.sec-chip small i.down{color:var(--down-strong)}
.feed-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}.feed-chips:empty{display:none}
.feed-preset{flex:1 1 100%;display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:14px;background:var(--surface);border:1px solid var(--line);text-decoration:none;color:var(--fg)}.feed-preset small{font-size:12px;color:var(--muted)}.feed-preset b{font-size:14.5px;color:var(--accent-strong)}.feed-go{width:100%;justify-content:center}
.chip-link{display:inline-flex;align-items:center;border:1px solid var(--line-strong);border-radius:999px;padding:5px 11px;font-size:13px;text-decoration:none;background:var(--surface)}.chip-link.alt{border-color:var(--navy);color:var(--navy);font-weight:700}.muted-chip{color:var(--muted);background:var(--soft)}
.home-hero{grid-template-columns:minmax(0,1fr)}.home-hero h1{font-size:30px}.home-hero .search-block{margin-top:14px;position:relative}
.ix-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ix-row.ix-4{grid-template-columns:repeat(4,minmax(0,1fr))}.ix-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.ix-v{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}.ix-c{font-weight:600;font-size:14px}
.br-bar,.pulse-bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;margin:10px 0 6px}.pulse-bar>span,.br-bar>span{min-width:4px}.br-bar .s-bull{background:var(--up)}.br-bar .s-neutral{background:var(--line-strong)}.br-bar .s-bear{background:var(--down)}.br-n{display:flex;justify-content:space-between;font-weight:700;font-size:14px}
.tt-list{padding:4px 14px}.tt-row{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line);text-decoration:none;color:inherit}.tt-row:first-child{border-top:0}.tt-n{font-weight:800;color:var(--muted);text-align:center}.tt-main b{display:block;font-size:14.5px}.tt-main small{display:block;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tt-v{font-weight:800;text-align:right;font-variant-numeric:tabular-nums}.tt-v small{display:block;font-weight:500;color:var(--muted);font-size:11px}.home-grid{display:block;max-width:760px}.home-rail{position:sticky;top:76px}
.pulse-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}.pulse-head b{font-size:22px}.pulse-bar{height:16px;border-radius:8px}
.pulse-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--fg2)}.pulse-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.rr{display:grid;grid-template-columns:minmax(0,1fr) auto 36px;gap:10px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}.rr-chips{padding:10px 0 4px}
.rr-main{text-decoration:none;min-width:0}.rr-name{display:flex;align-items:center;flex-wrap:wrap;gap:3px 6px;min-width:0}.rr-name b{font-size:15px;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rr-name .tier{flex:none;white-space:nowrap}.rr-line{margin:2px 0 0;font-size:13px;color:var(--fg2);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.rr-side{display:flex;flex-direction:column;align-items:flex-end;gap:1px;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}@media(max-width:520px){.rr{grid-template-columns:minmax(0,1fr) auto 28px;gap:8px}.rr-side b{font-size:13.5px}.rr-side span{font-size:12px}.rr-line{-webkit-line-clamp:1}}.rp-head{padding:18px;margin:16px 0 12px}.rp-head h1{font-size:24px;margin:2px 0 6px}.rp-head p{margin:0 0 12px;font-size:14px}.rp-links{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.rp-links a{display:flex;flex-direction:column;gap:2px;border:1px solid var(--line);border-radius:12px;padding:11px 13px;text-decoration:none;color:var(--fg);background:var(--soft)}.rp-links a:hover{border-color:var(--accent)}.rp-links b{font-size:14.5px}.rp-links small{font-size:12px;color:var(--muted)}.rr-side b{font-size:14px}.sig{font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px;background:var(--soft);color:var(--fg2)}.sig.up{background:var(--up-soft);color:var(--up-strong)}.sig.down{background:var(--down-soft);color:var(--down-strong)}
.tier{font-size:11px;font-weight:700;border-radius:999px;padding:1px 7px;white-space:nowrap;background:var(--soft);color:var(--fg2)}.tier.t-core{background:var(--navy);color:var(--on-accent)}.tier.t-request{background:var(--warn-soft);color:var(--warn-strong)}
.rr[hidden]{display:none}

.mv-tabs{margin:10px 0 4px}.mvr{display:grid;grid-template-columns:22px minmax(0,1fr) auto 36px;gap:8px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}.mvr-i{color:var(--muted);font-weight:700;font-size:13px}.mvr-n{text-decoration:none;display:flex;flex-direction:column;min-width:0}.mvr-n b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mvr-v{display:flex;flex-direction:column;align-items:flex-end;font-size:13px;font-variant-numeric:tabular-nums}
.sc-free{margin-bottom:10px}.sc-k{font-size:12px;font-weight:700;color:var(--muted)}.sc-v{font-size:28px;font-weight:800}.sc-board{margin:6px 0 0;padding-left:18px}.sc-board li{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;padding:4px 0;font-size:14px}
.fl{display:grid;grid-template-columns:44px minmax(0,1fr);gap:8px;padding:9px 0;border-top:1px solid var(--line)}.fl:first-child{border-top:0}.fl a{text-decoration:none}
.plan-cta p{font-size:14px;margin:8px 0}.plan-cta .btn-primary{width:100%;justify-content:center}
.wl{display:grid;grid-template-columns:minmax(0,1fr) auto 36px;gap:8px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}.wl:first-child{border-top:0}.wl a{text-decoration:none}
@media (max-width:1100px){.home-grid{grid-template-columns:minmax(0,1fr)}.home-rail{position:static}}
@media (max-width:820px){.ix-row,.ix-row.ix-4{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.ix-row>.tmp{grid-column:1/3}.ix .spark{display:none}.ix-v{font-size:18px}.home-hero h1{font-size:24px}.home-hero .hero-line{display:block;font-size:13px}.rr-chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.rr-chips>*{flex:none}}
/* G-244 화면 개편 1단계: home */
.mh{margin-top:14px}.mh-card{padding:20px 20px 16px;border-radius:26px;background:var(--surface);border:1px solid var(--glass-line);box-shadow:var(--shadow);backdrop-filter:blur(var(--glass-blur));-webkit-backdrop-filter:blur(var(--glass-blur))}
.mh-top{display:flex;justify-content:space-between;align-items:baseline;font-size:15px;font-weight:600;color:var(--fg)}.mh-top small{font-size:12.5px;font-weight:500;color:var(--muted)}
.mh-big{display:block;margin:6px 0 2px;text-decoration:none;color:var(--fg)}.mh-big b{display:block;font-size:46px;line-height:1.1;font-weight:300;letter-spacing:-.035em;font-variant-numeric:tabular-nums}.mh-big small{font-size:13px;color:var(--muted);font-weight:500}.mh-big small span{font-weight:700}
.mh-main{display:block;text-decoration:none;color:var(--fg)}.mh-k{font-size:13px;color:var(--muted)}.mh-v{margin:12px 0 12px;font-size:15.5px;line-height:1.5;font-weight:500;letter-spacing:-.01em;color:var(--fg2)}
.mh-bar{display:flex;gap:2px;height:5px;border-radius:3px;overflow:hidden}.mh-bar span{min-width:3px}.mh-bar .s-bull{background:var(--up)}.mh-bar .s-neutral{background:var(--line-strong)}.mh-bar .s-bear{background:var(--down)}
.mh-n{display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:12px;font-weight:700}.mh-n .mh-base{font-weight:500;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mh-strip{display:flex;align-items:center;gap:8px;margin-top:12px;padding:2px 2px 2px 14px;border-radius:14px;background:var(--soft)}.mh-ixs{display:flex;flex-wrap:wrap;gap:4px 14px;flex:1;min-width:0;padding:8px 0;text-decoration:none;color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}.mh-ix b{color:var(--fg);font-weight:600}.mh-ix span{font-size:12.5px}
.mh-go{display:grid;grid-template-columns:repeat(4,1fr);margin-top:16px}.mh-go a{display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none;color:var(--fg2);font-size:12.5px;font-weight:600}
.mh-go i{display:grid;place-items:center;width:50px;height:50px;border-radius:50%;background:var(--pill);border:1px solid var(--line);box-shadow:0 6px 16px -10px rgba(10,22,38,.35);color:var(--fg);transition:transform .2s cubic-bezier(.34,1.5,.64,1)}.mh-go a:active i{transform:scale(.9)}.mh-go svg{width:21px;height:21px}
#news-issues .card{border-radius:26px}#ni-home .ni-stocks,#ni-home-when{display:none}#ni-home .ni-row{grid-template-columns:30px minmax(0,1fr) auto;align-items:center;padding:12px 0}#ni-home .ni-n{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:var(--soft);font-size:13px}#ni-home .ni-t{-webkit-line-clamp:1;font-weight:600}
.mh-us-btn{flex:none;min-height:40px;padding:0 12px;border:0;background:none;font:inherit;font-size:13.5px;font-weight:700;color:var(--fg2);cursor:pointer}.mh-us{margin-top:10px}.mh-us[hidden]{display:none}
.hh{margin-top:18px}.hh-d{margin:0;font-size:26px;line-height:1.25;font-weight:500;letter-spacing:-.02em;color:var(--fg)}.hh-ixs{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;margin-top:4px;font-size:13px;color:var(--muted);text-decoration:none}.hh-ix b{font-weight:600;color:var(--fg);font-variant-numeric:tabular-nums}.hh-go{margin-left:auto}#mkt-hero+#watch-slot+#watch,.hh+#watch-slot+#watch{margin-top:22px}
#mkt-hero~.banner{margin-top:14px}:root body #mkt-hero~.banner .bn-slide{display:flex;align-items:center;gap:10px;min-height:56px;padding:9px 14px;border-radius:18px;background:var(--surface);border:1px solid var(--glass-line,var(--line));box-shadow:none;color:var(--fg);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
:root body #mkt-hero~.banner .bn-tag{flex:none;order:1;background:var(--soft);color:var(--fg2);font-size:11px;font-weight:600}:root body #mkt-hero~.banner .bn-art{flex:none;order:0;width:30px;height:30px;font-size:16px;background:var(--soft);box-shadow:none}:root body #mkt-hero~.banner .bn-slide b{order:2;flex:1;min-width:0;font-size:14.5px;font-weight:500;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
:root body #mkt-hero~.banner .bn-text{display:none}:root body #mkt-hero~.banner .bn-cta{order:3;margin:0;padding:5px 11px;font-size:12.5px;font-weight:600;background:none;border:1px solid var(--line-strong);color:var(--fg)}:root body #mkt-hero~.banner .bn-logo{order:0;flex:none;width:auto;height:22px;border-radius:4px}:root body #mkt-hero~.banner .bn-benefits{order:4;flex:none}:root body #mkt-hero~.banner .bn-benefits[open]{flex-basis:100%}
:root body #mkt-hero~.banner .bn-dots{position:static;transform:none;justify-content:center;margin-top:4px;background:none}:root body #mkt-hero~.banner .bn-dots button::before{background:var(--line-strong)}:root body #mkt-hero~.banner .bn-dots button[aria-pressed=true]::before{background:var(--fg)}
.home-main>.block{margin-top:28px}.home-main>.block[hidden]{display:none}
.tp-grid{gap:0;grid-template-columns:minmax(0,1fr)}.tp{background:none;border:0;border-top:1px solid var(--line);border-radius:0;padding:14px 40px 14px 0}.tp:first-child{border-top:0}.tp:hover{border-color:var(--line)}.tp .star{top:10px;right:-4px}.tp-line{margin:4px 0 0;font-size:13.5px;color:var(--fg2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media (min-width:821px){.tp-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.tp{border:1px solid var(--line);border-radius:14px;padding:14px 40px 14px 16px;background:var(--surface)}.tp:first-child{border-top:1px solid var(--line)}.tp .star{top:8px;right:6px}}
.sl{display:flex;align-items:center;gap:14px;padding:16px;border-radius:14px;background:var(--soft);text-decoration:none;color:var(--fg)}.sl-v{font-size:30px;font-weight:800;color:var(--accent-strong);font-variant-numeric:tabular-nums}.sl span{display:flex;flex-direction:column;gap:2px;min-width:0}.sl span b{font-size:15px}.sl small{font-size:13px;color:var(--muted)}.sl-go{margin-left:auto;color:var(--muted)}
.ml-row{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 0;border-top:1px solid var(--line);text-decoration:none;color:var(--fg)}.ml-row:first-child{border-top:0}.ml-row>span:first-child{display:flex;flex-direction:column;gap:2px;min-width:0}.ml-row b{font-size:15px}.ml-row small{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ml-row small i{font-style:normal;font-weight:700}.ml-row small i.up{color:var(--up)}.ml-row small i.down{color:var(--down)}.ml-go{margin-left:auto;color:var(--muted)}
.home-grid+.banner{margin-top:28px}@media (max-width:1100px){.home-rail{display:none}}
.wl-px{display:flex;flex-direction:column;align-items:flex-end;gap:1px;font-variant-numeric:tabular-nums;white-space:nowrap}.wl-px b{font-weight:600}.wl-st{font-size:12.5px;font-weight:600}
</style>`;

const HOME_SCRIPT = `<script>
(function () {
  var KEY = 'gnm-watch';
  var read = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  // The alpha layer keeps the list on the server too (intraday alerts); it listens for this event.
  var write = function (w) { try { localStorage.setItem(KEY, JSON.stringify(w)); localStorage.setItem('gnm-watch-at', String(Date.now())); } catch (e) {} window.dispatchEvent(new Event('gnm-watch')); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var items = null, info = null;
  fetch('watchinfo.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { info = d; drawWatch(); }).catch(function () {});
  var drawWatch = function () {
    var w = read(), box = document.getElementById('watch-list'); if (!box) return;
    document.querySelectorAll('[data-star]').forEach(function (b) { b.setAttribute('aria-pressed', String(w.indexOf(b.getAttribute('data-star')) >= 0)); });
    // G-201: 내 종목 is the starred list (the survey stars the stocks it names, so ☆ also takes one off);
    // the survey's names stand in until the lists load.
    var named = {}, mineList = w;
    try { ((JSON.parse(localStorage.getItem('gnm-prefs') || 'null') || {}).tickers || []).forEach(function (t) { if (t && t[0]) named[t[0]] = t[1]; }); } catch (e) {}
    var sum = document.getElementById('feed-sum');
    // G-257: my stocks open home; with none yet the card waits under 오늘의 이슈.
    var wEl = document.getElementById('watch'), slot = document.getElementById('watch-slot'), hm = document.querySelector('.home-main');
    if (wEl && slot && hm) { if (mineList.length) { if (slot.nextElementSibling !== wEl) slot.after(wEl); } else if (wEl.parentNode !== hm) hm.insertBefore(wEl, hm.children[1] || null); }
    if (!mineList.length) { box.innerHTML = '<p class="empty">☆를 눌러 관심 종목·ETF·코인을 모아 보세요.</p>'; if (sum) sum.hidden = true; return; }
    var show = function () {
      var up = 0, dn = 0;
      box.innerHTML = mineList.map(function (sym) {
        var it = (items || []).find(function (x) { return x[0] === sym; }) || [sym, named[sym] || sym, '', null, null, 0], starred = w.indexOf(sym) >= 0;
        if (it[4] > 0) up++; else if (it[4] < 0) dn++;
        var ch = it[4], coin = sym.indexOf('KRW-') === 0, href = it[5] ? sym + '/index.html' : coin ? 'coin.html?m=' + sym : 'stock.html?c=' + sym;
        var p = it[3], price = p == null ? '' : '<b data-live="' + esc(sym) + '" data-live-f="price">' + (Math.abs(p) >= 100 ? Math.round(p).toLocaleString('ko-KR') : p.toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + '원</b> ';
        var wi = info && info[sym], st = '';
        if (wi) {
          var near = [wi.up ? ['▲', wi.up] : null, wi.dn ? ['▼', wi.dn] : null].filter(Boolean).map(function (x) { return [x[0], x[1], (x[1] / (p || wi.c) - 1) * 100]; }).sort(function (a, b) { return Math.abs(a[2]) - Math.abs(b[2]); })[0];
          // G-244: one line under the name: a new filing first, else the nearest price level. News counts stay on the stock page.
          // G-257: the stock's scenario strip in small — 약세 전환 at the left, 강세 전환 at the right, a dot for now.
          var now = p || wi.c, rail = '';
          if (wi.up && wi.dn && now && wi.up > wi.dn) { var at = Math.max(0, Math.min(100, (now - wi.dn) / (wi.up - wi.dn) * 100)); rail = '<span class="wl-rail" role="img" aria-label="약세 전환 ' + Math.round(wi.dn).toLocaleString('ko-KR') + '원과 강세 전환 ' + Math.round(wi.up).toLocaleString('ko-KR') + '원 사이 ' + Math.round(at) + '% 자리"><i style="left:' + at.toFixed(1) + '%"></i></span>'; }
          st = rail + (wi.f ? '<div class="wl-st"><span class="wl-new">새 공시 ' + wi.f + '건</span></div>' : near ? '<div class="wl-st"><span class="' + (near[0] === '▲' ? 'up' : 'down') + '">' + (near[0] === '▲' ? '강세' : '약세') + ' 전환 가격까지 ' + (near[2] > 0 ? '+' : '') + near[2].toFixed(1) + '%</span></div>' : '');
        }
        return '<div class="wl"><a href="' + href + '"><b>' + esc(it[1]) + '</b>' + (coin || it[2] === 'ETF' ? ' <span class="muted small">' + (coin ? '코인' : 'ETF') + '</span>' : '') + st + '</a><span class="wl-px">' + price + (ch == null ? '' : '<span class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '" data-live="' + esc(sym) + '" data-live-f="pct">' + (ch > 0 ? '▲ +' : ch < 0 ? '▼ ' : '') + ch.toFixed(2) + '%</span>') + '</span><button type="button" class="star" data-star="' + esc(sym) + '" aria-pressed="' + starred + '" aria-label="' + (starred ? '관심 종목에서 빼기' : '관심 종목에 담기') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/></svg></button></div>';
      }).join('');
      if (sum) { sum.innerHTML = '내 종목 <b>' + mineList.length + '</b>개' + (items ? ' · <span class="up">▲ ' + up + '</span> · <span class="down">▼ ' + dn + '</span>' : ''); sum.hidden = false; }
    };
    show();
    // Stocks from search.json; ETFs and coins from their lists (same row shape: code, name, market, price, change, report).
    if (!items) {
      var list = function (url, kind) { return fetch(url).then(function (r) { return r.json(); }).then(function (d) { return (d.rows || []).map(function (x) { return [x[0], x[1], kind, x[4], x[5], 0]; }); }).catch(function () { return []; }); };
      Promise.all([(window.gnmSearchJson = window.gnmSearchJson || fetch('search.json').then(function (r) { return r.json(); })).then(function (d) { return d.items; }).catch(function () { return []; }), list('etfs.json', 'ETF'), list('coins.json', 'COIN')]).then(function (all) {
        var seen = {}; items = [];
        all.forEach(function (xs) { xs.forEach(function (x) { if (!seen[x[0]]) { seen[x[0]] = 1; items.push(x); } }); });
        show();
      });
    }
  };
  // Stars anywhere on the page toggle through the shared script (assets/ui.js), which fires this event.
  window.addEventListener('gnm-watch', drawWatch);
  drawWatch();
  // Report filters.
  document.querySelectorAll('[data-rf]').forEach(function (c) {
    c.addEventListener('click', function () {
      var f = c.getAttribute('data-rf');
      document.querySelectorAll('[data-rf]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === c)); });
      document.querySelectorAll('.rr').forEach(function (r) { r.hidden = !!f && r.getAttribute('data-kind') !== f && r.getAttribute('data-lean') !== f; });
    });
  });
  // Movers tabs.
  document.querySelectorAll('[data-mv]').forEach(function (t) {
    t.addEventListener('click', function () {
      var k = t.getAttribute('data-mv');
      document.querySelectorAll('[data-mv]').forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); x.setAttribute('aria-pressed', String(x === t)); });
      document.querySelectorAll('[data-mvl]').forEach(function (l) { l.hidden = l.getAttribute('data-mvl') !== k; });
    });
  });
})();
</script>`;
