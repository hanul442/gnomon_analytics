// G-297 (한서님 10/24 "위원회가 메인인데 메인이 아닌 상황"): the committee as the app's lead. Every member gets a face
// (one letter in a tile), the vote is drawn as a half-circle of seats, the lone dissenters are named with the close that
// would prove them wrong, and a tap on a seat or a face opens that member in a sheet. Pure rendering from reports; the
// sheet is filled by COMMITTEE_JS from the data on the tapped seat. Shown the same to everyone (no per-user advice).

import type { DailyReport } from './dailyReport.js';
import { ANALYSTS, analystName } from '../analysis/analysts.js';
import { LOCKED_TEXT } from '../analysis/commentary.js';
import { esc } from './html.js';
import { won } from './format.js';

export type SeatStance = 'bull' | 'neutral' | 'bear' | 'abstain';
export interface Seat {
  key: string;
  /** One letter for the face. */
  ch: string;
  name: string;
  kind: 'analyst' | 'desk';
  focus: string;
  stance: SeatStance;
  confidence?: number;
  /** The close that would prove the call wrong (analysts only). */
  invalidation?: number;
  /** True when the report's close already crossed it. */
  broken?: boolean;
}

const GLYPH: Record<string, string> = { trend_momentum: '추', mean_reversion: '평', wave_structure: '파', volume_flow: '수', fundamental: '실', event_catalyst: '뉴', sector_expert: '업', MARKET: '시', TECHNICAL: '기', FLOW: '급', FUNDAMENTAL: '펀', EVENT: '공' };
const DESK: Record<string, { name: string; focus: string }> = {
  MARKET: { name: '시장 데스크', focus: '지수·금리·환율 같은 시장 전체 흐름' },
  TECHNICAL: { name: '기술 데스크', focus: '차트 지표 묶음' },
  FLOW: { name: '수급 데스크', focus: '외국인·기관 매매와 거래량' },
  FUNDAMENTAL: { name: '펀더멘털 데스크', focus: '실적과 가치' },
  EVENT: { name: '공시·뉴스 데스크', focus: '공시와 뉴스' },
};
/** The one-letter face of a member id (analyst id or desk key). */
export const faceOf = (id: string): string => GLYPH[id] ?? '·';
const ORDER: Record<SeatStance, number> = { bull: 0, neutral: 1, bear: 2, abstain: 3 };
const WORD: Record<SeatStance, string> = { bull: '강세', neutral: '중립', bear: '약세', abstain: '기권' };
const of = (s: string): SeatStance => (s === 'BULLISH' ? 'bull' : s === 'BEARISH' ? 'bear' : s === 'NEUTRAL' ? 'neutral' : 'abstain');

/** The committee of one report: analysts (with the industry seat) then desks, ordered 강세 → 중립 → 약세 → 기권. */
export function seatsOf(report: DailyReport | null | undefined): Seat[] {
  const c = report?.commentary?.status === 'OK' ? report.commentary : undefined;
  if (!c) return [];
  const close = report?.price?.close ?? null;
  const seats: Seat[] = [];
  for (const a of c.analysts ?? []) {
    const stance = of(a.stance), inv = typeof a.invalidation === 'number' && a.invalidation > 0 ? a.invalidation : undefined;
    const broken = inv !== undefined && close !== null && ((stance === 'bull' && close < inv) || (stance === 'bear' && close > inv));
    seats.push({ key: a.analyst, ch: GLYPH[a.analyst] ?? a.analyst.slice(0, 1), name: analystName(a.analyst, c.sectorExpert), kind: 'analyst', focus: (a.analyst === 'sector_expert' && c.sectorExpert?.focus) || ANALYSTS.find((x) => x.id === a.analyst)?.focus || '', stance, confidence: a.confidence, ...(inv !== undefined ? { invalidation: inv } : {}), ...(broken ? { broken } : {}) });
  }
  for (const d of c.desks ?? []) seats.push({ key: d.desk, ch: GLYPH[d.desk] ?? '·', name: DESK[d.desk]?.name ?? d.desk, kind: 'desk', focus: DESK[d.desk]?.focus ?? '', stance: of(d.stance) });
  return seats.map((s, i) => [s, i] as const).sort((a, b) => ORDER[a[0].stance] - ORDER[b[0].stance] || a[1] - b[1]).map(([s]) => s);
}

export interface Split { bull: number; neutral: number; bear: number; abstain: number; total: number; word: string }
export function splitOf(seats: readonly Seat[]): Split {
  const n = (k: SeatStance) => seats.filter((s) => s.stance === k).length;
  const bull = n('bull'), neutral = n('neutral'), bear = n('bear'), abstain = n('abstain');
  const word = !bull && !bear ? '중립이 많아요' : Math.abs(bull - bear) <= 1 ? '팽팽해요' : (bull ? bear : bull) === 0 && Math.max(bull, bear) >= 5 ? '한쪽으로 모였어요' : bull > bear ? '강세 쪽이 많아요' : '약세 쪽이 많아요';
  return { bull, neutral, bear, abstain, total: seats.length, word };
}
/** How split the vote is, 0 (one side) to 1 (even), for picking the most argued stock of the day. */
export const splitness = (s: Split): number => (s.bull + s.bear ? 1 - Math.abs(s.bull - s.bear) / (s.bull + s.bear) : 0);

