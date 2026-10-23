import {checkLine, scenarioCheck, scenarioZone} from './scenarioChart.js';
export { scenarioZone };
// Scenario assumptions, supporting catalysts and invalidation conditions are distinct.
// Never infer a scenario trigger from unrelated support/resistance levels.

import type { DailyReport } from './dailyReport.js';
import { LOCKED_TEXT } from '../analysis/commentary.js';
import { esc } from './html.js';
import { won } from './format.js';
import { CREDIT_COST } from './plans.js';
import { reportButton } from './generateButton.js';

const gap = (to: number, from: number) => { const g = (to / from - 1) * 100; return `${g > 0 ? '+' : ''}${g.toFixed(1)}%`; };
/** 2026-10-05 → 10월 5일: the committee's line is dated so an older report never reads as today's (G-277). */
const dayOf = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
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

/** G-165: the committee's odds as one bar, or '' when no scenario carries a probability. */
function oddsBarOf(c: { scenarios?: readonly { kind: string; probability?: number }[] } | undefined): string {
  const pr = (['BULL', 'BASE', 'BEAR'] as const).map((k) => { const v = c?.scenarios?.find((s) => s.kind === k)?.probability; return typeof v === 'number' ? v : 0; });
  if (!pr.some((v) => v > 0)) return '';
  return `<div class="cl-odds"><div class="cl-odds-k">시나리오 확률</div><div class="sc-prob" role="img" aria-label="시나리오 확률 ${(['강세', '기본', '약세'] as const).map((n, i) => (pr[i]! > 0 ? `${n} ${pr[i]}%` : '')).filter(Boolean).join(' ')}">${(['bull', 'base', 'bear'] as const).map((k, i) => (pr[i]! > 0 ? `<span class="sp-${k}" style="flex:${pr[i]}">${pr[i]}%</span>` : '')).join('')}</div><div class="cl-odds-l"><span class="up">강세 ${pr[0]}%</span><span>기본 ${pr[1]}%</span><span class="down">약세 ${pr[2]}%</span></div></div>`;
}

/** The AI tab's short conclusion (G-166): the committee's one line and its odds; the scenarios themselves stay in 요약 (G-163). */
export function conclusionMini(report: DailyReport): string {
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  const line = (c?.summary?.text ?? report.headline ?? '').split(/(?<=[.?!요])\s/)[0] ?? '';
  return `<section class="block" id="conclusion"><div class="card cl-mini"><div class="head"><h2>결론</h2></div>${line ? `<p>${esc(line)}</p>` : '<p class="muted">아직 위원회 결론이 없어요.</p>'}${oddsBarOf(c)}<a class="cl-go" href="#tab-home">요약 탭에서 시나리오 자세히 보기 ›</a></div></section>`;
}

/**
 * G-277 (한서님 10/21, Uniswap-style price map; was G-249's ruled strip): the last 50 closes as a line that draws in, then
 * to the right of today the three 20-session ranges as vertical bars, 약세 · 기본 · 강세 from left to right. The high and low of
 * the window carry arrows with how today compares to them and the date; the nearest support and resistance sit below as chips.
 * Empty when there is no price or no range.
 */
