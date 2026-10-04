// Dashboard panels for the market section (docs/DESIGN.md §5): horizon gauges,
// fair value and forecasts, structure, investor flows, fundamentals.
// Small charts are server-drawn SVG with a <title> per mark for hover; the
// main price chart's overlays are added in renderHtml's chart script.

import type { HorizonGauge } from '../analysis/horizons.js';
import type { ForecastScore, PriceForecast, TechnicalFairValue } from '../analysis/valuation.js';
import type { Footprint, StructureSnapshot } from '../analysis/structure.js';
import type { FinancePeriod, StockSnapshot } from '../types.js';
import type { FlowSection, MarketSection } from './marketSection.js';

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`;
const pct = (v: number | null, digits = 1) => (v === null ? '없음' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`);
const tone = (v: number | null) => (v === null || v === 0 ? '' : v > 0 ? 'up' : 'down');
/** Shares in 만주 / 억주 so flow numbers stay readable. */
function shares(v: number | null): string {
  if (v === null) return '없음';
  const sign = v > 0 ? '+' : v < 0 ? '-' : '';
  const a = Math.abs(v);
  return a >= 1e8 ? `${sign}${(a / 1e8).toFixed(2)}억주` : a >= 1e4 ? `${sign}${(a / 1e4).toFixed(1)}만주` : `${sign}${a.toLocaleString('ko-KR')}주`;
}

/** Validated categorical slots (dataviz validator, light surface): foreign, institution, individual. */
export const FLOW_COLORS = { foreign: '#00968a', institution: '#7a4fb3', individual: '#d97706' } as const;

const GAUGE_COLORS = ['#1d4fa3', '#3b7be0', '#8fb3ec', '#c4cbc9', '#f0a0a3', '#e5484d', '#a8262b'];
const BOUNDS = [-1, -0.6, -0.3, -0.1, 0.1, 0.3, 0.6, 1];

/** Compact semicircle gauge; the needle settles from neutral like the main one. */
export function miniGauge(score: number | null, label: string): string {
  const cx = 60, cy = 56, r = 46;
  const angle = (s: number) => 180 - ((s + 1) / 2) * 180;
  const pt = (deg: number, rad = r) => [cx + rad * Math.cos((deg * Math.PI) / 180), cy - rad * Math.sin((deg * Math.PI) / 180)] as const;
  const arcs = GAUGE_COLORS.map((color, i) => {
    const [x1, y1] = pt(angle(BOUNDS[i]!) - (i ? 1.5 : 0)), [x2, y2] = pt(angle(BOUNDS[i + 1]!) + (i < 6 ? 1.5 : 0));
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${color}" stroke-width="8" fill="none"/>`;
  }).join('');
  const needle = score === null
    ? `<circle cx="${cx}" cy="${cy}" r="5" fill="#c4cbc9"/>`
    : (() => {
        const turn = (90 - angle(score)).toFixed(1);
        return `<g class="needle" style="--r:${turn}deg;transform-origin:${cx}px ${cy}px" transform="rotate(${turn} ${cx} ${cy})"><path d="M${cx - 4} ${cy} L${cx} ${cy - (r - 14)} L${cx + 4} ${cy} Z" fill="#18201f"/></g><circle cx="${cx}" cy="${cy}" r="5" fill="#18201f"/>`;
      })();
  return `<svg viewBox="0 0 120 62" class="mini-gauge" role="img" aria-label="${esc(label)}">${arcs}${needle}</svg>`;
}

export function horizonRow(horizons: readonly HorizonGauge[]): string {
  const cards = horizons.map((h) => {
    const s = h.summary;
    const t = s.score === null ? '' : s.score >= 0.1 ? 'up' : s.score <= -0.1 ? 'down' : '';
    return `<div class="hz"><div class="hz-top"><b>${esc(h.label)}</b><span>${esc(h.barLabel)}</span></div>
${miniGauge(s.score, `${h.label} ${s.label}`)}
<div class="hz-label ${t}">${esc(s.label)}</div>
<div class="hz-meta"><span>${esc(h.span)}</span><span>강세 ${s.counts.bullish}</span><span>약세 ${s.counts.bearish}</span></div></div>`;
  }).join('');
  const notes = horizons.filter((h) => h.note).map((h) => `${h.label}: ${h.note}`);
  return `<div class="card" id="horizons"><div class="head"><h2>기간별 신호</h2><span class="sub" style="margin:0">같은 16개 지표를 봉 크기만 바꿔 계산했어요</span></div>
<div class="hz-row">${cards}</div>
${notes.length ? `<p class="fine">${notes.map(esc).join(' ')}</p>` : ''}</div>`;
}