const priceWord = (v: number) => won(v);
/** "평균회귀 PM 혼자 강세예요. 종가 $154.04 아래로 닫히면 틀렸다고 인정해요." when one or two members stand against three times as many. */
export function dissentLine(seats: readonly Seat[]): string {
  const s = splitOf(seats);
  const few = Math.min(s.bull, s.bear), many = Math.max(s.bull, s.bear);
  if (!few || few > 2 || many < few * 3) return '';
  const side: SeatStance = s.bull < s.bear ? 'bull' : 'bear';
  const them = seats.filter((x) => x.stance === side);
  const lead = them.find((x) => x.kind === 'analyst') ?? them[0]!;
  const who = them.length === 1 ? `${lead.name} 혼자` : `${them.map((x) => x.name).join('와 ')} 둘만`;
  const kill = lead.invalidation ? ` 종가 ${priceWord(lead.invalidation)} ${side === 'bull' ? '아래' : '위'}로 닫히면 ${them.length === 1 ? '' : `${lead.name}은 `}틀렸다고 인정해요.` : '';
  return `${who} ${WORD[side]}예요.${kill}`;
}

/** Seat centres on a half circle in a 340×196 box, as percentages (so the figure scales with the card). */
function arcPos(i: number, n: number): { x: number; y: number } {
  const a = n === 1 ? Math.PI / 2 : Math.PI - (Math.PI * i) / (n - 1);
  return { x: ((170 + 150 * Math.cos(a)) / 340) * 100, y: ((178 - 150 * Math.sin(a)) / 196) * 100 };
}

/** Data a tapped seat or face carries for the member sheet. */
interface SheetData { n: string; ch: string; f: string; d: boolean; r: string; calls: { s: string; st: SeatStance; c?: number; k?: string; b?: boolean }[] }
const sheetAttr = (d: SheetData) => ` data-cs="${esc(JSON.stringify(d))}"`;
const killText = (s: Pick<Seat, 'stance' | 'invalidation'>) => (s.invalidation && (s.stance === 'bull' || s.stance === 'bear') ? `종가 ${priceWord(s.invalidation)} ${s.stance === 'bull' ? '아래' : '위'}로 닫히면 틀림` : '');
/** A member's record line from the report's analyst board. */
export function recordLine(report: DailyReport | null | undefined, seat: Pick<Seat, 'key' | 'kind'>): string {
  if (seat.kind === 'desk') return '데스크는 위원회 결론에 들어가고, 따로 채점하지 않아요.';
  const b = report?.market?.analystBoard?.find((x) => x.analyst === seat.key);
  return b && b.scored && b.hitRate !== null ? `채점 ${b.scored}건 · 방향 적중 ${Math.round(b.hitRate * 100)}%${b.rank ? ` · ${b.rank}위` : ''}` : '아직 채점 전이에요. 판단 20거래일 뒤부터 채워지고, 틀린 것도 지우지 않아요.';
}

/**
 * The half circle of seats with the count in the middle. `interactive` seats are buttons that open the member sheet
 * (the stock page); otherwise plain marks (inside a link, as on home).
 */
export function seatArc(report: DailyReport, opts: { interactive?: boolean; size?: 'md' | 'lg'; stock?: string } = {}): string {
  const seats = seatsOf(report);
  if (!seats.length) return '';
  const s = splitOf(seats), tag = opts.interactive ? 'button' : 'span';
  const marks = seats.map((x, i) => {
    const p = arcPos(i, seats.length);
    const label = `${x.name} ${WORD[x.stance]}${x.confidence ? ` ${x.confidence}%` : ''}`;
    const data = opts.interactive ? sheetAttr({ n: x.name, ch: x.ch, f: x.focus, d: x.kind === 'desk', r: recordLine(report, x), calls: [{ s: opts.stock ?? report.name, st: x.stance, ...(x.confidence ? { c: x.confidence } : {}), ...(killText(x) ? { k: killText(x) } : {}), ...(x.broken ? { b: true } : {}) }] }) : '';
    return `<${tag}${opts.interactive ? ' type="button"' : ''} class="cs-seat s-${x.stance}${x.kind === 'desk' ? ' is-desk' : ''}" style="left:${p.x.toFixed(2)}%;top:${p.y.toFixed(2)}%;--i:${i}" aria-label="${esc(label)}"${data}>${esc(x.ch)}</${tag}>`;
  }).join('');
  return `<div class="cs-arc cs-${opts.size ?? 'lg'}" role="group" aria-label="${esc(`위원 ${s.total}명: 강세 ${s.bull}, 중립 ${s.neutral}, 약세 ${s.bear}${s.abstain ? `, 기권 ${s.abstain}` : ''}`)}">${marks}<div class="cs-mid"><b><span class="up">${s.bull}</span><i> : ${s.neutral} : </i><span class="down">${s.bear}</span></b><small>강세 · 중립 · 약세${s.abstain ? ` · 기권 ${s.abstain}` : ''}</small></div></div>`;
}