export function scenarioRail(report: DailyReport): string {
  const p = report.price; if (!p) return '';
  const z = { BEAR: scenarioZone(report, 'BEAR'), BASE: scenarioZone(report, 'BASE'), BULL: scenarioZone(report, 'BULL') };
  const ks = (['BEAR', 'BASE', 'BULL'] as const).filter((k) => z[k]);
  if (!ks.length) return '';
  const hist = (report.recentCloses ?? []).slice(-50);
  const closes = hist.length ? hist : [{ date: p.sessionDate ?? report.date, close: p.close }];
  const all = [...closes.map((c) => c.close), ...ks.flatMap((k) => z[k]!.zone), p.close];
  let lo = Math.min(...all), hi = Math.max(...all);
  const pad = (hi - lo) * 0.08 || p.close * 0.03; lo -= pad; hi += pad;
  const W = 340, H = 210, top = 22, bot = 22, xEnd = 200, y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bot);
  const x = (i: number) => (closes.length < 2 ? xEnd : 8 + (i / (closes.length - 1)) * (xEnd - 8));
  const f1 = (v: number) => v.toFixed(1);
  const d = closes.map((c, i) => `${i ? 'L' : 'M'}${f1(x(i))},${f1(y(c.close))}`).join('');
  const area = closes.length > 1 ? `<path class="pm-area" d="${d}L${f1(x(closes.length - 1))},${H - bot}L${f1(x(0))},${H - bot}Z"/>` : '';
  const md = (s: string) => `${Number(s.slice(5, 7))}.${s.slice(8, 10)}`;
  const iHi = closes.reduce((m, c, i) => (c.close > closes[m]!.close ? i : m), 0), iLo = closes.reduce((m, c, i) => (c.close < closes[m]!.close ? i : m), 0);
  const pct = (v: number) => { const g = (p.close / v - 1) * 100; return `${g > 0 ? '+' : ''}${g.toFixed(1)}%`; };
  const mark = (i: number, up: boolean) => {
    const c = closes[i]!, cx = x(i), cy = y(c.close), ty = up ? cy - 9 : cy + 15, anchor = cx < 60 ? 'start' : cx > xEnd - 60 ? 'end' : 'middle';
    return `<path class="pm-arw" d="M${f1(cx)},${f1(up ? cy - 3 : cy + 3)}l-3,${up ? -4 : 4}h6z"/><text class="pm-ext ${up ? 'up' : 'down'}" x="${f1(cx)}" y="${f1(ty)}" text-anchor="${anchor}">${up ? '최고' : '최저'} ${won(c.close)} (${pct(c.close)}, ${md(c.date)})</text>`;
  };
  const marks = closes.length > 4 && iHi !== iLo ? mark(iHi, true) + mark(iLo, false) : '';
  const name = { BEAR: '약세', BASE: '기본', BULL: '강세' } as const, cls = { BEAR: 'r-bear', BASE: 'r-base', BULL: 'r-bull' } as const;
  const bars = ks.map((k, i) => {
    const r = z[k]!.zone, bx = 230 + i * 38, y1 = y(r[1]), h = Math.max(8, y(r[0]) - y1);
    return `<rect class="${cls[k]}" x="${bx}" y="${f1(y1)}" width="24" height="${f1(h)}" rx="6" data-pm-k="${k}" data-pm-z="${esc(zone(r))}"/><text class="pm-k" x="${bx + 12}" y="${H - 6}" text-anchor="middle">${name[k]}</text>`;
  }).join('');
  const ny = y(p.close);
  const label = ks.map((k) => `${name[k]} ${zone(z[k]!.zone)}`).join(', ');
  const lv = report.market?.structure?.levels ?? [];
  const sup = lv.filter((l) => l.kind === 'SUPPORT' && l.price < p.close).sort((a, b) => b.price - a.price)[0];
  const res = lv.filter((l) => l.kind === 'RESISTANCE' && l.price > p.close).sort((a, b) => a.price - b.price)[0];
  // G-287 (한서님 10/23 '실시간 가격을 저기다가 합쳐'): 지금 is the live price; the chips' gaps follow it (CONCLUSION_JS).
  const live = `data-live="${esc(report.symbol)}" data-live-f="price"`;
  const chips = `<div class="pm-chips" data-no-roll><span class="pm-nowc">지금 <b ${live}>${won(p.close)}</b></span>${res ? `<span>저항 <b>${won(Math.round(res.price))}</b> <small data-pm-at="${Math.round(res.price)}">${pct(res.price)}</small></span>` : ''}${sup ? `<span>지지 <b>${won(Math.round(sup.price))}</b> <small data-pm-at="${Math.round(sup.price)}">${pct(sup.price)}</small></span>` : ''}</div>`;
  const lx = f1(x(closes.length - 1)), ly = f1(y(closes.at(-1)!.close));
  return `<div class="cl-rail pm km-anim" data-pm-sym="${esc(report.symbol)}" data-pm-y="${f1(lo)},${f1(hi)},${top},${H - bot}"><div class="pm-h"><b>앞으로 20거래일, 가격은 어디쯤</b><small>왼쪽은 지난 ${closes.length}거래일, 오른쪽 막대는 시나리오별 범위예요</small></div><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="시나리오 범위: ${esc(label)}. 지금 ${won(p.close)}">${area}<path class="pm-line" pathLength="1" d="${d}"/>${marks}<line class="cl-rail-now" x1="0" x2="${W}" y1="${f1(ny)}" y2="${f1(ny)}"/><line class="pm-live-seg" x1="${lx}" y1="${ly}" x2="${lx}" y2="${ly}" hidden/><circle class="pm-dot" cx="${lx}" cy="${ly}" r="3.5"/><circle class="pm-live" cx="214" cy="${f1(ny)}" r="4.5" hidden/><rect class="pm-band" x="0" y="0" width="0" height="0" hidden/><text class="pm-band-t" x="6" y="0" hidden></text>${bars}</svg>${chips}</div>`;
}

