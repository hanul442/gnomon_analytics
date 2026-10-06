// Views by survey answer (docs/DESIGN.md §5.23, G-63): beginners, short-term traders, swing and long-term
// investors each get a front page and a stock page that answer their own question first, and hide the
// rest behind "전체 보기". The view comes from the onboarding answers (localStorage gnm-prefs) and can
// be switched at the top of the page (gnm-persona). Everything is in the page; CSS decides what shows.

import type { DailyReport } from './dailyReport.js';

export type Persona = 'beginner' | 'trader' | 'swing' | 'long' | 'all';
export const PERSONAS: readonly { key: Persona; label: string; question: string }[] = [
  { key: 'beginner', label: '초보', question: '이 종목, 쉽게 말하면 지금 어떤 상태인가요?' },
  { key: 'trader', label: '단타', question: '오늘 움직임과 가까운 지지·저항은?' },
  { key: 'swing', label: '스윙', question: '지금 들어가도 되나, 언제 틀렸다고 볼까?' },
  { key: 'long', label: '장기', question: '실적과 가치로 보면 비싼가, 싼가?' },
  { key: 'all', label: '전체', question: '모든 정보를 다 볼게요' },
];

/** In <head>: sets html[data-persona] before paint, from the switch or the survey (default swing). */
export const PERSONA_BOOT = `<script>(function(){var p='';try{p=localStorage.getItem('gnm-persona')||'';if(!p){var a=JSON.parse(localStorage.getItem('gnm-prefs')||'null');if(a){var e=a.experience||'',h=a.horizon||'',x=a.explain||'',st=(a.style||[]).join(' '),f=a.freq||'';p=/처음|1년 미만/.test(e)||/아주 쉬운/.test(x)?'beginner':/하루|며칠/.test(h)||/단타/.test(st)||/거의 매일/.test(f)?'trader':/1년/.test(h)||/배당|가치주/.test(st)||/모아요/.test(f)?'long':'swing';}}}catch(x){}document.documentElement.setAttribute('data-persona',p||'swing');})();</script>`;

/** Home sections each view shows, in order; the rest wait behind "다른 정보도 보기". */
export const HOME_ORDER: Record<Exclude<Persona, 'all'>, string[]> = {
  beginner: ['watch', 'today', 'myscreens', 'movers'],
  trader: ['watch', 'today', 'movers', 'myscreens'],
  swing: ['watch', 'today', 'myscreens', 'movers'],
  long: ['watch', 'today', 'myscreens', 'movers'],
};
/** Report tabs each view keeps (the rest come back with "전체 보기"). */
export const TAB_KEEP: Record<Exclude<Persona, 'all'>, string[]> = {
  beginner: ['home', 'chart', 'technical', 'ai', 'flows', 'fundamentals', 'news'],
  trader: ['home', 'chart', 'technical', 'ai', 'flows', 'fundamentals', 'news'],
  swing: ['home', 'chart', 'technical', 'ai', 'flows', 'fundamentals', 'news'],
  long: ['home', 'chart', 'technical', 'ai', 'flows', 'fundamentals', 'news'],
};

