// Report extras (docs/DESIGN.md §5.12, G-42): what changed since the last report, how a report's
// judgement was put together (a decision trace, from BOT constitution §9 and BOR Golden Trace),
// and claim-kind chips. Pure rendering from stored reports.

import type { DailyReport } from './dailyReport.js';
import { ANALYSTS } from '../analysis/analysts.js';
import { VIEW_FOCUS } from './conclusion.js';
import { replyIndex, type ClaimKind, type Commentary, type InsightKey } from '../analysis/commentary.js';

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`;
const pct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
const tone = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : '');

export const KIND_WORD: Record<ClaimKind, string> = { FACT: '사실', INFERENCE: '해석', ASSUMPTION: '가정' };
export const kindChip = (kind: ClaimKind | undefined) => (kind ? `<span class="ck ck-${kind}" title="${KIND_WORD[kind]}: ${kind === 'FACT' ? '근거에 그대로 있어요' : kind === 'INFERENCE' ? '근거에서 끌어낸 해석이에요' : '근거로 확인되지 않은 가정이에요'}">${KIND_WORD[kind]}</span>` : '');

const STANCE = { BULLISH: '강세', BEARISH: '약세', NEUTRAL: '중립', INSUFFICIENT_DATA: '근거 부족' } as const;
const DESK = { MARKET: '시장', TECHNICAL: '기술', FLOW: '수급', FUNDAMENTAL: '펀더멘털', EVENT: '공시·뉴스' } as const;

export interface WeekChange { label: string; before: string; after: string; tone?: string }

/** Differences between two reports: price, medium-term signal, fair value, committee stances and targets. */
export function weekChanges(cur: DailyReport, prev: DailyReport): WeekChange[] {
  const out: WeekChange[] = [];
  if (cur.price && prev.price) {
    const d = (cur.price.close / prev.price.close - 1) * 100;
    out.push({ label: '종가', before: won(prev.price.close), after: `${won(cur.price.close)} (${pct(d)})`, tone: tone(d) });
  }
  const mid = (r: DailyReport) => r.market?.horizons.find((h) => h.key === 'MEDIUM')?.summary.label;
  if (mid(cur) && mid(prev)) out.push({ label: '중기 기술 신호', before: mid(prev)!, after: mid(cur)! });
  const fv = (r: DailyReport) => r.market?.fairValue?.center;
  if (fv(cur) && fv(prev)) out.push({ label: '기술적 적정가 중심', before: won(fv(prev)!), after: `${won(fv(cur)!)} (${pct((fv(cur)! / fv(prev)! - 1) * 100)})` });
  const c = cur.commentary?.status === 'OK' ? cur.commentary : undefined, p = prev.commentary?.status === 'OK' ? prev.commentary : undefined;
  if (c && p) {
    for (const d of c.desks ?? []) {
      const before = p.desks?.find((x) => x.desk === d.desk);
      if (before && before.stance !== d.stance) out.push({ label: `${DESK[d.desk]} 데스크`, before: STANCE[before.stance], after: STANCE[d.stance], tone: d.stance === 'BULLISH' ? 'up' : d.stance === 'BEARISH' ? 'down' : '' });
    }
    const avg = (x: Commentary) => (x.analysts?.length ? x.analysts.reduce((s, a) => s + a.target, 0) / x.analysts.length : null);
    if (avg(c) && avg(p)) out.push({ label: '분석가 예상가 평균', before: won(avg(p)!), after: `${won(avg(c)!)} (${pct((avg(c)! / avg(p)! - 1) * 100)})` });
  }
  return out;
}

export function weekDiffSection(cur: DailyReport, prev: DailyReport | null): string {
  if (!prev) return `<section class="block" id="diff"><div class="block-head"><h2>지난 리포트 대비</h2></div><div class="card"><p class="empty">비교할 지난 리포트가 아직 없어요. 다음 주간 리포트부터 바뀐 점을 보여 드려요.</p></div></section>`;
  const rows = weekChanges(cur, prev);
  const cs = cur.commentary?.status === 'OK' ? cur.commentary.summary?.text : undefined, ps = prev.commentary?.status === 'OK' ? prev.commentary.summary?.text : undefined;
  return `<section class="block" id="diff"><div class="block-head"><h2>지난 리포트 대비</h2><span class="muted">${esc(prev.date)} → ${esc(cur.date)}</span></div><div class="card">
