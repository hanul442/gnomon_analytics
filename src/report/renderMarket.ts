// Dashboard panels for the market section (docs/DESIGN.md §5): horizon gauges,
// fair value and forecasts, structure, investor flows, fundamentals.
// Small charts are server-drawn SVG with a <title> per mark for hover; the
// main price chart's overlays are added in renderHtml's chart script.

import type { HorizonGauge } from '../analysis/horizons.js';
import type { ForecastScore, PriceForecast, TechnicalFairValue } from '../analysis/valuation.js';
import type { Footprint, StructureSnapshot } from '../analysis/structure.js';
import type { FlowSection, MarketSection } from './marketSection.js';
import type { FullStatements } from '../sources/dartStatements.js';
import { healthInfographic, quarterBars, statementChart, statementsCard } from './infographics.js';
import { esc } from './html.js';
import { won, tone, pct as fmtPct, bigMoney, currency, financeScale } from './format.js';
const pct = (v: number | null, digits = 1) => fmtPct(v, digits, '없음');

/** Shares in 만주 / 억주 so flow numbers stay readable. */
/** Net buying in KRW, short: +12.3억 / -1,234억 / +4,500만. */
function krw(v: number | null | undefined): string {
  if (v === null || v === undefined) return '없음';
  const sign = v > 0 ? '+' : v < 0 ? '-' : '', a = Math.abs(v);
  return a >= 1e10 ? `${sign}${Math.round(a / 1e8).toLocaleString('ko-KR')}억` : a >= 1e8 ? `${sign}${(a / 1e8).toFixed(1)}억` : a >= 1e4 ? `${sign}${Math.round(a / 1e4).toLocaleString('ko-KR')}만` : `${sign}${a}`;
}
/** Amount first (estimated), shares underneath. */
const both = (value: number | null | undefined, n: number | null) => (value === null || value === undefined ? shares(n) : `${krw(value)}<small class="sub-sh">${shares(n)}</small>`);

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
    const on = score !== null && score >= BOUNDS[i]! && (score < BOUNDS[i + 1]! || i === 6);
    return `<path class="g-seg${on ? ' on' : ''}" style="color:${color}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${color}" stroke-width="8" fill="none"/>`;
  }).join('');
  const needle = score === null
    ? `<circle cx="${cx}" cy="${cy}" r="5" fill="#c4cbc9"/>`
    : (() => {
        const turn = (90 - angle(score)).toFixed(1);
        return `<g class="needle" style="--r:${turn}deg;transform-origin:${cx}px ${cy}px" transform="rotate(${turn} ${cx} ${cy})"><path d="M${cx - 3} ${cy} L${cx} ${cy - (r - 14)} L${cx + 3} ${cy} Z" fill="#18201f"/><circle class="g-tip" cx="${cx}" cy="${cy - (r - 14)}" r="3"/></g><circle class="g-hub" cx="${cx}" cy="${cy}" r="5" fill="#18201f"/>`;
      })();
  return `<svg viewBox="0 0 120 62" class="mini-gauge" role="img" aria-label="${esc(label)}">${arcs}${needle}</svg>`;
}

export function horizonRow(horizons: readonly HorizonGauge[]): string {
  const cards = horizons.map((h) => {
    const s = h.summary;
    const t = s.score === null ? '' : s.score >= 0.1 ? 'up' : s.score <= -0.1 ? 'down' : '';
    return `<div class="hz${t ? ' hz-' + t : ''}"><div class="hz-top"><b>${esc(h.label)}</b><span>${esc(h.barLabel)}</span></div>
${miniGauge(s.score, `${h.label} ${s.label}`)}
<div class="hz-label ${t}">${esc(s.label)}</div>
<div class="hz-meta"><span>${esc(h.span)}</span><span>강세 ${s.counts.bullish}</span><span>약세 ${s.counts.bearish}</span></div></div>`;
  }).join('');
  const notes = horizons.filter((h) => h.note).map((h) => `${h.label}: ${h.note}`);
  return `<div class="card" id="horizons"><div class="head"><h2>기간별 신호</h2><span class="sub" style="margin:0">같은 16개 지표를 봉 크기만 바꿔 계산했어요</span></div>
<div class="hz-row">${cards}</div>
${notes.length ? `<p class="fine">${notes.map(esc).join(' ')}</p>` : ''}</div>`;
}

/**
 * G-185: the fair-value band drawn like the forecast ranges (one shared look): the band as a lit bar, the centre as a dot,
 * today's close as a dashed line, and the consensus target and the 20-session forecast as small ticks above the bar.
 */
function valueStrip(fv: TechnicalFairValue, consensus: number | null, p50: number | null): string {
  const marks = [fv.low, fv.high, fv.close, fv.center, ...(consensus ? [consensus] : []), ...(p50 ? [p50] : [])];
  const span = Math.max(...marks) - Math.min(...marks) || fv.center * 0.02, lo = Math.min(...marks) - span * 0.06, hi = Math.max(...marks) + span * 0.06;
  const at = (v: number) => (((v - lo) / (hi - lo)) * 100).toFixed(1);
  const tick = (v: number, cls: string, label: string) => `<i class="fc-tick ${cls}" style="left:${at(v)}%" title="${esc(label)} ${won(v)}"></i>`;
  const gap = (fv.close / fv.center - 1) * 100;
  return `<div class="fc-legend"><span><i class="lg-rng"></i>적정 범위</span><span><i class="lg-mid"></i>적정가 중심</span><span><i class="lg-now"></i>현재가</span>${consensus ? '<span><i class="lg-tick cons"></i>증권가 목표가</span>' : ''}${p50 ? '<span><i class="lg-tick p50"></i>20일 뒤 중앙 예측</span>' : ''}</div>
<div class="fc-row"><div class="fc-h"><b>적정 범위</b><span>현재가 <b>${won(fv.close)}</b> <em class="${tone(gap)}">중심 대비 ${pct(gap)}</em></span></div>
<div class="fc-bar" role="img" aria-label="적정 범위 ${won(fv.low)}에서 ${won(fv.high)}, 중심 ${won(fv.center)}, 현재가 ${won(fv.close)}"><i class="fc-rng" style="left:${at(fv.low)}%;width:${(Number(at(fv.high)) - Number(at(fv.low))).toFixed(1)}%"></i><i class="fc-now" style="left:${at(fv.close)}%"></i><i class="fc-mid" style="left:${at(fv.center)}%"></i>${consensus ? tick(consensus, 'cons', '증권가 목표가') : ''}${p50 ? tick(p50, 'p50', '20일 뒤 중앙 예측') : ''}</div>
<div class="fc-ends"><span>하단 ${won(fv.low)}</span><small>중심 ${won(fv.center)}</small><span>상단 ${won(fv.high)}</span></div></div>
${consensus || p50 ? `<div class="fc-notes">${consensus ? `<span><i class="lg-tick cons"></i>증권가 목표가 <b>${won(consensus)}</b></span>` : ''}${p50 ? `<span><i class="lg-tick p50"></i>20일 뒤 중앙 <b>${won(p50)}</b></span>` : ''}</div>` : ''}`;
}

