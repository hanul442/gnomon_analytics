// Strategy arena panels (docs/DESIGN.md §5.5): champion card, the race list
// with equity sparklines, each strategy's current signal gauge, and the
// experiment ledger. Styled after the mockup's Lab screen (champion race,
// Monte Carlo, experiment ledger).

import type { ArenaResult, StrategyResult } from '../analysis/strategies.js';
import { miniGauge } from './renderMarket.js';

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
  return `<svg viewBox="0 0 ${w} ${h}" class="spark" role="img" aria-label="${esc(label)}"><line x1="0" x2="${w}" y1="${(h - 3 - ((1 - lo) / span) * (h - 6)).toFixed(1)}" y2="${(h - 3 - ((1 - lo) / span) * (h - 6)).toFixed(1)}" stroke="#e6dccb" stroke-dasharray="2 3"/><polyline fill="none" stroke="${up ? '#d1373d' : '#2a62c9'}" stroke-width="1.6" points="${pts}"/></svg>`;
}

const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true" class="crown"><path d="M3 18h18l-1.5-9-4.5 4-3-7-3 7-4.5-4z" fill="currentColor"/></svg>';
const signalBadge = (r: StrategyResult) => (r.key === 'hold' ? '<span class="badge b-LOW">기준선</span>' : r.position ? '<span class="badge v-BULLISH">보유 신호</span>' : '<span class="badge b-LOW">관망</span>');

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
<div class="race-sig">${signalBadge(r)}</div></div>`).join('');
  const gauges = a.results.filter((r) => r.key !== 'hold').map((r) => `<div class="hz"><div class="hz-top"><b>${esc(r.name)}</b><span>${r.rank}위</span></div>${miniGauge(r.score, `${r.name} 현재 신호`)}
<div class="hz-label ${sigTone(r.score)}">${r.score === null ? '판단 보류' : r.score >= 0.3 ? '강세' : r.score <= -0.3 ? '약세' : '중립'}</div>
<div class="hz-meta"><span>${r.position ? '보유 신호' : '관망'}</span>${r.position && r.target !== null ? `<span>목표 ${won(r.target)}</span>` : ''}</div>
<div class="muted small trig">${esc(r.trigger)}</div></div>`).join('');
  const ledger = a.results.map((r) => `<tr><td class="nowrap">${r.rank}. ${esc(r.name)}</td><td class="num ${tone(r.totalReturn)}">${pct(r.totalReturn)}</td><td class="num">${r.cagr === null ? '없음' : pct(r.cagr)}</td><td class="num">${sh(r.sharpe)}</td><td class="num down">${pct(r.maxDrawdown)}</td>
<td class="num">${r.trades}회</td><td class="num">${r.winRate === null ? '없음' : `${Math.round(r.winRate * 100)}%`}</td><td class="num">${Math.round(r.exposure * 100)}%</td>
<td class="num ${tone(r.oosReturn)}">${pct(r.oosReturn)}</td><td class="num">${r.monteCarlo ? `${pct(r.monteCarlo.p05, 0)} / ${pct(r.monteCarlo.p50, 0)} / ${pct(r.monteCarlo.p95, 0)}` : '없음'}</td></tr>`).join('');
  return `<section class="block" id="arena"><div class="block-head"><h2>전략 대결</h2><span class="muted small">${esc(a.from)} ~ ${esc(a.sessionDate)}, 일봉 ${a.bars}개</span></div>
${championCard(a)}
<div class="card race" style="margin-top:14px"><div class="head"><h2>챔피언 레이스</h2><span class="sub small">검증 구간(${esc(a.oosFrom)}~) 샤프 순</span></div>${rows}</div>
<div class="card" style="margin-top:14px"><div class="head"><h2>전략별 현재 신호</h2></div><div class="hz-row arena-gauges">${gauges}</div></div>
<details class="card more" style="margin-top:14px"><summary>실험 기록 (전략별 성적표)</summary><div class="table-wrap"><table class="compact"><thead><tr><th>전략</th><th class="num">전체 수익</th><th class="num">연환산</th><th class="num">샤프</th><th class="num">최대 낙폭</th><th class="num">거래</th><th class="num">승률</th><th class="num">보유 비중</th><th class="num">검증 수익</th><th class="num">몬테카를로 5/50/95%</th></tr></thead><tbody>${ledger}</tbody></table></div></details>
<p class="fine">BOT의 전략 규칙을 이 종목의 과거 일봉에 그대로 적용해 본 결과예요. 신호가 난 날의 다음 날부터 수익을 계산하고(미리 보기 없음), 왕복 거래 비용 ${(a.cost * 100).toFixed(2)}%를 빼요. 순위는 뒤쪽 30% 검증 구간의 샤프 비율로 매기고, 거래가 2번 미만이면 챔피언이 될 수 없어요. 몬테카를로는 실제 거래 수익을 무작위로 다시 뽑아 2,000번 돌린 결과예요. 과거 성적이 앞날을 보장하지 않고, 투자 권유가 아니에요.</p></section>`;
}

/** Top three for the home tab. */
export function arenaTeaser(a: ArenaResult | null): string {
  if (!a) return '';
  const top = a.results.filter((r) => r.qualified).slice(0, 3);
  return `<section class="block"><div class="block-head"><h2>전략 챔피언 레이스</h2><a href="#tab-technical" class="more-link">전체 보기 ›</a></div>
<div class="card race">${top.map((r) => `<div class="race-row${r.key === a.championKey ? ' is-champ' : ''}">${rankMark(r)}<div class="race-name"><b>${esc(r.name)}</b><span class="muted small">${esc(r.origin)}</span></div>${equitySpark(r.equity, `${r.name} 누적 수익 곡선`)}
<div class="race-num"><b class="${tone(r.oosReturn)}">${pct(r.oosReturn)}</b><span class="muted small">검증</span></div><div class="race-sig">${signalBadge(r)}</div></div>`).join('')}</div></section>`;
}