/** G-277: the odds as three columns, 약세 · 기본 · 강세 left to right, each with its range under it. */
function oddsGrid(report: DailyReport): string {
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  const ks = ['BEAR', 'BASE', 'BULL'] as const, name = { BEAR: '약세', BASE: '기본', BULL: '강세' } as const;
  const pr = ks.map((k) => c?.scenarios?.find((s) => s.kind === k)?.probability);
  if (!pr.some((v) => typeof v === 'number')) return '';
  const top = Math.max(...pr.map((v) => v ?? 0));
  // G-287 (한서님 10/23 '큰 칸 말고 작은 칸으로'): three small pills under the chart; the range shows on the chart when picked.
  return `<div class="pm-odds" role="group" aria-label="시나리오 확률, 누르면 차트에 설명이 나와요"><div class="pm-grid">${ks.map((k, i) => { const v = pr[i]; return `<button type="button" class="pm-cell ${k.toLowerCase()}${v === top ? ' top' : ''}" data-pm="${k}" aria-pressed="false"><span>${name[k]}</span><b>${typeof v === 'number' ? `${v}%` : '—'}</b></button>`; }).join('')}</div></div>`;
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
    if (!sc) return missing?`<div class="cl-sc" hidden><div class="v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><div class="v2-mask-cta"><b>🔒 ${label} 시나리오가 아직 없어요</b>${reportButton(report.symbol, report.name)}</div></div></div>`:'';
    const locked = sc.narrative.text === LOCKED_TEXT;
    return `<div class="cl-sc" hidden>${locked ? `<div class="v2-mask"><div class="v2-mask-shapes" aria-hidden="true"><i></i><i></i><i></i></div><div class="v2-mask-cta"><b>🔒 심층 시나리오</b><p>시나리오 전개·근거·무효화 조건은 심층 리포트에 있어요.</p><button type="button" class="btn-primary dl-go" data-deep-go>심층 리포트 열기</button></div></div>` : `<div class="scenario-evidence"><b>조건·근거</b><p>${esc(sc.narrative.text)}</p>`}${!locked && sc.catalysts.length ? `<p class="cl-sc-k"><b>성립 근거·촉매</b> ${sc.catalysts.map(esc).join(', ')}</p>` : ''}${!locked && sc.invalidation.length ? `<p class="cl-sc-k"><b>무효화 조건 · 가정 재검토</b> ${sc.invalidation.map(esc).join(', ')}</p>` : ''}${!locked && sc.zone ? `<p class="cl-sc-k"><b>20거래일 예상 가격대</b> ${zone(sc.zone)}</p>` : ''}${sc.kind === 'BEAR' && worst ? worst : ''}${locked?'':'</div>'}</div>`;
  };
  const row = (cls: string, sc: typeof bull, label: string, px: string, what: string, arrow: string) => `<div class="cl-item"><button type="button" class="cl-row ${cls}"${sc||missing ? ' aria-expanded="false"' : ' disabled'}><span class="cl-ic" aria-hidden="true">${arrow}</span><div class="cl-what"><b>${label} 시나리오</b> ${odds(sc)}<small>${what}</small></div>${px}${sc||missing ? '<span class="cl-more" aria-hidden="true">›</span>' : ''}</button>${detail(sc, label)}</div>`;
  // A crossing condition and a future range are different facts. Only the stored trigger supplies
  // the condition, with explicit base exits supported for legacy reports; targets and forecasts are separate.
  const px = (k: 'BULL' | 'BEAR') => {
    const conditionPrice = scenarioCondition(report, k);
    const z = scenarioZone(report, k);
    // Always a big number (G-100): the condition price when the committee gave one; else the far end of the 20-session
    // range on this scenario's side of today's close (a bull target below the close is skipped), else the volatility range.
    const up = k === 'BULL', onSide = (v: number) => (up ? v > p.close : v < p.close);
    const f20 = report.market?.forecasts?.find((f) => f.horizon === 20);
    const edge = z && onSide(up ? z.zone[1] : z.zone[0]) ? { v: up ? z.zone[1] : z.zone[0], fromZone: true, src: z.source === 'analyst' ? 'AI 분석가 목표가' : z.source === 'calc' ? '변동성 계산' : 'AI 위원회 예상' }
      : f20 && onSide(up ? f20.p90 : f20.p10) ? { v: up ? f20.p90 : f20.p10, fromZone: false, src: '변동성 계산' } : null;
    const condition = conditionPrice ? `<b>${won(conditionPrice.price)}</b><small>${up ? '이 가격을 넘으면 강세 전개 검토' : '이 가격 아래로 이탈하면 약세 전개 검토'}${conditionPrice.source === 'base-exit' ? ' · 기본 시나리오 이탈 조건' : ''}</small>`
      : edge ? `<b>${won(edge.v)}</b><small>${up ? '강세면 20거래일 안 상단' : '약세면 20거래일 안 하단'} · ${gap(edge.v, p.close)}${edge.fromZone ? '' : ` · ${edge.src}`}</small>`
      : `<b>${up ? '강세' : '약세'} 조건</b><small>가격 자료가 아직 없어요</small>`;
    const range = z ? `<small class="cl-range">${z.source === 'analyst' ? 'AI 분석가 목표가 범위' : z.source === 'calc' ? '20거래일 변동성 참고 범위' : '20거래일 예상 범위'} ${zone(z.zone)}${z.source === 'ai' ? ` · 분석 종가 대비 ${gap((z.zone[0]+z.zone[1])/2,p.close)}` : ''}</small>` : '';
    return `<div class="cl-px">${condition}${range}</div>`;
  };
  // G-173: once prices exist after the AI's date, each row says how its range fared and the card says which one played out.
  const checks = { BULL: scenarioCheck(report, 'BULL'), BASE: scenarioCheck(report, 'BASE'), BEAR: scenarioCheck(report, 'BEAR') };
  const anyCheck = checks.BULL ?? checks.BASE ?? checks.BEAR;
  const playing = (['BULL', 'BASE', 'BEAR'] as const).find((k) => checks[k]?.now === 'in');
  const why = (k: 'BULL' | 'BASE' | 'BEAR') => { const s = sc(k); return s && s.narrative.text !== LOCKED_TEXT && s.catalysts[0] ? ` 위원회가 본 근거: ${esc(s.catalysts[0])}.` : ''; };
  const verdict = anyCheck ? `<div class="cl-check"><b>📅 ${esc(anyCheck.since.slice(5).replace('-', '/'))} 리포트 이후 ${anyCheck.sessions}거래일</b><p>${playing ? `지금 가격은 <b>${({ BULL: '강세', BASE: '기본', BEAR: '약세' })[playing]} 시나리오</b> 범위 안이에요${typeof sc(playing)?.probability === 'number' ? ` — 위원회가 ${sc(playing)!.probability}%로 본 시나리오예요` : ''}.${why(playing)}` : '지금 가격은 세 시나리오 범위 어디에도 있지 않아요. 아래에서 각 범위까지 남은 거리를 볼 수 있어요.'}</p></div>` : '';
  const baseZone = scenarioZone(report, 'BASE');
  const rows = [
    row('cl-up', bull, '강세', px('BULL'), checks.BULL ? checkLine(checks.BULL, '강세') : '성립 근거와 무효화 조건 함께 확인', '▲'),
    // G-287: the live price lives in the map above; the 기본 row shows its range like the other two.
    row('cl-now', base, '기본', baseZone ? `<div class="cl-px"><b>${zone(baseZone.zone)}</b><small>20거래일 예상 범위</small></div>` : '', checks.BASE ? checkLine(checks.BASE, '기본') : '현재 근거에서 가장 그럴듯한 전개', '●'),
    row('cl-down', bear, '약세', px('BEAR'), checks.BEAR ? checkLine(checks.BEAR, '약세') : '성립 근거와 무효화 조건 함께 확인', '▼'),
  ].join('');
  const hasOdds = [bull, base, bear].some((s) => typeof s?.probability === 'number');
  // G-277: with odds, the three rows wait under the 확률 cells; a tap on a cell opens its row.
  const grid = oddsGrid(report);
  // G-287 (한서님 10/23 '밑에 설명을 위 차트에서 보여주게 … 저렇게 여는거 말고'): with the 확률 cells, a tap shows the
  // scenario's explanation inside the price map, right under the chart, instead of opening a row further down.
  const note = (k: 'BULL' | 'BASE' | 'BEAR') => {
    const s = sc(k); if (!s) return '';
    const nm = ({ BULL: '강세', BASE: '기본', BEAR: '약세' } as const)[k]; // 확률 is on the pill, the range on the chart's band
    const cond = k === 'BASE' ? undefined : scenarioCondition(report, k);
    const locked = s.narrative.text === LOCKED_TEXT;
    const body = locked
      ? `<p class="pm-lock">🔒 전개·근거·무효화 조건은 심층 리포트에 있어요. <button type="button" class="pm-lock-go" data-deep-go>열기</button></p>`
      : `<p>${esc(s.narrative.text)}</p>${s.catalysts.length ? `<p class="pm-nk"><b>근거</b> ${s.catalysts.map(esc).join(', ')}</p>` : ''}${s.invalidation.length ? `<p class="pm-nk"><b>틀릴 조건</b> ${s.invalidation.map(esc).join(', ')}</p>` : ''}`;
    return `<div class="pm-note ${k.toLowerCase()}" data-pm-note="${k}" hidden><div class="pm-nh"><b>${nm} 시나리오</b></div>${cond ? `<p class="pm-cond">${k === 'BULL' ? `${won(cond.price)} 위로 올라서면 강세 전개` : `${won(cond.price)} 아래로 내려가면 약세 전개`}</p>` : ''}${checks[k] ? `<p class="pm-nk">${checkLine(checks[k]!, nm)}</p>` : ''}${body}${k === 'BEAR' && worst && !locked ? worst : ''}</div>`;
  };
  const notes = grid ? (['BEAR', 'BASE', 'BULL'] as const).map(note).join('') : '';
  const rail0 = scenarioRail(report), rail = rail0 ? rail0.replace('</svg>', '</svg>' + grid + notes) : grid;
  const source = missing ? '시나리오 해석은 아직 생성되지 않았어요' : `조건 가격 도달만으로 전개가 확정되지는 않아요. 예상 범위와 조건 가격은 다릅니다. 분석 기준은 ${esc(report.date)} 종가 ${won(p.close)}이며, 현재 가격과 차이가 날 수 있어요`;
  return `<section class="block cl-card"${opts.id ? ` id="${opts.id}"` : ''}><div class="card"><div class="cl-k">${esc(opts.title ?? '결론')} · ${esc(dayOf(report.date))} 마감 기준</div><h2 class="cl-line">${esc(line)}</h2>${rail}
${verdict}<div class="cl-ladder"${grid ? ' hidden' : ''}>${rows}</div>
${[bull, base, bear].some((x) => x?.narrative.text === LOCKED_TEXT) ? `<div class="cl-deep"><span>🔒 시나리오 전개·무효화 조건·최악의 경우·위원회 토론은 심층 리포트에 있어요.</span><button type="button" class="btn-primary" data-deep-go>심층 리포트 열기 <small>${CREDIT_COST.unlock}크레딧</small></button></div>` : ''}
<p class="fine">${bull || bear || base ? '줄을 누르면 시나리오가 펼쳐져요. ' : ''}${source}. ${hasOdds ? '확률은 지금 근거로 본 위원회의 추정이고, 기록해 두었다가 실제 결과로 채점해요.' : '확률은 AI 위원회 리포트가 나오면 붙어요.'} 투자 권유가 아니에요.</p></div></section>`;
}

