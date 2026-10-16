import {ORBS} from './ui.js';
// Report extras (docs/DESIGN.md §5.12, G-42): what changed since the last report, how a report's
// judgement was put together (a decision trace, from BOT constitution §9 and BOR Golden Trace),
// and claim-kind chips. Pure rendering from stored reports.

import type { DailyReport } from './dailyReport.js';
import { ANALYSTS } from '../analysis/analysts.js';
import { replyIndex, type ClaimKind, type Commentary, type InsightKey } from '../analysis/commentary.js';
import { esc } from './html.js';
import { won, tone } from './format.js';

const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

export const KIND_WORD: Record<ClaimKind, string> = { FACT: '사실', INFERENCE: '해석', ASSUMPTION: '가정' };
export const kindChip = (kind: ClaimKind | undefined) => (kind ? `<span class="ck ck-${kind}" title="${KIND_WORD[kind]}: ${kind === 'FACT' ? '근거에 그대로 있어요' : kind === 'INFERENCE' ? '근거에서 끌어낸 해석이에요' : '근거로 확인되지 않은 가정이에요'}">${KIND_WORD[kind]}</span>` : '');

const STANCE = { BULLISH: '강세', BEARISH: '약세', NEUTRAL: '중립', INSUFFICIENT_DATA: '근거 부족' } as const;
const DESK = { MARKET: '시장', TECHNICAL: '기술', FLOW: '수급', FUNDAMENTAL: '펀더멘털', EVENT: '공시·뉴스' } as const;

export interface WeekChange { label: string; before: string; after: string; /** The change as a percent, when it is a number. */ delta?: string; tone?: string }

/** Number differences between two reports: price, medium-term signal, fair value and the analysts' average target. */
export function weekChanges(cur: DailyReport, prev: DailyReport): WeekChange[] {
  const out: WeekChange[] = [];
  if (cur.price && prev.price) {
    const d = (cur.price.close / prev.price.close - 1) * 100;
    out.push({ label: '종가', before: won(prev.price.close), after: won(cur.price.close), delta: pct(d), tone: tone(d) });
  }
  const mid = (r: DailyReport) => r.market?.horizons?.find((h) => h.key === 'MEDIUM')?.summary.label;
  if (mid(cur) && mid(prev)) out.push({ label: '중기 기술 신호', before: mid(prev)!, after: mid(cur)! });
  const fv = (r: DailyReport) => r.market?.fairValue?.center;
  if (fv(cur) && fv(prev)) { const d = (fv(cur)! / fv(prev)! - 1) * 100; out.push({ label: '기술적 적정가', before: won(fv(prev)!), after: won(fv(cur)!), delta: pct(d), tone: tone(d) }); }
  const c = okCommentary(cur), p = okCommentary(prev);
  const avg = (x: Commentary | undefined) => (x?.analysts?.length ? x.analysts.reduce((s, a) => s + a.target, 0) / x.analysts.length : null);
  if (avg(c) && avg(p)) { const d = (avg(c)! / avg(p)! - 1) * 100; out.push({ label: '분석가 예상가 평균', before: won(avg(p)!), after: won(avg(c)!), delta: pct(d), tone: tone(d) }); }
  return out;
}

const okCommentary = (r: DailyReport) => (r.commentary?.status === 'OK' ? r.commentary : undefined);
const SCENARIO = [['BULL', '강세'], ['BASE', '기본'], ['BEAR', '약세']] as const;

/** A committee member whose stance differs between the two reports. */
export interface StanceFlip { who: string; before: string; after: string; tone: string }
export interface ReportDiff {
  /** One sentence: what moved most. */
  lead: string;
  rows: WeekChange[];
  odds: { label: string; before: number; after: number }[];
  votes: { before: [number, number, number]; after: [number, number, number] } | null;
  flips: StanceFlip[];
  summary: { before: string; after: string } | null;
}

/**
 * G-203: what changed since the stock's previous committee report. Only the public part of a commentary
 * (one line, each member's stance and target, scenario odds) is read, so the result can be shown to everyone.
 */
export function reportDiff(cur: DailyReport, prev: DailyReport): ReportDiff {
  const c = okCommentary(cur), p = okCommentary(prev);
  const flips: StanceFlip[] = [];
  const toneOf = (s: string) => (s === 'BULLISH' ? 'up' : s === 'BEARISH' ? 'down' : '');
  for (const a of c?.analysts ?? []) {
    const before = p?.analysts?.find((x) => x.analyst === a.analyst);
    if (before && before.stance !== a.stance) flips.push({ who: SPEAKER[a.analyst] ?? a.analyst, before: STANCE[before.stance], after: STANCE[a.stance], tone: toneOf(a.stance) });
  }
  for (const d of c?.desks ?? []) {
    const before = p?.desks?.find((x) => x.desk === d.desk);
    if (before && before.stance !== d.stance) flips.push({ who: `${DESK[d.desk]} 데스크`, before: STANCE[before.stance], after: STANCE[d.stance], tone: toneOf(d.stance) });
  }
  const prob = (x: Commentary | undefined, k: string) => x?.scenarios?.find((s) => s.kind === k)?.probability;
  const odds = SCENARIO.flatMap(([k, label]) => { const b = prob(p, k), a = prob(c, k); return typeof a === 'number' && typeof b === 'number' ? [{ label, before: b, after: a }] : []; });
  const tally = (x: Commentary | undefined): [number, number, number] | null => {
    const all = [...(x?.analysts ?? []), ...(x?.desks ?? [])].map((m) => m.stance);
    return all.length ? [all.filter((s) => s === 'BULLISH').length, all.filter((s) => s === 'NEUTRAL').length, all.filter((s) => s === 'BEARISH').length] : null;
  };
  const tb = tally(p), ta = tally(c);
  const votes = tb && ta ? { before: tb, after: ta } : null;
  // Whole conclusions: two that start alike can still end apart.
  const sb = p?.summary?.text?.trim(), sa = c?.summary?.text?.trim();
  const summary = sb && sa && sb !== sa ? { before: sb, after: sa } : null;
  // The lead names the biggest move: odds first (the committee's own bottom line), then members, then price.
  const parts: string[] = [];
  const big = [...odds].sort((x, y) => Math.abs(y.after - y.before) - Math.abs(x.after - x.before))[0];
  if (big && Math.abs(big.after - big.before) >= 5) parts.push(`${big.label} 시나리오 확률이 ${big.before}%에서 ${big.after}%로 ${big.after > big.before ? '올랐' : '내렸'}`);
  if (flips.length) parts.push(`위원 ${flips.length}명이 입장을 바꿨`);
  // A tally can move with no one flipping (members added or dropped between prompt versions).
  else if (votes && (votes.before[0] !== votes.after[0] || votes.before[2] !== votes.after[2])) parts.push('위원 표결의 강세·약세 수가 바뀌었');
  // "Nothing much changed" only when both reports had odds or members to compare (an old brief has neither).
  const lead = parts.length ? `${parts.join('고, ')}어요.` : odds.length || votes ? '위원회의 판단은 크게 달라지지 않았어요.' : '';
  return { lead, rows: weekChanges(cur, prev), odds, votes, flips, summary };
}

