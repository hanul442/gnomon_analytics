// G-309: SNS cards (Instagram story, X image, weekly carousel, weekly blog post) built from the day's market
// report and the committee members' scored calls. Same content for everyone, one direction, no returns of ours:
// every card shows what the committee said and whether it was right, misses included. See docs/DESIGN.md G-309.

import { ANALYST_HORIZON, analystName, hitOf, type AnalystCall } from '../analysis/analysts.js';

export const PROMO_SITE = 'https://hanul442.github.io/gnomon_analytics/';
export const PROMO_NOTE = '투자 권유가 아닌 교육용 자료예요';

/** One committee member's call whose 20 sessions ended on `outcomeDate`. */
export interface PromoCall {
  symbol: string; name: string; analyst: string; member: string;
  stance: AnalystCall['stance']; baseDate: string; outcomeDate: string;
  hit: boolean; movePct: number; brokeOn: string | null;
}
export interface PromoIndex { name: string; pct: number }
export interface PromoBreadth { group: string; total: number; up: number; flat: number; down: number }
export interface PromoDay {
  date: string; weekday: string; summary: string;
  indices: PromoIndex[]; breadth: PromoBreadth | null;
  /** Calls scored on this date. */
  scored: PromoCall[];
  /** Calls scored from Monday of this week up to this date. */
  week: PromoCall[];
  weekFrom: string;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
export const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
export const mondayOf = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`); const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back); return d.toISOString().slice(0, 10);
};
const md = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`;

/**
 * Every call whose 20th session after its base date is a known bar, scored the way the scorecard scores it
 * (hitOf). `bars` are one symbol's daily closes.
 */
export function scoreCalls(symbol: string, name: string, calls: readonly AnalystCall[], bars: readonly { date: string; close: number }[]): PromoCall[] {
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : 1));
  const idx = new Map(sorted.map((b, i) => [b.date, i]));
  const out: PromoCall[] = [];
  for (const c of calls) {
    const i = idx.get(c.baseDate);
    if (i === undefined) continue;
    const end = sorted[i + ANALYST_HORIZON];
    if (!end) continue;
    const window = sorted.slice(i + 1, i + 1 + ANALYST_HORIZON);
    const crossed = c.invalidation == null ? undefined : window.find((b) => (c.stance === 'BULLISH' ? b.close < c.invalidation! : c.stance === 'BEARISH' ? b.close > c.invalidation! : false));
    out.push({
      symbol, name, analyst: c.analyst, member: analystName(c.analyst), stance: c.stance, baseDate: c.baseDate, outcomeDate: end.date,
      hit: hitOf(c, end.close), movePct: (end.close / c.baseClose - 1) * 100, brokeOn: crossed?.date ?? null,
    });
  }
  return out;
}

/** The market report fields the cards use (reports/market/daily-*.json). */
export interface MarketLike {
  date: string;
  groups?: { id: string; name: string; temperature?: { counted?: number; buckets?: Record<string, number> } }[];
  world?: { indices?: { key: string; name: string; changePct: number | null }[] };
  ai?: { summary?: { text?: string } };
}

const INDEX_KEYS: [string, string][] = [['KOSPI', '코스피'], ['KOSDAQ', '코스닥'], ['.INX', 'S&P 500'], ['.IXIC', '나스닥'], ['.SOX', '미국 반도체'], ['.N225', '니케이 225']];

