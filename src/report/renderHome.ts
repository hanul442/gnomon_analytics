// Site front page as a market dashboard (docs/DESIGN.md §3.7, G-31). It answers
// "what should I look at now?" (BOR North Star §2): the indices and breadth,
// the market's temperature from every stock's free computation, this week's AI
// reports as one-line rows, today's movers, a watchlist kept in the browser,
// the scorecard summary and this week's filings. Pure rendering.

import type { DailyReport, ReportedFiling } from './dailyReport.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { MarketPulse, PulseBucket, StockCalc } from '../analysis/quickCalc.js';
import { LEVEL_LABEL } from '../analysis/technicals.js';
import { sparkline } from './appParts.js';
import { SEARCH_SCRIPT, shell, type HomeEntry } from './renderHtml.js';
import { gate } from './plans.js';
import { ALPHA_BANNERS, BANNER_JS, bannerHtml, type Banner } from './alphaPages.js';

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`;
const signed = (v: number | null, digits = 2) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`);
const tone = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');
const arrow = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? '▲' : '▼');

export interface IndexQuote { symbol: string; name: string; date: string; close: number; changePct: number | null; closes: number[] }

export interface HomeData {
  entries: readonly HomeEntry[];
  selection: { date: string; eligible: number; universe: number } | null;
  universe: readonly UniverseRow[] | null;
  pulse: MarketPulse | null;
  calcs?: ReadonlyMap<string, StockCalc>;
  indices: readonly IndexQuote[];
  /** Notices from banners.json, shown before the alpha guide and surveys. */
  banners?: readonly Banner[];
}

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/></svg>';
const star = (symbol: string, name: string) => `<button type="button" class="star" data-star="${esc(symbol)}" aria-pressed="false" aria-label="${esc(name)} 관심 종목">${STAR}</button>`;

const BUCKETS: readonly [PulseBucket, string, string][] = [
  ['STRONG_BULLISH', LEVEL_LABEL.STRONG_BULLISH, '#a8262b'], ['BULLISH', LEVEL_LABEL.BULLISH, '#e5484d'], ['SLIGHTLY_BULLISH', LEVEL_LABEL.SLIGHTLY_BULLISH, '#f0a0a3'],
  ['NEUTRAL', LEVEL_LABEL.NEUTRAL, '#c4cbc9'],
  ['SLIGHTLY_BEARISH', LEVEL_LABEL.SLIGHTLY_BEARISH, '#8fb3ec'], ['BEARISH', LEVEL_LABEL.BEARISH, '#3b7be0'], ['STRONG_BEARISH', LEVEL_LABEL.STRONG_BEARISH, '#1d4fa3'],
];

function indexStrip(indices: readonly IndexQuote[], universe: readonly UniverseRow[] | null): string {
  const common = (universe ?? []).filter((r) => r.kind === 'stock' && r.changePct !== null);
  const up = common.filter((r) => r.changePct! > 0).length, down = common.filter((r) => r.changePct! < 0).length, flat = common.length - up - down;
  const cards = indices.map((i) => `<div class="card ix"><div class="ix-top"><div><div class="pl-k">${esc(i.name)}</div><div class="ix-v">${i.close.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</div><div class="${tone(i.changePct)} ix-c">${arrow(i.changePct)} ${signed(i.changePct)}</div></div>${sparkline(i.closes, `${i.name} 최근 60거래일`, 110, 40)}</div><div class="muted small">${esc(i.date)} 종가</div></div>`).join('');
  const breadth = common.length ? `<div class="card ix"><div class="pl-k">오른 종목 · 내린 종목</div><div class="br-bar" aria-hidden="true"><span class="s-bull" style="flex:${up}"></span><span class="s-neutral" style="flex:${flat}"></span><span class="s-bear" style="flex:${down}"></span></div>
<div class="br-n"><span class="up">▲ ${up.toLocaleString('ko-KR')}</span><span class="muted">보합 ${flat.toLocaleString('ko-KR')}</span><span class="down">▼ ${down.toLocaleString('ko-KR')}</span></div><div class="muted small">코스피·코스닥 보통주 ${common.length.toLocaleString('ko-KR')}종목</div></div>` : '';
  return cards || breadth ? `<section class="block ix-row">${cards}${breadth}</section>` : '';
}

