import {scenarioPlot, scenarioZone} from './scenarioChart.js';
export { scenarioZone };
// Scenario assumptions, supporting catalysts and invalidation conditions are distinct.
// Never infer a scenario trigger from unrelated support/resistance levels.

import type { DailyReport } from './dailyReport.js';
import { LOCKED_TEXT } from '../analysis/commentary.js';
import { esc } from './html.js';
import { won } from './format.js';

const gap = (to: number, from: number) => { const g = (to / from - 1) * 100; return `${g > 0 ? '+' : ''}${g.toFixed(1)}%`; };
const zone = (z?: [number, number]) => (z ? `${won(z[0])} ~ ${won(z[1])}` : '');

/** Legacy reports can state explicit upper/lower exits of the base scenario without a trigger field.
 * Keep that provenance; never treat a bull/bear invalidation or an analyst target as its entry. */
export function scenarioCondition(report: DailyReport, kind: 'BULL' | 'BEAR'): { price: number; source: 'trigger' | 'base-exit' } | undefined {
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  const s = c?.scenarios?.find(s => s.kind === kind);
  if (typeof s?.trigger === 'number' && Number.isFinite(s.trigger) && s.trigger > 0) return { price: s.trigger, source: 'trigger' };
  const base = c?.scenarios?.find(s => s.kind === 'BASE');
  if (!base || base.narrative.text === LOCKED_TEXT) return undefined;
  const pattern = kind === 'BULL' ? /([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*원\s*(?:위로\s*안착|상향\s*돌파)/g : /([0-9]+(?:,[0-9]{3})*(?:\.[0-9]+)?)\s*원\s*(?:아래로\s*(?:밀리|이탈|하락)|하향\s*이탈)/g;
  const prices = [...new Set((base.invalidation ?? []).filter(text => !/(?:못|않|아니)/.test(text)).flatMap(text => [...text.matchAll(pattern)].map(m => Number(m[1]!.replace(/,/g, '')))).filter(p => Number.isFinite(p) && p > 0))];
  return prices.length === 1 ? { price: prices[0]!, source: 'base-exit' } : undefined;
}

export function conclusionCard(report: DailyReport, opts: { title?: string; id?: string } = {}): string {
  const p = report.price;
  if (!p) return `<section class="block cl-card"${opts.id?` id="${opts.id}"`:''}><div class="card"><div class="cl-k">${esc(opts.title??'지금 판단')}</div><div class="v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><p>🔒 가격 자료와 시나리오가 아직 준비되지 않았어요.</p></div></div></section>`;
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  const sc = (k: 'BULL' | 'BASE' | 'BEAR') => c?.scenarios?.find((s) => s.kind === k);
  const bull = sc('BULL'), base = sc('BASE'), bear = sc('BEAR');
  const missing=![bull,base,bear].some(Boolean);
  const odds = (s: typeof bull) => (typeof s?.probability === 'number' ? `<b class="cl-p">${s.probability}%</b>` : '');
  const line = (c?.summary?.text ?? report.headline).split(/(?<=[.?!요])\s/)[0] ?? '';
  // G-70: the worst case belongs to the bear scenario: the far end of it, with the reader's own checks.
  const w = c?.worstCase && c.worstCase.narrative.text !== LOCKED_TEXT ? c.worstCase : undefined;
  const worst = w ? `<div class="cl-worst"><b>최악의 경우</b><p>${esc(w.narrative.text)}</p>${w.checks.length ? `<ul>${w.checks.map((x) => `<li>☐ ${esc(x)}</li>`).join('')}</ul>` : ''}<small>매수·매도 지시가 아니라 위험을 점검하는 목록이에요.</small></div>` : '';
  // Each row opens its scenario (G-69): what would happen, what would set it off, when it would be wrong.
  const detail = (sc: typeof bull, label: string) => {
    if (!sc) return missing?`<div class="cl-sc" hidden><div class="v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><div class="v2-mask-cta"><b>🔒 ${label} 시나리오 미생성</b><button type="button" class="chip-toggle" data-create-report data-symbol="${esc(report.symbol)}" data-name="${esc(report.name)}">리포트 생성</button></div></div></div>`:'';
    const locked = sc.narrative.text === LOCKED_TEXT;
    return `<div class="cl-sc" hidden>${locked ? `<div class="v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><div class="v2-mask-cta"><b>🔒 심층 시나리오</b><p>프로·맥스·알파 또는 개별 열기 권한으로 볼 수 있어요.</p><a href="#tab-ai">이용 권한 확인하기</a></div></div>` : `${scenarioPlot(report,sc.kind)}<div class="scenario-evidence"><b>조건·근거</b><p>${esc(sc.narrative.text)}</p>`}${!locked && sc.catalysts.length ? `<p class="cl-sc-k"><b>성립 근거·촉매</b> ${sc.catalysts.map(esc).join(', ')}</p>` : ''}${!locked && sc.invalidation.length ? `<p class="cl-sc-k"><b>무효화 조건 · 가정 재검토</b> ${sc.invalidation.map(esc).join(', ')}</p>` : ''}${!locked && sc.zone ? `<p class="cl-sc-k"><b>20거래일 예상 가격대</b> ${zone(sc.zone)}</p>` : ''}${sc.kind === 'BEAR' && worst ? worst : ''}${locked?'':'</div>'}</div>`;
  };
  const row = (cls: string, sc: typeof bull, label: string, px: string, what: string) => `<div class="cl-item"><button type="button" class="cl-row ${cls}"${sc||missing ? ' aria-expanded="false"' : ' disabled'}>${px}<div class="cl-what"><b>${label} 시나리오</b> ${odds(sc)}<small>${what}</small></div>${sc||missing ? '<span class="cl-more" aria-hidden="true">›</span>' : ''}</button>${detail(sc, label)}</div>`;
  // A crossing condition and a future range are different facts. Only the stored trigger supplies
  // the condition, with explicit base exits supported for legacy reports; targets and forecasts are separate.
  const px = (k: 'BULL' | 'BEAR', arrow: string) => {
    const conditionPrice = scenarioCondition(report, k);
    const z = scenarioZone(report, k);
    // Always a big number (G-100): the condition price when the committee gave one; else the far end of the 20-session
    // range on this scenario's side of today's close (a bull target below the close is skipped), else the volatility range.
    const up = k === 'BULL', onSide = (v: number) => (up ? v > p.close : v < p.close);
    const f20 = report.market?.forecasts?.find((f) => f.horizon === 20);
    const edge = z && onSide(up ? z.zone[1] : z.zone[0]) ? { v: up ? z.zone[1] : z.zone[0], src: z.source === 'analyst' ? 'AI 분석가 목표가' : z.source === 'calc' ? '변동성 계산' : 'AI 위원회 예상' }
      : f20 && onSide(up ? f20.p90 : f20.p10) ? { v: up ? f20.p90 : f20.p10, src: '변동성 계산' } : null;
    const condition = conditionPrice ? `<b>${won(conditionPrice.price)}</b><small>${up ? '이 가격을 넘으면 강세 전개 검토' : '이 가격 아래로 이탈하면 약세 전개 검토'}${conditionPrice.source === 'base-exit' ? ' · 기본 시나리오 이탈 조건' : ''}</small>`
      : edge ? `<b>${won(edge.v)}</b><small>${up ? '강세면 20거래일 안 상단' : '약세면 20거래일 안 하단'} · ${gap(edge.v, p.close)} · ${edge.src}</small>`
      : `<b>${up ? '강세' : '약세'} 조건</b><small>가격 자료가 아직 없어요</small>`;
    const range = z ? `<small class="cl-range">${z.source === 'analyst' ? 'AI 분석가 목표가 범위' : z.source === 'calc' ? '20거래일 변동성 참고 범위' : '20거래일 예상 범위'} ${zone(z.zone)}${z.source === 'ai' ? ` · 분석 종가 대비 ${gap((z.zone[0]+z.zone[1])/2,p.close)}` : ''}</small>` : '';
    return `<div class="cl-px"><span class="cl-arrow">${arrow}</span>${condition}${range}</div>`;
  };
  const rows = [
    row('cl-up', bull, '강세', px('BULL', '▲'), '성립 근거와 무효화 조건 함께 확인'),
    row('cl-now', base, '기본', `<div class="cl-px"><span class="cl-arrow">●</span><b data-live="${esc(report.symbol)}" data-live-f="price">${won(p.close)}</b><small>지금</small></div>`, '현재 근거에서 가장 그럴듯한 전개'),
    row('cl-down', bear, '약세', px('BEAR', '▼'), '성립 근거와 무효화 조건 함께 확인'),
  ].join('');
  const hasOdds = [bull, base, bear].some((s) => typeof s?.probability === 'number');
  const source = missing ? '시나리오 해석은 아직 생성되지 않았어요' : `조건 가격 도달만으로 전개가 확정되지는 않아요. 예상 범위와 조건 가격은 다릅니다. 분석 기준은 ${esc(report.date)} 종가 ${won(p.close)}이며, 현재 가격과 차이가 날 수 있어요`;
  return `<section class="block cl-card"${opts.id ? ` id="${opts.id}"` : ''}><div class="card"><div class="cl-k">${esc(opts.title ?? '결론')}</div><h2 class="cl-line">${esc(line)}</h2>
<div class="cl-ladder">${rows}</div>
<p class="fine">${bull || bear || base ? '줄을 누르면 시나리오가 펼쳐져요. ' : ''}${source}. ${hasOdds ? '확률은 지금 근거로 본 위원회의 추정이고, 기록해 두었다가 실제 결과로 채점해요.' : '확률은 AI 위원회 리포트가 나오면 붙어요.'} 투자 권유가 아니에요.</p></div></section>`;
}

export const CONCLUSION_CSS = `.cl-card .card{border:1.5px solid var(--navy)}.cl-k{font-size:12px;font-weight:800;color:var(--accent-strong);margin-bottom:4px}.cl-line{font-size:19px;line-height:1.5;margin:0 0 8px}.cl-tally{font-size:13px;color:var(--fg2);margin:0 0 14px}
.cl-ladder{position:relative;display:flex;flex-direction:column;gap:8px;padding-left:4px}.cl-ladder::before{content:'';position:absolute;left:15px;top:14px;bottom:14px;width:2px;background:linear-gradient(#d1373d,#7b8798,#2a62c9);opacity:.35}
.cl-item{display:flex;flex-direction:column}.cl-row{position:relative;display:grid;grid-template-columns:minmax(150px,auto) 1fr auto;gap:6px 16px;align-items:center;border-radius:14px;padding:12px 14px;border:0;font:inherit;color:inherit;text-align:left;width:100%;cursor:pointer}.cl-row:disabled{cursor:default}.cl-row:not(:disabled):hover{outline:2px solid rgba(15,34,68,.15)}.cl-more{font-size:20px;color:var(--muted);transition:transform .15s}.cl-row[aria-expanded=true] .cl-more{transform:rotate(90deg)}.cl-row[aria-expanded=true]{border-bottom-left-radius:0;border-bottom-right-radius:0}.cl-sc{position:relative;z-index:1;background:#fff;border:1px solid var(--line);border-top:0;border-radius:0 0 14px 14px;padding:10px 14px 4px;font-size:14px;line-height:1.6}.cl-sc p{margin:0 0 8px}.cl-sc-k{font-size:13px;color:var(--fg2)}.cl-worst{margin:4px 0 10px;background:#fff5f5;border:1px solid #f3c7c9;border-radius:10px;padding:9px 11px}.cl-worst>b{color:#9b1c1c;font-size:13px}.cl-worst p{margin:3px 0 6px}.cl-worst ul{list-style:none;padding:0;margin:0 0 4px;font-size:13px}.cl-worst li{margin:2px 0}.cl-worst small{color:var(--muted);font-size:11.5px}.cl-sc-k b{color:var(--fg);margin-right:4px}.cl-up{background:#fdf0f0}.cl-now{background:#f2f4f7}.cl-down{background:#eef3fc}
.cl-px{min-width:0;overflow-wrap:anywhere;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 6px}.cl-px small{flex-basis:100%;padding-left:24px}.cl-arrow{font-size:13px;width:18px;text-align:center}.cl-up .cl-arrow{color:#d1373d}.cl-down .cl-arrow{color:#2a62c9}.cl-now .cl-arrow{color:#475569}.cl-px b{font-size:17px}.cl-px small{font-size:12px;color:var(--muted)}
.cl-what{font-size:15px}.cl-what small{display:block;font-size:12px;color:var(--muted);margin-top:2px}.cl-p{font-size:18px;margin-left:4px}.cl-up .cl-p{color:#c4262e}.cl-down .cl-p{color:#1f55b8}
.vt-sum{display:flex;gap:14px;flex-wrap:wrap;font-size:15px}.vt-bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;margin:8px 0 12px}.vt-bar .s-bull{background:#d1373d}.vt-bar .s-neutral{background:#c4cbc9}.vt-bar .s-bear{background:#2a62c9}.vt-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}.vt-m{border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}.vt-who{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.vt-who b{font-size:14px}.vt-s{font-size:12px;font-weight:700;white-space:nowrap}.vt-m p{margin:4px 0 0;font-size:13.5px;line-height:1.55;color:var(--fg2);overflow-wrap:anywhere}
@media (max-width:820px){.cl-row{grid-template-columns:1fr auto}.cl-row .cl-px{grid-column:1}.cl-row .cl-what{grid-column:1}.cl-row .cl-more{grid-column:2;grid-row:1/3}.cl-line{font-size:17px}}`;

/** Opens a conclusion row's scenario. */
export const CONCLUSION_JS = `
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.cl-row[aria-expanded]'); if (!b) return;
    var open = b.getAttribute('aria-expanded') !== 'true', d = b.nextElementSibling;
    b.setAttribute('aria-expanded', String(open)); if (d) d.hidden = !open;
  });`;

/**
 * G-76: each view seats its own committee: the members its question needs (단타: 기술·수급·추세·평균회귀·
 * 거래량, 장기: 실적·이벤트·시장…). Only they show in the vote and the debate; the others wait behind
 * '다른 위원도 보기'. The red team always speaks. '전체' shows everyone.
 */
export const VIEW_FOCUS: Record<string, readonly string[]> = {
  beginner: ['MARKET', 'TECHNICAL', 'FUNDAMENTAL', 'EVENT'],
  trader: ['TECHNICAL', 'FLOW', 'trend_momentum', 'mean_reversion', 'volume_flow'],
  swing: ['TECHNICAL', 'MARKET', 'wave_structure', 'trend_momentum', 'volume_flow'],
  long: ['FUNDAMENTAL', 'EVENT', 'fundamental', 'event_catalyst', 'MARKET'],
};
const VIEW_LABEL: Record<string, string> = { beginner: '초보', trader: '단타', swing: '스윙', long: '장기' };
export const VIEW_FOCUS_CSS = `.vt-help{font-size:13px;color:var(--fg2);background:#f5f8fd;border-radius:10px;padding:8px 11px;margin:0 0 10px}.vt-more{display:none;margin:10px auto 0;border:1px dashed var(--line-strong);background:#fff;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:700;color:var(--accent-strong);cursor:pointer}
.pc-only-beginner{display:none}html[data-persona=beginner] .pc-only-beginner{display:block}html[data-persona=all] .pc-not-all{display:none}.vt-tally{display:none}html:not([data-persona]) .vt-t-all,html[data-persona=all] .vt-t-all,.vt.show-all-members .vt-t-all{display:block}.vt.show-all-members .vt-tally:not(.vt-t-all){display:none!important}${Object.keys(VIEW_FOCUS).map((v) => `html[data-persona=${v}] .vt-t-${v}`).join(',')}{display:block}.pl-view{display:none;font-size:13px;font-weight:700;color:var(--accent-strong);margin:2px 0 6px}.vt-seat{display:none;font-size:13px;font-weight:700;color:var(--accent-strong);margin:0 0 8px}
${Object.entries(VIEW_FOCUS).map(([v, ids]) => {
    const not = ids.map((id) => `[data-member=${id}]`).join(',');
    const seatsOn = ids.map((id) => `[data-m=${id}]`).join(',');
    return `html[data-persona=${v}] #parliament-ai .seat:not(${seatsOn}){opacity:.25}html[data-persona=${v}] #parliament-ai .pl-view-${v}{display:block}html[data-persona=${v}] .vt-seat-${v}{display:block}html[data-persona=${v}] .vt:not(.show-all-members) .vt-m:not(${not}){display:none}html[data-persona=${v}] .vt:not(.show-all-members) .vt-more{display:block}
`;
  }).join('\n')}`;

export const SEATS_JS = `
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.vt-more, .db-more'); if (!b) return;
    var box = b.closest('.vt, .debate'); box.classList.add('show-all-members'); b.remove();
  });`;

/** The parliament's line for the reader's view committee (G-85): which seats are lit, and why. */
export const parliamentViewNote = (report: DailyReport): string => {
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  const members = [...(c?.analysts ?? []).map((a) => a.analyst as string), ...(c?.desks ?? []).map((d) => d.desk as string)];
  if (!members.length) return '';
  return Object.entries(VIEW_FOCUS).map(([v, ids]) => `<p class="pl-view pl-view-${v}">${VIEW_LABEL[v]} 위원회 ${members.filter((m) => ids.includes(m)).length}명을 진하게 표시했어요 · 좌석을 누르면 그 위원의 판단과 근거가 나와요</p>`).join('');
};

/** The two test prices (G-65): the scenarios' triggers, else the nearest structure levels around the close. */
export function testPrices(report: DailyReport): { up?: number; dn?: number } {
  const p = report.price; if (!p) return {};
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined, lv = report.market?.structure?.levels ?? [];
  const up = c?.scenarios?.find((s) => s.kind === 'BULL')?.trigger ?? lv.filter((l) => l.price > p.close).sort((a, b) => a.price - b.price)[0]?.price;
  const dn = c?.scenarios?.find((s) => s.kind === 'BEAR')?.trigger ?? lv.filter((l) => l.price < p.close).sort((a, b) => b.price - a.price)[0]?.price;
  return { ...(up !== undefined ? { up } : {}), ...(dn !== undefined ? { dn } : {}) };
}

/** G-85: what the watchlist shows per covered stock: the test prices and what is new since the last report. */
export function watchInfo(entries: readonly { symbol: string; report: DailyReport | null }[]): Record<string, { c: number; up?: number; dn?: number; f: number; n: number; d: string }> {
  const out: Record<string, { c: number; up?: number; dn?: number; f: number; n: number; d: string }> = {};
  for (const e of entries) {
    const r = e.report; if (!r?.price) continue;
    const since = new Date(Date.parse(r.date) - 3 * 86_400_000).toISOString().slice(0, 10);
    out[e.symbol] = { c: r.price.close, ...testPrices(r), f: (r.recentFilings ?? []).filter((x) => x.filedDate >= since).length, n: r.news?.newIds.length ?? 0, d: r.date };
  }
  return out;
}
