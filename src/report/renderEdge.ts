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
const ICON: Record<string, string> = { insider: '👤', surprise: '📊', buyback: '🔁', buybackSell: '📤', holder: '🏦', contract: '📝', value: '🔊', dividend: '💰', earnings: '📊', ir: '🎤' };

/** Summary tab: the few lines that change how the stock reads, each linking to its detail. */
export function edgeCard(report: DailyReport): string {
  const e = report.edge;
  if (!e || !e.highlights.length) return '';
  const where: Record<string, string> = { insider: 'tab-flows', holder: 'tab-flows', value: 'tab-flows', surprise: 'tab-fundamentals', dividend: 'tab-fundamentals', buyback: 'tab-news', buybackSell: 'tab-news', contract: 'tab-news' };
  return `<section class="block edge-card"><div class="card"><div class="edge-k">놓치기 쉬운 정보</div><ul>${e.highlights.map((h) => `<li><a href="#${where[h.key] ?? 'tab-news'}"><span aria-hidden="true">${ICON[h.key] ?? '•'}</span><b class="${h.tone}">${esc(h.text)}</b><i aria-hidden="true">›</i></a></li>`).join('')}</ul>${e.nextEarnings ? `<p class="edge-next">다음 실적: <b>${esc(e.nextEarnings.period)}</b> · ${esc(e.nextEarnings.label)}</p>` : ''}</div></section>`;
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
  const div = d ? `<div class="card"><div class="head"><h2>배당</h2></div><ul class="edge-list">${d.dps != null ? `<li>최근 주당 배당금 <b>${won(d.dps)}</b>${d.yieldPct != null ? ` · 지금 가격 기준 <b>${d.yieldPct.toFixed(2)}%</b>` : ''}${d.payoutPct != null ? ` · 배당성향 ${d.payoutPct.toFixed(0)}%` : ''}</li>` : ''}${d.dpsEst != null ? `<li>올해 예상 <b>${won(d.dpsEst)}</b>${d.yieldEstPct != null ? ` (${d.yieldEstPct.toFixed(2)}%)` : ''} · 증권가 추정</li>` : ''}${d.decision ? `<li>최근 배당 결정 <a href="${dartViewerUrl(d.decision.receiptNo)}" target="_blank" rel="noopener">${esc(d.decision.date)} ${esc(d.decision.title)}</a></li>` : ''}</ul></div>` : '';
  const nx = e.nextEarnings ? `<div class="card"><div class="head"><h2>다음 실적 발표</h2></div><p class="edge-sum"><b>${esc(e.nextEarnings.period)}</b> · ${esc(e.nextEarnings.label)}</p><p class="fine">${esc(e.nextEarnings.basis.replace(/[.]$/, ""))}. 정확한 날짜는 회사 공시로 확인하세요.</p></div>` : '';
  return sur || div || nx ? `<section class="block edge-sec"><div class="block-head"><h2>실적·배당 일정</h2></div><div class="edge-grid">${sur}${div}${nx}</div></section>` : '';
}

/**
 * 뉴스·공시: the surfaced filings with what they mean. G-172: the last 30 days are already in the 공시 list above,
 * so this card keeps the older ones (31~180 days) and no filing shows twice.
 */
export function edgeEvents(report: DailyReport): string {
  const e = report.edge, cut = new Date(Date.parse(`${report.date}T00:00:00Z`) - 30 * 864e5).toISOString().slice(0, 10);
  const older = (e?.events ?? []).filter((x) => x.date < cut);
  if (!older.length) return '';
  return `<section class="block edge-sec"><div class="block-head"><h2>지난 주요 공시</h2><span class="muted small">31~180일 전 · 실적·배당·자사주·지분·수주</span></div><div class="card"><ul class="edge-ev">${older.map((x) => `<li><span class="edge-tag t-${x.key}">${esc(x.label)}</span><a href="${dartViewerUrl(x.receiptNo)}" target="_blank" rel="noopener">${esc(x.title)}</a><small>${esc(x.date)} · ${esc(x.why)}</small></li>`).join('')}</ul></div></section>`;
}


export const EDGE_CSS = `.edge-card .card{border-left:4px solid var(--navy)}.edge-k{font-size:12px;font-weight:800;color:var(--accent-strong);margin-bottom:6px}.edge-card ul{list-style:none;padding:0;margin:0}.edge-card li a{display:flex;align-items:center;gap:8px;padding:9px 2px;border-top:1px solid var(--line);text-decoration:none;color:inherit;font-size:14px;line-height:1.45}.edge-card li:first-child a{border-top:0}.edge-card li b{flex:1;font-weight:700}.edge-card li i{font-style:normal;color:var(--muted)}.edge-next{margin:8px 0 0;font-size:13px;color:var(--fg2)}
.edge-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:12px}.edge-grid>.card{min-width:0}.ins-list{list-style:none;padding:0;margin:0}.ins-list li{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 0;border-top:1px solid var(--line)}.ins-list li:first-child{border-top:0}.ins-who{flex:1;min-width:0}.ins-who b{display:block;font-size:14px;font-weight:700;line-height:1.35;overflow-wrap:anywhere}.ins-who small,.ins-n small{display:block;margin-top:2px;font-size:12px;color:var(--muted);line-height:1.4}.ins-who small a{color:inherit;white-space:nowrap}.ins-n{flex:none;text-align:right}.ins-n b{display:block;font-size:14px;font-weight:800;white-space:nowrap;font-variant-numeric:tabular-nums}.ins-n small{white-space:nowrap;font-variant-numeric:tabular-nums}.edge-sum{font-size:14.5px;margin:4px 0 10px}.edge-list{margin:0;padding-left:18px;line-height:1.8;font-size:14px}.edge-ev{list-style:none;padding:0;margin:0}.edge-ev li{padding:10px 0;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:4px 8px;align-items:baseline}.edge-ev li:first-child{border-top:0}.edge-ev a{font-weight:700;font-size:14px}.edge-ev small{flex-basis:100%;color:var(--muted);font-size:12px}.edge-tag{font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px;background:var(--soft);color:var(--fg2)}.t-earnings,.t-contract{background:var(--down-soft);color:var(--down-strong)}.t-dividend,.t-buyback{background:var(--up-soft);color:var(--up-strong)}.t-insider,.t-holder{background:var(--warn-soft);color:var(--warn-strong)}.t-buybackSell{background:var(--soft);color:var(--fg2)}`;
