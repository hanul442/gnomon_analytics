// The conclusion card (docs/DESIGN.md §5.24, G-65): one look at where the stock stands. Two test prices
// on a ladder with the current price between them, and what each crossing would mean with the
// committee's odds: above the upper test → the bull scenario (a%), below the lower test → the bear
// scenario (b%), in between → the base case (c%). Test prices come from the scenarios (prompt v6) or,
// for older reports, from the nearest support and resistance. Public part only (G-61 keeps it open).

import type { DailyReport } from './dailyReport.js';

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
  // The committee's vote in one line (G-68): it replaces the seat chart on the AI tab.
  const votes = [...(c?.analysts ?? []), ...(c?.desks ?? [])].map((v) => v.stance);
  const n = (k: string) => votes.filter((v) => v === k).length;
  const tally = votes.length ? `<div class="cl-tally">위원 ${votes.length}명 · <b class="up">강세 ${n('BULLISH')}</b> · <b class="down">약세 ${n('BEARISH')}</b> · 중립 ${n('NEUTRAL')}${n('INSUFFICIENT_DATA') ? ` · 근거 부족 ${n('INSUFFICIENT_DATA')}` : ''}</div>` : '';
  if (upper === undefined && lower === undefined && !anyOdds && !votes.length) return '';
  const odds = (s: typeof bull) => (typeof s?.probability === 'number' ? `<b class="cl-p">${s.probability}%</b>` : '');
  const line = (c?.summary?.text ?? report.headline).split(/(?<=[.?!요])\s/)[0] ?? '';
  const rows = [
    upper !== undefined || bull ? `<div class="cl-row cl-up"><div class="cl-px"><span class="cl-arrow">▲</span><b>${upper !== undefined ? won(upper) : '위쪽'}</b><small>${upper !== undefined ? gap(upper, p.close) : ''}</small></div><div class="cl-what"><b>${upper !== undefined ? '이 가격 위로 올라서면' : '오르는 쪽으로 가면'}</b> 강세 시나리오 ${odds(bull)}${bull?.zone ? `<small>20거래일 가격대 ${zone(bull.zone)}</small>` : ''}</div></div>` : '',
    `<div class="cl-row cl-now"><div class="cl-px"><span class="cl-arrow">●</span><b>${won(p.close)}</b><small>지금</small></div><div class="cl-what"><b>${upper !== undefined && lower !== undefined ? '두 가격 사이에 머물면' : '지금 가격 근처에서는'}</b> 기본 시나리오 ${odds(base)}${base?.zone ? `<small>20거래일 가격대 ${zone(base.zone)}</small>` : ''}</div></div>`,
    lower !== undefined || bear ? `<div class="cl-row cl-down"><div class="cl-px"><span class="cl-arrow">▼</span><b>${lower !== undefined ? won(lower) : '아래쪽'}</b><small>${lower !== undefined ? gap(lower, p.close) : ''}</small></div><div class="cl-what"><b>${lower !== undefined ? '이 가격 아래로 내려가면' : '내리는 쪽으로 가면'}</b> 약세 시나리오 ${odds(bear)}${bear?.zone ? `<small>20거래일 가격대 ${zone(bear.zone)}</small>` : ''}</div></div>` : '',
  ].join('');
  const hasOdds = [bull, base, bear].some((s) => typeof s?.probability === 'number');
  const source = bull?.trigger !== undefined || bear?.trigger !== undefined ? 'AI 위원회가 고른 테스트 가격이에요' : '가까운 지지·저항을 테스트 가격으로 썼어요';
  return `<section class="block cl-card"${opts.id ? ` id="${opts.id}"` : ''}><div class="card"><div class="cl-k">${esc(opts.title ?? '결론')}</div><h2 class="cl-line">${esc(line)}</h2>${tally}
<div class="cl-ladder">${rows}</div>
<p class="fine">${source}. ${hasOdds ? '확률은 지금 근거로 본 위원회의 추정이고, 기록해 두었다가 실제 결과로 채점해요.' : '확률은 AI 위원회 리포트가 나오면 붙어요.'} 투자 권유가 아니에요.</p></div></section>`;
}

export const CONCLUSION_CSS = `.cl-card .card{border:1.5px solid var(--navy)}.cl-k{font-size:12px;font-weight:800;color:var(--accent-strong);margin-bottom:4px}.cl-line{font-size:19px;line-height:1.5;margin:0 0 8px}.cl-tally{font-size:13px;color:var(--fg2);margin:0 0 14px}
.cl-ladder{position:relative;display:flex;flex-direction:column;gap:8px;padding-left:4px}.cl-ladder::before{content:'';position:absolute;left:15px;top:14px;bottom:14px;width:2px;background:linear-gradient(#d1373d,#7b8798,#2a62c9);opacity:.35}
.cl-row{position:relative;display:grid;grid-template-columns:minmax(150px,auto) 1fr;gap:6px 16px;align-items:center;border-radius:14px;padding:12px 14px}.cl-up{background:#fdf0f0}.cl-now{background:#f2f4f7}.cl-down{background:#eef3fc}
.cl-px{display:flex;align-items:baseline;gap:6px}.cl-arrow{font-size:13px;width:18px;text-align:center}.cl-up .cl-arrow{color:#d1373d}.cl-down .cl-arrow{color:#2a62c9}.cl-now .cl-arrow{color:#475569}.cl-px b{font-size:17px}.cl-px small{font-size:12px;color:var(--muted)}
.cl-what{font-size:15px}.cl-what small{display:block;font-size:12px;color:var(--muted);margin-top:2px}.cl-p{font-size:18px;margin-left:4px}.cl-up .cl-p{color:#c4262e}.cl-down .cl-p{color:#1f55b8}
@media (max-width:820px){.cl-row{grid-template-columns:1fr}.cl-line{font-size:17px}}`;