export const PERSONA_CSS = `${(Object.keys(TAB_KEEP) as Exclude<Persona, 'all'>[]).map((p) => `html[data-persona=${p}]:not(.show-all) .chips [role=tab]:not(${TAB_KEEP[p].map((t) => `#t-${t}`).join(',')})`).join(',')}{display:none}
.pc{display:none}${(['beginner', 'trader', 'swing', 'long'] as const).map((p) => `html[data-persona=${p}] .pc-${p}`).join(',')},html[data-persona=all] .pc-swing{display:block}
.pc-wrap{margin:14px 0 4px}.pc-wrap .persona-bar{margin-bottom:10px}.pc{margin-bottom:14px}.pc .card{border:1px solid var(--accent);background:linear-gradient(180deg,#f5f8fd,#fff)}.pc-q{font-size:12px;font-weight:800;color:var(--accent-strong);margin-bottom:4px}.pc h2{font-size:19px;margin:0 0 10px;line-height:1.45}
.pc-rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.pc-rows>div{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px 12px}.pc-rows span{display:block;font-size:12px;color:var(--muted)}.pc-rows b{font-size:16px}.pc-rows small{display:block;font-size:12px;color:var(--muted);margin-top:2px;line-height:1.5}
html[data-persona=beginner]:not(.show-all) .pc-hide-beginner,html[data-persona=trader]:not(.show-all) .pc-hide-trader,html[data-persona=long]:not(.show-all) .pc-hide-long{display:none}
.persona-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px}.persona-bar .lbl{color:var(--muted);font-weight:700}.persona-bar button{border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:5px 11px;font:inherit;font-size:13px;cursor:pointer}${PERSONAS.map((p) => `html[data-persona=${p.key}] .persona-bar [data-persona=${p.key}]`).join(',')}{background:var(--navy);color:#fff;border-color:var(--navy)}`;

/** The view switch (front page and stock pages). */
export const PERSONA_BAR = `<div class="persona-bar" role="group" aria-label="보기 방식"><span class="lbl">보기</span>${PERSONAS.map((p) => `<button type="button" data-persona="${p.key}" title="${p.question}">${p.label}</button>`).join('')}</div>`;

/** The switch's behaviour; pages listen for the gnm-persona event to re-arrange. */
export const PERSONA_JS = `
  document.addEventListener('click', function (e) {
    var o = e.target.closest && e.target.closest('[data-open-view]');
    if (o) { e.preventDefault(); var m = document.querySelector('.menu-btn'); if (m) { m.click(); var g = document.getElementById('sm-view'); if (g) g.scrollIntoView({ block: 'nearest' }); } return; }
    var b = e.target.closest && e.target.closest('.persona-bar [data-persona]'); if (!b) return;
    var p = b.getAttribute('data-persona');
    try { localStorage.setItem('gnm-persona', p); } catch (x) {}
    document.documentElement.setAttribute('data-persona', p);
    document.documentElement.classList.remove('show-all');
    window.dispatchEvent(new Event('gnm-persona'));
    if (window.GNM && GNM.track) GNM.track('persona', { p: p });
  });`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const won = (v: number) => `${v >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: 4 })}원`;
