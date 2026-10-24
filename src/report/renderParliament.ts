// The "parliament" (docs/DESIGN.md §3.5): every vote behind the report as a
// seat in a hemicycle — the 16 technical indicators, each backtested strategy,
// the AI analysts and desks. Seats are ordered by stance (강세 left, 약세
// right), so the wedges read like party blocs. Clicking a seat shows why it
// voted that way; chips highlight one faction. Pure rendering from the report.

import type { DailyReport } from './dailyReport.js';
import { analystName } from '../analysis/analysts.js';
import { basePosition, committeeOdds, reportBase } from '../analysis/baseOdds.js';
import { esc } from './html.js';
import { won } from './format.js';


export type Faction = 'ai' | 'desk' | 'strategy' | 'indicator';
export type Stance = 'bull' | 'neutral' | 'bear' | 'abstain';

export interface Seat {
  id: string;
  faction: Faction;
  name: string;
  stance: Stance;
  /** Short lines shown when the seat is selected. */
  lines: string[];
}

const FACTION_WORD: Record<Faction, string> = { ai: 'AI 분석가', desk: 'AI 데스크', strategy: '전략', indicator: '기술 지표' };
const STANCE_WORD: Record<Stance, string> = { bull: '강세', neutral: '중립', bear: '약세', abstain: '기권' };
const DESK_WORD = { MARKET: '시장', TECHNICAL: '기술', FLOW: '수급', FUNDAMENTAL: '펀더멘털', EVENT: '공시·뉴스' } as const;
const fromVote = (v: string | null | undefined): Stance => (v === 'BULLISH' ? 'bull' : v === 'BEARISH' ? 'bear' : v === 'NEUTRAL' ? 'neutral' : 'abstain');

export function seatsFor(report: DailyReport): Seat[] {
  const seats: Seat[] = [];
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  for (const a of c?.analysts ?? []) {
    const score = report.market?.analystBoard?.find((b) => b.analyst === a.analyst);
    const record = score && score.scored ? `지난 성적: 채점 ${score.scored}건, 방향 적중 ${Math.round(score.hitRate! * 100)}%${score.rank ? `, ${score.rank}위` : ''}` : '지난 성적: 아직 채점 전이에요(20거래일 뒤 채점).';
    seats.push({ id: `ai:${a.analyst}`, faction: 'ai', name: analystName(a.analyst, c?.sectorExpert), stance: fromVote(a.stance), lines: [`확신도 ${a.confidence}% · 20거래일 뒤 예상 ${won(a.target)}${a.invalidation ? ` · 종가 ${won(a.invalidation)}에 닿으면 틀렸다고 봐요` : ''}`, a.rationale.text, record, ...(c?.lockedAnalysts?.includes(a.analyst) ? ['위원회가 모이기 전에 다른 위원 의견을 모른 채 혼자 판단했고, 위원회는 이 판단을 바꾸지 않았어요.'] : [])] });
  }
  for (const d of c?.desks ?? []) {
    seats.push({ id: `desk:${d.desk}`, faction: 'desk', name: `${DESK_WORD[d.desk]} 데스크`, stance: d.stance === 'INSUFFICIENT_DATA' ? 'abstain' : fromVote(d.stance), lines: [d.view.text] });
  }
  for (const r of report.market?.arena?.results ?? []) {
    if (r.key === 'hold') continue;
    seats.push({
      id: `strategy:${r.key}`, faction: 'strategy', name: `${r.rank}위 ${r.name}`, stance: r.position ? 'bull' : 'neutral',
      lines: [r.position ? '규칙상 지금은 보유 구간이에요.' : '규칙상 지금은 관망 구간이에요.', r.rule, `검증 구간 수익 ${(r.oosReturn * 100).toFixed(1)}%`],
    });
  }
  for (const v of report.technicals?.votes ?? []) {
    seats.push({ id: `ind:${v.key}`, faction: 'indicator', name: v.label, stance: fromVote(v.vote), lines: [v.rule, ...(v.value === null ? ['기록이 모자라 기권했어요.'] : [])] });
  }
  return seats;
}

