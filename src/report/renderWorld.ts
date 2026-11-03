// G-268: 세계, the world on one screen (한서님 10/20: "최대한 많은 세계 뉴스와 이슈와 증시와 시장을 한눈에").
// Five text tabs in one page: 요약 (a sentence, the world map, six key numbers, the top issues), 증시 (17 indices by
// region), 금리·환율, 원자재 (with shipping rates) and 뉴스 (world news issues). Charts are the Bklit kit (kmStatArea,
// the world map). Numbers only: which markets moved the same day as a story is shown side by side, never as a cause,
// and nothing here tells anyone to buy or sell.

import { shell } from './renderHtml.js';
import { esc } from './html.js';
import { smoothD } from './chartLook.js';
import { kmDualLine, kmStatArea } from './kit/market.js';
import { contentMore, CONTENT_MORE_CSS } from './contentMore.js';
import { kmWorldMapAll, KIT_WORLD_CSS, type WorldMapEntry } from './kit/worldMap.js';
import type { WorldIndexQuote, WorldMacroQuote, WorldMarkets, WorldRegion } from '../sources/naverGlobal.js';
import type { WorldIssue, WorldIssueBoard, WorldTag } from '../analysis/worldNews.js';

export interface WorldPage { markets: WorldMarkets; news: WorldIssueBoard }