const freeText = (t: string | undefined) => (t && t !== LOCKED_TEXT ? t : '');

/**
 * The stock page's committee card: the seats, how split they are, each side's first public reason, and the lone
 * dissent. id="cs-hero" (the old vote bar under it is gone, so the count lives here only).
 */
export function committeeHero(report: DailyReport): string {
  const seats = seatsOf(report);
  if (!seats.length) return '';
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined, s = splitOf(seats);
  const bull = freeText(c?.bullish[0]?.text), bear = freeText(c?.bearish[0]?.text), dis = dissentLine(seats);
  const side = (cls: string, word: string, n: number, text: string) => (text ? `<div class="cs-side ${cls}"><b>${word} 쪽 ${n}명</b><p>${esc(text)}</p></div>` : '');
  const sides = s.bull && s.bear ? `${side('up', '강세', s.bull, bull)}${side('down', '약세', s.bear, bear)}` : '';
  return `<section class="block cs-hero" id="cs-hero"><div class="card"><div class="cs-k">위원회 판단 · 20거래일 뒤 채점</div><h2 class="cs-title">위원 ${s.total}명, ${esc(s.word)}</h2>${seatArc(report, { interactive: true, stock: report.name })}<p class="cs-tap">좌석을 누르면 그 위원의 판단과 틀림 기준이 나와요.</p>${sides ? `<div class="cs-sides">${sides}</div>` : ''}${dis ? `<p class="cs-dis"><b>소수 의견</b><span>${esc(dis)}</span></p>` : ''}<button type="button" class="cs-share" data-cs-share data-n="${esc(report.name)}" data-d="${esc(report.date)}">이미지로 공유</button></div></section>`;
}

/** 위원별 틀림 기준: each analyst's own wrong-if close, checked against the report's close. */
export function killList(report: DailyReport): string {
  const seats = seatsOf(report);
  const rows = seats.filter((x) => x.kind === 'analyst' && x.invalidation && (x.stance === 'bull' || x.stance === 'bear'));
  if (!rows.length) return '';
  const desks = seats.filter((x) => x.kind === 'desk');
  const deskLine = desks.length ? `데스크 ${desks.length}곳: ${(['bull', 'neutral', 'bear', 'abstain'] as const).map((k) => { const d = desks.filter((x) => x.stance === k); return d.length ? `${d.map((x) => x.name.replace(' 데스크', '')).join('·')} ${WORD[k]}` : ''; }).filter(Boolean).join(', ')}.` : '';
  const broken = rows.filter((x) => x.broken).length;
  // The committee's record on this stock (agreed with the '사기 전에 1분' plan): graded member calls, hits and all.
  const board = report.market?.analystBoard ?? [], n = board.reduce((t, b) => t + b.scored, 0), hit = Math.round(board.reduce((t, b) => t + (b.hitRate ?? 0) * b.scored, 0));
  const rec = `<p class="cs-recl"><b>이 종목 맞힌 기록</b><span>${n ? `${n}번 중 ${hit}번 맞음${n < 10 ? ' · 기록 쌓는 중' : ''}` : '아직 채점 전 · 판단 20거래일 뒤부터'}</span></p>`;
  return `<section class="block cs-kill" id="cs-kill"><div class="card"><div class="cs-kh"><h2>위원별 틀림 기준</h2><small>${broken ? `${broken}명 깨짐 · ` : ''}종가 기준</small></div><ul>${rows.map((x) => `<li><button type="button" class="cs-krow"${sheetAttr({ n: x.name, ch: x.ch, f: x.focus, d: false, r: recordLine(report, x), calls: [{ s: report.name, st: x.stance, ...(x.confidence ? { c: x.confidence } : {}), k: killText(x), ...(x.broken ? { b: true } : {}) }] })}><span class="cs-face s-${x.stance}" aria-hidden="true">${esc(x.ch)}</span><span class="cs-kt"><b>${esc(x.name)}</b><small>${esc(killText(x))}</small></span><span class="cs-tag ${x.stance === 'bull' ? 'up' : 'down'}">${x.broken ? '깨짐' : `${WORD[x.stance]} ${x.confidence ?? ''}%`}</span></button></li>`).join('')}</ul>${rec}${deskLine ? `<p class="cs-fine">${esc(deskLine)} 위원별 긴 근거는 심층 리포트에 있어요.</p>` : ''}</div></section>`;
}

