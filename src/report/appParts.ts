// App-style sections (BLACK ORACLE mobile mockup v1 tone, docs/DESIGN.md G-15):
// hero with key points, market strip with sparklines, council consensus ring,
// latest news and filings lists, and the interactive candlestick chart with an
// indicator menu (Lightweight Charts v5 panes).

import type { DailyReport, ReportedFiling } from './dailyReport.js';
import type { Commentary } from '../analysis/commentary.js';

const esc = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const won = (v: number) => `${Math.round(v).toLocaleString('ko-KR')}원`;
const num = (v: number, digits = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pct = (v: number | null, digits = 2) => (v === null ? '없음' : `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`);
const tone = (v: number | null) => (v === null || v === 0 ? '' : v > 0 ? 'up' : 'down');
const kstTime = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');

/** Small line chart; colour follows the sign of the whole window (Korean convention). */
export function sparkline(values: readonly number[], label: string, width = 120, height = 36): string {
  if (values.length < 2) return '';
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 3 - ((v - lo) / span) * (height - 6)).toFixed(1)}`).join(' ');
  const up = values.at(-1)! >= values[0]!;
  return `<svg viewBox="0 0 ${width} ${height}" class="spark" role="img" aria-label="${esc(label)}"><polyline fill="none" stroke="${up ? '#d1373d' : '#2a62c9'}" stroke-width="1.6" points="${pts}"/></svg>`;
}

const FOOTPRINT_WORD = { ACCUMULATION_LIKE: '매집 쪽', DISTRIBUTION_LIKE: '분산 쪽', MIXED: '엇갈림', NEUTRAL: '뚜렷하지 않음', DATA_GAP: '기록 부족' } as const;
const POSITION_WORD = { ABOVE: '적정 범위 위', INSIDE: '적정 범위 안', BELOW: '적정 범위 아래' } as const;

export function hero(report: DailyReport, options: { live: boolean; asOf: string }): string {
  const p = report.price, m = report.market;
  const mid = m?.horizons.find((h) => h.key === 'MEDIUM')?.summary;
  const points = [
    mid ? ['중기 기술 신호', mid.label, mid.score === null ? '' : mid.score >= 0.1 ? 'up' : mid.score <= -0.1 ? 'down' : ''] : null,
    m?.fairValue ? ['기술적 적정가', `${won(m.fairValue.center)} (${POSITION_WORD[m.fairValue.position]})`, ''] : null,
    m ? ['수급 흔적', FOOTPRINT_WORD[m.footprint.state], m.footprint.state === 'ACCUMULATION_LIKE' ? 'up' : m.footprint.state === 'DISTRIBUTION_LIKE' ? 'down' : ''] : null,
    m?.snapshot?.consensus?.targetPriceMean ? ['증권가 평균 목표가', won(m.snapshot.consensus.targetPriceMean), ''] : null,
  ].filter((x): x is string[] => x !== null);
  return `<section class="hero" id="top"><div class="orb" aria-hidden="true"></div>
<div class="hero-main"><div class="eyebrow"><span>${esc(report.symbol)}</span><span>코스피</span><span>${options.live ? `${esc(options.asOf)} 기준 최신` : `${esc(report.date)} 리포트`}</span></div>
<h1>${esc(report.name)}</h1>
${p ? `<div class="hero-price"><b>${esc(won(p.close))}</b>${p.changePct === null ? '' : `<span class="${tone(p.changePct)}">${p.change! > 0 ? '▲' : p.change! < 0 ? '▼' : ''} ${esc(num(Math.abs(p.change!)))} (${esc(pct(p.changePct))})</span>`}</div>
<div class="hero-sub">${esc(p.sessionDate ?? report.date)} 종가</div>` : '<p class="empty">아직 가격 기록이 없어요.</p>'}
<p class="hero-line">${esc(report.headline)}</p></div>
${points.length ? `<div class="key-points"><div class="kp-title">핵심 포인트</div><ul>${points.map(([k, v, t]) => `<li><span>${esc(k!)}</span><b class="${t}">${esc(v!)}</b></li>`).join('')}</ul></div>` : ''}
</section>`;
}

/** Index-style strip: the stock and its benchmarks with a 60-session sparkline each. */
export function marketStrip(report: DailyReport): string {
  const m = report.market;
  const bars = report.recentBars ?? [];
  const items: { name: string; value: string; change: number | null; spark: number[] }[] = [];
  if (report.price) {
    items.push({ name: report.name, value: won(report.price.close), change: report.price.changePct, spark: bars.slice(-60).map((b) => b.close) });
  }
  for (const b of m?.benchmarks ?? []) {
    if (b.last === null) continue;
    items.push({ name: b.name, value: b.symbol === 'KOSPI' ? num(b.last, 2) : won(b.last), change: b.changePct, spark: b.spark });
  }
  if (!items.length) return '';
  return `<section class="block"><div class="block-head"><h2>시장 한눈에</h2><span class="muted">최근 60거래일</span></div>