const signed = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;
const tone = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');
const pct = (v: number | null | undefined, d = 2) => (v == null ? '—' : `${signed(v, d)}%`);
const fmt = (v: number, d: number) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
const digitsOf = (q: WorldMacroQuote) => (q.group === 'bond' ? 3 : q.group === 'policy' ? 2 : q.group === 'ship' ? 0 : q.value >= 1000 ? 2 : q.value >= 10 ? 2 : 4);
const valueText = (q: WorldMacroQuote) => `${q.unit === '$' ? '$' : ''}${fmt(q.value, digitsOf(q))}${q.unit === '%' ? '%' : ''}`;
/** A bond's move reads in basis points; everything else in percent. */
const moveText = (q: WorldMacroQuote) => (q.group === 'bond' && q.change != null ? `${signed(q.change * 100, 1).replace('.0', '')}bp` : pct(q.changePct));
const moveTone = (q: WorldMacroQuote) => tone(q.group === 'bond' ? q.change : q.changePct);
const kstHm = (iso: string) => { const d = new Date(Date.parse(iso) + 9 * 3600_000); return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

/** The main index of each country, in WORLD_INDICES order. */
const mainOf = (indices: readonly WorldIndexQuote[]) => { const seen = new Set<string>(); return indices.filter((q) => (seen.has(q.iso) ? false : (seen.add(q.iso), true))); };
const avg = (xs: readonly (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

interface Band { name: string; regions: WorldRegion[]; change: number | null; open: boolean; down: number; total: number }
export function bands(indices: readonly WorldIndexQuote[]): Band[] {
  const main = mainOf(indices);
  return ([['아시아', ['한국', '아시아']], ['유럽', ['유럽']], ['미국', ['미국']]] as const).map(([name, regions]) => {
    const xs = main.filter((q) => (regions as readonly string[]).includes(q.region));
    return { name, regions: [...regions], change: avg(xs.map((q) => q.changePct)), open: xs.some((q) => q.open), down: xs.filter((q) => (q.changePct ?? 0) < 0).length, total: xs.length };
  });
}

/** One sentence from the numbers: the regions that moved together, and one big move in oil, gold or the won. */
export function worldSentence(m: WorldMarkets): string {
  const parts: string[] = [];
  const bs = bands(m.indices).filter((b) => b.change != null && Math.abs(b.change) >= 0.5);
  const ups = bs.filter((b) => b.change! > 0).map((b) => b.name), downs = bs.filter((b) => b.change! < 0).map((b) => b.name);
  if (downs.length) parts.push(`${downs.join('·')} 증시가 ${downs.length > 1 ? '함께 ' : ''}내렸`);
  if (ups.length) parts.push(`${ups.join('·')} 증시가 ${ups.length > 1 ? '함께 ' : ''}올랐`);
  const big = m.macro.filter((q) => q.changePct != null && Math.abs(q.changePct) >= (q.key === 'USDKRW' ? 0.7 : 1.5) && ['WTI', 'BRENT', 'GOLD', 'USDKRW', 'COPPER', 'NG'].includes(q.key))
    .sort((a, b) => Math.abs(b.changePct!) - Math.abs(a.changePct!))[0];
  const what: Record<string, string> = { WTI: '유가', BRENT: '유가', GOLD: '금값', USDKRW: '원/달러 환율', COPPER: '구리값', NG: '천연가스값' };
  const tail = big ? `${what[big.key]}는 하루에 ${Math.abs(big.changePct!).toFixed(1)}% ${big.changePct! > 0 ? '올랐어요' : '내렸어요'}.` : '';
  if (!parts.length) return tail ? `세계 증시는 크게 움직이지 않았고, ${tail}` : '세계 증시가 크게 움직이지 않은 하루예요.';
  const head = parts.join('고, ');
  return tail ? `${head}고, ${tail}` : `${head}어요.`;
}

/** One map row per country (its first index), plus Europe as the average of its countries. Shared with the market daily. */
export function worldMapRows(indices: readonly WorldIndexQuote[]): WorldMapEntry[] {
  const main = mainOf(indices);
  const europe = main.filter((x) => x.region === '유럽' && x.iso !== 'EU');
  return [
    ...main.filter((x) => x.iso !== 'EU').map((x) => ({ iso: x.iso, country: x.country, index: x.name, change: x.changePct, note: x.open ? '지금 거래 중' : '마감' })),
    ...(europe.length ? [{ iso: 'EU', country: '유럽', index: '영국·독일·프랑스 평균', change: avg(europe.map((x) => x.changePct)) }] : []),
  ];
}

/** A rate, currency or commodity as the kit's stat card (bonds badge their move in bp). Shared with the market daily. */
export const worldMacroStat = (x: WorldMacroQuote | null, line = false): string => (x ? kmStatArea({ title: x.group === 'bond' ? `${x.name} 10년` : x.name, value: x.value, change: x.changePct, series: x.series, digits: digitsOf(x), label: x.unit === '%' ? '%' : x.unit === '$' ? '달러' : x.unit || '', unit: '일', line, ...(x.group === 'bond' ? { badge: { text: moveText(x), tone: tone(x.change) } } : {}) }) : '');

const spark = (series: readonly (readonly [string, number])[], w = 64, h = 22) => {
  if (series.length < 2) return '';
  const vs = series.map((p) => p[1]), lo = Math.min(...vs), hi = Math.max(...vs), sp = hi - lo || 1;
  const pts = vs.map((v, i) => `${((i / (vs.length - 1)) * w).toFixed(1)},${(2 + (1 - (v - lo) / sp) * (h - 4)).toFixed(1)}`).join(' ');
  const t = tone(vs.at(-1)! - vs[0]!);
  return `<svg class="wd-sp ${t}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="${smoothD(pts)}"/></svg>`;
};

export function marketsOf(m: WorldMarkets): Map<string, { name: string; move: string; tone: string }> {
  const out = new Map<string, { name: string; move: string; tone: string }>();
  for (const q of m.indices) out.set(q.key, { name: q.name, move: pct(q.changePct), tone: tone(q.changePct) });
  for (const q of m.macro) out.set(q.key, { name: q.group === 'bond' ? `${q.name} 10년 금리` : q.name, move: moveText(q), tone: moveTone(q) });
  return out;
}

export function issueRow(i: WorldIssue, mk: ReturnType<typeof marketsOf>, full: boolean): string {
  const chips = i.markets.map((k) => mk.get(k)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => `<span class="wd-chip">${esc(x.name)} <b class="${x.tone}">${esc(x.move)}</b></span>`).join('');
  const more = full && i.headlines.length > 1 ? `<details class="wd-more"><summary>같은 이슈 제목 ${i.headlines.length}개</summary><ul>${i.headlines.map((h) => `<li><a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a> <small>${esc(h.publisher)}</small></li>`).join('')}</ul></details>` : '';
  const move = i.isNew ? '<span class="wd-new">새</span>' : i.prevRank && i.prevRank !== i.rank ? `<span class="wd-mv ${i.prevRank > i.rank ? 'up' : 'down'}">${i.prevRank > i.rank ? '▲' : '▼'}${Math.abs(i.prevRank - i.rank)}</span>` : '';
  return `<li class="wd-is" data-tag="${esc(i.tag ?? '')}"><b class="wd-rk">${i.rank}</b><div><div class="wd-ih"><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a>${move}</div><small class="wd-im">${i.lang === 'en' ? '영문 · ' : ''}매체 ${i.outlets}곳 · ${esc(i.publisher)}</small><div class="wd-chips">${i.tag ? `<span class="wd-chip tag">${esc(i.tag)}</span>` : ''}${chips}</div>${more}</div></li>`;
}

/** G-277: a row with a series opens it big (kit/sheet.ts reads data-sheet). */
const sheetOf = (name: string, series: readonly (readonly [string, number])[] | undefined, digits: number, unit = '') => (series && series.length >= 2 ? ` data-sheet="${esc(JSON.stringify(series.map((p) => [p[0], p[1]])))}" data-sheet-title="${esc(name)}" data-sheet-digits="${digits}"${unit ? ` data-sheet-unit="${esc(unit)}"` : ''} tabindex="0" role="button"` : '');
const row = (name: string, sub: string, value: string, move: string, t: string, sp = '', sheet = '') => `<div class="wd-row"${sheet}><span class="wd-n"><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${sp}<span class="wd-v">${esc(value)}</span><b class="wd-c ${t}">${esc(move)}</b></div>`;

/** G-277: the world screen's panels, shared by home (요약·증시·금리·환율·원자재) and world.html. */
export interface WorldPanels { sum: string; stocks: string; rates: string; commod: string; news: string; key6: string; market: string; key4: string; sentence: string; asof: string }
export function worldPanels(p: WorldPage): WorldPanels {
  const m = p.markets, mk = marketsOf(m);
  const q = (key: string) => m.macro.find((x) => x.key === key) ?? null;
  const ix = (key: string) => m.indices.find((x) => x.key === key) ?? null;

  // 요약
  const main = mainOf(m.indices);
  const mapRows = worldMapRows(m.indices);
  const bandHtml = `<div class="wd-bands">${bands(m.indices).map((b) => `<div class="wd-band${b.open ? ' on' : ''}"><small>${esc(b.name)} · ${b.open ? '거래 중' : '마감'}</small><b class="${tone(b.change)}">${pct(b.change, 1)}</b><small>${b.total}곳 중 ${b.down}곳 내림</small></div>`).join('')}</div>`;
  const statIx = (x: WorldIndexQuote | null) => (x ? kmStatArea({ title: x.name, value: x.value, change: x.changePct, series: x.series, digits: 2, label: x.open ? '거래 중' : '종가', unit: '일', openTail: !!x.open }) : '');
  const statMacro = worldMacroStat;
  const key6 = [statIx(ix('KOSPI')), statIx(ix('.INX')), statMacro(q('USDKRW')), statMacro(q('WTI')), statMacro(q('GOLD')), statMacro(q('US10Y'), true)].join('');
  const issues = p.news.issues;
  const top = issues.length ? `<section class="card wd-card"><div class="wd-h"><h2>세계 이슈 순위</h2><button type="button" class="wd-link" data-wd-go="news">${issues.length}개 보기 ›</button></div><ol class="wd-iss">${issues.slice(0, 3).map((i) => issueRow(i, mk, false)).join('')}</ol></section>` : '';
  const sum = `<section class="card wd-card wd-hero"><small>오늘 세계, 한 줄로</small><p>${esc(worldSentence(m))}</p><small>숫자로 자동으로 쓴 문장이에요. 이유는 단정하지 않아요.</small></section>
<section class="card wd-card"><div class="wd-h"><h2>세계 증시 지도</h2><span class="muted small">하루 등락 · ${main.length}곳</span></div>${kmWorldMapAll(mapRows, '나라를 누르면 지수와 등락이 떠요. 빨강은 오름, 파랑은 내림, 진할수록 많이 움직였어요.')}${bandHtml}</section>
<div class="wd-h wd-out"><h2>꼭 볼 숫자</h2><button type="button" class="wd-link" data-wd-go="rates">전부 보기 ›</button></div><div class="km-stats wd-stats">${key6}</div>${top}`;

  // 증시
  const regions: WorldRegion[] = ['한국', '미국', '아시아', '유럽', '남미'];
  const up = m.indices.filter((x) => (x.changePct ?? 0) > 0).length, down = m.indices.filter((x) => (x.changePct ?? 0) < 0).length;
  const heat = `<div class="wd-heat">${main.map((x) => `<span style="${heatBg(x.changePct)}"><small>${esc(x.country)}</small><b>${pct(x.changePct, 1)}</b></span>`).join('')}</div>`;
  const stocks = `<section class="card wd-card"><div class="wd-h"><h2>지수 ${m.indices.length}개</h2><span class="muted small"><span class="up">▲${up}</span> · <span class="down">▼${down}</span></span></div>${heat}</section>
${regions.map((r) => { const xs = m.indices.filter((x) => x.region === r); if (!xs.length) return ''; const open = xs.some((x) => x.open);
    return `<section class="card wd-card"><div class="wd-h"><h2>${r}</h2><span class="wd-st${open ? ' on' : ''}">${open ? '지금 거래 중' : '마감'}</span></div>${xs.map((x) => row(x.name, x.country, fmt(x.value, 2), pct(x.changePct), tone(x.changePct), spark(x.series), sheetOf(x.name, x.series, 2))).join('')}</section>`; }).join('')}
<p class="fine wd-fine">장이 열린 곳은 15분 안팎 늦은 값이에요. 선은 최근 30거래일 종가예요.</p>`;

  // 금리·환율
  const policy = m.macro.filter((x) => x.group === 'policy');
  const maxRate = Math.max(1, ...policy.map((x) => x.value));
  // G-282: 원/달러 and 미국 10년 금리 on one chart, each on its own axis (Bklit two-axis line).
  const usd = q('USDKRW'), us10 = q('US10Y');
  const dualFig = usd && us10 ? kmDualLine({ name: '원/달러', series: usd.series, digits: 0, unit: '원' }, { name: '미국 10년 금리', series: us10.series, digits: 2, unit: '%' }, '두 선은 축이 달라요. 높이가 겹쳐도 같은 값이 아니에요.') : '';
  const dual = dualFig ? `<section class="card wd-card"><div class="wd-h"><h2>환율과 금리 같이 보기</h2><span class="muted small">최근 ${usd!.series?.length ?? 0}일</span></div>${dualFig}</section>` : '';
  const rates = `${policy.length ? `<section class="card wd-card"><div class="wd-h"><h2>나라별 기준금리</h2><span class="muted small">중앙은행 발표 값</span></div><div class="wd-bars">${policy.map((x) => `<div><span>${esc(x.name)}</span><i><i style="width:${((x.value / maxRate) * 100).toFixed(0)}%"></i></i><b>${fmt(x.value, 2)}%</b></div>`).join('')}</div></section>` : ''}
<div class="km-stats wd-stats">${[statMacro(q('US10Y'), true), statMacro(q('USDKRW'), true), statMacro(q('DXY'), true), statMacro(q('VIX'), true)].join('')}</div>
${dual}<section class="card wd-card"><div class="wd-h"><h2>10년 국채 금리</h2><span class="muted small">전날 대비</span></div>${m.macro.filter((x) => x.group === 'bond').map((x) => row(x.name, '', valueText(x), moveText(x), moveTone(x))).join('')}</section>
<section class="card wd-card"><div class="wd-h"><h2>환율</h2><span class="muted small">원화는 하나은행 고시</span></div>${m.macro.filter((x) => x.group === 'fx').map((x) => row(x.name, x.hint ?? '', valueText(x), moveText(x), moveTone(x), spark(x.series), sheetOf(x.name, x.series, digitsOf(x)))).join('')}</section>`;

  // 원자재
  const commod = `<div class="km-stats wd-stats">${[statMacro(q('WTI')), statMacro(q('GOLD'))].join('')}</div>
<section class="card wd-card"><div class="wd-h"><h2>원자재</h2><span class="muted small">선물 · 달러</span></div>${m.macro.filter((x) => x.group === 'energy' || x.group === 'metals').map((x) => row(x.name, '', valueText(x), moveText(x), moveTone(x), spark(x.series), sheetOf(x.name, x.series, digitsOf(x)))).join('')}</section>
<section class="card wd-card"><div class="wd-h"><h2>바닷길 운임</h2><span class="muted small">수출입 물동량의 온도</span></div>${m.macro.filter((x) => x.group === 'ship').map((x) => row(x.name, x.hint ?? '', valueText(x), moveText(x), moveTone(x))).join('')}</section>`;

  // 뉴스
  const tags: WorldTag[] = ['지정학', '경제·금리', '기업·기술', '한국'];
  const news = issues.length ? `<div class="wd-filter" role="group" aria-label="분야"><button type="button" data-wd-tag="" aria-pressed="true">전체</button>${tags.map((t) => `<button type="button" data-wd-tag="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>
<section class="card wd-card"><ol class="wd-iss">${issues.map((i) => issueRow(i, mk, true)).join('')}</ol></section>
<p class="fine wd-fine">국내 세계·경제 뉴스와 영어 경제 뉴스 제목을 모아 같은 사건끼리 묶고, 다룬 매체가 많은 순으로 세웠어요${p.news.from && p.news.to ? ` (${esc(kstHm(p.news.from))} ~ ${esc(kstHm(p.news.to))})` : ''}. 옆의 시장 숫자는 같은 날 함께 움직인 값이고, 원인이라는 뜻이 아니에요. 기사는 제목·매체·링크만 보여 줘요.</p>`
    : '<section class="card wd-card"><p class="muted">세계 뉴스를 아직 모으지 못했어요.</p></section>';

  // G-281 (한서님 10/22 "분류가 각 종류에 맞게"): home's 시장 — every number once, in four kinds, one row shape.
  // 증시 (indices + VIX, the stock market's fear gauge) → 금리 (policy + 10-year) → 환율 → 원자재 (with shipping).
  const mrow = (x: WorldMacroQuote) => row(x.group === 'bond' ? `${x.name} 10년` : x.name, x.hint ?? '', valueText(x), moveText(x), moveTone(x), spark(x.series), sheetOf(x.group === 'bond' ? `${x.name} 10년 금리` : x.name, x.series, digitsOf(x)));
  const irow = (x: WorldIndexQuote) => row(x.name, x.country, fmt(x.value, 2), pct(x.changePct), tone(x.changePct), spark(x.series), sheetOf(x.name, x.series, 2));
  const sec = (id: string, title: string, side: string, rows: string[], label: string, limit: number) => (rows.length ? `<section class="card wd-card mk-sec" id="mk-${id}"><div class="wd-h"><h2>${title}</h2><span class="muted small">${side}</span></div>${contentMore(rows, label, (h) => h, limit)}</section>` : '');
  const FIRST = ['KOSPI', 'KOSDAQ', '.INX', '.IXIC', '.N225'];
  const ixOrdered = [...FIRST.map(ix).filter((x): x is WorldIndexQuote => !!x), ...m.indices.filter((x) => !FIRST.includes(x.key))];
  const vix = q('VIX');
  const ixRows = ixOrdered.map(irow);
  ixRows.splice(Math.min(5, ixRows.length), 0, ...(vix ? [mrow(vix)] : []));
  const of = (...g: string[]) => m.macro.filter((x) => g.includes(x.group));
  // 금리: 미국·한국 first (기준금리, then 10년), the rest under 더 보기.
  const rateFirst = ['FED', 'BOK', 'US10Y', 'KR10Y'];
  const rateRow = (x: WorldMacroQuote) => (x.group === 'policy' ? row(x.name, '기준금리', valueText(x), '', '') : mrow(x));
  const rates0 = of('policy', 'bond');
  const rateRows = [...rateFirst.map((k) => rates0.find((x) => x.key === k)).filter((x): x is WorldMacroQuote => !!x), ...rates0.filter((x) => !rateFirst.includes(x.key))].map(rateRow);
  // G-287 (한서님 10/23 '해외 보여주는건 이전에 보여주던 방식으로 … 지수말한거임'): 증시 is the old world 증시 view again —
  // every index's move in one grid, then one card per region (한국·미국·아시아·유럽·남미) with whether it is trading.
  // VIX, the US market's fear gauge, sits in 미국.
  const regionCards = regions.map((r) => { const xs = m.indices.filter((x) => x.region === r); if (!xs.length) return ''; const open = xs.some((x) => x.open);
    return `<section class="card wd-card"><div class="wd-h"><h2>${r}</h2><span class="wd-st${open ? ' on' : ''}">${open ? '지금 거래 중' : '마감'}</span></div>${xs.map(irow).join('')}${r === '미국' && vix ? mrow(vix) : ''}</section>`; }).join('');
  // G-301 (한서님 10/26 새 구조): each index once — 한국·미국 cards, the other regions folded under them; no color grid
  // (it repeated the region cards' numbers).
  const regionCard = (r: WorldRegion) => { const xs = m.indices.filter((x) => x.region === r); if (!xs.length) return ''; const open = xs.some((x) => x.open);
    return `<section class="card wd-card"><div class="wd-h"><h2>${r}</h2><span class="wd-st${open ? ' on' : ''}">${open ? '지금 거래 중' : '마감'}</span></div>${xs.map(irow).join('')}${r === '미국' && vix ? mrow(vix) : ''}</section>`; };
  const restRegions: WorldRegion[] = ['아시아', '유럽', '남미'];
  const rest = restRegions.map(regionCard).join('');
  const stocksOld = `<div class="mk-sec mk-ix" id="mk-stocks">${regionCard('한국')}${regionCard('미국')}${rest ? `<details class="card wd-card mk-more"><summary><b>아시아 · 유럽 · 남미</b><span class="muted small">지수 ${m.indices.filter((x) => restRegions.includes(x.region)).length}개 ›</span></summary><div class="mk-more-in">${rest}</div></details>` : ''}</div>`;
  void regionCards; void heat; void up; void down;
  void ixRows;
  const market = [
    stocksOld,
    // G-301: 환율 first, with the 원/달러 × 미국 10년 chart folded inside it; then one 금리 card (기준금리 bars + 10년물).
    sec('fx', '환율', '원화는 하나은행 고시', of('fx').map(mrow), '환율', 4).replace(/<\/section>$/, dualFig ? `<details class="mk-dual"><summary>금리와 같이 보기 ›</summary>${dualFig}</details></section>` : '</section>'),
    policy.length
      ? `<section class="card wd-card mk-sec" id="mk-rates"><div class="wd-h"><h2>금리</h2><span class="muted small">기준금리 · 10년물</span></div><div class="wd-bars">${policy.map((x) => `<div><span>${esc(x.name)}</span><i><i style="width:${((x.value / maxRate) * 100).toFixed(0)}%"></i></i><b>${fmt(x.value, 2)}%</b></div>`).join('')}</div><h3 class="mk-h3">10년 국채</h3>${contentMore([...rateFirst.map((k) => rates0.find((x) => x.key === k)).filter((x): x is WorldMacroQuote => !!x && x.group === 'bond'), ...rates0.filter((x) => x.group === 'bond' && !rateFirst.includes(x.key))].map(mrow), '금리', (h) => h, 4)}</section>`
      : sec('rates', '금리', '기준금리 · 10년 국채', rateRows, '금리', 4),
    sec('commod', '원자재', '선물 · 달러, 운임', [...of('energy', 'metals'), ...of('ship')].map(mrow), '원자재', 5),
  ].join('') + `<p class="fine wd-fine">장이 열린 곳은 15분 안팎 늦은 값이에요. 선은 최근 30거래일 종가예요. 줄을 누르면 크게 볼 수 있어요.</p>`;
  // 요약's four numbers: one per kind, each named with its kind and opening its own section in 시장.
  const tile = (kind: string, sec: string, name: string, value: string, move: string, t: string) => `<button type="button" class="mk-tile" data-wd-go="market" data-mk="${sec}"><small>${esc(kind)} · ${esc(name)}</small><b>${esc(value)}</b><span class="${t}">${esc(move)}</span></button>`;
  const kx = ix('KOSPI') ?? ix('.INX'), k10 = q('US10Y'), kfx = q('USDKRW'), koil = q('WTI');
  const key4 = [
    kx ? tile('증시', 'stocks', kx.name, fmt(kx.value, 2), pct(kx.changePct), tone(kx.changePct)) : '',
    k10 ? tile('금리', 'rates', '미국 10년', valueText(k10), moveText(k10), moveTone(k10)) : '',
    kfx ? tile('환율', 'fx', kfx.name, valueText(kfx), moveText(kfx), moveTone(kfx)) : '',
    koil ? tile('원자재', 'commod', 'WTI', valueText(koil), moveText(koil), moveTone(koil)) : '',
  ].join('');

  return { sum, stocks, rates, commod, news, key6, market, key4, sentence: worldSentence(m), asof: kstHm(m.generatedAt) };
}

/**
 * G-277: world.html and issues.html moved into home (index.html). Old links land on the same tab there.
 * `tab` is the default tab; a world.html#rates link keeps its tab.
 */
export function movedToHome(tab: string): string {
  const t = JSON.stringify(tab);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GNOMON | 오늘</title><meta http-equiv="refresh" content="0;url=index.html#${esc(tab)}"><script>location.replace('index.html#' + (/^#(sum|com|market|stocks|rates|commod|fx|news)$/.test(location.hash) ? location.hash.slice(1) : ${t}));</script></head><body><p><a href="index.html#${esc(tab)}">홈으로 옮겼어요. 여기를 눌러 주세요.</a></p></body></html>`;
}

export function renderWorldPage(p: WorldPage | null): string {
  if (!p || (!p.markets.indices.length && !p.markets.macro.length)) {
    return shell('', '세계 | GNOMON', `${WORLD_CSS}<section class="card wd-card"><p class="muted">세계 시장 자료를 아직 받지 못했어요. 다음 업데이트 때 다시 채워져요.</p></section>`, { active: 'home', head: { title: '세계' } });
  }
  const m = p.markets, { sum, stocks, rates, commod, news } = worldPanels(p);
  const tabs = [['sum', '요약'], ['stocks', '증시'], ['rates', '금리·환율'], ['commod', '원자재'], ['news', '뉴스']] as const;
  const nav = `<nav class="mode-tabs" role="tablist" aria-label="세계 보기">${tabs.map(([k, l], i) => `<button type="button" role="tab" data-wd="${k}" aria-selected="${i === 0}">${l}</button>`).join('')}</nav>`;
  const panels = { sum, stocks, rates, commod, news } as Record<string, string>;
  const body = `${WORLD_CSS}<p class="wd-asof">${esc(kstHm(m.generatedAt))} 기준</p>${tabs.map(([k], i) => `<div class="wd-p" data-wd-p="${k}"${i ? ' hidden' : ''}>${panels[k]}</div>`).join('')}
<p class="fine wd-fine">지수·환율·금리·원자재는 네이버 증권, 지도는 Natural Earth예요. 시장 정보를 보여 줄 뿐 사고팔라는 뜻이 아니에요.</p>`;
  return shell('', '세계 | GNOMON', body, { active: 'home', head: { title: '세계', tabs: nav }, scripts: WORLD_JS });
}

function heatBg(v: number | null): string {
  if (v == null) return 'background:var(--soft)';
  const a = Math.min(0.85, 0.12 + (Math.abs(v) / 3) * 0.73);
  return `background:${v >= 0 ? `rgba(240,68,82,${a.toFixed(2)})` : `rgba(49,130,246,${a.toFixed(2)})`}${a > 0.5 ? ';color:#fff' : ''}`;
}

export const WORLD_CSS = `<style>${KIT_WORLD_CSS}
.wd-p{max-width:820px;margin:0 auto;padding:0 16px;display:flex;flex-direction:column;gap:12px}.wd-p[hidden],.wd-is[hidden]{display:none}.wd-asof{max-width:820px;margin:-6px auto 6px;padding:0 20px;font-size:15px;color:var(--muted)}
.wd-card{padding:16px 18px;margin:0}.wd-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:8px}.wd-h h2{margin:0;font-size:18.5px}.wd-out{margin:6px 4px -2px}
.wd-link{border:0;background:none;padding:6px 0;min-height:32px;font:inherit;font-size:15.5px;font-weight:600;color:var(--muted);cursor:pointer}a.wd-link{text-decoration:none;display:inline-flex;align-items:center}
.wd-hero p{margin:6px 0;font-size:21px;line-height:1.45;font-weight:500;letter-spacing:-.01em}.wd-hero small{font-size:15px;color:var(--muted)}
.wd-bands{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px}.wd-band{display:flex;flex-direction:column;gap:1px;padding:9px 10px;border-radius:14px;background:var(--soft)}.wd-band.on{box-shadow:inset 0 0 0 1.5px var(--fg)}.wd-band small{font-size:15px;color:var(--muted)}.wd-band b{font-size:17.5px;font-variant-numeric:tabular-nums}
.wd-stats{grid-template-columns:repeat(2,minmax(0,1fr));margin:0}@media(min-width:700px){.wd-stats{grid-template-columns:repeat(3,minmax(0,1fr))}}
.wd-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto 70px;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}.wd-row:first-of-type{border-top:0}
.wd-n{display:flex;flex-direction:column;min-width:0}.wd-n b{font-size:17px;font-weight:600;line-height:1.3;word-break:keep-all}.wd-n small{font-size:15px;color:var(--muted)}
.wd-v{font-size:17px;font-variant-numeric:tabular-nums}.wd-c{font-size:17px;text-align:right;font-variant-numeric:tabular-nums}.wd-row:not(:has(.wd-sp)){grid-template-columns:minmax(0,1fr) auto 70px}
.wd-sp{width:48px;height:22px}.wd-sp path{fill:none;stroke:var(--muted);stroke-width:1.6;vector-effect:non-scaling-stroke}.wd-sp.up path{stroke:#f04452}.wd-sp.down path{stroke:#3182f6}
.wd-st{font-size:15px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--soft);color:var(--fg2)}.wd-st.on{background:var(--fg);color:var(--surface-solid)}
.wd-heat{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.wd-heat span{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:48px;border-radius:12px;color:var(--fg)}.wd-heat small{font-size:15px;font-weight:700}.wd-heat b{font-size:15.5px;font-variant-numeric:tabular-nums}
@media(min-width:620px){.wd-heat{grid-template-columns:repeat(7,minmax(0,1fr))}}
.wd-bars{display:grid;gap:9px}.wd-bars div{display:grid;grid-template-columns:92px minmax(0,1fr) 52px;gap:10px;align-items:center;font-size:16px}.wd-bars span{font-weight:600}.wd-bars>div>i{height:8px;border-radius:4px;background:var(--soft)}.wd-bars>div>i>i{display:block;height:8px;border-radius:4px;background:var(--fg);opacity:.75}.wd-bars b{text-align:right;font-variant-numeric:tabular-nums}
.wd-iss{list-style:none;margin:0;padding:0}.wd-is{display:grid;grid-template-columns:22px minmax(0,1fr);gap:10px;padding:13px 0;border-top:1px solid var(--line)}.wd-is:first-child{border-top:0;padding-top:4px}
.wd-rk{font-size:19px;font-weight:300;font-variant-numeric:tabular-nums}.wd-ih{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.wd-ih a{font-size:17px;font-weight:600;line-height:1.45;color:inherit;text-decoration:none}.wd-ih a:hover{text-decoration:underline}
.wd-new,.wd-mv{flex:none;font-size:15px;font-weight:800}.wd-new{color:var(--fg)}.wd-im{display:block;font-size:15px;color:var(--muted);margin:3px 0 6px}
.wd-chips{display:flex;flex-wrap:wrap;gap:6px}.wd-chip{display:inline-flex;gap:4px;align-items:center;font-size:15px;font-weight:600;padding:4px 9px;border-radius:999px;background:var(--soft);color:var(--fg2)}.wd-chip.tag{background:none;box-shadow:inset 0 0 0 1px var(--line-strong)}
.wd-more summary{cursor:pointer;font-size:15.5px;color:var(--muted);min-height:30px;display:inline-flex;align-items:center;margin-top:4px}.wd-more ul{margin:2px 0;padding-left:16px}.wd-more li{font-size:15.5px;line-height:1.5;margin:3px 0}.wd-more a{color:inherit}.wd-more small{color:var(--muted)}
.wd-filter{display:flex;gap:6px;flex-wrap:wrap}.wd-filter button{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);font:inherit;font-size:15.5px;font-weight:600;color:var(--fg2);cursor:pointer}.wd-filter button[aria-pressed=true]{background:var(--fg);border-color:var(--fg);color:var(--surface-solid)}
.wd-fine{margin:0 4px}.mk-ix{display:flex;flex-direction:column;gap:12px}.mk-more>summary{display:flex;justify-content:space-between;align-items:baseline;gap:8px;cursor:pointer;list-style:none;font-size:18.5px}.mk-more>summary::-webkit-details-marker{display:none}.mk-more-in{display:flex;flex-direction:column;gap:12px;margin-top:10px}.mk-more-in>.card{padding:0;box-shadow:none;background:none;border:0}.mk-dual{margin-top:6px;border-top:1px solid var(--line);padding-top:8px}.mk-dual>summary{cursor:pointer;font-size:15.5px;font-weight:600;color:var(--muted);min-height:36px;display:flex;align-items:center;list-style:none}.mk-dual>summary::-webkit-details-marker{display:none}.mk-h3{margin:14px 0 2px;font-size:16px;color:var(--fg2)}.up{color:var(--up)}.down{color:var(--down)}
${CONTENT_MORE_CSS}.mk-sec .content-more>summary{display:flex;justify-content:center;align-items:center;min-height:44px;border-top:1px solid var(--line);font-size:15.5px;font-weight:600;color:var(--muted);list-style:none}.mk-sec .content-more>summary::-webkit-details-marker{display:none}.mk-sec{scroll-margin-top:16px}
.mk-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.mk-tile{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:14px;border:0;border-radius:18px;background:var(--surface);box-shadow:var(--shadow-sm,0 1px 2px rgba(0,0,0,.04));font:inherit;color:var(--fg);text-align:left;cursor:pointer;min-height:44px}.mk-tile small{font-size:15px;font-weight:600;color:var(--muted)}.mk-tile b{font-size:21px;font-weight:700;font-variant-numeric:tabular-nums}.mk-tile span{font-size:15.5px;font-weight:700;font-variant-numeric:tabular-nums}
</style>`;

export const WORLD_JS = `<script>
(function () {
  var tabs = [].slice.call(document.querySelectorAll('[data-wd]'));
  var cur = 'sum';
  var pick = function (k, push) {
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-wd') === k)); });
    var lab = '';
    document.querySelectorAll('[data-wd-p]').forEach(function (p) { p.hidden = p.getAttribute('data-wd-p') !== k; if (!p.hidden) lab = p.getAttribute('data-wd-label') || ''; });
    // G-301: with no part buttons (home), the title names the open page and the phone's back returns to 오늘.
    if (!tabs.length) { var h1 = document.querySelector('main .pg-title h1'); if (h1) h1.hidden = k !== 'sum'; }
    if (push) { var url = k === 'sum' ? location.pathname : '#' + k; if (!tabs.length && k !== 'sum' && cur === 'sum') history.pushState({ wd: k }, '', url); else history.replaceState(null, '', url); }
    cur = k;
  };
  window.addEventListener('popstate', function () { var h = location.hash.slice(1); if (document.querySelector('[data-wd-p="' + (h || 'sum') + '"]')) { pick(h || 'sum', false); window.scrollTo(0, 0); } });
  window.addEventListener('hashchange', function () { if (!location.hash || location.hash === '#top') { pick('sum', false); window.scrollTo(0, 0); } });
  // G-277 (한서님 10/21): switching a tab goes back to the top of the page.
  tabs.forEach(function (t) { t.addEventListener('click', function () { pick(t.getAttribute('data-wd'), true); window.scrollTo({ top: 0, behavior: 'smooth' }); }); });
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-wd-go]');
    if (g && g.getAttribute('data-wd-go') === 'sum' && history.state && history.state.wd) { history.back(); return; }
    if (g) { pick(g.getAttribute('data-wd-go'), true); var sec = g.getAttribute('data-mk') && document.getElementById('mk-' + g.getAttribute('data-mk')); if (sec) sec.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0); return; }
    // G-287: 한국 · 세계 on home's 이슈 switch which list shows.
    var ig = e.target.closest && e.target.closest('[data-iss-go]');
    if (ig) { var w = ig.getAttribute('data-iss-go'); document.querySelectorAll('[data-iss-go]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === ig)); }); document.querySelectorAll('[data-iss]').forEach(function (d) { d.hidden = d.getAttribute('data-iss') !== w; }); return; }
    var f = e.target.closest && e.target.closest('[data-wd-tag]'); if (!f) return;
    var tag = f.getAttribute('data-wd-tag'), scope = f.closest('[data-iss]') || document.querySelector('[data-wd-p="news"]') || document;
    scope.querySelectorAll('[data-wd-tag]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === f)); });
    scope.querySelectorAll('[data-tag]').forEach(function (li) { li.hidden = !!tag && li.getAttribute('data-tag') !== tag; });
  });
  // G-281: the old 증시·금리·환율·원자재 links land on their section in 시장.
  var h = location.hash.slice(1), old = { stocks: 'stocks', rates: 'rates', commod: 'commod', fx: 'fx' };
  if (old[h] && document.querySelector('[data-wd-p="market"]')) { pick('market', false); var s0 = document.getElementById('mk-' + old[h]); if (s0) s0.scrollIntoView({ block: 'start' }); }
  else if (['market', 'stocks', 'rates', 'commod', 'news'].indexOf(h) >= 0 && document.querySelector('[data-wd-p="' + h + '"]')) pick(h, false);
  else if (h === 'com' && !document.querySelector('[data-wd-p="com"]')) location.replace('reports.html');
})();
</script>`;
