// Strategy arena panels (docs/DESIGN.md §5.5): champion card, the race list
// with equity sparklines, each strategy's current signal gauge, and the
// experiment ledger. Styled after the mockup's Lab screen (champion race,
// Monte Carlo, experiment ledger).

import { ARENA_COST, type ArenaResult, type StrategyResult } from '../analysis/strategies.js';
import { PAPER_START_KRW, type PaperBook } from '../analysis/paper.js';
import { miniGauge } from './renderMarket.js';
import type { AnalystScore } from '../analysis/analysts.js';
import { ANALYSTS } from '../analysis/analysts.js';
import type { Commentary } from '../analysis/commentary.js';


const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`;
const pct = (v: number | null, d = 1) => (v === null ? '없음' : `${v > 0 ? '+' : ''}${(v * 100).toFixed(d)}%`);
const tone = (v: number | null) => (v === null || v === 0 ? '' : v > 0 ? 'up' : 'down');
const sh = (v: number | null) => (v === null ? '없음' : v.toFixed(2));
/** Colour only when the gauge label itself says 강세 or 약세. */
const sigTone = (v: number | null) => (v === null ? '' : v >= 0.3 ? 'up' : v <= -0.3 ? 'down' : '');

function equitySpark(values: readonly number[], label: string): string {
  if (values.length < 2) return '';
  const w = 140, h = 40, lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1)}`).join(' ');
  const up = values.at(-1)! >= 1;
  return `<svg viewBox="0 0 ${w} ${h}" class="spark" role="img" aria-label="${esc(label)}"><line x1="0" x2="${w}" y1="${(h - 3 - ((1 - lo) / span) * (h - 6)).toFixed(1)}" y2="${(h - 3 - ((1 - lo) / span) * (h - 6)).toFixed(1)}" stroke="#cdd7e4" stroke-dasharray="2 3"/><polyline fill="none" stroke="${up ? '#d1373d' : '#2a62c9'}" stroke-width="1.6" points="${pts}"/></svg>`;
}

const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true" class="crown"><path d="M3 18h18l-1.5-9-4.5 4-3-7-3 7-4.5-4z" fill="currentColor"/></svg>';
const signalBadge = (r: StrategyResult) => (r.key === 'hold' ? '<span class="badge b-LOW">기준선</span>' : r.position ? '<span class="badge v-BULLISH">보유 신호</span>' : '<span class="badge b-LOW">관망</span>');

/** G-91: each strategy's current bull/bear stance, shown in its race row (no separate gauge card). */
function stancePill(r: StrategyResult): string {
  if (r.key === 'hold') return '';
  const v = r.score;
  const [cls, label] = v === null ? ['st-none', '판단 보류'] : v >= 0.3 ? ['st-bull', '▲ 강세'] : v <= -0.3 ? ['st-bear', '▼ 약세'] : ['st-mid', '● 중립'];
  return `<span class="race-stance ${cls}" title="현재 신호 점수 ${v === null ? '없음' : v.toFixed(2)}">${label}</span>`;
}

function rankMark(r: StrategyResult): string {
  return r.rank <= 3 && r.qualified ? `<span class="rank r${r.rank}">${CROWN}<b>${r.rank}</b></span>` : `<span class="rank"><b>${r.rank}</b></span>`;
}

function championCard(a: ArenaResult): string {
  const c = a.results.find((r) => r.key === a.championKey);
  if (!c) return '<div class="card"><p class="empty">조건을 채운 전략이 아직 없어요.</p></div>';
  const mc = c.monteCarlo;
  return `<div class="card champion"><div class="head"><h2>${CROWN} 챔피언: ${esc(c.name)}</h2>${signalBadge(c)}</div>
<div class="champ-grid"><div>${miniGauge(c.score, `${c.name} 현재 신호`)}<div class="hz-label ${sigTone(c.score)}">${c.score === null ? '판단 보류' : c.score >= 0.3 ? '강세' : c.score <= -0.3 ? '약세' : '중립'}</div></div>
<div><p class="rule">${esc(c.rule)}</p><div class="muted small">출처: ${esc(c.origin)}</div>
<div class="facts"><div><span class="label">검증 구간 수익률</span><b class="${tone(c.oosReturn)}">${pct(c.oosReturn)}</b></div><div><span class="label">검증 구간 샤프</span><b>${sh(c.oosSharpe)}</b></div><div><span class="label">전체 최대 낙폭</span><b class="down">${pct(c.maxDrawdown)}</b></div>
${c.position ? `<div><span class="label">전략 목표가</span><b>${c.target === null ? '없음' : won(c.target)}</b></div><div><span class="label">무효화 가격</span><b>${c.invalidation === null ? '없음' : won(c.invalidation)}</b></div>` : ''}
${mc ? `<div><span class="label">몬테카를로 손실 확률</span><b>${Math.round(mc.lossProbability * 100)}%</b></div>` : ''}</div>
<p class="reason">${esc(c.trigger)}</p></div></div></div>`;
}

