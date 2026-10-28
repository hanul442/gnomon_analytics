import { reportButton } from './generateButton.js';
import { MT_INNER } from './modernSwitch.js';
// App-style sections (BLACK ORACLE mobile mockup v1 tone, docs/DESIGN.md G-15):
// hero with key points, market strip with sparklines, council consensus ring,
// latest news and filings lists, and the interactive candlestick chart with an
// indicator menu (Lightweight Charts v5 panes).

import { CHART_V6_JS, chartToolbar } from './chartTools.js';
import { starButton } from './ui.js';
import { scenarioCheck, scenarioLayer } from './scenarioChart.js';
import type { DailyReport } from './dailyReport.js';
import { esc } from './html.js';
import { fadeGrad, gradId, smoothD } from './chartLook.js';
import { dailyCalendar, SWEEP_HTML } from './kit/stock.js';
import { currency, won, tone, pct as fmtPct } from './format.js';
const pct = (v: number | null, digits = 2) => fmtPct(v, digits, '없음');

const num = (v: number, digits = 0) => v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const kstTime = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');

/** Small line chart; colour follows the sign of the whole window (Korean convention). */
/** The line takes the colour of the change shown next to it (`up`), else of its own first-to-last move. */
export function sparkline(values: readonly number[], label: string, width = 120, height = 36, up?: boolean | null): string {
  if (values.length < 2) return '';
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${(height - 3 - ((v - lo) / span) * (height - 6)).toFixed(1)}`).join(' ');
  const rising = up ?? values.at(-1)! >= values[0]!, color = rising ? '#f04452' : '#3182f6', id = gradId('sg'), d = smoothD(pts), end = pts.split(' ').at(-1)!.split(',');
  // G-254: a smooth line over a soft fill, with a dot on today's value.
  return `<svg viewBox="0 0 ${width} ${height}" class="spark" overflow="visible" role="img" aria-label="${esc(label)}"><defs>${fadeGrad(id, color, 0.18)}</defs><path d="${d}L${width},${height}L0,${height}Z" fill="url(#${id})"/><path class="spark-l" d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${end[0]}" cy="${end[1]}" r="2.4" fill="${color}"/></svg>`;
}

const POSITION_WORD = { ABOVE: '적정 범위 위', INSIDE: '적정 범위 안', BELOW: '적정 범위 아래' } as const;

export type Freshness = { state: 'LIVE' | 'STALE' | 'DEGRADED' | 'NOT_AVAILABLE'; label: string; detail: string };

/** Weekdays after `from` up to and including `to` (ISO dates). Holidays count, so a gap of 1 may be a market holiday. */
export function weekdaysBetween(from: string, to: string): number {
  let n = 0;
  for (let t = Date.parse(`${from}T00:00:00Z`) + 86_400_000; t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n += 1;
  }
  return n;
}

/**
 * Data freshness state (BOR North Star §5.3, BOT marketDataFreshness): LIVE, STALE (n weekdays behind),
 * DEGRADED (some sources failed) or NOT_AVAILABLE. Today's session counts once the report was made after 16:00 KST.
 */
