// Scorecard and terms pages (docs/DESIGN.md §3.8, G-33). The scorecard shows,
// across every covered stock, how the logged forecasts, AI analysts, strategy
// champions and paper ledgers actually did. The summary is free (trust comes
// from showing the record); the list of individual misses is Plus.

import type { DailyReport } from './dailyReport.js';
import { gate } from './plans.js';
import { PRESETS } from '../analysis/screenRules.js';
import type { SignalBoardRow } from '../analysis/signalLog.js';
import { paperPanel } from './renderArena.js';
import { shell, type HomeEntry } from './renderHtml.js';

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`;
const pct = (v: number | null, d = 1) => (v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`);
const tone = (v: number | null) => (v === null || v === 0 ? '' : v > 0 ? 'up' : 'down');

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
  const by = new Map<string, { name: string; scored: number; hits: number; pending: number; err: number[] }>();
  for (const e of live) for (const a of e.report.market!.analystBoard) {
    const x = by.get(a.analyst) ?? { name: a.name, scored: 0, hits: 0, pending: 0, err: [] };
    x.scored += a.scored; x.hits += (a.hitRate ?? 0) * a.scored; x.pending += a.pending;
    if (a.medianErrorPct !== null) x.err.push(a.medianErrorPct);
    by.set(a.analyst, x);
  }
  const board = [...by.values()].sort((a, b) => (b.scored ? b.hits / b.scored : -1) - (a.scored ? a.hits / a.scored : -1) || b.pending - a.pending);
  const analystCard = `<section class="block"><div class="block-head"><h2>AI 분석가 순위</h2><span class="muted">20거래일 뒤 방향이 맞았는지 · 전 종목 합산</span></div><div class="card">
${board.length ? `<table class="compact"><thead><tr><th>분석가</th><th>채점</th><th>방향 적중</th><th>목표가 오차(중간)</th><th>채점 대기</th></tr></thead><tbody>${board.map((x) => `<tr><td>${esc(x.name)}</td><td>${x.scored}</td><td><b>${x.scored ? `${Math.round((x.hits / x.scored) * 100)}%` : '—'}</b></td><td>${x.err.length ? `${(x.err.reduce((s, v) => s + v, 0) / x.err.length).toFixed(1)}%` : '—'}</td><td>${x.pending}</td></tr>`).join('')}</tbody></table>` : '<p class="empty">아직 분석가 예측이 없어요.</p>'}
<p class="fine">분석가는 같은 AI가 서로 다른 관점을 맡아 쓴 의견이에요. 예측은 쓴 날 그대로 기록하고 고치지 않아요.</p></div></section>`;
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
  const strategyCard = `<section class="block sc-sec" id="paper"><div class="block-head"><h2>따라 했다면 (모의투자)</h2><span class="muted">챔피언이 보유보다 나았던 종목 ${beat}/${live.length}</span></div>${gate(followSummary, { base: '', what: '따라 하기 평균 성과' })}
${gate(`<div class="card table-wrap"><table class="compact fr-table"><thead><tr><th>종목 · 전략 챔피언</th><th class="num">챔피언 장부</th><th class="num">보유 장부</th><th class="hide-m">최고 AI 분석가</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">아직 기록이 없어요.</td></tr>'}</tbody></table>
${follow.length > 10 ? `<button type="button" class="more-all">전체 ${follow.length}종목 보기</button>` : ''}
<p class="fine">챔피언 장부 수익이 높은 순이에요. 장부는 기록을 시작한 날부터 다음 거래일 수익으로 쌓고, 사고팔 때 비용을 빼요. 종목의 '장부'를 누르면 매매 내역과 수익 곡선이 펼쳐져요.</p></div>`, { base: '', what: '종목별 장부 · 매매 내역 · 수익 곡선', need: 'pro' })}</section>`;
  misses.sort((a, b) => (a.target < b.target ? 1 : -1));
  const missCard = `<section class="block"><div class="block-head"><h2>빗나간 예측</h2><span class="muted">범위 밖으로 나간 최근 예측</span></div><div class="card table-wrap">${misses.length ? `<table class="compact"><thead><tr><th>종목</th><th>기간</th><th>예측 범위</th><th>실제</th><th>중앙값 대비</th></tr></thead><tbody>${misses.slice(0, 40).map((x, i) => `<tr${i >= 10 ? ' class="more-row" hidden' : ''}><td><a href="${esc(x.href)}">${esc(x.name)}</a><div class="muted small">${esc(x.base)} → ${esc(x.target)}</div></td><td>${x.horizon}거래일</td><td>${won(x.p10)} ~ ${won(x.p90)}</td><td><b>${won(x.actual)}</b></td><td class="${tone(x.err)}">${pct(x.err)}</td></tr>`).join('')}</tbody></table>${misses.length > 10 ? `<button type="button" class="more-all">전체 ${Math.min(misses.length, 40)}건 보기</button>` : ''}` : '<p class="empty">아직 범위 밖으로 나간 예측이 없어요.</p>'}</div></section>`;
  // G-77: four numbers first, then one section per question; 모의투자 lives here as '따라 했다면'.
  const fcHit = totalScored ? (horizons.reduce((x, [, y]) => x + y.inside, 0) / totalScored) * 100 : null;
  const aiScored = board.reduce((x, b) => x + b.scored, 0), aiHit = aiScored ? (board.reduce((x, b) => x + b.hits, 0) / aiScored) * 100 : null;
  const champ = avg((f) => f === 'champion'), hold = avg((f) => f === 'hold');
  const big = (label: string, v: string, sub: string, href: string) => `<a class="sc-big" href="${href}"><span>${label}</span><b>${v}</b><small>${sub}</small></a>`;
  const head = `<section class="block"><div class="sc-bigs">${big('예측 범위 적중', fcHit === null ? '채점 전' : `${Math.round(fcHit)}%`, totalScored ? `채점 ${totalScored.toLocaleString('ko-KR')}건 · 정직하면 약 80%` : `기록 ${pending.toLocaleString('ko-KR')}건 채점 대기`, '#forecast')}${big('AI 분석가 방향 적중', aiHit === null ? '채점 전' : `${Math.round(aiHit)}%`, aiScored ? `채점 ${aiScored}건` : '20거래일 뒤 첫 채점', '#analysts')}${big('챔피언 vs 보유', `${beat}/${live.length}`, '챔피언이 더 나았던 종목', '#paper')}${big('따라 하기 (챔피언)', pct(champ, 2), `보유 ${pct(hold, 2)}`, '#paper')}</div>
<nav class="sc-nav" aria-label="성적표 바로 가기"><a href="#forecast">예측</a><a href="#analysts">AI 분석가</a><a href="#paper">따라 했다면</a><a href="#signals">스크리너 신호</a><a href="#misses">빗나간 예측</a></nav></section>`;
  const body = `<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>성적표</span><span>리포트 종목 ${live.length}개</span></div><h1>맞았는지, 기록으로 보여 드려요</h1>
<p class="hero-line">예측과 판단은 만든 날 그대로 기록하고, 기간이 지나면 실제 가격으로 채점해요. 틀린 기록도 지우지 않아요. 모의투자(따라 했다면)도 여기 있어요.</p></div></section>
${head}${gate(forecastCard.replace('<section class="block">', '<section class="block sc-sec" id="forecast">') + analystCard.replace('<section class="block">', '<section class="block sc-sec" id="analysts">'), { base: '', what: '기간별 예측 적중 · AI 분석가 순위' })}${strategyCard}${signalCard(signals)}${gate(missCard.replace('<section class="block">', '<section class="block sc-sec" id="misses">'), { base: '', what: '빗나간 예측 하나하나', need: 'pro' })}
<style>.sc-bigs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.sc-big{display:flex;flex-direction:column;gap:2px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px 16px;text-decoration:none;color:inherit}.sc-big:hover{border-color:var(--accent)}.sc-big span{font-size:12.5px;font-weight:700;color:var(--muted)}.sc-big b{font-size:26px}.sc-big small{font-size:12px;color:var(--muted)}
.sc-nav{display:flex;gap:6px;overflow-x:auto;margin-top:12px;position:sticky;top:64px;z-index:3;background:var(--bg);padding:6px 0}.sc-nav a{flex:none;border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:6px 13px;font-size:13.5px;font-weight:700;text-decoration:none;color:var(--fg)}.sc-sec{scroll-margin-top:120px}
.sc-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}.sc-tile{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px}.sc-tile b{display:block;font-size:22px}.sc-tile small{color:var(--muted);font-size:12px}
.more-all{display:block;margin:10px auto 0;border:1px dashed var(--line-strong);background:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-size:13.5px;font-weight:700;color:var(--accent-strong);cursor:pointer}.fr-table{table-layout:auto;width:100%}.fr-open{margin-left:4px;border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:4px 10px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap}.fr-open[aria-expanded=true]{background:var(--navy);color:#fff}.fr-ledger td{background:#f7f9fc;white-space:normal}.fr-ledger td>*{max-width:calc(100vw - 48px);overflow-x:auto;box-sizing:border-box}
@media (max-width:820px){.sc-bigs{grid-template-columns:repeat(2,minmax(0,1fr))}.sc-tiles{gap:6px}.sc-tile{padding:10px}.sc-tile b{font-size:17px}.sc-tile .pl-k{font-size:11.5px}.hide-m{display:none}}</style>
<footer id="sources" style="padding:24px 0 0"><p>매일 장 마감 뒤 다시 계산해요. 과거 성적이 앞으로의 결과를 보장하지 않아요. 모의투자는 가상 계좌예요. 투자 권유가 아니에요.</p></footer>`;
  return shell('', '성적표 | Gnomon Analytics', body, { active: 'scorecard', scripts: SCORE_JS });
}