export function arenaPanel(a: ArenaResult | null): string {
  if (!a) return '<div class="card"><p class="empty">일봉이 120개보다 적어서 전략 대결을 하지 않았어요.</p></div>';
  const rows = a.results.map((r) => `<div class="race-row${r.key === a.championKey ? ' is-champ' : ''}">${rankMark(r)}
<div class="race-name"><b>${esc(r.name)}</b><span class="muted small">${esc(r.origin)}</span></div>
${equitySpark(r.equity, `${r.name} 누적 수익 곡선`)}
<div class="race-num rn-total"><b class="${tone(r.totalReturn)}">${pct(r.totalReturn)}</b><span class="muted small">전체</span></div>
<div class="race-num"><b class="${tone(r.oosReturn)}">${pct(r.oosReturn)}</b><span class="muted small">검증</span></div>
<div class="race-num rn-sharpe"><b>${sh(r.oosSharpe)}</b><span class="muted small">샤프</span></div>
<div class="race-sig">${stancePill(r)}${signalBadge(r)}${r.key === 'hold' ? '' : `<a href="#tab-chart" class="see-chart" data-show-strategy="${esc(r.key)}">매매 시점 보기 ›</a>`}</div>${r.key === 'hold' ? '' : `<div class="race-why">${r.position && r.target !== null ? `<b>목표 ${won(r.target)}</b> · ` : ''}${esc(r.trigger)}</div>`}</div>`).join('');
  const tradeTables = a.results.filter((r) => r.key !== 'hold' && r.tradeLog.length).map((r) => `<details class="trade-log"><summary>${r.rank}위 ${esc(r.name)} 매매 기록 ${r.trades}회</summary><div class="table-wrap"><table class="compact"><thead><tr><th>매수일</th><th class="num">매수가</th><th>매도일</th><th class="num">매도가</th><th class="num">수익</th></tr></thead><tbody>${[...r.tradeLog].reverse().map((t) => `<tr><td>${esc(t.entry)}</td><td class="num">${won(t.entryPrice)}</td><td>${t.exit ? esc(t.exit) : '<b>보유 중</b>'}</td><td class="num">${t.exitPrice === null ? '' : won(t.exitPrice)}</td><td class="num ${tone(t.ret)}">${pct(t.ret)}</td></tr>`).join('')}</tbody></table></div></details>`).join('');
  const ledger = a.results.map((r) => `<tr><td class="nowrap">${r.rank}. ${esc(r.name)}</td><td class="num ${tone(r.totalReturn)}">${pct(r.totalReturn)}</td><td class="num">${r.cagr === null ? '없음' : pct(r.cagr)}</td><td class="num">${sh(r.sharpe)}</td><td class="num down">${pct(r.maxDrawdown)}</td>
<td class="num">${r.trades}회</td><td class="num">${r.winRate === null ? '없음' : `${Math.round(r.winRate * 100)}%`}</td><td class="num">${Math.round(r.exposure * 100)}%</td>
<td class="num ${tone(r.oosReturn)}">${pct(r.oosReturn)}</td><td class="num">${r.monteCarlo ? `${pct(r.monteCarlo.p05, 0)} / ${pct(r.monteCarlo.p50, 0)} / ${pct(r.monteCarlo.p95, 0)}` : '없음'}</td></tr>`).join('');
  return `<section class="block" id="arena"><div class="block-head"><h2>전략 대결</h2><span class="muted small">${esc(a.from)} ~ ${esc(a.sessionDate)}, 일봉 ${a.bars}개</span></div>
${championCard(a)}
<div class="card race" style="margin-top:14px"><div class="head"><h2>챔피언 레이스</h2><span class="sub small">검증 구간(${esc(a.oosFrom)}~) 샤프 순 · 지금 강세/약세</span></div>${rows}</div>
<div class="card" style="margin-top:14px"><div class="head"><h2>전략별 매매 기록</h2><span class="sub small">신호가 난 날의 종가 기준, 최근 순</span></div>${tradeTables || '<p class="empty">매매 기록이 없어요.</p>'}</div>
<details class="card more" style="margin-top:14px"><summary>실험 기록 (전략별 성적표)</summary><div class="table-wrap"><table class="compact"><thead><tr><th>전략</th><th class="num">전체 수익</th><th class="num">연환산</th><th class="num">샤프</th><th class="num">최대 낙폭</th><th class="num">거래</th><th class="num">승률</th><th class="num">보유 비중</th><th class="num">검증 수익</th><th class="num">몬테카를로 5/50/95%</th></tr></thead><tbody>${ledger}</tbody></table></div></details>
<p class="fine">BOT의 전략 규칙을 이 종목의 과거 일봉에 그대로 적용해 본 결과예요. 신호가 난 날의 다음 날부터 수익을 계산하고(미리 보기 없음), 왕복 거래 비용 ${(a.cost * 100).toFixed(2)}%를 빼요. 순위는 뒤쪽 30% 검증 구간의 샤프 비율로 매기고, 거래가 2번 미만이면 챔피언이 될 수 없어요. 몬테카를로는 실제 거래 수익을 무작위로 다시 뽑아 2,000번 돌린 결과예요. 과거 성적이 앞날을 보장하지 않고, 투자 권유가 아니에요.</p></section>`;
}

