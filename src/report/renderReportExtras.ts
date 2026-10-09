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
    ['AI', c ? `${c.status === 'OK' ? (c.tier === 'brief' ? '간단 해설(이전)' : '위원회') : '해설 없음'} · ${c.servedBy ?? c.model} · 프롬프트 ${c.promptVersion}${c.usage ? ` · 입력 ${c.usage.inputTokens.toLocaleString('ko-KR')} / 출력 ${c.usage.outputTokens.toLocaleString('ko-KR')} 토큰` : ''}${c.error ? ` · ${c.error}` : ''}` : '없음'],
    ['주장 검증', c?.status === 'OK' ? `근거 ID가 없는 주장은 빼요(이번에 ${c.dropped}개)` : '—'],
    ['계산 방법', [m?.fairValue?.method, m?.forecasts[0]?.method, m?.arena?.method].filter(Boolean).join(' · ') || '—'],
  ];
  return `<section class="block" id="trace"><div class="block-head"><h2>이 판단을 만든 입력</h2><span class="muted">판단 재구성</span></div><div class="card"><table class="compact"><tbody>${rows.map(([k, v]) => `<tr><th style="width:22%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
<p class="fine">같은 입력과 같은 방법 버전이면 같은 계산이 나와요. AI 해설은 입력·모델·프롬프트 버전을 함께 남겨요.</p></div></section>`;
}

export const SPEAKER: Record<string, string> = { ...Object.fromEntries(ANALYSTS.map((a) => [a.id, a.name])), MARKET: '시장 데스크', TECHNICAL: '기술 데스크', FLOW: '수급 데스크', FUNDAMENTAL: '펀더멘털 데스크', EVENT: '공시·뉴스 데스크', RED_TEAM: '레드팀' };
const SIDE = { BULLISH: ['강세', 'bull'], BEARISH: ['약세', 'bear'], NEUTRAL: ['중립', 'mid'] } as const;

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
<div class="db-room" id="db-room" role="dialog" aria-modal="true" aria-label="위원회 토론방" hidden><header class="db-room-h"><button type="button" class="db-room-x" data-room-close aria-label="토론방 나가기">‹</button><div class="db-room-t"><b>위원회 토론방</b><small>위원 ${speakers.length}명 · 발언 ${turns.length}개</small></div><span class="db-head-r"><button type="button" class="db-skip chip-toggle" hidden>전체 바로 보기</button><a class="db-ask-link" href="#join" aria-label="질문 입력창으로 이동">질문</a></span></header>
<div class="db-room-body"><div class="card debate"><div class="db-chips" role="group" aria-label="발언자 고르기"></div>
${turns.map((t, i) => {
    const red = t.speaker === 'RED_TEAM', side = red ? 'red' : SIDE[t.stance][1];
    // Reports written before the fix may count from 1 (a turn answering itself); the red team sums up, it does not reply.
    const at = red ? undefined : replyIndex(t.replyTo, i), to = at != null ? turns[at] : undefined;
    const quote = to && to.speaker !== t.speaker ? `<div class="db-quote"><b>${esc(SPEAKER[to.speaker] ?? to.speaker)}</b>${esc(to.claim.text.length > 46 ? `${to.claim.text.slice(0, 46)}…` : to.claim.text)}</div>` : '';
    return `<div class="db-turn db-${side}" data-speaker="${esc(t.speaker)}"${at != null ? ` data-reply="${at}"` : ''}><div class="db-who"><b>${esc(SPEAKER[t.speaker] ?? t.speaker)}</b>${red ? ' · 정리' : ` · ${SIDE[t.stance][0]}`}</div><div class="db-bubble">${quote}${kindChip(t.claim.kind)}${esc(t.claim.text)} ${evChips(t.claim.evidenceIds)}</div></div>`;
  }).join('')}
<p class="fine db-room-note">말하는 위원은 위원회 표결의 분석가·데스크 그대로예요. 말 끝의 근거 번호를 누르면 그 근거가 펼쳐져요. 레드팀은 승패를 정하지 않아요.</p>${tail}</div></div></div></section>`;
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
  if(open){var room=document.getElementById(open.getAttribute('aria-controls'));if(!room)return;avatar(room);room.hidden=false;document.documentElement.classList.add('layer-open');var x=room.querySelector('.db-room-x');if(x)x.focus({preventScroll:true});if(window.GNM_debate)window.GNM_debate();
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
  return `<div class="insight need-plus"><span class="ins-k">AI 한 줄 · ${INSIGHT_TAB[key]}</span>${kindChip(line.kind)}${esc(line.text)}</div><div class="insight only-free"><span class="ins-k">AI 한 줄</span><span class="muted">탭마다 AI 한 줄 코멘트는 <a href="${base}pricing.html">플러스</a>부터 보여요.</span></div>`;
}