<div class="strip">${items.map((it) => `<div class="strip-item"><div class="si-name">${esc(it.name)}</div><div class="si-value">${esc(it.value)}</div><div class="si-change ${tone(it.change)}">${esc(pct(it.change))}</div>${sparkline(it.spark, `${it.name} 최근 60거래일`)}</div>`).join('')}</div></section>`;
}

const STANCE_SCORE = { BULLISH: 80, NEUTRAL: 50, BEARISH: 20 } as const;
const STANCE_WORD = { BULLISH: '강세', NEUTRAL: '중립', BEARISH: '약세', INSUFFICIENT_DATA: '근거 부족' } as const;
const DESK_WORD = { MARKET: '시장', TECHNICAL: '기술', FLOW: '수급', FUNDAMENTAL: '펀더멘털', EVENT: '공시·뉴스' } as const;

/** 0–100: share of desks leaning bullish minus bearish, mapped onto 0–100 (50 = balanced). */
export function consensusScore(c: Commentary | undefined): number | null {
  const desks = (c?.desks ?? []).filter((d) => d.stance !== 'INSUFFICIENT_DATA');
  if (!desks.length) return null;
  return Math.round(desks.reduce((s, d) => s + STANCE_SCORE[d.stance as keyof typeof STANCE_SCORE], 0) / desks.length);
}

function ring(score: number | null): string {
  const r = 34, c = 2 * Math.PI * r;
  const len = score === null ? 0 : (score / 100) * c;
  return `<svg viewBox="0 0 84 84" class="ring" role="img" aria-label="위원회 합의 점수 ${score ?? '없음'}">
<circle cx="42" cy="42" r="${r}" fill="none" stroke="#efe7d6" stroke-width="7"/>
<circle cx="42" cy="42" r="${r}" fill="none" stroke="url(#ringGold)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)"/>
<defs><linearGradient id="ringGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d4b67e"/><stop offset="1" stop-color="#8f6c3a"/></linearGradient></defs>
<text x="42" y="47" text-anchor="middle" class="ring-num">${score ?? '–'}</text></svg>`;
}

export function councilCard(c: Commentary | undefined, from: string | null): string {
  if (!c || c.status !== 'OK') {
    return `<section class="block"><div class="block-head"><h2>AI 위원회</h2></div><div class="card"><p class="empty">${c ? 'AI 해설을 만들지 못했어요.' : '아직 AI 위원회 해설이 없어요. 평일 18시 이후 리포트에서 만들어져요.'}</p></div></section>`;
  }
  const score = consensusScore(c);
  const label = score === null ? '판단 보류' : score >= 60 ? '강세 우위' : score <= 40 ? '약세 우위' : '팽팽함';
  const desks = c.desks ?? [];
  const bars = desks.map((d) => {
    const v = d.stance === 'INSUFFICIENT_DATA' ? null : STANCE_SCORE[d.stance];
    return `<div class="dbar"><span class="dbar-v">${v ?? '–'}</span><div class="dbar-track"><i style="height:${v ?? 4}%" class="${d.stance === 'BULLISH' ? 'bull' : d.stance === 'BEARISH' ? 'bear' : 'neu'}"></i></div><span class="dbar-k">${DESK_WORD[d.desk]}</span></div>`;
  }).join('');
  return `<section class="block"><div class="block-head"><h2>AI 위원회 합의</h2><a href="#tab-ai" class="more-link">자세히 보기 ›</a></div>
<div class="card council"><div class="council-top">${ring(score)}<div><div class="council-label ${score !== null && score >= 60 ? 'up' : score !== null && score <= 40 ? 'down' : ''}">${label}</div>
<p>${esc(c.summary?.text ?? '')}</p>${from ? `<div class="muted small">${esc(from)} 리포트의 해설이에요.</div>` : ''}</div></div>
${bars ? `<div class="dbars" aria-label="데스크별 의견">${bars}</div>` : ''}
${c.redTeam ? `<div class="debate"><b>레드팀</b> ${esc(c.redTeam.counterargument.text)}</div>` : ''}</div></section>`;
}

/** Filing link to the DART viewer (it adapts to phones by itself). */
const dartLink = (f: ReportedFiling) => `<a href="${esc(f.url)}" data-dart="${esc(f.receiptNo)}" rel="noopener" target="_blank">${esc(f.title)}</a>`;

export function latestLists(report: DailyReport): string {
  const news = (report.news?.clusters ?? []).slice(0, 5);
  const filings = (report.recentFilings ?? report.filings).slice(0, 5);
  const IMP = { HIGH: '중요', MEDIUM: '보통', LOW: '참고' } as const;
  return `<div class="grid-eq">
