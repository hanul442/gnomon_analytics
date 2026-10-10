import type { MarketReport } from './marketReport.js';
// Site front page as a market dashboard (docs/DESIGN.md §3.7, G-31). It answers
// "what should I look at now?" (BOR North Star §2): the indices and breadth,
// the market's temperature from every stock's free computation, this week's AI
// reports as one-line rows, today's movers, a watchlist kept in the browser,
// the scorecard summary and this week's filings. Pure rendering.

import { ORBS } from './ui.js';
import type { DailyReport, ReportedFiling } from './dailyReport.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { MarketPulse, StockCalc } from '../analysis/quickCalc.js';
import { marketTemperature } from './marketTemperature.js';
import { sparkline } from './appParts.js';
import { SEARCH_SCRIPT, shell, type HomeEntry } from './renderHtml.js';
import { gate } from './plans.js';
import { ALPHA_BANNERS, BANNER_JS, bannerHtml, eventBanners, type Banner } from './alphaPages.js';
import { openEvents } from './events.js';
import { HOME_ORDER } from './persona.js';
import { FIELD_INDEX, matches, PRESETS } from '../analysis/screenRules.js';
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


function indexStrip(indices: readonly IndexQuote[], universe: readonly UniverseRow[] | null, pulse: MarketPulse | null, dailyHref = 'market-reports.html', us: UsTemp | null = null): string {
  const cards = indices.map((i) => `<div class="card ix"><div class="ix-top"><div><div class="pl-k">${esc(i.name)}</div><div class="ix-v">${i.close.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</div><div class="${tone(i.changePct)} ix-c">${signed(i.changePct)}</div></div>${sparkline(i.closes, `${i.name} 최근 60거래일`, 110, 40, i.changePct == null ? null : i.changePct >= 0)}</div><div class="muted small">${esc(i.date)} 종가</div></div>`).join('');
  const temp = tempCard(pulse, universe, dailyHref);
  // G-179: the US market beside the Korean one, from the US universe's own signals (us.html lists them).
  const usCard = us && (us.pulse || us.up || us.down) ? marketTemperature(us.pulse, { up: us.up, down: us.down, flat: us.flat }, '미국', 'us.html') : '';
  return cards || temp || usCard ? `<section class="block ix-row${usCard ? ' ix-4' : ''}">${cards}${temp}${usCard}</section>` : '';
}

/**
 * Market temperature (home, G-67): in the third index slot instead of a bare up/down count. One verdict,
 * the 7-step signal bar over every stock, and today's up/down count as the small print.
 */
/** The newest market daily (G-122): the home temperature card opens it. */
const latestDaily = (data: HomeData): string => { const d = data.marketReports?.filter((r) => r.period === 'daily').sort((a, b) => b.date.localeCompare(a.date))[0]; return d ? `market/daily-${d.date}.html` : 'market-reports.html'; };
function tempCard(p:MarketPulse|null,universe:readonly UniverseRow[]|null,href:string):string {
 const rows=(universe??[]).filter(r=>r.kind==='stock'&&r.changePct!==null);
 return marketTemperature(p,{up:rows.filter(r=>r.changePct!>0).length,down:rows.filter(r=>r.changePct!<0).length,flat:rows.filter(r=>r.changePct===0).length},'시장',href);
}

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
  const k = aiKind(e), d = e.report?.date;
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
<div class="rr-side">${p ? `<b>${won(p.close)}</b><span class="${tone(p.changePct)}">${signed(p.changePct)}</span>` : '<span class="muted small">가격 기록 없음</span>'}${mid ? `<span class="sig ${tone(mid.score === null ? null : mid.score >= 0.1 ? 1 : mid.score <= -0.1 ? -1 : 0)}">${esc(mid.label)}</span>` : ''}</div>${star(e.symbol, e.name)}</div>`;
  }).join('');
  const chip = (f: string, label: string, n?: number) => `<button type="button" class="chip-toggle" data-rf="${f}" aria-pressed="${f === ''}">${label}${n === undefined ? '' : ` ${n}`}</button>`;
  const count = (k: string) => entries.filter((e) => aiKind(e) === k).length;
  return `<section class="block" id="reports"><div class="block-head"><h2>추적 종목 ${entries.length}개</h2><span class="muted">${selection ? `${esc(selection.date)} 선정 · ` : ''}가격·지표는 매일 바뀌어요</span></div>