/** Seat centres for n seats over concentric arcs (unit radius), ordered left to right by angle. */
export function hemicycle(n: number): { x: number; y: number; r: number }[] {
  if (!n) return [];
  const rows = Math.min(n, n <= 16 ? 1 : n <= 36 ? 3 : n <= 64 ? 4 : 5);
  // The inner ring leaves room for the verdict in the middle.
  const inner = 0.52, outer = 1;
  const gap = rows > 1 ? (outer - inner) / (rows - 1) : 0;
  // One row (a small chamber) sits on the outer arc, leaving the middle for the verdict.
  const radii = rows === 1 ? [0.9] : Array.from({ length: rows }, (_, i) => inner + gap * i);
  const total = radii.reduce((s, r) => s + r, 0);
  // Seats per row in proportion to arc length; leftovers go to the outer rows.
  const counts = radii.map((r) => Math.max(1, Math.floor((n * r) / total)));
  let left = n - counts.reduce((s, k) => s + k, 0);
  for (let i = rows - 1; left > 0; i = (i - 1 + rows) % rows, left -= 1) counts[i]! += 1;
  // rows <= n, so some row always has a seat to give back; the guard is belt and braces.
  for (let i = 0, guard = 0; left < 0 && guard < rows * n; i = (i + 1) % rows, guard += 1) if (counts[i]! > 1) { counts[i]! -= 1; left += 1; }
  // As large as the tightest row and the row gap allow.
  const along = Math.min(...radii.map((r, i) => (counts[i]! > 1 ? (Math.PI * r) / (counts[i]! - 1) : 1)));
  // G-274: a small chamber (one row) uses a shorter arc so seats sit close and the bottom ends clear the tally.
  const span = rows === 1 ? (n <= 4 ? 0.5 : n <= 8 ? 0.62 : n <= 12 ? 0.78 : 0.9) : 1;
  const seatR = Math.min(along * span * 0.42, gap ? gap * 0.44 : 0.12, rows === 1 ? 0.13 : 0.11);
  const out: { x: number; y: number; r: number; a: number }[] = [];
  radii.forEach((rad, i) => {
    const k = counts[i]!;
    for (let j = 0; j < k; j += 1) {
      const a = k === 1 ? Math.PI / 2 : Math.PI / 2 + span * Math.PI * (0.5 - j / (k - 1));
      out.push({ x: rad * Math.cos(a), y: rad * Math.sin(a), r: seatR, a });
    }
  });
  return out.sort((p, q) => q.a - p.a || q.y - p.y).map(({ x, y, r }) => ({ x, y, r }));
}

const ORDER: Record<Stance, number> = { bull: 0, neutral: 1, abstain: 2, bear: 3 };
const FACTION_ORDER: Record<Faction, number> = { ai: 0, desk: 1, strategy: 2, indicator: 3 };

export interface ParliamentOptions {
  id?: string;
  title?: string;
  /** Only these factions sit (default: all). */
  factions?: readonly Faction[];
  link?: { href: string; label: string } | null;
  note?: string;
  /** List every member by name under the seats, grouped by stance (for small chambers). */
  roster?: boolean;
}

const MEMBER_KIND: Record<Faction, string> = { ai: '분석가', desk: '데스크', strategy: '전략', indicator: '지표' };

