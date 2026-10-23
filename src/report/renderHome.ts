import { partButtons } from './ui.js';
import { marketsOf, worldPanels, WORLD_CSS, WORLD_JS } from './renderWorld.js';
import { ISSUES_CSS, ISSUES_FILTER, issuesList, mergeIssues, type MergedIssue } from './issuesAll.js';
import type { NewsDigest } from '../analysis/newsDigest.js';
import { scenarioZone } from './scenarioChart.js';
import { kmStatArea } from './kit/market.js';
import type { NewsIssueBoard } from '../analysis/newsIssues.js';
import type { WorldIssueBoard } from '../analysis/worldNews.js';
import type { WorldMarkets } from '../sources/naverGlobal.js';
import type { MarketReport } from './marketReport.js';
// Site front page as a market dashboard (docs/DESIGN.md §3.7, G-31). It answers
// "what should I look at now?" (BOR North Star §2): the indices and breadth,
// the market's temperature from every stock's free computation, this week's AI
// reports as one-line rows, today's movers, a watchlist kept in the browser,
// the scorecard summary and this week's filings. Pure rendering.

import type { UniverseRow } from '../sources/naverList.js';
import type { MarketPulse, StockCalc } from '../analysis/quickCalc.js';
import { madeOn, shell, type HomeEntry } from './renderHtml.js';
import { ALPHA_BANNERS, BANNER_JS, bannerHtml, eventBanners, wrapupBanners, type Banner } from './alphaPages.js';
import { openEvents } from './events.js';
import { esc } from './html.js';
import { CONTENT_MORE_CSS } from './contentMore.js';
import { fadeGrad, gradId, smoothD } from './chartLook.js';
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
  /** G-276: the world screen's snapshot, for the one-sentence summary and the S&P 500 and won numbers under the date. */
  world?: WorldMarkets | null;
  /** G-277: Korean stock news issues and world issues, merged into one ranking on home. */
  krIssues?: NewsIssueBoard | null;
  worldIssues?: WorldIssueBoard | null;
  /** G-284: AI summaries and preview pictures by issue key, and closes by symbol for the stock rows. */
  digests?: ReadonlyMap<string, NewsDigest>;
  closes?: ReadonlyMap<string, number | null>;
}

/** G-284: the merged issue ranking home shows; daily writes one in-app page per row from the same list. */
export function homeIssues(data: Pick<HomeData, 'world' | 'krIssues' | 'worldIssues' | 'digests' | 'closes'>): MergedIssue[] {
  const mk = data.world ? marketsOf(data.world) : null;
  return mergeIssues(data.krIssues, data.worldIssues, (k) => { const x = mk?.get(k); return x ? { name: x.name, move: x.move, tone: x.tone } : null; }, { ...(data.digests ? { digests: data.digests } : {}), ...(data.closes ? { closes: data.closes } : {}) });
}

export interface UsTemp { pulse: MarketPulse | null; date: string; up: number; down: number; flat: number }

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/></svg>';
const star = (symbol: string, name: string) => `<button type="button" class="star" data-star="${esc(symbol)}" aria-pressed="false" aria-label="${esc(name)} 관심 종목">${STAR}</button>`;




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
  const row = reportRow;
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

/** One report row: name, kind, the committee's date, its first line, price and the ☆. */
function reportRow(e: HomeEntry): string {
  const r = e.report!, p = r.price, c = r.commentary?.status === 'OK' ? r.commentary : undefined;
  const line = (c?.summary?.text ?? r.headline ?? '').split(/(?<=요\.)\s/)[0] ?? '';
  return `<div class="rr" data-sym="${esc(e.symbol)}"><a class="rr-main" href="${esc(e.href)}"><div class="rr-name"><b>${esc(e.name)}</b>${e.kind && e.kind !== 'stock' ? `<span class="tier t-k">${KIND[e.kind]}</span>` : ''}${aiPill(e)}</div><p class="rr-line">${esc(line)}</p></a>
<div class="rr-side">${p ? `<b>${won(p.close)}</b><span class="${tone(p.changePct)}">${signed(p.changePct)}</span>` : ''}</div>${star(e.symbol, e.name)}</div>`;
}