<div class="card list rr-list"><div class="pl-chips rr-chips" role="group" aria-label="리포트 거르기">${chip('', '전체', entries.length)}${count('core') ? chip('core', '위원회', count('core')) : ''}${count('weekly') ? chip('weekly', '간단(이전)', count('weekly')) : ''}${count('request') ? chip('request', '요청', count('request')) : ''}${chip('bull', '강세')}${chip('bear', '약세')}</div>${rows || '<p class="empty">아직 리포트가 없어요.</p>'}</div>
<p class="muted small">대표 종목과 시가총액·거래대금·공시·움직임으로 고른 종목이에요. 가격·지표·신호는 매일 바뀌고, AI 리포트는 표시된 날짜에 쓴 내용이에요(매일 리포트나 요청으로 새로 만들어요). 신호는 중기(일봉) 기술 신호예요.</p></section>`;
}

type View = 'beginner' | 'trader' | 'swing' | 'long';
const VIEW_LEAD: Record<View, string> = {
  beginner: '처음 보기 좋은 대표 종목과 ETF부터',
  trader: '오늘 많이 움직이고 거래가 붙은 종목부터',
  swing: '강세·약세 전환 가격에 가까운 종목부터',
  long: '적정 범위 아래이거나 실적을 볼 만한 종목부터',
};

/** How much each view would want this pick today, and the one line that says why (G-67). */
function viewFit(e: HomeEntry): Record<View, { score: number; why: string }> {
  const r = e.report, p = r?.price, kind = e.kind ?? 'stock', deep = e.tier === 'deep' || e.group === 'core';
  const base = e.reasons?.[0] ?? (e.group === 'core' ? '대표 종목' : '이번 주 위원회 리포트');
  const move = Math.abs(p?.changePct ?? 0), vol = p?.volumeRatio20 ?? null;
  const c = r?.commentary?.status === 'OK' ? r.commentary : undefined;
  const lv = r?.market?.structure?.levels ?? [];
  const up = c?.scenarios?.find((x) => x.kind === 'BULL')?.trigger ?? lv.filter((l) => p && l.price > p.close).sort((a, b) => a.price - b.price)[0]?.price;
  const dn = c?.scenarios?.find((x) => x.kind === 'BEAR')?.trigger ?? lv.filter((l) => p && l.price < p.close).sort((a, b) => b.price - a.price)[0]?.price;
  const gapTo = (t?: number) => (p && t ? t / p.close - 1 : null);
  const gu = gapTo(up), gd = gapTo(dn);
  const near = gu === null && gd === null ? null : gd === null || (gu !== null && Math.abs(gu) <= Math.abs(gd)) ? { t: up!, g: gu!, w: '강세 전환' } : { t: dn!, g: gd!, w: '약세 전환' };
  const fv = r?.market?.fairValue, per = r?.market?.snapshot?.per;
  return {
    beginner: {
      score: (e.group === 'core' ? 3 : 0) + (kind === 'etf' ? 2.5 : 0) + (deep ? 1 : 0) - (kind === 'coin' ? 2 : 0) - move / 4,
      why: kind === 'etf' ? '여러 종목을 묶은 ETF라 한 종목보다 덜 출렁여요' : e.group === 'core' ? '많이 보는 대표 종목이에요' : base,
    },
    trader: {
      score: move + (vol ?? 1) * 1.5 + (kind === 'coin' ? 0.5 : 0),
      why: p ? `오늘 ${signed(p.changePct)}${vol != null ? ` · 거래량 평소 ${vol.toFixed(1)}배` : ''}` : base,
    },
    swing: {
      score: (near ? Math.max(0, 10 - Math.abs(near.g) * 100) : 0) + (deep ? 2 : 0),
      why: near ? `${near.w} 가격 ${won(near.t)}까지 ${near.g > 0 ? '+' : ''}${(near.g * 100).toFixed(1)}%` : base,
    },
    long: {
      score: (kind === 'stock' ? 2 : kind === 'etf' ? 1 : -3) + (fv?.position === 'BELOW' ? 4 : fv?.position === 'INSIDE' ? 1 : 0) + (per != null ? 1 : 0) + (deep ? 1 : 0),
      why: fv ? `적정 범위 ${fv.position === 'BELOW' ? '아래' : fv.position === 'ABOVE' ? '위' : '안'}${per != null ? ` · PER ${per.toFixed(1)}배` : ''}` : base,
    },
  };
}

/**
 * "오늘 볼 것" (G-64, G-67): the few reports worth a look today, picked for the reader's view. Every
 * candidate is on the page with a score and a reason per view; the page shows the view's top four.
 */
function todayPicks(daily: readonly HomeEntry[], weekly: readonly HomeEntry[]): string {
  // G-197: the last five pick days, newest first (a weekend or holiday day holds only a coin, so looking at one
  // day filled the rest with the same standing names every time). Standing names rotate by date after them.
  const days = [...new Set(daily.map((e) => e.pickDate ?? ''))].filter(Boolean).sort().reverse().slice(0, 5);
  const age = new Map(days.map((d, i) => [d, i]));
  const deepFirst = (a: HomeEntry, b: HomeEntry) => (a.tier === b.tier ? 0 : a.tier === 'deep' ? -1 : 1);
  const recentDaily = daily.filter((e) => age.has(e.pickDate ?? '')).sort((a, b) => (age.get(a.pickDate!)! - age.get(b.pickDate!)!) || deepFirst(a, b));
  const turn = days[0] ? Number(days[0].replace(/-/g, '')) : 0;
  const rotated = weekly.length ? [...weekly.slice(turn % weekly.length), ...weekly.slice(0, turn % weekly.length)] : [];
  const seen = new Set<string>();
  const picks = [...recentDaily, ...rotated].filter((e) => e.report && !seen.has(e.symbol) && seen.add(e.symbol)).slice(0, 16);
  if (!picks.length) return '';
  const views = Object.keys(VIEW_LEAD) as View[];
  const card = (e: HomeEntry) => {
    const r = e.report, p = r?.price, c = r?.commentary?.status === 'OK' ? r.commentary : undefined;
    const line = (c?.summary?.text ?? r?.headline ?? '').split(/(?<=요\.)\s/)[0] ?? '';
    const fit = viewFit(e);
    const sub = e.group === 'daily' ? `일일 선정 · ${e.pickDate ?? ''}` : e.group === 'core' ? '대표 종목' : '주간 선정';
    return `<div class="tp" data-pick-daily="${e.group==='daily'?'1':'0'}" data-age="${e.group === 'daily' ? age.get(e.pickDate ?? '') ?? 4 : 0}" data-sym="${esc(e.symbol)}" ${views.map((v) => `data-s-${v}="${fit[v].score.toFixed(2)}"`).join(' ')}><a class="tp-main" href="${esc(e.href)}"><div class="tp-top"><span class="tier t-k">${KIND[e.kind ?? 'stock']}</span>${aiPill(e)}${views.map((v) => `<span class="tp-why pw pw-${v}">${esc(fit[v].why)}</span>`).join('')}</div>
<p class="muted small">${esc(sub)}${e.reasons?.[0] && e.reasons[0] !== sub ? ` · ${esc(e.reasons[0])}` : ''}</p><div class="tp-name"><b>${esc(e.name)}</b>${p ? `<span class="tp-px"><b data-live="${esc(e.symbol)}" data-live-f="price">${won(p.close)}</b> <span class="${tone(p.changePct)}" data-live="${esc(e.symbol)}" data-live-f="pct">${signed(p.changePct)}</span></span>` : ''}</div><p class="tp-line">${esc(line)}</p></a>${star(e.symbol, e.name)}</div>`;
  };
  return `<section class="block" id="today"><div class="block-head"><h2>오늘 볼 것</h2><a class="more-link" href="reports.html">AI 리포트 모음 ›</a></div>
<p class="tp-lead">${views.map((v) => `<span class="pw pw-${v}">${VIEW_LEAD[v]}</span>`).join('')} <a href="#" data-open-view>보기 방식 바꾸기</a></p>
<div class="tp-grid" id="tp-grid">${picks.map(card).join('')}</div><p class="muted small">내 보기 방식에 맞는 네 종목이에요. 최근 일일 선정과 내 관심 종목이 먼저 나와요. <a href="reports.html#daily">일일 선정 전체 보기 ›</a> 투자 권유가 아니에요.</p></section>`;
}

/**
 * G-125: everything that came out on the newest report day, in one list. The 🔔 notes link here
 * (reports.html?hl=<symbols>#today): the reader's watched stocks come first, marked, and the rest of the day follows.
 */
function todayRows(entries: readonly HomeEntry[]): string {
  const withDate = entries.filter((e) => e.report?.date && e.group !== 'past');
  const day = withDate.map((e) => e.report!.date).sort().at(-1);
  if (!day) return '';
  const seen = new Set<string>();
  const list = withDate.filter((e) => e.report!.date === day && !seen.has(e.symbol) && seen.add(e.symbol));
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
  const head = `<section class="card rp-head"><div class="pl-k">AI 리포트 모음</div><h1>최근 AI 리포트</h1><p class="muted">시장 데일리, 매일 고른 종목, 추적 종목의 AI 리포트를 한곳에 모았어요. 다른 종목은 검색에서 찾을 수 있어요.</p>