${rows.length ? `<table class="compact"><thead><tr><th>항목</th><th>지난 리포트</th><th>이번</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="muted">${esc(r.before)}</td><td class="${r.tone ?? ''}"><b>${esc(r.after)}</b></td></tr>`).join('')}</tbody></table>` : '<p class="empty">비교할 수 있는 항목이 없어요.</p>'}
${cs && ps && cs !== ps ? `<details class="more"><summary>위원회 결론 두 개 나란히 보기</summary><div class="grid-eq" style="margin-top:8px"><div><div class="pl-k">${esc(prev.date)}</div><p>${esc(ps)}</p></div><div><div class="pl-k">${esc(cur.date)}</div><p>${esc(cs)}</p></div></div></details>` : ''}
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
    ['AI', c ? `${c.status === 'OK' ? (c.tier === 'brief' ? '요약' : '위원회') : '해설 없음'} · ${c.servedBy ?? c.model} · 프롬프트 ${c.promptVersion}${c.usage ? ` · 입력 ${c.usage.inputTokens.toLocaleString('ko-KR')} / 출력 ${c.usage.outputTokens.toLocaleString('ko-KR')} 토큰` : ''}${c.error ? ` · ${c.error}` : ''}` : '없음'],
    ['주장 검증', c?.status === 'OK' ? `근거 ID가 없는 주장은 빼요(이번에 ${c.dropped}개)` : '—'],
    ['계산 방법', [m?.fairValue?.method, m?.forecasts[0]?.method, m?.arena?.method].filter(Boolean).join(' · ') || '—'],
  ];
  return `<section class="block" id="trace"><div class="block-head"><h2>이 판단을 만든 입력</h2><span class="muted">판단 재구성</span></div><div class="card"><table class="compact"><tbody>${rows.map(([k, v]) => `<tr><th style="width:22%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
<p class="fine">같은 입력과 같은 방법 버전이면 같은 계산이 나와요. AI 해설은 입력·모델·프롬프트 버전을 함께 남겨요.</p></div></section>`;
}

const SPEAKER: Record<string, string> = { ...Object.fromEntries(ANALYSTS.map((a) => [a.id, a.name])), MARKET: '시장 데스크', TECHNICAL: '기술 데스크', FLOW: '수급 데스크', FUNDAMENTAL: '펀더멘털 데스크', EVENT: '공시·뉴스 데스크', RED_TEAM: '레드팀' };
const SIDE = { BULLISH: ['강세', 'bull'], BEARISH: ['약세', 'bear'], NEUTRAL: ['중립', 'mid'] } as const;

/** v4: the committee's own members argue their stances in turn, answering each other; the red team closes. */
export function debateSection(report: DailyReport, tail = ''): string {
  const c = report.commentary;
  if (c?.status !== 'OK' || !c.debate?.length) return '';
  const turns = c.debate;
  const byId = new Map(c.evidence.map((e) => [e.id, e]));
  const evChips = (ids: readonly string[]) => `<span class="ev-row">${ids.map((id) => { const e = byId.get(id); return e ? `<button type="button" class="ev-chip" data-label="${esc(e.label)}" data-url="${esc(e.url.startsWith('http') ? e.url : '')}">${esc(id)}</button>` : ''; }).join('')}</span>`;
  return `<section class="block" id="debate"><div class="block-head"><h2>위원회 토론</h2><button type="button" class="db-skip" hidden>전체 바로 보기</button></div><div class="card debate"><div class="db-chips" role="group" aria-label="발언자 고르기"></div>
${turns.map((t, i) => {
    const red = t.speaker === 'RED_TEAM', side = red ? 'red' : SIDE[t.stance][1];
    // Reports written before the fix may count from 1 (a turn answering itself); the red team sums up, it does not reply.
    const at = red ? undefined : replyIndex(t.replyTo, i), to = at != null ? turns[at] : undefined;
    const quote = to && to.speaker !== t.speaker ? `<div class="db-quote"><b>${esc(SPEAKER[to.speaker] ?? to.speaker)}</b>${esc(to.claim.text.length > 46 ? `${to.claim.text.slice(0, 46)}…` : to.claim.text)}</div>` : '';
    return `<div class="db-turn db-${side}" data-speaker="${esc(t.speaker)}"${at != null ? ` data-reply="${at}"` : ''}><div class="db-who"><b>${esc(SPEAKER[t.speaker] ?? t.speaker)}</b>${red ? ' · 정리' : ` · ${SIDE[t.stance][0]}`}</div><div class="db-bubble">${quote}${kindChip(t.claim.kind)}${esc(t.claim.text)} ${evChips(t.claim.evidenceIds)}</div></div>`;
  }).join('')}
<p class="fine">말하는 위원은 위 표결의 분석가·데스크 그대로예요. 말 끝의 근거 번호를 누르면 그 근거가 펼쳐져요. 레드팀은 승패를 정하지 않아요.</p>${tail}</div></section>`;
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
(function () {
  var play = function (box) {
    if (!box || box.getAttribute('data-played')) return; box.setAttribute('data-played', '1');
    var turns = [].slice.call(box.querySelectorAll('.db-turn')).filter(function (t) { return !t.classList.contains('db-off'); });
    if (turns.length < 2 || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var sec = box.closest('section'), skip = sec && sec.querySelector('.db-skip'), done = false, timer = 0;
    turns.forEach(function (t) { t.hidden = true; });
    var typing = document.createElement('div'); typing.className = 'db-turn db-typing';
    var finish = function () { done = true; clearTimeout(timer); typing.remove(); turns.forEach(function (t) { t.hidden = false; }); if (skip) skip.hidden = true; };
    if (skip) { skip.hidden = false; skip.onclick = finish; }
    var i = 0;
    var next = function () {
      if (done) return;
      if (i >= turns.length) return finish();
      var t = turns[i], who = t.querySelector('.db-who b');
      typing.className = 'db-turn db-typing ' + (t.className.match(/db-(bull|bear|mid|red)/) || [''])[0];
      typing.innerHTML = '<div class="db-who"><b>' + (who ? who.textContent : '') + '</b> 작성 중…</div><div class="db-bubble"><i></i><i></i><i></i></div>';
      t.parentNode.insertBefore(typing, t);
      timer = setTimeout(function () { typing.remove(); t.hidden = false; t.classList.add('db-in'); i += 1; timer = setTimeout(next, 450); }, Math.min(1800, 500 + (t.textContent || '').length * 9));
    };
    next();
  };
  var watch = function () {
    var box = document.querySelector('.card.debate:not([data-played])'); if (!box) return;
    if (!('IntersectionObserver' in window)) return;
    // Start only when the debate's top has come up to the middle of the screen, so the reader sees it play.
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && e.target.offsetHeight) { io.disconnect(); play(e.target); } }); }, { threshold: 0, rootMargin: '0px 0px -55% 0px' });
    io.observe(box);
  };
  window.GNM_debate = watch;
  watch();
})();
</script>`;

/**
 * G-80: pick who speaks. Chips list every speaker; the reader's view committee starts on (everyone in
 * '전체'). A shown turn that answers a hidden one brings that turn along, dimmed as context, so no
 * reply hangs in the air. The red team always speaks.
 */
export const DEBATE_FILTER_SCRIPT = `<script>
(function () {
  var FOCUS = ${JSON.stringify(VIEW_FOCUS)}, pick = null;
  var apply = function (box) {
    var turns = [].slice.call(box.querySelectorAll('.db-turn:not(.db-typing):not(.db-guest)'));
    var chips = box.querySelector('.db-chips'); if (!chips || !turns.length) return;
    var view = document.documentElement.getAttribute('data-persona') || 'swing', focus = FOCUS[view];
    var speakers = [], names = {};
    turns.forEach(function (t) { var s = t.getAttribute('data-speaker'); if (s === 'RED_TEAM' || names[s]) return; names[s] = (t.querySelector('.db-who b') || {}).textContent || s; speakers.push(s); });
    if (!pick) { pick = {}; speakers.forEach(function (s) { pick[s] = !focus || focus.indexOf(s) >= 0; }); if (!speakers.some(function (s) { return pick[s]; })) speakers.forEach(function (s) { pick[s] = true; }); }
    chips.innerHTML = '<span class="db-chips-k">발언자</span>' + speakers.map(function (s) { return '<button type="button" data-sp="' + s + '" aria-pressed="' + !!pick[s] + '">' + names[s] + '</button>'; }).join('') + '<button type="button" data-sp="*" class="db-all">모두</button>';
    var on = turns.map(function (t) { var s = t.getAttribute('data-speaker'); return s === 'RED_TEAM' || !!pick[s]; }), ctx = turns.map(function () { return false; });
    turns.forEach(function (t, i) { var r = t.getAttribute('data-reply'); if (on[i] && r != null && !on[Number(r)]) ctx[Number(r)] = true; });
    turns.forEach(function (t, i) { t.classList.toggle('db-off', !on[i] && !ctx[i]); t.classList.toggle('db-ctx', !on[i] && ctx[i]); });
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.db-chips [data-sp]'); if (!b) return;
    var box = b.closest('.debate'), s = b.getAttribute('data-sp');
    if (s === '*') Object.keys(pick).forEach(function (k) { pick[k] = true; }); else pick[s] = !pick[s];
    apply(box);
  });
  var all = function () { [].forEach.call(document.querySelectorAll('.card.debate'), apply); };
  window.addEventListener('gnm-persona', function () { pick = null; all(); });
  window.GNM_debateFilter = all;
  all();
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
  return `<div class="insight need-plus"><span class="ins-k">AI 한 줄 · ${INSIGHT_TAB[key]}</span>${kindChip(line.kind)}${esc(line.text)}</div><div class="insight only-free"><span class="ins-k">AI 한 줄</span><span class="muted">탭마다 AI 한 줄 코멘트는 <a href="${base}pricing.html">플러스</a>부터 보여요.</span></div>`;
}