/** A horizontal price axis: fair-value band, center, close, consensus and forecast p50 marks. */
function valueStrip(fv: TechnicalFairValue, consensus: number | null, p50: number | null): string {
  const marks = [fv.low, fv.high, fv.close, fv.center, ...(consensus ? [consensus] : []), ...(p50 ? [p50] : [])];
  const lo = Math.min(...marks) * 0.97, hi = Math.max(...marks) * 1.03;
  const x = (v: number) => 12 + ((v - lo) / (hi - lo)) * 576;
  // Labels sit above or below the axis; a label too close to another on its side drops to an outer row.
  const placed: { side: number; x: number; row: number }[] = [];
  const mark = (v: number, label: string, cls: string, side: -1 | 1) => {
    const px = x(v);
    let row = 0;
    while (placed.some((p) => p.side === side && p.row === row && Math.abs(p.x - px) < 90)) row += 1;
    placed.push({ side, x: px, row });
    const ty = side < 0 ? 28 - row * 13 : 82 + row * 13;
    const anchor = px < 50 ? 'start' : px > 550 ? 'end' : 'middle';
    return `<g class="vs-${cls}"><line x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="38" y2="66"/><text x="${px.toFixed(1)}" y="${ty}" text-anchor="${anchor}">${esc(label)}</text><title>${esc(label)} ${won(v)}</title></g>`;
  };
  return `<svg viewBox="0 0 600 104" class="value-strip" role="img" aria-label="기술적 적정 범위 ${won(fv.low)}~${won(fv.high)}, 현재가 ${won(fv.close)}">
<line x1="12" x2="588" y1="52" y2="52" class="vs-axis"/>
<rect x="${x(fv.low).toFixed(1)}" y="44" width="${(x(fv.high) - x(fv.low)).toFixed(1)}" height="16" rx="4" class="vs-band"><title>적정 범위 ${won(fv.low)}~${won(fv.high)}</title></rect>
${mark(fv.center, '적정가', 'center', -1)}${consensus ? mark(consensus, '증권가 목표가', 'cons', -1) : ''}${mark(fv.close, '현재가', 'close', 1)}${p50 ? mark(p50, '20일 예측 중앙', 'p50', 1) : ''}
</svg>`;
}

const POSITION = { ABOVE: '적정 범위보다 위', INSIDE: '적정 범위 안', BELOW: '적정 범위보다 아래' } as const;

export function valueCard(market: MarketSection): string {
  const fv = market.fairValue;
  if (!fv) return '<div class="card"><div class="head"><h2>기술적 적정가</h2></div><p class="empty">일봉이 120개보다 적어서 계산하지 않았어요.</p></div>';
  const consensus = market.snapshot?.consensus?.targetPriceMean ?? null;
  const p20 = market.forecasts.find((f) => f.horizon === 20)?.p50 ?? null;
  return `<div class="card" id="value"><div class="head"><h2>기술적 적정가</h2><span class="sub" style="margin:0">${esc(fv.sessionDate)} 종가 기준</span></div>
<div class="value-head"><div><div class="label">적정가 중심</div><div class="big">${won(fv.center)}</div></div>
<div><div class="label">적정 범위</div><div class="mid">${won(fv.low)} ~ ${won(fv.high)}</div></div>
<div><div class="label">현재가 위치</div><div class="mid ${fv.position === 'ABOVE' ? 'up' : fv.position === 'BELOW' ? 'down' : ''}">${POSITION[fv.position]} (${pct(fv.gapPct)})</div></div></div>
${valueStrip(fv, consensus, p20)}
<details class="more"><summary>계산에 쓴 기준값 ${fv.anchors.length}개</summary><ul class="plain">${fv.anchors.map((a) => `<li>${esc(a.label)} ${won(a.value)}</li>`).join('')}</ul></details>
<p class="fine">최근 거래가 몰린 가격의 중심이에요. 기업 가치 평가가 아니고, 범위는 120일 추세선에서 평소 벗어나는 폭(±${fv.bandPct.toFixed(1)}%)이에요.${consensus ? ' 증권가 목표가는 네이버 컨센서스 평균이에요.' : ''}</p></div>`;
}

