// Report extras (docs/DESIGN.md §5.12, G-42): what changed since the last report, how a report's
// judgement was put together (a decision trace, from BOT constitution §9 and BOR Golden Trace),
// and claim-kind chips. Pure rendering from stored reports.

import type { DailyReport } from './dailyReport.js';
import type { ClaimKind, Commentary } from '../analysis/commentary.js';

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

export const EXTRAS_CSS = `.ck{display:inline-block;font-size:10px;font-weight:700;border-radius:5px;padding:0 5px;margin-right:4px;vertical-align:1px}.ck-FACT{background:#e7f5ec;color:#1d6b3a}.ck-INFERENCE{background:#e8eef7;color:#1d3a6e}.ck-ASSUMPTION{background:#fff3d6;color:#7a4a00}`;