<nav class="rp-links" aria-label="리포트 바로가기">${tile('market-reports.html', '시장 데일리', '코스피·코스닥·코인·ETF')}${tile('#today', '오늘 나온 리포트', '내 관심 종목 먼저')}${daily.length ? tile('#daily', '매일 AI 리포트', `${latest ? esc(latest.slice(5).replace('-', '/')) + ' 최신 · ' : ''}${daily.length}건`) : ''}${tile('#reports', '추적 종목', `${sorted.length}개`)}</nav></section>`;
  return shell('', 'AI 리포트 모음 | GNOMON', `${HOME_STYLE}<style>.rr-mine{background:var(--accent-soft)}.t-mine{background:var(--down-soft);color:var(--accent-strong)}</style>${head}${todayRows(data.entries)}${dailyRows(daily)}${reportRows(sorted, data.selection)}`, { scripts: HOME_SCRIPT + TODAY_LIST_SCRIPT });
}

function movers(universe: readonly UniverseRow[] | null, covered: ReadonlySet<string>): string {
  if (!universe?.length) return '';
  const ok = universe.filter((r) => r.kind === 'stock' && /0$/.test(r.symbol) && !/스팩/.test(r.name) && r.close !== null && r.changePct !== null && (r.marketCap ?? 0) >= 1e11);
  const href = (s: string) => (covered.has(s) ? `${s}/index.html` : `stock.html?c=${s}`);
  const row = (r: UniverseRow, i: number, extra: string) => `<div class="mvr"><span class="mvr-i">${i + 1}</span><a href="${href(r.symbol)}" class="mvr-n"><b>${esc(r.name)}</b><span class="muted small">${r.market === 'KOSPI' ? '코스피' : '코스닥'}</span></a><span class="mvr-v">${extra}</span>${star(r.symbol, r.name)}</div>`;
  const pc = (r: UniverseRow) => `<b>${won(r.close!)}</b><span class="${tone(r.changePct)}">${signed(r.changePct)}</span>`;
  const lists: [string, string, UniverseRow[], (r: UniverseRow) => string][] = [
    ['up', '상승', [...ok].sort((a, b) => b.changePct! - a.changePct!).slice(0, 8), pc],
    ['down', '하락', [...ok].sort((a, b) => a.changePct! - b.changePct!).slice(0, 8), pc],
    ['value', '거래대금', [...ok].sort((a, b) => (b.tradingValue ?? 0) - (a.tradingValue ?? 0)).slice(0, 8), (r) => `<b>${Math.round((r.tradingValue ?? 0) / 1e8).toLocaleString('ko-KR')}억</b><span class="${tone(r.changePct)}">${signed(r.changePct)}</span>`],
  ];
  return `<section class="block" id="movers"><div class="block-head"><h2>오늘 움직인 종목</h2><span class="muted">시가총액 1,000억 원 이상 보통주</span></div>