function scoreLine(score: ForecastScore | undefined): string {
  if (!score || !score.scored) return '<span class="muted">채점 전</span>';
  return `적중 ${Math.round(score.coverage! * 100)}% (${score.scored}건)`;
}

export function forecastCard(forecasts: readonly PriceForecast[], scores: readonly ForecastScore[]): string {
  if (!forecasts.length) return '<div class="card"><div class="head"><h2>예측 범위</h2></div><p class="empty">일봉이 부족해 예측하지 않았어요.</p></div>';
  const base = forecasts[0]!;
  const rows = forecasts.map((f) => `<tr><td class="nowrap">${f.horizon}거래일 뒤</td><td class="num">${won(f.p10)}</td><td class="num"><b>${won(f.p50)}</b></td><td class="num">${won(f.p90)}</td>
<td class="num ${tone(f.p50 / base.baseClose - 1)}">${pct((f.p50 / base.baseClose - 1) * 100)}</td><td class="nowrap">${scoreLine(scores.find((s) => s.horizon === f.horizon))}</td></tr>`).join('');
  return `<div class="card" id="forecast"><div class="head"><h2>예측 범위</h2><span class="sub" style="margin:0">${esc(base.baseDate)} 종가 ${won(base.baseClose)} 기준</span></div>
<div class="table-wrap"><table><thead><tr><th>기간</th><th class="num">하단 (10%)</th><th class="num">중앙</th><th class="num">상단 (90%)</th><th class="num">중앙 변화</th><th>지난 예측</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="fine">최근 변동성으로 그린 가격 범위예요. 열 번 중 여덟 번 정도 이 안에 들어오도록 만들었고, 실제로 그런지 매일 채점해요. 방향은 최근 추세의 4분의 1만 반영해요. 투자 권유가 아니에요.</p></div>`;
}

const BIAS = { BULLISH: '상승 구조', BEARISH: '하락 구조', NEUTRAL: '구조 없음' } as const;
const ZONE = { DISCOUNT: '하단 구간', EQUILIBRIUM: '중간 구간', PREMIUM: '상단 구간' } as const;
const FIB = { SHALLOW: '얕은 되돌림', PREFERRED: '적정 되돌림', DEEP: '깊은 되돌림', EXTENDED: '과도한 되돌림' } as const;