/** A row of small seat dots for list rows (위원회 탭). */
export function seatDots(report: DailyReport): string {
  const seats = seatsOf(report);
  if (!seats.length) return '';
  const s = splitOf(seats), dis = dissentLine(seats);
  const lone = dis ? new Set(seats.filter((x) => x.stance === (s.bull < s.bear ? 'bull' : 'bear')).map((x) => x.key)) : new Set<string>();
  // G-300: the list row says the split in words only; the seats themselves are on the stock's 위원회 page.
  void lone;
  return `<span class="cs-sl"><b>${splitText(s)}</b>${dis ? `<small>소수 의견 · ${esc(dis)}</small>` : ''}</span>`;
}
const splitText = (s: Split) => `${s.word} · ${s.bull}·${s.neutral}·${s.bear}${s.abstain ? ` · 기권 ${s.abstain}` : ''}`;

/** Home's committee card (한서님 시안, 10/24): the most split stock as a half circle, the rest as split bars, one dissent. */
/**
 * G-300 (한서님 10/25 '다른 페이지도 깔끔하게'): the vote as one row of small dots, bull → neutral → bear → abstain.
 * The half circle of seats lives on the stock's 위원회 page only; elsewhere this row stands for it.
 */
export function voteDots(seats: readonly Seat[]): string {
  if (!seats.length) return '';
  const s = splitOf(seats), order: SeatStance[] = ['bull', 'neutral', 'bear', 'abstain'];
  const dots = order.flatMap((k) => seats.filter((x) => x.stance === k)).map((x, i) => `<i class="s-${x.stance}" style="animation-delay:${i * 30}ms" title="${esc(`${x.name} ${WORD[x.stance]}`)}"></i>`).join('');
  return `<span class="cs-vd" role="img" aria-label="${esc(`강세 ${s.bull}, 중립 ${s.neutral}, 약세 ${s.bear}${s.abstain ? `, 기권 ${s.abstain}` : ''}`)}">${dots}</span><small class="cs-dn">${s.bull} · ${s.neutral} · ${s.bear}${s.abstain ? ` · 기권 ${s.abstain}` : ''}</small>`;
}

export function homeCommittee(list: readonly { name: string; href: string; report: DailyReport }[], opts: { day: string; allHref?: string; foot?: string }): string {
  const rows = list.map((x) => ({ ...x, seats: seatsOf(x.report) })).filter((x) => x.seats.length);
  if (!rows.length) return '';
  const top = [...rows].sort((a, b) => splitness(splitOf(b.seats)) - splitness(splitOf(a.seats)) || b.seats.length - a.seats.length)[0]!;
  const s = splitOf(top.seats);
  const head = s.word === '팽팽해요' ? `${esc(top.name)}, 위원 ${s.total}명이 팽팽하게 갈렸어요` : `${esc(top.name)}, ${esc(s.word)}`;
  const bar = (x: typeof rows[number]) => { const t = splitOf(x.seats); const seg = (k: number, cls: string) => (k ? `<i class="${cls}" style="flex:${k}"></i>` : ''); return `<a class="cs-hrow" href="${esc(x.href)}"><b>${esc(x.name)}</b><span class="cs-bar" aria-hidden="true">${seg(t.bull, 'up')}${seg(t.neutral, '')}${seg(t.bear, 'down')}</span><small>${t.bull >= t.bear ? `강세 ${t.bull} · 약세 ${t.bear}` : `약세 ${t.bear} · 강세 ${t.bull}`}</small></a>`; };
  const rest = rows.filter((x) => x !== top);
  const dis = rows.map((x) => ({ x, d: dissentLine(x.seats) })).find((y) => y.d);
  return `<section class="card cs-home"><div class="cs-hh"><span>AI 위원회 · ${esc(opts.day)} 마감 판단</span>${opts.allHref ? `<button type="button" class="wd-link" data-wd-go="com">${rows.length}종목 ›</button>` : ''}</div><a class="cs-htop" href="${esc(top.href)}"><h2 class="cs-htitle">${head}</h2><span class="cs-drow">${voteDots(top.seats)}</span></a>${rest.length ? `<div class="cs-hrows">${rest.slice(0, 3).map(bar).join('')}</div>` : ''}${dis ? `<p class="cs-dis"><b>소수 의견</b><span>${esc(dis.x.name)} · ${esc(dis.d)}</span></p>` : ''}${opts.foot ?? ''}</section>`;
}

/**
 * 위원회 탭's roster (한서님 시안 ②): the six analysts and five desks as faces. A face opens the member's sheet with
 * the record and every call on the newest report day.
 */