export function parliament(report: DailyReport, from: string | null, opts: ParliamentOptions = {}): string {
  const id = opts.id ?? 'parliament';
  const seats = seatsFor(report).filter((s) => !opts.factions || opts.factions.includes(s.faction)).sort((a, b) => ORDER[a.stance] - ORDER[b.stance] || FACTION_ORDER[a.faction] - FACTION_ORDER[b.faction]);
  if (!seats.length) return '';
  const pos = hemicycle(seats.length);
  const count = (s: Stance) => seats.filter((x) => x.stance === s).length;
  const bull = count('bull'), bear = count('bear'), neutral = count('neutral'), abstain = count('abstain');
  const voting = bull + bear + neutral;
  const lean = voting ? (bull - bear) / voting : 0;
  // A tally of votes, not a decision (BOT constitution §8: no majority-vote verdicts). The committee's conclusion is its own text.
  const verdict = lean >= 0.2 ? '강세 표가 많아요' : lean <= -0.2 ? '약세 표가 많아요' : '표가 엇갈려요';
  const W = 200, cx = 100, cy = 98, R = 92;
  const circles = seats.map((s, i) => {
    const p = pos[i]!;
    const x = (cx + p.x * R).toFixed(2), y = (cy - p.y * R).toFixed(2);
    return `<circle class="seat s-${s.stance} f-${s.faction}" data-i="${i}" data-f="${s.faction}" data-m="${esc(s.id.split(':')[1] ?? '')}" cx="${x}" cy="${y}" r="${(p.r * R).toFixed(2)}" style="--i:${i}" tabindex="0" role="button" aria-label="${esc(`${FACTION_WORD[s.faction]} ${s.name}: ${STANCE_WORD[s.stance]}`)}"><title>${esc(`${s.name} · ${STANCE_WORD[s.stance]}`)}</title></circle>`;
  }).join('');
  const factions = (['ai', 'desk', 'strategy', 'indicator'] as const).filter((f) => seats.some((s) => s.faction === f));
  const chips = `<button type="button" class="chip-toggle" data-pf="" aria-pressed="true">전체 ${seats.length}</button>${factions.map((f) => `<button type="button" class="chip-toggle" data-pf="${f}" aria-pressed="false">${FACTION_WORD[f]} ${seats.filter((s) => s.faction === f).length}</button>`).join('')}`;
  const data = JSON.stringify(seats.map((s) => ({ f: FACTION_WORD[s.faction], n: s.name, s: s.stance, w: STANCE_WORD[s.stance], l: s.lines }))).replace(/</g, '\\u003c');
  const summary = report.commentary?.status === 'OK' ? report.commentary.summary?.text : undefined;
  const link = opts.link === undefined ? { href: '#tab-ai', label: 'AI 위원회 자세히 ›' } : opts.link;
  const showChips = factions.length > 1;
  const center = `<div class="pl-center"><b class="${lean >= 0.2 ? 'up' : lean <= -0.2 ? 'down' : ''}">${verdict}</b><span><i class="dot s-bull"></i>${bull} <i class="dot s-neutral"></i>${neutral} <i class="dot s-bear"></i>${bear}${abstain ? ` <i class="dot s-abstain"></i>${abstain}` : ''}</span></div>`;
  // Roster: who voted which way, by name. Same indices as the seats, so either opens the same detail.
  const groups = (['bull', 'neutral', 'bear', 'abstain'] as const).filter((st) => st !== 'abstain' || abstain);
  const roster = opts.roster ? `<div class="pl-roster">${groups.map((st) => `<div class="pl-col"><div class="pl-col-h"><i class="dot s-${st}"></i>${STANCE_WORD[st]} <b>${count(st)}</b></div>${seats.map((x, i) => (x.stance === st ? `<button type="button" class="member s-${st}" data-i="${i}" data-f="${x.faction}"><span class="m-name">${esc(x.name)}</span><span class="m-kind">${MEMBER_KIND[x.faction]}</span></button>` : '')).join('') || '<span class="muted small">없음</span>'}</div>`).join('')}</div>` : '';
  const tally = voting ? `<div class="pl-tally" aria-hidden="true">${(['bull', 'neutral', 'bear'] as const).filter((st) => count(st)).map((st) => `<span class="s-${st}" style="flex:${count(st)}"></span>`).join('')}</div>` : '';
  return `<section class="block parliament${opts.roster ? ' pl-small' : ''}" id="${id}"><div class="block-head"><h2>${esc(opts.title ?? '표결 현황')}</h2>${link ? `<a href="${link.href}" class="more-link">${esc(link.label)}</a>` : ''}</div>
<div class="card pl-card"><div class="pl-main">
${showChips ? `<div class="pl-chips" role="group" aria-label="세력별 보기">${chips}</div>` : ''}
<div class="pl-figure"><svg viewBox="0 0 ${W} 104" class="pl-svg" role="group" aria-label="표결 의석 ${seats.length}석: 강세 ${bull}, 중립 ${neutral}, 약세 ${bear}${abstain ? `, 기권 ${abstain}` : ''}">${circles}</svg>
${center}</div>${opts.roster ? tally : ''}${roster}
<p class="fine">${esc(opts.note ?? '좌석 하나가 표 하나예요. 왼쪽부터 강세(빨강)·중립(회색)·약세(파랑) 순이고, 빈 원은 기권이에요. 표 분포는 결론이 아니에요. 좌석을 누르면 그렇게 본 이유가 나와요.')}</p></div>
<aside class="pl-detail" aria-live="polite">${summary ? `<div class="need-plus"><div class="pl-k">AI 위원회 결론</div><p>${esc(summary)}</p>${from ? `<div class="muted small">${esc(from)} 리포트의 해설이에요.</div>` : ''}</div><p class="muted only-free">표 분포는 결론이 아니에요. 위원회 결론은 플러스, 위원별 이유는 프로부터 볼 수 있어요. 지표·전략 좌석은 눌러서 이유를 볼 수 있어요.</p>` : '<p class="muted">좌석을 누르면 그 표의 이유가 여기에 나와요.</p>'}</aside></div>
<script type="application/json" class="pl-data">${data}</script></section>`;
}

