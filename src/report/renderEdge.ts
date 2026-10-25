// What most readers miss (G-99), on the report: a short card on the summary tab and the details where
// they belong — insider and 5% holder moves and value surges in 수급, surprises, dividends and the next
// earnings in 실적, every surfaced filing in 뉴스·공시. Only collected facts; an absent source says so.

import type { DailyReport } from './dailyReport.js';
import { dartViewerUrl } from '../sources/opendart.js';
import { esc } from './html.js';
import { won, bigMoney, currency } from './format.js';

const eok = (v: number) => bigMoney(v);
const shares = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString('ko-KR')}주`;
const qLabel = (p: string) => `${p.slice(0, 4)}년 ${Number(p.slice(4)) / 3}분기`;
/** G-194: a Form 4 name comes in capitals, family name first ("COOK TIMOTHY D"); shown in title case so it reads as a name. Suffixes and company words keep their capitals, Mc names their second capital. */
const KEEP = new Set(['II', 'III', 'IV', 'LLC', 'LP', 'L.P.', 'INC', 'INC.', 'LTD', 'PLC', 'CO.', 'N.A.', 'USA', 'US']);
const personName = (n: string) => (/[a-z]/.test(n) || !/[A-Z]/.test(n) ? n : n.split(' ').map((w) => (KEEP.has(w) || w.length < 2 ? w : w.toLowerCase().replace(/(^|[-'.])([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase()).replace(/^Mc([a-z])/, (_, c: string) => 'Mc' + c.toUpperCase()))).join(' '));
/** G-194: long English officer titles shortened to the usual letters so a phone row keeps one line. */
const TITLES: [RegExp, string][] = [[/chief executive officer/gi, 'CEO'], [/chief financial officer/gi, 'CFO'], [/chief operating officer/gi, 'COO'], [/chief technology officer/gi, 'CTO'], [/chief accounting officer/gi, 'CAO'], [/chief legal officer/gi, 'CLO'], [/chief marketing officer/gi, 'CMO'], [/chief people officer/gi, 'CPO'], [/executive vice president/gi, 'EVP'], [/senior vice president/gi, 'SVP'], [/vice president/gi, 'VP'], [/general counsel/gi, 'GC'], [/principal accounting officer/gi, 'PAO'], [/^director$/i, '이사']];
const shortTitle = (t: string) => TITLES.reduce((s, [re, to]) => s.replace(re, to), t);
// G-300: one-colour line icons in a grey tile (were emoji), so the card reads as quietly as the rest of the 위원회 part.
const svg = (d: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICON: Record<string, string> = {
  insider: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>'),
  holder: svg('<path d="M4 20h16M6 20V10l6-5 6 5v10M10 20v-5h4v5"/>'),
  surprise: svg('<path d="M5 20V11M12 20V5M19 20v-7"/>'), earnings: svg('<path d="M5 20V11M12 20V5M19 20v-7"/>'),
  buyback: svg('<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>'),
  buybackSell: svg('<path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
  contract: svg('<path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5"/>'),
  value: svg('<path d="M4 14V10h4l5-4v12l-5-4zM17 9a4 4 0 0 1 0 6"/>'),
  dividend: svg('<circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M9.5 10c0-1 1-1.6 2.5-1.6s2.5.6 2.5 1.5c0 2.2-5 1.2-5 3.6 0 .9 1 1.6 2.5 1.6s2.5-.6 2.5-1.6"/>'),
  ir: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4"/>'),
};

/** Summary tab: the few lines that change how the stock reads, each linking to its detail. */
export function edgeCard(report: DailyReport): string {
  const e = report.edge;
  if (!e || !e.highlights.length) return '';
  const where: Record<string, string> = { insider: 'tab-flows', holder: 'tab-flows', value: 'tab-flows', surprise: 'tab-fundamentals', dividend: 'tab-fundamentals', buyback: 'tab-news', buybackSell: 'tab-news', contract: 'tab-news' };
  return `<section class="block edge-card"><div class="card"><div class="edge-k">놓치기 쉬운 정보</div><ul>${e.highlights.map((h) => `<li><a href="#${where[h.key] ?? 'tab-news'}"><span class="edge-ic" aria-hidden="true">${ICON[h.key] ?? '•'}</span><b class="${h.tone}">${esc(h.text)}</b><i aria-hidden="true">›</i></a></li>`).join('')}</ul>${e.nextEarnings ? `<p class="edge-next">다음 실적: <b>${esc(e.nextEarnings.period)}</b> · ${esc(e.nextEarnings.label)}</p>` : ''}</div></section>`;
}

/** 수급: insider (임원·주요주주) and 5% holder reports, and today's trading value against its average. */
export function edgeFlows(report: DailyReport, head = true): string {
  const e = report.edge;
  if (!e) return '';
  const ins = e.insider, us = currency() === 'USD';
  // G-194: Form 4 names and English titles are tidied; Korean filers (HD현대, (주)LG) show as filed.
  const who = (n: string) => (us ? personName(n) : n), pos = (t: string) => { const x = us ? shortTitle(t) : t; return x ? `${esc(x)} · ` : ''; };
  const insider = ins ? `<div class="card"><div class="head"><h2>임원·주요주주 보유 변화</h2><span class="sub">최근 90일 · ${currency() === 'USD' ? 'SEC Form 4 기준' : '소유보고 기준'}</span></div>
