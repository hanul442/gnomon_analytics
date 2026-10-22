// Scorecard and terms pages (docs/DESIGN.md §3.8, G-33). The scorecard shows,
// across every covered stock, how the logged forecasts, AI analysts, strategy
// champions and paper ledgers actually did. The summary is free (trust comes
// from showing the record); the list of individual misses is Plus.

import type { DailyReport } from './dailyReport.js';
import { gate } from './plans.js';
import { PRESETS } from '../analysis/screenRules.js';
import type { SignalBoardRow } from '../analysis/signalLog.js';
import { ANALYSTS, ANALYST_HORIZON, type AnalystTrack } from '../analysis/analysts.js';
import { mergeBoards, UNIFORM_BRIER, type ScenarioBoard } from '../analysis/scenarioScore.js';
import { paperPanel } from './renderArena.js';
import { outcomeSunburst, ringChart } from './kit/stock.js';
import { shell, type HomeEntry } from './renderHtml.js';
import { esc } from './html.js';
import { won, tone, pct as fmtPct } from './format.js';
const pct = (v: number | null, d = 1) => fmtPct(v, d);
/**
 * G-226: one line comparing a member's stated confidence with how often it was right, and its Brier score
 * (0 best; 0.25 is what always saying 50% earns). Shown once 5 calls are scored, so one lucky call does not read as skill.
 */
function calibration(x: Tally): string {
  if (!x.calScored || x.calScored < 5) return '';
  const conf = x.conf! / x.calScored, hit = (x.hits / x.scored) * 100, gap = conf - hit, brier = x.brier! / x.calScored;
  const read = Math.abs(gap) < 10 ? '확신과 적중이 비슷해요' : gap > 0 ? `적중보다 ${Math.round(gap)}%p 더 자신했어요` : `적중보다 ${Math.round(-gap)}%p 덜 자신했어요`;
  return `<p class="muted small mb-cal">${read} · 확신 점수 ${brier.toFixed(2)} <span class="fine">(0이 가장 좋고, 늘 반반이라고 말하면 0.25)</span></p>`;
}
type Tally = { name: string; scored: number; hits: number; pending: number; err: number[]; brier?: number; conf?: number; calScored?: number; kill?: { set: number; broke: number; brokeMissed: number } };