export const PARLIAMENT_SCRIPT = `<script>
(function () {
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // Callable again for a parliament painted later (an on-demand report); each one is wired once.
  window.GNM_parliament = function () { document.querySelectorAll('.parliament').forEach(function (host) {
    var data = host.querySelector('.pl-data'), panel = host.querySelector('.pl-detail'); if (!data || !panel || host.dataset.plOn) return;
    host.dataset.plOn = '1';
    var seats = JSON.parse(data.textContent);
    var show = function (el) {
      var i = el.getAttribute('data-i');
      host.querySelectorAll('.is-on').forEach(function (x) { x.classList.remove('is-on'); });
      host.querySelectorAll('[data-i="' + i + '"]').forEach(function (x) { x.classList.add('is-on'); });
      var s = seats[Number(i)];
      // AI members' reasons are a Plus feature; who voted which way stays free.
      var plan = document.documentElement.getAttribute('data-plan');
      var locked = /^AI/.test(s.f) && (plan === 'free' || plan === 'plus');
      panel.innerHTML = '<div class="pl-k">' + esc(s.f) + '</div><div class="pl-name"><b>' + esc(s.n) + '</b><span class="badge pl-' + s.s + '">' + esc(s.w) + '</span></div>' + (locked ? '<p class="muted">이 위원의 확신도·예상가·근거는 프로부터 볼 수 있어요. <a href="' + (document.body.getAttribute('data-base') || '') + 'pricing.html">요금제 보기 ›</a></p>' : s.l.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join(''));
    };
    host.querySelectorAll('.seat, .member').forEach(function (el) {
      el.addEventListener('click', function () { show(el); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(el); } });
    });
    host.querySelectorAll('[data-pf]').forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-pf');
        host.querySelectorAll('[data-pf]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        host.querySelectorAll('.seat, .member').forEach(function (el) { el.classList.toggle('is-dim', !!f && el.getAttribute('data-f') !== f); });
      });
    });
  }); };
  window.GNM_parliament();
})();
</script>`;

/**
 * One line under the committee vote: a chance the price is higher in 20 sessions, the same for every reader.
 * G-264: for a Korean stock it starts from the statistical base (volatility, a recent one-day jump, the 52-week
 * high; fitted on ten years) and only the analysts who read earnings, filings and news move it, by at most
 * AI_CAP points; the Platt line refitted on scored committee numbers applies once it is active. Otherwise
 * (G-228) every analyst's call pooled in log-odds, skill-weighted once records are long enough.
 */