export function rosterCard(reports: readonly { name: string; report: DailyReport }[]): string {
  const today = reports.map((r) => ({ ...r, seats: seatsOf(r.report) })).filter((r) => r.seats.length);
  const board = today.find((r) => r.report.market?.analystBoard?.length)?.report ?? null;
  const members: { key: string; kind: 'analyst' | 'desk' }[] = [...ANALYSTS.filter((a) => a.id !== 'sector_expert').map((a) => ({ key: a.id, kind: 'analyst' as const })), ...Object.keys(DESK).map((k) => ({ key: k, kind: 'desk' as const }))];
  const faces = members.map((m) => {
    const name = m.kind === 'desk' ? DESK[m.key]!.name : analystName(m.key);
    const focus = m.kind === 'desk' ? DESK[m.key]!.focus : ANALYSTS.find((a) => a.id === m.key)?.focus ?? '';
    const calls = today.flatMap((r) => r.seats.filter((x) => x.key === m.key).map((x) => ({ s: r.name, st: x.stance, ...(x.confidence ? { c: x.confidence } : {}), ...(killText(x) ? { k: killText(x) } : {}), ...(x.broken ? { b: true } : {}) })));
    const short = name.replace(/ (PM|분석가)$/, '').replace('실적·밸류에이션', '실적·가치');
    return `<button type="button" class="cs-mem"${sheetAttr({ n: name, ch: GLYPH[m.key] ?? '·', f: focus, d: m.kind === 'desk', r: recordLine(board, m), calls })}><span class="cs-face big${m.kind === 'desk' ? ' is-desk' : ''}" aria-hidden="true">${esc(GLYPH[m.key] ?? '·')}</span><small>${esc(short)}</small></button>`;
  }).join('');
  return `<section class="block cs-roster" id="members"><div class="card"><div class="cs-kh"><h2>위원 ${members.length}명</h2><small>누르면 위원 한 명의 기록</small></div><div class="cs-faces">${faces}</div><p class="cs-fine">분석가 6명 · 데스크 5명 · 종목마다 업종 전문위원 1명이 더 앉아요.</p></div></section>`;
}