/**
 * G-185: support and resistance as a price ladder instead of a table: resistance above today's price, support below,
 * each with a bar as long as its distance from the close and one dot per touch.
 */
function levelLadder(levels: StructureSnapshot['levels'], close: number): string {
  if (!levels.length) return '';
  const rows = [...levels].sort((a, b) => b.price - a.price), far = Math.max(...rows.map((l) => Math.abs(l.price / close - 1))) || 1;
  const row = (l: StructureSnapshot['levels'][number], i: number) => {
    const d = (l.price / close - 1) * 100, res = l.kind === 'RESISTANCE';
    return `<div class="lv-row ${res ? 'lv-res' : 'lv-sup'}" style="--i:${i}"><span class="lv-k">${res ? '저항' : '지지'}</span><b class="lv-p">${won(l.price)}</b><span class="lv-bar"><i style="width:${Math.max(6, (Math.abs(d / 100) / far) * 100).toFixed(1)}%"></i></span><em class="${tone(d)}">${pct(d)}</em><span class="lv-t" title="닿은 횟수 ${l.touches}회">${'<i></i>'.repeat(Math.min(5, l.touches))}<small>${l.touches}회</small></span></div>`;
  };
  const above = rows.filter((l) => l.price >= close), below = rows.filter((l) => l.price < close);
  return `<div class="lv-ladder" role="list" aria-label="지지·저항 가격">${above.map(row).join('')}<div class="lv-now" style="--i:${above.length}"><span>현재가</span><b>${won(close)}</b></div>${below.map((l, k) => row(l, above.length + 1 + k)).join('')}</div>`;
}

const POSITION = { ABOVE: '적정 범위보다 위', INSIDE: '적정 범위 안', BELOW: '적정 범위보다 아래' } as const;