export const CONCLUSION_CSS = `.pm{margin:10px 0 16px}.pm-h b{display:block;font-size:16px;font-weight:700}.pm-h small{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}
.pm svg{display:block;width:100%;height:auto;margin-top:8px;overflow:visible}
.pm-line{fill:none;stroke:var(--fg);stroke-width:1.8;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:0}
html.mo .pm:not(.km-in) .pm-line{stroke-dashoffset:1}html.mo .pm.km-in .pm-line{transition:stroke-dashoffset 1.1s cubic-bezier(.3,.7,.2,1)}
.pm-area{fill:var(--fg);opacity:.05}
.pm rect{transform-box:fill-box;transform-origin:50% 50%}html.mo .pm:not(.km-in) rect{transform:scaleY(.05);opacity:0}html.mo .pm.km-in rect{transition:transform .6s cubic-bezier(.34,1.3,.64,1) .7s,opacity .3s .7s}
.pm .r-bear{fill:var(--down)}.pm .r-base{fill:var(--fg2);opacity:.45}.pm-dot{fill:var(--fg);stroke:var(--surface-solid);stroke-width:2}.pm-chips .pm-nowc{background:var(--fg);color:var(--page)}.pm-chips .pm-nowc b{color:var(--page)}.pm .r-bull{fill:var(--up)}
.pm .cl-rail-now{stroke:var(--fg2);stroke-width:1;stroke-dasharray:3 3}.pm-note{margin:10px 0 2px;padding:12px 14px;border-radius:16px;background:var(--soft);font-size:14px;line-height:1.6}.pm-note p{margin:6px 0 0;color:var(--fg2)}.pm-nh{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.pm-nh b{font-size:15px}.pm-note.bull .pm-nh b{color:var(--up)}.pm-note.bear .pm-nh b{color:var(--down)}.pm-nh span{font-size:13px;font-weight:600;color:var(--fg);font-variant-numeric:tabular-nums}.pm-cond{font-weight:600;color:var(--fg)!important}.pm-nk{font-size:13px}.pm-nk b{color:var(--fg);margin-right:4px}.pm-lock{font-size:13px}.pm-lock-go{border:0;background:var(--fg);color:var(--page);border-radius:999px;padding:3px 12px;font:inherit;font-weight:700;font-size:12.5px;margin-left:4px;cursor:pointer}
.pm .pm-band{opacity:.13}.pm.pm-picked .pm-ext,.pm.pm-picked .pm-arw{opacity:0}.pm .pm-ext,.pm .pm-arw{transition:opacity .2s}.pm-band.r-base{fill:var(--fg2)}.pm-band.r-bear{fill:var(--down)}.pm-band.r-bull{fill:var(--up)}.pm-band-t{font-size:11px;font-weight:700;fill:var(--fg)}.pm.pm-picked rect[data-pm-k]:not(.on){opacity:.25}.pm rect[data-pm-k]{transition:opacity .25s}.pm-live{fill:var(--fg);stroke:var(--surface-solid);stroke-width:2}.pm-live-seg{stroke:var(--fg);stroke-width:1.5;stroke-dasharray:2 3}.pm-now{font-size:10.5px;font-weight:700;fill:var(--fg2)}
.pm-k{font-size:11px;font-weight:700;fill:var(--muted)}.pm-arw{fill:var(--muted)}
.pm-ext{font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums}.pm-ext.up{fill:var(--up)}.pm-ext.down{fill:var(--down)}
.pm-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.pm-chips span{display:inline-flex;gap:5px;align-items:baseline;padding:6px 12px;border-radius:999px;background:var(--soft);font-size:12.5px;color:var(--fg2)}.pm-chips b{color:var(--fg);font-variant-numeric:tabular-nums}.pm-chips small{color:var(--muted)}
.pm-odds{margin:4px 0 16px}.pm-odds-k{font-size:13px;font-weight:700;color:var(--fg2);margin-bottom:8px}.pm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.pm-cell{padding:12px 12px 10px;border:0;border-radius:16px;background:var(--soft);min-width:0;font:inherit;color:inherit;text-align:left;cursor:pointer;transition:transform .15s}.pm-cell:active{transform:scale(.97)}.pm-cell[aria-pressed=true]{background:var(--surface-solid);box-shadow:inset 0 0 0 2px var(--fg)}.pm-odds-k small{font-weight:500;color:var(--muted);margin-left:4px}.cl-ladder[hidden],.cl-item[hidden]{display:none!important}.pm-cell span{display:block;font-size:12.5px;font-weight:700;color:var(--fg2)}.pm-cell b{display:block;font-size:24px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin-top:2px}
.pm-cell small{display:block;font-size:11px;line-height:1.35;color:var(--muted);margin-top:2px;font-variant-numeric:tabular-nums}.pm-cell.bear b{color:var(--down)}.pm-cell.bull b{color:var(--up)}.pm-cell.top{box-shadow:inset 0 0 0 1.5px var(--fg)}
.cl-check{margin:0 0 12px;padding:12px 14px;border-radius:14px;background:var(--soft);font-size:14px}.cl-check b{font-weight:800}.cl-check p{margin:4px 0 0;line-height:1.55;color:var(--fg2)}.cl-check p b{color:var(--fg)}
.cl-deep{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:12px 0 4px;padding:12px 14px;border-radius:14px;background:var(--accent-soft);font-size:13.5px;color:var(--fg2)}.cl-deep .btn-primary{margin:0;padding:10px 16px;font-size:14px}.cl-deep small{font-weight:600;opacity:.85;margin-left:4px}.dl-go{margin-top:6px}
.cl-mini p{margin:4px 0 8px;line-height:1.55}.cl-go{display:inline-block;font-size:13px;font-weight:700;padding:6px 0;color:var(--accent-strong);text-decoration:none}.cl-odds{margin:10px 0 14px}.cl-odds-k{font-size:13px;font-weight:700;color:var(--fg2);margin-bottom:6px}.cl-odds .sc-prob{height:10px;margin:0;border-radius:5px;gap:2px;font-size:0}.cl-odds .sc-prob span{min-width:6px}.cl-odds-l{display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}.cl-odds-l span:nth-child(2){color:var(--fg2)}
.cl-card .card{border:1px solid var(--glass-line);border-radius:26px}.cl-k{font-size:12px;font-weight:800;color:var(--accent-strong);margin-bottom:4px}.cl-line{font-size:19px;line-height:1.5;margin:0 0 8px}.cl-tally{font-size:13px;color:var(--fg2);margin:0 0 14px}
.cl-ladder{position:relative;display:flex;flex-direction:column;gap:8px;padding-left:4px}
.cl-item{display:flex;flex-direction:column}.cl-row{position:relative;display:grid;grid-template-columns:minmax(150px,auto) 1fr auto;gap:6px 16px;align-items:center;border-radius:14px;padding:12px 14px;border:0;font:inherit;color:inherit;text-align:left;width:100%;cursor:pointer}.cl-row:disabled{cursor:default}.cl-row:not(:disabled):hover{outline:2px solid rgba(15,34,68,.15)}.cl-more{font-size:20px;color:var(--muted);transition:transform .15s}.cl-row[aria-expanded=true] .cl-more{transform:rotate(90deg)}.cl-row[aria-expanded=true]{border-bottom-left-radius:0;border-bottom-right-radius:0}.cl-sc{position:relative;z-index:1;background:var(--surface);border:1px solid var(--line);border-top:0;border-radius:0 0 14px 14px;padding:10px 14px 4px;font-size:14px;line-height:1.6}.cl-sc p{margin:0 0 8px}.cl-sc-k{font-size:13px;color:var(--fg2)}.cl-worst{margin:4px 0 10px;background:var(--up-soft);border:1px solid #f3c7c9;border-radius:10px;padding:9px 11px}.cl-worst>b{color:var(--up-strong);font-size:13px}.cl-worst p{margin:3px 0 6px}.cl-worst ul{list-style:none;padding:0;margin:0 0 4px;font-size:13px}.cl-worst li{margin:2px 0}.cl-worst small{color:var(--muted);font-size:11.5px}.cl-sc-k b{color:var(--fg);margin-right:4px}.cl-up{background:var(--up-soft)}.cl-now{background:var(--soft)}.cl-down{background:var(--down-soft)}
.cl-px{min-width:0;overflow-wrap:anywhere;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 6px}.cl-px small{flex-basis:100%;padding-left:24px}.cl-arrow{font-size:13px;width:18px;text-align:center}.cl-up .cl-arrow{color:var(--up)}.cl-down .cl-arrow{color:var(--down)}.cl-now .cl-arrow{color:var(--fg2)}.cl-px b{font-size:17px}.cl-px small{font-size:12px;color:var(--muted)}
.cl-what{font-size:15px}.cl-what small{display:block;font-size:12px;color:var(--muted);margin-top:2px}.cl-p{font-size:18px;margin-left:4px}.cl-up .cl-p{color:var(--up)}.cl-down .cl-p{color:var(--down)}
.vt-sum{display:flex;gap:14px;flex-wrap:wrap;font-size:15px}.vt-bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;margin:8px 0 12px}.vt-bar .s-bull{background:var(--up)}.vt-bar .s-neutral{background:var(--line-strong)}.vt-bar .s-bear{background:var(--down)}.vt-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}.vt-m{border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}.vt-who{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.vt-who b{font-size:14px}.vt-s{font-size:12px;font-weight:700;white-space:nowrap}.vt-m p{margin:4px 0 0;font-size:13.5px;line-height:1.55;color:var(--fg2);overflow-wrap:anywhere}
@media (max-width:820px){.cl-line{font-size:17px}}
/* G-253 (한서님 10/19 '강세 약세 기본 시나리오 모두 다'): the three scenarios as rows of one card, Payrix style: a round mark,
   the name and odds, the price on the right, its condition and range under it. No coloured blocks. */
.cl-ladder{gap:0;padding:0}.cl-item+.cl-item{border-top:1px solid var(--line)}
:root body .cl-row{display:grid;grid-template-columns:40px minmax(0,1fr) auto 14px;grid-template-areas:"ic what px more" ". sub sub more" ". rng rng more";gap:2px 12px;align-items:center;padding:14px 2px;border-radius:0;background:transparent}
:root body .cl-row:not(:disabled):hover{outline:0;background:var(--soft)}
.cl-ic{grid-area:ic;display:grid;place-items:center;width:40px;height:40px;border-radius:50%;font-size:13px;background:var(--soft);color:var(--fg2)}.cl-up .cl-ic{background:var(--up-soft);color:var(--up)}.cl-down .cl-ic{background:var(--down-soft);color:var(--down)}
.cl-row .cl-what{grid-area:what;font-size:15px;font-weight:600}.cl-row .cl-what>b{font-weight:600}.cl-row .cl-what small{font-weight:400}.cl-row .cl-p{font-size:15px;font-weight:700}
.cl-row .cl-px{display:contents}.cl-row .cl-px b{grid-area:px;justify-self:end;font-size:18px;font-weight:500;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.cl-row .cl-px small{grid-area:sub;padding:0;font-size:12px;color:var(--muted)}.cl-row .cl-px small.cl-range{grid-area:rng}
.cl-row .cl-more{grid-area:more}
:root body .cl-sc{margin:0 0 12px;border:0;border-radius:18px;background:var(--soft);padding:12px 14px 6px}
:root body .cl-check{border-radius:18px}
/* G-287: the 확률 cells as small pills under the chart */
.pm-odds{margin:10px 0 0}.pm .pm-grid{display:flex;gap:6px;flex-wrap:wrap}.pm .pm-cell{display:inline-flex;align-items:baseline;gap:6px;padding:7px 14px;border-radius:999px;background:var(--soft);box-shadow:none}.pm .pm-cell span{display:inline;font-size:13px;color:var(--fg2)}.pm .pm-cell b{display:inline;font-size:15px;margin:0}.pm .pm-cell.top{box-shadow:none}.pm .pm-cell[aria-pressed=true]{background:var(--fg);box-shadow:none}.pm .pm-cell[aria-pressed=true] span,.pm .pm-cell[aria-pressed=true] b{color:var(--page)}`;