export const COMMITTEE_CSS = `.cs-hero .card,.cs-kill .card,.cs-roster .card{padding:20px}.cs-k,.cs-hh span{font-size:13px;font-weight:700;color:var(--fg2)}.cs-title{margin:6px 0 4px;font-size:22px;font-weight:800;letter-spacing:-.4px}
.cs-arc{position:relative;width:100%;max-width:340px;aspect-ratio:340/196;margin:4px auto 0}
.cs-seat{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:0;padding:0;display:flex;align-items:center;justify-content:center;font:inherit;font-size:13px;font-weight:800;line-height:1;cursor:default;animation:cs-pop .55s var(--spring-bouncy,cubic-bezier(.34,1.56,.64,1)) both;animation-delay:calc(var(--i,0)*35ms)}
button.cs-seat{cursor:pointer;transition:transform .35s var(--spring-bouncy,cubic-bezier(.34,1.56,.64,1))}button.cs-seat:active{transform:scale(.88)}button.cs-seat:hover{transform:scale(1.12)}button.cs-seat:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
.cs-md .cs-seat{width:30px;height:30px;margin:-15px 0 0 -15px;font-size:12px}
.s-bull{background:var(--up);color:#fff}.s-bear{background:var(--down);color:#fff}.s-neutral{background:var(--line-strong);color:var(--fg)}.s-abstain{background:transparent;color:var(--muted);box-shadow:inset 0 0 0 1.5px var(--line-strong)}
.cs-mid{position:absolute;left:0;right:0;bottom:2px;pointer-events:none;text-align:center;display:flex;flex-direction:column;gap:2px}.cs-mid b{font-size:28px;font-weight:800;letter-spacing:-.5px;font-variant-numeric:tabular-nums}.cs-mid b i{font-style:normal;color:var(--muted)}.cs-mid .up{color:var(--up)}.cs-mid .down{color:var(--down)}.cs-mid small{font-size:12px;color:var(--muted)}
.cs-tap{margin:10px 0 0;font-size:12px;color:var(--muted);text-align:center}
.cs-sides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.cs-side{padding:14px;border-radius:16px;background:var(--soft)}.cs-side b{font-size:13px;font-weight:800}.cs-side.up b{color:var(--up)}.cs-side.down b{color:var(--down)}.cs-side p{margin:6px 0 0;font-size:13px;line-height:1.55;color:var(--fg)}
.cs-dis{display:flex;gap:8px;margin:12px 0 0;padding:11px 13px;border-radius:14px;background:var(--soft);font-size:13px;line-height:1.5}.cs-dis b{flex-shrink:0;font-size:12px}
.cs-kh{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}.cs-kh h2{margin:0;font-size:17px}.cs-kh small{font-size:12px;color:var(--muted)}
.cs-kill ul{list-style:none;margin:0;padding:0}.cs-krow{width:100%;display:flex;align-items:center;gap:12px;padding:10px 0;border:0;border-top:1px solid var(--line);background:none;font:inherit;color:var(--fg);text-align:left;cursor:pointer}
.cs-face{width:36px;height:36px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:800}.cs-face.big{width:48px;height:48px;border-radius:16px;font-size:17px;background:var(--fg);color:var(--surface-solid,#fff)}.cs-face.big.is-desk{background:var(--soft);color:var(--fg)}
.cs-kt{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}.cs-kt b{font-size:14px}.cs-kt small{font-size:12px;color:var(--muted)}
.cs-tag{font-size:12px;font-weight:700;padding:4px 10px;border-radius:12px;background:var(--soft);white-space:nowrap}.cs-tag.up{color:var(--up)}.cs-tag.down{color:var(--down)}.cs-recl{display:flex;justify-content:space-between;gap:10px;margin:0;padding:12px 0 0;border-top:1px solid var(--line);font-size:13px}.cs-recl span{color:var(--fg2);text-align:right}.cs-fine{margin:10px 0 0;font-size:12px;line-height:1.5;color:var(--muted)}
.cs-faces{display:flex;gap:6px;margin:8px -20px 0;padding:2px 20px 4px;overflow-x:auto;scroll-snap-type:x proximity;scrollbar-width:none}.cs-faces::-webkit-scrollbar{display:none}.cs-faces .cs-mem{flex:none;width:62px;scroll-snap-align:start}.cs-faces .cs-face.big{width:44px;height:44px;border-radius:50%;font-size:16px}.cs-mem{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;padding:0;font:inherit;color:var(--fg);cursor:pointer;transition:transform .35s var(--spring-bouncy,cubic-bezier(.34,1.56,.64,1))}.cs-mem:active{transform:scale(.92)}.cs-mem small{font-size:11px;font-weight:600;text-align:center;line-height:1.3}
.cs-dots{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 4px}.cs-dots i{width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;font-style:normal;animation:cs-pop .5s var(--spring-bouncy,cubic-bezier(.34,1.56,.64,1)) both;animation-delay:calc(var(--i,0)*25ms)}.cs-dots i.lone{outline:2px solid var(--fg);outline-offset:1px}
.cs-sl{display:flex;flex-direction:column;gap:3px}.cs-sl b{font-size:13.5px}.cs-sl small{font-size:12.5px;color:var(--fg2);line-height:1.45}
.cs-home{padding:20px;margin-bottom:14px}.cs-hh{display:flex;justify-content:space-between;align-items:center}.cs-htop{display:block;color:var(--fg);text-decoration:none}.cs-htitle{margin:10px 0 2px;font-size:22px;font-weight:800;line-height:1.35;letter-spacing:-.4px}
.cs-drow{display:flex;align-items:center;gap:10px;margin:8px 0 2px}.cs-vd{display:flex;gap:4px;flex-wrap:wrap}.cs-vd i{width:12px;height:12px;border-radius:50%;animation:cs-pop .45s var(--spring-bouncy,cubic-bezier(.34,1.56,.64,1)) both}.cs-dn{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.cs-hfoot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);min-height:44px;color:var(--fg);text-decoration:none;font-size:13.5px}.cs-hfoot b{font-variant-numeric:tabular-nums}.cs-hfoot small{color:var(--muted);font-size:12px}
.cs-hrows{display:flex;flex-direction:column;gap:2px;margin-top:10px}.cs-hrow{display:grid;grid-template-columns:96px 1fr auto;align-items:center;gap:10px;min-height:36px;color:var(--fg);text-decoration:none}.cs-hrow b{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-hrow small{font-size:12px;color:var(--fg2);white-space:nowrap}
.cs-bar{display:flex;gap:2px;height:8px;border-radius:4px;overflow:hidden}.cs-bar i{background:var(--line-strong)}.cs-bar i.up{background:var(--up)}.cs-bar i.down{background:var(--down)}
.cs-sheet{position:fixed;inset:0;z-index:600;display:flex;align-items:flex-end;justify-content:center;background:rgba(20,20,24,.36);opacity:0;transition:opacity .25s ease}.cs-sheet.on{opacity:1}.cs-sheet[hidden]{display:none}
.cs-panel{width:100%;max-width:520px;max-height:86vh;overflow:auto;box-sizing:border-box;padding:12px 20px calc(24px + env(safe-area-inset-bottom,0px));border-radius:28px 28px 0 0;background:var(--surface-solid,#fff);transform:translateY(100%);transition:transform .5s var(--spring-bouncy,cubic-bezier(.34,1.56,.64,1))}.cs-sheet.on .cs-panel{transform:none}
.cs-grip{display:block;width:40px;height:5px;border-radius:3px;background:var(--line-strong);margin:0 auto 14px}.cs-who{display:flex;align-items:center;gap:14px}.cs-who .cs-face{width:56px;height:56px;border-radius:18px;font-size:22px;background:var(--fg);color:var(--surface-solid,#fff)}.cs-who .cs-face.is-desk{background:var(--soft);color:var(--fg)}.cs-who b{display:block;font-size:20px}.cs-who small{display:block;font-size:13px;color:var(--muted);margin-top:2px}
.cs-rec{margin:16px 0;padding:14px 16px;border-radius:18px;background:var(--soft);font-size:13.5px;line-height:1.5}.cs-rec b{display:block;font-size:13px;margin-bottom:4px}
.cs-calls{list-style:none;margin:0;padding:0}.cs-calls li{display:flex;align-items:center;gap:10px;padding:11px 0;border-top:1px solid var(--line)}.cs-calls li span{flex:1;display:flex;flex-direction:column;gap:2px}.cs-calls li b{font-size:14px}.cs-calls li small{font-size:12px;color:var(--muted)}
.cs-close{display:block;width:100%;min-height:48px;margin-top:16px;border:0;border-radius:24px;background:var(--fg);color:var(--surface-solid,#fff);font:inherit;font-size:15px;font-weight:700;cursor:pointer}
.cs-share{display:block;width:100%;min-height:44px;margin-top:14px;border:1px solid var(--line-strong);border-radius:22px;background:none;color:var(--fg);font:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:transform .35s var(--spring-bouncy,cubic-bezier(.34,1.56,.64,1))}.cs-share:active{transform:scale(.97)}.cs-share:focus-visible{outline:2px solid var(--fg);outline-offset:2px}
@keyframes cs-pop{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.cs-seat,.cs-dots i{animation:none}.cs-panel,.cs-sheet{transition:none}}`;