/** `withForecast` adds the 20-session forecast centre to the strip (a Pro item, G-40). */
export function valueCard(market: MarketSection, withForecast = true): string {
  const fv = market.fairValue;
  if (!fv) return '<div class="card"><div class="head"><h2>기술적 적정가</h2></div><p class="empty">일봉이 120개보다 적어서 계산하지 않았어요.</p></div>';
  const consensus = market.snapshot?.consensus?.targetPriceMean ?? null;
  const p20 = withForecast ? market.forecasts.find((f) => f.horizon === 20)?.p50 ?? null : null;
  return `<div class="card fc-card" id="value"><div class="head"><h2>기술적 적정가</h2><span class="sub" style="margin:0">${esc(fv.sessionDate)} 종가 기준</span></div>
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
  const base = forecasts[0]!, close = base.baseClose;
  // G-172: each horizon as a range bar on one shared scale (the 80% range, the middle, today's close), not a table that ran off a phone.
  const lo = Math.min(close, ...forecasts.map((f) => f.p10)), hi = Math.max(close, ...forecasts.map((f) => f.p90)), at = (v: number) => (((v - lo) / (hi - lo || 1)) * 100).toFixed(1);
  const rows = forecasts.map((f, i) => {
    const ch = (f.p50 / close - 1) * 100;
    return `<div class="fc-row" style="--i:${i}"><div class="fc-h"><b>${f.horizon}거래일 뒤</b><span>중앙 <b>${won(f.p50)}</b> <em class="${tone(ch)}">${pct(ch)}</em></span></div>
<div class="fc-bar" role="img" aria-label="${f.horizon}거래일 뒤 ${won(f.p10)}에서 ${won(f.p90)} 사이, 중앙 ${won(f.p50)}"><i class="fc-rng" style="left:${at(f.p10)}%;width:${(Number(at(f.p90)) - Number(at(f.p10))).toFixed(1)}%"></i><i class="fc-now" style="left:${at(close)}%"></i><i class="fc-mid" style="left:${at(f.p50)}%"></i></div>
<div class="fc-ends"><span>하단 ${won(f.p10)}</span><small>${scoreLine(scores.find((s) => s.horizon === f.horizon))}</small><span>상단 ${won(f.p90)}</span></div></div>`;
  }).join('');
  return `<div class="card fc-card" id="forecast"><div class="head"><h2>예측 범위</h2><span class="sub" style="margin:0">${esc(base.baseDate)} 종가 ${won(close)} 기준</span></div>
<div class="fc-legend"><span><i class="lg-rng"></i>80% 범위</span><span><i class="lg-mid"></i>중앙</span><span><i class="lg-now"></i>기준 종가</span></div>${rows}
<p class="fine">최근 변동성으로 그린 가격 범위예요. 열 번 중 여덟 번 정도 이 안에 들어오도록 만들었고, 실제로 그런지 매일 채점해요(지난 예측 적중). 방향은 최근 추세의 4분의 1만 반영해요. 투자 권유가 아니에요.</p></div>`;
}

const BIAS = { BULLISH: '강세 구조', BEARISH: '약세 구조', NEUTRAL: '구조 없음' } as const;
const ZONE = { DISCOUNT: '하단 구간', EQUILIBRIUM: '중간 구간', PREMIUM: '상단 구간' } as const;
const FIB = { SHALLOW: '얕은 되돌림', PREFERRED: '적정 되돌림', DEEP: '깊은 되돌림', EXTENDED: '과도한 되돌림' } as const;

export function structureCard(s: StructureSnapshot | null, weekly: StructureSnapshot | null): string {
  if (!s) return '<div class="card" id="structure"><div class="head"><h2>가격 구조</h2></div><p class="empty">가격 기록이 부족해요.</p></div>';
  const lastBreak = s.breaks.at(-1);
  const breakText = lastBreak
    ? `${esc(lastBreak.date)} 종가 ${won(lastBreak.close)}가 ${lastBreak.direction === 'BULLISH' ? '스윙 고점' : '스윙 저점'} ${won(lastBreak.brokenSwing.price)}을 ${lastBreak.direction === 'BULLISH' ? '넘었어요' : '깨뜨렸어요'} (${lastBreak.type === 'CHOCH' ? '추세 전환 신호' : '추세 지속'}).`
    : '최근 확정된 스윙을 넘거나 깨뜨린 종가가 없어요.';
  const fib = s.fibonacci;
  return `<div class="card lv-card" id="structure"><div class="head"><h2>가격 구조</h2><span class="sub" style="margin:0">일봉 스윙 기준</span></div>
<div class="facts">
<div><span class="label">일봉 구조</span><b class="${s.bias === 'BULLISH' ? 'up' : s.bias === 'BEARISH' ? 'down' : ''}">${BIAS[s.bias]}</b></div>
<div><span class="label">주봉 구조</span><b class="${weekly?.bias === 'BULLISH' ? 'up' : weekly?.bias === 'BEARISH' ? 'down' : ''}">${weekly ? BIAS[weekly.bias] : '없음'}</b></div>
<div><span class="label">최근 스윙 범위 안 위치</span><b>${s.zone ? `${ZONE[s.zone.label]} (${Math.round(s.zone.percentile * 100)}%)` : '없음'}</b></div>
<div><button type="button" class="indicator-link" data-chart-indicator="fib" title="차트에서 보기"><span class="label">피보나치 ↗</span><b>${fib && fib.zone && fib.retracement !== null ? `${FIB[fib.zone]} ${(fib.retracement * 100).toFixed(1)}%` : '해당 없음'}</b></button></div>
<div><button type="button" class="indicator-link" data-chart-indicator="bb" title="차트에서 보기"><span class="label">볼린저 위치 (%B) ↗</span><b>${s.bollinger ? `${Math.round(s.bollinger.percentB * 100)}%` : '없음'}</b></button></div>
<div><button type="button" class="indicator-link" data-chart-indicator="atr" title="차트에서 보기"><span class="label">하루 평균 변동폭 (ATR14) ↗</span><b>${s.atr14 ? `${won(s.atr14)} (${((s.atr14 / s.close) * 100).toFixed(1)}%)` : '없음'}</b></button></div>
</div>
<p class="reason">${breakText}</p>
${fib ? `<p class="reason">피보나치 기준: 최근 ${fib.lookback ? `${fib.lookback}거래일의 ` : ''}${fib.from.type === 'LOW' ? '최저가' : '최고가'} ${won(fib.from.price)}(${esc(fib.from.date)}) → ${fib.to.type === 'HIGH' ? '최고가' : '최저가'} ${won(fib.to.price)}(${esc(fib.to.date)}). ${fib.to.type === 'HIGH' ? '오른 폭 가운데 얼마나 되돌려 내려왔는지' : '내린 폭 가운데 얼마나 되돌려 올라왔는지'}를 재요${fib.retracement !== null ? ` · 지금 ${(fib.retracement * 100).toFixed(1)}%` : ''}.</p>` : ''}
${levelLadder(s.levels, s.close)}
<p class="fine">스윙 고점·저점은 양쪽 3개 봉보다 높거나 낮은 봉이고, 오른쪽 3개 봉이 마감된 뒤에야 확정해요. 1.5% 안에 모인 스윙은 하나의 지지·저항으로 묶어요.</p></div>`;
}

/** Cumulative net buying lines (one axis, shares) with a hover title per day. */
function flowChart(flow: FlowSection): string {
  const days = flow.days;
  if (days.length < 2) return '';
  // In KRW when every day has a close (net shares × close), else in shares.
  const money = days.every((d) => d.foreignValue != null || d.foreignNet == null);
  const keys = money
    ? ([['foreign', 'foreignValue', '외국인'], ['institution', 'institutionValue', '기관'], ['individual', 'individualValue', '개인']] as const)
    : ([['foreign', 'foreignNet', '외국인'], ['institution', 'institutionNet', '기관'], ['individual', 'individualNet', '개인']] as const);
  const cum = keys.map(([key, field, label]) => {
    let acc = 0;
    return { key, label, values: days.map((d) => (acc += (d[field] as number | null | undefined) ?? 0)) };
  });
  const all = cum.flatMap((c) => c.values).concat(0);
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
  // G-176: phone-width units so the line labels and dates read at about 11px on a phone.
  const W = 380, H = 170, padL = 4, padR = 46, padT = 10, padB = 22;
  const x = (i: number) => padL + (i * (W - padL - padR)) / (days.length - 1);
  const y = (v: number) => padT + ((hi - v) / span) * (H - padT - padB);
  const labelY = cum.map((c) => y(c.values.at(-1)!) + 4);
  const order = cum.map((_, i) => i).sort((a, b) => labelY[a]! - labelY[b]!);
  order.forEach((idx, k) => { if (k && labelY[idx]! - labelY[order[k - 1]!]! < 14) labelY[idx] = labelY[order[k - 1]!]! + 14; });
  const lines = cum.map((c, ci) => `<polyline fill="none" stroke="${FLOW_COLORS[c.key]}" stroke-width="2" points="${c.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>
<text x="${(x(days.length - 1) + 6).toFixed(1)}" y="${labelY[ci]!.toFixed(1)}" class="flow-label">${c.label}</text>`).join('');
  const hits = days.map((d, i) => `<rect x="${(x(i) - (W - padL - padR) / days.length / 2).toFixed(1)}" y="${padT}" width="${((W - padL - padR) / days.length).toFixed(1)}" height="${H - padT - padB}" class="hit"><title>${esc(d.date)}  외국인 ${krw(d.foreignValue)} (${shares(d.foreignNet)}), 기관 ${krw(d.institutionValue)} (${shares(d.institutionNet)}), 개인 ${krw(d.individualValue)} (${shares(d.individualNet)})${d.foreignHoldRatio !== null ? `, 외국인 보유율 ${d.foreignHoldRatio.toFixed(2)}%` : ''}</title></rect>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="flow-chart" role="img" aria-label="최근 ${days.length}거래일 투자자별 누적 순매수">
<line x1="${padL}" x2="${W - padR}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="zero"/>
${lines}
<text x="${padL}" y="${H - 6}" class="axis-label">${esc(days[0]!.date)}</text><text x="${W - padR}" y="${H - 6}" class="axis-label" text-anchor="end">${esc(days.at(-1)!.date)}</text>
${hits}</svg>`;
}

const FOOTPRINT = { ACCUMULATION_LIKE: '매집 쪽', DISTRIBUTION_LIKE: '분산 쪽', MIXED: '엇갈림', NEUTRAL: '뚜렷하지 않음', DATA_GAP: '기록 부족' } as const;

/** 투자자 동향 (G-148): who bought over 20 or 5 sessions, one bar each; the head of 수급. */
function investorTrend(f: FlowSection): string {
  const f20 = f.sums.find((x) => x.days === 20), f5 = f.sums.find((x) => x.days === 5);
  if (!f20 && !f5) return '';
  const rows = ([['개인', 'individual'], ['외국인', 'foreign'], ['기관', 'institution']] as const);
  // Amounts when the report has them (shares × close); older reports only kept shares.
  const byValue = [f20, f5].some((x) => x && rows.some(([, k]) => x[`${k}Value` as 'foreignValue'] != null));
  const val = (x: typeof f20, k: (typeof rows)[number][1]) => (x ? (byValue ? x[`${k}Value` as 'foreignValue'] ?? null : x[k] ?? null) : null);
  const max = Math.max(1, ...rows.flatMap(([, k]) => [Math.abs(val(f20, k) ?? 0), Math.abs(val(f5, k) ?? 0)]));
  const line = (x: typeof f20) => rows.map(([l, k]) => { const v = val(x, k); const w = v == null ? 0 : Math.abs(v) / max * 50; return `<div class="si-flow"><span>${l}</span><div class="si-fbar"><i class="${v != null && v < 0 ? 'neg' : 'pos'}" style="width:${w.toFixed(1)}%;${v != null && v < 0 ? `right:50%` : 'left:50%'}"></i></div><b class="${tone(v)}">${byValue ? krw(v) : shares(v)}</b></div>`; }).join('');
  const hold = f.days.at(-1)?.foreignHoldRatio;
  return `<section class="card si-card"><div class="head"><h2>투자자 동향</h2><span class="sub">${byValue ? '순매수 금액(어림)' : '순매수 수량'}</span></div><div class="seg si-seg" role="tablist" aria-label="기간"><button type="button" data-si-f="20" aria-selected="true">20일</button><button type="button" data-si-f="5" aria-selected="false">5일</button></div><div data-si-fl="20">${line(f20)}</div><div data-si-fl="5" hidden>${line(f5)}</div>${hold != null ? `<p class="fine">외국인 보유율 ${hold.toFixed(2)}%${f.holdRatioChange20 != null ? ` · 20일 ${f.holdRatioChange20 > 0 ? '+' : ''}${f.holdRatioChange20.toFixed(2)}%p` : ''}</p>` : ''}</section>`;
}

/** `lockFootprint` wraps our footprint reading (Plus); the investor flows themselves are public data and stay free. */
export function flowsPanel(flow: FlowSection | null, fp: Footprint, lockFootprint: (html: string) => string = (h) => h): string {
  if (!flow) return `<div class="card"><div class="head"><h2>투자자 동향</h2></div><div class="v2-mask" aria-label="수급 자료 없음"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><p>아직 수급 자료를 받지 못했어요.</p></div></div>`;
  const legend = (['foreign', 'institution', 'individual'] as const).map((k) => `<span><i style="background:${FLOW_COLORS[k]}"></i>${{ foreign: '외국인', institution: '기관', individual: '개인' }[k]}</span>`).join('');
  const recent = [...flow.days].reverse().slice(0, 10).map((d) => `<tr><td class="nowrap">${esc(d.date.slice(5))}</td><td class="num ${tone(d.foreignNet)}">${both(d.foreignValue, d.foreignNet)}</td><td class="num ${tone(d.institutionNet)}">${both(d.institutionValue, d.institutionNet)}</td><td class="num ${tone(d.individualNet)}">${both(d.individualValue, d.individualNet)}</td></tr>`).join('');
  const fpTone = fp.state === 'ACCUMULATION_LIKE' ? 'up' : fp.state === 'DISTRIBUTION_LIKE' ? 'down' : '';
  return `<div class="grid2 tight">${investorTrend(flow)}
<div class="card"><div class="head"><h2>누적 순매수</h2><div class="legend-inline">${legend}</div></div>${flowChart(flow)}
<details class="more"><summary>최근 10거래일 보기</summary><div class="table-wrap"><table class="compact"><thead><tr><th>날짜</th><th class="num">외국인</th><th class="num">기관</th><th class="num">개인</th></tr></thead><tbody>${recent}</tbody></table></div><p class="fine">출처: 네이버 증권 투자자별 매매동향. 기타법인 등은 빠져 있어 세 줄의 합이 0이 아닐 수 있어요.</p></details></div>
${lockFootprint(`<div class="card"><div class="head"><h2>수급 흔적</h2></div>
<div class="signal-label ${fpTone}" style="text-align:left">${FOOTPRINT[fp.state]}</div><div class="tally">점수 ${fp.score > 0 ? '+' : ''}${fp.score} (−100 분산 ~ +100 매집)</div>
<ul class="plain">${fp.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
<p class="fine">거래량과 투자자별 순매수로 본 흔적이에요. 조작의 증거가 아니에요.</p></div>`)}</div>`;
}

type Bar = { date: string; open: number; high: number; low: number; close: number; volume: number };

/** A Toss-style range: low and high at the ends, a dot where the price is now. */
function rangeBar(label: string, low: number, high: number, now: number, note = '', ends: [string, string] = ['최저', '최고']): string {
  const at = high > low ? Math.min(100, Math.max(0, ((now - low) / (high - low)) * 100)) : 50;
  return `<div class="si-range"><div class="si-rk">${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</div><div class="si-rbar"><i style="left:${at.toFixed(1)}%"></i></div><div class="si-rv"><span>${ends[0]} <b>${won(low)}</b></span><span>${ends[1]} <b>${won(high)}</b></span></div></div>`;
}
/**
 * G-176: current price → analyst target on the 52-week scale. The old bar ran from the current price to the
 * target, so its dot always sat at one end; this one fills the gap between them and marks the 52-week range.
 */
function targetBar(now: number, target: number, low52: number | null, high52: number | null): string {
  const lo = Math.min(now, target, low52 ?? now), hi = Math.max(now, target, high52 ?? now), span = hi - lo || 1;
  const at = (v: number) => (((v - lo) / span) * 100).toFixed(1);
  const a = Math.min(now, target), b = Math.max(now, target), up = target >= now;
  const tick = (v: number | null, label: string) => (v == null ? '' : `<em class="tb-tick" style="left:${at(v)}%" title="${label} ${won(v)}"></em>`);
  return `<div class="si-range tb"><div class="si-rk">현재가 → 목표가<small>${up ? '목표가까지' : '목표가보다 위'} ${pct((target / now - 1) * 100)}</small></div>
<div class="tb-bar">${tick(low52, '52주 최저')}${tick(high52, '52주 최고')}<span class="tb-fill ${up ? 'up' : 'down'}" style="left:${at(a)}%;width:${(((b - a) / span) * 100).toFixed(1)}%"></span><i class="tb-now" style="left:${at(now)}%"></i><b class="tb-tgt" style="left:${at(target)}%"></b></div>
<div class="si-rv"><span>${lo === low52 ? '52주 최저' : lo === target ? '목표가' : '현재가'} <b>${won(lo)}</b></span><span>${hi === high52 ? '52주 최고' : hi === target ? '목표가' : '현재가'} <b>${won(hi)}</b></span></div>
<div class="tb-key"><span><i class="tb-now"></i>현재가 ${won(now)}</span><span><b class="tb-tgt"></b>목표가 ${won(target)}</span></div></div>`;
}
const cell = (k: string, v: string, _hint = '') => `<div class="si-c"><span>${esc(k)}</span><b>${v}</b></div>`;
const eok = (v: number | null | undefined) => (v == null ? '없음' : currency() === 'USD' ? bigMoney(v) : v >= 1e12 ? `${(v / 1e12).toFixed(v >= 1e14 ? 0 : 1)}조원` : v >= 1e8 || v <= 0 ? `${Math.round(v / 1e8).toLocaleString('ko-KR')}억원` : `${Math.max(1, Math.round(v / 1e4)).toLocaleString('ko-KR')}만원`);
const num = (v: number | null | undefined, unit: string, d = 2) => (v == null || !Number.isFinite(v) ? '없음' : `${v.toFixed(d)}${unit}`);

/**
 * G-141: 요약's quick stock info, Toss-style, right under the price: today's and the year's range, the six
 * numbers people check first, and who bought over the last five sessions. The full cards live in 기업 체력.
 */
export function quickInfoCard(market: MarketSection | undefined, close: number | null, bars: readonly Bar[] = []): string {
  if (!market) return '';
  const s = market.snapshot, last = bars.at(-1), now = close ?? last?.close ?? null;
  const year = last ? bars.filter((b) => b.date >= new Date(Date.parse(last.date) - 365 * 864e5).toISOString().slice(0, 10)) : [];
  const hi52 = year.length > 100 ? Math.max(...year.map((b) => b.high)) : s?.high52w ?? null, lo52 = year.length > 100 ? Math.min(...year.map((b) => b.low)) : s?.low52w ?? null;
  const ranges = now ? `${last ? rangeBar('오늘', last.low, last.high, now, last.date.slice(5).replace('-', '/'), ['저가', '고가']) : ''}${hi52 && lo52 ? rangeBar('1년', lo52, hi52, now, `최고가 대비 ${pct((now / hi52 - 1) * 100)}`) : ''}` : '';
  const hold = market.flows?.days.at(-1)?.foreignHoldRatio ?? null;
  const cells = [
    s?.marketCap != null ? cell('시가총액', eok(s.marketCap)) : '',
    s?.per != null ? cell('PER', num(s.per, '배')) : '',
    s?.pbr != null ? cell('PBR', num(s.pbr, '배')) : '',
    s?.dividendYield != null ? cell('배당수익률', num(s.dividendYield, '%')) : '',
    hold != null ? cell('외국인 보유', num(hold, '%')) : '',
    last ? cell('거래대금', eok(last.volume * last.close)) : '',
  ].filter(Boolean);
  const f5 = market.flows?.sums.find((x) => x.days === 5);
  const who = f5 ? ([['외국인', 'foreign'], ['기관', 'institution'], ['개인', 'individual']] as const).map(([l, k]) => {
    const v = f5[`${k}Value` as 'foreignValue'] ?? null, n = f5[k] ?? null;
    return `<span class="qi-who"><small>${l}</small><b class="${tone(v ?? n)}">${v != null ? krw(v) : shares(n)}</b></span>`;
  }).join('') : '';
  if (!ranges && !cells.length && !who) return '';
  return `<section class="card qi-card" id="quick-info"><div class="head"><h2>종목 정보</h2><a class="qi-more" href="#tab-fundamentals">기업 체력 ›</a></div>${ranges}${cells.length ? `<div class="si-grid qi-grid">${cells.join('')}</div>` : ''}${who ? `<div class="qi-flow"><span class="qi-k">최근 5일 순매수</span>${who}</div>` : ''}</section>`;
}

/** 재무제표, simple (G-148): one picture per statement under 손익·재무·현금흐름; 자세히 보기 opens every table full screen. */
function financeCard(market: MarketSection, st?: FullStatements): string {
  const q = market.quarters.filter((p) => !p.isEstimate);
  const tabs: [string, string][] = [];
  // G-171: the same infographics as 자세히 보기 — DART's yearly 손익 bars, then the quarters in the same bars (estimates E).
  const yearly = st ? statementChart(st, 'IS') : '', quarterly = quarterBars(market.quarters);
  const both = !!yearly && !!quarterly, estimate = market.quarters.slice(-6).some((p) => p.isEstimate);
  const is = `${yearly ? `${both ? '<h3 class="fs-sub">연간</h3>' : ''}${yearly}` : ''}${quarterly ? `${both ? '<h3 class="fs-sub">분기</h3>' : ''}${quarterly}${estimate ? '<p class="ig-note">E는 증권사 추정치예요.</p>' : ''}` : ''}`;
  if (is) tabs.push(['손익', is]);
  // 재무상태: the 부채·자본 split by year, as in 자세히 보기.
  const bsChart = st ? statementChart(st, 'BS') : '';
  if (bsChart) tabs.push(['재무상태', bsChart]);
  // G-170: 부채비율 and 당좌비율 each get their own tab, full width (side by side they crowded and hid the 100% line).
  const stb = q.filter((p) => p.metrics['부채비율'] != null || p.metrics['당좌비율'] != null).slice(-5);
  const ratio = (k: string, good: 'low' | 'high') => {
    const vs = stb.map((p) => p.metrics[k] ?? null), ref = 100, top = Math.max(ref * 1.25, ...vs.map((v) => v ?? 0)) * 1.08;
    const ok = (v: number) => (good === 'low' ? v <= ref : v >= ref), last = vs.at(-1);
    if (vs.every((v) => v == null)) return '';
    return `<div class="si-stab"><div class="si-sk"><b>${k}</b><span class="${last == null ? '' : ok(last) ? 'si-ok' : 'si-warn'}">${last == null ? '없음' : `${last.toFixed(0)}% · ${ok(last) ? '무난' : '주의'}`}</span></div>
<div class="si-cols" style="--ref:${(ref / top).toFixed(3)}"><em>${ref}%</em>${stb.map((p, i2) => { const v = vs[i2]; return `<div><span>${v == null ? '-' : v.toFixed(0)}</span><i class="${v == null ? '' : ok(v) ? 'ok' : 'warn'}" style="height:${v == null ? 0 : Math.max(3, (v / top) * 100).toFixed(1)}%"></i><small>${p.period.slice(2, 4)}.${p.period.slice(4)}</small></div>`; }).join('')}</div></div>`;
  };
  const debt = stb.length >= 2 ? ratio('부채비율', 'low') : '', quick = stb.length >= 2 ? ratio('당좌비율', 'high') : '';
  if (debt) tabs.push(['부채비율', `${debt}<p class="ig-note">빚 ÷ 자기자본이에요. 낮을수록 튼튼하고, 100% 이하면 무난해요.</p>`]);
  if (quick) tabs.push(['당좌비율', `${quick}<p class="ig-note">현금처럼 바로 쓸 수 있는 자산 ÷ 1년 안에 갚을 빚이에요. 높을수록 좋고, 100% 이상이면 무난해요.</p>`]);
  const cf = st ? statementChart(st, 'CF') : '';
  if (cf) tabs.push(['현금흐름', cf]);
  if (!tabs.length) return '';
  const detail = statementsCard(market, st);
  return `<section class="card si-card fs-simple"><div class="head"><h2>재무제표</h2>${detail ? '<button type="button" class="si-more" data-dlg-open="fs-detail">자세히 보기 ›</button>' : ''}</div>
<div class="seg ig-seg" role="tablist" aria-label="재무제표 종류">${tabs.map(([l], i) => `<button type="button" data-fs="s${i}" aria-selected="${i === 0}">${l}</button>`).join('')}</div>
${tabs.map(([, html], i) => `<div data-fsl="s${i}"${i ? ' hidden' : ''}>${html}</div>`).join('')}
${detail ? `<dialog class="v2-dialog fs-dlg" id="fs-detail" aria-label="재무제표 자세히"><header><button type="button" class="dialog-x" data-dlg-close aria-label="닫기">닫기</button><h2>재무제표</h2></header>${detail}</dialog>` : ''}</section>`;
}

/**
 * 기업 체력 (G-148, 토스 순서): 한눈에 → 투자 지표 → 재무제표 → 애널리스트 의견(+증권사 리포트) → 시장 대비.
 * Price ranges live in 요약's 종목 정보 and investor flows in 수급, so neither repeats here. Every card shows
 * only what the data has; a missing card is left out rather than filled with dashes.
 */
export function stockInfoCards(market: MarketSection, close: number | null, _name: string, bars: readonly Bar[] = [], st?: FullStatements): string {
  const s = market.snapshot, out: string[] = [];
  const card = (title: string, body: string, sub = '') => out.push(`<section class="card si-card"><div class="head"><h2>${esc(title)}</h2>${sub ? `<span class="sub">${sub}</span>` : ''}</div>${body}</section>`);
  const now = close ?? bars.at(-1)?.close ?? null;
  // 투자 지표 (the dividend yield only: payout and history are under 실적·배당 and 재무제표 자세히)
  const q = market.quarters.filter((p) => !p.isEstimate), y = market.years.filter((p) => !p.isEstimate);
  const sales4 = q.length >= 4 ? q.slice(-4).reduce((a, p) => a + (p.metrics['매출액'] ?? NaN), 0) : null;
  const roe = y.at(-1)?.metrics['ROE'] ?? q.at(-1)?.metrics['ROE'] ?? null;
  if (s || q.length) {
    const cap = s?.marketCap ?? null, psr = cap && sales4 && Number.isFinite(sales4) && sales4 > 0 ? cap / (sales4 * financeScale()) : null;
    const cells = [cell('시가총액', eok(cap)), cell('PER', num(s?.per, '배')), s?.estimatedPer != null ? cell('추정 PER', num(s.estimatedPer, '배')) : '', cell('PBR', num(s?.pbr, '배')), roe != null ? cell('ROE', num(roe, '%')) : '', psr != null ? cell('PSR', num(psr, '배')) : '',
      s?.eps != null ? cell('EPS', won(s.eps)) : '', s?.bps != null ? cell('BPS', won(s.bps)) : '', s?.dividendYield != null ? cell('배당수익률', num(s.dividendYield, '%')) : ''].filter(Boolean);
    card('투자 지표', `<div class="si-grid">${cells.join('')}</div>
<p class="fine">${currency() === 'USD' ? '네이버 증권(지표)·SEC EDGAR(실적) 기준.' : '네이버 증권 기준.'} ROE는 최근 결산, PSR은 시가총액 ÷ 최근 4분기 매출액이에요.</p>`);
  }
  const fin = financeCard(market, st);
  if (fin) out.push(fin);
  // 애널리스트 의견 + 최근 증권사 리포트 (one card)
  const cons = s?.consensus;
  // G-117: each report opens on Naver (summary and the broker's PDF) in a new tab.
  const li = (r: MarketSection['research'][number]) => `<li><span class="why">${esc(r.date.slice(5))} ${esc(r.broker)}</span> ${/^\d+$/.test(r.id) ? `<a href="https://m.stock.naver.com/research/company/${esc(r.id)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a>` : esc(r.title)}</li>`;
  const rs = market.research;
  const reports = rs.length ? `<h3 class="si-h3">최근 증권사 리포트</h3><ul class="plain research">${rs.slice(0, 3).map(li).join('')}</ul>${rs.length > 3 ? `<details class="more"><summary>${rs.length - 3}개 더 보기</summary><ul class="plain research">${rs.slice(3).map(li).join('')}</ul></details>` : ''}` : '';
  if ((cons?.targetPriceMean && now) || reports) {
    let head = '';
    if (cons?.targetPriceMean && now) {
      const up = (cons.targetPriceMean / now - 1) * 100, rec = cons.recommendationMean;
      const recLabel = rec == null ? '' : rec >= 4.5 ? '강력 매수' : rec >= 3.5 ? '매수' : rec >= 2.5 ? '중립' : rec >= 1.5 ? '매도' : '강력 매도';
      head = `<div class="si-target"><div><span>평균 목표가</span><b>${won(cons.targetPriceMean)}</b><small class="${tone(up)}">현재가 대비 ${pct(up)}</small></div>${rec != null ? `<div><span>투자의견 평균</span><b>${recLabel}</b><small>${rec.toFixed(2)} / 5</small></div>` : ''}</div>${targetBar(now, cons.targetPriceMean, s?.low52w ?? null, s?.high52w ?? null)}`;
    }
    card('애널리스트 의견', `${head}${reports}<p class="fine">증권사 컨센서스${cons?.date ? `(${esc(cons.date)})` : ''}와 리포트 제목이에요. 우리 판단이 아니에요.</p>`);
  }
  return out.length ? `<div class="si-wrap">${out.join('')}</div>` : '';
}

export const STOCK_INFO_CSS = `.qi-card{margin:14px 0}.qi-card .head{display:flex;justify-content:space-between;align-items:baseline}.qi-card h2{font-size:17px;margin:0 0 4px}.qi-more{font-size:13.5px;font-weight:800;color:var(--accent-strong);text-decoration:none}.qi-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.qi-flow{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:13px}.qi-k{color:var(--fg2);font-weight:700;margin-right:auto}.qi-who{display:inline-flex;gap:6px;align-items:baseline}.qi-who small{color:var(--muted)}@media (max-width:520px){.qi-k{width:100%}}
.si-wrap{columns:2;column-gap:14px;margin-bottom:16px}.si-card{min-width:0;break-inside:avoid;margin:0 0 14px;display:block}.si-card .head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.si-card h2{font-size:17px;margin:0 0 10px}
.si-range{margin:6px 0 14px}.tb-bar{position:relative;height:8px;margin:10px 0 4px;border-radius:99px;background:var(--soft)}.tb-fill{position:absolute;top:0;bottom:0;border-radius:99px;opacity:.85}.tb-fill.up{background:linear-gradient(90deg,#ffd3d7,var(--up))}.tb-fill.down{background:linear-gradient(90deg,var(--down),#d3e3ff)}.tb-tick{position:absolute;top:-3px;width:2px;height:14px;margin-left:-1px;background:#c3c9d2}.tb-now,.tb-tgt{display:inline-block}.tb-bar .tb-now{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--fg);border:2px solid var(--surface-solid);box-shadow:0 1px 4px rgba(0,0,0,.25)}.tb-bar .tb-tgt{position:absolute;top:50%;width:4px;height:18px;margin:-9px 0 0 -2px;border-radius:2px;background:var(--accent)}.tb-key{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--fg2);margin-top:8px}.tb-key span{display:inline-flex;align-items:center;gap:6px}.tb-key .tb-now{width:10px;height:10px;border-radius:50%;background:var(--fg)}.tb-key .tb-tgt{width:4px;height:12px;border-radius:2px;background:var(--accent)}.si-rk{display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--fg2);margin-bottom:6px}.si-rk small{font-weight:500;color:var(--muted)}.si-rbar{position:relative;height:6px;border-radius:99px;background:linear-gradient(90deg,#c9d7f2,#f2c9c9)}.si-rbar i{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--navy,#13294b);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)}.si-rv{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:6px}.si-rv b{color:var(--fg);font-weight:700}
.si-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.si-c{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px}.si-c span{color:var(--fg2)}.si-c b{font-variant-numeric:tabular-nums;text-align:right}
.si-seg{margin-bottom:8px;width:max-content}.si-flow{display:grid;grid-template-columns:56px minmax(0,1fr) 84px;align-items:center;gap:8px;padding:7px 0;font-size:14px}.si-flow b{text-align:right;font-variant-numeric:tabular-nums}.si-fbar{position:relative;height:10px;background:var(--soft);border-radius:4px}.si-fbar::after{content:"";position:absolute;left:50%;top:-3px;bottom:-3px;width:1px;background:var(--line-strong)}.si-fbar i{position:absolute;top:0;bottom:0;border-radius:3px}.si-fbar i.pos{background:var(--up)}.si-fbar i.neg{background:var(--accent)}
.fc-row{margin:14px 0 4px}.fc-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:14px}.fc-h span{font-size:13px;color:var(--fg2)}.fc-h span b{color:var(--fg)}.fc-h em{font-style:normal;font-weight:700;margin-left:4px}
/* G-185: gauges on glass: the scored band lit with its own colour, a slim needle with a glowing tip, each horizon a glass tile tinted by its verdict. */
.g-seg{opacity:.3;transition:opacity .4s,filter .4s}.g-seg.on{opacity:1;filter:drop-shadow(0 0 5px currentColor)}
.mini-gauge:not(:has(.on)) .g-seg,.gauge:not(:has(.on)) .g-seg{opacity:.55}
.g-tip{fill:#fff;filter:drop-shadow(0 0 4px rgba(0,166,251,.95))}.g-end{fill:var(--muted)}
html[data-theme=dark] .g-hub{fill:var(--surface-solid);stroke:var(--fg);stroke-width:1.5}
.hz{position:relative;overflow:hidden;background:linear-gradient(165deg,rgba(255,255,255,.07),rgba(255,255,255,.015))!important;border:1px solid var(--line)!important;box-shadow:inset 0 1px rgba(255,255,255,.06),0 10px 30px -18px rgba(0,0,0,.6);-webkit-backdrop-filter:blur(var(--glass-blur));backdrop-filter:blur(var(--glass-blur));transition:transform .25s cubic-bezier(.34,1.56,.64,1),border-color .25s}
.hz::before{content:"";position:absolute;inset:-40% -20% auto;height:90%;pointer-events:none;background:radial-gradient(closest-side,var(--hz-glow,transparent),transparent);opacity:.55}
.hz-up{--hz-glow:rgba(255,122,122,.35);border-color:rgba(255,122,122,.25)!important}.hz-down{--hz-glow:rgba(92,187,255,.35);border-color:rgba(92,187,255,.25)!important}
.hz:hover{transform:translateY(-2px)}
html:not([data-theme=dark]) .hz{background:linear-gradient(165deg,rgba(255,255,255,.9),rgba(255,255,255,.6))!important}
/* G-185: glass bars: the range glows, the centre dot sits in a ring of the page colour. */
.fc-card .fc-bar{background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02)),var(--soft);box-shadow:inset 0 1px 2px rgba(0,0,0,.25),inset 0 0 0 1px var(--line)}
.fc-rng{background:linear-gradient(90deg,rgba(0,166,251,.32),rgba(0,166,251,.62),rgba(0,166,251,.32))!important;box-shadow:0 0 14px -2px rgba(0,166,251,.55)}
.fc-mid{border-color:var(--surface-solid)!important;box-shadow:0 0 0 1px var(--accent),0 0 12px rgba(0,166,251,.7)!important}
.fc-tick{position:absolute;top:-9px;width:2px;height:10px;margin-left:-1px;border-radius:2px}.fc-tick::after{content:"";position:absolute;left:50%;top:-5px;width:7px;height:7px;margin-left:-3.5px;border-radius:50%;background:inherit}
.fc-tick.cons,.lg-tick.cons{background:#F2C14E}.fc-tick.p50,.lg-tick.p50{background:#B794F6}
.lg-tick{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:0}
.fc-notes{display:flex;flex-wrap:wrap;gap:4px 16px;margin:8px 0 2px;font-size:12.5px;color:var(--fg2)}.fc-notes b{color:var(--fg)}
.value-head{margin-bottom:6px}
.lv-ladder{position:relative;display:flex;flex-direction:column;gap:2px;margin:12px 0 8px}
.lv-row{display:grid;grid-template-columns:42px minmax(78px,auto) minmax(0,1fr) 54px 64px;align-items:center;gap:10px;padding:7px 10px;border-radius:12px;font-size:13.5px;font-variant-numeric:tabular-nums;transition:background .2s}
.lv-row:hover{background:var(--soft)}
.lv-k{justify-self:start;font-size:11.5px;font-weight:800;padding:2px 8px;border-radius:999px}
.lv-res .lv-k{background:var(--up-soft);color:var(--up-strong)}.lv-sup .lv-k{background:var(--down-soft);color:var(--down-strong)}
.lv-p{font-weight:800;color:var(--fg)}
.lv-bar{position:relative;height:8px;border-radius:8px;background:var(--soft);overflow:hidden}
.lv-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:8px;transform-origin:left;transition:transform .9s cubic-bezier(.16,1,.3,1) calc(var(--i,0) * 70ms)}
.lv-res .lv-bar i{background:linear-gradient(90deg,rgba(255,122,122,.25),var(--up));box-shadow:0 0 10px -2px var(--up)}
.lv-sup .lv-bar i{background:linear-gradient(90deg,rgba(92,187,255,.25),var(--down));box-shadow:0 0 10px -2px var(--down)}
.lv-row em{font-style:normal;font-weight:700;text-align:right}
.lv-t{display:flex;align-items:center;justify-content:flex-end;gap:3px}.lv-t i{width:5px;height:5px;border-radius:50%;background:var(--fg2);opacity:.7}.lv-t small{margin-left:4px;color:var(--muted);font-size:11.5px}
.lv-now{display:flex;align-items:center;gap:10px;margin:6px 0;padding:8px 12px;border-radius:12px;border:1px solid var(--accent-line);background:linear-gradient(90deg,var(--accent-soft),transparent);font-size:13px;color:var(--fg2);box-shadow:0 0 22px -12px rgba(0,166,251,.8)}
.lv-now b{color:var(--fg);font-size:14.5px;font-variant-numeric:tabular-nums}
.lv-now::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px var(--accent-soft),0 0 12px var(--accent);animation:lv-pulse 2.4s ease-in-out infinite}
@keyframes lv-pulse{50%{box-shadow:0 0 0 7px transparent,0 0 12px var(--accent)}}
html.mo .lv-card:not(.mo-in) .lv-bar i{transform:scaleX(0)}
@media (max-width:560px){.lv-row{grid-template-columns:38px minmax(70px,auto) minmax(0,1fr) 50px;gap:8px;padding:7px 6px}.lv-t{display:none}}
@media (prefers-reduced-motion:reduce){.lv-now::before{animation:none}.lv-bar i{transition:none}}
.fc-bar{position:relative;height:14px;margin:8px 0 5px;background:var(--soft);border-radius:7px}.fc-rng{position:absolute;top:0;bottom:0;border-radius:7px;background:var(--accent-line)}.fc-mid{position:absolute;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--accent);border:2.5px solid #fff;box-shadow:0 0 0 1px var(--accent)}.fc-now{position:absolute;top:-5px;bottom:-5px;width:0;border-left:2px dashed var(--fg2)}
.fc-ends{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:12px;color:var(--fg2);font-variant-numeric:tabular-nums}.fc-ends small{color:var(--muted);font-size:11.5px}
.fc-legend{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--fg2);margin:2px 0 2px}.fc-legend i{display:inline-block;vertical-align:-1px;margin-right:5px}.lg-rng{width:16px;height:9px;border-radius:5px;background:var(--accent-line)}.lg-mid{width:9px;height:9px;border-radius:50%;background:var(--accent)}.lg-now{width:0;height:11px;border-left:2px dashed var(--fg2)}
.fs-sub{font-size:13px;font-weight:800;color:var(--fg2);margin:12px 0 2px}.fs-sub:first-child{margin-top:4px}.si-stab{margin:6px 0 16px}.si-sk{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:14px;margin-bottom:6px}.si-sk span{font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}.si-ok{color:var(--good-strong)}.si-warn{color:var(--up-strong)}.si-cols{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:14px;height:160px;align-items:end;padding:0 0 18px;border-bottom:1px solid var(--line)}.si-cols::before{content:"";position:absolute;z-index:1;left:0;right:0;bottom:calc(18px + var(--ref) * 142px);border-top:1.5px dashed var(--muted);pointer-events:none}.si-cols em{position:absolute;z-index:2;left:0;bottom:calc(21px + var(--ref) * 142px);font-size:11px;font-weight:700;font-style:normal;color:var(--fg2);background:var(--surface-solid);padding:0 5px 0 0}.si-cols div{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%}.si-cols div span{font-size:11.5px;font-weight:700;color:var(--fg2);margin-bottom:3px}.si-cols i{display:block;width:56%;max-width:40px;border-radius:5px 5px 0 0;background:#9fb3d9}.si-cols i.ok{background:#7fb38f}.si-cols i.warn{background:#e58a8d}.si-cols div:last-child i{filter:saturate(1.4) brightness(.85)}.si-cols small{position:absolute;bottom:-17px;font-size:10.5px;color:var(--muted)}.si-note{font-size:12px;color:var(--muted);margin:22px 0 0}
.si-dps{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.si-dps span{display:flex;flex-direction:column;font-size:12px;color:var(--muted);background:var(--soft);border-radius:10px;padding:6px 10px}.si-dps b{color:var(--fg);font-size:14px}
.si-target{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:12px}.si-target div{display:flex;flex-direction:column;gap:2px}.si-target span{font-size:13px;color:var(--fg2)}.si-target b{font-size:22px;font-variant-numeric:tabular-nums}.si-target small{font-size:13px}

.si-more{border:0;background:none;font:inherit;font-size:13.5px;font-weight:800;color:var(--accent-strong);cursor:pointer;padding:4px 0}.si-h3{font-size:14px;margin:14px 0 4px}.si-card .research li{margin:6px 0;font-size:13.5px;line-height:1.5}
dialog.fs-dlg>header{display:flex;align-items:center;gap:6px}dialog.fs-dlg>header h2{font-size:17px;margin:0}dialog.fs-dlg .fs-full{border:0;box-shadow:none;padding:0;margin:0}
@media (min-width:821px){dialog.v2-dialog.fs-dlg[open]{width:min(920px,calc(100% - 48px))!important}}
@media (max-width:820px){.si-wrap{columns:1}}`;

/** Toggle of the investor-trend period inside 종목정보. */
export const STOCK_INFO_TOGGLE_JS = `document.addEventListener('click',function(e){var o=e.target.closest&&e.target.closest('[data-dlg-open]');if(o){var d=document.getElementById(o.getAttribute('data-dlg-open'));if(d&&!d.open)d.showModal();return;}var c=e.target.closest&&e.target.closest('[data-dlg-close]');if(c){var dd=c.closest('dialog');if(dd)dd.close();}});document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-si-f]');if(!b)return;var c=b.closest('.si-card');c.querySelectorAll('[data-si-f]').forEach(function(x){x.setAttribute('aria-selected',String(x===b));});c.querySelectorAll('[data-si-fl]').forEach(function(x){x.hidden=x.getAttribute('data-si-fl')!==b.getAttribute('data-si-f');});});`;

export function fundamentalsPanel(market: MarketSection, close: number | null, name = '이 종목', bars: readonly Bar[] = [], st?: FullStatements): string {
  const bench = market.benchmarks.map((b) => `<tr><td>${esc(b.name)}</td>${b.returns.map((r) => {
    const raw = r.stock !== null && r.benchmark !== null ? r.stock - r.benchmark : null;
    const diff = raw === null ? null : Math.abs(raw) < 0.05 ? 0 : raw;
    return `<td class="num"><span class="${tone(r.benchmark)}">${pct(r.benchmark)}</span><br><small class="${tone(diff)}">차이 ${diff === null ? '없음' : `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%p`}</small></td>`;
  }).join('')}</tr>`).join('');
  const stockRow = market.benchmarks[0] ? `<tr><td class="nowrap"><b>${esc(name)}</b></td>${market.benchmarks[0].returns.map((r) => `<td class="num ${tone(r.stock)}"><b>${pct(r.stock)}</b></td>`).join('')}</tr>` : '';
  const vs = bench ? `<div class="card"><div class="head"><h2>시장 대비 수익률</h2></div><div class="table-wrap"><table class="compact"><thead><tr><th></th><th class="num">5일</th><th class="num">20일</th><th class="num">60일</th></tr></thead><tbody>${stockRow}${bench}</tbody></table></div>
<p class="fine">차이는 ${esc(name)} 수익률에서 비교 대상 수익률을 뺀 값이에요.</p></div>` : '';
  return `${healthInfographic(market, close)}${stockInfoCards(market, close, name, bars, st)}${vs}`;
}


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