export function renderTerms(): string {
  const sec = (id: string, title: string, items: string[]) => `<section class="block" id="${id}"><div class="card terms"><h2>${title}</h2><ul class="plain">${items.map((i) => `<li>${i}</li>`).join('')}</ul></div></section>`;
  const body = `<section class="hero" id="top"><div class="hero-main"><div class="eyebrow"><span>이용약관 · 면책</span><span>초안</span></div><h1>이용약관과 면책</h1>
<p class="hero-line">법률 검토 전 초안이에요. 유료 서비스를 열기 전에 검토를 거쳐 바뀔 수 있어요.</p></div></section>
<section class="block"><p class="mock-note"><b>초안이에요.</b> 지금 Gnomon Analytics는 무료 시험 운영 중이고, 요금제와 결제는 MOCK이에요.</p></section>
${sec('nature', '서비스의 성격', [
    'Gnomon Analytics는 공개 데이터로 계산한 기술 지표, 적정가·예측 범위, AI 해설을 보여 주는 리서치 도구예요.',
    '<b>투자 자문이나 매매 권유가 아니에요.</b> 특정 종목을 사고팔라고 권하지 않고, 매수·매도 신호나 목표가를 제시하지 않아요.',
    '투자 판단과 그 결과는 이용자 본인의 책임이에요.',
    '유료로 정보를 제공하기 전에 자본시장법상 유사투자자문업 신고 등 필요한 절차를 확인하고 따를 예정이에요.',
  ])}
${sec('data', '데이터와 계산의 한계', [
    '가격·수급·실적은 Naver 금융·네이버 증권, 공시는 OpenDART, 뉴스는 네이버 뉴스 검색과 RSS에서 가져와요. 출처의 오류나 지연이 그대로 반영될 수 있어요.',
    '데이터를 받지 못한 날은 페이지에 그 사실을 표시하고, 없는 숫자를 만들어 넣지 않아요.',
    '기술 신호는 지표를 요약한 값이고 오를 확률이 아니에요. 예측 범위는 최근 변동성으로 계산한 범위이고 목표가가 아니에요.',
    '백테스트와 모의투자 성과는 과거 데이터로 계산한 가상의 결과이고, 실제 수익을 보장하지 않아요.',
  ])}
${sec('ai', 'AI 해설의 한계', [
    'AI 해설은 그 리포트에 모은 근거만 보고 쓰도록 하고, 주장마다 근거 표시를 달아요. 그래도 틀리거나 빠뜨릴 수 있어요.',
    'AI 분석가들은 같은 AI가 서로 다른 관점을 맡아 쓴 의견이에요. 실제 사람의 의견이 아니에요.',
    '예측과 판단은 만든 날 그대로 기록하고, 나중에 실제 가격으로 채점해 성적표에 공개해요.',
  ])}
${sec('plans', '요금제와 크레딧 (초안)', [
    '지금 요금제와 결제는 MOCK이에요. 실제로 결제되지 않고, 요금제와 크레딧은 이용자 브라우저에만 저장돼요.',
    '정식 운영 때의 가격, 크레딧 유효기간, 환불 기준은 출시 전에 이 페이지에 확정해서 알려요.',
    '결제는 볼 수 있는 깊이만 바꿔요. 같은 종목의 신호·숫자·기록은 누구에게나 같아요.',
  ])}
${sec('privacy', '개인정보', [
    '지금은 회원가입이 없고, 이름·연락처·결제 정보를 받지 않아요.',
    '관심 종목, 요금제(MOCK), 크레딧(MOCK)은 이용자 브라우저의 저장소(localStorage)에만 남아요. 브라우저 데이터를 지우면 함께 사라져요.',
    '로그인이 생기면 수집 항목과 보관 기간을 이 페이지에 먼저 알려요.',
  ])}
${sec('contact', '문의', ['오류 신고와 리포트 요청은 GitHub 이슈로 받아요.'])}
<footer id="sources" style="padding:24px 0 0"><p>마지막 수정: 초안. 투자 권유가 아니에요.</p></footer>`;
  return shell('', '이용약관·면책 | Gnomon Analytics', body, {});
}

/** G-77: 모의투자 is part of the scorecard ('따라 했다면'); the old address forwards there. */
export function renderPaper(): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=scorecard.html#paper"><title>성적표 | Gnomon Analytics</title></head><body><a href="scorecard.html#paper">성적표로 이동</a></body></html>`;
}

/** '전체 보기' opens the rest of a list; '장부' opens a stock's ledger under its row. */
const SCORE_JS = `<script>
document.addEventListener('click', function (e) {
  var m = e.target.closest && e.target.closest('.more-all');
  if (m) { var box = m.parentNode; [].forEach.call(box.querySelectorAll('.more-row'), function (r) { r.hidden = false; }); m.remove(); return; }
  var o = e.target.closest && e.target.closest('.fr-open'); if (!o) return;
  var row = o.closest('tr').nextElementSibling, open = o.getAttribute('aria-expanded') !== 'true';
  if (row && row.classList.contains('fr-ledger')) { row.hidden = !open; o.setAttribute('aria-expanded', String(open)); o.textContent = open ? '닫기' : '장부 ›'; window.dispatchEvent(new Event('resize')); }
});
</script>`;