export function structureCard(s: StructureSnapshot | null, weekly: StructureSnapshot | null): string {
  if (!s) return '<div class="card"><div class="head"><h2>가격 구조</h2></div><p class="empty">가격 기록이 부족해요.</p></div>';
  const lastBreak = s.breaks.at(-1);
  const breakText = lastBreak
    ? `${esc(lastBreak.date)} 종가 ${won(lastBreak.close)}가 ${lastBreak.direction === 'BULLISH' ? '스윙 고점' : '스윙 저점'} ${won(lastBreak.brokenSwing.price)}을 ${lastBreak.direction === 'BULLISH' ? '넘었어요' : '깨뜨렸어요'} (${lastBreak.type === 'CHOCH' ? '추세 전환 신호' : '추세 지속'}).`
    : '최근 확정된 스윙을 넘거나 깨뜨린 종가가 없어요.';
  const fib = s.fibonacci;
  const levels = s.levels.map((l) => `<tr><td><span class="badge ${l.kind === 'RESISTANCE' ? 'v-BULLISH' : 'v-BEARISH'}">${l.kind === 'RESISTANCE' ? '저항' : '지지'}</span></td><td class="num">${won(l.price)}</td><td class="num ${tone(l.price / s.close - 1)}">${pct((l.price / s.close - 1) * 100)}</td><td class="num">${l.touches}회</td></tr>`).join('');
  return `<div class="card" id="structure"><div class="head"><h2>가격 구조</h2><span class="sub" style="margin:0">일봉 스윙 기준</span></div>
<div class="facts">
<div><span class="label">일봉 구조</span><b class="${s.bias === 'BULLISH' ? 'up' : s.bias === 'BEARISH' ? 'down' : ''}">${BIAS[s.bias]}</b></div>
<div><span class="label">주봉 구조</span><b class="${weekly?.bias === 'BULLISH' ? 'up' : weekly?.bias === 'BEARISH' ? 'down' : ''}">${weekly ? BIAS[weekly.bias] : '없음'}</b></div>
<div><span class="label">최근 스윙 범위 안 위치</span><b>${s.zone ? `${ZONE[s.zone.label]} (${Math.round(s.zone.percentile * 100)}%)` : '없음'}</b></div>
<div><span class="label">피보나치</span><b>${fib && fib.zone && fib.retracement !== null ? `${FIB[fib.zone]} ${(fib.retracement * 100).toFixed(1)}%` : '해당 없음'}</b></div>
<div><span class="label">볼린저 위치 (%B)</span><b>${s.bollinger ? `${Math.round(s.bollinger.percentB * 100)}%` : '없음'}</b></div>
<div><span class="label">하루 평균 변동폭 (ATR14)</span><b>${s.atr14 ? `${won(s.atr14)} (${((s.atr14 / s.close) * 100).toFixed(1)}%)` : '없음'}</b></div>
</div>
<p class="reason">${breakText}</p>
${levels ? `<div class="table-wrap"><table class="compact"><thead><tr><th>구분</th><th class="num">가격</th><th class="num">현재가 대비</th><th class="num">닿은 횟수</th></tr></thead><tbody>${levels}</tbody></table></div>` : ''}
<p class="fine">스윙 고점·저점은 양쪽 3개 봉보다 높거나 낮은 봉이고, 오른쪽 3개 봉이 마감된 뒤에야 확정해요. 1.5% 안에 모인 스윙은 하나의 지지·저항으로 묶어요.</p></div>`;
}