<div class="card list"><div class="seg mv-tabs" role="tablist" aria-label="움직인 종목">${lists.map(([k, l], i) => `<button type="button" role="tab" data-mv="${k}" aria-selected="${i === 0}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div>
${lists.map(([k, , list, fmt], i) => `<div class="mv-list" data-mvl="${k}" role="tabpanel"${i ? ' hidden' : ''}>${list.map((r, j) => row(r, j, fmt(r))).join('')}</div>`).join('')}</div></section>`;
}

function scorecard(entries: readonly HomeEntry[]): string {
  const reports = entries.map((e) => e.report).filter((r): r is DailyReport => !!r?.market);
  let fScored = 0, fInside = 0;
  for (const r of reports) for (const s of r.market!.forecastScores) { fScored += s.scored; fInside += (s.coverage ?? 0) * s.scored; }
  const by = new Map<string, { name: string; scored: number; hits: number; pending: number }>();
  for (const r of reports) for (const a of r.market!.analystBoard) {
    const x = by.get(a.analyst) ?? { name: a.name, scored: 0, hits: 0, pending: 0 };
    x.scored += a.scored; x.hits += (a.hitRate ?? 0) * a.scored; x.pending += a.pending; by.set(a.analyst, x);
  }
  const board = [...by.values()].filter((x) => x.scored > 0).sort((a, b) => b.hits / b.scored - a.hits / a.scored).slice(0, 3);
  const pending = [...by.values()].reduce((s, x) => s + x.pending, 0);
  const detail = `<div class="card sc-card"><div class="sc-k">AI 분석가 방향 적중</div>${board.length ? `<ol class="sc-board">${board.map((x) => `<li><span>${esc(x.name)}</span><b>${Math.round((x.hits / x.scored) * 100)}%</b><span class="muted small">${x.scored}건</span></li>`).join('')}</ol>` : `<div class="muted">채점 대기 ${pending.toLocaleString('ko-KR')}건. 첫 채점은 예측 20거래일 뒤예요.</div>`}</div>`;
  // Free: the headline number. Plus: the analyst ranking.
  return `<section class="block"><div class="block-head"><h2>성적표</h2><a href="scorecard.html" class="more-link">전체 보기 ›</a></div><div class="card sc-card sc-free"><div class="sc-k">예측 범위 적중</div>${fScored ? `<div class="sc-v">${Math.round((fInside / fScored) * 100)}%</div><div class="muted small">채점 ${fScored.toLocaleString('ko-KR')}건 · 10~90% 범위라 정직하면 80% 안팎이에요</div>` : '<div class="muted">아직 채점 전이에요. 예측은 기간이 지나면 실제 가격으로 채점해요.</div>'}</div>${gate(detail, { base: '', what: 'AI 분석가 순위' })}</section>`;
}

function filings(entries: readonly HomeEntry[]): string {
  const seen = new Set<string>();
  const list: (ReportedFiling & { name: string; href: string })[] = [];
  for (const e of entries) for (const f of e.report?.recentFilings ?? []) {
    if (f.importance === 'LOW' || seen.has(f.receiptNo)) continue;
    seen.add(f.receiptNo); list.push({ ...f, name: e.name, href: e.href });
  }
  list.sort((a, b) => (a.filedDate < b.filedDate ? 1 : -1));
  const top = list.slice(0, 8);
  return `<section class="block" id="home-filings"><div class="block-head"><h2>주요 공시</h2><span class="muted">리포트 종목 · 최근</span></div><div class="card list">${top.length ? top.map((f) => `<div class="fl"><span class="muted small">${esc(f.filedDate.slice(5))}</span><div><a href="${esc(f.href)}#tab-news"><b>${esc(f.name)}</b></a><div class="small">${esc(f.title)}</div></div></div>`).join('') : '<p class="empty">최근 주요 공시가 없어요.</p>'}</div></section>`;
}

const PLAN_CARD = `<section class="block"><div class="card plan-cta"><div class="pl-k">지금 요금제 <b data-plan-name>무료</b> · <span data-credits>0</span> 크레딧</div>
<p>무료는 결론·차트·지표, <b>플러스</b>는 상세 열기·리포트 요청·AI 질문, <b>프로</b>는 위원회 전체와 전문가 초청, <b>맥스</b>는 내 종목 전담 위원회예요. 크레딧 기능은 플러스부터 사용해요.</p><a class="btn-primary" href="pricing.html">요금제 보기</a></div></section>`;

/** G-78: the reader's saved screens (or the first preset), run on today's screener.json in the page. */
const MY_SCREENS = `<section class="block" id="myscreens"><div class="block-head"><h2 id="ms-title">내 조건에 걸린 종목</h2><a class="more-link" href="screener.html#ai-build">AI로 조건 만들기 ›</a></div><p class="muted small" id="ms-date" hidden></p><div id="ms-body" class="ms-grid"><div class="orbs-load" style="grid-column:1/-1">${ORBS}<span>내 조건으로 오늘 종목을 찾는 중이에요</span></div></div></section>`;
const MY_SCREENS_SCRIPT = `<script>
(function () {
  var box = document.getElementById('ms-body'); if (!box) return;
  var IDX = ${JSON.stringify(FIELD_INDEX)}, PRESET = ${JSON.stringify(PRESETS.slice(0, 1).map((x) => ({ name: x.label, screen: x.screen, key: x.key })))}[0];
  var matches = ${matches.toString()};
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var won = function (v) { return Math.round(v).toLocaleString('ko-KR') + '원'; };
  var local = function () { try { return JSON.parse(localStorage.getItem('gnm-screens') || '[]'); } catch (e) { return []; } };
  var screens = function () { var G = window.GNM; return G && G.api && G.me ? G.call('GET', '/screens').then(function (r) { return r.screens || []; }).catch(function () { return []; }) : Promise.resolve(local()); };
  Promise.all([fetch('screener.json').then(function (r) { return r.json(); }), (window.GNM && GNM.ready ? GNM.ready : Promise.resolve()).then(screens)]).then(function (all) {
    var rows = (all[0] && all[0].rows) || [], list = all[1].slice(0, 3), mine = list.length;
    if (!mine) {list = [PRESET];document.getElementById('ms-title').textContent='추천 검색 조건';}
    box.classList.toggle('ms-single',list.length===1);
    var score = IDX.score;
    // G-186: one card per condition — how many match, how many are new today (this browser remembers yesterday's
    // matches per condition), and the top three with their signal, today's move and where they sit in the 52-week range.
    var LV = { STRONG_BULLISH: ['강한 강세', 'up'], BULLISH: ['강세', 'up'], SLIGHTLY_BULLISH: ['약간 강세', 'up'], NEUTRAL: ['중립', ''], SLIGHTLY_BEARISH: ['약간 약세', 'down'], BEARISH: ['약세', 'down'], STRONG_BEARISH: ['강한 약세', 'down'] };
    var day = all[0].date || all[0].at || '', seen = {}, keep = {}; try { seen = JSON.parse(localStorage.getItem('gnm-ms-seen') || '{}') || {}; } catch (e) {}
    var md = function (d) { return String(d || '').slice(5, 10).replace('-', '/'); };
    var pos52 = function (r) { var a = r[IDX.hi52], b = r[IDX.lo52]; if (a == null || b == null) return null; var x = 1 - 1 / (1 + b / 100), y = 1 / (1 + a / 100) - 1 / (1 + b / 100); return y > 0 ? Math.max(0, Math.min(1, x / y)) : null; };
    box.innerHTML = list.map(function (x) {
      var key = 'k' + (x.id || x.key || x.name), hit = rows.filter(function (r) { return matches(r, x.screen, IDX); }).sort(function (a, b) { return (b[score] || 0) - (a[score] || 0); });
      // 'New' means new since the last data date this browser saw for this condition (stored per condition, the
      // 1,000 strongest codes at most; conditions no longer listed are dropped).
      var codes = hit.slice(0, 1000).map(function (r) { return r[0]; }), mem = seen[key] || {};
      var rec = mem.day && mem.day !== day ? { day: day, codes: codes, prev: mem.codes, prevDay: mem.day } : { day: day, codes: codes, prev: mem.prev || null, prevDay: mem.prevDay || null };
      keep[key] = rec; var prev = rec.prev;
      var fresh = prev ? codes.filter(function (c) { return prev.indexOf(c) < 0; }) : [];
      var top = hit.slice(0, 3).map(function (r) {
        var c = r[IDX.chg], lv = LV[r[IDX.level]] || null, p = pos52(r), href = r[13] ? r[0] + '/index.html' : 'stock.html?c=' + r[0], isNew = fresh.indexOf(r[0]) >= 0;
        return '<a class="ms-row" href="' + href + '"><span class="ms-l"><b>' + esc(r[1]) + (isNew ? '<em class="ms-new">새로</em>' : '') + '</b>' + (lv ? '<i class="ms-lv ' + lv[1] + '">' + lv[0] + '</i>' : '') + '</span>' +
          '<span class="ms-r"><span class="ms-px"><span data-live="' + r[0] + '" data-live-f="price">' + won(r[IDX.close]) + '</span><span class="' + (c > 0 ? 'up' : c < 0 ? 'down' : '') + '" data-live="' + r[0] + '" data-live-f="pct">' + (c > 0 ? '▲ +' : c < 0 ? '▼ ' : '') + Number(c).toFixed(2) + '%</span></span>' +
          (p == null ? '' : '<span class="ms-52" title="52주 범위 안 위치 ' + Math.round(p * 100) + '%"><i style="left:' + (p * 100).toFixed(0) + '%"></i></span>') + '</span></a>';
      }).join('');
      return '<div class="card ms-card"><div class="ms-head"><b>' + esc(x.name) + '</b>' + (x.alert ? '<span class="ms-bell" title="알림 켜짐">🔔</span>' : '') + '</div>' +
        '<div class="ms-stat"><span><b class="ms-n">' + hit.length + '</b>종목</span>' + (prev ? '<span class="' + (fresh.length ? 'ms-fresh' : 'muted') + '" title="이 기기에서 마지막으로 본 데이터(' + esc(rec.prevDay || '') + ')와 비교">' + esc(md(rec.prevDay)) + ' 뒤 새로 <b>' + fresh.length + '</b></span>' : '<span class="muted small">다음 데이터부터 새로 걸린 종목을 표시해요</span>') + '</div>' +
        (top || '<p class="muted small">오늘은 걸린 종목이 없어요.</p>') + '<a class="ms-more" href="screener.html' + '?screen=' + encodeURIComponent(JSON.stringify(x.screen)) + '">' + hit.length + '종목 모두 보기 ›</a></div>';
    }).join('') + (mine ? '' : '<p class="muted small ms-note">저장한 조건이 없어 추천 조건을 보여드려요. AI로 조건을 만들고 저장해 보세요.</p>');
    try { localStorage.setItem('gnm-ms-seen', JSON.stringify(keep)); } catch (e) {}
    var stamp = document.getElementById('ms-date'); if (stamp) { stamp.hidden = false; stamp.textContent = (day ? String(day).slice(0, 10) + ' 데이터' : '일일 갱신 데이터') + ' · 신호 점수 높은 순'; }
    if (window.GNM_live) GNM_live.tick();
  }).catch(function () { box.innerHTML = '<p class="muted small">조건 검색 데이터를 불러오지 못했어요.</p>'; });
})();
</script>`;

/** G-99: today's quiet signals across the market (buybacks, insider and 5% holder moves, contracts, earnings). */
// G-119: today's strongest themes (from themes.json), each opening its member list.
const THEMES_TOP = `<section class="block" id="themes-top" hidden><div class="block-head"><h2>오늘 강한 테마</h2><a class="more-link" href="themes.html">테마 전체 ›</a></div><div class="card tt-list"></div></section>`;
const THEMES_TOP_SCRIPT = `<script>
(function(){var box=document.getElementById('themes-top');if(!box)return;var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
 fetch('themes-home.json').then(function(r){if(!r.ok)throw r;return r;}).catch(function(){return fetch('themes.json');}).then(function(r){return r.json();}).then(function(j){var ts=(j.themes||[]).filter(function(t){return t.avg!=null&&t.members.length>=3;}).slice(0,5);if(!ts.length)return;box.hidden=false;
  box.querySelector('.tt-list').innerHTML=ts.map(function(t,i){var lead=t.members.slice().sort(function(a,b){return (b[3]||-99)-(a[3]||-99);}).slice(0,3).map(function(m){return esc(m[1]);}).join(' · ');return '<a class="tt-row" href="themes.html#'+esc(t.no)+'"><span class="tt-n">'+(i+1)+'</span><span class="tt-main"><b>'+esc(t.name)+'</b><small>'+lead+'</small></span><span class="tt-v '+(t.avg>0?'up':t.avg<0?'down':'')+'">'+(t.avg>0?'+':'')+t.avg.toFixed(2)+'%<small>▲'+t.up+' ▼'+t.down+'</small></span></a>';}).join('');
 }).catch(function(){});})();
</script>`;
const SIGNALS = `<section class="block" id="signals" hidden><div class="block-head"><h2>오늘의 숨은 신호</h2><a class="more-link" href="signals.html">공시 레이더 ›</a></div><div class="card list" id="sig-list"></div></section>`;
const SIGNALS_SCRIPT = `<script>
(function () {
  var box = document.getElementById('signals'); if (!box) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var rank = { buyback: 0, insider: 1, contract: 2, earnings: 3, holder: 4, dividend: 5, buybackSell: 6, ir: 7 };
  fetch('signals.json').then(function (r) { return r.json(); }).then(function (j) {
    if (!j.items || !j.items.length) return;
    var day = j.items[0][0], seen = {}, rows = j.items.filter(function (x) { return x[0] === day; }).sort(function (a, b) { return (rank[a[1]] || 9) - (rank[b[1]] || 9); }).filter(function (x) { var k = x[2] + x[1]; if (seen[k]) return false; seen[k] = 1; return true; }).slice(0, 6);
    document.getElementById('sig-list').innerHTML = rows.map(function (x) { var lab = j.labels[x[1]] ? j.labels[x[1]][0] : x[1]; return '<a class="row" href="stock.html?c=' + encodeURIComponent(x[2]) + '"><span><span class="edge-tag t-' + esc(x[1]) + '">' + esc(lab) + '</span> <b>' + esc(x[3]) + '</b><small class="muted" style="display:block">' + esc(x[4]) + '</small></span><span class="' + (x[6] > 0 ? 'up' : x[6] < 0 ? 'down' : '') + '">' + (x[6] == null ? '' : (x[6] > 0 ? '▲ +' : x[6] < 0 ? '▼ ' : '') + Number(x[6]).toFixed(2) + '%') + '</span></a>'; }).join('') + '<p class="muted small" style="margin:8px 4px 0">' + esc(day) + ' 공시 기준 · 지분 변화는 사유를 원문에서 확인하세요</p>';
    box.hidden = false;
  }).catch(function () {});
})();
</script>`;
const WATCH = `<section class="block" id="watch"><div class="block-head"><h2>관심 종목</h2><span class="muted" id="watch-where">로그인하면 계정에 저장돼요</span></div><div class="card list" id="watch-list"><p class="empty">☆를 눌러 관심 종목·ETF·코인을 모아 보세요.</p></div></section>`;

/** The filter menu (G-94): presets grouped by what the reader is looking for, each with its one-line meaning. */



export function renderHome(data: HomeData): string {
  // Reports someone requested stay off the front page (G-61): they are found by search and opened with credits.
  const entries = data.entries.filter((e) => e.group !== 'past' && e.group !== 'daily' && e.group !== 'request');
  const daily = data.entries.filter((e) => e.group === 'daily');
  const order = { core: 0, weekly: 1, request: 2, past: 3, daily: 4 } as const;
  const sorted = [...entries].sort((a, b) => order[a.group] - order[b.group] || (a.tier === b.tier ? 0 : a.tier === 'deep' ? -1 : 1));
  const covered = new Set(data.entries.map((e) => e.symbol));
  const body = `${HOME_STYLE}<section class="top-search" id="top"><div class="search-block" id="search"><label class="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="q" type="search" placeholder="종목·ETF·코인 (예: 삼성, ㅅㅅㅈㅈ, BTC)" autocomplete="off" aria-label="종목 검색" aria-controls="search-results"></label>
<div id="search-results" class="card list search-results" role="region" aria-live="polite" hidden></div>
<div class="find-row"><a class="flt-btn" href="screener.html">⚙︎ 필터</a><a class="find-link" href="themes.html">🧭 테마별 종목</a><a class="find-link" href="signals.html">📡 공시 레이더</a></div></div></section>
${bannerHtml([...(data.banners ?? []).map((b) => ({ kind: 'notice' as const, ...b })), ...eventBanners(openEvents(data.today ?? new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10))), ...ALPHA_BANNERS])}
${indexStrip(data.indices, data.universe, data.pulse, latestDaily(data), data.us ?? null)}

<p class="phase-note" id="phase-note"></p><div class="home-grid"><div class="home-main">${FEED}${WATCH}${todayPicks(daily, sorted)}${THEMES_TOP}${SIGNALS}
${MY_SCREENS}${movers(data.universe, covered)}</div>
<aside class="home-rail">${scorecard(sorted)}${filings(sorted)}${PLAN_CARD}</aside></div>
<div class="show-more"><button type="button" class="btn-ghost" id="show-all">더 보기</button></div>
<footer id="sources" style="padding:24px 0 0"><p>데이터: Naver 금융, 네이버 증권, OpenDART, 네이버 뉴스 검색과 RSS. 계산 결과이고, 투자 권유가 아니에요.</p></footer>`;
  return shell('', 'GNOMON | 오늘 시장', body, { active: 'home', scripts: THEMES_TOP_SCRIPT + SEARCH_SCRIPT + HOME_SCRIPT + FEED_SCRIPT + BANNER_JS + PERSONA_HOME_SCRIPT + TODAY_SCRIPT + MY_SCREENS_SCRIPT + SIGNALS_SCRIPT });
}

/** My feed (G-46): from the onboarding survey, kept in this browser. Leads with my stocks and puts first what I said I want to see. */
const FEED = `<section class="block" id="feed" hidden><div class="card feed"><div class="feed-head"><div><div class="pl-k">내 피드</div><b id="feed-title">내 종목과 투자 스타일에 맞춘 화면이에요</b></div><a class="feed-redo" href="onboarding.html">설문 다시 하기</a></div><div id="feed-sum" class="feed-sum" hidden></div><ul id="feed-list" class="feed-list"></ul><div id="feed-chips" class="feed-chips"></div></div></section>`;
const FEED_SCRIPT = `<script>
(function () {
  var prefs = null; try { prefs = JSON.parse(localStorage.getItem('gnm-prefs') || 'null'); } catch (e) {}
  var box = document.getElementById('feed'); if (!box) return;
  // G-190: without answers, the card invites the survey instead of staying hidden.
  if (!prefs || !prefs.tickers && !prefs.sectors && !prefs.horizon) { document.getElementById('feed-title').textContent = '내 종목과 관심 업종을 알려 주면 여기 모아 보여 드려요'; var redo = document.querySelector('#feed .feed-redo'); if (redo) redo.remove(); document.getElementById('feed-chips').innerHTML = '<a class="btn-primary feed-go" href="onboarding.html">맞춤 설문 시작하기 (약 7분)</a>'; box.hidden = false; return; }
  // Say at the top that this page follows their answers, with a way to change them.
  var bits = [prefs.experience && '경험 ' + prefs.experience, prefs.horizon && '보유 ' + prefs.horizon, (prefs.sectors || []).length && '관심 ' + prefs.sectors.slice(0, 2).join('·') + (prefs.sectors.length > 2 ? ' 외 ' + (prefs.sectors.length - 2) : '')].filter(Boolean);
  var note = document.getElementById('pz-note');
  if (note) { document.getElementById('pz-text').innerHTML = '<b>내 설문에 맞춘 화면이에요.</b> ' + bits.map(function (b) { return String(b).replace(/[&<>"]/g, ''); }).join(' · ') + ' 기준으로 순서와 추천을 바꿨어요.'; note.hidden = false; }
  var main = box.parentNode, esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // Sections in the order the answers ask for; my stocks always first.
  var want = [].concat(prefs.interests || []), order = ['watch'];
  if (want.some(function (w) { return /AI|공시/.test(w); })) order.push('reports');
  if (want.some(function (w) { return /수급|기술/.test(w); })) order.push('movers');
  if (want.some(function (w) { return /스크리너|실적/.test(w); })) order.push('pulse');
  ['reports', 'pulse', 'movers'].forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });
  var after = box;
  order.forEach(function (id) { var el = document.getElementById(id); if (el && el.parentNode === main) { main.insertBefore(el, after.nextSibling); after = el; } });
  // A screener preset that fits how long they hold.
  var h = prefs.horizon || '', preset = /며칠/.test(h) ? ['hot', '거래 급증·급등'] : /몇 주/.test(h) ? ['rebound', '반등 후보'] : /몇 달/.test(h) ? ['value', '적정가 아래'] : /1년/.test(h) ? ['large', '대형주 강세'] : null;
  // My stocks as rows with the last close and move (search.json: symbol, name, market, close, change%, report).
  var mine = (prefs.tickers || []).slice(0, 6), list = document.getElementById('feed-list');
  var row = function (t, it) { var ch = it && it[4] != null ? Number(it[4]) : null, cls = ch == null ? '' : ch > 0 ? 'up' : ch < 0 ? 'down' : '';
    return '<li><a class="feed-row" href="stock.html?c=' + esc(t[0]) + '"><span class="feed-n"><b>' + esc(it ? it[1] : t[1]) + '</b>' + (it && it[5] ? '<small class="feed-rep">AI 리포트</small>' : '') + '</span><span class="feed-p">' + (it && it[3] != null ? Number(it[3]).toLocaleString('ko-KR') + '원' : '') + '</span><span class="feed-c ' + cls + '">' + (ch == null ? '—' : (ch > 0 ? '+' : '') + ch.toFixed(2) + '%') + '</span></a></li>'; };
  list.innerHTML = mine.map(function (t) { return row(t, null); }).join('');
  // One download of search.json per page, shared with the watchlist below.
  if (mine.length) (window.gnmSearchJson = window.gnmSearchJson || fetch('search.json').then(function (r) { return r.json(); })).then(function (d) {
    var by = {}; (d.items || []).forEach(function (x) { by[x[0]] = x; });
    var up = 0, dn = 0; mine.forEach(function (t) { var x = by[t[0]]; if (x && x[4] > 0) up++; else if (x && x[4] < 0) dn++; });
    list.innerHTML = mine.map(function (t) { return row(t, by[t[0]]); }).join('');
    var sum = document.getElementById('feed-sum'); sum.innerHTML = '내 종목 <b>' + mine.length + '</b>개 · <span class="up">▲ ' + up + '</span> · <span class="down">▼ ' + dn + '</span>'; sum.hidden = false;
  }).catch(function () {});
  var chips = [];
  if (preset) chips.push('<a class="feed-preset" href="screener.html#' + preset[0] + '"><small>보유 기간 ' + esc(h) + '에 맞는 조건</small><b>' + preset[1] + ' 종목 보기 ›</b></a>');
  (prefs.sectors || []).slice(0, 4).forEach(function (s) { chips.push('<a class="chip-link" href="themes.html">' + esc(s) + '</a>'); });
  document.getElementById('feed-chips').innerHTML = chips.join('');
  box.hidden = false;
  if (location.hash === '#feed') box.scrollIntoView({ block: 'start' });
})();
</script>`;

/** "오늘 볼 것" by view (G-67): sort by the view's score, keep four. */
const TODAY_SCRIPT = `<script>
(function () {
  var grid = document.getElementById('tp-grid'); if (!grid) return;
  var apply = function () {
    var p = document.documentElement.getAttribute('data-persona') || 'swing'; if (p === 'all') p = 'swing';
    var cards = [].slice.call(grid.children);
    // G-85: stocks the reader holds or watches (survey, ☆) come first, marked as theirs.
    var mine = {}; try { (JSON.parse(localStorage.getItem('gnm-watch') || '[]') || []).forEach(function (x) { mine[x] = 1; }); ((JSON.parse(localStorage.getItem('gnm-prefs') || '{}') || {}).tickers || []).forEach(function (t) { mine[t[0]] = 2; }); } catch (e) {}
    var sc = function (c) { return Number(c.getAttribute('data-s-' + p)) + (c.getAttribute('data-pick-daily')==='1'?100-15*Number(c.getAttribute('data-age')||0):0) + (mine[c.getAttribute('data-sym')] ? 1000 : 0); };
    cards.forEach(function (c) { var t = c.querySelector('.tp-top'), had = c.querySelector('.t-mine'); if (mine[c.getAttribute('data-sym')] && !had && t) t.insertAdjacentHTML('afterbegin', '<span class="tier t-mine">' + (mine[c.getAttribute('data-sym')] === 2 ? '내 보유' : '내 관심') + '</span>'); });
    cards.sort(function (a, b) { return sc(b) - sc(a); });
    cards.forEach(function (c, i) { grid.appendChild(c); c.hidden = i >= 4; });
  };
  window.addEventListener('gnm-persona', apply);
  apply();
})();
</script>`;

/** Front page by view (G-63): the view's sections in its order, the rest behind "더 보기". */
const PERSONA_HOME_SCRIPT = `<script>
(function () {
  var ORDER = ${JSON.stringify(HOME_ORDER)}, main = document.querySelector('.home-main'), more = document.getElementById('show-all');
  if (!main) return;
  var ALL = ['feed', 'watch', 'today', 'myscreens', 'pulse', 'movers'];
  var apply = function () {
    var p = document.documentElement.getAttribute('data-persona') || 'swing', keep = ORDER[p], all = !keep || document.documentElement.classList.contains('show-all');
    var hidden = 0, after = null;
    // G-85: the hour reorders the page. Before the open: what came out overnight first; during the
    // session: what is moving and my screens; after the close: today's AI picks.
    var k = new Date(Date.now() + 9 * 3600e3), m = k.getUTCHours() * 60 + k.getUTCMinutes(), wd = k.getUTCDay() > 0 && k.getUTCDay() < 6;
    var phase = !wd ? 'off' : m < 540 ? 'pre' : m <= 930 ? 'open' : 'after';
    var seq = (keep || ALL).slice();
    if (phase === 'open') ['myscreens', 'movers'].reverse().forEach(function (id) { var i = seq.indexOf(id); if (i >= 0) { seq.splice(i, 1); seq.splice(Math.min(seq.indexOf('watch') + 1, seq.length), 0, id); } });
    var note = document.getElementById('phase-note');
    if (note) note.innerHTML = { pre: '<b>장 시작 전</b> · 밤사이 나온 공시와 오늘 볼 종목부터 보여 드려요', open: '<b>장중</b> · 지금 많이 움직이는 종목과 내 조건에 걸린 종목부터 보여 드려요', after: '<b>장 마감 뒤</b> · 오늘 나온 AI 리포트와 내일 볼 종목부터 보여 드려요', off: '<b>휴장일</b> · 최근 리포트와 내 조건을 정리해 보세요' }[phase];
    var fl = document.getElementById('home-filings'), rail = document.querySelector('.home-rail');
    if (fl) { if (phase === 'pre') { var w = document.getElementById('watch'); if (w && w.parentNode === main) main.insertBefore(fl, w.nextSibling); fl.classList.add('fl-main'); } else if (rail && fl.parentNode !== rail) { rail.appendChild(fl); fl.classList.remove('fl-main'); } }
    seq.concat(ALL.filter(function (k) { return seq.indexOf(k) < 0; })).forEach(function (id) {
      var el = document.getElementById(id); if (!el || el.parentNode !== main) return;
      main.insertBefore(el, after ? after.nextSibling : main.firstChild); after = el;
      var off = !all && keep && keep.indexOf(id) < 0 && id !== 'feed';
      el.classList.toggle('ph-off', !!off); if (off) hidden += 1;
    });
    document.querySelector('.home-rail').classList.toggle('ph-off', !all && (p === 'beginner' || p === 'trader'));
    if (more) { more.parentNode.hidden = all || !hidden; more.textContent = '더 보기 (' + (hidden + ((p === 'beginner' || p === 'trader') ? 3 : 0)) + '개)'; }
  };
  if (more) more.addEventListener('click', function () { document.documentElement.classList.add('show-all'); apply(); });
  window.addEventListener('gnm-persona', apply);
  apply();
})();
</script>`;

const HOME_STYLE = `<style>.wl-st{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12.5px;font-weight:600;margin-top:2px}.wl-new{color:var(--warn-strong);background:var(--warn-soft);border-radius:6px;padding:0 6px}
.tier.t-mine{background:var(--warn-soft);color:var(--warn-strong)}.fl-main{margin-top:6px}
.phase-note{margin:14px 0 0;font-size:13px;color:var(--fg2);background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:8px 12px}.phase-note:empty{display:none}.phase-note b{color:var(--accent-strong)}
#sig-list{padding:6px 12px}#sig-list .row{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 2px;border-top:1px solid var(--line);text-decoration:none;color:inherit;font-size:14px}#sig-list .row:first-child{border-top:0}#sig-list .row small{font-size:12px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62vw}#sig-list .row>span:last-child{white-space:nowrap;font-weight:700}
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
.top-search{margin:14px 0 0;padding:0}.top-search .search-box{background:var(--surface);border:2px solid var(--navy);box-shadow:0 6px 18px rgba(15,34,68,.08)}.top-search .search-box input{font-size:16px}
.home-mkt{margin-top:12px}.home-mkt .mkt-tabs{margin-top:0}.ph-off{display:none!important}.show-more{text-align:center;margin:18px 0 6px}.btn-ghost{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:10px 18px;font:inherit;font-weight:700;cursor:pointer}
.pz-note .persona-bar{margin-left:auto}@media (max-width:820px){.top-search{margin-top:10px}.pz-note .persona-bar{margin-left:0}}
.pz-note{max-width:1180px;margin:10px auto 0;padding:0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--fg2)}.pz-note>span{flex:1;min-width:200px;background:var(--soft);border-radius:12px;padding:9px 12px}.pz-note b{color:var(--accent-strong)}.pz-edit{font-weight:700;font-size:13px;text-decoration:none;border:1px solid var(--accent);color:var(--accent-strong);border-radius:999px;padding:7px 12px;background:var(--surface);white-space:nowrap}@media (max-width:820px){.pz-note{padding:0 14px}}
.dl-day{font-size:12px;font-weight:700;color:var(--accent-strong);padding:10px 0 2px}.dl-old{border-top:1px solid var(--line);margin-top:4px;color:var(--muted)}.tier.t-k{background:var(--soft);color:var(--fg2)}
.mkt-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.mkt-tabs a{display:flex;flex-direction:column;gap:1px;border:1px solid var(--line-strong);border-radius:12px;padding:9px 12px;background:var(--surface);text-decoration:none;color:var(--fg);font-weight:700;font-size:14px}.mkt-tabs a small{font-weight:500;font-size:11px;color:var(--muted)}.mkt-tabs a:hover{border-color:var(--accent)}

.feed{background:linear-gradient(135deg,var(--accent-soft),var(--surface))}.feed-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.feed-head b{display:block;font-size:16px;line-height:1.45;margin-top:2px}.feed-redo{flex:none;font-size:13px;font-weight:700;color:var(--fg2)}
.feed-sum{margin:12px 0 2px;font-size:13.5px;color:var(--fg2)}.feed-sum b{color:var(--fg)}
.feed-list{list-style:none;margin:8px 0 0;padding:0}.feed-list:empty{display:none}.feed-row{display:grid;grid-template-columns:minmax(0,1fr) auto 76px;align-items:center;gap:10px;padding:11px 2px;border-top:1px solid var(--line);text-decoration:none;color:var(--fg)}.feed-list li:first-child .feed-row{border-top:0}.feed-n{display:flex;align-items:center;gap:6px;min-width:0}.feed-n b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.feed-rep{flex:none;font-size:10.5px;font-weight:800;color:var(--accent-strong);background:var(--accent-soft);border-radius:999px;padding:1px 7px}.feed-p{font-size:14px;font-variant-numeric:tabular-nums;color:var(--fg2)}.feed-c{justify-self:end;min-width:68px;text-align:center;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;border-radius:8px;padding:4px 6px;background:var(--soft)}.feed-c.up{background:var(--up-soft);color:var(--up-strong)}.feed-c.down{background:var(--down-soft);color:var(--down-strong)}
.feed-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.feed-chips:empty{display:none}.feed-preset{flex:1 1 100%;display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:14px;background:var(--surface);border:1px solid var(--line);text-decoration:none;color:var(--fg)}.feed-preset small{font-size:12px;color:var(--muted)}.feed-preset b{font-size:14.5px;color:var(--accent-strong)}.feed-go{width:100%;justify-content:center}
.chip-link{display:inline-flex;align-items:center;border:1px solid var(--line-strong);border-radius:999px;padding:5px 11px;font-size:13px;text-decoration:none;background:var(--surface)}.chip-link.alt{border-color:var(--navy);color:var(--navy);font-weight:700}.muted-chip{color:var(--muted);background:var(--soft)}
.home-hero{grid-template-columns:minmax(0,1fr)}.home-hero h1{font-size:30px}.home-hero .search-block{margin-top:14px;position:relative}
.ix-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ix-row.ix-4{grid-template-columns:repeat(4,minmax(0,1fr))}.ix-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.ix-v{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}.ix-c{font-weight:600;font-size:14px}
.br-bar,.pulse-bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;margin:10px 0 6px}.pulse-bar>span,.br-bar>span{min-width:4px}.br-bar .s-bull{background:var(--up)}.br-bar .s-neutral{background:var(--line-strong)}.br-bar .s-bear{background:var(--down)}.br-n{display:flex;justify-content:space-between;font-weight:700;font-size:14px}
.tt-list{padding:4px 14px}.tt-row{display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line);text-decoration:none;color:inherit}.tt-row:first-child{border-top:0}.tt-n{font-weight:800;color:var(--muted);text-align:center}.tt-main b{display:block;font-size:14.5px}.tt-main small{display:block;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tt-v{font-weight:800;text-align:right;font-variant-numeric:tabular-nums}.tt-v small{display:block;font-weight:500;color:var(--muted);font-size:11px}.home-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px;align-items:start}.home-rail{position:sticky;top:76px}
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
    if (!w.length) { box.innerHTML = '<p class="empty">☆를 눌러 관심 종목·ETF·코인을 모아 보세요.</p>'; return; }
    var show = function () {
      box.innerHTML = w.map(function (sym) {
        var it = (items || []).find(function (x) { return x[0] === sym; }) || [sym, sym, '', null, null, 0];
        var ch = it[4], coin = sym.indexOf('KRW-') === 0, href = it[5] ? sym + '/index.html' : coin ? 'coin.html?m=' + sym : 'stock.html?c=' + sym;
        var p = it[3], price = p == null ? '' : '<b data-live="' + esc(sym) + '" data-live-f="price">' + (Math.abs(p) >= 100 ? Math.round(p).toLocaleString('ko-KR') : p.toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + '원</b> ';
        var wi = info && info[sym], st = '';
        if (wi) {
          var near = [wi.up ? ['▲', wi.up] : null, wi.dn ? ['▼', wi.dn] : null].filter(Boolean).map(function (x) { return [x[0], x[1], (x[1] / (p || wi.c) - 1) * 100]; }).sort(function (a, b) { return Math.abs(a[2]) - Math.abs(b[2]); })[0];
          st = '<div class="wl-st">' + (near ? '<span class="' + (near[0] === '▲' ? 'up' : 'down') + '">' + near[0] + ' 테스트 ' + Math.round(near[1]).toLocaleString('ko-KR') + '원까지 ' + (near[2] > 0 ? '+' : '') + near[2].toFixed(1) + '%</span>' : '') + (wi.f ? '<span class="wl-new">새 공시 ' + wi.f + '</span>' : '') + (wi.n ? '<span class="wl-new">새 뉴스 ' + wi.n + '</span>' : '') + '</div>';
        }
        return '<div class="wl"><a href="' + href + '"><b>' + esc(it[1]) + '</b> <span class="muted small">' + esc(coin ? sym.replace('KRW-', '') + ' · 코인' : sym + (it[2] === 'ETF' ? ' · ETF' : '')) + '</span>' + st + '</a><span>' + price + (ch == null ? '' : '<span class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '" data-live="' + esc(sym) + '" data-live-f="pct">' + (ch > 0 ? '▲ +' : ch < 0 ? '▼ ' : '') + ch.toFixed(2) + '%</span>') + '</span><button type="button" class="star" data-star="' + esc(sym) + '" aria-pressed="true" aria-label="관심 종목에서 빼기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/></svg></button></div>';
      }).join('');
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