/**
 * G-281 (한서님 10/22 "분류가 각 종류에 맞게", 앱 전체 구조): every report in one stream, each stock once.
 * The newest day stays #today (the 🔔 links land there, watched stocks first); older reports — daily picks and tracked
 * stocks alike — follow by the day they were made, newest first, ten shown and the rest folded.
 */
function pastRows(entries: readonly HomeEntry[], skip: ReadonlySet<string>): string {
  const best = new Map<string, HomeEntry>();
  for (const e of entries) {
    if (!e.report || !madeOn(e) || e.group === 'past' || skip.has(e.symbol)) continue;
    const had = best.get(e.symbol);
    if (!had || madeOn(e) > madeOn(had)) best.set(e.symbol, e);
  }
  const list = [...best.values()].sort((a, b) => madeOn(b).localeCompare(madeOn(a)) || a.name.localeCompare(b.name, 'ko'));
  if (!list.length) return '';
  const rows: string[] = [];
  let last = '';
  for (const e of list) { const d = madeOn(e); if (d !== last) { rows.push(`<div class="dl-day dl-old">${esc(d.slice(5).replace('-', '/'))}</div>`); last = d; } rows.push(reportRow(e)); }
  const cut = rows.findIndex((_, i) => rows.slice(0, i + 1).filter((x) => x.startsWith('<div class="rr"')).length === 10);
  const head = cut < 0 ? rows : rows.slice(0, cut + 1), rest = cut < 0 ? [] : rows.slice(cut + 1);
  return `<section class="block" id="past"><div class="block-head"><h2>지난 리포트 ${list.length}개</h2><span class="muted">만든 날짜 순</span></div>
<div class="card list rr-list">${head.join('')}${rest.length ? `<details class="more content-more rp-rest"><summary><span class="more-closed">${list.length - 10}개 더 보기</span><span class="more-open">접기</span></summary>${rest.join('')}</details>` : ''}</div></section>`;
}

/** 위원회 › 리포트: the newest day's reports, then the rest in one stream (G-281). */
export function renderReportsPage(data: HomeData): string {
  const all = data.entries.filter((e) => e.group !== 'request');
  const withDate = all.filter((e) => e.report && madeOn(e) && e.group !== 'past');
  const day = withDate.map(madeOn).sort().at(-1);
  const todaySyms = new Set(withDate.filter((e) => madeOn(e) === day).map((e) => e.symbol));
  const waiting = all.filter((e) => e.group !== 'past' && e.group !== 'daily' && !(e.report && madeOn(e)));
  const wait = waiting.length ? `<details class="card rp-wait"><summary>리포트를 기다리는 추적 종목 ${waiting.length}개</summary><p class="muted small">${waiting.map((e) => esc(e.name)).join(' · ')}</p></details>` : '';
  const head = `<section class="rp-top"><p class="muted">AI 위원회가 쓴 리포트예요. 관심 종목이 맨 위에 와요.</p></section>`;
  const how = `<details class="card rp-how"><summary>매일 리포트 종목은 이렇게 골라요</summary><p>주식은 스크리너 추천 조건에 걸린 종목(과열·위험 조건과 시가총액 1,000억 원 미만 제외) 가운데 날짜마다 2개를 뽑아요. ETF는 거래대금 상위 20개(레버리지·인버스·채권형 제외), 코인은 거래대금 상위 15개(스테이블코인 제외)에서 하나를 골라요. 추적 종목은 대표 종목과 시가총액·거래대금·공시·움직임으로 골라요. 시나리오 해설이고, 투자 권유가 아니에요.</p></details>`;
  return shell('', 'AI 리포트 | GNOMON', `${HOME_STYLE}<style>${CONTENT_MORE_CSS}.rr-mine{background:var(--accent-soft)}.t-mine{background:var(--down-soft);color:var(--accent-strong)}.rp-top p{margin:0 4px 4px;font-size:14px}.rp-how,.rp-wait{margin:12px 0;padding:4px 16px}.rp-how summary,.rp-wait summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-size:14px;font-weight:600}.rp-how p{font-size:13px;color:var(--muted);line-height:1.55}.rp-rest>summary{display:flex;justify-content:center;align-items:center;min-height:48px;border-top:1px solid var(--line);font-size:13.5px;font-weight:700;color:var(--fg2);cursor:pointer;list-style:none}.rp-rest>summary::-webkit-details-marker{display:none}</style>${head}${todayRows(data.entries)}${pastRows(all, todaySyms)}${wait}${how}`, { scripts: HOME_SCRIPT + TODAY_LIST_SCRIPT, mode: 'reports.html' });
}