<section class="block"><div class="block-head"><h2>최근 뉴스</h2><a href="#tab-news" class="more-link">전체 보기 ›</a></div><div class="card list">
${news.length ? news.map((c) => `<div class="row-item"><span class="badge b-${c.importance}">${IMP[c.importance]}</span><div class="ri-main"><a href="${esc(c.url)}" rel="noopener" target="_blank">${esc(c.title)}</a><div class="muted small">${esc(c.publisher)} ${esc(kstTime(c.firstAt))}${c.articles.length > 1 ? `  같은 내용 ${c.articles.length}건` : ''}</div></div></div>`).join('') : '<p class="empty">최근 7일 관련 뉴스가 없어요.</p>'}
</div></section>
<section class="block"><div class="block-head"><h2>최근 공시</h2><a href="#tab-news" class="more-link">전체 보기 ›</a></div><div class="card list">
${filings.length ? filings.map((f) => `<div class="row-item"><span class="badge b-${f.importance}">${IMP[f.importance]}</span><div class="ri-main">${dartLink(f)}<div class="muted small">${esc(f.filedDate)}  ${esc(f.category)}</div></div></div>`).join('') : '<p class="empty">최근 30일 공시가 없어요.</p>'}
</div></section></div>`;
}

/** DART serves its own mobile layout to phones from the same address, so links stay as they are. */
export const DART_SCRIPT = '';

export interface ChartMark { date: string; kind: 'filing' | 'news'; title: string; url: string; receiptNo?: string }

export function chartMarks(report: DailyReport): ChartMark[] {
  const marks: ChartMark[] = [];
  for (const f of report.recentFilings ?? report.filings) marks.push({ date: f.filedDate, kind: 'filing', title: f.title, url: f.url, receiptNo: f.receiptNo });
  for (const c of report.news?.clusters ?? []) {
    if (c.importance !== 'LOW') marks.push({ date: new Date(Date.parse(c.firstAt) + 9 * 3600_000).toISOString().slice(0, 10), kind: 'news', title: c.title, url: c.url });
  }
  return marks;
}

const OVERLAYS: [string, string, boolean][] = [
  ['ma5', '이동평균 5', false], ['ma20', '이동평균 20', true], ['ma60', '이동평균 60', true], ['ma120', '이동평균 120', false],
  ['ema12', '지수이동평균 12·26', false], ['bb', '볼린저 밴드', false], ['ichimoku', '일목균형표', false], ['env', '엔벨로프', false],
  ['levels', '지지·저항', false], ['fib', '피보나치', false], ['fair', '적정가 범위', false], ['forecast', '예측 범위', false],
];
const PANES: [string, string, boolean][] = [
  ['volume', '거래량', true], ['rsi', 'RSI', false], ['macd', 'MACD', false], ['stoch', '스토캐스틱', false],
  ['cci', 'CCI', false], ['wr', '윌리엄스 %R', false], ['obv', 'OBV', false], ['atr', 'ATR', false],
];
const RANGES: [string, number][] = [['1개월', 21], ['3개월', 63], ['6개월', 126], ['1년', 250], ['3년', 750], ['전체', 100000]];

/** Candlestick chart with indicator menu; the client script draws from embedded data. */
export function priceChart(report: DailyReport, overlays: unknown, base: string, chartAsset: string): { html: string; script: string } {
  const bars = report.recentBars ?? [];
  const strategies = (report.market?.arena?.results ?? []).filter((x) => x.key !== 'hold').map((x) => ({ key: x.key, name: x.name, rank: x.rank, position: x.position, trigger: x.trigger, trades: x.tradeLog ?? [] }));
  const last = bars.at(-1), prev = bars.at(-2);
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  const chip = (group: string, [key, label, on]: [string, string, boolean]) => `<button type="button" class="chip-toggle" data-${group}="${key}" aria-pressed="${on}">${esc(label)}</button>`;
  const html = `<section class="card chart-card" id="chart-card">
<div class="chart-head"><div><div class="muted small">현재가 (${esc(last?.date ?? '')} 종가)</div>
<div class="cur-price"><b>${last ? esc(won(last.close)) : '없음'}</b>${last && prev ? `<span class="${tone(last.close - prev.close)}">${last.close >= prev.close ? '▲' : '▼'} ${esc(num(Math.abs(last.close - prev.close)))} (${esc(pct((last.close / prev.close - 1) * 100))})</span>` : ''}</div>
<div class="period-stat" id="period-stat" aria-live="polite"></div></div>
<div class="seg" role="group" aria-label="기간">${RANGES.map(([label, n]) => `<button type="button" data-range="${n}" aria-pressed="${n === 63}">${label}</button>`).join('')}</div></div>
<details class="ind-menu"><summary>지표 고르기</summary>
<div class="ind-group"><span class="label">가격 위에</span>${OVERLAYS.map((o) => chip('ov', o)).join('')}</div>
<div class="ind-group"><span class="label">아래 창</span>${PANES.map((o) => chip('pane', o)).join('')}</div>
<div class="ind-group"><span class="label">표시</span>${chip('vl', ['filing', '공시', true])}${chip('vl', ['news', '뉴스', true])}</div></details>
${strategies.length ? `<div class="strat-row" role="group" aria-label="전략 매매 시점"><span class="label">전략 매매 시점</span><button type="button" class="chip-toggle" data-strategy="" aria-pressed="true">끄기</button>${strategies.map((st) => `<button type="button" class="chip-toggle" data-strategy="${esc(st.key)}" aria-pressed="false">${st.rank}위 ${esc(st.name)}</button>`).join('')}</div>
<div class="strat-info" id="strat-info" aria-live="polite" hidden></div>` : ''}
<div class="legend-line" id="legend"></div>
<div class="chart-wrap"><div class="ev-strip" id="ev-strip" role="group" aria-label="공시·뉴스"></div><div class="chart-body"><div id="chart" style="height:520px">${bars.length < 2 ? '<p class="empty">차트를 그릴 가격 기록이 부족해요.</p>' : ''}</div><div class="vlines" id="vlines" aria-hidden="true"></div></div>
<div class="mark-pop" id="mark-pop" role="dialog" aria-label="공시·뉴스 내용" hidden></div></div>
<p class="fine">차트 위 아이콘을 누르면 그날의 공시(금색)·뉴스(청록, 중요도 보통 이상) 내용이 뜨고, 거기서 원문으로 갈 수 있어요. 점선은 날짜 위치 표시예요. 전략 매매 시점의 ▲매수·▼매도는 그 전략 규칙이 과거 일봉에서 신호를 낸 날의 종가예요(백테스트, 투자 권유 아님).</p></section>`;
  const script = `<script type="application/json" id="bars">${json(bars)}</script>