/** Only what reportDiff reads, so a previous report can travel small (research/<symbol>.last.json, the API). */
export function diffBasis(r: DailyReport): DailyReport {
  const c = okCommentary(r);
  const mid = r.market?.horizons?.find((h) => h.key === 'MEDIUM');
  return {
    symbol: r.symbol, name: r.name, date: r.date, generatedAt: r.generatedAt, ...(r.currency ? { currency: r.currency } : {}),
    ...(r.price ? { price: { close: r.price.close, sessionDate: r.price.sessionDate } } : {}),
    ...(r.market ? { market: { horizons: mid ? [{ key: mid.key, summary: { label: mid.summary.label } }] : [], ...(r.market.fairValue ? { fairValue: { center: r.market.fairValue.center } } : {}) } } : {}),
    ...(c ? { commentary: { status: 'OK', model: c.model, promptVersion: c.promptVersion, generatedAt: c.generatedAt, ...(c.summary ? { summary: { text: c.summary.text, evidenceIds: [] } } : {}),
      bullish: [], bearish: [], uncertain: [], watch: [], dataGaps: [], dropped: 0, evidence: [],
      desks: (c.desks ?? []).map((d) => ({ desk: d.desk, stance: d.stance, view: { text: '', evidenceIds: [] } })),
      analysts: (c.analysts ?? []).map((a) => ({ analyst: a.analyst, stance: a.stance, confidence: a.confidence, target: a.target, rationale: { text: '', evidenceIds: [] } })),
      scenarios: (c.scenarios ?? []).map((s) => ({ kind: s.kind, narrative: { text: '', evidenceIds: [] }, catalysts: [], invalidation: [], ...(typeof s.probability === 'number' ? { probability: s.probability } : {}) })) } } : {}),
  } as unknown as DailyReport;
}

/**
 * The AI tab's "지난 리포트와 달라진 점" card (G-203), right under the conclusion (the caller gates it to Plus).
 * The header and numbers are the page's own date; `conclusionDate` labels the conclusion when it is an earlier report's (a live page).
 */
export function reportDiffCard(cur: DailyReport, prev: DailyReport | null, opts: { conclusionDate?: string | null; href?: string | null } = {}): string {
  const head = '<div class="block-head"><h2>지난 리포트와 달라진 점</h2></div>';
  if (!prev) return `<section class="block" id="diff">${head}<div class="card"><p class="empty">이 종목의 이전 위원회 리포트가 아직 없어요. 다음 리포트부터 무엇이 달라졌는지 여기서 보여 드려요.</p></div></section>`;
  const d = reportDiff(cur, prev);
  const conclusionDate = opts.conclusionDate ?? cur.date;
  // The dates ride inside the card (a line above it slid under the sticky tab bar on phones).
  const prevLabel = opts.href ? `<a href="${esc(opts.href)}">${esc(prev.date)}</a>` : `<span>${esc(prev.date)}</span>`;
  const dates = `<div class="df-dates"><span class="df-dk">지난 리포트</span>${prevLabel}<span class="df-ar" aria-hidden="true">→</span><span class="df-dk">이번</span><b>${esc(cur.date)}</b></div>`;
  const sign = (v: number) => `${v > 0 ? '+' : ''}${v}%p`;
  const odds = d.odds.length ? `<div class="df-odds">${d.odds.map((o) => `<div class="df-o"><span class="df-ok">${o.label}</span><span class="df-ov"><s>${o.before}%</s><b>${o.after}%</b></span><small class="${o.after > o.before ? 'up' : o.after < o.before ? 'down' : 'muted'}">${o.after === o.before ? '그대로' : sign(o.after - o.before)}</small></div>`).join('')}</div>` : '';
  // The tally as two stacked bars (seats per side), last report over this one.
  const bar = (v: [number, number, number], k: string) => `<div class="df-vrow"><span class="df-vk">${k}</span><div class="sc-prob df-bar" role="img" aria-label="${k} 강세 ${v[0]}명, 중립 ${v[1]}명, 약세 ${v[2]}명">${(['bull', 'base', 'bear'] as const).map((c, i) => (v[i]! > 0 ? `<span class="sp-${c}" style="flex:${v[i]}">${v[i]}</span>` : '')).join('')}</div></div>`;
  const votes = d.votes ? `<div class="df-sec"><h3 class="df-h">위원 표결</h3>${bar(d.votes.before, '지난')}${bar(d.votes.after, '이번')}<div class="df-leg"><span class="up">● 강세</span><span class="muted">● 중립</span><span class="down">● 약세</span></div></div>` : '';
  const flips = d.flips.length ? `<div class="df-sec"><h3 class="df-h">입장을 바꾼 위원 <span class="muted">${d.flips.length}명</span></h3><ul class="df-flips">${d.flips.map((f) => `<li><span class="df-who">${esc(f.who)}</span><span class="df-chg"><s>${esc(f.before)}</s><span aria-hidden="true">→</span><b class="${f.tone}">${esc(f.after)}</b></span></li>`).join('')}</ul></div>` : '';
  const stats = d.rows.length ? `<div class="df-sec"><h3 class="df-h">숫자</h3><ul class="df-stats">${d.rows.map((r) => `<li><span class="df-sk">${esc(r.label)}</span><span class="df-sv"><s>${esc(r.before)}</s><b class="${r.delta ? '' : r.tone ?? ''}">${esc(r.after)}</b></span>${r.delta && r.delta !== '0.0%' ? `<em class="df-pill ${r.tone ?? ''}">${esc(r.delta)}</em>` : r.before === r.after ? '<em class="df-pill muted">그대로</em>' : ''}</li>`).join('')}</ul></div>` : '';
  const summary = d.summary ? `<details class="more df-sum"><summary>위원회 결론 두 개 나란히 보기</summary><div class="grid-eq" style="margin-top:8px"><div><div class="pl-k">${esc(prev.date)}</div><p>${esc(d.summary.before)}</p></div><div><div class="pl-k">${esc(conclusionDate)}</div><p>${esc(d.summary.after)}</p></div></div></details>` : '';
  const body = odds + votes + flips + stats + summary;
  return `<section class="block" id="diff">${head}<div class="card df">${dates}
${d.lead ? `<p class="df-lead">${esc(d.lead)}</p>` : ''}${body || '<p class="empty">비교할 수 있는 항목이 없어요.</p>'}
<p class="fine">두 리포트 모두 만든 날 그대로 보관돼요. 바뀐 점은 그 기록끼리 비교한 거예요.</p></div></section>`;
}

