// G-295 (한서님 10/24 "이슈랑 세계지도 있는거 잘쓰려면", 목업 ①②③): the world map and the issue ranking as one.
// The map keeps its colours (each country's index move) and gets issue pins numbered by the region's best issue rank.
// Home's 오늘 이슈 card shows a small map with the pins; home's 시장 opens with the big map and a row per region.
// A pin or row opens a bottom sheet: the region's issues, its index (or oil for the Middle East), and the Korean
// stocks people look at alongside, with today's moves. The moves are side by side, never a cause or a pick.

import { esc } from './html.js';
import { kmWorldMapAll, type WorldMapPin } from './kit/worldMap.js';
import { marketsOf, worldMapRows } from './renderWorld.js';
import { ISSUE_REGIONS, sectorsOf, TOPIC_LINKS } from '../analysis/issueRegions.js';
import type { MergedIssue } from './issuesAll.js';
import type { WorldMarkets } from '../sources/naverGlobal.js';
import type { UniverseRow } from '../sources/naverList.js';

export interface IssueMapInput { issues: readonly MergedIssue[]; world: WorldMarkets | null | undefined; universe: readonly UniverseRow[] | null | undefined }
export interface IssueMapParts { mini: string; card: string; sheets: string }

const signed = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}%`;
const toneOf = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');
const arrow = (v: number) => `${v > 0 ? '▲' : v < 0 ? '▼' : ''} ${Math.abs(v).toFixed(1)}%`;

interface Stock { symbol: string; name: string; sector: string; change: number | null; href: string }

/** The pins, the small and big maps and one sheet per region; null with no issue that has a region. */
export function issueMapParts(inp: IssueMapInput): IssueMapParts | null {
  const byRegion = new Map<string, MergedIssue[]>();
  for (const i of inp.issues) if (i.region) byRegion.set(i.region, [...(byRegion.get(i.region) ?? []), i]);
  const regions = ISSUE_REGIONS.filter((r) => byRegion.has(r.id)).sort((a, b) => byRegion.get(a.id)![0]!.rank - byRegion.get(b.id)![0]!.rank);
  if (!regions.length) return null;
  const rows = inp.world ? worldMapRows(inp.world.indices) : [];
  const rowOf = new Map(rows.map((r) => [r.iso, r] as const));
  const mk = inp.world ? marketsOf(inp.world) : null;
  const uni = new Map((inp.universe ?? []).map((u) => [u.symbol, u] as const));
  const pins: WorldMapPin[] = regions.map((r) => ({ id: r.id, n: byRegion.get(r.id)![0]!.rank, x: r.x, y: r.y, label: r.name }));
  const total = regions.reduce((n, r) => n + byRegion.get(r.id)!.length, 0);

  /** The region's own number: its index move, or a market (oil) when it has no index. */
  const lineOf = (r: (typeof regions)[number]): { text: string; move: string; tone: string } | null => {
    const e = r.iso ? rowOf.get(r.iso) : undefined;
    if (e) return { text: e.index, move: e.change == null ? '' : signed(e.change), tone: toneOf(e.change) };
    const m = r.market ? mk?.get(r.market) : undefined;
    return m ? { text: m.name, move: m.move, tone: m.tone } : null;
  };

  const stocksOf = (list: readonly MergedIssue[], region: string): Stock[] => {
    const out: Stock[] = [], seen = new Set<string>();
    const add = (s: Stock) => { if (!seen.has(s.symbol) && out.length < 6) { seen.add(s.symbol); out.push(s); } };
    // Korean issues name their stocks; world issues bring the sectors of their topics.
    for (const i of list) i.symbols.forEach((sym, k) => {
      const c = i.chips[k], u = uni.get(sym);
      add({ symbol: sym, name: c?.name ?? u?.name ?? sym, sector: '뉴스에 나온 종목', change: u?.changePct ?? null, href: c?.href ?? `stock.html?c=${encodeURIComponent(sym)}` });
    });
    // Only this region's topics: an oil story that also names China lists refiners here, cosmetics under 중국.
    for (const sec of sectorsOf(list.flatMap((i) => i.topics).filter((t) => TOPIC_LINKS[t]?.region === region))) for (const [sym, name] of sec.stocks) {
      add({ symbol: sym, name, sector: sec.name, change: uni.get(sym)?.changePct ?? null, href: `stock.html?c=${encodeURIComponent(sym)}` });
    }
    return out;
  };

  const issueRow = (i: MergedIssue) => `<a class="im-ir" href="issue/${esc(i.key)}.html"><b>${i.rank}</b><span>${esc(i.ko ?? i.title)}</span></a>`;
  const sheets = regions.map((r) => {
    const list = byRegion.get(r.id)!, line = lineOf(r), stocks = stocksOf(list, r.id);
    const kr = stocks.length
      ? `<h3 class="im-sub">같은 날 한국에선</h3>${stocks.map((s) => `<a class="im-st" href="${esc(s.href)}"><span><b>${esc(s.name)}</b><small>${esc(s.sector)}</small></span><b class="${toneOf(s.change)}">${s.change == null ? '' : arrow(s.change)}</b></a>`).join('')}<p class="im-fine">같은 날 함께 움직인 값이에요. 뉴스가 원인이라는 뜻이 아니에요. 종목을 누르면 위원회 판단으로 가요.</p>`
      : '';
    return `<template id="im-${r.id}"><p class="im-k">이슈 ${list.length}개 · 가장 높은 순위 ${list[0]!.rank}위</p><h2 class="im-t">${esc(r.name)}</h2>${line ? `<p class="im-line">${esc(line.text)} <b class="${line.tone}">${esc(line.move)}</b></p>` : ''}<div class="im-irs">${list.slice(0, 4).map(issueRow).join('')}</div>${kr}</template>`;
  }).join('');

  const mini = `<div class="im-mini">${kmWorldMapAll(rows, '', { plain: true, pins })}<p class="im-cap">번호는 이슈 순위예요. 누르면 그 지역 이슈와 한국에서 함께 움직인 종목이 떠요.</p></div>`;
  const regionRows = regions.map((r) => {
    const line = lineOf(r), n = byRegion.get(r.id)!.length;
    return `<button type="button" class="im-row" data-im="${r.id}"><span><b>${esc(r.name)}</b>${line ? `<small>${esc(line.text)} <i class="${line.tone}">${esc(line.move)}</i></small>` : ''}</span><span class="im-n">이슈 ${n}</span></button>`;
  });
  // Countries that moved a lot with no issue: worth a look exactly because no news explains them.
  const quiet = rows.filter((e) => e.iso !== 'EU' && e.change != null && Math.abs(e.change) >= 1 && !regions.some((r) => r.iso === e.iso))
    .sort((a, b) => Math.abs(b.change!) - Math.abs(a.change!)).slice(0, 2)
    .map((e) => `<div class="im-row q"><span><b>${esc(e.country)}</b><small>${esc(e.index)} <i class="${toneOf(e.change)}">${signed(e.change!)}</i></small></span><span class="im-n o">이슈 없음</span></div>`);
  const card = `<section class="card wd-card im-card"><div class="wd-h"><h2>세계 이슈 지도</h2><span class="muted small">하루 등락 · 이슈 ${total}개</span></div>${kmWorldMapAll(rows, '', { plain: true, pins })}<div class="im-legend"><span><i class="up"></i>오름 <i class="down"></i>내림</span><span><i class="pin"></i>이슈 순위</span></div><div class="im-rows">${[...regionRows, ...quiet].join('')}</div>${quiet.length ? '<p class="im-fine">이슈 없음은 많이 움직였는데 모인 뉴스가 없는 곳이에요.</p>' : ''}</section>`;
  return { mini, card, sheets };
}

export const ISSUE_MAP_CSS = `<style>
.im-mini{margin:-2px 0 6px}.im-mini .wm-map{margin:0}.im-cap{margin:6px 2px 0;font-size:15px;color:var(--muted);line-height:1.45}
.im-legend{display:flex;justify-content:space-between;gap:8px;margin:8px 2px 2px;font-size:15px;color:var(--muted)}.im-legend i{display:inline-block;width:9px;height:9px;border-radius:5px;vertical-align:-1px;margin:0 3px 0 6px}.im-legend i:first-child{margin-left:0}
.im-legend i.up{background:#f04452}.im-legend i.down{background:#3182f6}.im-legend i.pin{background:var(--fg)}
.im-rows{margin-top:6px}.im-row{display:flex;width:100%;justify-content:space-between;align-items:center;gap:10px;min-height:56px;padding:8px 2px;border:0;border-top:1px solid var(--line);background:none;font:inherit;color:inherit;text-align:left;cursor:pointer}
.im-row.q{cursor:default}.im-row span:first-child{display:flex;flex-direction:column;gap:2px;min-width:0}.im-row b{font-size:17px}.im-row small{font-size:15.5px;color:var(--muted)}.im-row small i{font-style:normal;font-weight:700}
.im-n{flex:none;font-size:15px;font-weight:800;padding:3px 9px;border-radius:8px;background:var(--fg);color:var(--surface-solid)}.im-n.o{background:var(--soft);color:var(--fg2)}
.im-k{margin:0;font-size:15.5px;font-weight:700;color:var(--muted)}.im-t{margin:2px 0 4px;font-size:22px;font-weight:800;letter-spacing:-.4px}
.im-line{margin:0 0 6px;font-size:16px;color:var(--fg2)}.im-line b{font-variant-numeric:tabular-nums}
.im-irs{display:flex;flex-direction:column}.im-ir{display:grid;grid-template-columns:24px minmax(0,1fr);gap:8px;align-items:start;padding:10px 0;border-top:1px solid var(--line);color:inherit;text-decoration:none}.im-ir:first-child{border-top:0}
.im-ir b{display:grid;place-items:center;width:22px;height:22px;border-radius:11px;background:var(--fg);color:var(--surface-solid);font-size:12.5px;font-weight:800}.im-ir span{font-size:17px;font-weight:600;line-height:1.45;word-break:keep-all}
.im-sub{margin:12px 0 2px;font-size:16px;font-weight:800}
.im-st{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:52px;border-top:1px solid var(--line);color:inherit;text-decoration:none}.im-st:first-of-type{border-top:0}
.im-st span{display:flex;flex-direction:column;gap:1px}.im-st span b{font-size:17px}.im-st small{font-size:15px;color:var(--muted)}.im-st>b{font-size:17px;font-variant-numeric:tabular-nums}
.im-fine{margin:8px 0 0;font-size:15px;line-height:1.45;color:var(--muted);word-break:keep-all}
.im-sheet{overflow:auto}
</style>`;

/** Opens a region's sheet from a pin or row (the kit sheet's look, its own dialog). */
export const ISSUE_MAP_JS = `<script>
(function () {
  if (typeof HTMLDialogElement !== 'function') return;
  var dlg = null;
  var open = function (id) {
    var t = document.getElementById('im-' + id);
    if (!t) return;
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'gsh-sheet im-sheet'; dlg.setAttribute('aria-label', '지역 이슈');
      dlg.innerHTML = '<div class="gsh-grab" aria-hidden="true"></div><div style="display:flex;justify-content:flex-end;margin:-6px 0 -30px"><button type="button" class="gsh-x" aria-label="닫기">×</button></div><div class="im-body"></div>';
      document.body.appendChild(dlg);
      dlg.querySelector('.gsh-x').addEventListener('click', function () { dlg.close(); });
      dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    }
    var body = dlg.querySelector('.im-body');
    body.innerHTML = '';
    body.appendChild(t.content.cloneNode(true));
    dlg.showModal();
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-im]');
    if (b) { e.preventDefault(); open(b.getAttribute('data-im')); }
  });
})();
</script>`;