/** Opens the member sheet from any [data-cs] seat, face or row. */
export const COMMITTEE_JS = `(function () {
  var W = { bull: '강세', neutral: '중립', bear: '약세', abstain: '기권' }, sheet = null, last = null;
  var e = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var close = function () { if (!sheet || sheet.hidden) return; sheet.classList.remove('on'); setTimeout(function () { sheet.hidden = true; }, 260); if (last) last.focus(); };
  var open = function (btn) {
    var d; try { d = JSON.parse(btn.getAttribute('data-cs')); } catch (x) { return; }
    if (!sheet) { sheet = document.createElement('div'); sheet.className = 'cs-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); document.body.appendChild(sheet);
      sheet.addEventListener('click', function (ev) { if (ev.target === sheet || ev.target.closest('.cs-close')) close(); });
      document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); }); }
    var calls = (d.calls || []).map(function (c) { return '<li><span><b>' + e(c.s) + '</b>' + (c.k ? '<small>' + e(c.k) + (c.b ? ' · 이미 깨졌어요' : '') + '</small>' : '') + '</span><em class="cs-tag ' + (c.st === 'bull' ? 'up' : c.st === 'bear' ? 'down' : '') + '">' + W[c.st] + (c.c ? ' ' + c.c + '%' : '') + '</em></li>'; }).join('');
    sheet.setAttribute('aria-label', d.n);
    sheet.innerHTML = '<div class="cs-panel"><i class="cs-grip" aria-hidden="true"></i><div class="cs-who"><span class="cs-face' + (d.d ? ' is-desk' : '') + '" aria-hidden="true">' + e(d.ch) + '</span><span><b>' + e(d.n) + '</b><small>' + e(d.f) + '</small></span></div><div class="cs-rec"><b>성적</b>' + e(d.r) + '</div>' + (calls ? '<b style="font-size:14px">판단</b><ul class="cs-calls">' + calls + '</ul>' : '<p class="cs-fine">이 위원은 오늘 판단이 없어요.</p>') + '<p class="cs-fine">종목에 대한 AI 위원의 판단 기록이에요. 모두에게 같은 내용이고, 투자 권유가 아니에요.</p><button type="button" class="cs-close">닫기</button></div>';
    last = btn; sheet.hidden = false; requestAnimationFrame(function () { sheet.classList.add('on'); var b = sheet.querySelector('.cs-close'); if (b) b.focus(); });
  };
  document.addEventListener('click', function (ev) { var b = ev.target.closest && ev.target.closest('[data-cs]'); if (!b) return; ev.preventDefault(); open(b); });
  // G-299: 이미지로 공유. The committee card as one 1080x1350 picture: seats, the split, the lone dissent, the date.
  // No price, no return: the same record everyone sees. The link carries utm_source=share so visits count it (G-293).
  var wrap = function (ctx, text, max) { var out = [], line = ''; String(text).split('').forEach(function (ch) { if (ctx.measureText(line + ch).width > max && line) { out.push(line); line = ch.trim() ? ch : ''; } else line += ch; }); if (line) out.push(line); return out; };
  var draw = function (card, btn) {
    var c = document.createElement('canvas'), W = 1080, H = 1350, ctx; c.width = W; c.height = H; ctx = c.getContext('2d'); if (!ctx) return null;
    var css = getComputedStyle(document.documentElement), v = function (k, d) { return (css.getPropertyValue(k) || '').trim() || d; };
    var F = '"Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo", sans-serif', up = v('--up', '#E5484D'), down = v('--down', '#3E7BFA');
    ctx.fillStyle = '#ECEDEF'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(60, 60, W - 120, H - 120, 56); else ctx.rect(60, 60, W - 120, H - 120); ctx.fill();
    ctx.fillStyle = '#5E6168'; ctx.font = '600 34px ' + F; ctx.fillText('GNOMON AI 위원회 · ' + btn.getAttribute('data-d') + ' 판단', 120, 160);
    ctx.fillStyle = '#141416'; ctx.font = '800 84px ' + F; ctx.fillText(btn.getAttribute('data-n'), 120, 260);
    var t = card.querySelector('.cs-title'); ctx.font = '700 40px ' + F; ctx.fillStyle = '#3A3C42'; if (t) ctx.fillText(t.textContent, 120, 330);
    var aw = 640, ax = (W - aw) / 2, ay = 380, ah = aw * 196 / 340;
    card.querySelectorAll('.cs-seat').forEach(function (s) {
      var x = ax + parseFloat(s.style.left) / 100 * aw, y = ay + parseFloat(s.style.top) / 100 * ah, k = s.className;
      ctx.beginPath(); ctx.arc(x, y, 38, 0, Math.PI * 2);
      if (k.indexOf('s-abstain') >= 0) { ctx.strokeStyle = '#B8BAC0'; ctx.lineWidth = 4; ctx.stroke(); ctx.fillStyle = '#8E9198'; }
      else { ctx.fillStyle = k.indexOf('s-bull') >= 0 ? up : k.indexOf('s-bear') >= 0 ? down : '#D5D7DC'; ctx.fill(); ctx.fillStyle = k.indexOf('s-neutral') >= 0 ? '#141416' : '#FFFFFF'; }
      ctx.font = '800 28px ' + F; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.textContent, x, y); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    });
    var m = card.querySelector('.cs-mid b'), sm = card.querySelector('.cs-mid small'); ctx.textAlign = 'center';
    if (m) { var parts = m.textContent.split(':').map(function (x) { return x.trim(); }), cols = [up, '#8E9198', down]; ctx.font = '800 88px ' + F;
      var seg = parts.map(function (x, i) { return (i ? ' : ' : '') + x; }), tw = seg.reduce(function (a, x) { return a + ctx.measureText(x).width; }, 0), px = W / 2 - tw / 2; ctx.textAlign = 'left';
      seg.forEach(function (x, i) { ctx.fillStyle = cols[i] || '#141416'; ctx.fillText(x, px, ay + ah - 10); px += ctx.measureText(x).width; }); ctx.textAlign = 'center'; }
    if (sm) { ctx.fillStyle = '#8E9198'; ctx.font = '600 32px ' + F; ctx.fillText(sm.textContent, W / 2, ay + ah + 44); }
    ctx.textAlign = 'left';
    var y = ay + ah + 96, dis = card.querySelector('.cs-dis span'), sides = card.querySelectorAll('.cs-side');
    if (sides.length === 2 && !dis) { var bw = (W - 240 - 32) / 2; sides.forEach(function (sd, i) { var bx = 120 + i * (bw + 32), hb = sd.querySelector('b'), tp = sd.querySelector('p'), ls;
      ctx.font = '500 32px ' + F; ls = wrap(ctx, tp ? tp.textContent : '', bw - 64).slice(0, 4); ctx.fillStyle = '#F3F4F6'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, y, bw, 260, 32); else ctx.rect(bx, y, bw, 260); ctx.fill();
      ctx.fillStyle = i ? down : up; ctx.font = '800 32px ' + F; ctx.fillText(hb ? hb.textContent : '', bx + 32, y + 56); ctx.fillStyle = '#141416'; ctx.font = '500 32px ' + F; ls.forEach(function (l, j) { ctx.fillText(l, bx + 32, y + 108 + j * 44); }); }); }
    if (dis) { ctx.fillStyle = '#F3F4F6'; var lines; ctx.font = '500 36px ' + F; lines = wrap(ctx, dis.textContent, W - 320).slice(0, 3);
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(120, y, W - 240, 90 + lines.length * 52, 32); else ctx.rect(120, y, W - 240, 90 + lines.length * 52); ctx.fill();
      ctx.fillStyle = '#141416'; ctx.font = '700 32px ' + F; ctx.fillText('소수 의견', 160, y + 58); ctx.font = '500 36px ' + F; lines.forEach(function (l, i) { ctx.fillText(l, 160, y + 112 + i * 52); }); }
    ctx.fillStyle = '#8E9198'; ctx.font = '500 28px ' + F;
    ctx.fillText('20거래일 뒤 맞았는지 공개로 채점해요.', 120, H - 186);
    ctx.fillText('모두에게 같은 AI 판단 기록이에요. 투자 권유가 아니에요.', 120, H - 144);
    ctx.fillStyle = '#141416'; ctx.font = '700 30px ' + F; ctx.fillText(location.hostname, 120, H - 96);
    return c;
  };
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest && ev.target.closest('[data-cs-share]'); if (!btn) return; ev.preventDefault();
    var card = btn.closest('.cs-hero'), link = location.origin + location.pathname + '?utm_source=share';
    var go = function () {
      var c = card && draw(card, btn); if (!c || !c.toBlob) return;
      c.toBlob(function (blob) {
        if (!blob) return;
        var name = 'GNOMON_' + btn.getAttribute('data-n') + '_' + btn.getAttribute('data-d') + '.png', file = null;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (x) {}
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: btn.getAttribute('data-n') + ' · GNOMON AI 위원회', text: link }).catch(function () {}); return; }
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        if (window.GNM && GNM.toast) GNM.toast('이미지를 저장했어요. 링크: ' + link);
      }, 'image/png');
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go); else go();
    if (window.GNM && GNM.track) GNM.track('share_image', {});
  });
})();`;
