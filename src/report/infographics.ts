// Infographics at the top of the merged tabs (G-129): 기업 체력 (수급 + 종목정보) opens with a five-axis health chart and
// the financial statements table. Everything is drawn from numbers the report already holds; nothing new is
// fetched, and an axis without data is drawn as missing rather than guessed.

import type { MarketSection } from './marketSection.js';
import type { FinancePeriod } from '../types.js';
import type { FullStatements, StatementRow } from '../sources/dartStatements.js';
import { esc } from './html.js';

const clamp = (v: number) => Math.max(0, Math.min(100, v));
const fmtPct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? '없음' : `${v > 0 ? '+' : ''}${v.toFixed(d)}%`);

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
<polygon points="${shape}" class="area"/>${axes.map((a, i) => a.score == null ? '' : (() => { const [x, y] = pt(i, a.score / 100); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" class="dot" data-i="${i}" style="--i:${i}"><title>${esc(a.label)} ${Math.round(a.score)}점</title></circle>`; })()).join('')}${labels}</svg>`;
}

/** 기업 체력 한눈에 (G-148): the radar beside one short line per axis; the thresholds sit in each line's title. */
export function healthInfographic(m: MarketSection | undefined, close: number | null): string {
  if (!m) return '';
  const axes = healthAxes(m, close);
  if (axes.every((a) => a.score == null)) return '';
  const verdict = (s: number | null) => (s == null ? ['na', '자료 없음'] : s >= 67 ? ['good', '좋음'] : s >= 34 ? ['mid', '보통'] : ['warn', '주의']);
  return `<section class="card ig-card ig-hc"><div class="head"><h2>기업 체력 한눈에</h2></div>
<div class="ig-health">${radar(axes)}<ul class="ig-hl">${axes.map((a, i) => { const [cls, word] = verdict(a.score); return `<li title="${esc(a.note)}" data-i="${i}" tabindex="0"><b>${esc(a.label)}</b><span class="ig-v ${cls}">${word}</span><em>${esc(a.value)}</em></li>`; }).join('')}</ul></div>
<p class="fine">단순 기준으로 환산한 참고값이에요(영업이익률 20%·부채비율 0%면 만점). 같은 업종끼리 비교해 보세요.</p></section>`;
}

const ROWS: readonly [string, string][] = [['매출액', '억원'], ['영업이익', '억원'], ['당기순이익', '억원'], ['지배주주순이익', '억원'], ['영업이익률', '%'], ['순이익률', '%'], ['ROE', '%'], ['부채비율', '%'], ['당좌비율', '%'], ['유보율', '%'], ['EPS', '원'], ['BPS', '원'], ['주당배당금', '원']];

/** 재무제표 (요약): every headline line Naver gives, by year and by quarter, estimates marked. */
export type StKind = 'IS' | 'BS' | 'CF';
// Key rows first (by XBRL id, then by name); the rest of each statement folds under "전체 항목".
const KEY_ROWS: Record<StKind, readonly [string, RegExp, string?][]> = {
  IS: [['ifrs-full_Revenue', /^(매출액|수익\(매출액\)|영업수익|매출)$/], ['ifrs-full_CostOfSales', /^매출원가$/], ['ifrs-full_GrossProfit', /^매출총이익$/], ['dart_OperatingIncomeLoss', /^영업이익(\(손실\))?$/], ['ifrs-full_ProfitLossBeforeTax', /^법인세비용차감전/], ['ifrs-full_ProfitLoss', /^(당기순이익|당기순이익\(손실\))$/], ['ifrs-full_ProfitLossAttributableToOwnersOfParent', /지배기업.*소유주/], ['ifrs-full_BasicEarningsLossPerShare', /^기본주당/, '원']],
  BS: [['ifrs-full_CurrentAssets', /^유동자산$/], ['ifrs-full_CashAndCashEquivalents', /^현금및현금성자산$/], ['ifrs-full_NoncurrentAssets', /^비유동자산$/], ['ifrs-full_Assets', /^자산총계$/], ['ifrs-full_CurrentLiabilities', /^유동부채$/], ['ifrs-full_NoncurrentLiabilities', /^비유동부채$/], ['ifrs-full_Liabilities', /^부채총계$/], ['ifrs-full_EquityAttributableToOwnersOfParent', /^지배기업.*소유주.*지분$/], ['ifrs-full_Equity', /^자본총계$/]],
  CF: [['ifrs-full_CashFlowsFromUsedInOperatingActivities', /^영업활동.*현금흐름$/], ['ifrs-full_CashFlowsFromUsedInInvestingActivities', /^투자활동.*현금흐름$/], ['ifrs-full_PurchaseOfPropertyPlantAndEquipment', /^유형자산의\s*취득$/], ['ifrs-full_CashFlowsFromUsedInFinancingActivities', /^재무활동.*현금흐름$/], ['ifrs-full_DividendsPaidClassifiedAsFinancingActivities', /^배당금.*지급/], ['ifrs-full_IncreaseDecreaseInCashAndCashEquivalents', /^현금및현금성자산의.*(증가|감소)/]],
};
const findRow = (rows: readonly StatementRow[], id: string, re: RegExp) => rows.find((r) => r.id === id) ?? rows.find((r) => re.test(r.name.replace(/\s+/g, '')));
/** 억원 for tables; 조/억 for chart labels. */
const eok = (v: number) => Math.round(v / 1e8).toLocaleString('ko-KR');
const short = (v: number) => (Math.abs(v) >= 1e12 ? `${(v / 1e12).toFixed(Math.abs(v) >= 1e13 ? 0 : 1)}조` : `${Math.round(v / 1e8).toLocaleString('ko-KR')}억`);

/** Grouped bars per year (values may be negative); one colour per series. */
function bars(years: readonly string[], series: readonly { label: string; color: string; values: (number | null)[] }[]): string {
  const all = series.flatMap((x) => x.values).filter((v): v is number => v != null);
  if (!all.length) return '';
  const max = Math.max(0, ...all), min = Math.min(0, ...all), span = max - min || 1, W = 320, H = 150, top = 16, bottom = 22, h = H - top - bottom;
  const zero = top + (max / span) * h, gw = W / years.length, bw = Math.min(26, (gw - 16) / series.length);
  const rects = years.map((y, i) => series.map((x, j) => {
    const v = x.values[i]; if (v == null) return '';
    const x0 = i * gw + (gw - bw * series.length) / 2 + j * bw, y0 = v >= 0 ? zero - (v / span) * h : zero, hh = Math.max(1, Math.abs(v / span) * h);
    return `<rect${v < 0 ? ' class="neg"' : ''} data-g="${i}" style="--i:${i * series.length + j}" x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${(bw - 3).toFixed(1)}" height="${hh.toFixed(1)}" rx="2" fill="${x.color}"><title>${esc(y)} ${esc(x.label)} ${short(v)}원</title></rect>${j === 0 ? `<text x="${(x0 + (bw - 3) / 2).toFixed(1)}" y="${(v >= 0 ? y0 - 4 : y0 + hh + 11).toFixed(1)}" text-anchor="middle" class="ig-bl">${short(v)}</text>` : ''}`;
  }).join('') + `<text x="${(i * gw + gw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="ig-bx">${esc(y)}</text>`).join('');
  const tip = { y: years, s: series.map((x) => ({ l: x.label, c: x.color, v: x.values.map((v) => (v == null ? null : short(v) + '원')) })) };
  return `<figure class="ig-bars mo-bars" data-tip="${esc(JSON.stringify(tip))}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(series.map((x) => x.label).join('·'))} 연도별 막대"><line x1="0" x2="${W}" y1="${zero.toFixed(1)}" y2="${zero.toFixed(1)}" class="ig-b0"/>${rects}</svg><figcaption>${series.map((x) => `<span><i style="background:${x.color}"></i>${esc(x.label)}</span>`).join('')}</figcaption></figure>`;
}

/**
 * G-171: the quarters' 매출·영업이익 in the same grouped-bar infographic as 자세히 보기 (touch a quarter for its values).
 * Naver's quarter metrics are in 억원; an estimate quarter is marked E.
 */
export function quarterBars(quarters: readonly FinancePeriod[]): string {
  const ps = quarters.filter((q) => q.metrics['매출액'] != null).slice(-6);
  if (ps.length < 2) return '';
  const v = (k: string) => ps.map((q) => (q.metrics[k] == null ? null : q.metrics[k]! * 1e8));
  return bars(ps.map((q) => `${q.period.slice(2, 4)}.${q.period.slice(4)}${q.isEstimate ? 'E' : ''}`), [{ label: '매출', color: '#2e4268', values: v('매출액') }, { label: '영업이익', color: '#f04452', values: v('영업이익') }]);
}

/** The infographic of one DART statement (G-148: also the simple 재무제표 card's picture). */
export function statementChart(st: FullStatements, kind: StKind): string {
  const rows = st.statements[kind];
  if (!rows.length) return '';
  const val = (id: string, re: RegExp) => findRow(rows, id, re)?.values ?? st.years.map(() => null);
  let chart = '', note = '';
  if (kind === 'IS') {
    const rev = val('ifrs-full_Revenue', KEY_ROWS.IS[0]![1]), op = val('dart_OperatingIncomeLoss', KEY_ROWS.IS[3]![1]), net = val('ifrs-full_ProfitLoss', KEY_ROWS.IS[5]![1]);
    chart = bars(st.years, [{ label: '매출', color: '#2e4268', values: rev }, { label: '영업이익', color: '#f04452', values: op }, { label: '순이익', color: '#e9a23b', values: net }]);
    const last = st.years.length - 1, m = rev[last] && op[last] != null ? (op[last]! / rev[last]!) * 100 : null;
    if (m != null) note = `${esc(st.years[last]!)}년 영업이익률 <b>${m.toFixed(1)}%</b>`;
  } else if (kind === 'BS') {
    // A narrow part shows its amount only, a very narrow one nothing (the bar's label and the 부채비율 still say it).
    const seg = (word: string, v: number, w: number) => (w >= 36 ? `${word} ${short(v)}` : w >= 20 ? short(v) : '');
    const debt = val('ifrs-full_Liabilities', KEY_ROWS.BS[6]![1]), eq = val('ifrs-full_Equity', KEY_ROWS.BS[8]![1]);
    chart = `<div class="ig-bs">${st.years.map((y, i) => { const d = debt[i], e = eq[i]; if (d == null || e == null || d + e <= 0) return ''; const dp = (d / (d + e)) * 100; return `<div class="ig-bs-row" style="--i:${i}"><span>${esc(y)}</span><div class="ig-bs-bar" role="img" aria-label="${esc(y)} 부채 ${short(d)} 자본 ${short(e)}"><i class="d" style="width:${dp.toFixed(1)}%">${seg('부채', d, dp)}</i><i class="e" style="width:${(100 - dp).toFixed(1)}%">${seg('자본', e, 100 - dp)}</i></div><b class="${e > 0 && d / e > 2 ? 'down' : ''}">${e > 0 ? `부채비율 ${Math.round((d / e) * 100)}%` : '자본잠식'}</b></div>`; }).join('')}</div>`;
    note = '자산 = 부채 + 자본. 부채비율이 200%를 넘으면 빨간색이에요.';
  } else {
    const ocf = val(...(KEY_ROWS.CF[0]!.slice(0, 2) as [string, RegExp])), inv = val(...(KEY_ROWS.CF[1]!.slice(0, 2) as [string, RegExp])), fin = val(...(KEY_ROWS.CF[3]!.slice(0, 2) as [string, RegExp])), capex = val(...(KEY_ROWS.CF[2]!.slice(0, 2) as [string, RegExp]));
    const fcf = ocf.map((o, i) => (o == null || capex[i] == null ? null : o - Math.abs(capex[i]!)));
    chart = bars(st.years, [{ label: '영업', color: '#2e4268', values: ocf }, { label: '투자', color: '#8a96a8', values: inv }, { label: '재무', color: '#c9a227', values: fin }, ...(fcf.some((v) => v != null) ? [{ label: '잉여현금(FCF)', color: '#16a34a', values: fcf }] : [])]);
    note = '영업으로 번 현금에서 설비 투자(유형자산 취득)를 뺀 것이 잉여현금흐름(FCF)이에요.';
  }
  return `${chart}${note ? `<p class="ig-note">${note}</p>` : ''}`;
}

/** One DART statement: an infographic, the key rows, then every row folded. */
function statementPanel(st: FullStatements, kind: StKind): string {
  const rows = st.statements[kind];
  if (!rows.length) return '<p class="muted">DART에 이 표가 없어요.</p>';
  const keys = KEY_ROWS[kind].map(([id, re, unit]) => [findRow(rows, id, re), unit ?? '억원'] as const).filter((x): x is readonly [StatementRow, string] => !!x[0]);
  const head = `<thead><tr><th>항목</th>${st.years.map((y) => `<th class="num">${esc(y)}</th>`).join('')}</tr></thead>`;
  const tr = (r: StatementRow, unit = '억원', strong = false) => `<tr${strong ? ' class="ig-key"' : ''}><th scope="row">${esc(r.name)}${unit === '억원' ? '' : `<small>${unit}</small>`}</th>${r.values.map((v) => v == null ? '<td class="num muted">-</td>' : `<td class="num${v < 0 ? ' down' : ''}">${unit === '억원' ? eok(v) : Math.round(v).toLocaleString('ko-KR')}</td>`).join('')}</tr>`;
  const keyIds = new Set(keys.map(([r]) => r));
  const rest = rows.filter((r) => !keyIds.has(r));
  return `${statementChart(st, kind)}<div class="table-wrap ig-fs ig-dart"><table class="compact">${head}<tbody>${keys.map(([r, u]) => tr(r, u, true)).join('')}</tbody></table></div>${rest.length ? `<details class="ig-all"><summary>전체 ${rows.length}개 항목 보기</summary><div class="table-wrap ig-fs ig-dart"><table class="compact">${head}<tbody>${rows.map((r) => tr(r, /주당/.test(r.name) ? '원' : '억원', keyIds.has(r))).join('')}</tbody></table></div></details>` : ''}`;
}

export function statementsCard(m: MarketSection | undefined, st?: FullStatements): string {
  const years = m?.years.slice(-5) ?? [], quarters = m?.quarters.slice(-6) ?? [];
  if (!years.length && !quarters.length && !st) return '';
  const table = (ps: readonly FinancePeriod[], label: (p: FinancePeriod) => string) => {
    const rows = ROWS.filter(([k]) => ps.some((p) => p.metrics[k] != null));
    const cell = (v: number | null | undefined, unit: string) => (v == null ? '<td class="num muted">-</td>' : `<td class="num${v < 0 ? ' down' : ''}">${unit === '%' ? v.toFixed(1) : Math.round(v).toLocaleString('ko-KR')}</td>`);
    return `<div class="table-wrap ig-fs"><table class="compact"><thead><tr><th>항목</th>${ps.map((p) => `<th class="num">${label(p)}${p.isEstimate ? '<small>추정</small>' : ''}</th>`).join('')}</tr></thead><tbody>${rows.map(([k, unit]) => `<tr><th scope="row">${k}<small>${unit}</small></th>${ps.map((p) => cell(p.metrics[k], unit)).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const tabs: [string, string, string][] = [];
  if (years.length) tabs.push(['y', '연간 요약', table(years, (p) => p.period.slice(0, 4))]);
  if (quarters.length) tabs.push(['q', '분기 요약', table(quarters, (p) => `${p.period.slice(2, 4)}.${p.period.slice(4)}`)]);
  if (st) (['IS', 'BS', 'CF'] as const).forEach((k) => { if (st.statements[k].length) tabs.push([k.toLowerCase(), k === 'IS' ? '손익계산서' : k === 'BS' ? '재무상태표' : '현금흐름표', statementPanel(st, k)]); });
  const src = [years.length || quarters.length ? '요약: 네이버 증권(기업 실적 분석, IFRS 연결). 추정은 증권사 컨센서스예요.' : '', st ? `손익계산서·재무상태표·현금흐름표: DART ${esc(st.years[st.years.length - 1] ?? '')} 사업보고서(${st.basis === 'CFS' ? '연결' : '별도'}), 단위 억원. <a href="https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${encodeURIComponent(st.receiptNo)}" target="_blank" rel="noopener">원문 보기</a>` : '재무상태표·현금흐름표 전체는 DART 공시를 받은 종목부터 보여요.'].filter(Boolean).join(' ');
  return `<div class="card fs-full" id="statements">
<div class="seg ig-seg" role="tablist" aria-label="재무제표 종류">${tabs.map(([k, l], i) => `<button type="button" data-fs="${k}" aria-selected="${i === 0}">${l}</button>`).join('')}</div>
${tabs.map(([k, , html], i) => `<div data-fsl="${k}"${i ? ' hidden' : ''}>${html}</div>`).join('')}
<p class="fine">${src}</p></div>`;
}

export const INFOGRAPHIC_CSS = `.ig-card .head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.ig-card h2{font-size:17px;margin:0 0 6px}

.ig-k{font-size:12px;font-weight:800;color:var(--fg2);margin-bottom:8px}
.ig-bullish{background:#e5484d}.ig-neutral{background:#c4cbc9}.ig-bearish{background:#3e63dd}.ig-legend{display:flex;justify-content:space-between;gap:6px;font-size:12px;color:var(--muted);margin-top:6px}.ig-legend b{color:var(--fg)}


.ig-health{display:grid;grid-template-columns:200px minmax(0,1fr);gap:16px;align-items:center}.ig-hc{margin:0 0 14px}.ig-hl{list-style:none;margin:0;padding:0;max-width:560px;display:flex;flex-direction:column;gap:2px}.ig-hl li{display:grid;grid-template-columns:3.4em auto minmax(0,1fr);align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);font-size:14px}.ig-hl li:last-child{border-bottom:0}.ig-hl .ig-v{justify-self:start}.ig-hl em{font-style:normal;font-size:13px;color:var(--fg2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ig-radar{width:100%;max-width:260px;margin:0 auto;display:block}.ig-radar .grid{fill:none;stroke:#dfe5ee;stroke-width:1}.ig-radar .area{fill:rgba(19,41,75,.16);stroke:var(--navy,#13294b);stroke-width:2;stroke-linejoin:round}.ig-radar .dot{fill:var(--navy,#13294b)}.ig-radar text{font-size:12px;font-weight:700;fill:var(--fg2)}.ig-radar text.na{fill:#aab3c2}
.ig-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.ig-tile{background:#f6f8fc;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:3px;min-width:0}.ig-tile>div{display:flex;justify-content:space-between;align-items:center;gap:6px}.ig-tile strong{font-size:14px}.ig-tile small{font-size:11.5px;color:var(--muted)}.ig-v{font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px;line-height:1.5}.ig-v.good{background:#e6f4ea;color:#1d6b3a}.ig-v.mid{background:#eef1f5;color:var(--fg2)}.ig-v.warn{background:#fde8e8;color:#9b1c1c}.ig-v.na{background:#f1f3f6;color:#9aa4b2}
.ig-seg{margin:2px 0 10px;width:max-content}.ig-fs td.num,.ig-fs th.num{text-align:right;font-variant-numeric:tabular-nums}.ig-fs table{min-width:520px}.ig-fs th[scope=row]{position:sticky;left:0;background:#fff;white-space:nowrap;text-align:left;font-weight:700}.ig-fs th small,.ig-fs th[scope=row] small{display:block;font-size:10.5px;font-weight:500;color:var(--muted)}
.ig-seg.seg{max-width:100%;overflow-x:auto;flex-wrap:nowrap!important;scrollbar-width:none}.ig-dart table{min-width:0!important;width:100%}.ig-dart th[scope=row]{white-space:normal!important;min-width:84px}.ig-dart th,.ig-dart td{padding:8px 5px!important;font-size:13px}.ig-dart td.num{letter-spacing:-.2px}.ig-seg button{flex:none;white-space:nowrap}
.ig-bars{margin:4px 0 6px}.ig-bars svg{width:100%;max-width:520px;height:auto;display:block}.ig-bars .ig-b0{stroke:#b6c0cf;stroke-width:1}.ig-bl{font-size:10px;font-weight:700;fill:#4a5568}.ig-bx{font-size:11px;fill:#6b7686}.ig-bars figcaption{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12.5px;color:var(--fg2)}.ig-bars figcaption i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.ig-bs{display:flex;flex-direction:column;gap:8px;margin:4px 0 8px}.ig-bs-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;font-size:13px}.ig-bs-bar{display:flex;height:26px;border-radius:8px;overflow:hidden;background:#e9edf3}.ig-bs-bar i{display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11.5px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden}.ig-bs-bar .d{background:#d1676b}.ig-bs-bar .e{background:#2e4268}.ig-bs-row b{font-size:12.5px;white-space:nowrap}
.ig-note{font-size:13px;color:var(--fg2);margin:2px 0 8px}.ig-key th,.ig-key td{font-weight:700}.ig-all{margin-top:8px}.ig-all summary{cursor:pointer;font-weight:700;font-size:14px;color:var(--accent-strong);padding:8px 0}
.sub-sec{margin-top:28px;padding-top:18px;border-top:2px solid var(--line)}.sub-sec.sub-first{margin-top:4px;padding-top:0;border-top:0}.sub-sec>.sub-h{font-size:19px;margin:0 0 10px}
@media (max-width:820px){.ig-health{grid-template-columns:150px minmax(0,1fr);gap:10px}.ig-health .ig-radar{max-width:150px}.ig-health .ig-radar text{font-size:17px}.ig-hl li{grid-template-columns:auto 1fr;gap:1px 6px;padding:4px 0;font-size:13px}.ig-hl em{grid-column:1/-1;text-align:left;font-size:12px}}`;

/** Period switch of the 재무제표 card. */
export const INFOGRAPHIC_JS = `document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-fs]');if(!b)return;var c=b.closest('.card');c.querySelectorAll('[data-fs]').forEach(function(x){x.setAttribute('aria-selected',String(x===b));});c.querySelectorAll('[data-fsl]').forEach(function(x){x.hidden=x.getAttribute('data-fsl')!==b.getAttribute('data-fs');});});`;