<script type="application/json" id="marks">${json(chartMarks(report))}</script>
<script type="application/json" id="overlays">${json(overlays)}</script>
<script type="application/json" id="strategies">${json(strategies)}</script>
<script src="${base}${chartAsset}" defer></script>
<script>${CHART_JS}</script>`;
  return { html, script };
}

// Client chart script (plain ES5 so it runs anywhere). Indicators are computed here from the embedded bars.
const CHART_JS = `
window.addEventListener('DOMContentLoaded', function () {
  var L = window.LightweightCharts, el = document.getElementById('chart');
  if (!L || !el) return;
  var bars = JSON.parse(document.getElementById('bars').textContent);
  if (bars.length < 2) return;
  var marks = JSON.parse(document.getElementById('marks').textContent) || [];
  var ov = JSON.parse(document.getElementById('overlays').textContent) || {};
  var UP = '#d1373d', DOWN = '#2a62c9', GOLD = '#a8834a';
  var mobile = window.matchMedia('(max-width: 820px)').matches;
  var won = function (v) { return Math.round(v).toLocaleString('ko-KR') + '원'; };
  var chart = L.createChart(el, {
    autoSize: true,
    layout: { background: { color: 'transparent' }, textColor: '#7b7f87', fontFamily: 'inherit', panes: { separatorColor: '#ebe4d6' } },
    grid: { vertLines: { visible: false }, horzLines: { color: '#f2ece1' } },
    rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, rightOffset: 4 },
    crosshair: { mode: 0 },
    localization: { locale: 'ko-KR', priceFormatter: function (v) { return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(2); } }
  });
  var t = function (i) { return bars[i].date; };
  var C = bars.map(function (b) { return b.close; }), H = bars.map(function (b) { return b.high; }), Lo = bars.map(function (b) { return b.low; }), V = bars.map(function (b) { return b.volume; });
  var candle = chart.addSeries(L.CandlestickSeries, { upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN });
  candle.setData(bars.map(function (b) { return { time: b.date, open: b.open, high: b.high, low: b.low, close: b.close }; }));

  // ---- indicator maths ----
  var sma = function (a, n) { var o = [], s = 0; for (var i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; o.push(i >= n - 1 ? s / n : null); } return o; };
  var ema = function (a, n) { var o = [], k = 2 / (n + 1), p = null; for (var i = 0; i < a.length; i++) { if (a[i] == null) { o.push(null); continue; } p = p == null ? a[i] : a[i] * k + p * (1 - k); o.push(p); } return o; };
  var std = function (a, n, m) { return a.map(function (_, i) { if (i < n - 1) return null; var s = 0; for (var j = i - n + 1; j <= i; j++) s += (a[j] - m[i]) * (a[j] - m[i]); return Math.sqrt(s / n); }); };
  var hh = function (n, i) { var m = -Infinity; for (var j = Math.max(0, i - n + 1); j <= i; j++) m = Math.max(m, H[j]); return m; };
  var ll = function (n, i) { var m = Infinity; for (var j = Math.max(0, i - n + 1); j <= i; j++) m = Math.min(m, Lo[j]); return m; };
  var rsi = function (n) { var o = [], g = 0, l = 0; for (var i = 0; i < C.length; i++) { if (i === 0) { o.push(null); continue; } var d = C[i] - C[i - 1]; if (i <= n) { g += Math.max(d, 0); l += Math.max(-d, 0); if (i === n) { g /= n; l /= n; o.push(l === 0 ? 100 : 100 - 100 / (1 + g / l)); } else o.push(null); continue; } g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; o.push(l === 0 ? 100 : 100 - 100 / (1 + g / l)); } return o; };
  var series = function (vals) { var o = []; for (var i = 0; i < vals.length; i++) if (vals[i] != null && isFinite(vals[i])) o.push({ time: t(i), value: vals[i] }); return o; };
  var line = function (vals, color, pane, opts) { var s = chart.addSeries(L.LineSeries, Object.assign({ color: color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false }, opts || {}), pane || 0); s.setData(series(vals)); return s; };

  // ---- overlays (on the price pane) ----
  var built = {}, priceLines = {};
  var overlayMakers = {
    ma5: function () { return [line(sma(C, 5), '#6b6f78')]; },
    ma20: function () { return [line(sma(C, 20), '#d97706')]; },
    ma60: function () { return [line(sma(C, 60), '#7a4fb3')]; },
    ma120: function () { return [line(sma(C, 120), '#00968a')]; },
    ema12: function () { return [line(ema(C, 12), '#c2410c', 0, { lineStyle: 2 }), line(ema(C, 26), '#4338ca', 0, { lineStyle: 2 })]; },
    bb: function () { var m = sma(C, 20), s = std(C, 20, m); return [line(m, '#8a96a3', 0, { lineStyle: 2 }), line(m.map(function (x, i) { return x == null ? null : x + 2 * s[i]; }), '#8a96a3'), line(m.map(function (x, i) { return x == null ? null : x - 2 * s[i]; }), '#8a96a3')]; },
    env: function () { var m = sma(C, 20); return [line(m.map(function (x) { return x == null ? null : x * 1.06; }), '#b08d57', 0, { lineStyle: 1 }), line(m.map(function (x) { return x == null ? null : x * 0.94; }), '#b08d57', 0, { lineStyle: 1 })]; },
    ichimoku: function () {
      var conv = C.map(function (_, i) { return i < 8 ? null : (hh(9, i) + ll(9, i)) / 2; }), basev = C.map(function (_, i) { return i < 25 ? null : (hh(26, i) + ll(26, i)) / 2; });
      return [line(conv, '#e11d48'), line(basev, '#2563eb'), line(C.map(function (_, i) { return i < 51 ? null : (hh(52, i) + ll(52, i)) / 2; }), '#a8834a', 0, { lineStyle: 2 }), line(conv.map(function (x, i) { return x == null || basev[i] == null ? null : (x + basev[i]) / 2; }), '#16a34a', 0, { lineStyle: 2 })];
    }
  };
  var lineMakers = {
    levels: function () { return (ov.levels || []).map(function (l) { return candle.createPriceLine({ price: l.price, color: l.kind === 'SUPPORT' ? DOWN : UP, lineWidth: 1, axisLabelVisible: true, title: l.kind === 'SUPPORT' ? '지지' : '저항' }); }); },
    fib: function () { return (ov.fib || []).map(function (f) { return candle.createPriceLine({ price: f.price, color: GOLD, lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: 'Fib ' + (f.ratio * 100).toFixed(1) + '%' }); }); },
    fair: function () { if (!ov.fair) return []; return [['low', '적정 하단'], ['center', '적정가'], ['high', '적정 상단']].map(function (k) { return candle.createPriceLine({ price: ov.fair[k[0]], color: '#8a6a37', lineWidth: k[0] === 'center' ? 2 : 1, lineStyle: k[0] === 'center' ? 0 : 2, axisLabelVisible: true, title: k[1] }); }); }
  };
  var addDays = function (iso, n) { var d = new Date(iso + 'T00:00:00Z'); while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); var w = d.getUTCDay(); if (w !== 0 && w !== 6) n--; } return d.toISOString().slice(0, 10); };
  overlayMakers.forecast = function () {
    var f20 = (ov.forecasts || []).filter(function (f) { return f.horizon === 20; })[0], f60 = (ov.forecasts || []).filter(function (f) { return f.horizon === 60; })[0];
    if (!f20 || !f60) return [];
    var z = 1.2815515655446004, fan = { p10: [], p50: [], p90: [] }, d = f20.baseDate;
    ['p10', 'p50', 'p90'].forEach(function (q) { fan[q].push({ time: f20.baseDate, value: f20.baseClose }); });
    for (var h = 1; h <= 60; h++) {
      d = addDays(d, 1);
      var k = Math.min(1, Math.max(0, (h - 20) / 40)), sg = f20.sigma + (f60.sigma - f20.sigma) * k, mu = f20.drift * h, sp = z * sg * Math.sqrt(h);
      fan.p10.push({ time: d, value: f20.baseClose * Math.exp(mu - sp) }); fan.p50.push({ time: d, value: f20.baseClose * Math.exp(mu) }); fan.p90.push({ time: d, value: f20.baseClose * Math.exp(mu + sp) });
    }
    return [['p90', UP, 2, '상단 90%'], ['p50', '#8a6a37', 0, '예측 중앙'], ['p10', DOWN, 2, '하단 10%']].map(function (q) {
      var s = chart.addSeries(L.LineSeries, { color: q[1], lineWidth: q[0] === 'p50' ? 2 : 1, lineStyle: q[2], priceLineVisible: false, lastValueVisible: true, title: q[3], crosshairMarkerVisible: false });
      s.setData(fan[q[0]]); return s;
    });
  };

  // ---- panes (below the price) ----
  var paneMakers = {
    volume: function (p) { var s = chart.addSeries(L.HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false }, p); s.setData(bars.map(function (b, i) { return { time: b.date, value: b.volume, color: i && b.close < bars[i - 1].close ? 'rgba(42,98,201,.45)' : 'rgba(209,55,61,.45)' }; })); return [s]; },
    rsi: function (p) { var s = line(rsi(14), '#7a4fb3', p, { lastValueVisible: true, title: 'RSI 14' }); s.createPriceLine({ price: 70, color: '#d9c39a', lineStyle: 2, lineWidth: 1, axisLabelVisible: false }); s.createPriceLine({ price: 30, color: '#d9c39a', lineStyle: 2, lineWidth: 1, axisLabelVisible: false }); return [s]; },
    macd: function (p) {
      var f = ema(C, 12), s = ema(C, 26), m = C.map(function (_, i) { return i < 25 ? null : f[i] - s[i]; });
      var sig = ema(m, 9).map(function (x, i) { return i < 33 ? null : x; });
      var hist = chart.addSeries(L.HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, p);
      hist.setData(m.map(function (x, i) { return x == null || sig[i] == null ? null : { time: t(i), value: x - sig[i], color: x - sig[i] >= 0 ? 'rgba(209,55,61,.5)' : 'rgba(42,98,201,.5)' }; }).filter(Boolean));
      return [hist, line(m, '#1b2230', p, { title: 'MACD' }), line(sig, '#d97706', p, { title: '시그널' })];
    },
    stoch: function (p) { var k = C.map(function (c, i) { if (i < 13) return null; var h = hh(14, i), l = ll(14, i); return h === l ? 50 : (c - l) / (h - l) * 100; }); var ks = sma(k.map(function (x) { return x == null ? 0 : x; }), 3).map(function (x, i) { return i < 15 ? null : x; }); var ds = sma(ks.map(function (x) { return x == null ? 0 : x; }), 3).map(function (x, i) { return i < 17 ? null : x; }); return [line(ks, '#00968a', p, { title: '%K' }), line(ds, '#d97706', p, { title: '%D' })]; },
    cci: function (p) { var tp = bars.map(function (b) { return (b.high + b.low + b.close) / 3; }), m = sma(tp, 20); return [line(tp.map(function (x, i) { if (m[i] == null) return null; var md = 0; for (var j = i - 19; j <= i; j++) md += Math.abs(tp[j] - m[i]); md /= 20; return md === 0 ? 0 : (x - m[i]) / (0.015 * md); }), '#0e7490', p, { title: 'CCI 20' })]; },
    wr: function (p) { return [line(C.map(function (c, i) { if (i < 13) return null; var h = hh(14, i), l = ll(14, i); return h === l ? -50 : (h - c) / (h - l) * -100; }), '#be185d', p, { title: '%R 14' })]; },
    obv: function (p) { var o = 0; return [line(C.map(function (c, i) { if (i) o += c > C[i - 1] ? V[i] : c < C[i - 1] ? -V[i] : 0; return o; }), '#475569', p, { title: 'OBV' })]; },
    atr: function (p) { var a = null; return [line(bars.map(function (b, i) { if (!i) return null; var tr = Math.max(b.high - b.low, Math.abs(b.high - C[i - 1]), Math.abs(b.low - C[i - 1])); a = a == null ? tr : (a * 13 + tr) / 14; return i < 14 ? null : a; }), '#8a6a37', p, { title: 'ATR 14' })]; }
  };
  var paneOrder = [];
  var rebuildPanes = function () {
    // Remove all indicator panes and re-add the selected ones in menu order.
    while (chart.panes().length > 1) chart.removePane(chart.panes().length - 1);
    Object.keys(paneMakers).forEach(function (k) { delete built['pane:' + k]; });
    paneOrder = Array.prototype.slice.call(document.querySelectorAll('[data-pane]')).filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return b.getAttribute('data-pane'); });
    paneOrder.forEach(function (k, i) { built['pane:' + k] = paneMakers[k](i + 1); });
    chart.panes().forEach(function (p, i) { p.setStretchFactor(i === 0 ? 3 : 1); });
    el.style.height = (mobile ? 360 : 440) + paneOrder.length * (mobile ? 90 : 110) + 'px';
  };
  var setOverlay = function (k, on) {
    if (lineMakers[k]) { (priceLines[k] || []).forEach(function (pl) { candle.removePriceLine(pl); }); priceLines[k] = on ? lineMakers[k]() : []; return; }
    (built[k] || []).forEach(function (s) { chart.removeSeries(s); });
    built[k] = on ? overlayMakers[k]() : [];
  };
  document.querySelectorAll('[data-ov]').forEach(function (b) {
    if (b.getAttribute('aria-pressed') === 'true') setOverlay(b.getAttribute('data-ov'), true);
    b.addEventListener('click', function () { var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); setOverlay(b.getAttribute('data-ov'), on); if (b.getAttribute('data-ov') === 'forecast') setRange(currentRange, on ? 62 : 0); });
  });
  document.querySelectorAll('[data-pane]').forEach(function (b) { b.addEventListener('click', function () { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); rebuildPanes(); }); });
  rebuildPanes();

  // ---- filings and news: icons above the chart (click → popover), dashed guide lines on the chart ----
  var byBar = {};
  marks.forEach(function (m) { for (var i = 0; i < bars.length; i++) if (bars[i].date >= m.date) { (byBar[bars[i].date] = byBar[bars[i].date] || []).push(m); break; } });
  var vl = document.getElementById('vlines'), strip = document.getElementById('ev-strip'), pop = document.getElementById('mark-pop');
  var showKind = { filing: true, news: true }, groups = [], openIdx = -1;
  var ICON = {
    filing: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 7.5h4.5M6 10h4.5M9.5 1.5v3h3" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
    news: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3" width="13" height="10.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 6h5M4 8.5h8M4 11h8" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>'
  };
  var escHtml = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var closePop = function () { pop.hidden = true; openIdx = -1; strip.querySelectorAll('[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); }); };
  var openPop = function (idx) {
    var g = groups[idx]; if (!g) return;
    closePop(); openIdx = idx;
    var rows = [];
    g.days.forEach(function (d) { d.list.forEach(function (m) { rows.push({ day: m.date, m: m }); }); });
    rows.reverse();
    pop.innerHTML = '<div class="mp-head"><span>' + (g.days.length > 1 ? g.days[0].day + ' ~ ' + g.days[g.days.length - 1].day : g.days[0].day) + ' · ' + rows.length + '건</span><button type="button" aria-label="닫기">×</button></div>' +
      rows.map(function (r) { return '<div class="mp-row"><span class="badge ' + (r.m.kind === 'filing' ? 'b-MEDIUM">공시' : 'b-LOW">뉴스') + '</span><div class="mp-body"><div class="mp-title">' + escHtml(r.m.title) + '</div><div class="mp-meta">' + escHtml(r.day) + (r.m.url ? ' · <a href="' + escHtml(r.m.url) + '" target="_blank" rel="noopener">원문 보기 ↗</a>' : '') + '</div></div></div>'; }).join('');
    var wrapW = strip.clientWidth, pw = Math.min(360, wrapW - 8);
    pop.style.width = pw + 'px';
    pop.style.left = Math.max(4, Math.min(wrapW - pw - 4, g.x - pw / 2)) + 'px';
    pop.hidden = false;
    var btn = strip.querySelector('[data-g="' + idx + '"]'); if (btn) btn.setAttribute('aria-expanded', 'true');
    pop.querySelector('.mp-head button').onclick = closePop;
  };
  var drawLines = function () {
    var h = chart.panes()[0].getHeight(), w = el.clientWidth - chart.priceScale('right').width();
    var lines = '', icons = '';
    var prevOpen = openIdx >= 0 && groups[openIdx] ? groups[openIdx].days[0].day : null;
    groups = [];
    Object.keys(byBar).sort().forEach(function (day) {
      var list = byBar[day].filter(function (m) { return showKind[m.kind]; });
      if (!list.length) return;
      var x = chart.timeScale().timeToCoordinate(day);
      if (x == null || x < 0 || x > w) return;
      var f = list.some(function (m) { return m.kind === 'filing'; }), n = list.some(function (m) { return m.kind === 'news'; });
      lines += '<i class="vline ' + (f && n ? 'both' : f ? 'filing' : 'news') + '" style="left:' + Math.round(x) + 'px;height:' + h + 'px"></i>';
      // Days whose icons would touch share one icon; its popover lists them all.
      var last = groups[groups.length - 1];
      if (last && x - last.xs[last.xs.length - 1] < 26) { last.days.push({ day: day, list: list }); last.xs.push(x); }
      else groups.push({ days: [{ day: day, list: list }], xs: [x] });
    });
    groups.forEach(function (g, i) {
      g.x = (g.xs[0] + g.xs[g.xs.length - 1]) / 2;
      var all = []; g.days.forEach(function (d) { all = all.concat(d.list); });
      var f = all.filter(function (m) { return m.kind === 'filing'; }).length, n = all.length - f;
      var cls = f && n ? 'both' : f ? 'filing' : 'news';
      var label = (f ? '공시 ' + f + '건' : '') + (f && n ? ', ' : '') + (n ? '뉴스 ' + n + '건' : '');
      icons += '<button type="button" class="ev-icon ' + cls + '" data-g="' + i + '" aria-expanded="false" aria-haspopup="dialog" style="left:' + Math.round(g.x) + 'px" aria-label="' + g.days[0].day + ' ' + label + '" title="' + g.days[0].day + ' ' + label + '">' + (f ? ICON.filing : ICON.news) + (all.length > 1 ? '<b>' + all.length + '</b>' : '') + '</button>';
    });
    vl.innerHTML = lines; strip.innerHTML = icons;
    if (prevOpen) { var j = -1; groups.forEach(function (g, k) { if (g.days.some(function (d) { return d.day === prevOpen; })) j = k; }); if (j >= 0) openPop(j); else closePop(); }
  };
  strip.addEventListener('click', function (e) {
    var b = e.target.closest('.ev-icon'); if (!b) return;
    var idx = Number(b.getAttribute('data-g'));
    if (idx === openIdx) closePop(); else openPop(idx);
  });
  document.addEventListener('click', function (e) { if (!pop.hidden && !pop.contains(e.target) && !strip.contains(e.target)) closePop(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !pop.hidden) closePop(); });
  chart.timeScale().subscribeVisibleLogicalRangeChange(function () { requestAnimationFrame(drawLines); });
  chart.timeScale().subscribeSizeChange(function () { requestAnimationFrame(drawLines); });
  document.querySelectorAll('[data-vl]').forEach(function (b) {
    b.addEventListener('click', function () { var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); showKind[b.getAttribute('data-vl')] = on; closePop(); drawLines(); });
  });
  document.querySelectorAll('[data-pane]').forEach(function (b) { b.addEventListener('click', function () { setTimeout(drawLines, 260); }); });

  // ---- strategy buy/sell points (from the arena backtest) ----
  var strategies = JSON.parse(document.getElementById('strategies').textContent) || [];
  var stratMarkers = L.createSeriesMarkers(candle, []);
  var info = document.getElementById('strat-info');
  var selectStrategy = function (key) {
    document.querySelectorAll('[data-strategy]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-strategy') === key)); });
    var st = strategies.filter(function (x) { return x.key === key; })[0];
    if (!st) { stratMarkers.setMarkers([]); if (info) info.hidden = true; return; }
    var mk = [];
    st.trades.forEach(function (tr) {
      if (byDate[tr.entry] != null) mk.push({ time: tr.entry, position: 'belowBar', color: UP, shape: 'arrowUp', text: '매수 ' + won(tr.entryPrice) });
      if (tr.exit && byDate[tr.exit] != null) mk.push({ time: tr.exit, position: 'aboveBar', color: DOWN, shape: 'arrowDown', text: '매도 ' + (tr.ret >= 0 ? '+' : '') + (tr.ret * 100).toFixed(1) + '%' });
    });
    mk.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
    stratMarkers.setMarkers(mk);
    var last = st.trades[st.trades.length - 1];
    var rows = st.trades.slice(-8).reverse().map(function (tr) {
      return '<tr><td>' + tr.entry + '</td><td class="num">' + won(tr.entryPrice) + '</td><td>' + (tr.exit || '보유 중') + '</td><td class="num">' + (tr.exitPrice ? won(tr.exitPrice) : '') + '</td><td class="num ' + (tr.ret >= 0 ? 'up' : 'down') + '">' + (tr.ret >= 0 ? '+' : '') + (tr.ret * 100).toFixed(1) + '%</td></tr>';
    }).join('');
    info.innerHTML = '<div class="si-head"><b>' + st.rank + '위 ' + st.name + '</b><span class="badge ' + (st.position ? 'v-BULLISH">지금: 보유 신호' : 'b-LOW">지금: 관망') + '</span></div>' +
      '<p>' + (last ? (last.exit ? '마지막 신호: ' + last.exit + ' 매도 (' + won(last.exitPrice) + ')' : '마지막 신호: ' + last.entry + ' 매수 (' + won(last.entryPrice) + '), 아직 보유 중') : '이 기간에 신호가 없었어요.') + '</p>' +
      '<p class="muted small">다음 신호 조건: ' + st.trigger + '</p>' +
      (rows ? '<div class="table-wrap"><table class="compact"><thead><tr><th>매수일</th><th class="num">매수가</th><th>매도일</th><th class="num">매도가</th><th class="num">수익</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '');
    info.hidden = false;
  };
  document.querySelectorAll('[data-strategy]').forEach(function (b) { b.addEventListener('click', function () { selectStrategy(b.getAttribute('data-strategy')); }); });
  // Links elsewhere on the page ("차트에서 매매 시점 보기") pick a strategy here.
  document.querySelectorAll('[data-show-strategy]').forEach(function (a) { a.addEventListener('click', function () { var k = a.getAttribute('data-show-strategy'); setTimeout(function () { selectStrategy(k); setRange(250); }, 50); }); });

  // ---- legend, ranges and period change ----
  var legend = document.getElementById('legend'), stat = document.getElementById('period-stat');
  var byDate = {}; bars.forEach(function (b, i) { byDate[b.date] = i; });
  var show = function (i) { var b = bars[i]; if (!b) return; legend.textContent = b.date + '  시가 ' + won(b.open) + '  고가 ' + won(b.high) + '  저가 ' + won(b.low) + '  종가 ' + won(b.close) + '  거래량 ' + b.volume.toLocaleString('ko-KR') + '주'; };
  show(bars.length - 1);
  chart.subscribeCrosshairMove(function (p) { show(p && p.time && byDate[p.time] != null ? byDate[p.time] : bars.length - 1); });
  var currentRange = 63;
  var setRange = function (n, extra) {
    currentRange = n;
    var from = Math.max(0, bars.length - n);
    chart.timeScale().setVisibleLogicalRange({ from: from - 0.5, to: bars.length - 0.5 + (extra || 0) });
    var w = bars.slice(from), first = w[0].open, lastC = w[w.length - 1].close, hi = Math.max.apply(null, w.map(function (b) { return b.high; })), lo = Math.min.apply(null, w.map(function (b) { return b.low; }));
    var ch = (lastC / first - 1) * 100, label = document.querySelector('[data-range="' + n + '"]').textContent;
    stat.innerHTML = '<span>' + label + ' 동안</span><b class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' + (ch > 0 ? '+' : '') + ch.toFixed(2) + '%</b><span>최고 ' + won(hi) + '</span><span>최저 ' + won(lo) + '</span><span>' + w[0].date + ' ~ ' + w[w.length - 1].date + '</span>';
  };
  document.querySelectorAll('[data-range]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-range]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var fc = document.querySelector('[data-ov="forecast"]');
      setRange(Number(b.getAttribute('data-range')), fc && fc.getAttribute('aria-pressed') === 'true' ? 62 : 0);
    });
  });
  setRange(63);
  requestAnimationFrame(drawLines);
});
`;