export function freshness(report: DailyReport): Freshness {
  const p = report.price;
  if (!p) return { state: 'NOT_AVAILABLE', label: '데이터 없음', detail: '가격 기록이 없어요' };
  const kstHour = new Date(Date.parse(report.generatedAt) + 9 * 3600_000).getUTCHours();
  const session = p.sessionDate ?? report.date;
  const until = kstHour >= 16 ? report.date : new Date(Date.parse(`${report.date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const gap = session >= until ? 0 : weekdaysBetween(session, until);
  const failed = (report.market?.status ?? []).filter((s) => !s.ok);
  if (gap > 0) return { state: 'STALE', label: `${gap}거래일 전 데이터`, detail: `${session} 종가가 마지막이에요. 휴장일이었다면 정상이에요` };
  if (failed.length) return { state: 'DEGRADED', label: '일부 제한', detail: `받지 못한 데이터: ${failed.map((s) => s.source).join(', ')}` };
  return { state: 'LIVE', label: '최신', detail: `${session} 종가 기준` };
}

export function freshnessBadge(f: Freshness): string {
  return `<span class="fresh f-${f.state}" title="${esc(f.detail)}"><i aria-hidden="true"></i>${esc(f.label)}</span>`;
}

/** G-107: 코스피·코스닥·ETF·코인 at a glance, next to the code. */
export function marketChip(report: DailyReport): string {
  const ex = report.exchange ?? (report.kind === 'coin' ? 'UPBIT' : report.market?.benchmarks.find((b) => b.symbol === 'KOSPI' || b.symbol === 'KOSDAQ')?.symbol);
  const label = report.kind === 'coin' || ex === 'UPBIT' ? '코인 · 업비트' : `${ex === 'KOSDAQ' ? '코스닥' : ex === 'KOSPI' ? '코스피' : ''}${report.kind === 'etf' ? `${ex ? ' ' : ''}ETF` : ''}`;
  return label ? `<span class="mkt-chip mk-${report.kind === 'coin' || ex === 'UPBIT' ? 'coin' : report.kind === 'etf' ? 'etf' : (ex ?? '').toLowerCase()}">${esc(label)}</span>` : '';
}

/**
 * G-178: the report's standing, right under the price, on every stock: which committee report this page carries,
 * how many sessions have passed, where today's price sits against its scenarios, and the one button that makes
 * a new one. The same strip says "AI 리포트 없음" with the button when there is no committee report yet.
 * `data-stale-ai` marks the strip only while the report is older than the prices (the page scripts look for it).
 */
export function reportStatusBar(report: DailyReport, from: string | null): string {
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  const priceDate = report.price?.sessionDate ?? report.date, date = c ? from ?? report.date : null;
  const btn = (label: string) => reportButton(report.symbol, report.name, label);
  if (!c || !date) return `<div class="rs-bar rs-none" data-report-status role="note"><span class="rs-dot" aria-hidden="true"></span><div class="sa-tx"><b>AI 위원회 리포트가 아직 없어요</b><small>요청하면 지금 데이터로 위원회가 분석해요. 크레딧 요청은 플러스부터예요.</small></div>${btn('심층 리포트 만들기')}</div>`;
  const sessions = new Set((report.recentCloses ?? []).filter((p) => p.date > date).map((p) => p.date)).size;
  const stale = date < priceDate;
  const md = (d: string) => d.slice(5).replace('-', '/');
  // Where today's price sits against the scenarios; only said when the report has ranges to check against.
  let where = '', checked = 0;
  for (const [kind, name] of [['BASE', '기본'], ['BULL', '강세'], ['BEAR', '약세']] as const) {
    const k = scenarioCheck(report, kind);
    if (!k) continue;
    checked += 1;
    if (k.now === 'in') { where = `지금 가격은 ${name} 시나리오 범위 안이에요`; break; }
  }
  if (!where && checked && sessions) where = checked === 3 ? '지금 가격은 세 시나리오 범위 밖이에요' : '지금 가격은 시나리오 범위 밖이에요';
  const head = `${md(date)} 위원회 리포트${stale ? ` · ${sessions ? `${sessions}거래일 지났어요` : '그 뒤 새 가격이 있어요'}` : ' · 최신이에요'}`;
  const sub = stale ? (where || `가격 ${esc(priceDate)} 기준으로 다시 분석할 수 있어요`) : `시나리오 ${c.scenarios?.length ?? 0}개 · 위원 ${(c.analysts?.length ?? 0) + (c.desks?.length ?? 0)}명 · 가격 ${esc(priceDate)} 기준`;
  return `<div class="rs-bar${stale ? ' rs-stale' : ''}" data-report-status${stale ? ' data-stale-ai' : ''} role="note"><span class="rs-dot" aria-hidden="true"></span><div class="sa-tx"><b>${esc(head)}</b><small>${sub}</small></div>${stale ? btn('새 리포트 만들기') : ''}</div>`;
}
/** G-103: a small 3-month chart right under the price; tapping it opens the chart tab. */
export function heroChart(report: DailyReport): string {
  const pts = (report.recentCloses ?? []).slice(-63).filter((x) => Number.isFinite(x.close) && x.close > 0);
  if (pts.length < 5) return '';
  const w = 320, h = 72, lo = Math.min(...pts.map((x) => x.close)), hi = Math.max(...pts.map((x) => x.close)), span = hi - lo || 1;
  const xy = pts.map((x, i) => [(i / (pts.length - 1)) * w, h - 4 - ((x.close - lo) / span) * (h - 10)] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const chg = (pts.at(-1)!.close / pts[0]!.close - 1) * 100, color = chg >= 0 ? '#f04452' : '#3182f6';
  // G-141: closes for the period chips under the mini chart (1주·1달·3달·6달·1년), drawn in the browser.
  const src = (report.recentBars?.length ? report.recentBars : report.recentCloses ?? []).slice(-250), series = src.map((b) => b.close);
  return `<a class="hero-chart" href="#tab-chart" data-c="${esc(JSON.stringify(series))}" data-d="${esc(JSON.stringify(src.map((b) => b.date)))}" title="눌러서 전체 화면 차트 열기"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><defs>${fadeGrad('hc-g', color)}</defs><path class="hc-a" d="${smoothD(line)}L${w},${h}L0,${h}Z" fill="url(#hc-g)"/><path class="hc-l" d="${smoothD(line)}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="hc-meta"><span>3개월 <b class="${chg > 0 ? 'up' : chg < 0 ? 'down' : ''}">${chg > 0 ? '▲ +' : chg < 0 ? '▼ ' : ''}${chg.toFixed(1)}%</b> · 최고 ${esc(won(hi))} · 최저 ${esc(won(lo))}</span><span class="hc-go">차트 자세히 보기 ›</span></span></a>`;
}

/**
 * G-277 (한서님 10/21 '종목 탭도 와...진짜 너무 길더라'): the hero is the name, the price and one line of key numbers.
 * The 3-month mini chart and its period chips are gone (the 차트 part is one tap away in the bottom bar).
 */
export function hero(report: DailyReport, options: { live: boolean; asOf: string }): string {
  const p = report.price, m = report.market;
  const points = [
    // G-267: no signal words ('강세', '매집 쪽') in the first screen; they read as buy/sell calls. The timing and flow tabs keep them.
    m?.fairValue ? ['기술적 적정가', `${won(m.fairValue.center)} (${POSITION_WORD[m.fairValue.position]})`, ''] : null,
    // G-301: 증권가 목표가 lives in 기업 › 애널리스트 의견 only (it was shown here and there).
  ].filter((x): x is string[] => x !== null);
  return `<section class="hero" id="top" data-session="${esc(p?.sessionDate ?? report.date)}"><div class="orb" aria-hidden="true"></div>
<div class="hero-main"><div class="eyebrow"><span>${esc(report.kind === 'coin' ? report.symbol.replace('KRW-', '') : report.symbol)}</span>${marketChip(report)}${options.live ? `<span>${esc(options.asOf)} 기준</span>` : report.commentary?.status === 'OK' ? '' : `<span>${esc(report.date)} 리포트</span>`}${freshnessBadge(freshness(report))}</div>
<div class="h1-row"><h1>${esc(report.name)}</h1>${starButton(report.symbol, report.name)}</div>
${p ? `<div class="hero-price"><b data-live="${esc(report.symbol)}" data-live-f="price">${esc(won(p.close))}</b><span class="live-tag" data-live="${esc(report.symbol)}" data-live-f="tag" hidden></span>${p.changePct === null ? '' : `<span class="${tone(p.changePct)}" data-live="${esc(report.symbol)}" data-live-f="full">${p.change! > 0 ? '▲' : p.change! < 0 ? '▼' : ''} ${esc(currency() === 'USD' ? won(Math.abs(p.change!)) : num(Math.abs(p.change!)))} (${esc(pct(p.changePct))})</span>`}</div>
<div class="hero-sub">${esc(p.sessionDate ?? report.date)} ${report.kind === 'coin' ? '일봉 (09:00 KST 기준)' : '종가'}</div>` : '<p class="empty">아직 가격 기록이 없어요.</p>'}
<p class="hero-line">${esc(report.headline)}</p></div>
${points.length ? `<p class="kp-line">${points.map(([k, v]) => `${esc(k!)} <b>${esc(v!)}</b>`).join(' · ')}</p>` : ''}
</section>`;
}







export function latestLists(report: DailyReport): string {
  const news = (report.news?.clusters ?? []).slice(0, 3);
  const IMP = { HIGH: '중요', MEDIUM: '보통', LOW: '참고' } as const;
  // G-244: news only, three of them; filings are on 뉴스·공시.
  // G-265 (Bklit heatmap, calendar): the last year's daily moves follow the news.
  return `<div>
<section class="block"><div class="block-head"><h2>최신 뉴스</h2><a href="#tab-news" class="more-link">전체 보기 ›</a></div><div class="card list" data-slot="homeNews"${news.length ? '' : ' data-empty'}>
${news.length ? news.map((c) => `<div class="row-item"><span class="badge b-${c.importance}">${IMP[c.importance]}</span><div class="ri-main"><a href="${esc(c.url)}" rel="noopener" target="_blank">${esc(c.title)}</a><div class="muted small">${esc(c.publisher)} ${esc(kstTime(c.firstAt))}${c.articles.length > 1 ? `  같은 내용 ${c.articles.length}건` : ''}</div></div></div>`).join('') : '<p class="empty">최신 뉴스를 불러오고 있어요.</p>'}
</div></section>
${dailyCalendar(report.recentBars ?? [])}
</div>`;
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
  ['ema12', '지수이동평균 12·26', false], ['bb', '볼린저 밴드', false], ['ichimoku', '일목균형표', false], ['env', '엔벨로프', false], ['vwap', 'VWAP', false], ['psar', '파라볼릭 SAR', false],
  ['levels', '지지·저항', false], ['fib', '피보나치', false], ['fair', '적정가 범위', false], ['forecast', '예측 범위', false],
  ['spikes', '거래량 폭발일', false],
];
const PANES: [string, string, boolean][] = [
  ['volume', '거래량', true], ['rsi', 'RSI', false], ['macd', 'MACD', false], ['stoch', '스토캐스틱', false],
  ['value', '거래대금', false], ['ad', '매집·분산(A/D)', false],
  ['cci', 'CCI', false], ['wr', '윌리엄스 %R', false], ['obv', 'OBV', false], ['mfi', 'MFI', false], ['atr', 'ATR', false],
];
const DESC: Record<string, string> = {
  ma5: '최근 5거래일 평균 가격', ma20: '한 달 평균 가격, 단기 추세', ma60: '석 달 평균 가격, 중기 추세', ma120: '반년 평균 가격, 장기 추세',
  ema12: '최근 가격에 무게를 둔 평균 두 개', bb: '20일 평균 ± 표준편차 2배, 변동 범위', ichimoku: '구름대로 보는 추세와 지지', env: '20일 평균 ±5% 띠', vwap: '최근 20거래일 거래량으로 가중한 평균 가격(거래가 많이 된 값의 중심)', psar: '추세를 따라오는 점. 가격 아래면 오름세, 위면 내림세이고 점이 뒤집히면 추세 전환 신호',
  levels: '자주 막히거나 받친 가격대', fib: '최근 120거래일 최고·최저를 잇는 흐름의 되돌림 비율과, 그 흐름이 이어질 때의 확장 127.2·161.8%', fair: '거래가 몰린 가격 중심과 범위', forecast: '60거래일 예측 범위. 옅은 띠 80%(10~90%) · 진한 띠 50%(25~75%) · 점선 세로줄은 20거래일 범위를 채점하는 날',
  volume: '하루 거래된 주식 수', rsi: '과열(70 이상)·과매도(30 이하)', macd: '단기·장기 평균의 차이로 보는 추세 전환', stoch: '최근 범위 안에서 지금 가격의 위치',
  spikes: '20일 평균의 3배 넘게 거래된 날을 캔들 아래에 표시(▲ 오른 날 · ▼ 내린 날)', value: '하루 거래대금(종가 × 거래량, 억 원). 진하게 칠한 날은 20일 평균의 3배 이상', ad: '거래가 많은 날 종가가 하루 범위의 위쪽(매집 쪽)·아래쪽(분산 쪽)에서 끝났는지 누적한 선',
  cci: '평균에서 얼마나 벗어났는지', wr: '최근 고점 대비 위치(과열·과매도)', obv: '오른 날·내린 날 거래량 누적', mfi: '거래량을 함께 본 RSI. 80 이상 과열 · 20 이하 과매도', atr: '하루 평균 움직임 폭',
};
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true" class="gear"><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const RANGES: [string, number][] = [['1개월', 21], ['3개월', 63], ['6개월', 126], ['1년', 250], ['3년', 750], ['전체', 100000]];

/** Candlestick chart with indicator menu; the client script draws from embedded data. */
export function priceChart(report: DailyReport, overlays: unknown, base: string, chartAsset: string): { html: string; script: string } {
  const bars = report.recentBars ?? [];
  const strategies = (report.market?.arena?.results ?? []).filter((x) => x.key !== 'hold').map((x) => ({ key: x.key, name: x.name, rank: x.rank, position: x.position, trigger: x.trigger, oos: x.oosReturn, trades: x.tradeLog ?? [] }));
  const last = bars.at(-1), prev = bars.at(-2);
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  // G-90: the scenarios live on the chart as a layer (where each would take the price in ~20 sessions), not in a separate card.
  const scen = scenarioLayer(report);
  const opt = (group: string, key: string, label: string, on: boolean, desc = DESC[key] ?? '') => `<button type="button" class="opt" data-${group}="${key}" aria-pressed="${on}"><span class="opt-t"><b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ''}</span><i class="tog mt" aria-hidden="true">${MT_INNER}</i></button>`;
  const html = `<section class="card chart-card" id="chart-card" data-symbol="${esc(report.symbol)}">
<div class="chart-head"><div><div class="muted small">현재가 (${esc(last?.date ?? '')} 종가)</div>
<div class="cur-price"><b>${last ? esc(won(last.close)) : '없음'}</b>${last && prev ? `<span class="${tone(last.close - prev.close)}">${last.close >= prev.close ? '▲' : '▼'} ${esc(num(Math.abs(last.close - prev.close)))} (${esc(pct((last.close / prev.close - 1) * 100))})</span>` : ''}</div>
<div class="period-stat" id="period-stat" aria-live="polite"></div></div>
<div class="seg" role="group" aria-label="기간">${RANGES.map(([label, n]) => `<button type="button" data-range="${n}" aria-pressed="${n === 63}">${label}</button>`).join('')}</div></div>
<div class="chart-tools"><div class="preset-row" role="group" aria-label="지표"><span class="label">지표</span><button type="button" class="tool-btn" data-open="ind-sheet" aria-haspopup="dialog">${GEAR}지표·레이어</button><button type="button" class="chip-toggle" id="ind-reset" title="내 보기 방식의 기본 지표로 되돌려요">내 보기 기본</button></div>
${strategies.length ? `<button type="button" class="strat-pick" data-open="strat-sheet" aria-haspopup="dialog"><span class="label">전략 매매 시점</span><b id="strat-current">끄기</b><span class="caret" aria-hidden="true">▾</span></button>` : ''}</div>
<div class="active-pills" id="active-pills" aria-label="켜진 지표"></div>
${chartToolbar(!!report.market?.benchmarks.some((b) => b.series?.length))}
<div class="sheet" id="ind-sheet" hidden><div class="sheet-back" data-close></div><div class="sheet-body" role="dialog" aria-modal="true" aria-labelledby="ind-sheet-t"><div class="sheet-head"><b id="ind-sheet-t">지표·레이어</b><button type="button" class="sheet-done" data-close>완료</button></div>
<p class="muted small" style="margin:0 0 6px">켜고 끈 지표는 이 기기에 저장돼서 다른 종목에서도 그대로 보여요.</p><div class="opt-group"><div class="opt-k">가격 위에 겹치기</div>${OVERLAYS.map(([k, l, on]) => opt('ov', k, l, on)).join('')}</div>
<div class="opt-group"><div class="opt-k">아래 창</div>${PANES.map(([k, l, on]) => opt('pane', k, l, on)).join('')}</div>
<div class="opt-group"><div class="opt-k">차트 위 표시</div>${opt('vl', 'filing', '공시', true, '공시가 나온 날 문서 아이콘과 점선')}${opt('vl', 'news', '뉴스', true, '중요도 보통 이상 뉴스가 나온 날 아이콘')}</div></div></div>
${strategies.length ? `<div class="sheet" id="strat-sheet" hidden><div class="sheet-back" data-close></div><div class="sheet-body" role="dialog" aria-modal="true" aria-labelledby="strat-sheet-t"><div class="sheet-head"><b id="strat-sheet-t">전략 매매 시점 보기</b><button type="button" class="sheet-done" data-close>닫기</button></div>
<p class="muted small" style="margin:0 0 6px">고른 전략의 과거 규칙상 진입(▲)·정리(▼) 시점을 차트에 표시해요. 지금 사고팔라는 신호가 아니에요. 순위는 검증 구간 샤프 순이에요.</p>
<button type="button" class="opt" data-strategy="" aria-pressed="true"><span class="opt-t"><b>끄기</b><small>매매 시점을 표시하지 않아요</small></span><i class="radio" aria-hidden="true"></i></button>
${strategies.map((st) => `<button type="button" class="opt" data-strategy="${esc(st.key)}" aria-pressed="false"><span class="opt-t"><b>${st.rank}위 ${esc(st.name)}</b><small><span class="${st.position ? 'up' : 'muted'}">${st.position ? '지금 보유 신호' : '지금 관망'}</span> · 검증 수익 <span class="${tone(st.oos)}">${(st.oos * 100).toFixed(1)}%</span> · 매매 ${st.trades.length}번</small></span><i class="radio" aria-hidden="true"></i></button>`).join('')}</div></div>
` : ''}
<div class="chart-context" id="chart-context" hidden aria-live="polite"><p></p><button type="button" class="chip-toggle">기술로 돌아가기</button></div><div class="legend-line" id="legend"></div>
<div class="chart-wrap"><div class="ev-strip" id="ev-strip" role="group" aria-label="공시·뉴스"></div><div class="chart-body"><div id="chart" style="height:520px">${bars.length < 2 ? '<p class="empty">차트를 그릴 가격 기록이 부족해요.</p>' : SWEEP_HTML}</div><div class="vlines" id="vlines" aria-hidden="true"></div><div class="sc-boxes" id="sc-boxes" aria-hidden="true"></div></div>
<div class="mark-pop" id="mark-pop" role="dialog" aria-label="공시·뉴스 내용" hidden></div></div>
${strategies.length ? '<div class="strat-info" id="strat-info" aria-live="polite" hidden></div>' : ''}
<p class="fine">차트 위 아이콘을 누르면 그날의 공시(금색)·뉴스(청록, 중요도 보통 이상) 내용이 뜨고, 거기서 원문으로 갈 수 있어요. 점선은 날짜 위치 표시예요. 전략 매매 시점의 ▲매수·▼매도는 그 전략 규칙이 과거 일봉에서 신호를 낸 날의 종가예요(백테스트, 투자 권유 아님).</p></section>`;
  const script = `<script type="application/json" id="bars">${json(bars)}</script>
<script type="application/json" id="marks">${json(chartMarks(report))}</script>
<script type="application/json" id="overlays">${json(overlays)}</script>
<script type="application/json" id="scen">${json(scen)}</script>
<script type="application/json" id="strategies">${json(strategies)}</script>
<script type="application/json" id="benchmarks">${json((report.market?.benchmarks ?? []).filter((b) => b.series?.length).map((b) => ({ name: b.name, series: b.series })))}</script>
<script src="${base}${chartAsset}" defer></script>
<script>${CHART_JS}</script>
<script>${TOOLS_JS}</script>
<script>${CHART_V6_JS}</script>`;
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
  // G-182: up/down follow the theme (re-read on a switch below); overlay ink is a mid slate-blue that reads on the light and the dark page alike.
  var TH = window.GNMTheme, UP = TH ? TH.v('--up', '#f04452') : '#f04452', DOWN = TH ? TH.v('--down', '#3182f6') : '#3182f6', INK = '#6F86A8';
  var mobile = window.matchMedia('(max-width: 820px)').matches;
  // G-222: a US report (html[data-ccy=USD]) prices in dollars.
  var won = document.documentElement.getAttribute('data-ccy') === 'USD' ? function (v) { return '$' + v.toFixed(2); } : function (v) { return Math.round(v).toLocaleString('ko-KR') + '원'; };
  var sweep = el.querySelector('.kit-sweep'); if (sweep) sweep.remove(); // G-282: the loading sweep gives way to the chart
  var chart = L.createChart(el, {
    autoSize: true,
    layout: { background: { color: 'transparent' }, textColor: '#7b7f87', fontFamily: 'inherit', panes: { separatorColor: '#d6dfeb' } },
    grid: { vertLines: { visible: false }, horzLines: { color: '#e2e8f1' } },
    rightPriceScale: { borderVisible: false }, timeScale: { borderVisible: false, rightOffset: 4 },
    crosshair: { mode: 0 },
    localization: { locale: 'ko-KR', priceFormatter: function (v) { return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(2); } }
  });
  // Every series, so chart tools (chartTools.ts) can hide them on the weekly and monthly views.
  var allSeries = [], addSeries = chart.addSeries.bind(chart);
  chart.addSeries = function () { var s = addSeries.apply(null, arguments); allSeries.push(s); return s; };
  var removeSeries=chart.removeSeries.bind(chart);chart.removeSeries=function(s){allSeries=allSeries.filter(function(x){return x!==s;});return removeSeries(s);};
  var t = function (i) { return bars[i].date; };
  var C = bars.map(function (b) { return b.close; }), H = bars.map(function (b) { return b.high; }), Lo = bars.map(function (b) { return b.low; }), V = bars.map(function (b) { return b.volume; });
  // G-277 (Bklit candles, 한서님 10/21): thin bodies with air between them, dotted horizontal grid only, a quiet crosshair (theme.chart).
  var candle = chart.addSeries(L.CandlestickSeries, { upColor: UP, downColor: DOWN, borderVisible: false, wickUpColor: UP, wickDownColor: DOWN });
  // G-282 (Bklit candlestick, 한서님 10/22 "차트 기능도 bklit 차트로"): the candles are drawn by a primitive: rounded
  // bodies with a soft top-to-bottom gradient, hairline wicks, and every other candle fading while one is touched. The
  // library's own candles stay as the anchor (scale, crosshair, chart types, drawings) in a near-invisible colour (BK0).
  // A colour set through applyOptions is kept for the primitive; chartPro's fully transparent T means another chart type.
  var BK0 = 'rgba(0,0,0,0.001)', BK = { on: true, up: UP, down: DOWN, hover: null, req: null }, nativeApply = candle.applyOptions.bind(candle);
  var bkPaint = function (o) {
    o = Object.assign({}, o || {});
    if ('upColor' in o || 'downColor' in o) {
      var u = o.upColor, off = u === 'rgba(0,0,0,0)';
      if (off) BK.on = false; else { BK.on = true; if (u && u !== BK0) BK.up = u; if (o.downColor && o.downColor !== BK0) BK.down = o.downColor; }
      if (!off) { o.upColor = o.downColor = o.wickUpColor = o.wickDownColor = o.borderUpColor = o.borderDownColor = BK0; o.borderVisible = false; }
    }
    // The library would colour the last-price label with BK0; ours (bkLast) carries the real colour instead.
    if (BK.on && 'lastValueVisible' in o) o.lastValueVisible = false;
    if (BK.on && 'priceLineVisible' in o) o.priceLineVisible = false;
    nativeApply(o); bkLast(); if (BK.req) BK.req();
  };
  var bkLine = null, bkLast = function () {
    var d = candle.data(), k = d[d.length - 1];
    if (!BK.on || !k || k.close == null) { if (bkLine) { candle.removePriceLine(bkLine); bkLine = null; } return; }
    var po = { price: k.close, color: k.close >= k.open ? BK.up : BK.down, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' };
    if (bkLine) bkLine.applyOptions(po); else bkLine = candle.createPriceLine(po);
  };
  var bkSet = candle.setData.bind(candle), bkUpd = candle.update.bind(candle);
  candle.setData = function (x) { bkSet(x); bkLast(); };
  candle.update = function (x) { bkUpd(x); bkLast(); };
  candle.applyOptions = bkPaint;
  bkPaint({ upColor: UP, downColor: DOWN, lastValueVisible: false, priceLineVisible: false });
  var bkRgba = function (c, a) { var m = /^#([0-9a-f]{6})$/i.exec(String(c).trim()); if (!m) return c; var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
  // G-282 (Bklit line colours, one accent G-267): indicator lines are shades of the text colour instead of orange,
  // purple and teal, read once per page from the theme.
  var inkA = function (al) { var c = (window.GNMTheme && GNMTheme.v('--fg', '#141416')) || '#141416'; return bkRgba(c.charAt(0) === '#' && c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c, al); };
  candle.attachPrimitive({
    attached: function (p) { BK.req = p.requestUpdate; }, detached: function () { BK.req = null; }, updateAllViews: function () {},
    paneViews: function () { return [{ zOrder: function () { return 'normal'; }, renderer: function () { return { draw: function (target) {
      if (!BK.on || candle.options().visible === false) return;
      var ts = chart.timeScale(), r = ts.getVisibleLogicalRange(), d = candle.data(); if (!r || !d.length) return;
      var a = Math.max(0, Math.floor(r.from) - 1), b = Math.min(d.length - 1, Math.ceil(r.to) + 1), sp = ts.options().barSpacing;
      target.useBitmapCoordinateSpace(function (sc) {
        var cx = sc.context, hr = sc.horizontalPixelRatio, vr = sc.verticalPixelRatio, w = Math.max(1, Math.round(sp * 0.62 * hr)), wick = Math.max(1, Math.round(hr));
        for (var i = a; i <= b; i++) {
          var k = d[i]; if (!k || k.open == null) continue;
          var x = ts.timeToCoordinate(k.time); if (x == null) continue;
          var yo = candle.priceToCoordinate(k.open), yc = candle.priceToCoordinate(k.close), yh = candle.priceToCoordinate(k.high), yl = candle.priceToCoordinate(k.low); if (yo == null || yc == null || yh == null || yl == null) continue;
          var up = k.close >= k.open, col = up ? BK.up : BK.down, fade = BK.hover != null && BK.hover !== k.time ? 0.3 : 1;
          var px = Math.round(x * hr), top = Math.round(Math.min(yo, yc) * vr), bot = Math.round(Math.max(yo, yc) * vr), h = Math.max(1, bot - top);
          cx.globalAlpha = fade; cx.fillStyle = col;
          cx.fillRect(px - Math.floor(wick / 2), Math.round(yh * vr), wick, Math.max(1, Math.round(yl * vr) - Math.round(yh * vr)));
          var g = cx.createLinearGradient(0, top, 0, top + h); g.addColorStop(0, bkRgba(col, 1)); g.addColorStop(1, bkRgba(col, 0.72)); cx.fillStyle = g;
          var x0 = px - Math.floor(w / 2), rad = Math.min(w / 2, h / 2, 2.5 * hr);
          cx.beginPath(); if (cx.roundRect) cx.roundRect(x0, top, w, h, rad); else cx.rect(x0, top, w, h); cx.fill();
        }
        cx.globalAlpha = 1;
      });
    } }; } }]; }
  });
  chart.subscribeCrosshairMove(function (p) { var t = p && p.point && p.time != null ? p.time : null; if (JSON.stringify(t) !== JSON.stringify(BK.hover)) { BK.hover = t; if (BK.req) BK.req(); } });
  chart.applyOptions({ timeScale: { barSpacing: mobile ? 7 : 9, minBarSpacing: 2 } });
  candle.setData(bars.map(function (b) { return { time: b.date, open: b.open, high: b.high, low: b.low, close: b.close }; }));
  // G-219: candles fill the price pane like TradingView (the default keeps a fifth of it empty at the top; 0.16 still clears the high mark and the legend).
  candle.priceScale().applyOptions({ scaleMargins: { top: 0.16, bottom: 0.1 } });
  // G-181: text, grid and candle colours come from the theme tokens and follow a dark/light switch.
  if (window.GNMTheme) GNMTheme.chart(chart, function (c) { UP = c.up; DOWN = c.down; candle.applyOptions({ upColor: c.up, downColor: c.down, wickUpColor: c.up, wickDownColor: c.down }); });

  // ---- indicator settings (G-157): every period and multiple can be changed in 상세 설정하기; kept on this device ----
  var IP0 = { ma5: { n: 5 }, ma20: { n: 20 }, ma60: { n: 60 }, ma120: { n: 120 }, ema12: { f: 12, s: 26 }, bb: { n: 20, k: 2 }, env: { n: 20, pct: 6 }, ichimoku: { conv: 9, base: 26, span: 52 }, vwap: { n: 20 }, psar: { step: 0.02, max: 0.2 },
    rsi: { n: 14, hi: 70, lo: 30 }, macd: { f: 12, s: 26, sig: 9 }, stoch: { n: 14, k: 3, d: 3 }, cci: { n: 20 }, wr: { n: 14 }, atr: { n: 14 }, value: { n: 20 }, mfi: { n: 14, hi: 80, lo: 20 } };
  var IP = JSON.parse(JSON.stringify(IP0));
  try { var ips = JSON.parse(localStorage.getItem('gnm-ind-params') || 'null'); if (ips) Object.keys(ips).forEach(function (k) { if (IP[k]) Object.keys(IP[k]).forEach(function (f) { var v = Number(ips[k][f]); if (isFinite(v) && v > 0) IP[k][f] = v; }); }); } catch (e) {}
  var ip = function (k) { return IP[k]; };
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
  var built = {}, priceLines = {}, relegend = null, placeLatest = null;
  var overlayMakers = {
    ma5: function () { return [line(sma(C, ip('ma5').n), inkA(0.35))]; },
    ma20: function () { return [line(sma(C, ip('ma20').n), inkA(0.85))]; },
    ma60: function () { return [line(sma(C, ip('ma60').n), inkA(0.55))]; },
    ma120: function () { return [line(sma(C, ip('ma120').n), inkA(0.3))]; },
    ema12: function () { var q = ip('ema12'); return [line(ema(C, q.f), inkA(0.8), 0, { lineStyle: 2 }), line(ema(C, q.s), inkA(0.4), 0, { lineStyle: 2 })]; },
    // G-282: Bklit "band" — the 볼린저 range is a light filled band between the two lines, not three grey lines.
    bb: function () {
      var q = ip('bb'), m = sma(C, q.n), s = std(C, q.n, m);
      var up = m.map(function (x, i) { return x == null ? null : x + q.k * s[i]; }), dn = m.map(function (x, i) { return x == null ? null : x - q.k * s[i]; });
      var mid = line(m, inkA(0.45), 0, { lineStyle: 2, lineWidth: 1 }), hi = line(up, inkA(0.3), 0, { lineWidth: 1 }), lo = line(dn, inkA(0.3), 0, { lineWidth: 1 });
      mid.attachPrimitive({
        attached: function () {}, detached: function () {}, updateAllViews: function () {},
        paneViews: function () { return [{ zOrder: function () { return 'bottom'; }, renderer: function () { return { draw: function (target) {
          if (mid.options().visible === false) return;
          target.useMediaCoordinateSpace(function (sc) {
            var ts = chart.timeScale(), top = [], bot = [], cx = sc.context;
            for (var i = 0; i < m.length; i++) { if (up[i] == null || !isFinite(up[i])) continue; var x = ts.timeToCoordinate(t(i)), y1 = mid.priceToCoordinate(up[i]), y0 = mid.priceToCoordinate(dn[i]); if (x == null || y1 == null || y0 == null) continue; top.push([x, y1]); bot.push([x, y0]); }
            if (top.length < 2) return;
            cx.beginPath(); cx.moveTo(top[0][0], top[0][1]);
            for (var a = 1; a < top.length; a++) cx.lineTo(top[a][0], top[a][1]);
            for (var b = bot.length - 1; b >= 0; b--) cx.lineTo(bot[b][0], bot[b][1]);
            cx.closePath(); cx.fillStyle = inkA(0.06); cx.fill();
          });
        } }; } }]; }
      });
      return [mid, hi, lo];
    },
    // G-186: rolling VWAP — the volume-weighted average of the typical price over n sessions.
    vwap: function () { var n = ip('vwap').n, pv = 0, vv = 0, tp = bars.map(function (b) { return (b.high + b.low + b.close) / 3; }); return [line(bars.map(function (b, i) { pv += tp[i] * b.volume; vv += b.volume; if (i >= n) { pv -= tp[i - n] * bars[i - n].volume; vv -= bars[i - n].volume; } return i < n - 1 || vv <= 0 ? null : pv / vv; }), '#e879f9', 0, { lineWidth: 2, title: 'VWAP ' + n })]; },
    // G-186: Parabolic SAR (Wilder): dots under a rising trend, above a falling one; the step grows at each new extreme up to max.
    psar: function () {
      // Saved settings are clamped here too (the sheet clamps only when it is opened): step 0.01–0.1, max ≥ step, ≤ 0.5.
      var q0 = ip('psar'), q = { step: Math.min(0.1, Math.max(0.01, q0.step)), max: 0 }, out = [], up = true, af, ep, sar;
      q.max = Math.min(0.5, Math.max(q.step, q0.max)); af = q.step;
      if (bars.length < 3) return [];
      up = bars[1].close >= bars[0].close; ep = up ? bars[0].high : bars[0].low; sar = up ? bars[0].low : bars[0].high; out.push(null);
      for (var i = 1; i < bars.length; i++) {
        var b = bars[i], pb = bars[i - 1], p2 = bars[Math.max(0, i - 2)];
        sar = sar + af * (ep - sar);
        if (up) { sar = Math.min(sar, pb.low, p2.low); if (b.low < sar) { up = false; sar = ep; ep = b.low; af = q.step; } else if (b.high > ep) { ep = b.high; af = Math.min(q.max, af + q.step); } }
        else { sar = Math.max(sar, pb.high, p2.high); if (b.high > sar) { up = true; sar = ep; ep = b.high; af = q.step; } else if (b.low < ep) { ep = b.low; af = Math.min(q.max, af + q.step); } }
        out.push(sar);
      }
      return [line(out, '#0ea5e9', 0, { lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 2, title: 'SAR' })];
    },
    env: function () { var q = ip('env'), m = sma(C, q.n); return [line(m.map(function (x) { return x == null ? null : x * (1 + q.pct / 100); }), INK, 0, { lineStyle: 1 }), line(m.map(function (x) { return x == null ? null : x * (1 - q.pct / 100); }), INK, 0, { lineStyle: 1 })]; },
    ichimoku: function () {
      var q = ip('ichimoku'), conv = C.map(function (_, i) { return i < q.conv - 1 ? null : (hh(q.conv, i) + ll(q.conv, i)) / 2; }), basev = C.map(function (_, i) { return i < q.base - 1 ? null : (hh(q.base, i) + ll(q.base, i)) / 2; });
      return [line(conv, '#e11d48'), line(basev, '#2563eb'), line(C.map(function (_, i) { return i < q.span - 1 ? null : (hh(q.span, i) + ll(q.span, i)) / 2; }), INK, 0, { lineStyle: 2 }), line(conv.map(function (x, i) { return x == null || basev[i] == null ? null : (x + basev[i]) / 2; }), '#16a34a', 0, { lineStyle: 2 })];
    }
  };
  var lineMakers = {
    // G-176: six level boxes piled over the price scale. Only the nearest support and the nearest resistance get an axis box;
    // the other levels stay as lines (the 가격 구조 table lists them all).
    levels: function () { var lv = ov.levels || [], now = bars.length ? bars[bars.length - 1].close : 0, near = {}; lv.forEach(function (l) { var d = Math.abs(l.price - now); if (!near[l.kind] || d < near[l.kind].d) near[l.kind] = { d: d, l: l }; }); return lv.map(function (l) { var top = near[l.kind] && near[l.kind].l === l; return candle.createPriceLine({ price: l.price, color: l.kind === 'SUPPORT' ? DOWN : UP, lineWidth: 1, lineStyle: top ? 0 : 2, axisLabelVisible: top, title: top ? (l.kind === 'SUPPORT' ? '지지' : '저항') : '' }); }); },
    fair: function () { if (!ov.fair) return []; return [['low', '적정 하단'], ['center', '적정가'], ['high', '적정 상단']].map(function (k) { return candle.createPriceLine({ price: ov.fair[k[0]], color: INK, lineWidth: k[0] === 'center' ? 2 : 1, lineStyle: k[0] === 'center' ? 0 : 2, axisLabelVisible: true, title: k[1] }); }); }
  };
  var addDays = function (iso, n) { var d = new Date(iso + 'T00:00:00Z'); while (n > 0) { d.setUTCDate(d.getUTCDate() + 1); var w = d.getUTCDay(); if (w !== 0 && w !== 6) n--; } return d.toISOString().slice(0, 10); };
  // G-205: the forecast is a filled fan (80% outer, 50% inner band) under a dashed middle line, drawn by a primitive on that line.
  overlayMakers.forecast = function () {
    var f20 = (ov.forecasts || []).filter(function (f) { return f.horizon === 20; })[0], f60 = (ov.forecasts || []).filter(function (f) { return f.horizon === 60; })[0];
    if (!f20 || !f60) return [];
    var z80 = 1.2815515655446004, z50 = 0.6744897501960817, pts = [{ time: f20.baseDate, p10: f20.baseClose, p25: f20.baseClose, p50: f20.baseClose, p75: f20.baseClose, p90: f20.baseClose }], d = f20.baseDate;
    for (var h = 1; h <= 60; h++) {
      d = addDays(d, 1);
      var k = Math.min(1, Math.max(0, (h - 20) / 40)), sg = (f20.sigma + (f60.sigma - f20.sigma) * k) * Math.sqrt(h), mu = f20.drift * h, c = f20.baseClose;
      pts.push({ time: d, p10: c * Math.exp(mu - z80 * sg), p25: c * Math.exp(mu - z50 * sg), p50: c * Math.exp(mu), p75: c * Math.exp(mu + z50 * sg), p90: c * Math.exp(mu + z80 * sg) });
    }
    var edge = function (q, color, title) {
      var s = chart.addSeries(L.LineSeries, { color: color, lineVisible: false, priceLineVisible: false, lastValueVisible: true, title: title, crosshairMarkerVisible: false });
      s.setData(pts.map(function (p) { return { time: p.time, value: p[q] }; })); return s;
    };
    var hi = edge('p90', UP, '상단 90%'), lo = edge('p10', DOWN, '하단 10%');
    // G-282 (Bklit reference band + deadline): the middle path is not drawn (a range, not a price path, G-265); the
    // series stays as the band's anchor. A dashed line marks the day the 20-session range is scored.
    var mid = chart.addSeries(L.LineSeries, { color: INK, lineVisible: false, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    var due = pts[Math.min(20, pts.length - 1)].time, ink = function (a) { var c = (window.GNMTheme && GNMTheme.v('--fg', '#141416')) || '#141416', m = /^#([0-9a-f]{6})$/i.exec(c.trim()); if (!m) return 'rgba(20,20,22,' + a + ')'; var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };
    mid.setData(pts.map(function (p) { return { time: p.time, value: p.p50 }; }));
    var band = function (ctx, a, b, fill) {
      var ts = chart.timeScale(), top = [], bot = [];
      pts.forEach(function (p) { var x = ts.timeToCoordinate(p.time), y1 = mid.priceToCoordinate(p[b]), y0 = mid.priceToCoordinate(p[a]); if (x == null || y1 == null || y0 == null) return; top.push([x, y1]); bot.push([x, y0]); });
      if (top.length < 2) return;
      ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]);
      for (var i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
      for (var j = bot.length - 1; j >= 0; j--) ctx.lineTo(bot[j][0], bot[j][1]);
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    };
    mid.attachPrimitive({
      attached: function () {}, detached: function () {}, updateAllViews: function () {},
      paneViews: function () { return [{ zOrder: function () { return 'bottom'; }, renderer: function () { return { draw: function (target) {
        if (mid.options().visible === false) return;
        target.useMediaCoordinateSpace(function (sc) {
          var cx = sc.context; band(cx, 'p10', 'p90', ink(0.07)); band(cx, 'p25', 'p75', ink(0.12));
          var x = chart.timeScale().timeToCoordinate(due), H = sc.mediaSize.height; if (x == null) return;
          var g = cx.createLinearGradient(x, 0, x + 44, 0); g.addColorStop(0, ink(0.06)); g.addColorStop(1, ink(0)); cx.fillStyle = g; cx.fillRect(x, 0, 44, H);
          cx.save(); cx.strokeStyle = ink(0.55); cx.lineWidth = 1; cx.setLineDash([4, 4]); cx.beginPath(); cx.moveTo(Math.round(x) + 0.5, 0); cx.lineTo(Math.round(x) + 0.5, H); cx.stroke(); cx.restore();
          cx.font = '600 11px Pretendard, system-ui, sans-serif'; cx.fillStyle = ink(0.7); cx.textBaseline = 'top'; cx.fillText('채점 ' + Number(due.slice(5, 7)) + '/' + Number(due.slice(8, 10)), x + 5, 6);
        });
      } }; } }]; }
    });
    return [hi, lo, mid];
  };

  // G-222: the 피보나치 layer was dotted price lines whose names never showed (no axis label means no title). Now it is
  // drawn like TradingView's retracement: from the leg's start to the right edge, a coloured line and a label per level,
  // light bands between 0% and 100%, and 확장 127.2% / 161.8% of the leg past its end (targets in the leg's direction).
  var FIB_COL = { 0: '#787b86', 0.236: '#f23645', 0.382: '#ff9800', 0.5: '#4caf50', 0.618: '#089981', 0.786: '#00bcd4', 1: '#787b86', 1.272: '#2962ff', 1.618: '#9c27b0' };
  // Attached to the candle series itself (no time points of its own, so it fits the weekly and minute views too);
  // setOverlay('fib') attaches and detaches it. Hidden while the analysis layers are suspended (minute candles).
  var fibPrim = null;
  var makeFib = function () {
    // Older reports list 0.236–0.786 only: the levels lie on one line, so 0% and 100% follow from any two of them.
    var lv = (ov.fib || []).slice(), a = lv[0], z = lv[lv.length - 1];
    if (!a || !z || a.ratio === z.ratio) return null;
    var at = function (k) { return a.price + (z.price - a.price) * (k - a.ratio) / (z.ratio - a.ratio); };
    if (a.ratio !== 0) lv.unshift({ ratio: 0, price: at(0) });
    if (z.ratio !== 1) lv.push({ ratio: 1, price: at(1) });
    var p0 = lv[0], p1 = lv[lv.length - 1];
    var levels = lv.concat([1.272, 1.618].map(function (k) { return { ratio: k, ext: true, price: p1.price + (p0.price - p1.price) * k }; }));
    var lo = Math.min.apply(null, levels.map(function (f) { return f.price; })), hi = Math.max.apply(null, levels.map(function (f) { return f.price; }));
    var from = ov.fibLeg && ov.fibLeg.from;
    var fmt = function (v) { return document.documentElement.getAttribute('data-ccy') === 'USD' ? '$' + v.toFixed(2) : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('ko-KR') : +v.toFixed(2) + ''; };
    var ys = [], x0 = 0, W = 0;
    // Lines and bands under the candles, the level labels above them so a candle never hides one.
    var view = function (labels) { return { zOrder: function () { return labels ? 'top' : 'bottom'; }, renderer: function () { return { draw: function (target) {
      if (analysisSuspended) return;
      target.useMediaCoordinateSpace(function (sc) {
        var ctx = sc.context; W = sc.mediaSize.width;
        // The leg starts on screen, before it (whole width), or after it (nothing to draw yet).
        var fx = from ? chart.timeScale().timeToCoordinate(from) : null;
        if (fx == null && from && activeBars === bars && bars.length && from > bars[bars.length - 1].date) return;
        x0 = fx == null ? 0 : fx; if (x0 > W) return; x0 = Math.max(0, x0);
        ctx.save();
        levels.forEach(function (f, i) {
          var y = ys[i], c = FIB_COL[f.ratio] || INK; if (y == null) return;
          if (labels) {
            var t = (f.ext ? '확장 ' : '') + +(f.ratio * 100).toFixed(1) + '%' + (f.ext ? '' : f.ratio === 0 ? ' 끝' : f.ratio === 1 ? ' 시작' : '') + '  ' + fmt(f.price);
            ctx.font = '600 11px sans-serif'; ctx.textBaseline = 'middle'; var tw = ctx.measureText(t).width;
            ctx.globalAlpha = 0.9; ctx.fillStyle = c; ctx.fillRect(x0 + 2, y - 17, tw + 8, 15); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillText(t, x0 + 6, y - 9.5); return;
          }
          if (i && !f.ext && ys[i - 1] != null) { ctx.globalAlpha = 0.07; ctx.fillStyle = c; ctx.fillRect(x0, Math.min(y, ys[i - 1]), W - x0, Math.abs(y - ys[i - 1])); }
          ctx.globalAlpha = 1; ctx.strokeStyle = c; ctx.lineWidth = f.ratio === 0.618 || f.ratio === 1.618 ? 1.5 : 1; ctx.setLineDash(f.ext ? [5, 4] : []);
          ctx.beginPath(); ctx.moveTo(x0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); ctx.stroke();
        });
        ctx.restore();
      });
    } }; } }; };
    var views = [view(false), view(true)];
    return {
      // Attaching alone does not repaint: ask for one so the layer shows (and the scale takes the extensions) at once.
      attached: function (p) { if (p && p.requestUpdate) p.requestUpdate(); }, detached: function () {},
      updateAllViews: function () { ys = levels.map(function (f) { return candle.priceToCoordinate(f.price); }); },
      paneViews: function () { return views; },
      // The extensions are the point of turning this on: keep them (up to 161.8%) inside the price scale.
      autoscaleInfo: function () { return analysisSuspended ? null : { priceRange: { minValue: lo, maxValue: hi } }; }
    };
  };

  // ---- AI scenarios: a fan from today's close to each scenario's 20-session range ----
  // G-130: the scenario boxes are off the chart (#scen still feeds the price-alert picks).
  var scen = [], scBuilt = [], scExtra = 0;
  var SC = { BULL: [UP, '강세'], BASE: ['#5b6b80', '기본'], BEAR: [DOWN, '약세'] };
  // G-96: each scenario's 20-session range is a box from today to twenty sessions ahead, labelled with what it means.
  // An invisible anchor series puts those future sessions on the time scale and keeps the boxes inside the price scale.
  var scPick = '', scShown = [], scDays = [], boxes = document.getElementById('sc-boxes');
  try { var storedSc=localStorage.getItem('gnm-scenario-layer');if(['','ALL','BULL','BASE','BEAR'].indexOf(storedSc)>=0)scPick=storedSc; } catch(e){}
  var compact = function (v) { return v >= 1e8 ? (v / 1e8).toFixed(1).replace(/\\.0$/, '') + '억' : v >= 1e5 ? Math.round(v / 1e4).toLocaleString('ko-KR') + '만' : v >= 100 ? Math.round(v).toLocaleString('ko-KR') : String(+v.toPrecision(4)); };
  var drawBoxes = function () {
    if (!boxes) return;
    if (!scShown.length || !scDays.length) { boxes.innerHTML = ''; return; }
    var h = chart.panes()[0].getHeight(), w = el.clientWidth - chart.priceScale('right').width(), ts = chart.timeScale();
    // From today's candle to the right edge of the plot: the room set aside for 'twenty sessions from now'.
    var x1 = ts.timeToCoordinate(bars[bars.length - 1].date), x2 = w - 4;
    if (x1 == null || x2 - x1 < 8) { boxes.innerHTML = ''; return; }
    x1 += 4;
    var close = bars[bars.length - 1].close, lanes = scShown.length, lw = (x2 - x1) / lanes;
    // Side by side, so each scenario reads on its own: 강세 | 기본 | 약세, each spanning the same twenty sessions.
    boxes.innerHTML = scShown.map(function (x, li) {
      var top = candle.priceToCoordinate(x.zone[1]), bot = candle.priceToCoordinate(x.zone[0]);
      if (top == null || bot == null) return '';
      top = Math.max(0, top); bot = Math.min(h, bot); if (bot - top < 18) { var c0 = (top + bot) / 2; top = c0 - 9; bot = c0 + 9; }
      var mid = (x.zone[0] + x.zone[1]) / 2, g = (mid / close - 1) * 100;
      var wide = lw >= 86, narrow = lw < 58, gs = g.toFixed(narrow ? 0 : 1), pct = (/^-?0(\\.0)?$/.test(gs) ? '0' : (g > 0 ? '+' : '') + gs) + '%';
      // Narrow lanes (phones) keep the arrow and the distance; the names and ranges sit in the line above the chart.
      var label = narrow ? '<b>' + (x.kind === 'BULL' ? '▲' : x.kind === 'BEAR' ? '▼' : '●') + '</b><span>' + pct + '</span>' : '<b>' + SC[x.kind][1] + (x.p != null && wide ? ' ' + x.p + '%' : '') + '</b><span>' + pct + '</span>' + (wide ? '<span>' + compact(x.zone[0]) + '~' + compact(x.zone[1]) + '</span>' : '');
      return '<div class="sc-box sc-box-' + x.kind + '" style="left:' + Math.round(x1 + li * lw + 1) + 'px;width:' + Math.max(6, Math.round(lw - 3)) + 'px;top:' + Math.round(top) + 'px;height:' + Math.round(bot - top) + 'px"><i>' + label + '</i></div>';
    }).join('');
  };
  var drawScen = function (pick, keep) {
    if (!keep) { scPick = pick; try{localStorage.setItem('gnm-scenario-layer',pick);}catch(e){} }
    scBuilt.forEach(function (x) { chart.removeSeries(x); var i = allSeries.indexOf(x); if (i >= 0) allSeries.splice(i, 1); }); scBuilt = [];
    var last = bars[bars.length - 1], d = last.date; scDays = [];
    for (var h = 1; h <= 20; h++) { d = addDays(d, 1); scDays.push(d); }
    scShown = scen.filter(function (x) { return pick === 'ALL' || x.kind === pick; });
    if (scShown.length) {
      var lo = Math.min.apply(null, scShown.map(function (x) { return x.zone[0]; })), hi = Math.max.apply(null, scShown.map(function (x) { return x.zone[1]; }));
      var anchor = chart.addSeries(L.LineSeries, { color: 'rgba(0,0,0,0)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: function () { return { priceRange: { minValue: lo, maxValue: hi } }; } });
      anchor.setData(scDays.map(function (t) { return { time: t, value: last.close }; }));
      scBuilt.push(anchor);
    }
    scExtra = scShown.length ? 22 : 0;
    requestAnimationFrame(drawBoxes);
  };
  var scBar = document.getElementById('sc-layer');
  var scButtons = function () {
    if (!scBar) return;
    scBar.hidden = !scen.length; if (!scen.length) { scBar.innerHTML = ''; return; }
    scBar.innerHTML = '<span class="label">시나리오 전망</span><button type="button" data-sc="ALL" aria-pressed="true">모두</button>' + scen.map(function (x) { return '<button type="button" data-sc="' + x.kind + '" class="sc-' + x.kind + '" aria-pressed="false">' + SC[x.kind][1] + (x.p != null ? ' ' + x.p + '%' : '') + '</button>'; }).join('') + '<button type="button" data-sc="" aria-pressed="false">끄기</button><span class="sc-note">' + scen.map(function (x) { return '<span class="sc-' + x.kind + '">' + SC[x.kind][1] + ' ' + compact(x.zone[0]) + '~' + compact(x.zone[1]) + '</span>'; }).join(' · ') + ' · 20거래일 뒤 ' + (scen.some(function (x) { return x.source === 'calc'; }) ? '(변동성 계산)' : scen.some(function (x) { return x.source === 'analyst'; }) ? '(AI 분석가 목표가)' : '(AI 위원회)') + '</span>';
    scBar.querySelectorAll('[data-sc]').forEach(function (b) {
      b.setAttribute('aria-pressed',String(b.getAttribute('data-sc')===scPick));
      b.addEventListener('click', function () {
        scBar.querySelectorAll('[data-sc]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        drawScen(b.getAttribute('data-sc'));
        var fc = document.querySelector('[data-ov="forecast"]');
        setRange(currentRange, Math.max(fc && fc.getAttribute('aria-pressed') === 'true' ? 62 : 0, scExtra));
      });
    });
  };
  scButtons();
  // A report made on request brings its scenarios after the page loaded.
  // Intraday candles (coins) use their own time scale: the daily fan steps aside and comes back with the daily view.
  window.GNM_scenarioPause = function (off) { drawScen(off ? '' : scPick, true); };
  window.GNM_scenarios = function () {};

  // ---- panes (below the price) ----
  var paneMakers = {
    volume: function (p) { var s = chart.addSeries(L.HistogramSeries, { priceFormat: { type: 'volume' }, priceLineVisible: false, lastValueVisible: false }, p); s.setData(bars.map(function (b, i) { return { time: b.date, value: b.volume, color: i && b.close < bars[i - 1].close ? 'rgba(49,130,246,.45)' : 'rgba(240,68,82,.45)' }; })); return [s]; },
    rsi: function (p) { var q = ip('rsi'), s = line(rsi(q.n), inkA(0.8), p, { lastValueVisible: true, title: 'RSI ' + q.n }); s.createPriceLine({ price: q.hi, color: '#a5b6ce', lineStyle: 2, lineWidth: 1, axisLabelVisible: false }); s.createPriceLine({ price: q.lo, color: '#a5b6ce', lineStyle: 2, lineWidth: 1, axisLabelVisible: false }); return [s]; },
    macd: function (p) {
      var q = ip('macd'), f = ema(C, q.f), s = ema(C, q.s), m = C.map(function (_, i) { return i < q.s - 1 ? null : f[i] - s[i]; });
      var sig = ema(m, q.sig).map(function (x, i) { return i < q.s + q.sig - 2 ? null : x; });
      var hist = chart.addSeries(L.HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, p);
      hist.setData(m.map(function (x, i) { return x == null || sig[i] == null ? null : { time: t(i), value: x - sig[i], color: x - sig[i] >= 0 ? 'rgba(240,68,82,.5)' : 'rgba(49,130,246,.5)' }; }).filter(Boolean));
      return [hist, line(m, INK, p, { title: 'MACD' }), line(sig, inkA(0.45), p, { title: '시그널' })];
    },
    stoch: function (p) { var q = ip('stoch'), k = C.map(function (c, i) { if (i < q.n - 1) return null; var h = hh(q.n, i), l = ll(q.n, i); return h === l ? 50 : (c - l) / (h - l) * 100; }); var ks = sma(k.map(function (x) { return x == null ? 0 : x; }), q.k).map(function (x, i) { return i < q.n + q.k - 2 ? null : x; }); var ds = sma(ks.map(function (x) { return x == null ? 0 : x; }), q.d).map(function (x, i) { return i < q.n + q.k + q.d - 3 ? null : x; }); return [line(ks, '#00968a', p, { title: '%K' }), line(ds, '#d97706', p, { title: '%D' })]; },
    cci: function (p) { var n = ip('cci').n, tp = bars.map(function (b) { return (b.high + b.low + b.close) / 3; }), m = sma(tp, n); return [line(tp.map(function (x, i) { if (m[i] == null) return null; var md = 0; for (var j = i - n + 1; j <= i; j++) md += Math.abs(tp[j] - m[i]); md /= n; return md === 0 ? 0 : (x - m[i]) / (0.015 * md); }), '#0e7490', p, { title: 'CCI ' + n })]; },
    wr: function (p) { var n = ip('wr').n; return [line(C.map(function (c, i) { if (i < n - 1) return null; var h = hh(n, i), l = ll(n, i); return h === l ? -50 : (h - c) / (h - l) * -100; }), '#be185d', p, { title: '%R ' + n })]; },
    value: function (p) {
      var vn = ip('value').n, tv = bars.map(function (b) { return b.close * b.volume / 1e8; }), m = sma(tv, vn);
      var s = chart.addSeries(L.HistogramSeries, { priceFormat: { type: 'price', precision: 1, minMove: 0.1 }, priceLineVisible: false, lastValueVisible: true, title: '거래대금(억)' }, p);
      s.setData(bars.map(function (b, i) { var big = i >= 20 && m[i - 1] && tv[i] >= m[i - 1] * 3, up = !i || b.close >= bars[i - 1].close; return { time: b.date, value: tv[i], color: big ? (up ? 'rgba(240,68,82,.95)' : 'rgba(49,130,246,.95)') : (up ? 'rgba(240,68,82,.35)' : 'rgba(49,130,246,.35)') }; }));
      return [s, line(m, '#64748b', p, { title: vn + '일 평균' })];
    },
    ad: function (p) { var a = 0; return [line(bars.map(function (b) { a += b.high > b.low ? ((b.close - b.low) - (b.high - b.close)) / (b.high - b.low) * b.volume : 0; return a; }), '#0f766e', p, { title: 'A/D', lastValueVisible: false })]; },
    // G-186: MFI — RSI with volume: the share of money flow on up days over n sessions (overbought 80, oversold 20 by default).
    mfi: function (p) { var q = ip('mfi'), tp = bars.map(function (b) { return (b.high + b.low + b.close) / 3; }), vals = bars.map(function (b, i) { if (i < q.n) return null; var pos = 0, neg = 0; for (var j = i - q.n + 1; j <= i; j++) { var f = tp[j] * bars[j].volume; if (tp[j] > tp[j - 1]) pos += f; else if (tp[j] < tp[j - 1]) neg += f; } return pos + neg === 0 ? null : neg === 0 ? 100 : 100 - 100 / (1 + pos / neg); }); var s = line(vals, '#14b8a6', p, { lastValueVisible: true, title: 'MFI ' + q.n }); s.createPriceLine({ price: q.hi, color: '#a5b6ce', lineStyle: 2, lineWidth: 1, axisLabelVisible: false }); s.createPriceLine({ price: q.lo, color: '#a5b6ce', lineStyle: 2, lineWidth: 1, axisLabelVisible: false }); return [s]; },
    obv: function (p) { var o = 0; return [line(C.map(function (c, i) { if (i) o += c > C[i - 1] ? V[i] : c < C[i - 1] ? -V[i] : 0; return o; }), '#475569', p, { title: 'OBV' })]; },
    atr: function (p) { var n = ip('atr').n, a = null; return [line(bars.map(function (b, i) { if (!i) return null; var tr = Math.max(b.high - b.low, Math.abs(b.high - C[i - 1]), Math.abs(b.low - C[i - 1])); a = a == null ? tr : (a * (n - 1) + tr) / n; return i < n ? null : a; }), INK, p, { title: 'ATR ' + n })]; }
  };
  var paneOrder = [];
  var clearPanes=function(){Object.keys(paneMakers).forEach(function(k){(built['pane:'+k]||[]).forEach(function(s){chart.removeSeries(s);});delete built['pane:'+k];});while(chart.panes().length>1)chart.removePane(chart.panes().length-1);};
  var rebuildPanes = function () {
    // Remove all indicator panes and re-add the selected ones in menu order.
    clearPanes();
    paneOrder = Array.prototype.slice.call(document.querySelectorAll('[data-pane]')).filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; }).map(function (b) { return b.getAttribute('data-pane'); });
    paneOrder.forEach(function (k, i) { built['pane:' + k] = paneMakers[k](i + 1); });
    chart.panes().forEach(function (p, i) { p.setStretchFactor(i === 0 ? 3 : 1); });
    el.style.height = (mobile ? 360 : 440) + paneOrder.length * (mobile ? 90 : 110) + 'px';
    if (relegend) relegend();
  };
  // Volume spikes: 3× the 20-session average, marked under the candle.
  var spikeMarks = null;
  var spikeList = function () { var avg = sma(V, 20), out = []; for (var i = 20; i < bars.length; i++) if (avg[i - 1] && V[i] >= avg[i - 1] * 3) { var up = C[i] >= C[i - 1]; out.push({ time: t(i), position: 'belowBar', shape: up ? 'arrowUp' : 'arrowDown', color: up ? '#f04452' : '#3182f6', text: (V[i] / avg[i - 1]).toFixed(1) + '배' }); } return out; };
  var setOverlay = function (k, on) {
    if (k === 'spikes') { if (!spikeMarks) spikeMarks = L.createSeriesMarkers(candle, []); spikeMarks.setMarkers(on ? spikeList() : []); return; }
    if (k === 'fib') { if (fibPrim) candle.detachPrimitive(fibPrim); fibPrim = on ? makeFib() : null; if (fibPrim) candle.attachPrimitive(fibPrim); return; }
    if (lineMakers[k]) { (priceLines[k] || []).forEach(function (pl) { candle.removePriceLine(pl); }); priceLines[k] = on ? lineMakers[k]() : []; return; }
    (built[k] || []).forEach(function (s) { chart.removeSeries(s); });
    built[k] = on ? overlayMakers[k]() : [];
    if (relegend) relegend();
  };
  var analysisSuspended=false;
  var suspendAnalysis=function(on){if(on===analysisSuspended)return;analysisSuspended=on;if(on){clearPanes();Object.keys(priceLines).forEach(function(k){priceLines[k].forEach(function(pl){candle.removePriceLine(pl);});priceLines[k]=[];});if(spikeMarks)spikeMarks.setMarkers([]);el.style.height=(mobile?360:440)+'px';}else{rebuildPanes();document.querySelectorAll('[data-ov][aria-pressed=true]').forEach(function(b){var k=b.dataset.ov;if(lineMakers[k]||k==='spikes')setOverlay(k,true);});}};
  document.querySelectorAll('[data-ov]').forEach(function (b) {
    if (b.getAttribute('aria-pressed') === 'true') setOverlay(b.getAttribute('data-ov'), true);
    b.addEventListener('click', function () { var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); setOverlay(b.getAttribute('data-ov'), on); if (b.getAttribute('data-ov') === 'forecast') setRange(currentRange, on ? 62 : scExtra); });
  });
  document.querySelectorAll('[data-pane]').forEach(function (b) { b.addEventListener('click', function () { b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true')); rebuildPanes(); }); });
  rebuildPanes();
  // The moving averages carry their period in the menu ("이동평균 25" after a change).
  var maName = function () { ['ma5', 'ma20', 'ma60', 'ma120'].forEach(function (k) { var b = document.querySelector('[data-ov="' + k + '"] .opt-t b'); if (b) b.textContent = '이동평균 ' + IP[k].n; }); };
  maName();
  window.GNM_indParams = {
    defaults: IP0,
    get: function (k) { return IP[k] ? Object.assign({}, IP[k]) : null; },
    set: function (k, vals) {
      if (!IP[k]) return false;
      Object.keys(IP[k]).forEach(function (f) { var v = vals && vals[f] != null ? Number(vals[f]) : IP0[k][f]; if (isFinite(v) && v > 0) IP[k][f] = v; });
      try { var out = {}; Object.keys(IP).forEach(function (x) { if (JSON.stringify(IP[x]) !== JSON.stringify(IP0[x])) out[x] = IP[x]; }); localStorage.setItem('gnm-ind-params', JSON.stringify(out)); } catch (e) {}
      maName();
      if (analysisSuspended) return true;
      var ob = document.querySelector('[data-ov="' + k + '"]'); if (ob && ob.getAttribute('aria-pressed') === 'true') { setOverlay(k, false); setOverlay(k, true); }
      if (paneMakers[k] && paneOrder.indexOf(k) >= 0) rebuildPanes();
      return true;
    }
  };

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
    drawBoxes();
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
      if (byDate[tr.entry] != null) mk.push({ time: tr.entry, position: 'belowBar', color: UP, shape: 'arrowUp', text: '진입 ' + won(tr.entryPrice) });
      if (tr.exit && byDate[tr.exit] != null) mk.push({ time: tr.exit, position: 'aboveBar', color: DOWN, shape: 'arrowDown', text: '정리 ' + (tr.ret >= 0 ? '+' : '') + (tr.ret * 100).toFixed(1) + '%' });
    });
    mk.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
    stratMarkers.setMarkers(mk);
    var last = st.trades[st.trades.length - 1];
    var rows = st.trades.slice(-8).reverse().map(function (tr) {
      return '<tr><td>' + tr.entry + '</td><td class="num">' + won(tr.entryPrice) + '</td><td>' + (tr.exit || '규칙상 보유 중') + '</td><td class="num">' + (tr.exitPrice ? won(tr.exitPrice) : '') + '</td><td class="num ' + (tr.ret >= 0 ? 'up' : 'down') + '">' + (tr.ret >= 0 ? '+' : '') + (tr.ret * 100).toFixed(1) + '%</td></tr>';
    }).join('');
    info.innerHTML = '<div class="si-head"><b>' + st.rank + '위 ' + st.name + '</b><span class="badge ' + (st.position ? 'v-BULLISH">규칙상: 보유 구간' : 'b-LOW">규칙상: 관망') + '</span></div>' +
      '<p>' + (last ? (last.exit ? '마지막 신호: ' + last.exit + ' 정리 (' + won(last.exitPrice) + ')' : '마지막 신호: ' + last.entry + ' 진입 (' + won(last.entryPrice) + '), 규칙상 아직 보유 구간') : '이 기간에 신호가 없었어요.') + '</p>' +
      '<p class="muted small">다음 신호 조건: ' + st.trigger + '</p>' +
      (rows ? '<div class="table-wrap"><table class="compact"><thead><tr><th>진입일</th><th class="num">진입가</th><th>정리일</th><th class="num">정리가</th><th class="num">과거 수익</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '');
    info.hidden = false;
  };
  document.querySelectorAll('[data-strategy]').forEach(function (b) { b.addEventListener('click', function () { selectStrategy(b.getAttribute('data-strategy')); }); });
  // Links elsewhere on the page ("차트에서 매매 시점 보기") pick a strategy here.
  document.querySelectorAll('[data-show-strategy]').forEach(function (a) { a.addEventListener('click', function () { var k = a.getAttribute('data-show-strategy'); setTimeout(function () { selectStrategy(k); setRange(250); }, 50); }); });

  // ---- legend, ranges and period change ----
  var legend = document.getElementById('legend'), stat = document.getElementById('period-stat');
  var activeBars=bars;var byDate = {}; bars.forEach(function (b, i) { byDate[b.date] = i; });
  // G-219: TradingView-style legends. The line above the chart colours each price against the previous close (red up,
  // blue down, like Naver and Toss) and adds the change and a compact volume; each pane carries its indicators' values
  // for the candle under the crosshair (the last candle otherwise) at its top-left corner.
  // Won prices are whole numbers: no decimals on prices or price-pane lines when every close is whole (dollars and sub-won coins keep them).
  var INT = bars.every(function (b) { return Math.round(b.close) === b.close; });
  var fmtPx = function (v) { return INT ? Math.round(v).toLocaleString('ko-KR') : fmtP(v); };
  var fmtP = function (v) { return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('ko-KR') : Math.abs(v) >= 1 ? v.toFixed(2) : v.toPrecision(3); };
  var fmtV = function (v) { var a = Math.abs(v); return a >= 1e8 ? (v / 1e8).toFixed(a >= 1e10 ? 0 : 1).replace(/\\.0$/, '') + '억' : a >= 1e4 ? (v / 1e4).toFixed(a >= 1e6 ? 0 : 1).replace(/\\.0$/, '') + '만' : Math.round(v).toLocaleString('ko-KR'); };
  var cls = function (d) { return d > 0 ? 'up' : d < 0 ? 'down' : ''; };
  var LG_NAME = {
    ma5: function () { return 'MA ' + IP.ma5.n; }, ma20: function () { return 'MA ' + IP.ma20.n; }, ma60: function () { return 'MA ' + IP.ma60.n; }, ma120: function () { return 'MA ' + IP.ma120.n; },
    ema12: function () { return 'EMA ' + IP.ema12.f + '·' + IP.ema12.s; }, bb: function () { return '볼린저 ' + IP.bb.n + '·' + IP.bb.k; }, ichimoku: function () { return '일목'; }, env: function () { return '엔벨로프 ' + IP.env.pct + '%'; },
    vwap: function () { return 'VWAP ' + IP.vwap.n; }, psar: function () { return 'SAR'; },
    volume: function () { return '거래량'; }, rsi: function () { return 'RSI ' + IP.rsi.n; }, macd: function () { return 'MACD ' + IP.macd.f + '·' + IP.macd.s + '·' + IP.macd.sig; }, stoch: function () { return '스토캐스틱 ' + IP.stoch.n; },
    value: function () { return '거래대금(억)'; }, ad: function () { return 'A/D'; }, cci: function () { return 'CCI ' + IP.cci.n; }, wr: function () { return '%R ' + IP.wr.n; }, obv: function () { return 'OBV'; }, mfi: function () { return 'MFI ' + IP.mfi.n; }, atr: function () { return 'ATR ' + IP.atr.n; }
  };
  var LG_VOL = { volume: 1, obv: 1, ad: 1 };
  var vcache = typeof WeakMap === 'function' ? new WeakMap() : null;
  var valueAt = function (s, time) {
    if (!vcache) return null;
    var c = vcache.get(s), d;
    if (!c) { d = s.data(); c = { m: {} }; for (var j = 0; j < d.length; j++) if (typeof d[j].time === 'string') c.m[d[j].time] = d[j]; vcache.set(s, c); }
    return c.m[time] || null;
  };
  var paneTops = [];
  // Pane tops change only on a resize or a rebuild (relegend), not on every crosshair move.
  var measurePanes = function () { var top0 = el.getBoundingClientRect().top + el.clientTop; paneTops = chart.panes().map(function (p) { var pe = p.getHTMLElement && p.getHTMLElement(); return pe ? Math.round(pe.getBoundingClientRect().top - top0 + 2) : null; }); };
  var bodyEl = el.parentElement, plWrap = document.createElement('div');
  plWrap.className = 'pane-legends'; plWrap.setAttribute('aria-hidden', 'true'); if (bodyEl) bodyEl.appendChild(plWrap);
  var paneLegends = function (i) {
    if (!bodyEl) return;
    var b = activeBars[i], time = b && b.date, html = '';
    if (!time || activeBars !== bars) { plWrap.innerHTML = ''; return; }
    var row = function (k, list, onPrice) {
      var vals = list.map(function (s) {
        if (s.options().visible === false) return '';
        var p = valueAt(s, time); if (!p || p.value == null || !isFinite(p.value)) return '';
        var col = String(p.color || s.options().color || INK).replace(/^rgba\\((.*),\\s*[.\\d]+\\)$/, 'rgb($1)');
        return '<b style="color:' + col + '">' + (LG_VOL[k] ? fmtV(p.value) : onPrice ? fmtPx(p.value) : fmtP(p.value)) + '</b>';
      }).filter(Boolean);
      return vals.length ? '<span class="pl-row"><span class="pl-n">' + LG_NAME[k]() + '</span>' + vals.join(' ') + '</span>' : '';
    };
    var price = Object.keys(LG_NAME).filter(function (k) { return !paneMakers[k] && (built[k] || []).length; }).map(function (k) { return row(k, built[k], true); }).join('');
    if (price) html += '<div class="pl" style="top:' + 4 + 'px">' + price + '</div>';
    paneOrder.forEach(function (k, n) {
      if (paneTops[n + 1] == null) return;
      var r = row(k, built['pane:' + k] || []);
      if (r) html += '<div class="pl" style="top:' + paneTops[n + 1] + 'px">' + r + '</div>';
    });
    plWrap.innerHTML = html;
  };
  var shown = bars.length - 1;
  var show = function (i) {
    var b = activeBars[i]; if (!b) return; shown = i;
    var pc = i > 0 ? activeBars[i - 1].close : b.open, d = b.close - pc;
    var v = function (label, x) { return '<span>' + label + ' <b class="' + cls(x - pc) + '">' + fmtPx(x) + '</b></span>'; };
    // G-300: on the newest bar, 종가 and the change are already the big price above the chart; say them once.
    var newest = i === activeBars.length - 1;
    legend.innerHTML = '<span class="lg-d">' + (b.date || '') + '</span>' + v('시', b.open) + v('고', b.high) + v('저', b.low) + (newest ? '' : v('종', b.close) +
      '<b class="' + cls(d) + '">' + (d > 0 ? '+' : '') + fmtPx(d) + ' (' + (d > 0 ? '+' : '') + (pc ? (d / pc * 100).toFixed(2) : '0.00') + '%)</b>') +
      (b.volume != null ? '<span>거래량 <b>' + fmtV(b.volume) + '</b></span>' : '');
    legend.setAttribute('aria-label', (b.date || '') + ' 시가 ' + won(b.open) + ' 고가 ' + won(b.high) + ' 저가 ' + won(b.low) + ' 종가 ' + won(b.close));
    paneLegends(i);
  };
  // Rebuilt series bring new data: forget the cached values and redraw once the panes have their new heights.
  // Called after every rebuild (setOverlay, rebuildPanes, showBars) and resize: series may hold new data and panes new heights.
  relegend = function () { if (vcache) vcache = new WeakMap(); requestAnimationFrame(function () { measurePanes(); show(Math.min(shown, activeBars.length - 1)); if (placeLatest) placeLatest(); }); };
  // #chart's height animates when panes are added or removed; follow it to the end.
  if (typeof ResizeObserver === 'function') new ResizeObserver(function () { relegend(); }).observe(el);
  show(bars.length - 1);
  chart.subscribeCrosshairMove(function (p) { show(p && p.time && byDate[p.time] != null ? byDate[p.time] : activeBars.length - 1); });
  // G-219: like TradingView's » button — once the newest candle has scrolled off the right edge, one tap brings it
  // back without changing the zoom.
  var toLatest = document.createElement('button');
  toLatest.type = 'button'; toLatest.className = 'to-latest'; toLatest.hidden = true; toLatest.setAttribute('aria-label', '최신 봉으로 이동'); toLatest.title = '최신 봉으로 이동';
  toLatest.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5 8 8l-4.5 4.5M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if (bodyEl) bodyEl.appendChild(toLatest);
  placeLatest = function () {
    // Only for candles: the coin trade/1-minute line keeps its own points, which activeBars does not count.
    var r = chart.timeScale().getVisibleLogicalRange(), n = activeBars.length;
    var off = !!r && candle.options().visible !== false && r.to < n - 1.5;
    if (off !== !toLatest.hidden) toLatest.hidden = !off;
    if (off) { toLatest.style.right = (chart.priceScale('right').width() + 10) + 'px'; toLatest.style.top = Math.max(8, chart.panes()[0].getHeight() - 44) + 'px'; }
  };
  chart.timeScale().subscribeVisibleLogicalRangeChange(placeLatest);
  toLatest.addEventListener('click', function () {
    var r = chart.timeScale().getVisibleLogicalRange(); if (!r) return;
    var n = activeBars.length, extra = activeBars === bars ? currentExtra : 4, w = r.to - r.from;
    chart.timeScale().setVisibleLogicalRange({ from: n - 0.5 + extra - w, to: n - 0.5 + extra });
  });
  var currentRange = 63;
  var currentExtra = 0;
  // A chart built inside a hidden tab has no width; once the tab is shown, apply the chosen range again.
  var lastWidth = el.clientWidth;
  chart.timeScale().subscribeSizeChange(function (w) { if (!analysisSuspended && !lastWidth && w > 0) setRange(currentRange, currentExtra); lastWidth = w; });
  var setRange = function (n, extra) {
    currentRange = n;
    var from = Math.max(0, bars.length - n);
    currentExtra = extra || 0;
    // Room on the right for the scenario boxes: a fixed share of the visible candles, wider on phones.
    // G-176: room for the scenario boxes, at most a third of the candles on screen (a phone showed half the chart empty); 1개월 keeps 10.
    if (scShown.length && currentExtra < 62) currentExtra = Math.max(currentExtra, Math.max(10, Math.min(30, Math.round(Math.min(n, bars.length) * (mobile ? 0.4 : 0.3)))));
    chart.timeScale().setVisibleLogicalRange({ from: from - 0.5, to: bars.length - 0.5 + currentExtra });
    var w = bars.slice(from), first = w[0].open, lastC = w[w.length - 1].close, hi = Math.max.apply(null, w.map(function (b) { return b.high; })), lo = Math.min.apply(null, w.map(function (b) { return b.low; }));
    var ch = (lastC / first - 1) * 100, label = document.querySelector('[data-range="' + n + '"]').textContent;
    stat.innerHTML = '<span>' + label + ' 동안</span><b class="' + (ch > 0 ? 'up' : ch < 0 ? 'down' : '') + '">' + (ch > 0 ? '+' : '') + ch.toFixed(2) + '%</b><span>최고 ' + won(hi) + '</span><span>최저 ' + won(lo) + '</span><span>' + w[0].date + ' ~ ' + w[w.length - 1].date + '</span>';
  };
  document.querySelectorAll('[data-range]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-range]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var fc = document.querySelector('[data-ov="forecast"]');
      setRange(Number(b.getAttribute('data-range')), Math.max(fc && fc.getAttribute('aria-pressed') === 'true' ? 62 : 0, scExtra));
    });
  });
  if (scen.length) drawScen(scPick);
  setRange(63, scExtra);
  requestAnimationFrame(drawLines);
  window.GNMChart = { L: L, chart: chart, candle: candle, bars: bars, series: function () { return allSeries.slice(); },suspendAnalysis:suspendAnalysis,showBars:function(list){activeBars=list;byDate={};list.forEach(function(b,i){byDate[b.date||b.time]=i;if(b.time!=null)byDate[b.time]=i;});show(list.length-1);relegend();} };
  if(window.GNM_coinChartReady)window.GNM_coinChartReady();
});
`;

/** Chart toolbar: indicators one by one (remembered on this device), the strategy sheet, and the pills of what is on. */
const TOOLS_JS = `
(function () {
  var KEY = 'gnm-ind', restoring = false, pills = document.getElementById('active-pills');
  var DEFAULT = ${JSON.stringify({ ov: OVERLAYS.filter((o) => o[2]).map((o) => o[0]), pane: PANES.filter((o) => o[2]).map((o) => o[0]) })};
  var on = function (b) { return b.getAttribute('aria-pressed') === 'true'; };
  var opts = function () { return Array.prototype.slice.call(document.querySelectorAll('#ind-sheet [data-ov], #ind-sheet [data-pane]')); };
  var renderPills = function () {
    if (!pills) return;
    // The label's own text only (a glossary "?" may sit inside it).
    var name = function (b) { return b.querySelector('b').firstChild.textContent.trim(); };
    pills.innerHTML = opts().filter(on).map(function (b) { var k = b.hasAttribute('data-ov') ? 'data-ov' : 'data-pane'; return '<button type="button" class="pill" data-pill="' + k + ':' + b.getAttribute(k) + '" aria-label="' + name(b) + ' 끄기">' + name(b) + ' <span aria-hidden="true">×</span></button>'; }).join('');
  };
  var save = function () {
    var st = { ov: [], pane: [] };
    opts().filter(on).forEach(function (b) { if (b.hasAttribute('data-ov')) st.ov.push(b.getAttribute('data-ov')); else st.pane.push(b.getAttribute('data-pane')); });
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  };
  var apply = function (want) {
    restoring = true;
    opts().forEach(function (b) { var k = b.hasAttribute('data-ov') ? 'ov' : 'pane', v = b.getAttribute('data-' + k); if (on(b) !== ((want[k] || []).indexOf(v) >= 0)) b.click(); });
    restoring = false; renderPills();
  };
  var focused = null;
  window.GNM_indicators = {
    focus: function (key) {
      if (!focused) { focused = { ov: [], pane: [], strategy: (document.querySelector('[data-strategy][aria-pressed=true]') || {}).dataset?.strategy || '', compare: document.querySelector('[data-compare]')?.getAttribute('aria-pressed') === 'true' }; opts().filter(on).forEach(function (b) { focused[b.hasAttribute('data-ov') ? 'ov' : 'pane'].push(b.getAttribute(b.hasAttribute('data-ov') ? 'data-ov' : 'data-pane')); }); }
      var chosen = opts().find(function (b) { return b.getAttribute('data-ov') === key || b.getAttribute('data-pane') === key; });
      var compare=document.querySelector('[data-compare]');if(compare&&compare.getAttribute('aria-pressed')==='true')compare.click();var strategy=document.querySelector('[data-strategy=""]');if(strategy)strategy.click();
      if (chosen) apply({ ov: chosen.hasAttribute('data-ov') ? [key] : [], pane: chosen.hasAttribute('data-pane') ? [key] : [] });
    },
    restore: function () { if (focused) { apply(focused); var strategy=Array.prototype.slice.call(document.querySelectorAll('[data-strategy]')).find(function(b){return b.getAttribute('data-strategy')===focused.strategy;});if(strategy)strategy.click();var compare=document.querySelector('[data-compare]');if(compare&&(compare.getAttribute('aria-pressed')==='true')!==focused.compare)compare.click(); } focused = null; }
  };
  opts().forEach(function (b) { b.addEventListener('click', function () { if (!restoring) setTimeout(function () { save(); renderPills(); }, 0); }); });
  // G-76: each view (☰ 메뉴 > 내 보기 방식) has its own starting indicators. A reader's own picks are kept
  // for that view; switching the view loads the new view's set.
  var VIEW = { beginner: { ov: ['ma20', 'ma60'], pane: ['volume'] }, trader: { ov: ['ma5', 'ma20', 'levels', 'spikes'], pane: ['volume', 'value', 'rsi'] }, swing: { ov: ['ma20', 'ma60', 'levels'], pane: ['volume', 'rsi', 'macd'] }, long: { ov: ['ma60', 'ma120', 'fair'], pane: ['volume', 'ad'] } };
  var view = function () { return document.documentElement.getAttribute('data-persona') || 'swing'; };
  var preset = function () { return VIEW[view()] || DEFAULT; };
  var keep = function () { try { localStorage.setItem(KEY + '-view', view()); } catch (e) {} };
  var reset = document.getElementById('ind-reset');
  if (reset) reset.addEventListener('click', function () { apply(preset()); save(); keep(); });
  opts().forEach(function (b) { b.addEventListener('click', function () { if (!restoring) keep(); }); });
  window.addEventListener('gnm-persona', function () { apply(preset()); save(); keep(); });
  // Restore after the chart is built (its DOMContentLoaded handler runs first).
  window.addEventListener('DOMContentLoaded', function () { setTimeout(function () {
    var st = null, v = null; try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); v = localStorage.getItem(KEY + '-view'); } catch (e) {}
    if (st && st.ov && st.pane && v === view()) apply(st); else apply(preset());
  }, 0); });
  if (pills) pills.addEventListener('click', function (e) {
    var t = e.target.closest('[data-pill]'); if (!t) return;
    var kv = t.getAttribute('data-pill').split(':'), b = document.querySelector('#ind-sheet [' + kv[0] + '="' + kv[1] + '"]');
    if (b) b.click();
  });
  var opened = null;
  var close = function () { if (!opened) return; opened.hidden = true; document.body.classList.remove('sheet-open'); var o = opened; opened = null; var btn = document.querySelector('[data-open="' + o.id + '"]'); if (btn) btn.focus(); };
  document.querySelectorAll('[data-open]').forEach(function (b) {
    b.addEventListener('click', function () { var sh = document.getElementById(b.getAttribute('data-open')); if (!sh) return; sh.hidden = false; opened = sh; document.body.classList.add('sheet-open'); var f = sh.querySelector('.sheet-done'); if (f) f.focus(); });
  });
  document.querySelectorAll('.sheet [data-close]').forEach(function (b) { b.addEventListener('click', close); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  document.querySelectorAll('#strat-sheet [data-strategy]').forEach(function (b) {
    b.addEventListener('click', function () { var cur = document.getElementById('strat-current'); if (cur) cur.textContent = b.getAttribute('data-strategy') ? b.querySelector('b').textContent : '끄기'; setTimeout(close, 120); });
  });
  renderPills();
})();
`;