function pulseCard(p: MarketPulse | null): string {
  if (!p) return `<section class="block" id="pulse"><div class="block-head"><h2>시장 온도</h2></div><div class="card"><p class="empty">전 종목 계산은 다음 장 마감 실행에서 나와요.</p></div></section>`;
  const pct = (n: number) => Math.round((n / p.counted) * 100);
  const lean = p.bull - p.bear, verdict = lean > p.counted * 0.1 ? '강세 종목이 많아요' : lean < -p.counted * 0.1 ? '약세 종목이 많아요' : '엇갈려요';
  return `<section class="block" id="pulse"><div class="block-head"><h2>시장 온도</h2><a class="more-link" href="screener.html">${p.counted.toLocaleString('ko-KR')}종목 조건으로 걸러 보기 ›</a></div>
<div class="card pulse"><div class="pulse-head"><b class="${lean > 0 ? 'up' : lean < 0 ? 'down' : ''}">${verdict}</b><span><span class="up">강세 ${pct(p.bull)}%</span> · 중립 ${pct(p.neutral)}% · <span class="down">약세 ${pct(p.bear)}%</span></span></div>
<div class="pulse-bar" role="img" aria-label="${BUCKETS.map(([k, l]) => `${l} ${p.buckets[k]}종목`).join(', ')}">${BUCKETS.map(([k, l, c]) => (p.buckets[k] ? `<span style="flex:${p.buckets[k]};background:${c}" title="${l} ${p.buckets[k]}종목"></span>` : '')).join('')}</div>
<div class="pulse-legend">${BUCKETS.map(([k, l, c]) => `<span><i style="background:${c}"></i>${l} <b>${p.buckets[k].toLocaleString('ko-KR')}</b></span>`).join('')}${p.buckets.WITHHELD ? `<span><i style="background:#fff;border:1px solid #c4cbc9"></i>보류 <b>${p.buckets.WITHHELD}</b></span>` : ''}</div>
${p.up20 !== null ? `<p class="muted small">20거래일 전보다 오른 종목은 ${Math.round(p.up20 * 100)}%예요. 지표 16개를 종목마다 계산해 모은 값이고, 오를 확률이 아니에요.</p>` : ''}</div></section>`;
}

const GROUP = { core: '위원회 전체', weekly: '요약', request: '요청', past: '', daily: '' } as const;
const KIND = { stock: '주식', etf: 'ETF', coin: '코인' } as const;

/** Daily picks of the last seven days (G-56), newest day first. */
function dailyRows(entries: readonly HomeEntry[]): string {
  if (!entries.length) return '';
  const days = [...new Set(entries.map((e) => e.pickDate ?? ''))].sort().reverse();
  const row = (e: HomeEntry) => {
    const r = e.report, p = r?.price, c = r?.commentary?.status === 'OK' ? r.commentary : undefined;
    const line = (c?.summary?.text ?? r?.headline ?? '').split(/(?<=요\.)\s/)[0] ?? '';
    const kind = e.tier === 'deep' ? 'core' : 'weekly';
    return `<div class="rr" data-kind="${kind}"><a class="rr-main" href="${esc(e.href)}"><div class="rr-name"><b>${esc(e.name)}</b><span class="tier t-k">${KIND[e.kind ?? 'stock']}</span><span class="tier t-${kind}">${GROUP[kind]}</span></div><p class="rr-line">${esc(line || (e.reasons?.[0] ?? ''))}</p></a>
<div class="rr-side">${p ? `<b>${won(p.close)}</b><span class="${tone(p.changePct)}">${signed(p.changePct)}</span>` : ''}</div>${star(e.symbol, e.name)}</div>`;
  };
  return `<section class="block" id="daily"><div class="block-head"><h2>매일 AI 리포트</h2><span class="muted">평일 주식 5·ETF 1·코인 1, 주말 코인 1</span></div>
<div class="card list rr-list">${days.map((d, i) => `<div class="dl-day${i ? ' dl-old' : ''}">${esc(d.slice(5).replace('-', '/'))}${i ? '' : ' · 최신'}</div>${entries.filter((e) => e.pickDate === d).sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'deep' ? -1 : 1)).map(row).join('')}`).join('')}</div>
<p class="muted small">스크리너 상위 종목, 거래대금 상위 ETF·코인 가운데 무작위로 골라요. 시나리오 해설이고, 투자 권유가 아니에요.</p></section>`;
}