/** How this report's judgement was made: data cut-off, evidence by kind, model and prompt, method versions. */
export function decisionTrace(report: DailyReport, live: boolean): string {
  const c = report.commentary;
  const kinds = new Map<string, number>();
  for (const e of c?.evidence ?? []) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
  const KIND = { PRICE: '가격', TECHNICAL: '기술 지표', FILING: '공시', NEWS: '뉴스', HORIZON: '기간별 신호', VALUE: '적정가', FORECAST: '예측', STRUCTURE: '가격 구조', FLOW: '수급', FUNDAMENTAL: '실적', MARKET: '시장', ARENA: '전략' } as Record<string, string>;
  const m = report.market;
  const rows: [string, string][] = [
    ['데이터 기준', `${report.price?.sessionDate ?? report.date} 종가 · ${new Date(Date.parse(report.generatedAt) + 9 * 3600_000).toISOString().slice(0, 16).replace('T', ' ')} KST에 계산`],
    ['기록 방식', live ? '실행할 때마다 다시 만드는 대시보드예요(AI 해설은 그 리포트 날짜의 것)' : '만든 날 그대로 고정된 리포트예요'],
    ['근거', c?.evidence.length ? `${c.evidence.length}개 · ${[...kinds].map(([k, n]) => `${KIND[k] ?? k} ${n}`).join(', ')}` : '없음'],
    ['AI', c ? `${c.status === 'OK' ? (c.tier === 'brief' ? '간단 해설(이전)' : '위원회') : '해설 없음'} · ${c.servedBy ?? c.model} · 프롬프트 ${c.promptVersion}${c.usage ? ` · 입력 ${c.usage.inputTokens.toLocaleString('ko-KR')} / 출력 ${c.usage.outputTokens.toLocaleString('ko-KR')} 토큰` : ''}${c.error ? ` · ${c.error}` : ''}` : '없음'],
    ['주장 검증', c?.status === 'OK' ? `근거 ID가 없는 주장은 빼요(이번에 ${c.dropped}개)` : '—'],
    ['계산 방법', [m?.fairValue?.method, m?.forecasts[0]?.method, m?.arena?.method].filter(Boolean).join(' · ') || '—'],
  ];
  return `<section class="block" id="trace"><div class="block-head"><h2>이 판단을 만든 입력</h2><span class="muted">판단 재구성</span></div><div class="card"><table class="compact"><tbody>${rows.map(([k, v]) => `<tr><th style="width:22%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
<p class="fine">같은 입력과 같은 방법 버전이면 같은 계산이 나와요. AI 해설은 입력·모델·프롬프트 버전을 함께 남겨요.</p></div></section>`;
}

export const SPEAKER: Record<string, string> = { ...Object.fromEntries(ANALYSTS.map((a) => [a.id, a.name])), MARKET: '시장 데스크', TECHNICAL: '기술 데스크', FLOW: '수급 데스크', FUNDAMENTAL: '펀더멘털 데스크', EVENT: '공시·뉴스 데스크', RED_TEAM: '레드팀' };
const SIDE = { BULLISH: ['강세', 'bull'], BEARISH: ['약세', 'bear'], NEUTRAL: ['중립', 'mid'] } as const;
/** G-218: each stance in everyday words, shown next to 강세·약세 when plain explanations are on. */
const SIDE_PLAIN = { BULLISH: '오를 쪽', BEARISH: '내릴 쪽', NEUTRAL: '지켜보자' } as const;
/** G-218: what each committee member looks at, in everyday words (under the name when plain explanations are on). */
export const ROLE_PLAIN: Record<string, string> = {
  trend_momentum: '오르는 흐름이 이어지는지 봐요', mean_reversion: '너무 오르거나 내려서 되돌아올 때인지 봐요',
  wave_structure: '고점·저점이 그리는 모양과 꺾이는 자리를 봐요', volume_flow: '거래량과 외국인·기관이 사고파는 흐름을 봐요',
  fundamental: '회사가 버는 돈과 주가가 비싼지 싼지 봐요', event_catalyst: '공시·뉴스와 앞으로 있을 일정을 봐요',
  MARKET: '시장 전체와 비교해 이 종목이 강한지 봐요', TECHNICAL: '차트 지표와 가격 모양을 종합해요', FLOW: '누가 사고 누가 파는지 봐요',
  FUNDAMENTAL: '실적과 가치 평가를 봐요', EVENT: '공시와 뉴스를 봐요', RED_TEAM: '우세한 의견에 일부러 반대해 빈틈을 찾아요',
};

/** v4: the committee's own members argue their stances in turn, answering each other; the red team closes. */
export function debateSection(report: DailyReport, tail = ''): string {
  return renderCommitteeDebate(report.commentary,tail);
}
export function renderCommitteeDebate(c:Pick<Commentary,'status'|'debate'|'evidence'>|undefined,tail=''):string {
  if (c?.status !== 'OK' || !c.debate?.length) return '';
  const turns = c.debate;
  const byId = new Map(c.evidence.map((e) => [e.id, e]));
  const evChips = (ids: readonly string[]) => `<span class="ev-row">${ids.map((id) => { const e = byId.get(id); return e ? `<button type="button" class="ev-chip" data-label="${esc(e.label)}" data-url="${esc(e.url.startsWith('http') ? e.url : '')}">${esc(id)}</button>` : ''; }).join('')}</span>`;
  // G-136: a short preview on the page; the whole debate is a full-screen chat room (KakaoTalk-like) opened from it.
  const speakers = [...new Set(turns.map((t) => t.speaker))], sideOf = (t: (typeof turns)[number]) => (t.speaker === 'RED_TEAM' ? 'red' : SIDE[t.stance][1]);
  const initial = (sp: string) => (SPEAKER[sp] ?? sp).replace(/^(AI\s*)/, '').slice(0, 1);
  const avs = speakers.slice(0, 5).map((sp) => { const t = turns.find((x) => x.speaker === sp)!; return `<span class="db-av db-av-${sideOf(t)}">${esc(initial(sp))}</span>`; }).join('');
  const lines = turns.slice(-3).map((t) => `<span class="db-pv-l"><b>${esc(SPEAKER[t.speaker] ?? t.speaker)}</b>${esc(t.claim.text.length > 64 ? `${t.claim.text.slice(0, 64)}…` : t.claim.text)}</span>`).join('');
  return `<section class="block" id="debate"><div class="block-head"><h2>위원회 토론</h2><span class="muted small">위원 ${speakers.length}명 · 발언 ${turns.length}개</span></div>
<button type="button" class="card db-preview" data-room-open aria-haspopup="dialog" aria-controls="db-room"><span class="db-pv-top"><span class="db-avs">${avs}</span><span class="db-pv-n">위원회 토론방<small>위원 ${speakers.length}명이 ${turns.length}번 주고받았어요</small></span></span>${lines}<span class="db-pv-cta">토론방 입장 ›</span></button>
<div class="db-room" id="db-room" role="dialog" aria-modal="true" aria-label="위원회 토론방" hidden><header class="db-room-h"><button type="button" class="db-room-x" data-room-close aria-label="토론방 나가기">‹</button><div class="db-room-t"><b>위원회 토론방</b><small>위원 ${speakers.length}명 · 발언 ${turns.length}개</small></div><span class="db-head-r">${turns.some((t) => t.plain) ? '<button type="button" class="db-easy chip-toggle" data-easy-toggle aria-pressed="false">쉬운 말</button>' : ''}<button type="button" class="db-skip chip-toggle" hidden>전체 바로 보기</button><a class="db-ask-link" href="#join" aria-label="질문 입력창으로 이동">질문</a></span></header>
<div class="db-room-body"><div class="card debate"><div class="db-chips" role="group" aria-label="발언자 고르기"></div>
${turns.map((t, i) => {
    const red = t.speaker === 'RED_TEAM', side = red ? 'red' : SIDE[t.stance][1];
    // Reports written before the fix may count from 1 (a turn answering itself); the red team sums up, it does not reply.
    const at = red ? undefined : replyIndex(t.replyTo, i), to = at != null ? turns[at] : undefined;
    const quote = to && to.speaker !== t.speaker ? `<div class="db-quote"><b>${esc(SPEAKER[to.speaker] ?? to.speaker)}</b>${esc(to.claim.text.length > 46 ? `${to.claim.text.slice(0, 46)}…` : to.claim.text)}</div>` : '';
    return `<div class="db-turn db-${side}" data-speaker="${esc(t.speaker)}"${at != null ? ` data-reply="${at}"` : ''}><div class="db-who"><b>${esc(SPEAKER[t.speaker] ?? t.speaker)}</b>${red ? ' · 정리' : ` · ${SIDE[t.stance][0]}<span class="ez-only">(${SIDE_PLAIN[t.stance]})</span>`}${ROLE_PLAIN[t.speaker] ? `<span class="db-role ez-only">${esc(ROLE_PLAIN[t.speaker]!)}</span>` : ''}</div><div class="db-bubble">${quote}${kindChip(t.claim.kind)}${esc(t.claim.text)} ${evChips(t.claim.evidenceIds)}${t.plain ? `<span class="db-plain ez-only"><b>쉽게 말하면</b>${esc(t.plain)}</span>` : ''}</div></div>`;
  }).join('')}
<p class="fine db-room-note">말하는 위원은 위원회 표결의 분석가·데스크 그대로예요. 밑줄 친 말을 누르면 뜻이 나와요. 말 끝의 근거 번호를 누르면 그 근거가 펼쳐져요. 레드팀은 승패를 정하지 않아요.</p>${tail}</div></div></div></section>`;
}

/**
 * G-218: the committee in everyday words, at the top of the AI tab. The model's plain retelling (v8 reports),
 * then the vote and the odds counted from the report itself (every committee report has them, so older reports
 * get this card too), the words this report uses, and how the committee works. Hidden for "전문 용어 그대로".
 */
export function easyCard(c: Pick<Commentary, 'status' | 'easy' | 'analysts' | 'desks' | 'scenarios'> | undefined): string {
  if (c?.status !== 'OK') return '';
  const votes = [...(c.analysts ?? []).map((a) => a.stance), ...(c.desks ?? []).map((d) => d.stance).filter((x) => x !== 'INSUFFICIENT_DATA')];
  const n = (k: string) => votes.filter((v) => v === k).length;
  const up = n('BULLISH'), down = n('BEARISH'), mid = n('NEUTRAL');
  const lean = up > down + mid ? '오를 쪽으로 기울었어요' : down > up + mid ? '내릴 쪽으로 기울었어요' : up > down ? '조금 오를 쪽이지만 의견이 갈렸어요' : down > up ? '조금 내릴 쪽이지만 의견이 갈렸어요' : '한쪽으로 모이지 않았어요';
  const voteLine = votes.length ? `위원 ${votes.length}명 가운데 <b class="up">오를 쪽 ${up}명</b>, <b>지켜보자 ${mid}명</b>, <b class="down">내릴 쪽 ${down}명</b>이에요. 위원회 전체로는 ${lean}.` : '';
  const pr = (k: string) => c.scenarios?.find((x) => x.kind === k)?.probability;
  const oddsLine = typeof pr('BULL') === 'number' && typeof pr('BEAR') === 'number'
    ? `앞으로 20거래일(약 한 달) 동안 오르는 흐름 ${pr('BULL')}%, 지금과 비슷한 흐름 ${pr('BASE') ?? 0}%, 내리는 흐름 ${pr('BEAR')}%로 봤어요. 예보처럼 가능성을 나눈 것이고, 나중에 맞았는지 채점해요.` : '';
  if (!c.easy && !voteLine && !oddsLine) return '';
  const terms = c.easy?.terms ?? [];
  return `<section class="block ez-card" id="easy"><div class="card"><div class="head"><h2>쉽게 말하면</h2></div>
${c.easy ? `<p class="ez-sum">${esc(c.easy.summary)}</p>` : ''}${voteLine || oddsLine ? `<ul class="ez-facts">${voteLine ? `<li><span aria-hidden="true">🗳️</span><span>${voteLine}</span></li>` : ''}${oddsLine ? `<li><span aria-hidden="true">🌦️</span><span>${oddsLine}</span></li>` : ''}</ul>` : ''}
${terms.length ? `<div class="ez-terms"><div class="ez-k">이 리포트에 나온 말</div><dl>${terms.map((t) => `<div data-term-def="${esc(t.term)}"><dt>${esc(t.term)}</dt><dd>${esc(t.meaning)}</dd></div>`).join('')}</dl></div>` : ''}
<details class="ez-how"><summary>위원회는 이렇게 판단해요</summary><ul>
<li><b>분석가 6명</b>은 각자 보는 것이 달라요. 흐름, 되돌림, 가격 모양, 거래량·수급, 실적, 공시·뉴스를 하나씩 맡아요.</li>
<li><b>데스크 5곳</b>은 시장·차트·수급·실적·공시 자료를 분야별로 따로 판단해요.</li>
<li><b>레드팀</b>은 많은 위원이 고른 쪽에 일부러 반대해서 놓친 위험을 찾아요.</li>
<li>말마다 붙은 <span class="ck ck-FACT">사실</span>은 자료에 그대로 있는 것, <span class="ck ck-INFERENCE">해석</span>은 자료에서 읽어 낸 것, <span class="ck ck-ASSUMPTION">가정</span>은 아직 확인되지 않은 것이에요. 끝의 번호(P1, T1…)를 누르면 근거 자료가 나와요.</li>
<li><b>강세</b>는 오를 쪽, <b>약세</b>는 내릴 쪽, <b>중립</b>은 아직 방향을 정하지 않은 거예요. 확신도는 그 위원이 자기 판단을 얼마나 믿는지(0~100)예요.</li>
<li>다수결로 결론을 내지 않아요. 판단은 기록해 두고 20거래일 뒤 실제 가격으로 채점해요. 투자 권유가 아니에요.</li>
</ul></details></div></section>`;
}

/**
 * G-68: what the debate left open, after it: the red team's unresolved points, what would change the
 * reading, and the worst case with the reader's own checks. Not a second conclusion.
 */
export function issuesSection(report: DailyReport): string {
  const c = report.commentary;
  if (c?.status !== 'OK') return '';
  const open = c.redTeam?.unresolved ?? [], watch = c.watch ?? [];
  if (!open.length && !watch.length) return '';
  return `<section class="block" id="issues"><div class="block-head"><h2>남은 쟁점</h2><span class="muted">토론이 풀지 못한 것과 판단이 바뀔 조건 · 최악의 경우는 약세 시나리오 안에 있어요</span></div><div class="card issues">
${open.length ? `<div class="pl-k">아직 갈리는 점</div><ul class="plain is-open">${open.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
${watch.length ? `<div class="pl-k">이게 나오면 판단이 바뀌어요</div><ul class="plain is-watch">${watch.map((x) => `<li>${kindChip(x.kind)}${esc(x.text)}</li>`).join('')}</ul>` : ''}
</div></section>`;
}

/**
 * G-69: the debate plays like a chat the first time it scrolls into view: "작성 중…" with the next
 * speaker's name, then their message, one turn after another. Reduced motion or "전체 바로 보기" shows all.
 */
export const DEBATE_PLAY_SCRIPT = `<script>
(function(){
 // G-136: the chat room. Opening shows the whole debate full screen (KakaoTalk-like); every turn, the reader's
 // questions and the answers get a round avatar with the speaker's first letter.
 var avatar=function(room){room.querySelectorAll('.db-turn:not([data-av])').forEach(function(t){t.setAttribute('data-av','');var who=t.querySelector('.db-who b'),c=t.classList,side=c.contains('db-me')?'me':c.contains('db-red')?'red':c.contains('db-bull')?'bull':c.contains('db-bear')&&!c.contains('db-guest')?'bear':'mid';if(side==='me')return;var a=document.createElement('span');a.className='db-av db-av-'+side;a.setAttribute('aria-hidden','true');a.textContent=((who&&who.textContent)||'위').replace(/^AI\s*/,'').charAt(0);t.insertBefore(a,t.firstChild);});};
 document.addEventListener('click',function(e){
  var open=e.target.closest&&e.target.closest('[data-room-open]'),close=e.target.closest&&e.target.closest('[data-room-close]');
  if(open){var room=document.getElementById(open.getAttribute('aria-controls'));if(!room)return;avatar(room);room.hidden=false;document.documentElement.classList.add('layer-open');if(window.GNM_terms)GNM_terms(room);var x=room.querySelector('.db-room-x');if(x)x.focus({preventScroll:true});if(window.GNM_debate)window.GNM_debate();
   if(!room.dataset.watch){room.dataset.watch='1';new MutationObserver(function(){avatar(room);}).observe(room,{childList:true,subtree:true});}}
  if(close){var r=close.closest('.db-room');if(r){r.hidden=true;document.documentElement.classList.remove('layer-open');var b=document.querySelector('[data-room-open][aria-controls="'+r.id+'"]');if(b)b.focus({preventScroll:true});}}
 });
 document.addEventListener('keydown',function(e){if(e.key!=='Escape')return;var r=document.querySelector('.db-room:not([hidden])');if(r){var x=r.querySelector('[data-room-close]');if(x)x.click();}});
 // The room stays open until the reader closes it (‹, Escape or back). Anything else that hides or redraws it —
 // the AI tab repainted after a report update, a refresh after a question — opens it again where it was.
 var wanted=null;
 document.addEventListener('click',function(e){var o=e.target.closest&&e.target.closest('[data-room-open]'),c=e.target.closest&&e.target.closest('[data-room-close]');if(o)wanted=o.getAttribute('aria-controls');if(c)wanted=null;},true);
 var keepT=null;new MutationObserver(function(){if(!wanted||keepT)return;keepT=setTimeout(function(){keepT=null;var r=wanted&&document.getElementById(wanted);if(r&&r.hidden){avatar(r);r.hidden=false;document.documentElement.classList.add('layer-open');}},60);}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
 // G-92: about 2 s of "생각하는 중", the turn, then about 2 s before the next speaker.
 // Thinking Orbs for 1 s before each turn, then a 2 s pause to read it.
 var THINK=1000,GAP=2000;
 var play=function(box){
  if(!box||box.dataset.played)return;box.dataset.played='1';
  var turns=Array.prototype.slice.call(box.querySelectorAll('.db-turn:not(.db-guest):not(.db-typing)'));
  if(!turns.length)return;
  var skip=box.closest('#debate')&&box.closest('#debate').querySelector('.db-skip'),clock=null,hint=null,index=0,stopped=false;
  var finish=function(){stopped=true;clearTimeout(clock);if(hint)hint.remove();turns.forEach(function(t){t.hidden=false;});box.removeAttribute('aria-busy');if(skip)skip.hidden=true;};
  box.GNM_finishReplay=finish;box.setAttribute('aria-busy','true');turns.forEach(function(t){t.hidden=true;});
  if(skip){skip.hidden=false;skip.onclick=finish;}
  var next=function(){
   if(stopped)return;if(index>=turns.length){finish();return;}
   var turn=turns[index],who=turn.querySelector('.db-who b');
   // The speaker 'types' on their own side of the chat before the turn appears.
   hint=document.createElement('div');hint.className=turn.className.replace(/\bdb-(reveal|in)\b/g,'')+' db-typing db-think';hint.setAttribute('aria-hidden','true');hint.innerHTML='<div class="db-who"><b></b></div><div class="db-bubble"><div class="chat-progress">${ORBS.replace('data-orb=', 'data-size="44" data-orb=')}<span>생각 중…</span></div></div>';
   hint.querySelector('b').textContent=who?who.textContent:'위원';
   turn.before(hint);
   clock=setTimeout(function(){if(stopped)return;hint.remove();turn.hidden=false;turn.classList.add('db-reveal');if(turn.getBoundingClientRect().bottom>innerHeight)turn.scrollIntoView({block:'nearest',behavior:'smooth'});index++;clock=setTimeout(next,GAP);},THINK);
  };next();
 };
 var watch=function(){document.querySelectorAll('.card.debate:not([data-played])').forEach(function(box){
  if(!('IntersectionObserver' in window)){play(box);return;}
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting&&e.target.offsetHeight){io.disconnect();play(box);}});},{threshold:0,rootMargin:'0px 0px -45% 0px'});io.observe(box);
 });};
 window.GNM_debate=watch;watch();
})();
</script>`;

/**
 * G-80: pick who speaks. Chips list every speaker; the reader's view committee starts on (everyone in
 * '전체'). A shown turn that answers a hidden one brings that turn along, dimmed as context, so no
 * reply hangs in the air. The red team always speaks.
 */
export const DEBATE_FILTER_SCRIPT = `<script>
(function(){
 var all=function(){document.querySelectorAll('.card.debate').forEach(function(box){
  if(box.GNM_finishReplay)box.GNM_finishReplay();var chips=box.querySelector('.db-chips');if(chips)chips.remove();
  box.querySelectorAll('.db-full').forEach(function(fold){var summary=fold.querySelector('summary');if(summary)summary.remove();while(fold.firstChild)fold.before(fold.firstChild);fold.remove();});
  box.querySelectorAll('.db-turn:not(.db-typing)').forEach(function(turn){turn.hidden=false;turn.classList.remove('db-off','db-ctx');});
 });};
 window.GNM_debateFilter=all;window.addEventListener('gnm-persona',all);all();
})();
</script>`;

/** Tapping an evidence number under a debate turn opens what it is (and the source, when there is one). */
export const EVIDENCE_SCRIPT = `<script>
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('.ev-chip'); if (!b) return;
  var row = b.parentNode, pop = row.nextElementSibling && row.nextElementSibling.classList.contains('ev-pop') ? row.nextElementSibling : null;
  var same = pop && pop.getAttribute('data-for') === b.textContent;
  if (pop) pop.remove();
  [].forEach.call(row.querySelectorAll('.ev-chip'), function (x) { x.setAttribute('aria-expanded', 'false'); });
  if (same) return;
  var d = document.createElement('div'); d.className = 'ev-pop'; d.setAttribute('data-for', b.textContent);
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var url = b.getAttribute('data-url');
  var box = b.closest('.debate'), ev = box && box.querySelector('.db-ev');
  d.innerHTML = '<b>' + esc(b.textContent) + '</b> ' + esc(b.getAttribute('data-label')) + (url ? ' <a href="' + esc(url) + '" target="_blank" rel="noopener">원문 ›</a>' : '') + (ev ? ' <button type="button" class="ev-jump" data-ev="' + esc(b.textContent) + '">근거 정리에서 보기</button>' : '');
  row.parentNode.insertBefore(d, row.nextSibling); b.setAttribute('aria-expanded', 'true');
});
document.addEventListener('click', function (e) {
  var j = e.target.closest && e.target.closest('.ev-jump'); if (!j) return;
  var box = j.closest('.debate'), ev = box && box.querySelector('.db-ev'); if (!ev) return;
  ev.open = true;
  var li = ev.querySelector('[data-ev-id="' + j.getAttribute('data-ev') + '"]');
  [].forEach.call(ev.querySelectorAll('.ev-hit'), function (x) { x.classList.remove('ev-hit'); });
  if (li) { li.classList.add('ev-hit'); li.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
});
</script>`;

const INSIGHT_TAB: Record<InsightKey, string> = { technical: '기술', strategy: '전략', flow: '수급', fundamental: '펀더멘털', news: '뉴스·공시' };
/** v4: one AI line at the top of a report tab (Plus). Free visitors see where it would be. */
export function insightLine(report: DailyReport, key: InsightKey, base: string): string {
  const c = report.commentary, line = c?.status === 'OK' ? c.insights?.[key] : undefined;
  if (!line) return '';
  // G-172: only readers who can see it get the line; the locked teaser repeated on every tab and read like a stray tab.
  return `<div class="insight need-plus"><span class="ins-k">AI 한 줄 · ${INSIGHT_TAB[key]}</span>${kindChip(line.kind)}${esc(line.text)}</div>`;
}

export const EXTRAS_CSS = `.ez-only{display:none}html[data-explain=easy] .ez-only{display:inline}html[data-explain=easy] .db-role,html[data-explain=easy] .db-plain{display:block}html[data-explain=expert] .ez-card{display:none}
.db-role{font-weight:500;font-size:12px;color:var(--muted);margin-top:1px}.db-who .ez-only:not(.db-role){margin-left:3px}.db-plain{margin-top:8px;padding-top:7px;border-top:1px dashed var(--line-strong);font-size:14px;line-height:1.6}.db-plain b{display:block;font-size:12px;color:var(--accent-strong);margin-bottom:1px}
.db-easy[aria-pressed=true]{background:var(--btn-bg);color:var(--btn-fg);border-color:var(--btn-bg)}
.ez-card .card{border:1px solid var(--accent);background:linear-gradient(180deg,var(--soft),var(--surface))}.ez-sum{font-size:16px;line-height:1.75;margin:0 0 10px}.ez-facts{list-style:none;margin:0;padding:0;display:grid;gap:8px}.ez-facts li{display:flex;gap:8px;font-size:14.5px;line-height:1.65}.ez-facts li>span:first-child{flex:none}
.ez-terms{margin-top:12px}.ez-k{font-size:12.5px;font-weight:800;color:var(--muted);margin-bottom:4px}.ez-terms dl{margin:0;display:grid;gap:6px}.ez-terms dl>div{display:grid;grid-template-columns:minmax(72px,auto) minmax(0,1fr);gap:8px;font-size:14px;line-height:1.55}.ez-terms dt{font-weight:800}.ez-terms dd{margin:0;color:var(--fg2)}
.ez-how{margin-top:12px}.ez-how summary{cursor:pointer;font-weight:700;font-size:14px;color:var(--accent-strong)}.ez-how ul{margin:8px 0 0;padding-left:18px;display:grid;gap:6px;font-size:14px;line-height:1.65}
.term{display:inline;padding:0;margin:0;border:0;background:none;font:inherit;color:inherit;text-decoration:underline dotted color-mix(in srgb,var(--accent) 70%,transparent);text-underline-offset:3px;cursor:help}.term:hover,.term[aria-expanded=true]{color:var(--accent-strong)}
.df-dates{display:flex;align-items:center;flex-wrap:wrap;gap:4px 6px;font-size:13px;color:var(--muted);margin:0 0 10px}.df-dates a,.df-dates span,.df-dates b{white-space:nowrap}.df-dates b{color:var(--fg)}.df-dk{font-size:12px}.df-ar{margin:0 2px}.df-lead{font-size:17px;font-weight:800;line-height:1.45;margin:0 0 14px}.df-sec{margin-top:16px;padding-top:14px;border-top:1px solid var(--line)}.df-h{font-size:14px;font-weight:800;margin:0 0 8px}.df-h .muted{font-weight:600;margin-left:4px}.df-odds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.df-o{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid var(--line);border-radius:12px}.df-ok{font-size:12.5px;color:var(--muted);font-weight:700}.df-ov{display:flex;align-items:baseline;gap:6px;white-space:nowrap}.df-ov s{color:var(--muted);text-decoration:none;font-size:13px}.df-ov b{font-size:18px}.df-o small{font-size:12.5px;font-weight:700}.df-vrow{display:flex;align-items:center;gap:10px}.df-vk{flex:none;width:28px;font-size:12.5px;color:var(--muted);font-weight:700}.df-bar{flex:1;height:24px;margin:3px 0}.df-leg{display:flex;gap:12px;font-size:12px;margin:6px 0 0 38px}.df-flips,.df-stats{list-style:none;margin:0;padding:0}.df-flips li{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)}.df-flips li:last-child,.df-stats li:last-child{border-bottom:0}.df-who{min-width:0;font-size:14.5px}.df-chg{flex:none;display:inline-flex;align-items:center;gap:6px;font-size:14px;white-space:nowrap}.df-chg s{color:var(--muted);text-decoration:none}.df-chg b{font-weight:800}.df-stats li{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:'k p' 'v v';gap:2px 10px;padding:10px 0;border-bottom:1px solid var(--line)}.df-sk{grid-area:k;font-size:13.5px;color:var(--fg2)}.df-sv{grid-area:v;display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 8px}.df-sv s{color:var(--muted);text-decoration:none;font-size:13.5px;white-space:nowrap}.df-sv s::after{content:' →'}.df-sv b{font-size:16px;white-space:nowrap}.df-pill{grid-area:p;align-self:start;font-style:normal;font-size:12.5px;font-weight:800;padding:2px 8px;border-radius:999px;background:color-mix(in srgb,currentColor 12%,transparent);white-space:nowrap}.df-sum{margin-top:14px}@media(min-width:720px){.df-stats li{grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:'k v p';align-items:center}.df-sv{justify-content:flex-end}}
.db-preview{display:flex;flex-direction:column;gap:8px;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line);background:var(--surface)}.db-preview:hover{border-color:#b9cbea}.db-pv-top{display:flex;align-items:center;gap:10px}.db-avs{display:flex}.db-avs .db-av{margin-left:-8px;border:2px solid #fff}.db-avs .db-av:first-child{margin-left:0}.db-pv-n{display:flex;flex-direction:column;font-weight:800;font-size:15px}.db-pv-n small{font-weight:500;color:var(--muted);font-size:12.5px}.db-pv-l{display:block;font-size:13.5px;color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.db-pv-l b{color:var(--fg);margin-right:6px}.db-pv-cta{align-self:flex-end;font-weight:800;font-size:14px;color:var(--accent-strong)}
.db-av{flex:none;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:14px;font-size:14px;font-weight:800;color:#fff;background:var(--muted)}.db-av-bull{background:var(--up)}.db-av-bear{background:var(--accent)}.db-av-mid{background:var(--muted)}.db-av-red{background:#1f2937}
.db-room{position:fixed;inset:0;z-index:185;display:flex;flex-direction:column;background:var(--surface-solid)}.db-room[hidden]{display:none}.db-room-h{display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:calc(10px + env(safe-area-inset-top));background:var(--surface);border-bottom:1px solid var(--line)}.db-room-x{border:0;background:none;font-size:30px;line-height:1;width:36px;height:36px;cursor:pointer;color:var(--fg);border-radius:10px}.db-room-t{display:flex;flex-direction:column;flex:1;min-width:0}.db-room-t b{font-size:16px}.db-room-t small{font-size:12px;color:var(--muted)}
.db-room-body{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column}.db-room .card.debate{flex:1 0 auto;width:100%;max-width:760px;margin:0 auto;background:transparent;border:0;box-shadow:none;padding:12px 12px 0;gap:4px;display:flex;flex-direction:column}.db-room .db-join{margin-top:auto!important}html.layer-open .chat-fab{display:none}
.db-room .db-turn{display:grid;grid-template-columns:36px minmax(0,1fr);column-gap:8px;align-items:start;max-width:none;align-self:stretch;margin:8px 0}.db-room .db-turn+.db-turn[data-speaker]{margin-top:10px}.db-room .db-turn>.db-av{grid-row:1/span 2;width:36px;height:36px;border-radius:13px;font-size:13px}.db-room .db-turn>:not(.db-av){grid-column:2;justify-self:start}.db-room .db-who{font-size:12.5px;font-weight:600;color:var(--muted);margin:1px 0 5px;background:none}.db-room .db-who b{color:var(--fg)}.db-room .db-bubble{background:var(--soft)!important;border:0!important;border-radius:4px 18px 18px 18px;padding:10px 14px;max-width:min(78vw,560px);box-shadow:none;color:var(--fg);font-size:14.5px;line-height:1.65;word-break:keep-all;overflow-wrap:anywhere}.db-room .db-red .db-bubble{background:var(--warn-soft)!important;text-align:left}.db-room .db-guest .db-bubble,.db-room .db-answer .db-bubble{background:var(--accent-soft)!important}
.db-room .db-turn.db-me{grid-template-columns:minmax(0,1fr)}.db-room .db-turn.db-me>*{grid-column:1;justify-self:end}.db-room .db-turn.db-me .db-bubble{background:var(--accent)!important;color:#fff;border-radius:18px 4px 18px 18px}.db-room .db-turn.db-me .db-who{text-align:right}
.db-room .db-quote{background:var(--surface);border-radius:10px}.db-room .db-join textarea{resize:none}.db-room .db-chips{position:sticky;top:0;z-index:2;background:var(--surface-solid);margin:0 -12px;padding:8px 12px;border-bottom:1px solid var(--line)}.db-room .db-room-note{color:var(--muted);font-size:12px;text-align:center;margin:14px 8px 6px}.db-room .db-join{position:sticky;bottom:0;background:var(--surface-solid);max-width:none;margin:8px -12px 0;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line)}.db-room .db-typing .db-bubble{padding:8px 12px}.db-room .db-typing .chat-progress{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);min-height:0}.db-room .db-typing .orbs,.db-room .db-typing .orbs canvas{width:22px!important;height:22px!important}
@media (min-width:821px){.db-room{inset:24px max(24px,calc(50vw - 420px));border-radius:18px;overflow:hidden;box-shadow:0 0 0 100vmax rgba(10,20,35,.45),0 30px 80px rgba(10,20,40,.35)}}
.db-think{opacity:.9}.db-wait,.db-answer{align-self:flex-start;max-width:88%}.db-wait .db-bubble{display:inline-flex;min-width:0;background:var(--surface);border:1px solid var(--line);padding:6px 12px}.db-wait .chat-progress{min-height:0;font-size:13px;color:var(--fg2);gap:6px}.db-wait .chat-progress{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--fg2)}.db-wait .orbs,.db-wait .orbs canvas,.db-typing .orbs,.db-typing .orbs canvas{width:36px;height:36px;flex:none}.db-wait .stream-answer:not(:empty){margin-top:8px;white-space:pre-wrap;font-size:14px;line-height:1.6;color:var(--fg)}.db-answer .db-bubble{background:var(--accent-soft);border:1px solid #d9cdf7}.db-past{align-self:center;font-size:12px;font-weight:700;color:var(--muted);padding:8px 0 2px}.db-turn[hidden]{display:none!important}.db-play-wait{display:flex;align-items:center;gap:7px;padding:12px 4px;font-size:12px;color:var(--muted)}.db-reveal{animation:db-appear .22s ease-out}@keyframes db-appear{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.db-reveal{animation:none}}.card.debate{display:flex;flex-direction:column;gap:10px;background:var(--surface)}.worst ul{list-style:none;padding-left:0}.db-turn{display:flex;flex-direction:column;max-width:82%}.db-bull{align-self:flex-start}.db-bear{align-self:flex-end;align-items:flex-end}.db-mid,.db-red{align-self:center;max-width:92%;align-items:center}.db-to{font-weight:500;color:var(--muted)}
.db-head-r{display:flex;gap:8px;align-items:center}.db-ask-link{font-size:13px;font-weight:800;color:var(--accent-strong);text-decoration:none;border:1px solid var(--accent);border-radius:999px;padding:5px 11px;background:var(--surface)}.db-chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:4px}.db-chips-k{font-size:12px;font-weight:800;color:var(--muted);margin-right:2px}.db-chips button{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:4px 10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;color:var(--muted)}.db-chips button[aria-pressed=true]{background:var(--navy);border-color:var(--navy);color:#fff}.db-chips .db-all{border-style:dashed;color:var(--accent-strong)}.db-off{display:none!important}.db-ctx{opacity:.55}.db-ctx .db-who::after{content:' · 맥락';font-weight:600}.db-guest .db-bubble{background:var(--accent-soft);border:1px solid #d9cdf7}.db-guest .db-who b{color:#5b3fb0}.db-guest .md p{margin:4px 0}
.db-skip{border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:5px 11px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}.db-turn[hidden]{display:none}.db-in{animation:db-in .25s ease-out}@keyframes db-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.db-typing .db-bubble{display:flex;gap:4px;padding:12px 14px}.db-typing i{width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:db-dot 1s infinite}.db-typing i:nth-child(2){animation-delay:.15s}.db-typing i:nth-child(3){animation-delay:.3s}@keyframes db-dot{0%,80%,100%{opacity:.3;transform:none}40%{opacity:1;transform:translateY(-3px)}}.db-join{margin-top:14px;border-top:1px solid var(--line);padding-top:12px}.db-join h3{margin:0 0 8px;font-size:15px}
.db-who{font-size:11px;font-weight:700;color:var(--muted);margin:0 6px 3px}.db-bubble{border-radius:16px;padding:10px 13px;font-size:14px;line-height:1.6}.db-bull .db-bubble{background:var(--up-soft);border-bottom-left-radius:4px}.db-bear .db-bubble{background:var(--down-soft);border-bottom-right-radius:4px}.db-mid .db-bubble{background:var(--soft)}.db-red .db-bubble{background:var(--warn-soft);border:1px dashed #f1d9a6;text-align:center}
.ev-row{display:inline-flex;flex-wrap:wrap;gap:3px;margin-left:4px;vertical-align:1px}.ev-chip{border:1px solid var(--line-strong);background:var(--soft);border-radius:6px;font:inherit;font-size:11px;font-weight:700;color:var(--fg2);padding:0 5px;cursor:pointer}.ev-chip[aria-expanded=true]{background:var(--navy);color:var(--on-accent);border-color:var(--navy)}.ev-pop{margin-top:6px;font-size:12.5px;line-height:1.5;background:var(--surface-solid);border:1px solid var(--line);border-radius:8px;padding:6px 9px;color:var(--fg2)}.ev-pop a{font-weight:700}.ev-jump{border:0;background:none;color:var(--accent-strong);font:inherit;font-weight:700;cursor:pointer;padding:0;margin-left:4px}.db-ev{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}.db-ev>summary{cursor:pointer;font-weight:800;font-size:15px;list-style:none;display:flex;justify-content:space-between;align-items:center}.db-ev>summary::-webkit-details-marker{display:none}.db-ev>summary::after{content:'열기 ▾';font-size:12.5px;font-weight:700;color:var(--accent-strong)}.db-ev[open]>summary::after{content:'닫기 ▴'}.db-ev .sum{font-size:14.5px;line-height:1.65;margin:10px 0}.ev-hit{background:var(--warn-soft);border-radius:6px;transition:background .3s}.db-ev .evid{list-style:none;padding:0;font-size:13px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:2px 12px}.db-ev .evid li{padding:2px 4px;overflow-wrap:anywhere}.issues ul{list-style:none;padding-left:0}.issues .plain li{margin:4px 0}.issues .pl-k{margin-top:4px}.is-open li::before{content:'⇄ ';color:var(--muted)}.db-quote{border-left:3px solid var(--line-strong);background:var(--soft);border-radius:6px;padding:4px 8px;margin-bottom:6px;font-size:12px;color:var(--fg2);line-height:1.45}.db-quote b{display:block;font-size:11px;color:var(--fg2)}.worst{margin-top:8px;border-top:1px solid var(--line);padding-top:10px}.worst h3{margin:0 0 4px;font-size:15px;color:var(--up-strong)}
.insight{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;background:linear-gradient(90deg,var(--soft),var(--surface));border:1px solid var(--line);border-radius:12px;padding:10px 13px;margin-bottom:14px;font-size:14px}.ins-k{font-size:11px;font-weight:800;color:var(--accent-strong);background:var(--accent-soft);border-radius:6px;padding:1px 6px}
.ck{display:inline-block;font-size:10px;font-weight:700;border-radius:5px;padding:0 5px;margin-right:4px;vertical-align:1px}.ck-FACT{background:var(--good-soft);color:var(--good-strong)}.ck-INFERENCE{background:var(--accent-soft);color:var(--accent-strong)}.ck-ASSUMPTION{background:var(--warn-soft);color:var(--warn-strong)}`;