/** Cumulative net buying lines (one axis, shares) with a hover title per day. */
function flowChart(flow: FlowSection): string {
  const days = flow.days;
  if (days.length < 2) return '';
  const keys = [['foreign', 'foreignNet', '외국인'], ['institution', 'institutionNet', '기관'], ['individual', 'individualNet', '개인']] as const;
  const cum = keys.map(([key, field, label]) => {
    let acc = 0;
    return { key, label, values: days.map((d) => (acc += d[field] ?? 0)) };
  });
  const all = cum.flatMap((c) => c.values).concat(0);
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
  const W = 640, H = 200, padL = 8, padR = 64, padT = 10, padB = 22;
  const x = (i: number) => padL + (i * (W - padL - padR)) / (days.length - 1);
  const y = (v: number) => padT + ((hi - v) / span) * (H - padT - padB);
  const labelY = cum.map((c) => y(c.values.at(-1)!) + 4);
  const order = cum.map((_, i) => i).sort((a, b) => labelY[a]! - labelY[b]!);
  order.forEach((idx, k) => { if (k && labelY[idx]! - labelY[order[k - 1]!]! < 14) labelY[idx] = labelY[order[k - 1]!]! + 14; });
  const lines = cum.map((c, ci) => `<polyline fill="none" stroke="${FLOW_COLORS[c.key]}" stroke-width="2" points="${c.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>
<text x="${(x(days.length - 1) + 6).toFixed(1)}" y="${labelY[ci]!.toFixed(1)}" class="flow-label">${c.label}</text>`).join('');
  const hits = days.map((d, i) => `<rect x="${(x(i) - (W - padL - padR) / days.length / 2).toFixed(1)}" y="${padT}" width="${((W - padL - padR) / days.length).toFixed(1)}" height="${H - padT - padB}" class="hit"><title>${esc(d.date)}  외국인 ${shares(d.foreignNet)}, 기관 ${shares(d.institutionNet)}, 개인 ${shares(d.individualNet)}${d.foreignHoldRatio !== null ? `, 외국인 보유율 ${d.foreignHoldRatio.toFixed(2)}%` : ''}</title></rect>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="flow-chart" role="img" aria-label="최근 ${days.length}거래일 투자자별 누적 순매수">
<line x1="${padL}" x2="${W - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="zero"/>
${lines}
<text x="${padL}" y="${H - 6}" class="axis-label">${esc(days[0]!.date)}</text><text x="${W - padR}" y="${H - 6}" class="axis-label" text-anchor="end">${esc(days.at(-1)!.date)}</text>
${hits}</svg>`;
}

const FOOTPRINT = { ACCUMULATION_LIKE: '매집 쪽', DISTRIBUTION_LIKE: '분산 쪽', MIXED: '엇갈림', NEUTRAL: '뚜렷하지 않음', DATA_GAP: '기록 부족' } as const;

export function flowsPanel(flow: FlowSection | null, fp: Footprint): string {
  if (!flow) return '<div class="card"><div class="head"><h2>투자자별 수급</h2></div><p class="empty">수급 기록이 아직 없어요.</p></div>';
  const legend = (['foreign', 'institution', 'individual'] as const).map((k) => `<span><i style="background:${FLOW_COLORS[k]}"></i>${{ foreign: '외국인', institution: '기관', individual: '개인' }[k]}</span>`).join('');
  const sums = flow.sums.map((s) => `<tr><td>최근 ${s.days}거래일</td><td class="num ${tone(s.foreign)}">${shares(s.foreign)}</td><td class="num ${tone(s.institution)}">${shares(s.institution)}</td><td class="num ${tone(s.individual)}">${shares(s.individual)}</td></tr>`).join('');
  const recent = [...flow.days].reverse().slice(0, 10).map((d) => `<tr><td class="nowrap">${esc(d.date)}</td><td class="num ${tone(d.foreignNet)}">${shares(d.foreignNet)}</td><td class="num ${tone(d.institutionNet)}">${shares(d.institutionNet)}</td><td class="num ${tone(d.individualNet)}">${shares(d.individualNet)}</td><td class="num">${d.foreignHoldRatio === null ? '없음' : `${d.foreignHoldRatio.toFixed(2)}%`}</td></tr>`).join('');
  const fpTone = fp.state === 'ACCUMULATION_LIKE' ? 'up' : fp.state === 'DISTRIBUTION_LIKE' ? 'down' : '';
  return `<div class="grid2 tight">
<div class="card"><div class="head"><h2>누적 순매수</h2><div class="legend-inline">${legend}</div></div>${flowChart(flow)}
<p class="fine">${flow.days.length}거래일 동안 투자자별 순매수(주)를 더해 간 선이에요. 선 위에 올리면 그날 숫자가 보여요.</p></div>
<div class="card"><div class="head"><h2>수급 흔적</h2></div>
<div class="signal-label ${fpTone}" style="text-align:left">${FOOTPRINT[fp.state]}</div><div class="tally">점수 ${fp.score > 0 ? '+' : ''}${fp.score} (−100 분산 ~ +100 매집)</div>
<ul class="plain">${fp.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
<div class="facts one"><div><span class="label">외국인 보유율 20일 변화</span><b class="${tone(flow.holdRatioChange20)}">${flow.holdRatioChange20 === null ? '없음' : `${flow.holdRatioChange20 > 0 ? '+' : ''}${flow.holdRatioChange20.toFixed(2)}%p`}</b></div></div>
<p class="fine">거래량과 투자자별 순매수로 본 흔적이에요. 누가 샀는지는 네이버의 투자자 구분까지만 말하고, 조작의 증거가 아니에요.</p></div></div>
<div class="card" style="margin-top:16px"><div class="head"><h2>기간별 순매수 합계</h2></div><div class="table-wrap"><table><thead><tr><th>기간</th><th class="num">외국인</th><th class="num">기관</th><th class="num">개인</th></tr></thead><tbody>${sums}</tbody></table></div>
<h3 class="why-h">최근 10거래일</h3><div class="table-wrap"><table class="compact"><thead><tr><th>날짜</th><th class="num">외국인</th><th class="num">기관</th><th class="num">개인</th><th class="num">외국인 보유율</th></tr></thead><tbody>${recent}</tbody></table></div>
<p class="fine">출처: 네이버 증권 투자자별 매매동향. 기타법인 등은 빠져 있어 세 줄의 합이 0이 아닐 수 있어요.</p></div>`;
}

/** Quarterly revenue and operating profit, estimates hatched. One axis (KRW 100M). */
function earningsChart(quarters: readonly FinancePeriod[]): string {
  const rows = quarters.map((q) => ({ q, rev: q.metrics['매출액'] ?? null, op: q.metrics['영업이익'] ?? null })).filter((r) => r.rev !== null);
  if (rows.length < 2) return '<p class="empty">분기 실적 기록이 부족해요.</p>';
  const max = Math.max(...rows.flatMap((r) => [r.rev!, r.op ?? 0]));
  const W = 640, H = 220, padB = 26, padT = 18, group = (W - 20) / rows.length, bw = Math.min(28, group / 3);
  const y = (v: number) => H - padB - (Math.max(0, v) / max) * (H - padB - padT);
  const bars = rows.map((r, i) => {
    const gx = 10 + i * group + group / 2;
    const label = `${r.q.period.slice(0, 4)}.${r.q.period.slice(4)}${r.q.isEstimate ? ' (추정)' : ''}`;
    const bar = (v: number | null, dx: number, cls: string, name: string) => (v === null ? '' :
      `<rect x="${(gx + dx).toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - padB - y(v)).toFixed(1)}" rx="3" class="${cls}${r.q.isEstimate ? ' est' : ''}"><title>${esc(label)} ${name} ${Math.round(v).toLocaleString('ko-KR')}억원</title></rect>`);
    return `${bar(r.rev, -bw - 1, 'b-rev', '매출액')}${bar(r.op, 1, 'b-op', '영업이익')}<text x="${gx.toFixed(1)}" y="${H - 8}" text-anchor="middle" class="axis-label">${esc(label)}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="earn-chart" role="img" aria-label="분기 매출액과 영업이익">
<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#ffffff"/><line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" stroke-width="3"/></pattern></defs>
<line x1="10" x2="${W - 10}" y1="${H - padB}" y2="${H - padB}" class="zero"/>${bars}</svg>`;
}

export function fundamentalsPanel(market: MarketSection, close: number | null): string {
  const s: StockSnapshot | null = market.snapshot;
  const kpi = (label: string, value: string, hint = '') => `<div class="card kpi"><div class="label">${esc(label)}</div><div class="value">${value}</div>${hint ? `<div class="hint">${esc(hint)}</div>` : ''}</div>`;
  const x = (v: number | null, unit: string, d = 2) => (v === null ? '없음' : `${v.toFixed(d)}${unit}`);
  const cons = s?.consensus;
  const upside = cons?.targetPriceMean && close ? (cons.targetPriceMean / close - 1) * 100 : null;
  const kpis = s ? `<div class="kpis">
${kpi('PER (최근 4분기)', x(s.per, '배'), s.eps === null ? '' : `EPS ${won(s.eps)}`)}
${kpi('추정 PER', x(s.estimatedPer, '배'), s.estimatedEps === null ? '' : `추정 EPS ${won(s.estimatedEps)}`)}
${kpi('PBR', x(s.pbr, '배'), s.bps === null ? '' : `BPS ${won(s.bps)}`)}
${kpi('증권가 평균 목표가', cons?.targetPriceMean ? won(cons.targetPriceMean) : '없음', cons ? `${cons.date} 기준, 현재가 대비 ${pct(upside)}` : '')}
</div>` : '<p class="empty">밸류에이션 기록이 아직 없어요.</p>';
  const q = market.quarters;
  const qRows = q.map((p) => `<tr><td class="nowrap">${p.period.slice(0, 4)}.${p.period.slice(4)}${p.isEstimate ? ' <span class="badge b-LOW">추정</span>' : ''}</td>
<td class="num">${fmt(p.metrics['매출액'])}</td><td class="num">${fmt(p.metrics['영업이익'])}</td><td class="num">${p.metrics['영업이익률'] == null ? '없음' : `${p.metrics['영업이익률']!.toFixed(1)}%`}</td><td class="num">${fmt(p.metrics['당기순이익'])}</td></tr>`).join('');
  const bench = market.benchmarks.map((b) => `<tr><td>${esc(b.name)}</td>${b.returns.map((r) => {
    const raw = r.stock !== null && r.benchmark !== null ? r.stock - r.benchmark : null;
    const diff = raw === null ? null : Math.abs(raw) < 0.05 ? 0 : raw;
    return `<td class="num"><span class="${tone(r.benchmark)}">${pct(r.benchmark)}</span><br><small class="${tone(diff)}">차이 ${diff === null ? '없음' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%p`}</small></td>`;
  }).join('')}</tr>`).join('');
  const stockRow = market.benchmarks[0] ? `<tr><td class="nowrap"><b>SK하이닉스</b></td>${market.benchmarks[0].returns.map((r) => `<td class="num ${tone(r.stock)}"><b>${pct(r.stock)}</b></td>`).join('')}</tr>` : '';
  const research = market.research.map((r) => `<li><span class="why">${esc(r.date)} ${esc(r.broker)}</span> ${esc(r.title)}</li>`).join('');
  return `${kpis}
<div class="grid2 tight" style="margin-top:16px"><div class="card"><div class="head"><h2>분기 실적</h2><div class="legend-inline"><span><i class="sw-rev"></i>매출액</span><span><i class="sw-op"></i>영업이익</span><span><i class="sw-est"></i>추정치</span></div></div>
${earningsChart(q)}
<details class="more"><summary>표로 보기</summary><div class="table-wrap"><table class="compact"><thead><tr><th>분기</th><th class="num">매출액</th><th class="num">영업이익</th><th class="num">영업이익률</th><th class="num">순이익</th></tr></thead><tbody>${qRows}</tbody></table></div></details>
<p class="fine">단위 억원. 출처: 네이버 증권(기업 실적 분석). 추정치는 증권사 컨센서스예요.</p></div>
<div class="card"><div class="head"><h2>시장 대비 수익률</h2></div><div class="table-wrap"><table class="compact"><thead><tr><th></th><th class="num">5거래일</th><th class="num">20거래일</th><th class="num">60거래일</th></tr></thead><tbody>${stockRow}${bench}</tbody></table></div>
<p class="fine">차이는 SK하이닉스 수익률에서 비교 대상 수익률을 뺀 값이에요.</p>
<h3 class="why-h">최근 증권사 리포트</h3>${research ? `<ul class="plain research">${research}</ul>` : '<p class="empty">아직 없어요.</p>'}
<p class="fine">제목과 증권사, 날짜만 모아요. 본문은 저장하지 않아요.</p></div></div>`;
}

const fmt = (v: number | null | undefined) => (v == null ? '없음' : Math.round(v).toLocaleString('ko-KR'));

export function marketStatusWarning(market: MarketSection): string {
  const failed = market.status.filter((s) => !s.ok);
  return failed.length ? `<p class="warn">일부 데이터를 받지 못했어요: ${failed.map((s) => esc(s.source)).join(', ')}. 해당 항목은 이전 기록이거나 비어 있을 수 있어요.</p>` : '';
}

/** Data for the main chart's overlay toggles. */
export function chartOverlays(market: MarketSection | undefined): unknown {
  if (!market) return null;
  const s = market.structure;
  return {
    levels: s?.levels.map((l) => ({ price: l.price, kind: l.kind })) ?? [],
    fib: s?.fibonacci?.levels ?? [],
    forecasts: market.forecasts.map((f) => ({ horizon: f.horizon, baseDate: f.baseDate, baseClose: f.baseClose, p10: f.p10, p50: f.p50, p90: f.p90, sigma: f.sigma, drift: f.drift })),
    fair: market.fairValue ? { low: market.fairValue.low, center: market.fairValue.center, high: market.fairValue.high } : null,
  };
}
