// Infographics at the top of the merged tabs (G-129): 타이밍 (기술 + 전략) opens with gauges, the indicator
// vote and the champion strategy's stance; 기업 체력 (수급 + 종목정보) opens with a five-axis health chart and
// the financial statements table. Everything is drawn from numbers the report already holds; nothing new is
// fetched, and an axis without data is drawn as missing rather than guessed.

import type { DailyReport } from './dailyReport.js';
import type { MarketSection } from './marketSection.js';
import type { FinancePeriod } from '../types.js';
import { miniGauge } from './renderMarket.js';
import { esc } from './html.js';
import { won } from './format.js';

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const fmtPct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? '없음' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`);

/** 타이밍 한눈에: 단기·중기·장기 gauges, the 16-indicator vote, the champion strategy and the fair-value band. */
export function timingInfographic(report: DailyReport): string {
  const m = report.market, close = report.price?.close ?? null;
  const pick = ['SHORT', 'MEDIUM', 'LONG'] as const;
  const gauges = m ? pick.map((k) => m.horizons.find((h) => h.key === k)).filter((h) => h) : [];
  const t = report.technicals, c = t?.counts;
  const total = c ? c.bullish + c.neutral + c.bearish : 0;
  const champ = m?.arena?.results.find((r) => r.key === m.arena!.championKey) ?? null;
  const fv = m?.fairValue ?? null;
  if (!gauges.length && !total && !champ && !fv) return '';
  const vote = total ? `<div class="ig-vote"><div class="ig-k">지표 16개의 표</div><div class="ig-stack" role="img" aria-label="강세 ${c!.bullish}, 중립 ${c!.neutral}, 약세 ${c!.bearish}">${(['bullish', 'neutral', 'bearish'] as const).map((k) => `<i class="ig-${k}" style="flex:${c![k]}"></i>`).join('')}</div><div class="ig-legend"><span><b class="up">${c!.bullish}</b> 강세</span><span><b>${c!.neutral}</b> 중립</span><span><b class="down">${c!.bearish}</b> 약세</span></div></div>` : '';
  const strat = champ ? `<div class="ig-champ"><div class="ig-k">전략 챔피언</div><div class="ig-cn"><span class="ig-pos ${champ.position ? 'on' : ''}">${champ.position ? '보유' : '관망'}</span><b>${esc(champ.name)}</b></div><small>검증 구간 ${fmtPct(champ.oosReturn * 100)}${champ.beatsHold === true ? ' · 보유 전략보다 나음' : champ.beatsHold === false ? ' · 보유 전략보다 못함' : ''}</small></div>` : '';
  const band = fv && close ? (() => {
    const lo = Math.min(fv.low, close) * 0.98, hi = Math.max(fv.high, close) * 1.02, at = (v: number) => ((v - lo) / (hi - lo)) * 100;
    return `<div class="ig-fv"><div class="ig-k">기술적 적정가 범위</div><div class="ig-fbar"><span style="left:${at(fv.low).toFixed(1)}%;width:${(at(fv.high) - at(fv.low)).toFixed(1)}%"></span><i style="left:${at(close).toFixed(1)}%"></i></div><div class="ig-legend"><span>${won(fv.low)}</span><span><b>지금 ${won(close)}</b></span><span>${won(fv.high)}</span></div></div>`;
  })() : '';
  return `<section class="block"><div class="card ig-card"><div class="head"><h2>타이밍 한눈에</h2><span class="sub">기술 신호와 전략을 함께</span></div>
