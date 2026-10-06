// The conclusion card (docs/DESIGN.md §5.24, G-65): one look at where the stock stands. Two test prices
// on a ladder with the current price between them, and what each crossing would mean with the
// committee's odds: above the upper test → the bull scenario (a%), below the lower test → the bear
// scenario (b%), in between → the base case (c%). Test prices come from the scenarios (prompt v6) or,
// for older reports, from the nearest support and resistance. Public part only (G-61 keeps it open).

import type { DailyReport } from './dailyReport.js';
import { ANALYSTS } from '../analysis/analysts.js';
import { LOCKED_TEXT } from '../analysis/commentary.js';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const won = (v: number) => `${v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}원`;
const gap = (to: number, from: number) => { const g = (to / from - 1) * 100; return `${g > 0 ? '+' : ''}${g.toFixed(1)}%`; };
const zone = (z?: [number, number]) => (z ? `${won(z[0])} ~ ${won(z[1])}` : '');

export function conclusionCard(report: DailyReport, opts: { title?: string; id?: string } = {}): string {
  const p = report.price;
  if (!p) return '';
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  const sc = (k: 'BULL' | 'BASE' | 'BEAR') => c?.scenarios?.find((s) => s.kind === k);
  const bull = sc('BULL'), base = sc('BASE'), bear = sc('BEAR');
  const levels = report.market?.structure?.levels ?? [];
  const upper = bull?.trigger ?? levels.filter((l) => l.price > p.close).sort((a, b) => a.price - b.price)[0]?.price;
  const lower = bear?.trigger ?? levels.filter((l) => l.price < p.close).sort((a, b) => b.price - a.price)[0]?.price;
  const anyOdds = [bull, base, bear].some((s) => typeof s?.probability === 'number');
  if (upper === undefined && lower === undefined && !anyOdds) return '';
  const odds = (s: typeof bull) => (typeof s?.probability === 'number' ? `<b class="cl-p">${s.probability}%</b>` : '');
  const line = (c?.summary?.text ?? report.headline).split(/(?<=[.?!요])\s/)[0] ?? '';
  // Each row opens its scenario (G-69): what would happen, what would set it off, when it would be wrong.
  const detail = (sc: typeof bull, label: string) => {
    if (!sc) return '';
    const locked = sc.narrative.text === LOCKED_TEXT;
    return `<div class="cl-sc" hidden><p>${esc(sc.narrative.text)}</p>${!locked && sc.catalysts.length ? `<p class="cl-sc-k"><b>이게 나오면</b> ${sc.catalysts.map(esc).join(', ')}</p>` : ''}${!locked && sc.invalidation.length ? `<p class="cl-sc-k"><b>${label}가 틀렸다고 볼 때</b> ${sc.invalidation.map(esc).join(', ')}</p>` : ''}${sc.zone ? `<p class="cl-sc-k"><b>20거래일 가격대</b> ${zone(sc.zone)}</p>` : ''}</div>`;
  };
  const row = (cls: string, sc: typeof bull, label: string, px: string, what: string) => `<div class="cl-item"><button type="button" class="cl-row ${cls}"${sc ? ' aria-expanded="false"' : ' disabled'}>${px}<div class="cl-what">${what} ${label} 시나리오 ${odds(sc)}${sc?.zone ? `<small>20거래일 가격대 ${zone(sc.zone)}</small>` : ''}</div>${sc ? '<span class="cl-more" aria-hidden="true">›</span>' : ''}</button>${detail(sc, label)}</div>`;
  const rows = [
    upper !== undefined || bull ? row('cl-up', bull, '강세', `<div class="cl-px"><span class="cl-arrow">▲</span><b>${upper !== undefined ? won(upper) : '위쪽'}</b><small>${upper !== undefined ? gap(upper, p.close) : ''}</small></div>`, `<b>${upper !== undefined ? '이 가격 위로 올라서면' : '오르는 쪽으로 가면'}</b>`) : '',
    row('cl-now', base, '기본', `<div class="cl-px"><span class="cl-arrow">●</span><b>${won(p.close)}</b><small>지금</small></div>`, `<b>${upper !== undefined && lower !== undefined ? '두 가격 사이에 머물면' : '지금 가격 근처에서는'}</b>`),
    lower !== undefined || bear ? row('cl-down', bear, '약세', `<div class="cl-px"><span class="cl-arrow">▼</span><b>${lower !== undefined ? won(lower) : '아래쪽'}</b><small>${lower !== undefined ? gap(lower, p.close) : ''}</small></div>`, `<b>${lower !== undefined ? '이 가격 아래로 내려가면' : '내리는 쪽으로 가면'}</b>`) : '',
  ].join('');
  const hasOdds = [bull, base, bear].some((s) => typeof s?.probability === 'number');
  const source = bull?.trigger !== undefined || bear?.trigger !== undefined ? 'AI 위원회가 고른 테스트 가격이에요' : '가까운 지지·저항을 테스트 가격으로 썼어요';
  return `<section class="block cl-card"${opts.id ? ` id="${opts.id}"` : ''}><div class="card"><div class="cl-k">${esc(opts.title ?? '결론')}</div><h2 class="cl-line">${esc(line)}</h2>
<div class="cl-ladder">${rows}</div>
<p class="fine">${bull || bear || base ? '줄을 누르면 시나리오가 펼쳐져요. ' : ''}${source}. ${hasOdds ? '확률은 지금 근거로 본 위원회의 추정이고, 기록해 두었다가 실제 결과로 채점해요.' : '확률은 AI 위원회 리포트가 나오면 붙어요.'} 투자 권유가 아니에요.</p></div></section>`;
}