export function promoDay(m: MarketLike, calls: readonly PromoCall[]): PromoDay {
  const byKey = new Map((m.world?.indices ?? []).map((x) => [x.key, x]));
  const indices = INDEX_KEYS.flatMap(([k, name]) => { const v = byKey.get(k)?.changePct; return typeof v === 'number' && Number.isFinite(v) ? [{ name, pct: v }] : []; });
  const g = m.groups?.find((x) => x.id === 'M1');
  const b = g?.temperature?.buckets;
  const breadth = b ? {
    group: g!.name,
    up: (b.STRONG_BULLISH ?? 0) + (b.BULLISH ?? 0) + (b.SLIGHTLY_BULLISH ?? 0),
    flat: b.NEUTRAL ?? 0,
    down: (b.SLIGHTLY_BEARISH ?? 0) + (b.BEARISH ?? 0) + (b.STRONG_BEARISH ?? 0),
    total: 0,
  } : null;
  if (breadth) breadth.total = breadth.up + breadth.flat + breadth.down;
  const from = mondayOf(m.date);
  const sentences = (m.ai?.summary?.text ?? '').split(/(?<=[.!?요])\s+/).filter(Boolean);
  let summary = '';
  for (const s of sentences) { if ((summary + s).length > 150) break; summary = summary ? `${summary} ${s}` : s; }
  if (!summary && sentences[0]) summary = sentences[0].slice(0, 148) + '…';
  const order = (a: PromoCall, b: PromoCall) => (a.outcomeDate < b.outcomeDate ? 1 : a.outcomeDate > b.outcomeDate ? -1 : a.name.localeCompare(b.name, 'ko'));
  return {
    date: m.date, weekday: weekdayOf(m.date), summary, indices, breadth: breadth && breadth.total ? breadth : null,
    scored: calls.filter((c) => c.outcomeDate === m.date).sort(order),
    week: calls.filter((c) => c.outcomeDate >= from && c.outcomeDate <= m.date).sort(order),
    weekFrom: from,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const sgn = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;
const UP = '#F04452', DOWN = '#0582CA';
const tone = (v: number) => (v > 0 ? UP : v < 0 ? DOWN : '#555555');
export const stanceWord = (s: PromoCall['stance']) => (s === 'BULLISH' ? '오른다고 봤어요' : s === 'BEARISH' ? '내린다고 봤어요' : '크게 안 움직인다고 봤어요');
const count = (xs: readonly PromoCall[]) => ({ ok: xs.filter((x) => x.hit).length, bad: xs.filter((x) => !x.hit).length });

/** Page wrapper: one fixed-size card, Pretendard from `fontDir` (file URL or relative path), light glass look. */
export function page(w: number, h: number, body: string, fontDir: string, bg = '#EEEEEB'): string {
  const face = (wt: number, f: string) => `@font-face{font-family:P;font-weight:${wt};src:url('${fontDir}/Pretendard-${f}.woff2') format('woff2')}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${face(400, 'Regular')}${face(500, 'Medium')}${face(700, 'Bold')}${face(800, 'ExtraBold')}
html,body{margin:0;padding:0}body{width:${w}px;height:${h}px;overflow:hidden;background:${bg};font-family:P,sans-serif;color:#111;word-break:keep-all}
.card{width:${w}px;height:${h}px;box-sizing:border-box;display:flex;flex-direction:column}
.glass{background:rgba(255,255,255,.74);border:2px solid #fff;box-shadow:0 20px 60px rgba(0,0,0,.06)}
.ink{background:#111;color:#fff}.row{display:flex;justify-content:space-between;align-items:center}
.brand{font-weight:800;letter-spacing:.16em}.grey{color:#555}.lgrey{color:#BDBDBD}</style></head><body>${body}</body></html>`;
}

function indexBars(xs: readonly PromoIndex[], size: { name: number; bar: number; font: number; nameW: number; valW: number }): string {
  const max = Math.max(2, ...xs.map((x) => Math.abs(x.pct))) * 1.05;
  return xs.map((x) => {
    const w = `${((Math.abs(x.pct) / max) * 100).toFixed(1)}%`;
    return `<div style="display:grid;grid-template-columns:${size.nameW}px 1fr 1fr ${size.valW}px;align-items:center">
<div style="font-size:${size.name}px;font-weight:500">${esc(x.name)}</div>
<div style="height:${size.bar}px;display:flex;justify-content:flex-end;border-right:3px solid #111">${x.pct < 0 ? `<div style="height:100%;width:${w};background:${DOWN};border-radius:10px 0 0 10px"></div>` : ''}</div>
<div style="height:${size.bar}px;display:flex">${x.pct > 0 ? `<div style="height:100%;width:${w};background:${UP};border-radius:0 10px 10px 0"></div>` : ''}</div>
<div style="font-size:${size.font}px;font-weight:800;text-align:right;color:${tone(x.pct)}">${sgn(x.pct)}</div></div>`;
  }).join('');
}

function breadthBar(b: PromoBreadth, s: { h: number; font: number; label: number }): string {
  const p = (n: number) => `${((n / b.total) * 100).toFixed(1)}%`;
  const major = b.down >= b.up ? `하락 ${Math.round((b.down / b.total) * 100)}%` : `상승 ${Math.round((b.up / b.total) * 100)}%`;
  return `<div class="row" style="font-size:${s.label}px"><div class="grey" style="font-weight:700">${esc(b.group)} ${b.total.toLocaleString('ko-KR')}종목 온도</div><div style="font-weight:800">${major}</div></div>
<div style="display:flex;height:${s.h}px;border-radius:14px;overflow:hidden"><div style="width:${p(b.up)};background:${UP}"></div><div style="width:${p(b.flat)};background:#C9C9C6"></div><div style="width:${p(b.down)};background:${DOWN}"></div></div>
<div class="row" style="font-size:${s.font}px;color:#444"><div>상승 ${b.up}</div><div>보합 ${b.flat}</div><div>하락 ${b.down}</div></div>`;
}

/** ✓/✗ squares, one per scored call (at most `max`, the rest as "+n"). Light squares on dark ground. */
function marks(xs: readonly PromoCall[], cols: number, max: number, h: number, font: number): string {
  const room = xs.length > max ? max - 1 : max;
  const shown = [...xs].sort((a, b) => Number(b.hit) - Number(a.hit)).slice(0, room);
  const cells = shown.map((x) => `<div style="height:${h}px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:${font}px;font-weight:800;border:3px solid #fff;${x.hit ? 'background:#fff;color:#111' : 'color:#fff'}">${x.hit ? '✓' : '✗'}</div>`).join('');
  const more = xs.length > max ? `<div style="height:${h}px;display:flex;align-items:center;justify-content:center;font-size:${font * 0.8}px;color:#BDBDBD">+${xs.length - room}</div>` : '';
  return `<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:12px">${cells}${more}</div>`;
}

function callLine(x: PromoCall, font: number): string {
  return `<div class="row" style="gap:16px;font-size:${font}px"><div style="min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis"><b>${esc(x.name)}</b> <span class="lgrey">· ${esc(x.member)} · ${stanceWord(x.stance)}</span></div><div style="font-weight:800;flex:none;${x.hit ? '' : 'color:#9E9E9E'}">${x.hit ? '✓ 맞음' : '✗ 틀림'}</div></div>`;
}

function scoreBlock(d: PromoDay, big: boolean): string {
  const s = big ? { title: 28, n: 80, word: 32, cols: 12, max: 24, h: 52, mark: 26, line: 27 } : { title: 22, n: 60, word: 24, cols: 10, max: 10, h: 40, mark: 20, line: 20 };
  if (!d.scored.length) {
    const w = count(d.week);
    return `<div style="font-size:${s.title}px;font-weight:700" class="lgrey">오늘 채점된 위원 판단</div>
<div style="font-size:${s.word + 4}px;line-height:1.5">오늘은 20거래일이 끝난 판단이 없어요.${d.week.length ? ` 이번 주는 맞음 ${w.ok} · 틀림 ${w.bad}이에요.` : ''}</div>`;
  }
  const c = count(d.scored);
  return `<div class="row"><div style="font-size:${s.title}px;font-weight:700" class="lgrey">오늘 채점된 위원 판단</div><div style="font-size:${s.title}px" class="lgrey">20거래일 전 판단</div></div>
<div style="display:flex;gap:48px;align-items:baseline"><div style="font-size:${s.n}px;font-weight:800">${c.ok} <span style="font-size:${s.word}px;font-weight:500">맞음</span></div><div style="font-size:${s.n}px;font-weight:800;color:#9E9E9E">${c.bad} <span style="font-size:${s.word}px;font-weight:500;color:#BDBDBD">틀림</span></div></div>
${marks(d.scored, s.cols, s.max, s.h, s.mark)}
${big ? `<div style="display:flex;flex-direction:column;gap:14px;margin-top:8px">${pickLines(d.scored, 3).map((x) => callLine(x, s.line)).join('')}</div>` : ''}`;
}

/** A few calls to name: misses first (they are the point), then hits, at most one per stock. */
export function pickLines(xs: readonly PromoCall[], n: number): PromoCall[] {
  const seen = new Set<string>(); const out: PromoCall[] = [];
  for (const x of [...xs.filter((y) => !y.hit), ...xs.filter((y) => y.hit)]) { if (seen.has(x.symbol)) continue; seen.add(x.symbol); out.push(x); if (out.length >= n) break; }
  return out;
}

export function storyHtml(d: PromoDay, fontDir: string, site = PROMO_SITE): string {
  return page(1080, 1920, `<div class="card" style="padding:88px 80px 64px;gap:26px">
<div class="row"><div class="brand" style="font-size:40px">GNOMON</div><div class="grey" style="font-size:34px;font-weight:500">${md(d.date)} ${d.weekday} · 장 마감</div></div>
<div style="font-size:58px;font-weight:800;line-height:1.2">오늘의<br>AI 위원회 리포트</div>
${d.summary ? `<div style="font-size:31px;line-height:1.5;font-weight:500;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(d.summary)}</div>` : ''}
${d.indices.length ? `<div class="glass" style="border-radius:44px;padding:36px 44px;display:flex;flex-direction:column;gap:14px"><div class="grey" style="font-size:28px;font-weight:700">세계 지수 등락</div>${indexBars(d.indices, { name: 28, bar: 28, font: 28, nameW: 210, valW: 140 })}</div>` : ''}
${d.breadth ? `<div class="glass" style="border-radius:44px;padding:36px 44px;display:flex;flex-direction:column;gap:16px">${breadthBar(d.breadth, { h: 44, font: 26, label: 28 })}</div>` : ''}
<div class="ink" style="border-radius:44px;padding:40px 44px;display:flex;flex-direction:column;gap:18px">${scoreBlock(d, true)}</div>
<div style="flex:1"></div>
<div class="glass row" style="border-radius:999px;padding:34px 48px;gap:24px"><div style="font-size:34px;font-weight:700;white-space:nowrap">전체 리포트는 사이트에서</div><div class="grey" style="font-size:26px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(site.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</div></div>
<div style="font-size:26px;color:#6B6B6B;text-align:center">${PROMO_NOTE} · AI 위원회 판단은 틀릴 수 있어요</div></div>`, fontDir);
}

export function xHtml(d: PromoDay, fontDir: string): string {
  const head = d.indices.slice(0, 2);
  return page(1200, 675, `<div class="card" style="padding:56px 64px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
<div style="display:flex;flex-direction:column;gap:20px;min-width:0"><div class="brand" style="font-size:26px">GNOMON</div><div class="grey" style="font-size:24px">${md(d.date)} ${d.weekday} · 오늘의 AI 위원회</div>
<div style="font-size:26px;line-height:1.6;color:#222;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;overflow:hidden">${esc(d.summary || '오늘 시장 요약은 사이트에서 볼 수 있어요.')}</div><div style="flex:1"></div>
<div style="font-size:21px;color:#6B6B6B">전체 리포트는 그노몬 사이트에서 · 교육용 자료</div></div>
<div style="display:flex;flex-direction:column;gap:18px;min-width:0">
${d.breadth || head.length ? `<div class="glass" style="border-radius:30px;padding:26px;display:flex;flex-direction:column;gap:12px">${d.breadth ? breadthBar(d.breadth, { h: 34, font: 20, label: 22 }) : ''}${head.length ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:4px">${head.map((x) => `<div class="row" style="font-size:22px"><div class="grey">${esc(x.name)}</div><div style="font-weight:800;color:${tone(x.pct)}">${sgn(x.pct)}</div></div>`).join('')}</div>` : ''}</div>` : ''}
<div class="ink" style="flex:1;border-radius:30px;padding:30px;display:flex;flex-direction:column;gap:14px;justify-content:center">${scoreBlock(d, false)}</div></div></div>`, fontDir);
}

export function coverHtml(d: PromoDay, fontDir: string): string {
  const c = count(d.week);
  return page(1080, 1350, `<div class="card ink" style="padding:96px 88px;gap:30px">
<div class="row"><div class="brand" style="font-size:36px">GNOMON</div><div class="lgrey" style="font-size:30px">주간 리포트 · ${md(d.weekFrom)}–${md(d.date)}</div></div>
<div style="flex:1"></div>
<div class="lgrey" style="font-size:40px;font-weight:500">이번 주 AI 위원회 성적표</div>
<div style="font-size:88px;font-weight:800;line-height:1.15">맞힌 것도<br>틀린 것도<br>다 공개해요</div>
<div style="display:flex;gap:20px;margin-top:16px">${[`채점 ${d.week.length}건`, `맞음 ${c.ok} · 틀림 ${c.bad}`].map((t) => `<div style="padding:20px 36px;border-radius:999px;background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.2);font-size:34px;font-weight:700">${t}</div>`).join('')}</div>
${d.week.length ? `${marks(d.week, 12, 36, 52, 24)}<div class="lgrey" style="font-size:26px">칸 하나 = 위원 판단 1건 · 흰 칸 맞음 · 빈 칸 틀림</div>` : '<div class="lgrey" style="font-size:30px">이번 주는 20거래일이 끝난 판단이 없었어요.</div>'}
<div style="flex:1"></div><div class="row lgrey" style="font-size:30px"><div>옆으로 넘겨서 보기</div><div>1 / 2</div></div></div>`, fontDir, '#111');
}

/** The week's biggest miss: the miss whose stock moved furthest against the call. */
export function worstMiss(xs: readonly PromoCall[]): PromoCall | null {
  const misses = xs.filter((x) => !x.hit && x.stance !== 'NEUTRAL');
  const against = (x: PromoCall) => (x.stance === 'BULLISH' ? -x.movePct : x.movePct);
  return misses.sort((a, b) => against(b) - against(a))[0] ?? xs.find((x) => !x.hit) ?? null;
}

export function missReason(x: PromoCall): string {
  const move = `20거래일 동안 ${sgn(x.movePct, 1)} 움직였어요`;
  if (x.stance === 'NEUTRAL') return `크게 안 움직인다고 봤는데 ${move}.`;
  return x.brokeOn ? `위원이 미리 적어 둔 '틀림 조건' 가격을 ${md(x.brokeOn)}에 넘었고, ${move}.` : `판단과 반대로 ${move}.`;
}

export function missHtml(d: PromoDay, fontDir: string): string {
  const x = worstMiss(d.week);
  const body = x ? `<div class="glass" style="border-radius:48px;padding:56px;display:flex;flex-direction:column;gap:26px">
<div class="row"><div style="font-size:34px;font-weight:700">${md(x.baseDate)} ${weekdayOf(x.baseDate)} · ${esc(x.member)}</div><div style="padding:10px 28px;border-radius:999px;background:#111;color:#fff;font-size:30px;font-weight:700">✗ 틀림</div></div>
<div style="font-size:44px;line-height:1.45;font-weight:700">${esc(x.name)}: ${stanceWord(x.stance)}</div>
<div style="height:2px;background:#DDDDDA"></div><div class="grey" style="font-size:30px;font-weight:700">어떻게 틀렸나</div>
<div style="font-size:36px;line-height:1.55">${esc(missReason(x))}</div></div>` : `<div class="glass" style="border-radius:48px;padding:56px;font-size:38px;line-height:1.5">이번 주에 채점된 판단 중 틀린 것은 없었어요. 다음 주에도 그대로 공개해요.</div>`;
  return page(1080, 1350, `<div class="card" style="padding:96px 88px;gap:36px">
<div class="row"><div class="brand" style="font-size:36px">GNOMON</div><div class="grey" style="font-size:30px">2 / 2</div></div>
<div style="font-size:72px;font-weight:800;line-height:1.2">이번 주에<br>가장 크게 틀린 판단</div>${body}<div style="flex:1"></div>
<div style="font-size:32px;line-height:1.5;color:#444">판단은 미리 기록되고 나중에 고칠 수 없어요. 그래서 틀린 것도 이렇게 남아요.</div>
<div style="font-size:24px;color:#6B6B6B">${PROMO_NOTE}</div></div>`, fontDir);
}

/** X counts Hangul as 2; keep the post under 280 weighted characters by trimming the summary. */
export const xWeight = (s: string) => [...s].reduce((t, ch) => t + (/[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? 2 : 1), 0);

export function xCaption(d: PromoDay, site = PROMO_SITE): string {
  const c = count(d.scored);
  const score = d.scored.length ? `오늘 채점된 위원 판단: 맞음 ${c.ok} · 틀림 ${c.bad}` : '오늘은 채점할 판단이 없었어요';
  const tail = `${score}\n틀린 판단도 그대로 남겨 둬요.\n\n${site}?utm_source=x\n(${PROMO_NOTE})`;
  let lead = d.summary;
  const fit = (l: string) => `${md(d.date)} 그노몬 AI 위원회\n${l}\n\n${tail}`;
  // URLs count as 23 on X.
  const weight = (s: string) => xWeight(s.replace(/https?:\/\/\S+/g, 'x'.repeat(23)));
  while (lead && weight(fit(lead)) > 280) lead = lead.slice(0, -2).replace(/\s+\S*$/, '') + '…';
  return lead && lead !== '…' ? fit(lead) : `${md(d.date)} 그노몬 AI 위원회\n\n${tail}`;
}

export function instaCaption(d: PromoDay, site = PROMO_SITE): string {
  const c = count(d.scored);
  const lines = pickLines(d.scored, 5).map((x) => `${x.hit ? '✓' : '✗'} ${x.name} · ${x.member} · ${stanceWord(x.stance)}`);
  return [`${md(d.date)} ${d.weekday} 오늘의 AI 위원회 리포트`, '', d.summary, '',
    d.scored.length ? `오늘 채점된 위원 판단 (20거래일 전 판단): 맞음 ${c.ok} · 틀림 ${c.bad}` : '오늘은 20거래일이 끝난 판단이 없었어요.',
    ...lines, '', '맞힌 것도 틀린 것도 사이트에 그대로 남겨 둬요. 전체 리포트는 프로필 링크에서.', '', `(${PROMO_NOTE}. 투자 판단과 책임은 본인에게 있어요.)`, '', '#그노몬 #AI주식 #주식공부 #오늘의증시'].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

/** The weekly blog post (Naver Blog), in plain text with section heads, ready to paste. */
export function blogText(d: PromoDay, site = PROMO_SITE): string {
  const c = count(d.week), x = worstMiss(d.week);
  const byDay = new Map<string, PromoCall[]>();
  for (const k of d.week) byDay.set(k.outcomeDate, [...(byDay.get(k.outcomeDate) ?? []), k]);
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, xs]) => { const n = count(xs); return `- ${md(day)} ${weekdayOf(day)}: 맞음 ${n.ok} · 틀림 ${n.bad}`; });
  const rows = d.week.map((k) => `- ${k.hit ? '✓ 맞음' : '✗ 틀림'} · ${k.name} · ${k.member} · ${md(k.baseDate)}에 ${stanceWord(k.stance)}`);
  return [`제목: AI 위원회 주간 성적표 (${md(d.weekFrom)}–${md(d.date)}): 맞힌 것 ${c.ok}개, 틀린 것 ${c.bad}개`, '카테고리: 주간 위원회 리포트', '',
    `그노몬 AI 위원회가 20거래일 전에 남긴 판단을 이번 주에 채점했어요. 모두 ${d.week.length}건이고, 맞음 ${c.ok} · 틀림 ${c.bad}이에요. 틀린 판단도 빼지 않고 그대로 적어요.`, '',
    '[이미지 1: 주간 표지 카드]', '', '1. 이번 주 시장', d.summary || '(이번 주 시장 요약)', '', '[이미지 2: 오늘 스토리 카드의 세계 지수·종목 온도 그래프]', '',
    '2. 요일별 채점', ...(days.length ? days : ['- 이번 주는 채점된 판단이 없었어요.']), '',
    '3. 가장 크게 틀린 판단', x ? `${x.name}, ${x.member}: ${md(x.baseDate)}에 ${stanceWord(x.stance)}. ${missReason(x)}` : '이번 주에는 틀린 판단이 없었어요.', '', '[이미지 3: 틀린 판단 카드]', '',
    '4. 이번 주 채점 전체', ...(rows.length ? rows : ['- 없음']), '',
    `위원회의 전체 토론과 지난 기록은 그노몬에서 볼 수 있어요: ${site}?utm_source=naver`, '',
    `${PROMO_NOTE}. 투자 판단과 책임은 본인에게 있어요.`, '태그: #AI주식 #주식공부 #주간시황 #그노몬'].join('\n');
}

/** The index page under site/promo/: each day's cards and captions, newest first, with copy buttons. Not linked from the app. */
export function promoIndexHtml(days: readonly { date: string; files: string[]; captions: { label: string; text: string }[] }[]): string {
  const item = (d: (typeof days)[number]) => `<section><h2>${esc(d.date)} (${weekdayOf(d.date)})</h2><div class="imgs">${d.files.filter((f) => f.endsWith('.png')).map((f) => `<a href="${esc(d.date)}/${esc(f)}" download><img src="${esc(d.date)}/${esc(f)}" alt="${esc(f)}" loading="lazy"></a>`).join('')}</div>
${d.captions.map((c) => `<details><summary>${esc(c.label)}</summary><pre>${esc(c.text)}</pre><button type="button" class="copy">글 복사</button></details>`).join('')}</section>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>그노몬 SNS 카드</title>
<style>body{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#F4F4F2;color:#111}h1{font-size:20px}h2{font-size:16px;margin:24px 0 8px}.imgs{display:flex;gap:8px;overflow-x:auto}.imgs img{height:220px;border-radius:8px;border:1px solid #ddd;background:#fff}details{margin:8px 0;background:#fff;border-radius:8px;padding:8px 12px}pre{white-space:pre-wrap;font:14px/1.6 system-ui,sans-serif}button{min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #111;background:#111;color:#fff;font-size:14px}</style></head>
<body><h1>그노몬 SNS 카드</h1><p>이미지를 누르면 저장돼요. 글은 펼쳐서 복사하세요.</p>${days.map(item).join('')}
<script>document.querySelectorAll('.copy').forEach(function(b){b.onclick=function(){navigator.clipboard.writeText(b.previousElementSibling.textContent).then(function(){b.textContent='복사했어요'})}})</script></body></html>`;
}
