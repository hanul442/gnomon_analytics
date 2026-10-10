import {CREDIT_COST} from './plans.js';
// Screener (docs/DESIGN.md §5.12, G-43): every listed stock's free daily computation, filterable in the
// browser. Free: one preset and the top five rows. Plus: every condition and every row. Pro (coming):
// back-testing a condition. Data: site/screener.json, rebuilt every run.

import { US_EXCHANGE_LETTER } from '../sources/naverWorld.js';
import { ORBS } from './ui.js';
import { genButton } from './generateButton.js';
import type { StockCalc } from '../analysis/quickCalc.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { RiskFlag } from '../analysis/riskFilings.js';
import { FIELD_INDEX, FIELDS, matches, PRESETS, cleanScreen } from '../analysis/screenRules.js';
import { SEARCH_SCRIPT, shell } from './renderHtml.js';

/** Result orderings (G-119): every one sorts both ways with the direction button or by its column header. */
const SORTS: readonly [string, string][] = [['score', '기술 신호 점수'], ['chg', '오늘 등락률'], ['r20', '20거래일 등락률'], ['vol1', '거래량 급증'], ['spike10', '최근 10일 거래량 폭발'], ['tv', '거래대금'], ['tvr', '거래대금 급증'], ['ad', '매집 강도(A/D)'], ['gap', '적정가 대비'], ['cap', '시가총액'], ['price', '종가'], ['name', '이름']];

/**
 * One row per stock: [code, name, market, cap(억), close, change%, level, score×100, r5, r20, r120, fairGap%, position, covered,
 * vol1×, vol5×, vwapGap%, obv%, flow, tradingValue(억), hi52Gap%, risk level (0–3), risk labels,
 * lo52Gap%, tradingValue surge×, A/D%, spike10× (G-59)].
 */
export type ScreenerRow = [string, string, 'P' | 'Q', number | null, number, number | null, string, number | null, number | null, number | null, number | null, number | null, 'A' | 'I' | 'B' | null, 0 | 1,
  number | null, number | null, number | null, number | null, 'A' | 'D' | null, number | null, number | null, number, string,
  number | null, number | null, number | null, number | null];

export function screenerRows(universe: readonly UniverseRow[], calcs: ReadonlyMap<string, StockCalc>, covered: ReadonlySet<string>, risk: ReadonlyMap<string, RiskFlag> = new Map()): ScreenerRow[] {
  const r1 = (v: number | null | undefined) => (v == null ? null : Math.round(v * 10) / 10);
  return universe.filter((u) => calcs.has(u.symbol)).map((u) => {
    const c = calcs.get(u.symbol)!, vol = c.volume ?? null, rk = risk.get(u.symbol);
    const mv = (d: number) => r1(c.moves.find((m) => m.days === d)?.pct);
    return [u.symbol, u.name, u.market === 'KOSPI' ? 'P' : 'Q', u.marketCap == null ? null : Math.round(u.marketCap / 1e8), c.close, r1(u.changePct),
      c.signal.level ?? 'WITHHELD', c.signal.score == null ? null : Math.round(c.signal.score * 100), mv(5), mv(20), mv(120),
      c.fair ? r1(c.fair.gapPct) : null, c.fair ? (c.fair.position === 'ABOVE' ? 'A' : c.fair.position === 'BELOW' ? 'B' : 'I') : null, covered.has(u.symbol) ? 1 : 0,
      vol ? r1(vol.ratio1) : null, vol ? r1(vol.ratio5) : null, vol ? r1(vol.vwapGapPct) : null, vol ? Math.round(vol.obvPct) : null, vol?.flow === 'ACCUM' ? 'A' : vol?.flow === 'DIST' ? 'D' : null,
      u.tradingValue == null ? null : Math.round(u.tradingValue / 1e8), r1(c.hi52GapPct), rk?.level ?? 0, rk ? rk.labels.join('·') : '',
      r1(c.lo52GapPct), vol?.tvRatio1 == null ? null : r1(vol.tvRatio1), vol?.adPct == null ? null : Math.round(vol.adPct), vol?.spike10 == null ? null : r1(vol.spike10)];
  });
}

/**
 * G-191: one-tap filters. Each adds or removes one rule (or the risk and watchlist switches), so they stack with
 * the builder and the presets and stay editable there. `kinds` limits one to the markets that have its column.
 */
const QUICK: readonly { key: string; label: string; rule?: { f: string; op: '>=' | '<=' | '='; v: number | string }; kinds?: string; not?: string }[] = [
  { key: 'bull', label: '강세 신호', rule: { f: 'level', op: '=', v: 'BULL' } },
  { key: 'up', label: '오늘 오름', rule: { f: 'chg', op: '>=', v: 0.01 }, not: 'down' },
  { key: 'down', label: '오늘 내림', rule: { f: 'chg', op: '<=', v: -0.01 }, not: 'up' },
  { key: 'vol2', label: '거래량 2배↑', rule: { f: 'vol1', op: '>=', v: 2 } },
  { key: 'hi52', label: '52주 고점 근처', rule: { f: 'hi52', op: '>=', v: -5 } },
  { key: 'lo52', label: '52주 저점 근처', rule: { f: 'lo52', op: '<=', v: 10 }, kinds: 'stock' },
  { key: 'fairB', label: '적정가 아래', rule: { f: 'pos', op: '=', v: 'B' } },
  { key: 'r20up', label: '20일 +10%↑', rule: { f: 'r20', op: '>=', v: 10 }, not: 'r20dn' },
  { key: 'r20dn', label: '20일 −10%↓', rule: { f: 'r20', op: '<=', v: -10 }, not: 'r20up' },
  { key: 'accum', label: '매집 흔적', rule: { f: 'flow', op: '=', v: 'A' }, kinds: 'stock' },
  { key: 'cap1t', label: '시총 1조↑', rule: { f: 'cap', op: '>=', v: 10000 }, kinds: 'stock' },
  { key: 'tv100', label: '거래대금 100억↑', rule: { f: 'tv', op: '>=', v: 100 }, kinds: 'stock' },
  { key: 'norisk', label: '공시 위험 빼기', kinds: 'stock' },
  { key: 'watch', label: '☆ 관심 종목만' },
];