export function consensusNote(report: DailyReport): string {
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  const base = reportBase(report);
  const k = committeeOdds(base, c?.analysts ?? [], report.market?.analystBoard ?? [], report.market?.committeeCalibration);
  if (!k) return '';
  // G-268: ranking against the day's other stocks held up far better than calling a direction, so it leads.
  const pos = base != null ? basePosition(base) : null;
  const locked = c?.lockedAnalysts?.length ?? 0;
  // G-246: the statistical 80% range scored best in the hidden-future test; G-268: the position leads it.
  // G-274: three short label/value rows under the seats (the ring repeated the seat count, so it went); the how-it-was-made text folds away under one toggle.
  const f = report.market?.forecasts?.find((x) => x.horizon === 20);
  const how = k.basePct != null
    ? `오를 확률은 10년 과거 자료로 맞춘 통계 기준 ${k.basePct}%(변동성·최근 급등·52주 고가)에서 출발해, ${k.textN ? `실적·공시·뉴스를 읽은 위원 ${k.textN}명이 ${k.aiPts > 0 ? `+${k.aiPts}%p` : k.aiPts < 0 ? `${k.aiPts}%p` : '그대로'} ${k.aiPts ? '움직였어요' : '두었어요'}` : '글 근거를 읽은 위원이 없어 기준 그대로예요'}. 차트를 보는 위원 판단은 기준에 이미 들어 있어 숫자에 더하지 않아요${k.calibrated ? '. 지난 위원회 채점으로 한 번 더 맞췄어요' : ''}.`
    : `오를 확률은 ${k.weighted ? '지난 성적이 좋은 위원에게 더 무게를 둬' : k.prior ? '과거 데이터 시험(종목·날짜를 가린 1,000건)에서 순위를 잘 맞힌 위원에게 더 무게를 둬' : '위원마다 같은 무게로'} 확신도를 모은 값이에요.`;
  const row = (label: string, value: string, sub: string, cls = '') => `<div${cls ? ` class="${cls}"` : ''}><dt>${label}</dt><dd><b>${value}</b><small>${sub}</small></dd></div>`;
  const rows = [
    pos ? row('다른 종목과 비교', `${pos.label} <span class="pl-of">${pos.fifth + 1}/5</span>`, `이 묶음이 같은 날 평균보다 더 오른 비율 ${pos.beatPct}%${pos.fifth === 0 ? `, 평균보다 약 ${Math.abs(pos.excessPct).toFixed(1)}%p 덜 올랐어요` : ''}`) : '',
    f ? row('20거래일 뒤 가격 범위(80%)', `${won(f.p10)} ~ ${won(f.p90)}`, '과거 시험에서 열 번 중 여덟 번꼴로 이 안에 들었어요') : '',
    row(pos ? '오를 확률(참고)' : '위원회 종합', `약 ${k.upPct}%`, pos ? '방향은 맞히기 어려워 참고로만 보세요' : '20거래일 뒤 지금보다 높을 확률', pos ? 'pl-ref' : ''),
  ].join('');
  const detail = [
    pos ? '다른 종목과 비교는 10년 자료로 맞춘 점수(변동성·최근 급등·52주 고가)로 거래대금 상위 종목을 다섯 묶음으로 나눈 위치예요. 1/5이 가장 낮고 5/5가 가장 높아요. 비율은 2023년 이후 기록이에요.' : '',
    how, locked ? `${locked}명은 위원회 전에 혼자 판단했어요.` : '',
  ].filter(Boolean).map((t) => `<p>${t}</p>`).join('');
  return `<div class="pl-consensus"><dl class="pl-stats">${rows}</dl><details class="pl-how"><summary>어떻게 계산했나요</summary>${detail}</details><p class="fine">예측이지 권유가 아니에요.</p></div>`;
}