const pct = (v: number | null | undefined) => (v == null ? '—' : `${v > 0 ? '▲ +' : v < 0 ? '▼ ' : ''}${v.toFixed(1)}%`);
const tone = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');
const row = (k: string, v: string, note = '') => `<div><span>${esc(k)}</span><b>${v}</b>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
const LEVEL_WORD: Record<string, string> = { STRONG_BULLISH: '강한 강세', BULLISH: '강세', SLIGHTLY_BULLISH: '약간 강세', NEUTRAL: '중립', SLIGHTLY_BEARISH: '약간 약세', BEARISH: '약세', STRONG_BEARISH: '강한 약세' };
const FOOT: Record<string, string> = { ACCUMULATION_LIKE: '매집 쪽', DISTRIBUTION_LIKE: '분산 쪽', MIXED: '엇갈림', NEUTRAL: '뚜렷하지 않음', DATA_GAP: '기록 부족' };

/** The first card of a stock page, one per view: each answers that view's question from the report. */
export function personaCards(report: DailyReport): string {
  const p = report.price, m = report.market, c = report.commentary?.status === 'OK' ? report.commentary : undefined;
  if (!p) return '';
  const line = c?.summary?.text ?? report.headline;
  const sig = report.technicals?.level ? LEVEL_WORD[report.technicals.level] ?? '' : '';
  const fv = m?.fairValue, st = m?.structure;
  const below = st?.levels.filter((l) => l.price < p.close).sort((a, b) => b.price - a.price)[0];
  const above = st?.levels.filter((l) => l.price > p.close).sort((a, b) => a.price - b.price)[0];
  const card = (key: Persona, q: string, title: string, rows: string, foot = '', cls = '') =>
    `<section class="pc pc-${key}"><div class="card"><div class="pc-q">${esc(q)}</div><h2${cls ? ` class="${cls}"` : ''}>${esc(title)}</h2><div class="pc-rows">${rows}</div>${foot}</div></section>`;
  const big = p.moveZ20 != null && Math.abs(p.moveZ20) >= 2;
  const mom = (d: number) => report.momentum?.find((x) => x.days === d)?.returnPct ?? null;
  // Beginner: plain words, each number explained.
  const beginner = card('beginner', '쉽게 보면', line,
    row('오늘', `<span class="${tone(p.changePct)}">${pct(p.changePct)}</span>`, big ? '평소보다 크게 움직였어요' : '평소 범위 안의 움직임이에요')
    + (sig ? row('기술 신호', sig, '여러 지표가 가리키는 방향이에요. 오를 확률은 아니에요') : '')
    + (fv ? row('가격 위치', fv.position === 'ABOVE' ? '비싼 쪽' : fv.position === 'BELOW' ? '싼 쪽' : '보통', `거래가 많이 된 가격대(${won(fv.low)}~${won(fv.high)})와 비교했어요`) : ''),
    '<p class="fine" style="margin-top:8px">모르는 말은 옆의 ? 를 누르면 풀이가 나와요. 투자 권유가 아니에요.</p>');
  // Trader: today's move, volume and the nearest levels.
  const value = p.close * p.volume;
  const trader = card('trader', '오늘 움직임', `${pct(p.changePct)} · 거래량 평소의 ${p.volumeRatio20 == null ? '—' : p.volumeRatio20.toFixed(1)}배`,
    row('거래대금', `${(value / 1e8).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}억`)
    + (below ? row('가까운 지지', won(below.price), `닿은 횟수 ${below.touches}번`) : '')
    + (above ? row('가까운 저항', won(above.price), `닿은 횟수 ${above.touches}번`) : '')
    + (m ? row('수급 흔적', FOOT[m.footprint.state] ?? '—') : '')
    + (st?.atr14 ? row('하루 평균 움직임', `${((st.atr14 / p.close) * 100).toFixed(1)}%`, 'ATR 14일') : ''), '', tone(p.changePct));
  // Swing: the conclusion card (G-65): the two test prices and what each crossing would mean, with the odds.
  // Swing: no card of its own; the conclusion card heads the page (G-71).
  const swing = '';
  // Long: value, earnings and what the street expects.
  const snap = m?.snapshot, q = m?.quarters.filter((x) => !x.isEstimate) ?? [];
  const op = (x: { metrics: Record<string, number | null> } | undefined) => x?.metrics['영업이익'] ?? null;
  const lastQ = q.at(-1), yearAgo = q.at(-5);
  const yoy = op(lastQ) != null && op(yearAgo) != null && op(yearAgo)! > 0 ? ((op(lastQ)! / op(yearAgo)! - 1) * 100) : null;
  const long = card('long', '가치와 실적', fv ? `적정 범위 ${won(fv.low)}~${won(fv.high)}, 지금은 ${fv.position === 'ABOVE' ? '범위 위' : fv.position === 'BELOW' ? '범위 아래' : '범위 안'}` : line,
    row('120일 등락', `<span class="${tone(mom(120))}">${pct(mom(120))}</span>`)
    + (snap?.per != null ? row('PER', `${snap.per.toFixed(1)}배`) : '') + (snap?.pbr != null ? row('PBR', `${snap.pbr.toFixed(2)}배`) : '')
    + (yoy != null ? row('최근 분기 영업이익', `<span class="${tone(yoy)}">${pct(yoy)}</span>`, '1년 전 같은 분기 대비') : '')
    + (snap?.consensus?.targetPriceMean ? row('증권가 평균 목표가', won(snap.consensus.targetPriceMean), '증권사 의견이에요') : ''));
  return beginner + trader + swing + long;
}