/** Top three for the home tab. */
export function arenaTeaser(a: ArenaResult | null): string {
  if (!a) return '';
  const top = a.results.filter((r) => r.qualified).slice(0, 3);
  return `<section class="block"><div class="block-head"><h2>전략 챔피언 레이스</h2><a href="#tab-strategy" class="more-link">전체 보기 ›</a></div>
<div class="card race race-mini">${top.map((r) => `<div class="race-row${r.key === a.championKey ? ' is-champ' : ''}">${rankMark(r)}<div class="race-name"><b>${esc(r.name)}</b><span class="muted small">${esc(r.origin)}</span></div>${equitySpark(r.equity, `${r.name} 누적 수익 곡선`)}
<div class="race-num"><b class="${tone(r.oosReturn)}">${pct(r.oosReturn)}</b><span class="muted small">검증</span></div><div class="race-sig">${signalBadge(r)}</div></div>`).join('')}</div></section>`;
}

/** Free: the champion's name only. */
export function arenaHeadline(a: ArenaResult | null): string {
  const champ = a?.results.find((r) => r.key === a.championKey);
  return `<section class="block arena-head"><div class="card paper-link"><div><div class="pl-k">이 종목의 전략 챔피언</div><b style="font-size:18px">${champ ? esc(champ.name) : '아직 없어요'}</b><p class="muted small">전략 8개를 4년 동안 백테스트해 검증 구간 성과로 순위를 매겨요. 순위표는 플러스, 매매 시점·몬테카를로는 프로부터 볼 수 있어요.</p></div></div></section>`;
}