export function renderScreener(): string {
  // G-72: 찾기 — one place to find anything: search across stocks, ETFs and coins, then browse each
  // market with conditions. The ETF and coin pages became tabs here.
  const body = `<section class="find-head" id="top"><h1>자세히 검색</h1><div class="search-block" id="search"><label class="search-box"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="q" type="search" placeholder="종목·ETF·코인 이름이나 코드 (예: 삼성, ㅅㅅㅈㅈ, BTC)" autocomplete="off" aria-label="검색" aria-controls="search-results"></label>
<div id="search-results" class="card list search-results" role="region" aria-live="polite" hidden></div></div>
<nav class="find-tabs" role="tablist" aria-label="시장"><button type="button" role="tab" data-find="stock" aria-selected="true">주식 <span id="sc-count" class="muted"></span></button><button type="button" role="tab" data-find="us" aria-selected="false">미국 주식</button><button type="button" role="tab" data-find="etf" aria-selected="false">ETF</button><button type="button" role="tab" data-find="coin" aria-selected="false">코인</button><a href="reports.html">AI 리포트</a></nav></section>
<div id="find-stock"><div class="pl-chips sc-mkt" id="sc-mkt" role="group" aria-label="거래소"><button type="button" class="chip-toggle" data-mkt="" aria-pressed="true">전체</button><button type="button" class="chip-toggle" data-mkt="P" aria-pressed="false">코스피</button><button type="button" class="chip-toggle" data-mkt="Q" aria-pressed="false">코스닥</button></div><p class="muted small" id="sc-kind-note" hidden style="margin:6px 0 0">ETF·코인도 주식과 같은 조건으로 걸러요. 시가총액·외국인 수급·공시 항목은 없어서 그 조건은 빼고 봐요. 코인의 '유의 종목'은 공시 위험 2단계로 쳐요.</p>
<section class="block"><div class="pl-chips sc-presets" role="group" aria-label="빠른 조건"><button type="button" class="chip-toggle sc-filter-btn" id="sc-filter-open" aria-haspopup="dialog" aria-controls="sc-sheet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>필터<b id="sc-filter-n"></b></button>${PRESETS.map((p, i) => `<button type="button" class="chip-toggle" data-preset="${p.key}" aria-pressed="${i === 0}" title="${p.hint}">${p.label}${i ? ' <span class="lockmark">플러스</span>' : ''}</button>`).join('')}</div></section>
<div class="sc-make" role="group" aria-label="조건 만들기"><button type="button" class="sc-make-btn" id="sc-make-rule"><b>＋ 조건 직접 만들기</b><small>지표·수급·재무를 골라 조합해요</small></button><button type="button" class="sc-make-btn" id="sc-make-ai"><b>✦ AI로 조건 만들기</b><small>원하는 종목을 문장으로 적어요</small></button></div>
<section class="block sc-quick-wrap"><div class="sc-quick" id="sc-quick" role="group" aria-label="한 번에 거르기">${QUICK.map((q) => `<button type="button" class="sc-q" data-q="${q.key}"${q.kinds ? ` data-kinds="${q.kinds}"` : ''} aria-pressed="false">${q.label}</button>`).join('')}</div></section>
<div class="sc-sheet" id="sc-sheet" role="dialog" aria-label="필터"><div class="sc-sheet-head"><button type="button" class="sc-sheet-x" aria-label="필터 닫기">‹</button><b>필터</b></div>
<section class="block" id="ai-build"><div class="card"><div class="compact-heading"><b>AI 조건</b><small class="muted">제안 확인 후 적용</small></div><textarea id="ai-screen-q" class="ai-q" maxlength="600" rows="2" aria-label="원하는 종목 조건" placeholder="예: 거래량이 터졌는데 아직 많이 안 오른 코스닥 종목"></textarea><div class="ai-go">${genButton('조건 만들기', 'id="ai-screen-send"', `${CREDIT_COST.question}크레딧`)}</div><div id="ai-screen-out" aria-live="polite"></div></div></section>
<section class="block" id="build"><div class="card sc-form" id="sc-form">
<div class="sc-top"><b>조건</b><label class="sc-inline">조건을<select name="match"><option value="all">모두 만족</option><option value="any">하나라도 만족</option></select></label>
<label class="sc-inline"><input type="checkbox" name="norisk" checked> 공시 위험 2단계 이상 빼기</label>
</div>
<div class="rules" id="rules"></div>
<div class="sc-actions"><button type="button" class="chip-toggle" id="add-rule">+ 조건</button><button type="button" class="chip-toggle" id="save-screen">저장</button><span class="muted small" id="sc-desc"></span></div>
<div class="saved" id="saved" hidden><div class="pl-k">저장한 조건</div><div id="saved-list" class="saved-list"></div><p class="muted small" id="alert-note" hidden>🔔를 켜면 매일 장 마감 뒤 새로 걸린 종목을 알림으로 보내 드려요. 플러스는 3개, 프로·알파는 20개까지예요.</p></div>
<p class="muted small only-free" style="margin:8px 0 0">무료는 '강세 신호 상위'와 결과 5개까지예요. 조건 빌더, 저장, 알림, 전체 결과는 플러스부터예요.</p></div></section>
<div class="sc-sheet-foot"><button type="button" class="sc-sheet-go" id="sc-sheet-go">결과 보기</button></div></div>
<section class="block sc-results"><div class="card list"><div class="sc-active" id="sc-active" hidden></div><div class="sc-stats" id="sc-stats" hidden></div><div class="sc-sortbar"><span class="muted small" id="sc-n"></span><label class="sc-inline">정렬<select id="sc-sort" aria-label="정렬 기준">${SORTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label><button type="button" class="chip-toggle" id="sc-dir" title="정렬 방향 바꾸기">높은 순 ↓</button><span class="sc-tools"><button type="button" class="chip-toggle" id="sc-share" title="이 조건을 링크로 복사">링크 복사</button><button type="button" class="chip-toggle" id="sc-csv" title="결과를 CSV 파일로 받기">CSV</button></span></div><div class="table-wrap"><table class="compact sc-table"><thead><tr><th data-sk="name" aria-sort="none"><button type="button" class="th-sort">종목<i aria-hidden="true"></i></button></th><th class="num" data-sk="price" aria-sort="none"><button type="button" class="th-sort">종가<i aria-hidden="true"></i></button></th><th class="num" data-sk="chg" aria-sort="none"><button type="button" class="th-sort">오늘<i aria-hidden="true"></i></button></th><th data-sk="score" aria-sort="none"><button type="button" class="th-sort">기술 신호<i aria-hidden="true"></i></button></th><th class="num" data-sk="vol1" aria-sort="none"><button type="button" class="th-sort">거래량·거래대금<i aria-hidden="true"></i></button></th><th class="num" data-sk="r20" aria-sort="none"><button type="button" class="th-sort">20거래일<i aria-hidden="true"></i></button></th><th class="num" data-sk="gap" aria-sort="none"><button type="button" class="th-sort">적정가 대비<i aria-hidden="true"></i></button></th><th class="num" data-sk="cap" aria-sort="none"><button type="button" class="th-sort">시가총액<i aria-hidden="true"></i></button></th></tr></thead><tbody id="sc-body"><tr><td colspan="8"><div class="orbs-load">${ORBS}<span>종목 조회 중</span></div></td></tr></tbody></table></div>
<div class="sc-more only-free" id="sc-more" hidden><p>결과가 <b id="sc-total"></b>개 더 있어요. 전체 결과와 직접 조건은 플러스부터 볼 수 있어요.</p><a class="btn-primary" href="pricing.html">요금제 보기</a></div></div></section>
<style>/* G-185: the AI condition box: a full-width question, the same generate button as reports, busy inside the button. */
.ai-q{display:block;width:100%;font:inherit;padding:12px 14px;border:1px solid var(--line);border-radius:14px;background:var(--soft);color:var(--fg);resize:vertical;min-height:56px}.ai-q:focus{outline:none;border-color:var(--accent-line);box-shadow:0 0 0 3px var(--accent-soft)}.ai-go{display:flex;justify-content:flex-end;margin-top:10px}#ai-screen-out:not(:empty){margin-top:16px}#ai-screen-out:not(:empty):not(:has(.ai-res)){padding:12px 14px;border-radius:14px;background:var(--soft);font-size:14px;color:var(--fg2)}.ai-res{border:1px solid var(--line);border-radius:18px;padding:16px 18px;background:var(--soft);animation:mt-open var(--dur-slow) var(--ease-out)}.ai-res-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;margin-bottom:12px}.ai-res-head b{font-size:17px;line-height:1.35}.ai-res-n{font-size:12.5px;font-weight:700;color:var(--muted)}.ai-res-rules{list-style:none;margin:0 0 14px;padding:0;display:flex;flex-wrap:wrap;gap:8px}.ai-res-rules li{padding:7px 12px;border-radius:999px;background:var(--surface-solid);border:1px solid var(--line);font-size:13.5px;font-weight:700;line-height:1.3}.ai-res-why{margin:0 0 16px;font-size:14px;line-height:1.7;color:var(--fg2)}.ai-res-go{display:flex;flex-direction:column;gap:8px;padding-top:14px;border-top:1px solid var(--line)}.ai-res-go .btn-primary{width:100%;min-height:48px;font-size:15px}.ai-res-go small{text-align:center}@media (max-width:560px){.ai-go .gen-wrap,.ai-go .gen-btn{width:100%}}
/* G-191: one-tap filters (scroll sideways on a phone), the active conditions as chips, a summary strip, and the values the conditions looked at in each row. */
.sc-quick-wrap{margin-top:-6px}.sc-quick{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 4px;margin:0 -2px}.sc-quick::-webkit-scrollbar{display:none}.sc-q{flex:none;border:1px dashed var(--line-strong);background:transparent;color:var(--fg2);border-radius:999px;padding:6px 12px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}.sc-q[aria-pressed=true]{border-style:solid;border-color:var(--accent);background:var(--accent-soft);color:var(--accent-strong)}.sc-q[aria-pressed=true]::before{content:'✓ '}.sc-q[hidden]{display:none}
.sc-active{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:2px 0 12px;margin-bottom:10px;border-bottom:1px solid var(--line)}.sc-act-k{font-size:12px;font-weight:800;color:var(--muted);margin-right:2px}.sc-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--accent-line,var(--accent));background:var(--accent-soft);color:var(--fg);border-radius:999px;padding:5px 8px 5px 11px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.sc-chip i{font-style:normal;font-size:15px;line-height:1;color:var(--fg2)}.sc-chip:hover i{color:var(--up-strong)}.sc-clear{border:0;background:none;font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);text-decoration:underline;cursor:pointer;padding:5px 4px}
.sc-stats{margin:0 0 10px}.sc-st{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.sc-st span{display:flex;flex-direction:column;gap:2px;padding:9px 10px;border-radius:12px;background:var(--soft);min-width:0}.sc-st small{font-size:11px;color:var(--muted);white-space:nowrap}.sc-st b{font-size:15px;font-variant-numeric:tabular-nums;white-space:nowrap}.sc-st i{font-style:normal}.sc-st-bar{display:flex;height:5px;border-radius:3px;overflow:hidden;margin-top:8px;background:var(--soft)}.sc-st-bar i{display:block;height:100%}.sc-st-bar .u{background:var(--up)}.sc-st-bar .f{background:var(--line-strong)}.sc-st-bar .d{background:var(--down,var(--accent))}
.sc-hit{display:flex;flex-wrap:wrap;gap:3px 10px;margin:3px 0 1px;font-size:12px;color:var(--muted)}.sc-hit b,.sc-table td:nth-child(1) .sc-hit b{display:inline;font-size:12px;font-weight:800;color:var(--fg);font-variant-numeric:tabular-nums;white-space:nowrap}.sc-hit b.up{color:var(--up-strong)}.sc-hit b.down{color:var(--down-strong)}
.sc-tools{display:inline-flex;gap:6px}@media (max-width:520px){.sc-st{gap:4px}.sc-st span{padding:7px 6px;border-radius:10px}.sc-st small{font-size:10px}.sc-st b{font-size:13px}.sc-tools{flex-basis:100%;justify-content:flex-end}}
/* G-164: 필터 opens the conditions; on a phone they are a full-screen layer with 결과 보기 at the bottom. */
.sc-filter-btn{display:inline-flex;align-items:center;gap:5px}.sc-filter-btn svg{width:16px;height:16px}.sc-filter-btn b{min-width:18px;height:18px;border-radius:9px;background:var(--navy,#13294b);color:#fff;font-size:11px;display:inline-grid;place-items:center;padding:0 5px}.sc-filter-btn b:empty{display:none}
.sc-sheet-head{display:none;position:sticky;top:0;z-index:2;align-items:center;gap:6px;margin:0 -14px 6px;padding:calc(6px + env(safe-area-inset-top)) 10px 8px;background:var(--surface-solid);border-bottom:1px solid var(--line)}.sc-sheet-head b{font-size:17px}.sc-sheet-x{width:44px;height:44px;border:0;background:none;font-size:30px;line-height:1;cursor:pointer;color:var(--fg)}
.sc-sheet-foot{display:none;position:fixed;left:0;right:0;bottom:0;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:var(--surface-solid);border-top:1px solid var(--line)}.sc-sheet-go{width:100%;min-height:52px;border:0;border-radius:14px;background:var(--navy,#13294b);color:#fff;font:inherit;font-size:16px;font-weight:800;cursor:pointer}
/* G-197: the two 조건 만들기 entries. */
.sc-make{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0 14px}.sc-make-btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:12px 14px;border:1px solid var(--line-strong);border-radius:14px;background:var(--surface);color:var(--fg);font:inherit;cursor:pointer;min-height:56px;transition:transform var(--dur-fast,.12s) var(--ease-out,ease-out),border-color var(--dur-fast,.12s)}.sc-make-btn b{font-size:14.5px}.sc-make-btn small{font-size:12px;color:var(--muted);line-height:1.35}.sc-make-btn:hover{border-color:var(--accent)}.sc-make-btn:active{transform:scale(.97)}#sc-make-ai b{color:var(--accent-strong)}
/* G-151: on a phone the results come right after the quick chips (conditions follow), and each result is a two-line row: name and price, code and change, then the signal and volume. */
@media (max-width:600px){#find-stock{display:flex;flex-direction:column}#find-stock>.block{order:3}#find-stock>.block:first-of-type{order:1}#find-stock>.sc-results{order:2}#find-stock>.sc-quick-wrap{order:1}#find-stock>.sc-make{order:1}#find-stock>#sc-kind-note{order:0}#find-stock>.sc-sheet{order:3}
.sc-sheet:not(.open){display:none}.sc-sheet.open{position:fixed;inset:0;z-index:80;background:var(--page);background-image:var(--page-grad);overflow-y:auto;overscroll-behavior:contain;padding:0 14px calc(84px + env(safe-area-inset-bottom))}.sc-sheet.open .sc-sheet-head{display:flex}.sc-sheet.open .sc-sheet-foot{display:block}
.sc-table{min-width:0!important;width:100%}.sc-table thead{display:none}.sc-table,.sc-table tbody{display:block}.sc-table tr{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"n p" "n c" "s v";gap:3px 12px;padding:12px 2px;border-bottom:1px solid var(--line)}.sc-table td{border:0!important;padding:0!important;min-width:0}
.sc-table td:nth-child(1){grid-area:n}.sc-table td:nth-child(1) b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px}.sc-table td:nth-child(2){grid-area:p;font-weight:800;font-size:15px}.sc-table td:nth-child(3){grid-area:c;font-size:13.5px;display:block!important;text-align:right}.sc-table td:nth-child(2){text-align:right}.sc-table td:nth-child(4){grid-area:s;font-size:12.5px}.sc-table td:nth-child(5){grid-area:v;font-size:12.5px;color:var(--fg2)}.sc-table td:nth-child(5) .sub-sh{display:none}.sc-table td:nth-child(n+6){display:none}.sc-table td.empty{grid-column:1/-1}.sc-table tr.sc-more-row{display:block;border:0;padding:4px 0}.sc-table tr.sc-more-row td{display:block!important}}
.sc-top{display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center}.sc-top b{font-size:15px}.sc-inline{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--fg2)}
.sc-form select,.sc-form input:not([type=checkbox]){font:inherit;font-size:14px;color:var(--fg);border:1px solid var(--line-strong);border-radius:10px;padding:7px 9px;background:var(--surface);min-width:0}
.rules{display:flex;flex-direction:column;gap:8px;margin:12px 0}.rule{display:grid;grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr) 32px;gap:6px;align-items:center}.rule>*{min-width:0}.rule select,.rule input{width:100%;box-sizing:border-box}.rule .x{border:0;background:none;font-size:18px;color:var(--muted);cursor:pointer;min-width:36px;min-height:36px}.rule small{grid-column:1/-1;color:var(--muted);margin-top:-4px}
.sc-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.saved{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}.saved-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
.saved-list span{display:inline-flex;align-items:center;gap:2px;border:1px solid var(--line-strong);border-radius:999px;padding:2px 4px 2px 10px;background:var(--surface);font-size:13px}.saved-list button{border:0;background:none;cursor:pointer;font:inherit;padding:3px 5px}.saved-list .bell[aria-pressed=true]{color:var(--accent)}.saved-list .bell[aria-pressed=false]{opacity:.45}
html[data-plan=free] .rules,html[data-plan=free] .sc-actions,html[data-plan=free] .sc-top label{opacity:.5;pointer-events:none}.lockmark{font-size:10px;font-weight:700;background:var(--soft);color:var(--muted);border-radius:999px;padding:0 6px;margin-left:4px}html:not([data-plan=free]) .lockmark{display:none}
html[data-plan=free] .sc-table th:nth-child(7),html[data-plan=free] .sc-table td:nth-child(7){display:none}.sc-table td a{text-decoration:none}.sc-more{text-align:center;padding:14px 0 6px;border-top:1px solid var(--line)}.sc-more .btn-primary{display:inline-flex}
.sc-sortbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:2px 0 10px;border-bottom:1px solid var(--line);margin-bottom:4px}.sc-sortbar #sc-n{margin-right:auto}.sc-sortbar label{min-width:0}.sc-sortbar #sc-dir{white-space:nowrap;flex:none}@media (max-width:520px){.sc-sortbar #sc-n{flex-basis:100%}.sc-sortbar label{flex:1 1 0}.sc-sortbar label select{flex:1 1 0;min-width:0;width:100%}}.sc-sortbar select{font:inherit;font-size:14px;color:var(--fg);border:1px solid var(--line-strong);border-radius:10px;padding:7px 9px;background:var(--surface)}.th-sort{all:unset;cursor:pointer;display:inline-flex;align-items:center;gap:3px;white-space:nowrap}.th-sort:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}.th-sort i{font-style:normal;font-size:10px;color:var(--muted);min-width:8px}th[aria-sort=descending] .th-sort i::after{content:"▼";color:var(--accent-strong)}th[aria-sort=ascending] .th-sort i::after{content:"▲";color:var(--accent-strong)}th[aria-sort=descending] .th-sort,th[aria-sort=ascending] .th-sort{color:var(--fg)}
.risk{display:inline-block;margin-left:4px;font-size:11px;font-weight:700;border-radius:6px;padding:0 5px;background:var(--warn-soft);color:var(--warn-strong)}.risk.r3{background:var(--up-soft);color:var(--up-strong)}.risk.r1{background:var(--soft);color:var(--fg2)}.fl-a{color:var(--good-strong);font-size:11px;font-weight:700}.fl-d{color:var(--up-strong);font-size:11px;font-weight:700}
@media (max-width:820px){.rule{grid-template-columns:minmax(0,1fr) 80px minmax(0,1fr) 28px}.sc-table th:nth-child(3),.sc-table td:nth-child(3),.sc-table th:nth-child(8),.sc-table td:nth-child(8){display:none}}</style>
</div>
<script>if (/[?&]embed=1/.test(location.search)) { document.documentElement.classList.add('embed'); var bt = document.createElement('base'); bt.target = '_top'; document.head.appendChild(bt); }</script>
<style>html.embed .topbar,html.embed .bottom-nav,html.embed .chat-fab,html.embed .site-links,html.embed #sources,html.embed .find-head h1,html.embed .promo-bar,html.embed .fb-row{display:none!important}html.embed body{padding-bottom:0!important;background:var(--surface)}html.embed main{padding-top:4px}
.sc-mkt{margin:10px 0 0}.sc-mkt[hidden]{display:none}
.find-head{max-width:1180px;margin:14px auto 0;padding:0 24px}.find-head h1{font-size:24px;margin:4px 0 12px}.find-head .search-box{background:var(--surface);border:2px solid var(--navy)}.find-tabs{display:flex;gap:6px;margin:14px 0 4px;overflow-x:auto}.find-tabs>*{flex:none;border:1px solid var(--line-strong);background:var(--surface);border-radius:999px;padding:8px 16px;font:inherit;font-size:14.5px;font-weight:700;cursor:pointer;text-decoration:none;color:var(--fg)}.find-tabs [aria-selected=true]{background:var(--navy);color:var(--on-accent);border-color:var(--navy)}.find-tabs [aria-selected=true] .muted{color:inherit;opacity:.72}.find-tabs a{color:var(--accent-strong)}#find-stock .sc-presets{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}#find-stock .sc-presets>*{flex:none}@media (max-width:820px){.find-head{padding:0 14px}}</style>
<footer id="sources" style="padding:24px 0 0"><p>계산 결과이고, 투자 권유가 아니에요. 기술 신호는 오를 확률이 아니에요. 공시 위험은 제목으로 분류한 경고라 원문을 꼭 확인해 주세요.</p></footer>`;
  return shell('', '자세히 검색 | GNOMON', body, { active: 'screener', scripts: SCREENER_SCRIPT + SEARCH_SCRIPT + FIND_TABS_SCRIPT });
}