function reportRows(entries: readonly HomeEntry[], selection: HomeData['selection']): string {
  const rows = entries.map((e) => {
    const r = e.report, p = r?.price;
    const mid = r?.market?.horizons.find((h) => h.key === 'MEDIUM')?.summary;
    const c = r?.commentary?.status === 'OK' ? r.commentary : undefined;
    const line = (c?.summary?.text ?? r?.headline ?? '').split(/(?<=요\.)\s/)[0] ?? '';
    const kind = e.group === 'weekly' && e.tier === 'deep' ? 'core' : e.group;
    const lean = mid?.score == null ? '' : mid.score >= 0.1 ? 'bull' : mid.score <= -0.1 ? 'bear' : 'flat';
    return `<div class="rr" data-kind="${kind}" data-lean="${lean}"><a class="rr-main" href="${esc(e.href)}"><div class="rr-name"><b>${esc(e.name)}</b><span class="tier t-${kind}">${GROUP[kind]}</span></div><p class="rr-line">${esc(line)}</p></a>
<div class="rr-side">${p ? `<b>${won(p.close)}</b><span class="${tone(p.changePct)}">${signed(p.changePct)}</span>` : '<span class="muted small">가격 기록 없음</span>'}${mid ? `<span class="sig ${tone(mid.score === null ? null : mid.score >= 0.1 ? 1 : mid.score <= -0.1 ? -1 : 0)}">${esc(mid.label)}</span>` : ''}</div>${star(e.symbol, e.name)}</div>`;
  }).join('');
  const chip = (f: string, label: string, n?: number) => `<button type="button" class="chip-toggle" data-rf="${f}" aria-pressed="${f === ''}">${label}${n === undefined ? '' : ` ${n}`}</button>`;
  const count = (k: string) => entries.filter((e) => (e.group === 'weekly' && e.tier === 'deep' ? 'core' : e.group) === k).length;
  return `<section class="block" id="reports"><div class="block-head"><h2>이번 주 AI 리포트 ${entries.length}종목</h2><span class="muted">${selection ? `${esc(selection.date)} 선정 · ` : ''}매주 금요일 장 마감 뒤</span></div>
<div class="card list rr-list"><div class="pl-chips rr-chips" role="group" aria-label="리포트 거르기">${chip('', '전체', entries.length)}${count('core') ? chip('core', '위원회 전체', count('core')) : ''}${count('weekly') ? chip('weekly', '요약', count('weekly')) : ''}${count('request') ? chip('request', '요청', count('request')) : ''}${chip('bull', '강세')}${chip('bear', '약세')}</div>${rows || '<p class="empty">아직 리포트가 없어요.</p>'}</div>
<p class="muted small">위원회 전체는 대표 종목과 시가총액 상위 종목, 요약은 시가총액·거래대금·공시·움직임으로 고른 종목이에요. 신호는 중기(일봉) 기술 신호예요.</p></section>`;
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
  return `<section class="block"><div class="block-head"><h2>주요 공시</h2><span class="muted">리포트 종목 · 최근</span></div><div class="card list">${top.length ? top.map((f) => `<div class="fl"><span class="muted small">${esc(f.filedDate.slice(5))}</span><div><a href="${esc(f.href)}#tab-news"><b>${esc(f.name)}</b></a><div class="small">${esc(f.title)}</div></div></div>`).join('') : '<p class="empty">최근 주요 공시가 없어요.</p>'}</div></section>`;
}

const PLAN_CARD = `<section class="block"><div class="card plan-cta"><div class="pl-k">지금 요금제 <b data-plan-name>무료</b> · <span data-credits>0</span> 크레딧</div>
<p>무료는 한 줄 요약, <b>플러스</b>는 상세 설명, <b>프로</b>는 직접 요청하고 질문하기, <b>맥스</b>는 내 종목을 매주 위원회가 분석해요. 크레딧은 누구나 충전해서 써요.</p><a class="btn-primary" href="pricing.html">요금제 보기</a></div></section>`;