// G-201: one "내 종목" card: the stocks starred (☆) and the ones named in the survey, then the survey's sector chips
// (each opens its strongest theme today) and the screener preset that fits the holding period.
const WATCH = `<section class="block" id="watch"><span id="feed" class="anchor" aria-hidden="true"></span><div class="block-head"><h2>내 종목 오늘</h2><span class="muted" id="watch-where">로그인하면 계정에 저장돼요</span></div><div class="card my-card"><p class="feed-sum" id="feed-sum" hidden></p><div class="list" id="watch-list"><p class="empty">☆를 눌러 관심 종목·ETF·코인을 모아 보세요.</p></div><div id="feed-chips" class="feed-chips"></div><a class="feed-redo" href="settings.html#profile" id="feed-redo">내 투자 방식 바꾸기 ›</a></div></section>`;




export function renderHome(data: HomeData): string {
  // Reports someone requested stay off the front page (G-61): they are found by search and opened with credits.
  const entries = data.entries.filter((e) => e.group !== 'past' && e.group !== 'daily' && e.group !== 'request');
  const order = { core: 0, weekly: 1, request: 2, past: 3, daily: 4 } as const;
  const sorted = [...entries].sort((a, b) => order[a.group] - order[b.group] || (a.tier === b.tier ? 0 : a.tier === 'deep' ? -1 : 1));
  // G-277 (한서님 10/21 "세계+위원회를 거의 메인으로"): home is the world screen and the committee in one page.
  // G-281: four parts (요약 · 시장 · 위원회 · 이슈), switched from the bottom bar; a switch goes back to the top.
  const today = data.today ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const day = data.pulse?.date ?? data.indices[0]?.date ?? today;
  const banner = bannerHtml([...wrapupBanners(today), ...(data.banners ?? []).map((b) => ({ kind: 'notice' as const, ...b })), ...eventBanners(openEvents(today)), ...ALPHA_BANNERS]);
  const wp = data.world && (data.world.indices.length || data.world.macro.length) ? worldPanels({ markets: data.world, news: data.worldIssues ?? { from: null, to: null, articles: 0, issues: [] } }) : null;
  const issues = homeIssues(data);
  const calls = committeeToday(data.entries);
  // G-281 (한서님 10/22 "구조화시켜서 분류가 각 종류에 맞게"): four parts, one kind each, every number in one place.
  // 요약 = a taste of each kind (내 종목, four numbers, the committee, issues); 시장 = numbers; 위원회 = calls; 이슈 = news.
  const key = wp ? `<div class="hm-h"><h2>시장</h2><button type="button" class="wd-link" data-wd-go="market">시장 전체 ›</button></div><div class="km-stats wd-stats">${wp.key6}</div>` : fallbackNumbers(data.indices);
  const comBlock = calls.length ? `<div class="hm-h"><h2>위원회 오늘</h2><button type="button" class="wd-link" data-wd-go="com">${calls.length}개 전체 ›</button></div><section class="card hm-card">${calls.slice(0, 3).map(callRow).join('')}</section>` : '';
  const issueBlock = `<div class="hm-h"><h2>오늘 이슈</h2><button type="button" class="wd-link" data-wd-go="news">${issues.length ? `${issues.length}개 ` : ''}전체 ›</button></div><section class="card hm-card">${issuesList(issues, 3, false)}</section>`;
  const sum = `<section class="hm-hero" id="mkt-hero"><p class="hm-d">${esc(dayLong(day))}</p><p class="hm-s">${esc(wp?.sentence ?? '오늘 시장을 한눈에 모았어요.')}</p></section>
<div class="hm-bn">${banner}</div>
<i id="watch-slot" hidden></i>${WATCH}${key}${comBlock}${issueBlock}`;
  const com = `<p class="hm-lead">오늘 위원회가 본 종목이에요. 막대는 앞으로 20거래일 범위(왼쪽부터 약세·기본·강세), 점선은 지금 가격이에요.</p>
<section class="card hm-card">${calls.length ? calls.map(callRow).join('') : '<p class="muted">아직 오늘 나온 위원회 리포트가 없어요.</p>'}</section>
${scoreLine(sorted)}<a class="hm-go" href="reports.html">AI 리포트 전체<span aria-hidden="true">›</span></a><a class="hm-go" href="scorecard.html">위원회 성적표<span aria-hidden="true">›</span></a>`;
  const ISSUE_SHOW = 10;
  const news = `<section class="card hm-card"><div class="hm-h ia-head"><h2>이슈 순위</h2>${ISSUES_FILTER}</div>${issuesList(issues, ISSUE_SHOW, true)}${issues.length > ISSUE_SHOW ? `<details class="more content-more ia-rest"><summary><span class="more-closed">${issues.length - ISSUE_SHOW}개 더 보기</span><span class="more-open">접기</span></summary>${issuesList(issues.slice(ISSUE_SHOW), issues.length, true)}</details>` : ''}</section><p class="fine wd-fine">한국 종목 뉴스와 세계 뉴스를 한 순위로 모았어요. 각 목록 안에서 다룬 매체가 많은 순서를 기준으로 섞었어요. 시장 숫자는 같은 날 함께 움직인 값이고, 원인이라는 뜻이 아니에요.</p>`;
  
  const tabs = [['sum', '요약', sum], ...(wp ? [['market', '시장', wp.market]] : []), ['com', '위원회', com], ['news', '이슈', news]] as const;
  const nav = `<nav class="mode-tabs" role="tablist" aria-label="홈 보기">${tabs.map(([k, l], i) => `<button type="button" role="tab" data-wd="${k}" aria-selected="${i === 0}">${l}</button>`).join('')}</nav>`;
  const body = `${HOME_STYLE}${WORLD_CSS}${ISSUES_CSS}${tabs.map(([k, , html], i) => `<div class="wd-p hm-p" data-wd-p="${k}"${i ? ' hidden' : ''}>${html}</div>`).join('')}
<footer id="sources" class="hm-foot"><p>데이터: Naver 금융, 네이버 증권, OpenDART, 네이버 뉴스 검색과 RSS, 해외 뉴스 RSS.${wp ? ` 세계 숫자는 ${esc(wp.asof)} 기준이에요.` : ''} 계산 결과이고, 투자 권유가 아니에요.</p></footer>`;
  // G-277 (한서님 10/21 '위의 바 두기싫다니까'): on phones the parts switch from the bottom bar; the row above is for wide screens.
  return shell('', 'GNOMON | 오늘', body, { active: 'home', head: { title: '오늘', tabs: nav }, parts: partButtons(tabs.map(([k, l]) => [k, l] as const)), scripts: WORLD_JS + HOME_SCRIPT + FEED_SCRIPT + BANNER_JS });
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
/** '10월 21일 화요일' from a KST date. */
function dayLong(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '오늘';
  const w = new Date(`${day}T00:00:00Z`).getUTCDay();
  return `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일 ${WEEK[w]}요일`;
}

/** Without a world snapshot: 코스피·코스닥 as the kit's stat cards. */
function fallbackNumbers(indices: readonly IndexQuote[]): string {
  if (!indices.length) return '';
  const cards = indices.slice(0, 2).map((i) => kmStatArea({ title: i.name, value: i.close, change: i.changePct, series: i.closes.slice(-30).map((c, k, a) => [`${a.length - k}일 전`, c] as [string, number]), digits: 2, label: '종가', unit: '일' })).join('');
  return `<div class="hm-h"><h2>꼭 볼 숫자</h2></div><div class="km-stats wd-stats hm-stats">${cards}</div>`;
}

interface Call { name: string; href: string; close: number; change: number | null; line: string; zones: ([number, number] | null)[]; deep: boolean }
/** The committee's reports of the newest report day (the same set as reports.html#today), deep ones first. */
function committeeToday(all: readonly HomeEntry[]): Call[] {
  const withDate = all.filter((e) => e.report && madeOn(e) && e.group !== 'past' && e.report.commentary?.status === 'OK');
  const last = withDate.map(madeOn).sort().at(-1);
  if (!last) return [];
  const seen = new Set<string>();
  return withDate.filter((e) => madeOn(e) === last && !seen.has(e.symbol) && seen.add(e.symbol)).map((e) => {
    const r = e.report!, c = r.commentary?.status === 'OK' ? r.commentary : undefined;
    return {
      name: e.name, href: e.href, close: r.price?.close ?? 0, change: r.price?.changePct ?? null,
      line: (c?.summary?.text ?? r.headline ?? '').split(/(?<=[.?!요])\s/)[0] ?? '',
      zones: (['BEAR', 'BASE', 'BULL'] as const).map((k) => scenarioZone(r, k)?.zone ?? null), deep: aiKind(e) === 'core',
    };
  }).sort((a, b) => Number(b.deep) - Number(a.deep) || a.name.localeCompare(b.name, 'ko'));
}

/** One call: name, today's move, the committee's line, and three small range bars (약세·기본·강세) with today's price. */
function callRow(c: Call): string {
  const zs = c.zones.filter((z): z is [number, number] => !!z);
  let bars = '';
  if (zs.length && c.close) {
    const lo = Math.min(...zs.flat(), c.close), hi = Math.max(...zs.flat(), c.close), sp = hi - lo || 1, y = (v: number) => 3 + (1 - (v - lo) / sp) * 34;
    const cls = ['bear', 'base', 'bull'];
    bars = `<svg class="hm-zb" viewBox="0 0 54 40" role="img" aria-label="${esc(`앞으로 20거래일 범위. ${c.zones.map((z, i) => (z ? `${['약세', '기본', '강세'][i]} ${won(z[0])}~${won(z[1])}` : '')).filter(Boolean).join(', ')}. 지금 ${won(c.close)}`)}">${c.zones.map((z, i) => (z ? `<rect class="${cls[i]}" x="${4 + i * 18}" y="${y(z[1]).toFixed(1)}" width="10" height="${Math.max(8, y(z[0]) - y(z[1])).toFixed(1)}" rx="3"/>` : '')).join('')}<line x1="0" x2="54" y1="${y(c.close).toFixed(1)}" y2="${y(c.close).toFixed(1)}"/></svg>`;
  }
  return `<a class="hm-call" href="${esc(c.href)}"><span class="hm-cn"><span><b>${esc(c.name)}</b>${c.change == null ? '' : ` <i class="${tone(c.change)}">${signed(c.change)}</i>`}</span><small>${esc(c.line)}</small></span>${bars}</a>`;
}

/**
 * G-271 (Bklit 대조표, 한서님 10/20): a tiny area line of the index's recent closes beside its number (Bklit area-chart look).
 * Drawn in the text colour (one neutral accent, G-267): the 30-day shape and today's red/blue number never disagree in colour.
 * Nothing is drawn with fewer than 5 closes.
 */
export function miniArea(closes: readonly number[] | undefined): string {
  const c = (closes ?? []).filter((v) => Number.isFinite(v)).slice(-30);
  if (c.length < 5) return '';
  const W = 56, H = 18, lo = Math.min(...c), hi = Math.max(...c), span = hi - lo || 1;
  const pts = c.map((v, k) => `${((k / (c.length - 1)) * W).toFixed(1)},${(H - 1 - ((v - lo) / span) * (H - 2)).toFixed(1)}`).join(' ');
  const d = smoothD(pts);
  const id = gradId('hha');
  return `<svg class="hh-sa" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>${fadeGrad(id, 'currentColor', 0.22)}</defs><path d="${d}L${W} ${H}L0 ${H}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
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
  // G-287 (한서님 10/23 '넘 구림'): one plain list instead of wrapping chips — each 관심 업종 on its own row (name, its
  // strongest theme under it, the move on the right), then the holding-period preset as the last row. 바꾸기 sits in the head.
  var sectors = (prefs.sectors || []).slice(0, 4), rows = [];
  // G-201: a sector row opens its strongest theme today (themes-home.json, built each day); no theme, 테마 전체.
  sectors.forEach(function (s, i) { rows.push('<a class="fd-row" data-sec="' + i + '" href="themes.html"><span class="fd-t"><b>' + esc(s) + '</b><small>오늘 강한 테마 보기</small></span><i class="fd-v"></i><span class="fd-go" aria-hidden="true">›</span></a>'); });
  if (preset) rows.push('<a class="fd-row fd-pre" href="screener.html#' + preset[0] + '"><span class="fd-t"><b>' + preset[1] + ' 종목</b><small>보유 기간 ' + esc(h) + '에 맞는 조건</small></span><i class="fd-v"></i><span class="fd-go" aria-hidden="true">›</span></a>');
  if (!rows.length) return;
  chipsEl.innerHTML = '<div class="fd-h"><b>' + (sectors.length ? '관심 업종 오늘' : '내 조건') + '</b><a href="settings.html#profile">투자 방식 바꾸기</a></div>' + rows.join('');
  if (redo) redo.hidden = true;
  if (sectors.length) (window.gnmThemesHome = window.gnmThemesHome || fetch('themes-home.json').then(function (r) { return r.ok ? r.json() : null; })).then(function (j) {
    var map = (j && j.sectors) || {};
    sectors.forEach(function (s, i) {
      var t = (map[s] || [])[0], a = chipsEl.querySelector('[data-sec="' + i + '"]'); if (!t || !a) return;
      a.href = 'themes.html#' + encodeURIComponent(t[0]);
      a.setAttribute('aria-label', s + ' 관련 테마 ' + t[1] + ' 보기');
      a.querySelector('small').textContent = t[1];
      var v = a.querySelector('.fd-v'); if (v && t[2] != null) { v.className = 'fd-v ' + (t[2] > 0 ? 'up' : t[2] < 0 ? 'down' : ''); v.textContent = (t[2] > 0 ? '+' : '') + Number(t[2]).toFixed(1) + '%'; }
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
.feed-chips{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}.feed-chips:empty{display:none}.my-card .feed-redo[hidden]{display:none}
.fd-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin:0 0 2px}.fd-h b{font-size:13px;font-weight:700;color:var(--fg2)}.fd-h a{font-size:12.5px;font-weight:600;color:var(--muted);text-decoration:none}
.fd-row{display:grid;grid-template-columns:minmax(0,1fr) auto 12px;gap:10px;align-items:center;padding:11px 0;border-top:1px solid var(--line);text-decoration:none;color:var(--fg)}.fd-h+.fd-row{border-top:0}
.fd-t{display:flex;flex-direction:column;gap:2px;min-width:0}.fd-t b{font-size:15px;font-weight:600}.fd-t small{font-size:12.5px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fd-v{font-style:normal;font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}.fd-v.up{color:var(--up)}.fd-v.down{color:var(--down)}.fd-go{color:var(--muted);font-size:17px}
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
.hh-world{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:13px;font-weight:600;color:var(--fg2,var(--muted));text-decoration:none}
.hh{margin-top:18px}.hh-d{margin:0;font-size:26px;line-height:1.25;font-weight:500;letter-spacing:-.02em;color:var(--fg)}.hh-s{margin:6px 0 0;font-size:15px;line-height:1.5;color:var(--fg)}.hh-ixs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px;color:inherit;text-decoration:none}.hh-ix{display:flex;flex-direction:column;gap:1px;min-width:0;padding:10px 12px;border-radius:14px;background:var(--surface,rgba(255,255,255,.6));border:1px solid var(--line,rgba(0,0,0,.06))}.hh-ix small{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hh-ix b{font-size:16px;font-weight:700;color:var(--fg);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hh-ix span{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums}.hh-go{margin-left:auto}.hh-ix small{display:flex;align-items:center;justify-content:space-between;gap:4px}.hh-sa{width:40px;height:14px;flex:none;color:var(--fg2)}#mkt-hero+#watch-slot+#watch,.hh+#watch-slot+#watch{margin-top:22px}
#mkt-hero~.banner{margin-top:14px}:root body #mkt-hero~.banner .bn-slide{display:flex;align-items:center;gap:12px;min-height:76px;padding:14px 18px;border-radius:22px;background:var(--surface);border:1px solid var(--glass-line,var(--line));box-shadow:none;color:var(--fg);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
:root body #mkt-hero~.banner .bn-tag{flex:none;order:1;background:var(--soft);color:var(--fg2);font-size:12px;font-weight:600}:root body #mkt-hero~.banner .bn-art{flex:none;order:0;width:40px;height:40px;font-size:20px;background:var(--soft);box-shadow:none}:root body #mkt-hero~.banner .bn-slide b{order:2;flex:1;min-width:0;font-size:16.5px;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
:root body #mkt-hero~.banner .bn-text{display:none}:root body #mkt-hero~.banner .bn-cta{order:3;margin:0;padding:8px 14px;font-size:13.5px;font-weight:600;background:none;border:1px solid var(--line-strong);color:var(--fg)}:root body #mkt-hero~.banner .bn-logo{order:0;flex:none;width:auto;height:22px;border-radius:4px}:root body #mkt-hero~.banner .bn-benefits{order:4;flex:none}:root body #mkt-hero~.banner .bn-benefits[open]{flex-basis:100%}
:root body #mkt-hero~.banner .bn-slide.bn-img{aspect-ratio:auto;min-height:76px;padding:14px 18px}:root body #mkt-hero~.banner .bn-img picture{display:none}:root body #mkt-hero~.banner .bn-img .bn-alt{display:block}:root body #mkt-hero~.banner .bn-play{position:static;order:3;flex:none;padding:8px 14px;font-size:13.5px;font-weight:600;background:none;border:1px solid var(--line-strong);color:var(--fg);backdrop-filter:none}:root body #mkt-hero~.banner .bn-play svg{width:12px;height:12px}
:root body #mkt-hero~.banner .bn-dots{position:static;transform:none;justify-content:center;margin-top:4px;background:none}:root body #mkt-hero~.banner .bn-dots button::before{background:var(--line-strong)}:root body #mkt-hero~.banner .bn-dots button[aria-pressed=true]::before{background:var(--fg)}
.home-main>.block{margin-top:28px}.home-main>.block[hidden]{display:none}
.tp-grid{gap:0;grid-template-columns:minmax(0,1fr)}.tp{background:none;border:0;border-top:1px solid var(--line);border-radius:0;padding:14px 40px 14px 0}.tp:first-child{border-top:0}.tp:hover{border-color:var(--line)}.tp .star{top:10px;right:-4px}.tp-line{margin:4px 0 0;font-size:13.5px;color:var(--fg2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media (min-width:821px){.tp-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.tp{border:1px solid var(--line);border-radius:14px;padding:14px 40px 14px 16px;background:var(--surface)}.tp:first-child{border-top:1px solid var(--line)}.tp .star{top:8px;right:6px}}
.sl{display:flex;align-items:center;gap:14px;padding:16px;border-radius:14px;background:var(--soft);text-decoration:none;color:var(--fg)}.sl-v{font-size:30px;font-weight:800;color:var(--accent-strong);font-variant-numeric:tabular-nums}.sl span{display:flex;flex-direction:column;gap:2px;min-width:0}.sl span b{font-size:15px}.sl small{font-size:13px;color:var(--muted)}.sl-go{margin-left:auto;color:var(--muted)}
.ml-row{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 0;border-top:1px solid var(--line);text-decoration:none;color:var(--fg)}.ml-row:first-child{border-top:0}.ml-row>span:first-child{display:flex;flex-direction:column;gap:2px;min-width:0}.ml-row b{font-size:15px}.ml-row small{font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ml-row small i{font-style:normal;font-weight:700}.ml-row small i.up{color:var(--up)}.ml-row small i.down{color:var(--down)}.ml-go{margin-left:auto;color:var(--muted)}
.home-grid+.banner{margin-top:28px}@media (max-width:1100px){.home-rail{display:none}}
.wl-px{display:flex;flex-direction:column;align-items:flex-end;gap:1px;font-variant-numeric:tabular-nums;white-space:nowrap}.wl-px b{font-weight:600}.wl-st{font-size:12.5px;font-weight:600}
.hm-p{gap:14px}.hm-hero{margin:4px 4px 0}.hm-d{margin:0;font-size:14px;font-weight:600;color:var(--muted)}.hm-s{margin:4px 0 0;font-size:19px;line-height:1.5;font-weight:600;letter-spacing:-.01em;color:var(--fg)}
.hm-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin:14px 4px -4px}.hm-h h2{margin:0;font-size:20px;font-weight:700;letter-spacing:-.01em}
.hm-card{padding:4px 16px;margin:0;border-radius:24px}.hm-stats .km-stat{border-radius:22px;padding:14px 16px 10px}.hm-stats .km-sv{font-size:21px}
.hm-bn .banner{margin:0}.hm-bn .bn-slide{border-radius:24px;overflow:hidden}.hm-bn .bn-img .bn-play{display:none}.hm-bn .bn-dots{position:static;transform:none;background:none;backdrop-filter:none;justify-content:center;margin:8px auto 0;padding:0}.hm-bn .bn-dots button::before{background:var(--line-strong)}.hm-bn .bn-dots button[aria-pressed=true]::before{background:var(--fg)}
.hm-call{display:flex;align-items:center;gap:12px;min-height:68px;padding:10px 0;border-top:1px solid var(--line);color:inherit;text-decoration:none}.hm-call:first-child{border-top:0}
.hm-cn{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.hm-cn b{font-size:15.5px;font-weight:700}.hm-cn i{font-style:normal;font-size:13px;font-weight:600;font-variant-numeric:tabular-nums}.hm-cn small{font-size:13px;color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hm-zb{flex:none;width:54px;height:40px}.hm-zb rect.bear{fill:#2468d6;fill-opacity:.85}.hm-zb rect.base{fill:var(--muted);fill-opacity:.55}.hm-zb rect.bull{fill:#e5323f;fill-opacity:.85}.hm-zb line{stroke:var(--fg);stroke-dasharray:2 2}
.hm-lead{margin:0 4px;font-size:14.5px;line-height:1.55;color:var(--fg2)}
.hm-go{display:flex;justify-content:space-between;align-items:center;min-height:52px;padding:0 18px;border-radius:18px;background:var(--surface);color:var(--fg);text-decoration:none;font-size:15px;font-weight:600}.hm-go span{color:var(--muted)}
.hm-p #watch{margin:14px 0 0}.hm-p #watch .block-head{margin:0 4px 8px}.hm-p #watch .block-head h2{font-size:20px}.hm-p .sl-wrap{margin:6px 0 0}
.hm-foot{max-width:820px;margin:24px auto 0;padding:0 20px;font-size:12px;color:var(--muted)}
.wl-lv{display:block;font-size:12px;font-weight:500;color:var(--muted);font-variant-numeric:tabular-nums;margin-top:1px}.wl-lv .up,.wl-lv .down{font-weight:600}
</style>`;

const HOME_SCRIPT = `<script>
// G-268: three world numbers on the 세계 line (S&P 500, 니케이, WTI) from world.json, when it is there.

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
          // G-277 (한서님 10/21): '약세 전환 가격까지 −1.6%' on a day the stock rose read backwards. The two committee prices are shown as they are.
          var lv = wi.up || wi.dn ? '<span class="wl-lv">' + (wi.dn ? '<span class="down">약세 기준</span> ' + Math.round(wi.dn).toLocaleString('ko-KR') : '') + (wi.up && wi.dn ? ' · ' : '') + (wi.up ? '<span class="up">강세 기준</span> ' + Math.round(wi.up).toLocaleString('ko-KR') : '') + '</span>' : '';
          st = rail + (wi.f ? '<div class="wl-st"><span class="wl-new">새 공시 ' + wi.f + '건</span></div>' : '') + lv;
        }
        return '<div class="wl"><a href="' + href + '"><b>' + esc(it[1]) + '</b>' + (coin || it[2] === 'ETF' ? ' <span class="muted small">' + (coin ? '코인' : 'ETF') + '</span>' : '') + st + '</a><span class="wl-px" data-no-roll>' + price + (ch == null ? '' : '<span class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '" data-live="' + esc(sym) + '" data-live-f="pct">' + (ch > 0 ? '▲ +' : ch < 0 ? '▼ ' : '') + ch.toFixed(2) + '%</span>') + '</span><button type="button" class="star" data-star="' + esc(sym) + '" aria-pressed="' + starred + '" aria-label="' + (starred ? '관심 종목에서 빼기' : '관심 종목에 담기') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/></svg></button></div>';
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