/** 찾기 tabs: 주식 is the screener; ETF and 코인 share one list. #etf / #coin open those tabs. */
const FIND_TABS_SCRIPT = `<script>
(function () {
  var tabs = [].slice.call(document.querySelectorAll('[data-find]'));
  var pick = function (k) {
    tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.getAttribute('data-find') === k)); });
    if (window.GNM_screenSource) window.GNM_screenSource(k);
  };
  tabs.forEach(function (t) { t.addEventListener('click', function () { var k = t.getAttribute('data-find'); pick(k); history.replaceState(null, '', k === 'stock' ? location.pathname : '#' + k); }); });
  var h = location.hash.slice(1); if (h === 'etf' || h === 'coin' || h === 'us') pick(h);
})();
</script>`;


const SCREENER_SCRIPT = `<script>
(function () {
  var FIELDS = ${JSON.stringify(FIELDS)}, IDX = ${JSON.stringify(FIELD_INDEX)}, PRESETS = ${JSON.stringify(Object.fromEntries(PRESETS.map((p) => [p.key, p.screen])))};
  var QUICK = ${JSON.stringify(QUICK)};
  // G-191: a rule in words (the active chips, the AI proposal card): 항목 값 단위 이상/이하, a category by its option name.
  var ruleText = function (x) { var f = field(x.f); if (!f) return ''; if (f.kind === 'cat') { var o = (f.options || []).filter(function (p) { return String(p[0]) === String(x.v); })[0]; return f.label + ' ' + (o ? o[1] : x.v) + (x.op === '!=' ? ' 아님' : ''); } return f.label + ' ' + Number(x.v).toLocaleString('ko-KR') + (f.unit && f.unit.charAt(0) !== '(' ? f.unit : '') + ' ' + (x.op === '<=' ? '이하' : '이상'); };
  var onlyWatch = false, watchSet = function () { var m = {}; try { (JSON.parse(localStorage.getItem('gnm-watch') || '[]') || []).forEach(function (x) { m[x] = 1; }); } catch (e) {} return m; };
  // A value in a result row, in the field's own unit (the rows show what the conditions looked at).
  var fieldVal = function (f, x, us) { if (x == null || x === '') return '—'; if (f.kind === 'cat') { var o = (f.options || []).filter(function (p) { return String(p[0]) === String(x); })[0]; return o ? o[1].replace(/[(].*[)]/, '') : String(x); } var n = Number(x); if (f.unit === '%') return (n > 0 ? '+' : '') + n.toFixed(1) + '%'; if (f.unit === '배') return n.toFixed(1) + '배'; if (f.unit === '억 원') return us ? '$' + Math.round(n).toLocaleString('en-US') + 'M' : Math.round(n).toLocaleString('ko-KR') + '억'; if (f.unit === '원') return us ? '$' + n.toFixed(2) : Math.round(n).toLocaleString('ko-KR') + '원'; return String(Math.round(n * 10) / 10); };
  var matches = ${matches.toString()};
  var $ = function (id) { return document.getElementById(id); };
  var form = $('sc-form'), el = function (n) { return form.querySelector('[name=' + n + ']'); }, rows = [], preset = 'top', SKEY = 'gnm-screens';
  var LEVEL = { STRONG_BULLISH: '강한 강세', BULLISH: '강세', SLIGHTLY_BULLISH: '약간 강세', NEUTRAL: '중립', SLIGHTLY_BEARISH: '약간 약세', BEARISH: '약세', STRONG_BEARISH: '강한 약세', WITHHELD: '보류' };
  var BULL = ['STRONG_BULLISH', 'BULLISH', 'SLIGHTLY_BULLISH'], BEAR = ['STRONG_BEARISH', 'BEARISH', 'SLIGHTLY_BEARISH'];
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var pct = function (v) { return v == null ? '—' : (v > 0 ? '+' : '') + v.toFixed(1) + '%'; };
  var tone = function (v) { return v == null || v === 0 ? '' : v > 0 ? 'up' : 'down'; };
  var SORT_COL = { name: 1, price: 4, chg: 5, score: 7, r20: 9, gap: 11, cap: 3, vol1: 14, tv: 19, tvr: 24, ad: 25, spike10: 26 }, ASC_FIRST = { name: 1, gap: 1 };
  var sortKey = 'score', sortAsc = false;
  try { var ss = JSON.parse(localStorage.getItem('gnm-sc-sort') || 'null'); if (ss && SORT_COL[ss.k] != null) { sortKey = ss.k; sortAsc = !!ss.asc; } } catch (e) {}
  var setSort = function (k, asc) { if (k === 'r20a') { k = 'r20'; asc = true; } if (SORT_COL[k] == null) return; sortKey = k; sortAsc = asc == null ? !!ASC_FIRST[k] : asc; try { localStorage.setItem('gnm-sc-sort', JSON.stringify({ k: sortKey, asc: sortAsc })); } catch (e) {} };
  var paintSort = function () {
    var sel = $('sc-sort'); if (sel) sel.value = sortKey;
    var dir = $('sc-dir'); if (dir) dir.textContent = sortKey === 'name' ? (sortAsc ? '가나다 ↑' : '가나다 역순 ↓') : sortAsc ? '낮은 순 ↑' : '높은 순 ↓';
    document.querySelectorAll('.sc-table th[data-sk]').forEach(function (th) { th.setAttribute('aria-sort', th.getAttribute('data-sk') === sortKey ? (sortAsc ? 'ascending' : 'descending') : 'none'); });
  };
  var free = function () { return (document.documentElement.getAttribute('data-plan') || 'free') === 'free'; };
  var field = function (k) { return FIELDS.filter(function (f) { return f.key === k; })[0]; };
  // The builder: one row per rule.
  var ruleRow = function (r) {
    var d = document.createElement('div'); d.className = 'rule';
    d.innerHTML = '<select data-k="f" aria-label="항목">' + FIELDS.map(function (f) { return '<option value="' + f.key + '">' + f.label + '</option>'; }).join('') + '</select><select data-k="op" aria-label="비교"></select><span data-k="vbox"></span><button type="button" class="x" aria-label="조건 빼기">×</button><small></small>';
    var fs = d.querySelector('[data-k=f]'), ops = d.querySelector('[data-k=op]'), vbox = d.querySelector('[data-k=vbox]');
    var setField = function (k, op, v) {
      var f = field(k); fs.value = k;
      ops.innerHTML = f.kind === 'cat' ? '<option value="=">이면</option><option value="!=">아니면</option>' : '<option value=">=">이상</option><option value="<=">이하</option>';
      if (op) ops.value = op;
      vbox.innerHTML = f.kind === 'cat' ? '<select data-k="v" aria-label="값">' + f.options.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select>' : '<input data-k="v" type="number" step="any" aria-label="값 (' + (f.unit || '') + ')" placeholder="' + (f.unit || '') + '">';
      if (v !== undefined) vbox.firstChild.value = v;
      d.querySelector('small').textContent = f.hint ? f.hint + (f.unit ? ' · 단위 ' + f.unit : '') : f.unit ? '단위 ' + f.unit : '';
    };
    setField(r.f, r.op, r.v);
    fs.addEventListener('change', function () { setField(fs.value); changed(); });
    d.querySelector('.x').addEventListener('click', function () { d.remove(); changed(); });
    $('rules').appendChild(d);
  };
  var current = function () {
    var rules = [].map.call(document.querySelectorAll('.rule'), function (d) {
      var f = d.querySelector('[data-k=f]').value, v = d.querySelector('[data-k=v]').value;
      return { f: f, op: d.querySelector('[data-k=op]').value, v: field(f).kind === 'num' ? (v === '' ? '' : Number(v)) : v };
    }).filter(function (r) { return r.v !== ''; });
    return { match: el('match').value, rules: rules, maxRisk: el('norisk').checked ? 2 : 0 };
  };
  var load = function (sc) {
    $('rules').innerHTML = ''; (sc.rules || []).forEach(ruleRow);
    el('match').value = sc.match || 'all'; el('norisk').checked = !!sc.maxRisk; draw();
  };
  // G-191: quick filters, the active conditions as removable chips, and a summary of what is left.
  var sameRule = function (a, b) { return a.f === b.f && a.op === b.op && String(a.v) === String(b.v); };
  var paintFilters = function (sc, out) {
    document.querySelectorAll('.sc-q').forEach(function (b) {
      var q = QUICK.filter(function (x) { return x.key === b.getAttribute('data-q'); })[0], kinds = b.getAttribute('data-kinds');
      b.hidden = !!kinds && kinds.split(',').indexOf(currentMarket) < 0;
      b.setAttribute('aria-pressed', String(!free() && (q.key === 'watch' ? onlyWatch : q.key === 'norisk' ? !!sc.maxRisk : sc.rules.some(function (r) { return sameRule(r, q.rule); }))));
    });
    var act = $('sc-active'), chips = sc.rules.map(function (r, i) { return '<button type="button" class="sc-chip" data-rm="' + i + '" aria-label="' + esc(ruleText(r)) + ' 조건 빼기">' + esc(ruleText(r)) + ' <i aria-hidden="true">×</i></button>'; });
    if (onlyWatch) chips.push('<button type="button" class="sc-chip" data-rm="watch" aria-label="관심 종목만 보기 끄기">관심 종목만 <i aria-hidden="true">×</i></button>');
    act.hidden = free() || !chips.length;
    act.innerHTML = '<span class="sc-act-k">' + (sc.match === 'any' && sc.rules.length > 1 ? '하나라도 맞으면' : '모두 맞으면') + '</span>' + chips.join('') + (chips.length > 1 ? '<button type="button" class="sc-clear" data-rm="all">모두 지우기</button>' : '');
    var st = $('sc-stats'), n = out.length; st.hidden = !n;
    if (!n) return;
    var up = 0, dn = 0, sum = 0, cnt = 0, s20 = 0, c20 = 0, bull = 0;
    out.forEach(function (r) { var c = r[5]; if (c != null) { sum += c; cnt++; if (c > 0) up++; else if (c < 0) dn++; } if (r[9] != null) { s20 += r[9]; c20++; } if (BULL.indexOf(r[6]) >= 0) bull++; });
    var fl = n - up - dn, pc = function (x) { return (x / n * 100).toFixed(1); }, sg = function (v) { return (v > 0 ? '+' : '') + v.toFixed(2) + '%'; };
    st.innerHTML = '<div class="sc-st"><span><small>오늘 평균</small><b class="' + tone(cnt ? sum / cnt : 0) + '">' + (cnt ? sg(sum / cnt) : '—') + '</b></span><span><small>20일 평균</small><b class="' + tone(c20 ? s20 / c20 : 0) + '">' + (c20 ? sg(s20 / c20) : '—') + '</b></span><span><small>강세 신호</small><b>' + Math.round(bull / n * 100) + '%</b></span><span><small>오늘 오른·내린</small><b><i class="up">' + up + '</i> · <i class="down">' + dn + '</i></b></span></div><div class="sc-st-bar" aria-hidden="true"><i class="u" style="width:' + pc(up) + '%"></i><i class="f" style="width:' + pc(fl) + '%"></i><i class="d" style="width:' + pc(dn) + '%"></i></div>';
  };
  $('sc-quick').addEventListener('click', function (e) {
    var b = e.target.closest('.sc-q'); if (!b) return;
    if (free()) { if (window.GNM) GNM.toast('한 번에 거르기는 플러스부터 쓸 수 있어요.'); return; }
    var q = QUICK.filter(function (x) { return x.key === b.getAttribute('data-q'); })[0];
    if (q.key === 'watch') { onlyWatch = !onlyWatch; draw(); return; }
    if (q.key === 'norisk') { el('norisk').checked = !el('norisk').checked; changed(); return; }
    var rowsEl = [].slice.call(document.querySelectorAll('.rule')), on = current().rules.some(function (r) { return sameRule(r, q.rule); });
    // Off: drop that rule. On: replace a rule on the same column and direction (one 거래량 condition, not two).
    // Its opposite (오늘 오름 ↔ 오늘 내림, 20일 ± 10%) goes too, so the two never sit together and empty the list.
    var other = q.not ? QUICK.filter(function (x) { return x.key === q.not; })[0].rule : null;
    rowsEl.forEach(function (d) { var f = d.querySelector('[data-k=f]').value, op = d.querySelector('[data-k=op]').value, v = d.querySelector('[data-k=v]').value; if (f === q.rule.f && (field(f).kind === 'cat' || op === q.rule.op) || other && sameRule({ f: f, op: op, v: v }, other)) d.remove(); });
    if (!on) ruleRow(q.rule);
    changed();
  });
  $('sc-active').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rm]'); if (!b) return; var k = b.getAttribute('data-rm');
    if (k === 'watch') { onlyWatch = false; draw(); return; }
    var rowsEl = [].slice.call(document.querySelectorAll('.rule')).filter(function (d) { return d.querySelector('[data-k=v]').value !== ''; });
    if (k === 'all') { document.querySelectorAll('.rule').forEach(function (d) { d.remove(); }); onlyWatch = false; } else if (rowsEl[Number(k)]) rowsEl[Number(k)].remove();
    changed();
  });
  // A link to these conditions (the page already opens ?screen=…), and the results as a CSV file.
  $('sc-share').addEventListener('click', function () {
    var url = location.origin + location.pathname + '?screen=' + encodeURIComponent(JSON.stringify(current())) + (currentMarket !== 'stock' ? '#' + currentMarket : '');
    var ok = function () { if (window.GNM) GNM.toast('조건 링크를 복사했어요.', 'success'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(ok, function () { prompt('이 링크를 복사하세요', url); }); else prompt('이 링크를 복사하세요', url);
  });
  $('sc-csv').addEventListener('click', function () {
    if (free()) { if (window.GNM) GNM.toast('CSV 받기는 플러스부터 쓸 수 있어요.'); return; }
    var sc = current(), mine = onlyWatch ? watchSet() : null, list = rows.filter(function (r) { return (currentMarket !== 'stock' || !mkt || r[2] === mkt) && (!mine || mine[r[0]]) && matches(r, sc, IDX); });
    var cols = [['코드', 0], ['이름', 1], ['종가', 4], ['오늘 등락(%)', 5], ['기술 신호', 6], ['신호 점수', 7], ['5일(%)', 8], ['20일(%)', 9], ['120일(%)', 10], ['적정가 대비(%)', 11], ['거래량 배수', 14], ['거래대금', 19], ['52주 고점 대비(%)', 20], ['52주 저점 대비(%)', 23], ['시가총액(억 원)', 3]];
    var NL = String.fromCharCode(10), q = function (v) { v = v == null ? '' : String(v); return /[",]/.test(v) || v.indexOf(NL) >= 0 ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var csv = String.fromCharCode(65279) + [cols.map(function (c) { return q(c[0]); }).join(',')].concat(list.map(function (r) { return cols.map(function (c) { return q(c[1] === 6 ? LEVEL[r[6]] || r[6] : r[c[1]]); }).join(','); })).join(NL);
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'gnomon-' + currentMarket + '-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    if (window.GNM) GNM.toast(list.length.toLocaleString('ko-KR') + '개 종목을 CSV로 받았어요.', 'success');
  });
  var changed = function () { preset = ''; document.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); draw(); };
  // G-154: 50 results at a time (200 at once ran 24 phone screens); a new condition starts from 50 again.
  var scShown = 50, lastKey = '';
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-sc-more]')) { scShown += 50; drawNow(); } });
  var mkt = '', mktBox = document.getElementById('sc-mkt');
  if (mktBox) mktBox.addEventListener('click', function (e) { var b = e.target.closest('[data-mkt]'); if (!b) return; mkt = b.getAttribute('data-mkt'); mktBox.querySelectorAll('[data-mkt]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); draw(); });
  var draw = function () { drawNow(); };
  var drawNow = function () {
    var sc = free() ? PRESETS.top : current();
    // G-176: 코스피/코스닥 chips narrow the stock list before the conditions run (ETF·코인·미국 have no exchange split).
    var mine = onlyWatch ? watchSet() : null;
    var out = rows.filter(function (r) { return (currentMarket !== 'stock' || !mkt || r[2] === mkt) && (!mine || mine[r[0]]) && matches(r, sc, IDX); }), total = out.length;
    paintFilters(sc, out);
    var key = JSON.stringify(sc) + '|' + rows.length + '|' + mkt + '|' + onlyWatch; if (key !== lastKey) { lastKey = key; scShown = 50; }
    // G-119: any result list sorts by any column, both directions; missing values always go last.
    var col = SORT_COL[sortKey], sorted = function (list) { return list.slice().sort(function (a, b) {
      var x = a[col], y = b[col];
      if (sortKey === 'name') return (sortAsc ? 1 : -1) * String(x).localeCompare(String(y), 'ko');
      if (x == null || !isFinite(x)) return y == null || !isFinite(y) ? 0 : 1; if (y == null || !isFinite(y)) return -1;
      return sortAsc ? x - y : y - x; }); };
    // Free sees the five best by signal score, in the order they picked.
    if (free()) { col = SORT_COL.score; var asc0 = sortAsc, k0 = sortKey; sortKey = 'score'; sortAsc = false; out = sorted(out).slice(0, 5); sortKey = k0; sortAsc = asc0; col = SORT_COL[sortKey]; }
    out = sorted(out); paintSort();
    var shown = out.slice(0, Math.min(200, scShown));
    $('sc-n').textContent = '결과 ' + total.toLocaleString('ko-KR') + '개' + (shown.length < total ? ' · ' + shown.length + '개 표시' : '');
    $('sc-count').textContent = rows.length.toLocaleString('ko-KR') + '종목 중 ' + total.toLocaleString('ko-KR') + '개';
    $('sc-desc').textContent = sc.rules.length + '개 조건' + (sc.maxRisk ? ' · 공시 위험 제외' : '');
    $('sc-filter-n').textContent = sc.rules.length ? String(sc.rules.length) : ''; $('sc-sheet-go').textContent = '결과 ' + total.toLocaleString('ko-KR') + '개 보기';
    // G-191: the columns the conditions (and the sort) looked at, shown in every row unless the row already has them.
    var SHOWN = { level: 1, market: 1, chg: 1, close: 1, vol1: 1 }, hitKeys = [];
    sc.rules.concat([{ f: { price: 'close', chg: 'chg', score: 'score', r20: 'r20', gap: 'fairGap', cap: 'cap', vol1: 'vol1', tv: 'tv', tvr: 'tvr', ad: 'ad', spike10: 'spike10' }[sortKey] || '' }]).forEach(function (x) { if (x.f && !SHOWN[x.f] && IDX[x.f] != null && hitKeys.indexOf(x.f) < 0 && hitKeys.length < 3) hitKeys.push(x.f); });
    $('sc-body').innerHTML = shown.length ? shown.map(function (r) {
      var href = r[2] === 'C' ? 'coin.html?m=' + r[0] : r[2] === 'U' ? 'us.html?s=' + encodeURIComponent(r[0]) : r[13] ? r[0] + '/index.html' : 'stock.html?c=' + r[0];
      var risk = r[21] ? '<span class="risk r' + r[21] + '" title="최근 30일 공시: ' + esc(r[22]) + '">⚠ ' + esc(r[22].split('·')[0]) + (r[22].indexOf('·') > 0 ? ' 외' : '') + '</span>' : '';
      var flow = r[18] === 'A' ? ' <span class="fl-a">매집</span>' : r[18] === 'D' ? ' <span class="fl-d">분산</span>' : '';
      var hits = hitKeys.map(function (k) { var f = field(k); return '<span>' + f.label.replace(/[(].*[)]/, '') + ' <b class="' + (f.unit === '%' ? tone(r[IDX[k]]) : '') + '">' + fieldVal(f, r[IDX[k]], r[2] === 'U') + '</b></span>'; }).join('');
      return '<tr><td><a href="' + href + '"><b>' + esc(r[1]) + '</b></a>' + risk + (hits ? '<div class="sc-hit">' + hits + '</div>' : '') + '<div class="muted small">' + (r[2] === 'C' ? r[0].replace('KRW-', '') : r[2] === 'U' ? r[0].replace(/${US_EXCHANGE_LETTER}/, '') : r[0]) + ' · ' + ({ P: '코스피', Q: '코스닥', E: 'ETF', C: '코인', U: '미국' }[r[2]] || '') + '</div></td><td class="num">' + (r[2] === 'U' ? '$' + r[4].toFixed(2) : Math.round(r[4]).toLocaleString('ko-KR')) + '</td><td class="num ' + tone(r[5]) + '">' + pct(r[5]) + '</td><td><span class="sig ' + (BULL.indexOf(r[6]) >= 0 ? 'up' : BEAR.indexOf(r[6]) >= 0 ? 'down' : '') + '">' + LEVEL[r[6]] + '</span></td><td class="num">' + (r[14] == null ? '—' : r[14].toFixed(1) + '배') + flow + (r[19] == null ? '' : '<small class="sub-sh">' + (r[2] === 'U' ? '$' + r[19].toLocaleString('en-US') + 'M' : r[19].toLocaleString('ko-KR') + '억') + (r[24] == null ? '' : ' · ' + r[24].toFixed(1) + '배') + '</small>') + '</td><td class="num ' + tone(r[9]) + '">' + pct(r[9]) + '</td><td class="num">' + pct(r[11]) + '</td><td class="num">' + (r[3] == null ? '—' : r[3] >= 10000 ? (r[3] / 10000).toFixed(1) + '조' : r[3].toLocaleString('ko-KR') + '억') + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="empty">조건에 맞는 종목이 없어요.</td></tr>';
    if (!free() && shown.length < Math.min(total, 200)) $('sc-body').insertAdjacentHTML('beforeend', '<tr class="sc-more-row"><td colspan="8"><button type="button" class="more-btn" data-sc-more>' + Math.min(50, Math.min(total, 200) - shown.length) + '개 더 보기 <small>' + shown.length + ' / ' + Math.min(total, 200) + '</small></button></td></tr>');
    var more = $('sc-more'); more.hidden = !(free() && total > 5); $('sc-total').textContent = (total - 5).toLocaleString('ko-KR');
  };
  document.querySelectorAll('[data-preset]').forEach(function (b, i) {
    b.addEventListener('click', function () {
      if (free() && i > 0) { if (window.GNM) window.GNM.toast('다른 빠른 조건은 플러스부터 쓸 수 있어요.'); return; }
      document.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      preset = b.getAttribute('data-preset'); load(PRESETS[preset]); preset = b.getAttribute('data-preset');
      var SORT_FOR = { bottomvol: 'spike10', volsurge: 'vol1', accum: 'ad' };
      if (SORT_FOR[preset] && !free()) { setSort(SORT_FOR[preset]); draw(); }
      document.querySelectorAll('[data-preset]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
    });
  });
  // G-164: 필터 — the conditions on a phone are a full-screen layer; on a wide screen the button scrolls to them.
  var sheet = $('sc-sheet'), phone = function () { return window.matchMedia('(max-width: 600px)').matches; };
  var openSheet = function () { if (!phone()) { sheet.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; } sheet.classList.add('open'); sheet.scrollTop = 0; document.body.classList.add('sheet-open'); var f = sheet.querySelector('.sc-sheet-x'); if (f) f.focus(); };
  var closeSheet = function () { if (!sheet.classList.contains('open')) return; sheet.classList.remove('open'); document.body.classList.remove('sheet-open'); $('sc-filter-open').focus(); var r = document.querySelector('.sc-results'); if (r) r.scrollIntoView({ block: 'start' }); };
  $('sc-filter-open').addEventListener('click', openSheet);
  sheet.querySelector('.sc-sheet-x').addEventListener('click', closeSheet); $('sc-sheet-go').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  $('add-rule').addEventListener('click', function () { ruleRow({ f: 'vol1', op: '>=', v: '' }); });
  // G-197: the builder lives in the filter sheet; these two buttons open it at the right place.
  var openAt = function (id, then) { openSheet(); setTimeout(function () { var el = $(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); if (then) then(); }, 60); };
  $('sc-make-rule').addEventListener('click', function () { openAt('build', function () { if (!document.querySelector('#rules > *')) $('add-rule').click(); var f = document.querySelector('#rules select, #rules input'); if (f) f.focus({ preventScroll: true }); }); });
  $('sc-make-ai').addEventListener('click', function () { openAt('ai-build', function () { var t = $('ai-screen-q'); if (t) t.focus({ preventScroll: true }); }); });
  // From the menu (조건 만들기): screener.html?make=rule or ?make=ai opens the builder straight away.
  var make = new URLSearchParams(location.search).get('make'); if (make === 'rule' || make === 'ai') setTimeout(function () { $(make === 'ai' ? 'sc-make-ai' : 'sc-make-rule').click(); }, 300);
  form.addEventListener('input', function (e) { if (e.target.closest('.rule') || e.target.name === 'match' || e.target.name === 'norisk') changed(); else draw(); });
  $('sc-sort').addEventListener('change', function (e) { setSort(e.target.value); draw(); });
  $('sc-dir').addEventListener('click', function () { setSort(sortKey, !sortAsc); draw(); });
  document.querySelectorAll('.sc-table th[data-sk]').forEach(function (th) { th.querySelector('button').addEventListener('click', function () { var k = th.getAttribute('data-sk'); setSort(k, k === sortKey ? !sortAsc : undefined); draw(); }); });
  // Saved screens: on the server with the alpha API (and alerts), otherwise in this browser.
  var api = function () { return window.GNM && GNM.api && GNM.me ? GNM : null; };
  var notify = function(msg,kind){if(window.GNM)GNM.toast(msg,kind||'success');};
  var local = function () { try { return JSON.parse(localStorage.getItem(SKEY) || '[]'); } catch (e) { return []; } };
  var drawSaved = function (list) {
    $('saved').hidden = !list.length; $('alert-note').hidden = !api();
    $('saved-list').innerHTML = list.map(function (x, i) { return '<span data-i="' + i + '"><button type="button" class="ld">' + esc(x.name) + '</button>' + (api() ? '<button type="button" class="bell" aria-pressed="' + !!x.alert + '" aria-label="알림">🔔</button>' : '') + '<button type="button" class="del" aria-label="삭제">×</button></span>'; }).join('');
    $('saved-list').querySelectorAll('[data-i]').forEach(function (el) {
      var x = list[Number(el.getAttribute('data-i'))];
      el.querySelector('.ld').addEventListener('click', function () { load(x.screen); notify('저장한 조건을 적용했어요.'); });
      el.querySelector('.del').addEventListener('click', function () {
        if (!confirm("'" + x.name + "' 조건을 지울까요?")) return;
        var button=this;button.disabled=true;
        var done=function(){notify('조건을 삭제했어요.');refreshSaved();};
        if(api())GNM.call('POST','/screens/'+x.id+'/delete').then(function(r){if(r.error){notify(r.message,'error');return;}done();}).catch(function(){notify('삭제하지 못했어요. 다시 시도해 주세요.','error');}).finally(function(){button.disabled=false;});
        else{var l=local();l.splice(Number(el.getAttribute('data-i')),1);try{localStorage.setItem(SKEY,JSON.stringify(l));done();}catch(e){notify('브라우저에 저장하지 못했어요.','error');}button.disabled=false;}
      });
      var bell = el.querySelector('.bell');
      if (bell) bell.addEventListener('click', function () { GNM.call('POST', '/screens/' + x.id, { alert: !x.alert }).then(function (r) { if (r.error) GNM.toast(r.message); else GNM.toast(!x.alert ? '매일 장 마감 뒤 새로 걸린 종목을 알려 드릴게요.' : '알림을 껐어요.', 'success'); refreshSaved(); }); });
    });
  };
  var refreshSaved = function () {
    if (api()) GNM.call('GET', '/screens').then(function (r) { if(r.error){notify(r.message,'error');return;}drawSaved(r.screens || []); }).catch(function(){notify('저장한 조건을 불러오지 못했어요.','error');});
    else drawSaved(local());
  };
  $('save-screen').addEventListener('click', function () {
    var sc = current(); if (!sc.rules.length) { if (window.GNM) GNM.toast('조건을 하나 이상 넣어 주세요.'); return; }
    var name = prompt('조건 이름', preset ? document.querySelector('[data-preset="' + preset + '"]').textContent.replace('플러스', '').trim() : '내 조건'); if (!name) return;
    var button=this;button.disabled=true;var busy=window.GNM_loading?GNM_loading.begin(form,'조건 저장 중','working'):null;
    var end=function(){button.disabled=false;if(busy)busy.end();};
    if(api())GNM.call('POST','/screens',{name:name,screen:sc}).then(function(r){if(r.error){notify(r.message,'error');return;}notify('조건을 저장했어요.');refreshSaved();}).catch(function(){notify('저장하지 못했어요. 다시 시도해 주세요.','error');}).finally(end);
    else{var l=local();l.push({name:name.slice(0,40),screen:sc});try{localStorage.setItem(SKEY,JSON.stringify(l.slice(-20)));notify('이 브라우저에 조건을 저장했어요.');refreshSaved();}catch(e){notify('브라우저에 저장하지 못했어요.','error');}end();}
  });
  $('ai-screen-send').addEventListener('click',function(){
    var q=$('ai-screen-q').value.trim(), out=$('ai-screen-out'), button=this;
    if(q.length<2){$('ai-screen-q').focus();return;}
    if(!window.GNM||!GNM.api||!GNM.me){out.textContent='로그인하고 AI 연결 후 이용할 수 있어요.';return;}
    if(button.dataset.job)return;out.innerHTML='';(window.gnmBusy||function(){})(button,'조건을 만드는 중');
    GNM.call('POST','/screens/compose',{question:q,market:currentMarket,screen:current()}).then(function(r){
      (window.gnmBusy||function(){})(button,false);
      if(r.error){out.textContent=r.message||'조건을 만들지 못했어요. 다시 요청해 주세요.';return;}
      // G-190: the proposal as a card: its name, each condition in words, why, then one clear button.
      var said=ruleText;
      var rulesTxt=(r.screen.rules||[]).map(said).filter(Boolean);
      out.innerHTML='<div class="ai-res"><div class="ai-res-head"><b>'+esc(r.name)+'</b><span class="ai-res-n">'+rulesTxt.length+'개 조건 · '+(r.screen.match==='any'?'하나라도':'모두')+' 맞으면</span></div>'
        +'<ul class="ai-res-rules">'+rulesTxt.map(function(t){return '<li>'+esc(t)+'</li>';}).join('')+(r.screen.maxRisk?'<li>공시 위험 종목 빼기</li>':'')+'</ul>'
        +(r.explanation?'<p class="ai-res-why">'+esc(r.explanation)+'</p>':'')
        +'<div class="ai-res-go"><button type="button" class="btn-primary" data-apply-ai>이 조건으로 찾기</button><small class="muted">적용한 뒤 아래 조건에서 고칠 수 있어요.</small></div></div>';
      out.querySelector('[data-apply-ai]').onclick=function(){load(r.screen);notify('AI 조건을 적용했어요.');this.textContent='적용했어요 ✓';this.disabled=true;$('ai-screen-q').placeholder='예: 결과가 너무 많아요. 거래대금이 큰 것만 남겨 줘요';var rs=$('rules');if(rs&&rs.scrollIntoView)rs.scrollIntoView({behavior:'smooth',block:'center'});};
      if(GNM.refresh)GNM.refresh();
    }).catch(function(){(window.gnmBusy||function(){})(button,false);out.textContent='연결이 끊겼어요. 다시 요청해 주세요.';});
  });
  (window.GNM && GNM.ready ? GNM.ready : Promise.resolve()).then(refreshSaved);
  // screener.html#value opens with that preset (links from the home feed).
  var start = document.querySelector('[data-preset="' + location.hash.slice(1).replace(/[^a-z]/g, '') + '"]') || document.querySelector('[data-preset="top"]');
  load(PRESETS.top);
  // G-82: ETFs and coins use the same filters. Their lists (etfs.json, coins.json) are mapped onto the
  // stock row's places; what they do not have (market cap, investor flows, filings) stays empty.
  var sourceTicket=0, currentMarket='stock';
  var cache = {}, LOADING = '<tr><td colspan="8" class="empty"><span class="orbs" aria-hidden="true"><i></i><i></i><i></i></span> 불러오는 중이에요.</td></tr>';
  var fromList = function (kind) { return function (x) { return [x[0], x[1], kind === 'coin' ? 'C' : kind === 'us' ? 'U' : 'E', null, x[4], x[5], x[6], x[7], x[8], x[9], x[10], x[13], x[14], 0, x[11], null, null, null, null, x[12], x[15], x[3] ? 2 : 0, x[3] ? '업비트 유의 종목' : '', null, null, null, null]; }; };
  var source = function (kind) {
    var url = kind === 'coin' ? 'coins.json' : kind === 'etf' ? 'etfs.json' : kind === 'us' ? 'usstocks.json' : 'screener.json';
    if (cache[url]) return Promise.resolve(cache[url]);
    $('sc-body').innerHTML = LOADING;
    return fetch(url).then(function (r) { return r.json(); }).then(function (d) { cache[url] = kind === 'stock' ? d.rows || [] : (d.rows || []).map(fromList(kind)); return cache[url]; });
  };
  window.GNM_screenSource = function (kind) {
    var ticket=++sourceTicket;currentMarket=kind;
    var note = document.getElementById('sc-kind-note'); if (note) note.hidden = kind === 'stock'; var mk = document.getElementById('sc-mkt'); if (mk) mk.hidden = kind !== 'stock';
    return source(kind).then(function (r) { if(ticket!==sourceTicket)return; rows = r; draw(); var shared=new URLSearchParams(location.search).get('screen');if(shared){try{var sc=(${cleanScreen.toString()})(JSON.parse(shared));if(sc)load(sc);}catch(e){}} }).catch(function () { $('sc-body').innerHTML = '<tr><td colspan="8" class="empty">목록을 불러오지 못했어요.</td></tr>'; });
  };
  var first = /^#(etf|coin|us)$/.test(location.hash) ? location.hash.slice(1) : 'stock';
  currentMarket=first; var firstTicket=++sourceTicket;source(first).then(function (r) { if(firstTicket!==sourceTicket)return; rows = r; var shared=new URLSearchParams(location.search).get('screen');if(shared){try{var sc=(${cleanScreen.toString()})(JSON.parse(shared));if(sc){load(sc);return;}}catch(e){}}  var note = document.getElementById('sc-kind-note'); if (note) note.hidden = first === 'stock'; if (start && start.getAttribute('data-preset') !== 'top' && !free()) start.click(); else draw(); }).catch(function () { $('sc-body').innerHTML = '<tr><td colspan="8" class="empty">계산 결과를 불러오지 못했어요.</td></tr>'; });
})();
</script>`;