const WATCH = `<section class="block" id="watch"><div class="block-head"><h2>관심 종목</h2><span class="muted">이 브라우저에 저장돼요</span></div><div class="card list" id="watch-list"><p class="empty">☆를 눌러 관심 종목·ETF·코인을 모아 보세요.</p></div></section>`;

export function renderHome(data: HomeData): string {
  // Reports someone requested stay off the front page (G-61): they are found by search and opened with credits.
  const entries = data.entries.filter((e) => e.group !== 'past' && e.group !== 'daily' && e.group !== 'request');
  const daily = data.entries.filter((e) => e.group === 'daily');
  const order = { core: 0, weekly: 1, request: 2, past: 3, daily: 4 } as const;
  const sorted = [...entries].sort((a, b) => order[a.group] - order[b.group] || (a.tier === b.tier ? 0 : a.tier === 'deep' ? -1 : 1));
  const covered = new Set(data.entries.map((e) => e.symbol));
  const asOf = data.pulse?.date ?? data.indices[0]?.date ?? '';
  const body = `${HOME_STYLE}${bannerHtml([...(data.banners ?? []), ...ALPHA_BANNERS])}<div class="pz-note" id="pz-note" hidden><span id="pz-text"></span><a class="pz-edit" href="onboarding.html">설문 수정하기</a></div><section class="hero home-hero" id="top"><div class="hero-main"><div class="eyebrow"><span>오늘 시장</span>${asOf ? `<span>${esc(asOf)} 기준</span>` : ''}</div><h1>지금 무엇을 봐야 할까요</h1>
<p class="hero-line">전 종목의 기술 신호를 매일 계산하고, 매일 주식·ETF·코인 AI 리포트를 써요. 예측은 기록해 두고 나중에 채점해요.</p>
<div class="search-block" id="search"><label class="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="q" type="search" placeholder="종목·ETF·코인 (예: 삼성, ㅅㅅㅈㅈ, BTC)" autocomplete="off" aria-label="종목 검색" aria-controls="search-results"></label>
<div id="search-results" class="card list search-results" role="region" aria-live="polite" hidden></div></div>
<nav class="mkt-tabs" aria-label="시장"><a href="screener.html">국내 주식<small>스크리너</small></a><a href="etfs.html">ETF<small>국내 상장 전체</small></a><a href="coins.html">코인<small>업비트 원화</small></a></nav></div></section>
${indexStrip(data.indices, data.universe)}
<div class="home-grid"><div class="home-main">${FEED}${pulseCard(data.pulse)}${WATCH}${dailyRows(daily)}${reportRows(sorted, data.selection)}${movers(data.universe, covered)}</div>
<aside class="home-rail">${scorecard(sorted)}${filings(sorted)}${PLAN_CARD}</aside></div>
<footer id="sources" style="padding:24px 0 0"><p>데이터: Naver 금융, 네이버 증권, OpenDART, 네이버 뉴스 검색과 RSS. 계산 결과이고, 투자 권유가 아니에요.</p></footer>`;
  return shell('', 'Gnomon Analytics | 오늘 시장', body, { active: 'home', scripts: SEARCH_SCRIPT + HOME_SCRIPT + FEED_SCRIPT + BANNER_JS });
}

/** My feed (G-46): from the onboarding survey, kept in this browser. Leads with my stocks and puts first what I said I want to see. */
const FEED = `<section class="block" id="feed" hidden><div class="card feed"><div class="feed-head"><div><div class="pl-k">내 피드</div><b id="feed-title">관심 종목과 투자 스타일에 맞춘 순서예요</b></div><a class="muted small" href="onboarding.html">설문 다시 하기</a></div><div id="feed-chips" class="feed-chips"></div></div></section>`;
const FEED_SCRIPT = `<script>
(function () {
  var prefs = null; try { prefs = JSON.parse(localStorage.getItem('gnm-prefs') || 'null'); } catch (e) {}
  var box = document.getElementById('feed'); if (!box || !prefs) return;
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
  var chips = [];
  (prefs.tickers || []).slice(0, 6).forEach(function (t) { chips.push('<a class="chip-link" href="stock.html?c=' + esc(t[0]) + '">' + esc(t[1]) + '</a>'); });
  if (preset) chips.push('<a class="chip-link alt" href="screener.html#' + preset[0] + '">스크리너: ' + preset[1] + '</a>');
  (prefs.sectors || []).slice(0, 4).forEach(function (s) { chips.push('<span class="chip-link muted-chip">' + esc(s) + '</span>'); });
  document.getElementById('feed-chips').innerHTML = chips.join('');
  box.hidden = false;
  if (location.hash === '#feed') box.scrollIntoView({ block: 'start' });
})();
</script>`;