${gauges.length ? `<div class="ig-gauges">${gauges.map((h) => `<div class="ig-g">${miniGauge(h!.summary.score, h!.summary.label)}<b>${esc(h!.label)}</b><small>${esc(h!.span)}</small></div>`).join('')}</div>` : ''}
<div class="ig-row">${vote}${strat}${band}</div></div></section>`;
}

type Axis = { key: string; label: string; score: number | null; value: string; note: string };

/** The five axes of 기업 체력, each 0–100 from simple, stated thresholds. */
export function healthAxes(m: MarketSection, close: number | null): Axis[] {
  const q = m.quarters.filter((p) => !p.isEstimate), y = m.years.filter((p) => !p.isEstimate);
  const last = q.at(-1), yearAgo = last ? q.find((p) => p.period === `${Number(last.period.slice(0, 4)) - 1}${last.period.slice(4)}`) : undefined;
  const salesNow = last?.metrics['매출액'] ?? null, salesThen = yearAgo?.metrics['매출액'] ?? null;
  const growth = salesNow != null && salesThen ? (salesNow / salesThen - 1) * 100 : null;
  const om = y.at(-1)?.metrics['영업이익률'] ?? last?.metrics['영업이익률'] ?? null;
  const debt = last?.metrics['부채비율'] ?? y.at(-1)?.metrics['부채비율'] ?? null;
  const f20 = m.flows?.sums.find((s) => s.days === 20);
  const inst = f20 ? (f20.foreignValue ?? f20.foreign ?? 0) + (f20.institutionValue ?? f20.institution ?? 0) : null;
  const both = f20 ? [f20.foreign, f20.institution].filter((v) => (v ?? 0) > 0).length : 0;
  const s = m.snapshot, target = s?.consensus?.targetPriceMean, upside = target && close ? (target / close - 1) * 100 : null;
  const per = s?.per ?? null;
  const value = upside != null ? clamp(50 + upside * 1.5) : per != null && per > 0 ? (per < 10 ? 80 : per < 20 ? 60 : per < 40 ? 40 : 20) : null;
  return [
    { key: 'growth', label: '성장', score: growth == null ? null : clamp(50 + growth * 2.5), value: growth == null ? '자료 없음' : `매출 ${fmtPct(growth)}`, note: '최근 분기 매출, 1년 전 같은 분기 대비' },
    { key: 'profit', label: '수익성', score: om == null ? null : clamp(om * 5), value: om == null ? '자료 없음' : `영업이익률 ${om.toFixed(1)}%`, note: '20%면 만점' },
    { key: 'safety', label: '안정성', score: debt == null ? null : clamp(100 - debt / 2), value: debt == null ? '자료 없음' : `부채비율 ${debt.toFixed(0)}%`, note: '0%면 만점, 200%면 0점' },
    { key: 'flow', label: '수급', score: f20 ? (both === 2 ? 85 : both === 1 ? (inst != null && inst > 0 ? 65 : 45) : 20) : null, value: f20 ? (both === 2 ? '외국인·기관 동반 순매수' : both === 1 ? '외국인·기관 엇갈림' : '외국인·기관 순매도') : '자료 없음', note: '최근 20거래일' },
    { key: 'value', label: '가치', score: value, value: upside != null ? `목표가까지 ${fmtPct(upside)}` : per != null ? `PER ${per.toFixed(1)}배` : '자료 없음', note: upside != null ? '증권가 평균 목표가 기준' : 'PER 기준' },
  ];
}

function radar(axes: readonly Axis[]): string {
  const cx = 110, cy = 104, r = 78, n = axes.length;
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v] as const; };
  const ring = (v: number) => axes.map((_, i) => pt(i, v).map((x) => x.toFixed(1)).join(',')).join(' ');
  const shape = axes.map((a, i) => pt(i, (a.score ?? 0) / 100).map((x) => x.toFixed(1)).join(',')).join(' ');
  const labels = axes.map((a, i) => { const [x, y] = pt(i, 1.2); return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" class="${a.score == null ? 'na' : ''}">${esc(a.label)}</text>`; }).join('');
  return `<svg class="ig-radar" viewBox="0 0 220 210" role="img" aria-label="${axes.map((a) => `${a.label} ${a.score == null ? '자료 없음' : Math.round(a.score) + '점'}`).join(', ')}">
${[0.33, 0.66, 1].map((v) => `<polygon points="${ring(v)}" class="grid"/>`).join('')}${axes.map((_, i) => { const [x, y] = pt(i, 1); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="grid"/>`; }).join('')}
<polygon points="${shape}" class="area"/>${axes.map((a, i) => a.score == null ? '' : (() => { const [x, y] = pt(i, a.score / 100); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="dot"><title>${esc(a.label)} ${Math.round(a.score)}점</title></circle>`; })()).join('')}${labels}</svg>`;
}

/** 기업 체력 한눈에: the radar and one tile per axis with its number and verdict. */
export function healthInfographic(m: MarketSection | undefined, close: number | null): string {
  if (!m) return '';
  const axes = healthAxes(m, close);
  if (axes.every((a) => a.score == null)) return '';
  const verdict = (s: number | null) => (s == null ? ['na', '자료 없음'] : s >= 67 ? ['good', '좋음'] : s >= 34 ? ['mid', '보통'] : ['warn', '주의']);
  return `<section class="block"><div class="card ig-card"><div class="head"><h2>기업 체력 한눈에</h2><span class="sub">성장·수익성·안정성·수급·가치</span></div>
<div class="ig-health">${radar(axes)}<div class="ig-tiles">${axes.map((a) => { const [cls, word] = verdict(a.score); return `<div class="ig-tile"><div><b>${esc(a.label)}</b><span class="ig-v ${cls}">${word}</span></div><strong>${esc(a.value)}</strong><small>${esc(a.note)}</small></div>`; }).join('')}</div></div>
<p class="fine">점수는 위 기준으로 단순 환산한 참고값이에요. 업종마다 적정 수준이 달라서 같은 업종끼리 비교해 보세요.</p></div></section>`;
}

const ROWS: readonly [string, string][] = [['매출액', '억원'], ['영업이익', '억원'], ['당기순이익', '억원'], ['지배주주순이익', '억원'], ['영업이익률', '%'], ['순이익률', '%'], ['ROE', '%'], ['부채비율', '%'], ['당좌비율', '%'], ['유보율', '%'], ['EPS', '원'], ['BPS', '원'], ['주당배당금', '원']];

/** 재무제표 (요약): every headline line Naver gives, by year and by quarter, estimates marked. */
export function statementsCard(m: MarketSection | undefined): string {
  if (!m || (!m.years.length && !m.quarters.length)) return '';
  const table = (ps: readonly FinancePeriod[], label: (p: FinancePeriod) => string) => {
    const rows = ROWS.filter(([k]) => ps.some((p) => p.metrics[k] != null));
    const cell = (v: number | null | undefined, unit: string) => (v == null ? '<td class="num muted">-</td>' : `<td class="num${v < 0 ? ' down' : ''}">${unit === '%' ? v.toFixed(1) : Math.round(v).toLocaleString('ko-KR')}</td>`);
    return `<div class="table-wrap ig-fs"><table class="compact"><thead><tr><th>항목</th>${ps.map((p) => `<th class="num">${label(p)}${p.isEstimate ? '<small>추정</small>' : ''}</th>`).join('')}</tr></thead><tbody>${rows.map(([k, unit]) => `<tr><th scope="row">${k}<small>${unit}</small></th>${ps.map((p) => cell(p.metrics[k], unit)).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const years = m.years.slice(-5), quarters = m.quarters.slice(-6);
  return `<section class="block" id="statements"><div class="card"><div class="head"><h2>재무제표</h2><span class="sub">요약 손익·재무비율</span></div>
<div class="seg ig-seg" role="tablist" aria-label="기간">${years.length ? '<button type="button" data-fs="y" aria-selected="true">연간</button>' : ''}${quarters.length ? `<button type="button" data-fs="q" aria-selected="${years.length ? 'false' : 'true'}">분기</button>` : ''}</div>
${years.length ? `<div data-fsl="y">${table(years, (p) => p.period.slice(0, 4))}</div>` : ''}${quarters.length ? `<div data-fsl="q"${years.length ? ' hidden' : ''}>${table(quarters, (p) => `${p.period.slice(2, 4)}.${p.period.slice(4)}`)}</div>` : ''}
<p class="fine">출처: 네이버 증권(기업 실적 분석, IFRS 연결 기준). 추정은 증권사 컨센서스예요. 재무상태표·현금흐름표 전체는 다음 업데이트에서 DART 공시로 붙일 예정이에요.</p></div></section>`;
}

export const INFOGRAPHIC_CSS = `.ig-card .head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.ig-card h2{font-size:17px;margin:0 0 6px}
.ig-gauges{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:4px 0 10px}.ig-g{display:flex;flex-direction:column;align-items:center;text-align:center}.ig-g svg{width:100%;max-width:150px}.ig-g b{font-size:14px}.ig-g small{font-size:11px;color:var(--muted)}
.ig-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ig-row>div{background:#f6f8fc;border-radius:14px;padding:12px 14px;min-width:0}.ig-k{font-size:12px;font-weight:800;color:var(--fg2);margin-bottom:8px}
.ig-stack{display:flex;height:12px;border-radius:99px;overflow:hidden;background:#e9edf3}.ig-stack i{display:block}.ig-bullish{background:#e5484d}.ig-neutral{background:#c4cbc9}.ig-bearish{background:#3e63dd}.ig-legend{display:flex;justify-content:space-between;gap:6px;font-size:12px;color:var(--muted);margin-top:6px}.ig-legend b{color:var(--fg)}
.ig-cn{display:flex;align-items:center;gap:8px;min-width:0}.ig-cn b{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ig-pos{flex:none;font-size:12px;font-weight:800;border-radius:99px;padding:2px 9px;background:#e9edf3;color:var(--fg2)}.ig-pos.on{background:#fde8e8;color:#b4232b}.ig-champ small{display:block;font-size:12px;color:var(--muted);margin-top:6px}
.ig-fbar{position:relative;height:12px;border-radius:99px;background:#e9edf3}.ig-fbar span{position:absolute;top:0;bottom:0;background:#b9cbea;border-radius:99px}.ig-fbar i{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--navy,#13294b);border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.ig-health{display:grid;grid-template-columns:240px minmax(0,1fr);gap:16px;align-items:center}.ig-radar{width:100%;max-width:260px;margin:0 auto;display:block}.ig-radar .grid{fill:none;stroke:#dfe5ee;stroke-width:1}.ig-radar .area{fill:rgba(19,41,75,.16);stroke:var(--navy,#13294b);stroke-width:2;stroke-linejoin:round}.ig-radar .dot{fill:var(--navy,#13294b)}.ig-radar text{font-size:12px;font-weight:700;fill:var(--fg2)}.ig-radar text.na{fill:#aab3c2}
.ig-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.ig-tile{background:#f6f8fc;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:3px;min-width:0}.ig-tile>div{display:flex;justify-content:space-between;align-items:center;gap:6px}.ig-tile strong{font-size:14px}.ig-tile small{font-size:11.5px;color:var(--muted)}.ig-v{font-size:11.5px;font-weight:800;border-radius:99px;padding:1px 8px}.ig-v.good{background:#e6f4ea;color:#1d6b3a}.ig-v.mid{background:#eef1f5;color:var(--fg2)}.ig-v.warn{background:#fde8e8;color:#9b1c1c}.ig-v.na{background:#f1f3f6;color:#9aa4b2}
.ig-seg{margin:2px 0 10px;width:max-content}.ig-fs table{min-width:520px}.ig-fs th[scope=row]{position:sticky;left:0;background:#fff;white-space:nowrap;text-align:left;font-weight:700}.ig-fs th small,.ig-fs th[scope=row] small{display:block;font-size:10.5px;font-weight:500;color:var(--muted)}
.sub-sec{margin-top:28px;padding-top:18px;border-top:2px solid var(--line)}.sub-sec>.sub-h{font-size:19px;margin:0 0 10px}
@media (max-width:820px){.ig-row{grid-template-columns:minmax(0,1fr)}.ig-health{grid-template-columns:minmax(0,1fr)}.ig-gauges{gap:2px}}`;

/** Period switch of the 재무제표 card. */
export const INFOGRAPHIC_JS = `document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-fs]');if(!b)return;var c=b.closest('.card');c.querySelectorAll('[data-fs]').forEach(function(x){x.setAttribute('aria-selected',String(x===b));});c.querySelectorAll('[data-fsl]').forEach(function(x){x.hidden=x.getAttribute('data-fsl')!==b.getAttribute('data-fs');});});`;