export const CONCLUSION_CSS = `.cl-card .card{border:1.5px solid var(--navy)}.cl-k{font-size:12px;font-weight:800;color:var(--accent-strong);margin-bottom:4px}.cl-line{font-size:19px;line-height:1.5;margin:0 0 8px}.cl-tally{font-size:13px;color:var(--fg2);margin:0 0 14px}
.cl-ladder{position:relative;display:flex;flex-direction:column;gap:8px;padding-left:4px}.cl-ladder::before{content:'';position:absolute;left:15px;top:14px;bottom:14px;width:2px;background:linear-gradient(#d1373d,#7b8798,#2a62c9);opacity:.35}
.cl-item{display:flex;flex-direction:column}.cl-row{position:relative;display:grid;grid-template-columns:minmax(150px,auto) 1fr auto;gap:6px 16px;align-items:center;border-radius:14px;padding:12px 14px;border:0;font:inherit;color:inherit;text-align:left;width:100%;cursor:pointer}.cl-row:disabled{cursor:default}.cl-row:not(:disabled):hover{outline:2px solid rgba(15,34,68,.15)}.cl-more{font-size:20px;color:var(--muted);transition:transform .15s}.cl-row[aria-expanded=true] .cl-more{transform:rotate(90deg)}.cl-row[aria-expanded=true]{border-bottom-left-radius:0;border-bottom-right-radius:0}.cl-sc{position:relative;z-index:1;background:#fff;border:1px solid var(--line);border-top:0;border-radius:0 0 14px 14px;padding:10px 14px 4px;font-size:14px;line-height:1.6}.cl-sc p{margin:0 0 8px}.cl-sc-k{font-size:13px;color:var(--fg2)}.cl-sc-k b{color:var(--fg);margin-right:4px}.cl-up{background:#fdf0f0}.cl-now{background:#f2f4f7}.cl-down{background:#eef3fc}
.cl-px{display:flex;align-items:baseline;gap:6px}.cl-arrow{font-size:13px;width:18px;text-align:center}.cl-up .cl-arrow{color:#d1373d}.cl-down .cl-arrow{color:#2a62c9}.cl-now .cl-arrow{color:#475569}.cl-px b{font-size:17px}.cl-px small{font-size:12px;color:var(--muted)}
.cl-what{font-size:15px}.cl-what small{display:block;font-size:12px;color:var(--muted);margin-top:2px}.cl-p{font-size:18px;margin-left:4px}.cl-up .cl-p{color:#c4262e}.cl-down .cl-p{color:#1f55b8}
.vt-sum{display:flex;gap:14px;flex-wrap:wrap;font-size:15px}.vt-bar{display:flex;gap:2px;height:10px;border-radius:5px;overflow:hidden;margin:8px 0 12px}.vt-bar .s-bull{background:#d1373d}.vt-bar .s-neutral{background:#c4cbc9}.vt-bar .s-bear{background:#2a62c9}.vt-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}.vt-m{border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}.vt-who{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.vt-who b{font-size:14px}.vt-s{font-size:12px;font-weight:700;white-space:nowrap}.vt-m p{margin:4px 0 0;font-size:13.5px;line-height:1.55;color:var(--fg2);overflow-wrap:anywhere}
@media (max-width:820px){.cl-row{grid-template-columns:1fr auto}.cl-row .cl-px{grid-column:1}.cl-row .cl-what{grid-column:1}.cl-row .cl-more{grid-column:2;grid-row:1/3}.cl-line{font-size:17px}}`;