/** Screener presets' track record (G-53): public to everyone, the losing ones included. */
function signalCard(rows: readonly SignalBoardRow[]): string {
  const p = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`);
  const t = (v: number | null) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');
  const name = (k: string) => PRESETS.find((x) => x.key === k)?.label ?? k;
  const body = rows.length
    ? `<table class="compact"><thead><tr><th>빠른 조건</th><th>기간</th><th class="num">신호</th><th class="num">평균 수익</th><th class="num">오른 비율</th><th class="num">지수 대비</th><th class="num">지수 이긴 비율</th></tr></thead><tbody>${rows.map((r) => `<tr><td><a href="screener.html#${r.preset}">${name(r.preset)}</a></td><td>${r.horizon}거래일</td><td class="num">${r.n}</td><td class="num ${t(r.avgPct)}">${p(r.avgPct)}</td><td class="num">${Math.round(r.hitRate * 100)}%</td><td class="num ${t(r.avgExcessPct)}">${p(r.avgExcessPct)}</td><td class="num">${r.beatRate == null ? '—' : `${Math.round(r.beatRate * 100)}%`}</td></tr>`).join('')}</tbody></table>`
    : '<p class="empty">신호를 기록하기 시작했어요. 5거래일이 지나면 첫 채점이 나와요.</p>';
  return `<section class="block" id="signals"><div class="block-head"><h2>스크리너 신호 성과</h2><span class="muted">모두에게 공개</span></div><div class="card table-wrap">${body}
<p class="fine">매일 장 마감 뒤 빠른 조건마다 상위 10종목을 그날 종가로 기록하고, 5·20거래일 뒤 첫 실행에서 종가와 같은 기간 코스피·코스닥 지수로 채점해요. 비용과 세금은 빼지 않았어요. 과거 성과가 앞으로를 보장하지 않아요.</p></div></section>`;
}

export function renderScorecard(entries: readonly HomeEntry[], signals: readonly SignalBoardRow[] = []): string {
  const live = entries.filter((e): e is HomeEntry & { report: DailyReport } => !!e.report?.market);
  // Forecast ranges by horizon.
  const byH = new Map<number, { scored: number; inside: number; err: number[] }>();
  const misses: { name: string; href: string; horizon: number; base: string; target: string; p10: number; p90: number; actual: number; err: number }[] = [];
  let pending = 0;
  for (const e of live) {
    const m = e.report.market!;
    pending += m.forecasts.length;
    for (const s of m.forecastScores) {
      const x = byH.get(s.horizon) ?? { scored: 0, inside: 0, err: [] };
      x.scored += s.scored; x.inside += (s.coverage ?? 0) * s.scored;
      if (s.medianAbsErrorPct !== null) x.err.push(s.medianAbsErrorPct);
      byH.set(s.horizon, x);
      for (const f of s.latest) if (!f.inside) misses.push({ name: e.name, href: e.href, horizon: f.horizon, base: f.baseDate, target: f.targetDate, p10: f.p10, p90: f.p90, actual: f.actual, err: f.errorPct });
    }
  }
  const horizons = [...byH.entries()].sort((a, b) => a[0] - b[0]);
  const totalScored = horizons.reduce((s, [, x]) => s + x.scored, 0);
  const forecastCard = `<section class="block"><div class="block-head"><h2>예측 범위 적중</h2><span class="muted">10~90% 범위 안에 실제 가격이 들어왔는지</span></div><div class="card">
${totalScored ? `<table class="compact"><thead><tr><th>기간</th><th>채점</th><th>범위 안</th><th>중앙값 오차(중간)</th></tr></thead><tbody>${horizons.map(([h, x]) => `<tr><td>${h}거래일</td><td>${x.scored.toLocaleString('ko-KR')}건</td><td><b>${x.scored ? Math.round((x.inside / x.scored) * 100) : 0}%</b></td><td>${x.err.length ? `${(x.err.reduce((s, v) => s + v, 0) / x.err.length).toFixed(1)}%` : '—'}</td></tr>`).join('')}</tbody></table>
<p class="fine">범위가 정직하면 약 80%가 안에 들어와요. 이보다 낮으면 범위가 너무 좁고, 훨씬 높으면 너무 넓은 거예요.</p>` : `<p class="empty">아직 채점한 예측이 없어요. 지금 기록된 예측 ${pending.toLocaleString('ko-KR')}건은 기간(5·20·60·120거래일)이 지나면 실제 가격으로 채점해요.</p>`}</div></section>`;
  // AI analysts, all stocks together.
  const by = new Map<string, Tally>();
  for (const e of live) for (const a of e.report.market!.analystBoard) {
    const x = by.get(a.analyst) ?? { name: a.name, scored: 0, hits: 0, pending: 0, err: [] };
    x.scored += a.scored; x.hits += (a.hitRate ?? 0) * a.scored; x.pending += a.pending;
    if (a.medianErrorPct !== null) x.err.push(a.medianErrorPct);
    // G-226: confidence vs hit rate and the Brier score, weighted by scored calls (boards stored before G-226 lack them).
    if (a.kill) { const k = x.kill ?? { set: 0, broke: 0, brokeMissed: 0 }; x.kill = { set: k.set + a.kill.set, broke: k.broke + a.kill.broke, brokeMissed: k.brokeMissed + a.kill.brokeMissed }; }
    if (a.brier != null && a.avgConfidence != null && a.scored) { x.brier = (x.brier ?? 0) + a.brier * a.scored; x.conf = (x.conf ?? 0) + a.avgConfidence * a.scored; x.calScored = (x.calScored ?? 0) + a.scored; }
    by.set(a.analyst, x);
  }
  const board = [...by.entries()].sort(([, a], [, b]) => (b.scored ? b.hits / b.scored : -1) - (a.scored ? a.hits / a.scored : -1) || b.pending - a.pending);
  // G-213: one card per committee member: its record, then its latest calls on every stock, each from the
  // stance and the 20-session price it set to where the price is now (or where it ended). The reasoning stays
  // in that day's report, one tap away.
  const calls = new Map<string, { e: HomeEntry; c: AnalystTrack }[]>();
  for (const e of live) for (const a of e.report.market!.analystBoard) for (const c of a.calls ?? []) {
    const xs = calls.get(a.analyst) ?? []; xs.push({ e, c }); calls.set(a.analyst, xs);
  }
  const chg = (to: number, from: number) => { const v = (to / from - 1) * 100; return `<span class="${tone(v)}">${v > 0 ? '+' : ''}${v.toFixed(1)}%</span>`; };
  const STANCE = { BULLISH: ['강세', 'up'], BEARISH: ['약세', 'down'], NEUTRAL: ['중립', 'muted'] } as const;
  const md = (d: string) => d.slice(5).replace('-', '/');
  const verdict = (c: AnalystTrack) => c.done
    ? `<b class="mb-v ${c.hit ? 'ok' : 'no'}">${c.hit ? '맞음' : '빗나감'}</b> <span class="muted">20거래일 뒤 ${won(c.close!)} (${chg(c.close!, c.baseClose)})</span>`
    : c.close === null ? '<span class="muted">가격 기록을 찾지 못했어요</span>'
    : `<span class="mb-v wait">대기 ${c.sessions}/${ANALYST_HORIZON}</span> <span class="muted">지금 ${won(c.close)} (${chg(c.close, c.baseClose)})${c.hit === null ? ' · 아직 움직임이 없어요' : c.hit ? ' · 전망과 같은 쪽이에요' : ' · 전망과 반대쪽이에요'}</span>`;
  const row = ({ e, c }: { e: HomeEntry; c: AnalystTrack }, i: number) => {
    const [word, cls] = STANCE[c.stance];
    const dated = `${e.href.replace(/index\.html$/, '')}reports/${c.reportDate}.html`;
    return `<li class="mb-row${i >= 4 ? ' more-row' : ''}" data-sym="${esc(e.symbol)}"${i >= 4 ? ' hidden' : ''}><div class="mb-top"><a href="${esc(e.href)}">${esc(e.name)}</a><span class="muted small">${md(c.reportDate)} 리포트</span><b class="${cls} mb-st">${word} ${c.confidence}%</b></div>
<div class="mb-line"><span class="mb-k">전망</span>${won(c.baseClose)} → <b>${won(c.target)}</b> (${chg(c.target, c.baseClose)})</div>
${c.invalidation ? `<div class="mb-line"><span class="mb-k">철회</span>종가 ${won(c.invalidation)}에 닿으면 틀렸다고 봐요 · ${c.brokeOn ? `<b class="mb-v no">${md(c.brokeOn)}에 닿았어요</b>` : c.done ? '<span class="muted">끝까지 닿지 않았어요</span>' : '<span class="muted">아직 닿지 않았어요</span>'}</div>` : ''}
<div class="mb-line"><span class="mb-k">결과</span>${verdict(c)}</div><a class="mb-why" href="${esc(dated)}#parliament-ai">근거 보기 ›</a></li>`;
  };
  const member = ([id, x]: [string, Tally]) => {
    const who = ANALYSTS.find((a) => a.id === id);
    const mine = (calls.get(id) ?? []).sort((a, b) => (a.c.reportDate < b.c.reportDate ? 1 : a.c.reportDate > b.c.reportDate ? -1 : a.e.name.localeCompare(b.e.name))).slice(0, 20);
    const stat = (k: string, v: string) => `<span><small>${k}</small><b>${v}</b></span>`;
    return `<article class="card mb-card" id="m-${esc(id)}"><div class="mb-head"><div><h3>${esc(x.name)}</h3>${who ? `<p class="muted small">${esc(who.focus)}</p>` : ''}</div>
<div class="mb-stats">${stat('적중', x.scored ? `${Math.round((x.hits / x.scored) * 100)}%` : '—')}${stat('채점', `${x.scored}건`)}${stat('진행 중', `${x.pending}건`)}${stat('오차', x.err.length ? `${(x.err.reduce((s, v) => s + v, 0) / x.err.length).toFixed(1)}%` : '—')}${stat('확신', x.calScored ? `${Math.round(x.conf! / x.calScored)}%` : '—')}</div></div>
${calibration(x)}${x.kill && x.kill.broke ? `<p class="muted small">철회 가격에 닿은 판단 ${x.kill.broke}건 중 ${x.kill.brokeMissed}건이 결국 빗나갔어요 <span class="fine">(철회 가격을 정한 채점 ${x.kill.set}건)</span></p>` : ''}
${mine.length ? `<ol class="mb-calls">${mine.map(row).join('')}</ol><p class="empty mb-none" hidden>관심 종목에 대한 판단이 아직 없어요.</p>${mine.length > 4 ? `<button type="button" class="more-all">최근 판단 ${mine.length}개 모두 보기</button>` : ''}` : '<p class="empty">아직 기록된 판단이 없어요.</p>'}</article>`;
  };
  // G-271 (Bklit sunburst): every call split by result, then by the member who made it.
  const kids = (f: (x: Tally) => number) => board.map(([, x]) => ({ label: x.name, value: Math.round(f(x)) }));
  const sun = outcomeSunburst([
    { label: '맞음', key: 'ok', children: kids((x) => x.hits) },
    { label: '빗나감', key: 'no', children: kids((x) => x.scored - x.hits) },
    { label: '대기', key: 'wait', children: kids((x) => x.pending) },
  ], { label: '위원 판단 결과와 위원별 나눔' });
  const analystCard = `<section class="block"><div class="block-head"><h2>위원별 판단</h2><span class="muted">전 종목 합산</span></div>
<div class="mb-bar" hidden><button type="button" class="chip-toggle mb-watch" aria-pressed="false">관심 종목만</button></div>
${board.length ? `<div class="mb-grid">${board.map(member).join('')}</div>` : '<div class="card"><p class="empty">아직 위원 판단이 없어요.</p></div>'}
<p class="fine">위원은 AI가 서로 다른 관점을 맡은 분석가예요. 위원회가 모이기 전에 각자 자기 관점의 근거만 보고 따로 판단해요. '철회'는 위원이 판단하면서 정한 “종가가 여기에 닿으면 틀렸다고 보는” 가격이에요. 리포트를 쓴 날 입장과 20거래일 뒤 가격을 그대로 기록하고 고치지 않아요. 20거래일이 지나면 방향이 맞았는지 채점해요(중립은 ±2% 안이면 맞음). '확신'은 위원이 스스로 적은 확신도의 평균이에요. 확신이 적중보다 많이 높으면 자신감이 지나친 거고, 둘이 비슷할수록 믿을 만한 확신이에요. 진행 중인 판단의 '같은 쪽·반대쪽'은 지금까지의 움직임일 뿐 채점이 아니에요. 적중이 높은 위원이 먼저 나와요.</p></section>`;
  // G-77: strategy champions and paper ledgers ("따라 하기"), one row per stock, best first. Ten rows show;
  // the rest wait behind '전체 보기'. A row opens that stock's ledger in place.
  const follow = live.map((e) => {
    const m = e.report.market!, champ = m.arena?.results.find((r) => r.key === m.arena?.championKey), hold = m.arena?.results.find((r) => r.key === 'hold');
    const books = m.paper ?? [], pc = books.find((b) => b.follower === 'champion'), ph = books.find((b) => b.follower === 'hold');
    const bestAi = books.filter((b) => b.follower.startsWith('analyst:')).sort((x, y) => y.totalReturn - x.totalReturn)[0];
    return { e, champ, hold, pc, ph, bestAi, books, key: pc ? pc.totalReturn : -9 };
  }).sort((x, y) => y.key - x.key || x.e.name.localeCompare(y.e.name));
  const rows = follow.map((f, i) => `<tr class="fr${i >= 10 ? ' more-row' : ''}"${i >= 10 ? ' hidden' : ''}><td><a href="${esc(f.e.href)}">${esc(f.e.name)}</a><div class="muted small">${f.champ ? esc(f.champ.name) : '—'}${f.books.length ? ` <button type="button" class="fr-open" aria-expanded="false">장부 ›</button>` : ''}</div></td><td class="num ${tone(f.pc ? f.pc.totalReturn * 100 : null)}">${f.pc ? pct(f.pc.totalReturn * 100, 2) : '—'}</td><td class="num ${tone(f.ph ? f.ph.totalReturn * 100 : null)}">${f.ph ? pct(f.ph.totalReturn * 100, 2) : '—'}</td><td class="hide-m">${f.bestAi ? `${esc(f.bestAi.label)} <span class="${tone(f.bestAi.totalReturn * 100)}">${pct(f.bestAi.totalReturn * 100, 2)}</span>` : '—'}</td></tr>${f.books.length ? `<tr class="fr-ledger" hidden><td colspan="4">${paperPanel(f.books)}</td></tr>` : ''}`).join('');
  const beat = live.filter((e) => { const a = e.report.market!.arena; const c = a?.results.find((r) => r.key === a.championKey), h = a?.results.find((r) => r.key === 'hold'); return !!c && !!h && c.oosReturn > h.oosReturn; }).length;
  const avg = (sel: (f: string) => boolean) => { const xs = live.flatMap((e) => (e.report.market!.paper ?? []).filter((b) => sel(b.follower)).map((b) => b.totalReturn)); return xs.length ? (xs.reduce((x, v) => x + v, 0) / xs.length) * 100 : null; };
  const tile = (label: string, v: number | null, sub: string) => `<div class="sc-tile"><div class="pl-k">${label}</div><b class="${tone(v)}">${pct(v, 2)}</b><small>${sub}</small></div>`;
  const followSummary = `<div class="sc-tiles">${tile('전략 챔피언 따라 하기', avg((f) => f === 'champion'), '종목 평균')}${tile('매수 후 보유', avg((f) => f === 'hold'), '비교 기준')}${tile('AI 분석가 따라 하기', avg((f) => f.startsWith('analyst:')), '분석가 평균')}</div>`;
  const strategyCard = `<section class="block sc-sec" id="paper"><div class="block-head"><h2>따라 했다면 (모의투자)</h2><span class="muted">챔피언이 보유보다 나았던 종목 ${beat}/${live.length}</span></div>${gate(followSummary, { base: '', what: '따라 하기 평균 성과', feature: 'paperAverage' })}
${gate(`<div class="card table-wrap"><table class="compact fr-table"><thead><tr><th>종목 · 전략 챔피언</th><th class="num">챔피언 장부</th><th class="num">보유 장부</th><th class="hide-m">최고 AI 분석가</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">아직 기록이 없어요.</td></tr>'}</tbody></table>
${follow.length > 10 ? `<button type="button" class="more-all">전체 ${follow.length}종목 보기</button>` : ''}
<p class="fine">챔피언 장부 수익이 높은 순이에요. 장부는 기록을 시작한 날부터 다음 거래일 수익으로 쌓고, 사고팔 때 비용을 빼요. 종목의 '장부'를 누르면 매매 내역과 수익 곡선이 펼쳐져요.</p></div>`, { base: '', what: '종목별 장부 · 매매 내역 · 수익 곡선', feature: 'paperLedger' })}</section>`;
  misses.sort((a, b) => (a.target < b.target ? 1 : -1));
  const missCard = `<section class="block"><div class="block-head"><h2>빗나간 예측</h2><span class="muted">범위 밖으로 나간 최근 예측</span></div><div class="card table-wrap">${misses.length ? `<table class="compact"><thead><tr><th>종목</th><th>기간</th><th>예측 범위</th><th>실제</th><th>중앙값 대비</th></tr></thead><tbody>${misses.slice(0, 40).map((x, i) => `<tr${i >= 10 ? ' class="more-row" hidden' : ''}><td><a href="${esc(x.href)}">${esc(x.name)}</a><div class="muted small">${esc(x.base)} → ${esc(x.target)}</div></td><td>${x.horizon}거래일</td><td>${won(x.p10)} ~ ${won(x.p90)}</td><td><b>${won(x.actual)}</b></td><td class="${tone(x.err)}">${pct(x.err)}</td></tr>`).join('')}</tbody></table>${misses.length > 10 ? `<button type="button" class="more-all">전체 ${Math.min(misses.length, 40)}건 보기</button>` : ''}` : '<p class="empty">아직 범위 밖으로 나간 예측이 없어요.</p>'}</div></section>`;
  const fcHit = totalScored ? (horizons.reduce((x, [, y]) => x + y.inside, 0) / totalScored) * 100 : null;
  const aiScored = board.reduce((x, [, b]) => x + b.scored, 0), aiHit = aiScored ? (board.reduce((x, [, b]) => x + b.hits, 0) / aiScored) * 100 : null;
  const champ = avg((f) => f === 'champion'), hold = avg((f) => f === 'hold');
  const scenarioCard = scenarioSection(live.flatMap((e) => (e.report.market!.scenarioBoard ? [e.report.market!.scenarioBoard] : [])));
  // G-244 (화면 개편 3단계): one number first (forecast hit rate against the 80% an honest 10~90% range should get),
  // three lines under it, then the groups one after another (G-281: the tab row went).
  const fcSay = fcHit === null ? '예측은 기간이 지나면 실제 가격으로 채점해요.' : fcHit < 70 ? '범위를 좁게 잡는 편이에요.' : fcHit > 90 ? '범위를 넓게 잡는 편이에요.' : '정직한 범위에 가까워요.';
  const line = (label: string, sub: string, v: string, cls = '') => `<div class="sc-line"><span><b>${label}</b><small>${sub}</small></span><b class="sc-lv ${cls}">${v}</b></div>`;
  // G-265 (Bklit ring chart): the three headline records as concentric rings (a ring stays empty until it is scored).
  // G-281 (한서님 10/22 "또 겹치는거 있네"): no number in the middle; the big number above already says it.
  const hitText = (v: number | null) => (v === null ? '채점 전' : `${Math.round(v)}%`);
  const scoreRing = live.length ? ringChart([
    { label: '예측 범위 적중', value: fcHit === null ? null : fcHit / 100, color: 'var(--accent)', text: hitText(fcHit) },
    { label: '위원 방향 적중', value: aiHit === null ? null : aiHit / 100, color: 'var(--fg2)', text: hitText(aiHit) },
    { label: '챔피언이 보유보다 나은 종목', value: beat / live.length, color: 'var(--muted)', text: `${beat}/${live.length}` },
  ], { label: `예측 범위 적중 ${hitText(fcHit)}, 위원 방향 적중 ${hitText(aiHit)}, 챔피언이 보유보다 나은 종목 ${beat}/${live.length}`, big: '', cls: 'sc-ring' }) : '';
  const hero = `<section class="block sc-hero" id="top"><div class="sc-k">예측 범위 적중률 · 리포트 종목 ${live.length}개</div><h1 class="sc-hv"><b>${fcHit === null ? '채점 전' : `${Math.round(fcHit)}%`}</b><small>목표 80% 안팎</small></h1>
${fcHit === null ? '' : `<div class="sc-meter" role="img" aria-label="적중률 ${Math.round(fcHit)}%, 목표 80%"><i style="width:${Math.max(0, Math.min(100, fcHit)).toFixed(0)}%"></i><em style="left:80%"></em></div>`}
${scoreRing}<p class="sc-say">10~90% 범위로 낸 예측이라, 정직하다면 열에 여덟은 범위 안에 들어와야 해요. ${fcSay} ${totalScored ? `채점 ${totalScored.toLocaleString('ko-KR')}건.` : `기록 ${pending.toLocaleString('ko-KR')}건이 채점을 기다려요.`} 틀린 기록도 지우지 않아요.</p>
<div class="sc-lines">${line('챔피언 전략이 보유보다 나았던 종목', `리포트 종목 ${live.length}개 중`, `${beat}개`)}${line('챔피언을 따라 했다면', `그냥 들고 있었다면 ${pct(hold, 2)}`, pct(champ, 2), tone(champ))}${line('위원 방향 적중', aiScored ? `채점 ${aiScored}건` : '20거래일 뒤 첫 채점', aiHit === null ? '채점 전' : `${Math.round(aiHit)}%`, aiHit === null ? 'muted' : '')}</div></section>
`;
  // G-281 (한서님 10/22, 앱 전체 구조 — 위에 줄 없음): no tab row in the middle; the four groups follow each other, each with its title.
  const GROUP_TITLE: Record<string, string> = { forecast: '예측', analysts: '위원별', scenarios: '시나리오', paper: '따라 하기' };
  const group = (k: string, html: string) => `<div class="sc-group" id="scg-${k}"><h2 class="sc-gh">${GROUP_TITLE[k]}</h2>${html}</div>`;
  const body = `${hero}
${group('forecast', gate(forecastCard.replace('<section class="block">', '<section class="block sc-sec" id="forecast">'), { base: '', what: '기간별 예측 적중', feature: 'scoreSummary' }) + gate(missCard.replace('<section class="block">', '<section class="block sc-sec" id="misses">'), { base: '', what: '빗나간 예측 하나하나', feature: 'scoreMisses' }))}
${group('analysts', (sun ? `<section class="block sc-sec"><div class="block-head"><h2>판단 결과 한눈에</h2><span class="muted">전 위원 합산</span></div><div class="card">${sun}</div></section>` : '') + gate(analystCard.replace('<section class="block">', '<section class="block sc-sec" id="analysts">'), { base: '', what: '위원별 판단과 결과', feature: 'scoreSummary' }))}
${group('scenarios', scenarioCard || '<section class="block sc-sec" id="scenarios"><div class="card"><p class="empty">아직 채점한 시나리오가 없어요.</p></div></section>')}
${group('paper', strategyCard + signalCard(signals))}
<style>.sc-hero{margin-top:18px}.sc-k{font-size:13px;color:var(--muted)}.sc-hv{display:flex;align-items:baseline;gap:10px;margin:6px 0 0}.sc-hv b{font-size:56px;line-height:1;font-weight:800;color:var(--accent-strong);font-variant-numeric:tabular-nums}.sc-hv small{font-size:14px;font-weight:500;color:var(--muted)}
.sc-meter{position:relative;height:8px;border-radius:4px;background:var(--soft);margin-top:18px}.sc-meter i{display:block;height:8px;border-radius:4px;background:var(--accent)}.sc-meter em{position:absolute;top:-5px;width:2px;height:18px;background:var(--fg)}
.sc-say{margin:16px 0 0;font-size:15px;line-height:1.65;color:var(--fg2)}.sc-lines{margin-top:14px}.sc-line{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid var(--line)}.sc-line>span{display:flex;flex-direction:column;gap:2px;min-width:0}.sc-line b{font-size:15px}.sc-line small{font-size:13px;color:var(--muted)}.sc-lv{margin-left:auto;font-variant-numeric:tabular-nums;white-space:nowrap}.sc-lv.muted{color:var(--muted)}
.sc-tabs{position:sticky;top:calc(var(--topbar-h,56px) + 4px);z-index:5;display:flex;gap:4px;margin:24px 0 4px;padding:4px;border-radius:12px;background:var(--surface-solid,var(--surface));border:1px solid var(--line)}.sc-tabs button{flex:1;min-height:40px;border:0;border-radius:9px;background:none;font:inherit;font-size:14px;font-weight:700;color:var(--fg2);cursor:pointer}.sc-tabs button[aria-selected=true]{background:var(--soft);color:var(--fg)}.sc-group[hidden]{display:none}.sc-gh{margin:28px 4px 0;font-size:21px;font-weight:800}
.sc-bigs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.sc-big{display:flex;flex-direction:column;gap:2px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:14px 16px;text-decoration:none;color:inherit}.sc-big:hover{border-color:var(--accent)}.sc-big span{font-size:12.5px;font-weight:700;color:var(--muted)}.sc-big b{font-size:26px}.sc-big small{font-size:12px;color:var(--muted)}
.sc-nav{display:flex;gap:6px;overflow-x:auto;margin-top:12px;padding:6px 0}.sc-nav a{flex:none;border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:6px 13px;font-size:13.5px;font-weight:700;text-decoration:none;color:var(--fg)}.sc-sec{scroll-margin-top:120px}
.sc-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}.sc-tile{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px}.sc-tile b{display:block;font-size:22px}.sc-tile small{color:var(--muted);font-size:12px}
.more-all{display:block;margin:10px auto 0;border:1px dashed var(--line-strong);background:var(--surface);border-radius:999px;padding:8px 16px;font:inherit;font-size:13.5px;font-weight:700;color:var(--accent-strong);cursor:pointer}.fr-table{table-layout:auto;width:100%}.fr-open{margin-left:4px;border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:4px 10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap}.fr-open[aria-expanded=true]{background:var(--navy);color:var(--on-accent)}.fr-ledger td{background:var(--soft);white-space:normal}.fr-ledger td>*{max-width:calc(100vw - 48px);overflow-x:auto;box-sizing:border-box}
.mb-bar{margin:0 0 10px}.mb-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.mb-card{min-width:0;scroll-margin-top:120px}.mb-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}.mb-head h3{margin:0;font-size:16px}.mb-head p{margin:2px 0 0}.mb-stats{display:flex;gap:12px}.mb-stats span{display:flex;flex-direction:column;align-items:flex-end}.mb-stats small{font-size:11.5px;color:var(--muted);font-weight:700}.mb-stats b{font-size:15px}
.mb-calls{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}.mb-row{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:3px;min-width:0}.mb-top{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}.mb-top a{font-weight:800}.mb-st{margin-left:auto;font-size:13px;white-space:nowrap}.mb-line{font-size:13.5px;line-height:1.5;overflow-wrap:anywhere}.mb-k{display:inline-block;min-width:34px;font-size:12px;font-weight:700;color:var(--muted)}.mb-v{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;line-height:1.5;white-space:nowrap}.mb-v.ok{background:rgba(56,170,104,.14);color:#1E7346;box-shadow:0 0 14px rgba(56,170,104,.22)}.mb-v.no{background:rgba(216,96,146,.13);color:#A3315F;box-shadow:0 0 14px rgba(216,96,146,.2)}.mb-v.wait{background:var(--soft);color:var(--fg2)}
:root[data-theme=dark] .mb-v.ok{background:rgba(88,200,134,.16);color:#8EDCAE}:root[data-theme=dark] .mb-v.no{background:rgba(236,120,168,.15);color:#F2A3C4}.mb-why{align-self:flex-end;font-size:12.5px;font-weight:700;text-decoration:none;color:var(--accent-strong)}
.mb-row[hidden],.mb-only .mb-row.nw{display:none}.mb-only .mb-row.more-row:not(.nw){display:flex}.mb-only .more-all{display:none}
@media (max-width:820px){.mb-grid{grid-template-columns:1fr}.sc-bigs{grid-template-columns:repeat(2,minmax(0,1fr))}.sc-tiles{gap:6px}.sc-tile{padding:10px}.sc-tile b{font-size:17px}.sc-tile .pl-k{font-size:11.5px}.hide-m{display:none}}</style>
<footer id="sources" style="padding:24px 0 0"><p>매일 장 마감 뒤 다시 계산해요. 과거 성적이 앞으로의 결과를 보장하지 않아요. 모의투자는 가상 계좌예요. 투자 권유가 아니에요.</p></footer>`;
  return shell('', '성적표 | GNOMON', body, { active: 'scorecard', scripts: SCORE_JS, mode: 'scorecard.html' });
}

/** G-77: 모의투자 is part of the scorecard ('따라 했다면'); the old address forwards there. */
export function renderPaper(): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=scorecard.html#paper"><title>성적표 | GNOMON</title></head><body><a href="scorecard.html#paper">성적표로 이동</a></body></html>`;
}

/** '전체 보기' opens the rest of a list; '장부' opens a stock's ledger under its row; '관심 종목만' (G-213) narrows the members' calls to the watchlist. */
const SCORE_JS = `<script>
// G-244: one group at a time; a link to #paper, #misses and the like opens the group that holds it.
(function () {
  var tabs = [].slice.call(document.querySelectorAll('[data-sc-tab]')); if (!tabs.length) return;
  var show = function (k, scroll) {
    tabs.forEach(function (t) { var on = t.getAttribute('data-sc-tab') === k; t.setAttribute('aria-selected', String(on)); var g = document.getElementById('scg-' + t.getAttribute('data-sc-tab')); if (g) g.hidden = !on; });
    if (scroll) { var el = document.getElementById(scroll); if (el) el.scrollIntoView(); }
  };
  var fromHash = function () { var id = location.hash.slice(1), el = id && document.getElementById(id), g = el && el.closest && el.closest('.sc-group'); if (g) show(g.id.slice(4), id); };
  tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.getAttribute('data-sc-tab')); }); });
  window.addEventListener('hashchange', fromHash);
  show('forecast'); fromHash();
})();
(function () {
  var w = []; try { w = JSON.parse(localStorage.getItem('gnm-watch') || '[]'); } catch (e) {}
  var bar = document.querySelector('.mb-bar'), btn = bar && bar.querySelector('.mb-watch'), sec = bar && bar.parentNode;
  if (!btn || !Array.isArray(w) || !w.length) return;
  var mine = {}; w.forEach(function (s) { mine[String(s)] = 1; });
  [].forEach.call(sec.querySelectorAll('.mb-row'), function (r) { if (!mine[r.getAttribute('data-sym')]) r.classList.add('nw'); });
  bar.hidden = false;
  btn.addEventListener('click', function () {
    var on = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(on)); sec.classList.toggle('mb-only', on);
    [].forEach.call(sec.querySelectorAll('.mb-card'), function (c) { var none = c.querySelector('.mb-none'); if (none) none.hidden = !on || !!c.querySelector('.mb-row:not(.nw)'); });
  });
})();
document.addEventListener('click', function (e) {
  var m = e.target.closest && e.target.closest('.more-all');
  if (m) { var box = m.parentNode; [].forEach.call(box.querySelectorAll('.more-row'), function (r) { r.hidden = false; }); m.remove(); return; }
  var o = e.target.closest && e.target.closest('.fr-open'); if (!o) return;
  var row = o.closest('tr').nextElementSibling, open = o.getAttribute('aria-expanded') !== 'true';
  if (row && row.classList.contains('fr-ledger')) { row.hidden = !open; o.setAttribute('aria-expanded', String(open)); o.textContent = open ? '닫기' : '장부 ›'; window.dispatchEvent(new Event('resize')); }
});
</script>`;

/**
 * G-227: the committee's scenario probabilities against what happened, all stocks together. Public (the
 * point of a scored committee is that the misses show too). The table is the calibration check: when the
 * committee says about 70%, that scenario should happen about 7 times in 10.
 */
export function scenarioSection(boards: readonly ScenarioBoard[]): string {
  const m = mergeBoards(boards);
  const head = '<section class="block sc-sec" id="scenarios"><div class="block-head"><h2>시나리오 확률 채점</h2><span class="muted">강세·기본·약세 확률이 맞았는지</span></div><div class="card">';
  if (!m.scored) return `${head}<p class="empty">아직 채점한 시나리오가 없어요. 위원회 리포트의 시나리오 확률 ${m.pending.toLocaleString('ko-KR')}건은 20거래일 안에 강세·약세 기준 가격을 넘는지 보고 채점해요.</p></div></section>`;
  const vs = m.skill! >= 0.05 ? `셋으로 똑같이 나눈 것보다 ${Math.round(m.skill! * 100)}% 나아요` : m.skill! <= -0.05 ? `셋으로 똑같이 나눈 것보다 ${Math.round(-m.skill! * 100)}% 못해요` : '셋으로 똑같이 나눈 것과 비슷해요';
  const rows = m.bins.map((b) => `<tr><td>${b.lo}~${b.hi}%</td><td class="num">${Math.round(b.saidPct)}%</td><td class="num"><b>${Math.round(b.happenedPct)}%</b></td><td class="num">${b.n}건</td></tr>`).join('');
  return `${head}<div class="sc-tiles"><div class="sc-tile"><div class="pl-k">확률 점수</div><b>${m.brier!.toFixed(2)}</b><small>0이 가장 좋고, 셋으로 똑같이 나누면 ${UNIFORM_BRIER.toFixed(2)}</small></div><div class="sc-tile"><div class="pl-k">채점</div><b>${m.scored}건</b><small>${vs}</small></div><div class="sc-tile"><div class="pl-k">실제로 일어난 쪽</div><b>강세 ${m.happened.BULL} · 기본 ${m.happened.BASE} · 약세 ${m.happened.BEAR}</b><small>진행 중 ${m.pending}건</small></div></div>
<table class="compact"><thead><tr><th>말한 확률</th><th class="num">평균</th><th class="num">실제로 일어난 비율</th><th class="num">건수</th></tr></thead><tbody>${rows}</tbody></table>
<p class="fine">20거래일 안에 종가가 강세 기준 가격을 먼저 넘으면 강세, 약세 기준 가격을 먼저 깨면 약세, 둘 다 아니면 기본이 일어난 것으로 봐요. 확률이 정직하면 '말한 확률'과 '실제로 일어난 비율'이 비슷해요. 리포트는 만든 날 그대로 보관되니 지나간 확률을 고칠 수 없어요.</p></div></section>`;
}