export const EXTRAS_CSS = `.db-preview{display:flex;flex-direction:column;gap:8px;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;border:1px solid var(--line);background:#fff}.db-preview:hover{border-color:#b9cbea}.db-pv-top{display:flex;align-items:center;gap:10px}.db-avs{display:flex}.db-avs .db-av{margin-left:-8px;border:2px solid #fff}.db-avs .db-av:first-child{margin-left:0}.db-pv-n{display:flex;flex-direction:column;font-weight:800;font-size:15px}.db-pv-n small{font-weight:500;color:var(--muted);font-size:12.5px}.db-pv-l{display:block;font-size:13.5px;color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.db-pv-l b{color:var(--fg);margin-right:6px}.db-pv-cta{align-self:flex-end;font-weight:800;font-size:14px;color:var(--accent-strong)}
.db-av{flex:none;display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:14px;font-size:14px;font-weight:800;color:#fff;background:#8796ab}.db-av-bull{background:#e5484d}.db-av-bear{background:#3e63dd}.db-av-mid{background:#8796ab}.db-av-red{background:#1f2937}
.db-room{position:fixed;inset:0;z-index:185;display:flex;flex-direction:column;background:#fff}.db-room[hidden]{display:none}.db-room-h{display:flex;align-items:center;gap:8px;padding:10px 12px;padding-top:calc(10px + env(safe-area-inset-top));background:#fff;border-bottom:1px solid var(--line)}.db-room-x{border:0;background:none;font-size:30px;line-height:1;width:36px;height:36px;cursor:pointer;color:#1f2937;border-radius:10px}.db-room-t{display:flex;flex-direction:column;flex:1;min-width:0}.db-room-t b{font-size:16px}.db-room-t small{font-size:12px;color:var(--muted)}
.db-room-body{flex:1;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column}.db-room .card.debate{flex:1 0 auto;width:100%;max-width:760px;margin:0 auto;background:transparent;border:0;box-shadow:none;padding:12px 12px 0;gap:4px;display:flex;flex-direction:column}.db-room .db-join{margin-top:auto!important}html.layer-open .chat-fab{display:none}
.db-room .db-turn{display:grid;grid-template-columns:36px minmax(0,1fr);column-gap:8px;align-items:start;max-width:none;align-self:stretch;margin:8px 0}.db-room .db-turn+.db-turn[data-speaker]{margin-top:10px}.db-room .db-turn>.db-av{grid-row:1/span 2;width:36px;height:36px;border-radius:13px;font-size:13px}.db-room .db-turn>:not(.db-av){grid-column:2;justify-self:start}.db-room .db-who{font-size:12.5px;font-weight:600;color:var(--muted);margin:1px 0 5px;background:none}.db-room .db-who b{color:var(--fg)}.db-room .db-bubble{background:#f2f4f6!important;border:0!important;border-radius:4px 18px 18px 18px;padding:10px 14px;max-width:min(78vw,560px);box-shadow:none;color:#191f28;font-size:14.5px;line-height:1.65;word-break:keep-all;overflow-wrap:anywhere}.db-room .db-red .db-bubble{background:#fff8e8!important;text-align:left}.db-room .db-guest .db-bubble,.db-room .db-answer .db-bubble{background:#f3efff!important}
.db-room .db-turn.db-me{grid-template-columns:minmax(0,1fr)}.db-room .db-turn.db-me>*{grid-column:1;justify-self:end}.db-room .db-turn.db-me .db-bubble{background:var(--accent)!important;color:#fff;border-radius:18px 4px 18px 18px}.db-room .db-turn.db-me .db-who{text-align:right}
.db-room .db-quote{background:#fff;border-radius:10px}.db-room .db-join textarea{resize:none}.db-room .db-chips{position:sticky;top:0;z-index:2;background:#fff;margin:0 -12px;padding:8px 12px;border-bottom:1px solid var(--line)}.db-room .db-room-note{color:var(--muted);font-size:12px;text-align:center;margin:14px 8px 6px}.db-room .db-join{position:sticky;bottom:0;background:#fff;max-width:none;margin:8px -12px 0;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--line)}.db-room .db-typing .db-bubble{padding:8px 12px}.db-room .db-typing .chat-progress{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);min-height:0}.db-room .db-typing .orbs,.db-room .db-typing .orbs canvas{width:22px!important;height:22px!important}
@media (min-width:821px){.db-room{inset:24px max(24px,calc(50vw - 420px));border-radius:18px;overflow:hidden;box-shadow:0 0 0 100vmax rgba(10,20,35,.45),0 30px 80px rgba(10,20,40,.35)}}
.db-think{opacity:.9}.db-wait,.db-answer{align-self:flex-start;max-width:88%}.db-wait .db-bubble{display:inline-flex;min-width:0;background:#fff;border:1px solid var(--line);padding:6px 12px}.db-wait .chat-progress{min-height:0;font-size:13px;color:var(--fg2);gap:6px}.db-wait .chat-progress{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--fg2)}.db-wait .orbs,.db-wait .orbs canvas,.db-typing .orbs,.db-typing .orbs canvas{width:36px;height:36px;flex:none}.db-wait .stream-answer:not(:empty){margin-top:8px;white-space:pre-wrap;font-size:14px;line-height:1.6;color:var(--fg)}.db-answer .db-bubble{background:#f3efff;border:1px solid #d9cdf7}.db-past{align-self:center;font-size:12px;font-weight:700;color:var(--muted);padding:8px 0 2px}.db-turn[hidden]{display:none!important}.db-play-wait{display:flex;align-items:center;gap:7px;padding:12px 4px;font-size:12px;color:var(--muted)}.db-reveal{animation:db-appear .22s ease-out}@keyframes db-appear{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.db-reveal{animation:none}}.card.debate{display:flex;flex-direction:column;gap:10px;background:#fff}.worst ul{list-style:none;padding-left:0}.db-turn{display:flex;flex-direction:column;max-width:82%}.db-bull{align-self:flex-start}.db-bear{align-self:flex-end;align-items:flex-end}.db-mid,.db-red{align-self:center;max-width:92%;align-items:center}.db-to{font-weight:500;color:var(--muted)}
.db-head-r{display:flex;gap:8px;align-items:center}.db-ask-link{font-size:13px;font-weight:800;color:var(--accent-strong);text-decoration:none;border:1px solid var(--accent);border-radius:999px;padding:5px 11px;background:#fff}.db-chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:4px}.db-chips-k{font-size:12px;font-weight:800;color:var(--muted);margin-right:2px}.db-chips button{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:4px 10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;color:var(--muted)}.db-chips button[aria-pressed=true]{background:var(--navy);border-color:var(--navy);color:#fff}.db-chips .db-all{border-style:dashed;color:var(--accent-strong)}.db-off{display:none!important}.db-ctx{opacity:.55}.db-ctx .db-who::after{content:' · 맥락';font-weight:600}.db-guest .db-bubble{background:#f3efff;border:1px solid #d9cdf7}.db-guest .db-who b{color:#5b3fb0}.db-guest .md p{margin:4px 0}
.db-skip{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:5px 11px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}.db-turn[hidden]{display:none}.db-in{animation:db-in .25s ease-out}@keyframes db-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}.db-typing .db-bubble{display:flex;gap:4px;padding:12px 14px}.db-typing i{width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:db-dot 1s infinite}.db-typing i:nth-child(2){animation-delay:.15s}.db-typing i:nth-child(3){animation-delay:.3s}@keyframes db-dot{0%,80%,100%{opacity:.3;transform:none}40%{opacity:1;transform:translateY(-3px)}}.db-join{margin-top:14px;border-top:1px solid var(--line);padding-top:12px}.db-join h3{margin:0 0 8px;font-size:15px}
.db-who{font-size:11px;font-weight:700;color:var(--muted);margin:0 6px 3px}.db-bubble{border-radius:16px;padding:10px 13px;font-size:14px;line-height:1.6}.db-bull .db-bubble{background:#fde8e6;border-bottom-left-radius:4px}.db-bear .db-bubble{background:#e3ecfb;border-bottom-right-radius:4px}.db-mid .db-bubble{background:#f1f3f6}.db-red .db-bubble{background:#fff7e6;border:1px dashed #f1d9a6;text-align:center}
.ev-row{display:inline-flex;flex-wrap:wrap;gap:3px;margin-left:4px;vertical-align:1px}.ev-chip{border:1px solid rgba(15,23,42,.18);background:rgba(255,255,255,.7);border-radius:6px;font:inherit;font-size:11px;font-weight:700;color:#475569;padding:0 5px;cursor:pointer}.ev-chip[aria-expanded=true]{background:var(--navy);color:#fff;border-color:var(--navy)}.ev-pop{margin-top:6px;font-size:12.5px;line-height:1.5;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 9px;color:var(--fg2)}.ev-pop a{font-weight:700}.ev-jump{border:0;background:none;color:var(--accent-strong);font:inherit;font-weight:700;cursor:pointer;padding:0;margin-left:4px}.db-ev{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}.db-ev>summary{cursor:pointer;font-weight:800;font-size:15px;list-style:none;display:flex;justify-content:space-between;align-items:center}.db-ev>summary::-webkit-details-marker{display:none}.db-ev>summary::after{content:'열기 ▾';font-size:12.5px;font-weight:700;color:var(--accent-strong)}.db-ev[open]>summary::after{content:'닫기 ▴'}.db-ev .sum{font-size:14.5px;line-height:1.65;margin:10px 0}.ev-hit{background:#fff3c4;border-radius:6px;transition:background .3s}.db-ev .evid{list-style:none;padding:0;font-size:13px;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:2px 12px}.db-ev .evid li{padding:2px 4px;overflow-wrap:anywhere}.issues ul{list-style:none;padding-left:0}.issues .plain li{margin:4px 0}.issues .pl-k{margin-top:4px}.is-open li::before{content:'⇄ ';color:var(--muted)}.db-quote{border-left:3px solid rgba(15,23,42,.25);background:rgba(255,255,255,.55);border-radius:6px;padding:4px 8px;margin-bottom:6px;font-size:12px;color:#475569;line-height:1.45}.db-quote b{display:block;font-size:11px;color:#334155}.worst{margin-top:8px;border-top:1px solid var(--line);padding-top:10px}.worst h3{margin:0 0 4px;font-size:15px;color:#9b1c1c}
.insight{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;background:linear-gradient(90deg,#eef3fb,#fff);border:1px solid #d7e2f3;border-radius:12px;padding:10px 13px;margin-bottom:14px;font-size:14px}.ins-k{font-size:11px;font-weight:800;color:var(--accent-strong);background:#dfe8f6;border-radius:6px;padding:1px 6px}
.ck{display:inline-block;font-size:10px;font-weight:700;border-radius:5px;padding:0 5px;margin-right:4px;vertical-align:1px}.ck-FACT{background:#e7f5ec;color:#1d6b3a}.ck-INFERENCE{background:var(--accent-soft);color:var(--accent-strong)}.ck-ASSUMPTION{background:#fff3d6;color:#7a4a00}`;