const DESK_NAME: Record<string, string> = { MARKET: '시장 데스크', TECHNICAL: '기술 데스크', FLOW: '수급 데스크', FUNDAMENTAL: '펀더멘털 데스크', EVENT: '공시·뉴스 데스크' };
const ANALYST_NAME: Record<string, string> = Object.fromEntries(ANALYSTS.map((a) => [a.id, a.name]));
const VOTE = { BULLISH: ['강세', 'up'], BEARISH: ['약세', 'down'], NEUTRAL: ['중립', ''], INSUFFICIENT_DATA: ['근거 부족', 'muted'] } as const;

/**
 * The committee's vote (G-69), under the conclusion: the split as one bar, then every member with its
 * stance and the one line behind it. This replaces the per-desk opinion block and the seat chart.
 */
export function voteSection(report: DailyReport): string {
  const c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  if (!c) return '';
  const members = [
    ...(c.analysts ?? []).map((a) => ({ who: ANALYST_NAME[a.analyst] ?? a.analyst, role: '분석가', stance: a.stance as keyof typeof VOTE, why: a.rationale.text, conf: a.confidence })),
    ...(c.desks ?? []).map((d) => ({ who: DESK_NAME[d.desk] ?? d.desk, role: '데스크', stance: d.stance as keyof typeof VOTE, why: d.view.text, conf: null as number | null })),
  ];
  if (!members.length) return '';
  const n = (k: string) => members.filter((m) => m.stance === k).length;
  const order = { BULLISH: 0, NEUTRAL: 1, INSUFFICIENT_DATA: 2, BEARISH: 3 } as const;
  const rows = [...members].sort((a, b) => order[a.stance] - order[b.stance]).map((m) => `<li class="vt-m"><div class="vt-who"><b>${esc(m.who)}</b><span class="vt-s ${VOTE[m.stance][1]}">${VOTE[m.stance][0]}${m.conf != null ? ` · 확신 ${Math.round(m.conf <= 1 ? m.conf * 100 : m.conf)}%` : ''}</span></div><p>${esc(m.why)}</p></li>`).join('');
  return `<section class="block" id="vote"><div class="block-head"><h2>위원회 표결</h2><span class="muted">분석가 ${(c.analysts ?? []).length}명 · 데스크 ${(c.desks ?? []).length}곳</span></div><div class="card vt">
<div class="vt-sum"><b class="up">강세 ${n('BULLISH')}</b><b>중립 ${n('NEUTRAL')}</b>${n('INSUFFICIENT_DATA') ? `<b class="muted">근거 부족 ${n('INSUFFICIENT_DATA')}</b>` : ''}<b class="down">약세 ${n('BEARISH')}</b></div>
<div class="vt-bar" aria-hidden="true"><span class="s-bull" style="flex:${n('BULLISH')}"></span><span class="s-neutral" style="flex:${n('NEUTRAL') + n('INSUFFICIENT_DATA')}"></span><span class="s-bear" style="flex:${n('BEARISH')}"></span></div>
<ul class="vt-list">${rows}</ul><p class="fine">분석가는 각자 맡은 방법(추세·평균회귀·수급·실적 등)으로, 데스크는 맡은 자료(시장·기술·수급·실적·공시뉴스)로 판단해요. 분석가의 판단은 20거래일 뒤 실제 가격으로 채점돼 성적표에 쌓여요.</p></div></section>`;
}

/** Opens a conclusion row's scenario. */
export const CONCLUSION_JS = `
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.cl-row[aria-expanded]'); if (!b) return;
    var open = b.getAttribute('aria-expanded') !== 'true', d = b.nextElementSibling;
    b.setAttribute('aria-expanded', String(open)); if (d) d.hidden = !open;
  });`;