export const EXTRAS_CSS = `.card.debate{display:flex;flex-direction:column;gap:10px;background:#fff}.worst ul{list-style:none;padding-left:0}.db-turn{display:flex;flex-direction:column;max-width:82%}.db-bull{align-self:flex-start}.db-bear{align-self:flex-end;align-items:flex-end}.db-mid,.db-red{align-self:center;max-width:92%;align-items:center}.db-to{font-weight:500;color:var(--muted)}
.db-chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:4px}.db-chips-k{font-size:12px;font-weight:800;color:var(--muted);margin-right:2px}.db-chips button{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:4px 10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;color:var(--muted)}.db-chips button[aria-pressed=true]{background:var(--navy);border-color:var(--navy);color:#fff}.db-chips .db-all{border-style:dashed;color:var(--accent-strong)}.db-off{display:none!important}.db-ctx{opacity:.55}.db-ctx .db-who::after{content:' · 맥락';font-weight:600}.db-guest .db-bubble{background:#f3efff;border:1px solid #d9cdf7}.db-guest .db-who b{color:#5b3fb0}.db-guest .md p{margin:4px 0}
.db-skip{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:5px 11px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}.db-turn[hidden]{display:none}.db-in{animation:db-in .25s ease-out}@keyframes db-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.db-typing .db-bubble{display:flex;gap:4px;padding:12px 14px}.db-typing i{width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:db-dot 1s infinite}.db-typing i:nth-child(2){animation-delay:.15s}.db-typing i:nth-child(3){animation-delay:.3s}@keyframes db-dot{0%,80%,100%{opacity:.3;transform:none}40%{opacity:1;transform:translateY(-3px)}}.db-join{margin-top:14px;border-top:1px solid var(--line);padding-top:12px}.db-join h3{margin:0 0 8px;font-size:15px}
.db-who{font-size:11px;font-weight:700;color:var(--muted);margin:0 6px 3px}.db-bubble{border-radius:16px;padding:10px 13px;font-size:14px;line-height:1.6}.db-bull .db-bubble{background:#fde8e6;border-bottom-left-radius:4px}.db-bear .db-bubble{background:#e3ecfb;border-bottom-right-radius:4px}.db-mid .db-bubble{background:#f1f3f6}.db-red .db-bubble{background:#fff7e6;border:1px dashed #f1d9a6;text-align:center}
.ev-row{display:inline-flex;flex-wrap:wrap;gap:3px;margin-left:4px;vertical-align:1px}.ev-chip{border:1px solid rgba(15,23,42,.18);background:rgba(255,255,255,.7);border-radius:6px;font:inherit;font-size:11px;font-weight:700;color:#475569;padding:0 5px;cursor:pointer}.ev-chip[aria-expanded=true]{background:var(--navy);color:#fff;border-color:var(--navy)}.ev-pop{margin-top:6px;font-size:12.5px;line-height:1.5;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 9px;color:var(--fg2)}.ev-pop a{font-weight:700}.ev-jump{border:0;background:none;color:var(--accent-strong);font:inherit;font-weight:700;cursor:pointer;padding:0;margin-left:4px}.db-ev{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}.db-ev>summary{cursor:pointer;font-weight:800;font-size:15px;list-style:none;display:flex;justify-content:space-between;align-items:center}.db-ev>summary::-webkit-details-marker{display:none}.db-ev>summary::after{content:'열기 ▾';font-size:12.5px;font-weight:700;color:var(--accent-strong)}.db-ev[open]>summary::after{content:'닫기 ▴'}.db-ev .sum{font-size:14.5px;line-height:1.65;margin:10px 0}.ev-hit{background:#fff3c4;border-radius:6px;transition:background .3s}.db-ev .evid{list-style:none;padding:0;font-size:13px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:2px 12px}.db-ev .evid li{padding:2px 4px;overflow-wrap:anywhere}.issues ul{list-style:none;padding-left:0}.issues .plain li{margin:4px 0}.issues .pl-k{margin-top:4px}.is-open li::before{content:'⇄ ';color:var(--muted)}.db-quote{border-left:3px solid rgba(15,23,42,.25);background:rgba(255,255,255,.55);border-radius:6px;padding:4px 8px;margin-bottom:6px;font-size:12px;color:#475569;line-height:1.45}.db-quote b{display:block;font-size:11px;color:#334155}.worst{margin-top:8px;border-top:1px solid var(--line);padding-top:10px}.worst h3{margin:0 0 4px;font-size:15px;color:#9b1c1c}
.insight{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;background:linear-gradient(90deg,#eef3fb,#fff);border:1px solid #d7e2f3;border-radius:12px;padding:10px 13px;margin-bottom:14px;font-size:14px}.ins-k{font-size:11px;font-weight:800;color:#1d3a6e;background:#dfe8f6;border-radius:6px;padding:1px 6px}
.ck{display:inline-block;font-size:10px;font-weight:700;border-radius:5px;padding:0 5px;margin-right:4px;vertical-align:1px}.ck-FACT{background:#e7f5ec;color:#1d6b3a}.ck-INFERENCE{background:#e8eef7;color:#1d3a6e}.ck-ASSUMPTION{background:#fff3d6;color:#7a4a00}`;