<p class="edge-sum"><b class="${ins.netShares > 0 ? 'up' : ins.netShares < 0 ? 'down' : ''}">${ins.netShares === 0 ? '변화 없음' : `${ins.netShares > 0 ? '보유 증가' : '보유 감소'} ${shares(ins.netShares)}`}</b>${ins.netValue != null && ins.netShares !== 0 ? ` · 지금 가격으로 약 ${eok(Math.abs(ins.netValue))}` : ''} · 늘린 보고 ${ins.buys}건 · 줄인 보고 ${ins.sells}건</p>
<ul class="ins-list">${ins.items.map((r) => `<li><div class="ins-who"><b>${esc(who(r.reporter))}</b><small>${pos(r.position || (r.isMajor ? '주요주주' : ''))}<a href="${r.url ?? dartViewerUrl(r.receiptNo)}" target="_blank" rel="noopener">보고 ${esc(r.date)}</a></small></div><div class="ins-n"><b class="${r.delta != null && r.delta > 0 ? 'up' : r.delta != null && r.delta < 0 ? 'down' : ''}">${r.delta == null ? '-' : shares(r.delta)}</b>${r.shares == null ? '' : `<small>보유 ${r.shares.toLocaleString('ko-KR')}주</small>`}</div></li>`).join('')}</ul>
<p class="fine">${currency() === 'USD' ? '장내 매수(P)·매도(S)만 더한 수량이에요. 주식 보상·옵션 행사·세금 납부용 처분은 뺐어요. 원문은 SEC에서 열려요.' : '보유 수량의 증감이에요. 장내 매매뿐 아니라 증여·상속·주식 보상도 포함될 수 있어 사유는 원문에서 확인하세요.'}</p></div>` : '';
  const holders = e.holders.length ? `<div class="card"><div class="head"><h2>5% 이상 대량보유</h2><span class="sub">최근 180일</span></div><ul class="ins-list">${e.holders.map((h) => `<li><div class="ins-who"><b>${esc(h.reporter)}</b><small>${h.reason ? `${esc(h.reason)} · ` : ''}<a href="${dartViewerUrl(h.receiptNo)}" target="_blank" rel="noopener">보고 ${esc(h.date)}</a></small></div><div class="ins-n"><b class="${h.ratioDelta != null && h.ratioDelta > 0 ? 'up' : h.ratioDelta != null && h.ratioDelta < 0 ? 'down' : ''}">${h.ratioDelta == null ? '-' : `${h.ratioDelta > 0 ? '+' : ''}${h.ratioDelta.toFixed(2)}%p`}</b>${h.ratio == null ? '' : `<small>보유 ${h.ratio.toFixed(2)}%</small>`}</div></li>`).join('')}</ul></div>` : '';
  const v = e.value;
  const value = v ? `<div class="card edge-value"><div class="head"><h2>거래대금</h2><span class="sub">종가×거래량 추정</span></div><p class="edge-sum">오늘 <b>${eok(v.today)}</b> · 20일 평균 ${eok(v.avg20)} · <b class="${v.ratio >= 2.5 ? 'up' : ''}">평소의 ${v.ratio.toFixed(1)}배</b></p></div>` : '';
  if (!insider && !holders && !value) return '';
  return `<section class="block edge-sec">${head ? '<div class="block-head"><h2>내부자·대량보유·거래대금</h2></div>' : ''}<div class="edge-grid">${insider}${holders}${value}</div></section>`;
}

/** G-179: a US stock has no investor flows; its Form 4 trades and trading value take the 수급 slot, on a covered page and a page filled on request alike. */
export function insiderSection(report: DailyReport): string {
  // G-194: one heading naming what is below, not a second one stacked under it.
  const body = edgeFlows(report, false), e = report.edge;
  const title = [e?.insider ? '내부자 거래' : '', e?.holders.length ? '대량보유' : '', e?.value ? '거래대금' : ''].filter(Boolean).join('·');
  return body ? `<section class="sub-sec" id="tab-flows"><h2 class="sub-h">${title}</h2>${body}</section>` : '';
}

/** 실적: surprises against the estimate stored before the release, dividends and when the next quarter comes. */
export function edgeFundamentals(report: DailyReport): string {
  const e = report.edge;
  if (!e) return '';
  const sur = e.surprises.length ? `<div class="card"><div class="head"><h2>실적 서프라이즈</h2><span class="sub">발표 전에 저장해 둔 예상치와 비교</span></div><div class="table-wrap"><table class="compact"><thead><tr><th>분기</th><th>항목</th><th class="num">실제</th><th class="num">발표 전 예상</th><th class="num">차이</th></tr></thead><tbody>${e.surprises.map((s) => `<tr><td class="nowrap">${qLabel(s.period)}</td><td>${esc(s.metric)}</td><td class="num">${s.actual.toLocaleString('ko-KR')}억</td><td class="num">${s.estimate.toLocaleString('ko-KR')}억<small class="muted"> (${esc(s.estimatedAt)})</small></td><td class="num ${s.pct > 0 ? 'up' : s.pct < 0 ? 'down' : ''}">${s.pct > 0 ? '+' : ''}${s.pct.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div></div>`
    : ''; // G-148: an empty card is left out (it only said there was nothing yet).
  const d = e.dividend;
  // G-300 (한서님 10/25): 배당 and 다음 실적 발표 share one 일정 card; the yield is in 투자 지표 (one place).
  const div = d ? `<h3 class="edge-h">배당</h3><ul class="edge-list">${d.dps != null ? `<li>최근 주당 배당금 <b>${won(d.dps)}</b>${d.payoutPct != null ? ` · 배당성향 ${d.payoutPct.toFixed(0)}%` : ''}</li>` : ''}${d.dpsEst != null ? `<li>올해 예상 <b>${won(d.dpsEst)}</b>${d.yieldEstPct != null ? ` (${d.yieldEstPct.toFixed(2)}%)` : ''} · 증권가 추정</li>` : ''}${d.decision ? `<li>최근 배당 결정 <a href="${dartViewerUrl(d.decision.receiptNo)}" target="_blank" rel="noopener">${esc(d.decision.date)} ${esc(d.decision.title)}</a></li>` : ''}</ul>` : '';
  const nx = e.nextEarnings ? `<h3 class="edge-h">다음 실적 발표</h3><p class="edge-sum"><b>${esc(e.nextEarnings.period)}</b> · ${esc(e.nextEarnings.label)}</p><p class="fine">${esc(e.nextEarnings.basis.replace(/[.]$/, ""))}. 정확한 날짜는 회사 공시로 확인하세요.</p>` : '';
  const plan = div || nx ? `<div class="card edge-plan"><div class="head"><h2>실적·배당 일정</h2></div>${div}${nx}</div>` : '';
  return sur || plan ? `<section class="block edge-sec"><div class="edge-grid">${plan}${sur}</div></section>` : '';
}

/**
 * 뉴스·공시: the surfaced filings with what they mean. G-172: the last 30 days are already in the 공시 list above,
 * so this card keeps the older ones (31~180 days) and no filing shows twice.
 */
export function edgeEvents(report: DailyReport): string {
  const e = report.edge, cut = new Date(Date.parse(`${report.date}T00:00:00Z`) - 30 * 864e5).toISOString().slice(0, 10);
  const older = (e?.events ?? []).filter((x) => x.date < cut);
  if (!older.length) return '';
  // G-300 (한서님 10/25): one 공시 card. The older filings follow the last 30 days inside it, and a run of the same filing
  // (임원·주요주주 보고서 nine times in a row) is one line with its count and dates that opens to show every one.
  // Tags are grey: red and blue mean a price going up or down everywhere else in the app.
  const runs: (typeof older)[] = [];
  for (const x of older) { const last = runs.at(-1); if (last && last[0]!.title === x.title && last[0]!.key === x.key) last.push(x); else runs.push([x]); }
  const one = (x: (typeof older)[number]) => `<a href="${dartViewerUrl(x.receiptNo)}" target="_blank" rel="noopener">${esc(x.title)}</a>`;
  const li = (r: typeof older) => r.length === 1
    ? `<li><span class="edge-tag">${esc(r[0]!.label)}</span>${one(r[0]!)}<small>${esc(r[0]!.date)} · ${esc(r[0]!.why)}</small></li>`
    : `<li class="edge-run"><details><summary><span class="edge-tag">${esc(r[0]!.label)}</span><b>${esc(r[0]!.title)} ${r.length}건</b><small>${esc(r.at(-1)!.date)} ~ ${esc(r[0]!.date)} · ${esc(r[0]!.why)}</small></summary><ul>${r.map((x) => `<li>${one(x)}<small>${esc(x.date)}</small></li>`).join('')}</ul></details></li>`;
  return `<h3 class="edge-h edge-old">31~180일 전 주요 공시</h3><ul class="edge-ev">${runs.map(li).join('')}</ul>`;
}


export const EDGE_CSS = `.edge-k{font-size:17px;font-weight:700;color:var(--fg);margin-bottom:6px}.edge-ic{display:inline-flex;align-items:center;justify-content:center;flex:none;width:34px;height:34px;border-radius:11px;background:var(--soft);color:var(--fg)}.edge-card li b.up,.edge-card li b.down{color:var(--fg)}.edge-card li b{font-weight:500}.edge-card ul{list-style:none;padding:0;margin:0}.edge-card li a{display:flex;align-items:center;gap:8px;padding:9px 2px;border-top:1px solid var(--line);text-decoration:none;color:inherit;font-size:14px;line-height:1.45}.edge-card li:first-child a{border-top:0}.edge-card li b{flex:1;font-weight:700}.edge-card li i{font-style:normal;color:var(--muted)}.edge-next{margin:8px 0 0;font-size:13px;color:var(--fg2)}
.edge-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:12px}.edge-grid>.card{min-width:0}.ins-list{list-style:none;padding:0;margin:0}.ins-list li{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 0;border-top:1px solid var(--line)}.ins-list li:first-child{border-top:0}.ins-who{flex:1;min-width:0}.ins-who b{display:block;font-size:14px;font-weight:700;line-height:1.35;overflow-wrap:anywhere}.ins-who small,.ins-n small{display:block;margin-top:2px;font-size:12px;color:var(--muted);line-height:1.4}.ins-who small a{color:inherit;white-space:nowrap}.ins-n{flex:none;text-align:right}.ins-n b{display:block;font-size:14px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}.ins-n small{white-space:nowrap;font-variant-numeric:tabular-nums}.edge-sum{font-size:14.5px;margin:4px 0 10px}.edge-h{margin:12px 0 4px;font-size:14px;color:var(--fg2)}.edge-plan .head+.edge-h{margin-top:2px}.edge-list{margin:0;padding-left:18px;line-height:1.8;font-size:14px}.edge-ev{list-style:none;padding:0;margin:0}.edge-ev li{padding:10px 0;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}.edge-ev li:first-child{border-top:0}.edge-ev a{font-weight:700;font-size:14px}.edge-ev small{flex-basis:100%;color:var(--muted);font-size:12px}.edge-old{margin:18px 0 2px;padding-top:14px;border-top:1px solid var(--line)}.edge-run details{width:100%}.edge-run summary{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline;cursor:pointer;list-style:none}.edge-run summary::-webkit-details-marker{display:none}.edge-run summary b{font-size:14px}.edge-run summary b::after{content:' ›';color:var(--muted);font-weight:400}.edge-run[open] summary b::after{content:' ⌄'}.edge-run ul{list-style:none;margin:6px 0 0;padding:0 0 0 10px;border-left:2px solid var(--line)}.edge-run ul li{padding:6px 0;border:0;display:block}.edge-run ul a{font-weight:600;font-size:13.5px}.edge-tag{font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px;background:var(--soft);color:var(--fg2)}.t-buybackSell{background:var(--soft);color:var(--fg2)}`;