const HOME_STYLE = `<style>.pz-note{max-width:1180px;margin:10px auto 0;padding:0 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--fg2)}.pz-note>span{flex:1;min-width:200px;background:#eef3fb;border-radius:12px;padding:9px 12px}.pz-note b{color:var(--accent-strong)}.pz-edit{font-weight:700;font-size:13px;text-decoration:none;border:1px solid var(--accent);color:var(--accent-strong);border-radius:999px;padding:7px 12px;background:#fff;white-space:nowrap}@media (max-width:820px){.pz-note{padding:0 14px}}
.dl-day{font-size:12px;font-weight:700;color:var(--accent-strong);padding:10px 0 2px}.dl-old{border-top:1px solid var(--line);margin-top:4px;color:var(--muted)}.tier.t-k{background:#eef1f5;color:var(--fg2)}
.mkt-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.mkt-tabs a{display:flex;flex-direction:column;gap:1px;border:1px solid var(--line-strong);border-radius:12px;padding:9px 12px;background:#fff;text-decoration:none;color:var(--fg);font-weight:700;font-size:14px}.mkt-tabs a small{font-weight:500;font-size:11px;color:var(--muted)}.mkt-tabs a:hover{border-color:var(--accent)}

.feed{background:linear-gradient(135deg,#f3f7fd,#fff)}.feed-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.feed-head b{font-size:16px}.feed-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.chip-link{display:inline-flex;align-items:center;border:1px solid var(--line-strong);border-radius:999px;padding:5px 11px;font-size:13px;text-decoration:none;background:#fff}.chip-link.alt{border-color:var(--navy);color:var(--navy);font-weight:700}.muted-chip{color:var(--muted);background:#f4f6f9}
.home-hero{grid-template-columns:minmax(0,1fr)}.home-hero h1{font-size:30px}.home-hero .search-block{margin-top:14px;position:relative}
.ix-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ix-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}.ix-v{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums}.ix-c{font-weight:600;font-size:14px}
.br-bar,.pulse-bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;margin:10px 0 6px}.br-bar .s-bull{background:#d1373d}.br-bar .s-neutral{background:#c4cbc9}.br-bar .s-bear{background:#2a62c9}.br-n{display:flex;justify-content:space-between;font-weight:700;font-size:14px}
.home-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:20px;align-items:start}.home-rail{position:sticky;top:76px}
.pulse-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}.pulse-head b{font-size:22px}.pulse-bar{height:16px;border-radius:8px}
.pulse-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--fg2)}.pulse-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.rr{display:grid;grid-template-columns:minmax(0,1fr) auto 36px;gap:10px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}.rr-chips{padding:10px 0 4px}
.rr-main{text-decoration:none;min-width:0}.rr-name{display:flex;align-items:center;gap:8px}.rr-name b{font-size:15px}.rr-line{margin:2px 0 0;font-size:13px;color:var(--fg2);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.rr-side{display:flex;flex-direction:column;align-items:flex-end;gap:1px;font-size:13px;font-variant-numeric:tabular-nums}.rr-side b{font-size:14px}.sig{font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px;background:#eef1f5;color:var(--fg2)}.sig.up{background:#fde8e6;color:#9f1d24}.sig.down{background:#e3ecfb;color:#1f4fa8}
.tier{font-size:11px;font-weight:700;border-radius:999px;padding:1px 7px;background:#eef1f5;color:var(--fg2)}.tier.t-core{background:var(--navy);color:#fff}.tier.t-request{background:#fff3d6;color:#7a4a00}
.rr[hidden]{display:none}

.mv-tabs{margin:10px 0 4px}.mvr{display:grid;grid-template-columns:22px minmax(0,1fr) auto 36px;gap:8px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}.mvr-i{color:var(--muted);font-weight:700;font-size:13px}.mvr-n{text-decoration:none;display:flex;flex-direction:column;min-width:0}.mvr-n b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mvr-v{display:flex;flex-direction:column;align-items:flex-end;font-size:13px;font-variant-numeric:tabular-nums}
.sc-free{margin-bottom:10px}.sc-k{font-size:12px;font-weight:700;color:var(--muted)}.sc-v{font-size:28px;font-weight:800}.sc-board{margin:6px 0 0;padding-left:18px}.sc-board li{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;padding:4px 0;font-size:14px}
.fl{display:grid;grid-template-columns:44px minmax(0,1fr);gap:8px;padding:9px 0;border-top:1px solid var(--line)}.fl:first-child{border-top:0}.fl a{text-decoration:none}
.plan-cta p{font-size:14px;margin:8px 0}.plan-cta .btn-primary{width:100%;justify-content:center}
.wl{display:grid;grid-template-columns:minmax(0,1fr) auto 36px;gap:8px;align-items:center;padding:9px 0;border-top:1px solid var(--line)}.wl:first-child{border-top:0}.wl a{text-decoration:none}
@media (max-width:1100px){.home-grid{grid-template-columns:minmax(0,1fr)}.home-rail{position:static}}
@media (max-width:820px){.ix-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.ix-row>.card:last-child{grid-column:1/3}.ix .spark{display:none}.ix-v{font-size:18px}.home-hero h1{font-size:24px}.home-hero .hero-line{display:block;font-size:13px}.rr-chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.rr-chips>*{flex:none}}
</style>`;