/** Opens a conclusion row's scenario. */
export const CONCLUSION_JS = `
  // G-287: the price map follows the live price: a dot right of the last close, the dashed line at it, the chips' gaps.
  window.addEventListener('gnm-quote', function (e) {
    var d = e.detail || {}, q = d.quote || {}; if (!q.price) return;
    document.querySelectorAll('.pm[data-pm-sym="' + d.symbol + '"]').forEach(function (m) {
      var v = (m.getAttribute('data-pm-y') || '').split(',').map(Number), lo = v[0], hi = v[1], t = v[2], b = v[3]; if (!(hi > lo)) return;
      var y = Math.max(t - 8, Math.min(b + 8, t + (1 - (q.price - lo) / (hi - lo)) * (b - t))).toFixed(1);
      var dot = m.querySelector('.pm-live'), seg = m.querySelector('.pm-live-seg'), now = m.querySelector('.cl-rail-now');
      if (dot) { dot.setAttribute('cy', y); dot.removeAttribute('hidden'); }
      if (seg) { seg.setAttribute('x2', '214'); seg.setAttribute('y2', y); seg.removeAttribute('hidden'); }
      if (now) { now.setAttribute('y1', y); now.setAttribute('y2', y); }
      m.querySelectorAll('[data-pm-at]').forEach(function (s) { var g = (q.price / Number(s.getAttribute('data-pm-at')) - 1) * 100; s.textContent = (g > 0 ? '+' : '') + g.toFixed(1) + '%'; });
    });
  });
  // G-277: a 확률 cell opens its scenario row (the rows stay folded until then).
  // G-287 (한서님 10/23 '기본 시나리오를 켜면 위 차트에서 보고 설명이 나오게'): the map above shows the picked scenario —
  // its bar lit, the others dimmed, and its range as a band across the chart with the prices on it.
  var pmPick = function (card, k) {
    var m = card.querySelector('.pm'); if (!m) return;
    var band = m.querySelector('.pm-band'), bt = m.querySelector('.pm-band-t'), r = k && m.querySelector('rect[data-pm-k="' + k + '"]');
    m.classList.toggle('pm-picked', !!r);
    m.querySelectorAll('rect[data-pm-k]').forEach(function (x) { x.classList.toggle('on', x === r); });
    if (!band || !bt) return;
    if (!r) { band.setAttribute('hidden', ''); bt.setAttribute('hidden', ''); return; }
    var y = Number(r.getAttribute('y')), h = Number(r.getAttribute('height')), x2 = Number(r.getAttribute('x')) + Number(r.getAttribute('width'));
    band.setAttribute('class', 'pm-band ' + r.getAttribute('class').split(' ')[0]); band.setAttribute('x', '0'); band.setAttribute('y', String(y)); band.setAttribute('width', String(x2)); band.setAttribute('height', String(h)); band.removeAttribute('hidden');
    bt.textContent = ({ BULL: '강세', BASE: '기본', BEAR: '약세' })[k] + ' ' + r.getAttribute('data-pm-z'); bt.setAttribute('y', String(Math.max(12, y - 5))); bt.removeAttribute('hidden');
  };
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.pm-cell[data-pm]'); if (!c) return;
    var card = c.closest('.cl-card'), lad = card && card.querySelector('.cl-ladder'); if (!lad) return;
    var cls = { BULL: 'cl-up', BASE: 'cl-now', BEAR: 'cl-down' }[c.getAttribute('data-pm')], on = c.getAttribute('aria-pressed') !== 'true';
    pmPick(card, on ? c.getAttribute('data-pm') : '');
    if (on) { var mp = card.querySelector('.pm'); if (mp && mp.getBoundingClientRect().top < 60) mp.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    card.querySelectorAll('.pm-cell').forEach(function (x) { x.setAttribute('aria-pressed', String(x === c && on)); });
    var nts = card.querySelectorAll('[data-pm-note]');
    if (nts.length) { nts.forEach(function (n) { n.hidden = !(on && n.getAttribute('data-pm-note') === c.getAttribute('data-pm')); }); return; }
    lad.hidden = !on;
    lad.querySelectorAll('.cl-item').forEach(function (it) { var r = it.querySelector('.cl-row'), mine = r && r.classList.contains(cls); it.hidden = !mine; if (r && mine && r.getAttribute('aria-expanded') === 'false') r.click(); });
  });
  // G-172: every "심층 리포트 열기" on 요약 goes to the unlock card at the top of the AI tab.
  document.addEventListener('click', function (e) {
    var g = e.target.closest && e.target.closest('[data-deep-go]'); if (!g) return; e.preventDefault();
    var t = document.querySelector('[aria-controls=tab-ai]'); if (t) t.click();
    setTimeout(function () { var s = document.getElementById('deep-slot'); if (s) s.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 80);
  });
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
  long: ['FUNDAMENTAL', 'EVENT', 'fundamental', 'event_catalyst', 'sector_expert', 'MARKET'],
};
const VIEW_LABEL: Record<string, string> = { beginner: '초보', trader: '단타', swing: '스윙', long: '장기' };
export const VIEW_FOCUS_CSS = `.vt-help{font-size:13px;color:var(--fg2);background:var(--soft);border-radius:10px;padding:8px 11px;margin:0 0 10px}.vt-more{display:none;margin:10px auto 0;border:1px dashed var(--line-strong);background:var(--surface);border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:700;color:var(--accent-strong);cursor:pointer}
.pc-only-beginner{display:none}html[data-persona=beginner] .pc-only-beginner{display:block}html[data-persona=all] .pc-not-all{display:none}.vt-tally{display:none}html:not([data-persona]) .vt-t-all,html[data-persona=all] .vt-t-all,.vt.show-all-members .vt-t-all{display:block}.vt.show-all-members .vt-tally:not(.vt-t-all){display:none!important}${Object.keys(VIEW_FOCUS).map((v) => `html[data-persona=${v}] .vt-t-${v}`).join(',')}{display:block}.pl-view{display:none;font-size:13px;font-weight:700;color:var(--accent-strong);margin:2px 0 6px}.vt-seat{display:none;font-size:13px;font-weight:700;color:var(--accent-strong);margin:0 0 8px}
${Object.entries(VIEW_FOCUS).map(([v, ids]) => {
    const not = ids.map((id) => `[data-member=${id}]`).join(',');
    const seatsOn = ids.map((id) => `[data-m=${id}]`).join(',');
    return `html[data-persona=${v}] #parliament-ai .seat:not(${seatsOn}){fill-opacity:.16;stroke:var(--sc);stroke-width:1}html[data-persona=${v}] #parliament-ai .pl-view-${v}{display:block}html[data-persona=${v}] .vt-seat-${v}{display:block}html[data-persona=${v}] .vt:not(.show-all-members) .vt-m:not(${not}){display:none}html[data-persona=${v}] .vt:not(.show-all-members) .vt-more{display:block}
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
export function watchInfo(entries: readonly { symbol: string; report: DailyReport | null; reportDate?: string | null }[]): Record<string, { c: number; up?: number; dn?: number; f: number; n: number; d: string }> {
  const out: Record<string, { c: number; up?: number; dn?: number; f: number; n: number; d: string }> = {};
  for (const e of entries) {
    const r = e.report; if (!r?.price) continue;
    const since = new Date(Date.parse(r.date) - 3 * 86_400_000).toISOString().slice(0, 10);
    // G-231: d is the day the report was made (the daily push and weekly mail announce it as new), not the run date.
    out[e.symbol] = { c: r.price.close, ...testPrices(r), f: (r.recentFilings ?? []).filter((x) => x.filedDate >= since).length, n: r.news?.newIds.length ?? 0, d: e.reportDate === undefined ? r.date : e.reportDate ?? '' };
  }
  return out;
}