/** Plus: every strategy's rank, current signal and out-of-sample return, without trades or curves. */
export function arenaRanking(a: ArenaResult | null): string {
  if (!a) return '<div class="card"><p class="empty">전략 대결 기록이 없어요.</p></div>';
  const rows = a.results.filter((r) => r.key !== 'hold').map((r) => `<tr${r.key === a.championKey ? ' class="is-champ"' : ''}><td>${r.rank}</td><td class="nm"><b>${esc(r.name)}</b><div class="muted small">${esc(r.origin)}</div></td><td>${signalBadge(r)}</td><td class="num ${tone(r.oosReturn)}">${pct(r.oosReturn)}</td><td class="num">${r.oosTrades}</td></tr>`).join('');
  const hold = a.results.find((r) => r.key === 'hold');
  return `<section class="block"><div class="block-head"><h2>전략 순위표</h2><span class="muted small">${esc(a.oosFrom)}부터 검증 구간${hold ? ` · 보유 ${pct(hold.oosReturn)}` : ''}</span></div><div class="card table-wrap"><table class="compact"><thead><tr><th>순위</th><th>전략</th><th>지금 신호</th><th class="num">검증 구간 수익</th><th class="num">거래 수</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

// ---- AI analyst battle (docs/DESIGN.md §5.6) ----


const STANCE = { BULLISH: ['강세', 'v-BULLISH'], BEARISH: ['약세', 'v-BEARISH'], NEUTRAL: ['중립', 'v-NEUTRAL'] } as const;

export function analystBattle(board: readonly AnalystScore[], c: Commentary | undefined, baseClose: number | null): string {
  const views = c?.status === 'OK' ? c.analysts ?? [] : [];
  if (!views.length && !board.some((b) => b.latest)) {
    return '<section class="block" id="analysts"><div class="block-head"><h2>AI 분석가 대결</h2></div><div class="card"><p class="empty">아직 분석가 예측이 없어요. 주간 리포트(금요일 장 마감 뒤)를 만들 때 기록하고, 20거래일 뒤 실제 가격으로 채점해요.</p></div></section>';
  }
  const anyScored = board.some((b) => b.scored > 0);
  const cards = ANALYSTS.map((a) => {
    const v = views.find((x) => x.analyst === a.id);
    const s = board.find((b) => b.analyst === a.id);
    const initial = a.name.slice(0, 1);
    const move = v && baseClose ? (v.target / baseClose - 1) : null;
    return `<div class="analyst"><div class="an-top"><span class="avatar" aria-hidden="true">${esc(initial)}</span><div class="an-name"><b>${esc(a.name)}</b><span class="muted small">${esc(a.focus)}</span></div>
${v ? `<span class="badge ${STANCE[v.stance][1]}">${STANCE[v.stance][0]}</span>` : '<span class="badge b-LOW">의견 없음</span>'}</div>
${v ? `<div class="an-nums"><div><span class="label">확신도</span><b>${v.confidence}%</b><div class="conf"><i style="width:${v.confidence}%"></i></div></div><div><span class="label">20거래일 뒤 예상</span><b>${won(v.target)}</b><span class="small ${tone(move)}">${pct(move)}</span></div></div>
<p class="an-why">${esc(v.rationale.text)}</p>` : ''}
<div class="muted small">${s && s.scored ? `채점 ${s.scored}건, 방향 적중 ${Math.round(s.hitRate! * 100)}%, 오차 중앙값 ${s.medianErrorPct!.toFixed(1)}%${s.rank ? `, ${s.rank}위` : ''}` : `채점 대기 ${s?.pending ?? 0}건`}</div></div>`;
  }).join('');
  const ranked = board.filter((b) => b.rank !== null);
  const table = anyScored ? `<div class="table-wrap"><table class="compact"><thead><tr><th>순위</th><th>분석가</th><th class="num">채점</th><th class="num">방향 적중</th><th class="num">오차 중앙값</th></tr></thead><tbody>${ranked.map((b) => `<tr><td>${b.rank}</td><td>${esc(b.name)}</td><td class="num">${b.scored}건</td><td class="num">${Math.round(b.hitRate! * 100)}%</td><td class="num">${b.medianErrorPct!.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">첫 채점은 첫 예측 뒤 20거래일이 지나면 나와요. 그때부터 방향 적중률과 목표가 오차로 순위를 매겨요.</p>';
  return `<section class="block" id="analysts"><div class="block-head"><h2>AI 분석가 대결</h2><span class="muted small">BOT 투자위원회 분석가 6명, 20거래일 예측</span></div>
<div class="analyst-grid">${cards}</div>
<div class="card" style="margin-top:14px"><div class="head"><h2>적중 순위</h2></div>${table}</div>
<p class="fine">분석가는 같은 AI가 서로 다른 관점을 맡아 쓴 의견이에요. 예측은 쓴 날 그대로 기록하고 고치지 않아요. 방향 적중은 예상 가격과 실제 가격이 기준가의 같은 쪽에 있는지로 보고(중립은 ±2% 안), 오차는 예상 가격과 실제 가격의 차이예요. 투자 권유가 아니에요.</p></section>`;
}

/** The analysts' scoreboard on its own (the calls themselves sit in the committee parliament). */
export function analystScores(board: readonly AnalystScore[]): string {
  const ranked = board.filter((b) => b.rank !== null);
  const pending = board.reduce((n, b) => n + b.pending, 0);
  const body = ranked.length ? `<div class="table-wrap"><table class="compact"><thead><tr><th>순위</th><th>분석가</th><th class="num">채점</th><th class="num">방향 적중</th><th class="num">오차 중앙값</th></tr></thead><tbody>${ranked.map((b) => `<tr><td>${b.rank}</td><td>${esc(b.name)}</td><td class="num">${b.scored}건</td><td class="num">${Math.round(b.hitRate! * 100)}%</td><td class="num">${b.medianErrorPct!.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>`
    : `<p class="muted small">첫 채점은 첫 예측 뒤 20거래일이 지나면 나와요(지금 채점 대기 ${pending}건). 그때부터 방향 적중률과 목표가 오차로 순위를 매겨요.</p>`;
  return `<section class="block" id="analysts"><div class="block-head"><h2>분석가 적중 순위</h2><span class="muted small">20거래일 예측을 실제 가격으로 채점</span></div><div class="card">${body}
<p class="fine">분석가는 같은 AI가 서로 다른 관점을 맡아 쓴 의견이에요. 예측은 쓴 날 그대로 기록하고 고치지 않아요. 방향 적중은 예상 가격과 실제 가격이 기준가의 같은 쪽에 있는지로 보고(중립은 ±2% 안), 오차는 예상 가격과 실제 가격의 차이예요. 투자 권유가 아니에요.</p></div></section>`;
}

/** Paper-trading ledger (G-21): each follower's virtual account, replayed from logged entries. */
export function paperPanel(books: readonly PaperBook[] | undefined): string {
  const list = books ?? [];
  const note = `<p class="fine">장 마감 뒤 기록할 때마다 따라 하는 쪽마다 "그날 종가부터 보유할지"를 기록하고 고치지 않아요. 수익은 다음 거래일부터 계산하고, 사고팔 때마다 비용 ${(ARENA_COST * 50).toFixed(3)}%를 빼요. 공매도는 하지 않아요. AI 분석가는 강세 판단이면 보유, 중립·약세면 현금이에요. 가상 계좌이고, 투자 권유가 아니에요.</p>`;
  if (!list.length) return `<section class="block"><div class="block-head"><h2>모의투자 장부</h2></div><div class="card"><p class="empty">아직 기록이 없어요. 장 마감 뒤 첫 기록부터 쌓여요.</p>${note}</div></section>`;
  const since = list.map((b) => b.since).sort()[0]!;
  const hold = list.find((b) => b.follower === 'hold');
  const rows = list.map((b) => {
    const diff = hold && b.follower !== 'hold' ? b.totalReturn - hold.totalReturn : null;
    return `<div class="paper-row${b.follower === 'champion' ? ' is-champ' : ''}"><div class="pr-name"><b>${esc(b.label)}</b><span class="muted small">${esc(b.follower === 'champion' ? `지금 따르는 전략: ${b.basis}` : b.follower === 'hold' ? '비교 기준' : `최근 판단: ${b.basis}`)}</span></div>
${equitySpark(b.equity, `${b.label} 가상 계좌 추이`)}
<div class="pr-num"><b class="${tone(b.totalReturn)}">${pct(b.totalReturn, 2)}</b><span class="muted small">${won(b.balance)}</span></div>
<div class="pr-num"><span class="badge ${b.position ? 'b-HIGH' : 'b-LOW'}">${b.position ? '보유' : '현금'}</span><span class="muted small">거래 ${b.trades.length}번${diff === null ? '' : ` · 보유 대비 <span class="${tone(diff)}">${diff > 0 ? '+' : ''}${(diff * 100).toFixed(2)}%p</span>`}</span></div></div>`;
  }).join('');
  const trades = list.flatMap((b) => b.trades.map((t) => ({ ...t, who: b.label }))).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 20);
  const log = trades.length ? `<div class="table-wrap"><table class="compact nowrap-cells"><thead><tr><th>날짜</th><th>누가</th><th>주문</th><th class="num">가격(종가)</th><th>근거</th></tr></thead><tbody>${trades.map((t) => `<tr><td class="nowrap">${esc(t.date)}</td><td>${esc(t.who)}</td><td class="${t.action === 'BUY' ? 'up' : 'down'}">${t.action === 'BUY' ? '매수' : '매도'}</td><td class="num">${won(t.price)}</td><td>${esc(t.basis)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">아직 주문이 없어요.</p>';
  return `<section class="block"><div class="block-head"><h2>모의투자 장부</h2><span class="muted">${esc(since)}부터 · 가상 ${won(PAPER_START_KRW)}씩</span></div>
<div class="card"><div class="paper-list">${rows}</div>${note}</div></section>
<section class="block"><div class="block-head"><h2>주문 기록</h2><span class="muted">최근 20건</span></div><div class="card">${log}</div></section>`;
}