const HOME_SCRIPT = `<script>
(function () {
  var KEY = 'gnm-watch';
  var read = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  // The alpha layer keeps the list on the server too (intraday alerts); it listens for this event.
  var write = function (w) { try { localStorage.setItem(KEY, JSON.stringify(w)); localStorage.setItem('gnm-watch-at', String(Date.now())); } catch (e) {} window.dispatchEvent(new Event('gnm-watch')); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var items = null;
  var drawWatch = function () {
    var w = read(), box = document.getElementById('watch-list'); if (!box) return;
    document.querySelectorAll('[data-star]').forEach(function (b) { b.setAttribute('aria-pressed', String(w.indexOf(b.getAttribute('data-star')) >= 0)); });
    if (!w.length) { box.innerHTML = '<p class="empty">☆를 눌러 관심 종목·ETF·코인을 모아 보세요.</p>'; return; }
    var show = function () {
      box.innerHTML = w.map(function (sym) {
        var it = (items || []).find(function (x) { return x[0] === sym; }) || [sym, sym, '', null, null, 0];
        var ch = it[4], coin = sym.indexOf('KRW-') === 0, href = it[5] ? sym + '/index.html' : coin ? 'coin.html?m=' + sym : 'stock.html?c=' + sym;
        var p = it[3], price = p == null ? '' : '<b>' + (Math.abs(p) >= 100 ? Math.round(p).toLocaleString('ko-KR') : p.toLocaleString('ko-KR', { maximumFractionDigits: 4 })) + '원</b> ';
        return '<div class="wl"><a href="' + href + '"><b>' + esc(it[1]) + '</b> <span class="muted small">' + esc(coin ? sym.replace('KRW-', '') + ' · 코인' : sym + (it[2] === 'ETF' ? ' · ETF' : '')) + '</span></a><span>' + price + (ch == null ? '' : '<span class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' + (ch > 0 ? '+' : '') + ch.toFixed(2) + '%</span>') + '</span><button type="button" class="star" data-star="' + esc(sym) + '" aria-pressed="true" aria-label="관심 종목에서 빼기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.2 7 19l1.2-5.6L4 9.6 9.6 9z"/></svg></button></div>';
      }).join('');
    };
    show();
    // Stocks from search.json; ETFs and coins from their lists (same row shape: code, name, market, price, change, report).
    if (!items) {
      var list = function (url, kind) { return fetch(url).then(function (r) { return r.json(); }).then(function (d) { return (d.rows || []).map(function (x) { return [x[0], x[1], kind, x[4], x[5], 0]; }); }).catch(function () { return []; }); };
      Promise.all([fetch('search.json').then(function (r) { return r.json(); }).then(function (d) { return d.items; }).catch(function () { return []; }), list('etfs.json', 'ETF'), list('coins.json', 'COIN')]).then(function (all) {
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
