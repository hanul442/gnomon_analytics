// G-259: Bklit UI chart kit, finance charts. Each chart is redrawn as plain SVG in GNOMON's style (Bklit is MIT; only
// its look is borrowed, never its React code):
//   composed-chart — a quarter's 매출·영업이익 bars with the 영업이익률 line on its own right axis (기업 체력 › 재무제표 › 손익).
//   sankey-chart   — the latest year's 손익계산서 as a flow: 매출 → 매출원가 / 매출총이익 → 판관비 / 영업이익 → 당기순이익.
//   bar-depth      — the glossy face of every statement bar: a white catch at the tip, a soft shadow at the base.
//   radar-chart    — the 기업 체력 radar with round grid rings, a soft gradient fill and haloed dots.
// Everything renders finished as is; it only moves under html.mo (motion.ts sets it unless reduced motion is asked for).

import { esc } from '../html.js';
import { gradId, smoothD } from '../chartLook.js';

const f1 = (v: number) => v.toFixed(1);

// ---------------------------------------------------------------- bar-depth

/** The glass sheen laid over a bar's face (Bklit bar-depth): white catch at the tip, soft shadow at the base. */
export function depthDefs(id: string): string {
  const stop = (o: string, c: string, a: number) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`;
  return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stop('0', '#fff', 0.34)}${stop('.04', '#fff', 0.14)}${stop('.12', '#fff', 0.04)}${stop('.55', '#fff', 0)}${stop('1', '#000', 0.22)}</linearGradient>`
    + `<linearGradient id="${id}n" x1="0" y1="0" x2="0" y2="1">${stop('0', '#000', 0.22)}${stop('.45', '#fff', 0)}${stop('.88', '#fff', 0.04)}${stop('.96', '#fff', 0.14)}${stop('1', '#fff', 0.34)}</linearGradient>`;
}

/**
 * One bar in the depth look: the coloured face, then its glass on top. Both carry data-g and --i, so motion.ts grows them
 * together and lights them together; the glass never takes the pointer.
 */
export function depthBar(o: { x: number; y: number; w: number; h: number; neg: boolean; fill: string; g: number; i: number; title: string; glass: string }): string {
  const box = `x="${f1(o.x)}" y="${f1(o.y)}" width="${f1(o.w)}" height="${f1(o.h)}" rx="${Math.min(4, o.w / 3).toFixed(1)}"`;
  const at = `data-g="${o.g}" style="--i:${o.i}"`;
  return `<rect class="kf-face${o.neg ? ' neg' : ''}" ${at} ${box} fill="${o.fill}"><title>${esc(o.title)}</title></rect><rect class="kf-glass${o.neg ? ' neg' : ''}" ${at} ${box} fill="url(#${o.glass}${o.neg ? 'n' : ''})" aria-hidden="true"/>`;
}

// ---------------------------------------------------------------- composed-chart

export type ComposedInput = {
  labels: readonly string[];
  bars: readonly { label: string; color: string; values: readonly (number | null)[] }[];
  /** The line on the right axis, in percent. */
  line: { label: string; values: readonly (number | null)[] };
  /** "1.2조" for axis ticks; "1.2조원" for the touch bubble. */
  short: (v: number) => string;
  money: (v: number) => string;
};

/**
 * Bklit composed-chart: grouped bars on the left scale and a smooth line on its own right scale.
 * It wears motion.ts's .mo-bars contract (data-tip, rect[data-g]) so the bars grow and touch shows every value.
 */
export function composedChart(c: ComposedInput): string {
  const n = c.labels.length, all = c.bars.flatMap((b) => b.values).filter((v): v is number => v != null);
  const pv = c.line.values.map((v) => (v != null && Number.isFinite(v) ? v : null)), pAll = pv.filter((v): v is number => v != null);
  if (n < 2 || !all.length || pAll.length < 2) return '';
  // The plot spans the whole width (the ticks sit inside it), so motion.ts finds the touched quarter by width / count.
  const W = 320, H = 176, L = 0, R = 0, T = 18, B = 24, w = W - L - R, h = H - T - B;
  const max = Math.max(0, ...all), min = Math.min(0, ...all), span = max - min || 1, y = (v: number) => T + ((max - v) / span) * h, zero = y(0);
  const pMax = Math.max(0, ...pAll), pMin = Math.min(0, ...pAll), pr = pMax - pMin || 1, pTop = pMax + pr * 0.18, pBot = pMin - (pMin < 0 ? pr * 0.12 : 0);
  const py = (v: number) => T + ((pTop - v) / (pTop - pBot)) * h;
  const gw = w / n, ns = c.bars.length, bw = Math.min(18, (gw - 10) / ns), glass = gradId('kf-gl'), cx = (i: number) => L + (i + 0.5) * gw;
  // Left ticks: the top and the middle of the money scale (and the bottom when it goes below zero), as dashed rules.
  // The tick words are drawn after the bars (with a halo), so a tall bar never hides them.
  const ticks = [max, max / 2].filter((v) => v > 0);
  const grid = ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${f1(y(v))}" y2="${f1(y(v))}" class="kf-grid"/>`).join('');
  const lAxis = ticks.map((v) => `<text x="${L + 2}" y="${f1(y(v) - 4)}" class="kf-ax">${esc(c.short(v))}</text>`).join('');
  const pTicks = [pMax, ...(pMin < 0 ? [pMin] : [0])];
  const pAxis = [...new Set(pTicks)].map((v) => `<text x="${W - R - 2}" y="${f1(py(v) - 5)}" text-anchor="end" class="kf-ax kf-axr">${v.toFixed(Math.abs(pMax) < 10 ? 1 : 0)}%</text>`).join('');
  const rects = c.labels.map((lab, i) => c.bars.map((b, j) => {
    const v = b.values[i]; if (v == null) return '';
    const x0 = cx(i) - (bw * ns) / 2 + j * bw, top = v >= 0 ? y(v) : zero;
    return depthBar({ x: x0, y: top, w: bw - 2.5, h: Math.max(1, Math.abs(y(v) - zero)), neg: v < 0, fill: b.color, g: i, i: i * ns + j, title: `${lab} ${b.label} ${c.money(v)}`, glass });
  }).join('') + `<text x="${f1(cx(i))}" y="${H - 7}" text-anchor="middle" class="ig-bx">${esc(lab)}</text>`).join('');
  const pts = pv.map((v, i) => (v == null ? null : [cx(i), py(v)] as const)).filter((p): p is readonly [number, number] => !!p);
  const d = smoothD(pts.map((p) => `${f1(p[0])},${f1(p[1])}`).join(' '));
  const lastI = pv.map((v) => v != null).lastIndexOf(true), last = pv[lastI]!;
  const dots = pv.map((v, i) => (v == null ? '' : `<circle class="kf-pt" data-g="${i}" style="--i:${i}" cx="${f1(cx(i))}" cy="${f1(py(v))}" r="3.4"><title>${esc(c.labels[i]!)} ${esc(c.line.label)} ${v.toFixed(1)}%</title></circle>`)).join('');
  const lineSvg = `<g class="kf-line"><path d="${d}" class="kf-ln-h"/><path d="${d}" class="kf-ln"/></g>${dots}`;
  const tip = { y: c.labels, s: [...c.bars.map((b) => ({ l: b.label, c: b.color, v: b.values.map((v) => (v == null ? null : c.money(v))) })), { l: c.line.label, c: 'var(--accent)', v: pv.map((v) => (v == null ? null : `${v.toFixed(1)}%`)) }] };
  const aria = `${c.bars.map((b) => b.label).join('·')} 막대와 ${c.line.label} 선. 마지막 ${c.labels[lastI]} ${c.line.label} ${last.toFixed(1)}%`;
  return `<figure class="ig-bars mo-bars kf-cc" data-tip="${esc(JSON.stringify(tip))}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}"><defs>${depthDefs(glass)}</defs>${grid}<line x1="${L}" x2="${W - R}" y1="${f1(zero)}" y2="${f1(zero)}" class="ig-b0"/>${rects}${lineSvg}${lAxis}${pAxis}</svg>`
    + `<figcaption>${c.bars.map((b) => `<span><i style="background:${b.color}"></i>${esc(b.label)}</span>`).join('')}<span><i class="kf-lsw"></i>${esc(c.line.label)}<small>오른쪽 눈금</small></span></figcaption></figure>`;
}

// ---------------------------------------------------------------- sankey-chart

export type IncomeFlow = {
  year: string;
  rev: number | null; cogs: number | null; gp: number | null; op: number | null; net: number | null;
  short: (v: number) => string;
};
type SkNode = { id: string; col: number; v: number; kind: 'm' | 'c' | 'g'; label: string };

/**
 * The year's 손익계산서 as a Bklit sankey: what is left of 매출 at each step and what each step costs.
 * Only drawn when the numbers read as a flow (매출 > 0, 0 < 영업이익 < 매출, 매출총이익 between them); a step whose rows are
 * missing is left out, and a year without a positive 순이익 ends at 영업이익. Otherwise nothing.
 */
export function incomeSankey(f: IncomeFlow): string {
  const { rev, op } = f;
  if (rev == null || !(rev > 0) || op == null || !(op > 0) || !(op < rev)) return '';
  let gp = f.gp ?? (f.cogs != null ? rev - Math.abs(f.cogs) : null);
  if (gp != null && !(gp > op && gp < rev)) gp = null;
  const net = f.net != null && f.net > 0 ? f.net : null;
  const nodes: SkNode[] = [{ id: 'rev', col: 0, v: rev, kind: 'm', label: '매출' }], links: [string, string, number][] = [];
  let c = 1;
  if (gp != null) { nodes.push({ id: 'gp', col: c, v: gp, kind: 'm', label: '매출총이익' }, { id: 'cogs', col: c, v: rev - gp, kind: 'c', label: '매출원가' }); links.push(['rev', 'gp', gp], ['rev', 'cogs', rev - gp]); c++; }
  const from = gp != null ? 'gp' : 'rev', fromV = gp ?? rev;
  nodes.push({ id: 'op', col: c, v: op, kind: 'm', label: '영업이익' });
  if (net != null && net > op) nodes.push({ id: 'gain', col: c, v: net - op, kind: 'g', label: '영업외 이익' });
  nodes.push({ id: 'opex', col: c, v: fromV - op, kind: 'c', label: gp != null ? '판관비' : '영업비용' });
  links.push([from, 'op', op], [from, 'opex', fromV - op]);
  if (net != null) {
    c++;
    nodes.push({ id: 'net', col: c, v: net, kind: 'm', label: '당기순이익' });
    if (net <= op) { if (op - net > 0) nodes.push({ id: 'tax', col: c, v: op - net, kind: 'c', label: '법인세·기타' }); links.push(['op', 'net', net]); if (op - net > 0) links.push(['op', 'tax', op - net]); }
    else links.push(['op', 'net', op], ['gain', 'net', net - op]);
  }
  const cols = c + 1, W = 340, NW = 8, LBL = 30, PH = 150, PAD = 12, labelRoom = 92;
  const colX = (k: number) => (k * (W - labelRoom - NW)) / (cols - 1);
  const byCol = Array.from({ length: cols }, (_, k) => nodes.filter((x) => x.col === k));
  const maxN = Math.max(...byCol.map((x) => x.length)), maxSum = Math.max(...byCol.map((x) => x.reduce((a, b) => a + b.v, 0)));
  const s = (PH - PAD * (maxN - 1)) / maxSum;
  const geo = new Map<string, { x: number; y: number; h: number; out: number; in: number }>();
  byCol.forEach((ns) => { let yy = LBL; ns.forEach((x) => { const hh = Math.max(2, x.v * s); geo.set(x.id, { x: colX(x.col), y: yy, h: hh, out: 0, in: 0 }); yy += hh + PAD; }); });
  const H = Math.ceil(Math.max(...[...geo.values()].map((g) => g.y + g.h)) + 4);
  // Shares under 10% keep one decimal (a thin margin should not read as 0%).
  const share = (v: number) => { const p = (v / rev) * 100; return p < 10 ? String(Math.round(p * 10) / 10) : String(Math.round(p)); };
  const pct = (v: number) => `${share(v)}%`;
  const kindOf = new Map(nodes.map((x) => [x.id, x]));
  const tipOf = (x: SkNode) => `<b>${esc(x.label)}</b> ${esc(f.short(x.v))}${x.id === 'rev' ? '' : ` · 매출의 ${pct(x.v)}`}`;
  const ribbons = links.map(([a, b, v], i) => {
    const ga = geo.get(a)!, gb = geo.get(b)!, th = Math.max(1, v * s), x0 = ga.x + NW, x1 = gb.x, xm = (x0 + x1) / 2;
    const y0 = ga.y + ga.out, y1 = gb.y + gb.in; ga.out += th; gb.in += th;
    const gid = gradId('kf-skg'), A = kindOf.get(a)!, Bn = kindOf.get(b)!;
    const d = `M${f1(x0)},${f1(y0)}C${f1(xm)},${f1(y0)} ${f1(xm)},${f1(y1)} ${f1(x1)},${f1(y1)}L${f1(x1)},${f1(y1 + th)}C${f1(xm)},${f1(y1 + th)} ${f1(xm)},${f1(y0 + th)} ${f1(x0)},${f1(y0 + th)}Z`;
    return { defs: `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f1(x0)}" x2="${f1(x1)}" y1="0" y2="0"><stop offset="0" class="g-${A.kind}"/><stop offset="1" class="g-${Bn.kind}"/></linearGradient>`,
      path: `<path class="kf-sk-l" d="${d}" fill="url(#${gid})" data-a="${a}" data-b="${b}" data-tip="${esc(`${esc(A.label)} → <b>${esc(Bn.label)}</b> ${esc(f.short(v))}`)}" style="--c:${A.col}"/>`, i };
  });
  // Labels: a main node's name and value sit above it (they all start at the top); a cost's beside it, pushed apart in a column.
  const labels: string[] = [];
  byCol.forEach((ns) => {
    let lastY = -1e9;
    ns.forEach((x) => {
      const g = geo.get(x.id)!, tx = g.x + (x.kind === 'm' ? 0 : NW + 5), val = `${f.short(x.v)}${x.id === 'rev' ? '' : ` · ${pct(x.v)}`}`;
      if (x.kind === 'm') { labels.push(`<text x="${f1(tx)}" y="12" class="kf-sk-n">${esc(x.label)}</text><text x="${f1(tx)}" y="24" class="kf-sk-v">${esc(val)}</text>`); return; }
      let cy = Math.max(g.y + g.h / 2, lastY + 24); cy = Math.min(cy, H - 14); lastY = cy;
      labels.push(`<text x="${f1(tx)}" y="${f1(cy - 2)}" class="kf-sk-n k-${x.kind}">${esc(x.label)}</text><text x="${f1(tx)}" y="${f1(cy + 10)}" class="kf-sk-v">${esc(val)}</text>`);
    });
  });
  const rects = nodes.map((x) => { const g = geo.get(x.id)!; return `<rect class="kf-sk-node n-${x.kind}" data-id="${x.id}" data-tip="${esc(tipOf(x))}" x="${f1(g.x)}" y="${f1(g.y)}" width="${NW}" height="${f1(g.h)}" rx="2.5" style="--c:${x.col}"/>`; }).join('');
  const opP = share(op), netP = net == null ? null : share(net);
  const cap = netP != null ? `매출 100원 중 영업이익으로 ${opP}원, 순이익으로 ${netP}원이 남았어요.` : `매출 100원 중 영업이익으로 ${opP}원이 남았어요.`;
  const aria = `${f.year}년 손익 흐름. ${nodes.map((x) => `${x.label} ${f.short(x.v)}`).join(', ')}`;
  return `<figure class="kf-sk"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}" tabindex="0"><defs>${ribbons.map((r) => r.defs).join('')}</defs><g class="kf-sk-ls">${ribbons.map((r) => r.path).join('')}</g>${rects}<g class="kf-sk-t" aria-hidden="true">${labels.join('')}</g></svg><figcaption class="ig-note">${esc(cap)} 막대나 띠를 눌러 보세요.</figcaption></figure>`;
}

// ---------------------------------------------------------------- radar-chart

export type RadarAxis = { label: string; score: number | null };

/**
 * Bklit radar: round grid rings, quiet spokes, a soft gradient fill with a glowing edge and haloed dots.
 * Keeps motion.ts's contract (.ig-radar, .area, .dot[data-i]) and its centre (110, 104).
 */
export function radarChart(axes: readonly RadarAxis[]): string {
  const cx = 110, cy = 104, r = 78, n = axes.length;
  const pt = (i: number, v: number) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v] as const; };
  const xy = (p: readonly [number, number]) => `${f1(p[0])},${f1(p[1])}`;
  const shape = axes.map((a, i) => xy(pt(i, Math.max(0.04, (a.score ?? 0) / 100)))).join(' ');
  const labels = axes.map((a, i) => { const [x, y] = pt(i, 1.2); return `<text x="${f1(x)}" y="${f1(y + 4)}" text-anchor="middle" class="${a.score == null ? 'na' : ''}">${esc(a.label)}</text>`; }).join('');
  // Same scores, same id: the same report renders the same page (two equal radars share an identical gradient).
  const gid = `ig-rg-${axes.map((a) => (a.score == null ? 'x' : Math.round(a.score))).join('-')}`;
  const rings = [0.25, 0.5, 0.75, 1].map((v) => `<circle cx="${cx}" cy="${cy}" r="${f1(r * v)}" class="grid${v === 1 ? ' edge' : ''}"/>`).join('');
  const spokes = axes.map((a, i) => `<line x1="${cx}" y1="${cy}" x2="${f1(pt(i, 1)[0])}" y2="${f1(pt(i, 1)[1])}" class="grid spoke${a.score == null ? ' na' : ''}"/>`).join('');
  const dots = axes.map((a, i) => (a.score == null ? '' : `<circle cx="${f1(pt(i, a.score / 100)[0])}" cy="${f1(pt(i, a.score / 100)[1])}" r="4" class="dot" data-i="${i}" style="--i:${i}"><title>${esc(a.label)} ${Math.round(a.score)}점</title></circle>`)).join('');
  return `<svg class="ig-radar kf-radar" viewBox="0 0 220 210" role="img" aria-label="${axes.map((a) => `${a.label} ${a.score == null ? '자료 없음' : Math.round(a.score) + '점'}`).join(', ')}"><defs><radialGradient id="${gid}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" class="s0"/><stop offset=".7" class="s1"/><stop offset="1" class="s2"/></radialGradient></defs>
${rings}${spokes}<text x="${cx + 3}" y="${f1(cy - r * 0.5 - 2)}" class="lv">50</text><polygon points="${shape}" class="area" fill="url(#${gid})"/>${dots}${labels}</svg>`;
}

// ---------------------------------------------------------------- CSS

const HI = Array.from({ length: 8 }, (_, i) => `.kf-cc[data-hi="${i}"] .kf-pt[data-g="${i}"]`).join(',');

export const KIT_FINANCE_CSS = `
.kf-glass{pointer-events:none}
.kf-cc .kf-grid{stroke:var(--line-strong);stroke-width:1;stroke-dasharray:2 4}.kf-ax{font-size:9.5px;font-weight:600;fill:var(--muted);font-variant-numeric:tabular-nums;paint-order:stroke;stroke:var(--surface-solid);stroke-width:3px;stroke-linejoin:round}.kf-axr{fill:var(--accent)}
.kf-cc .kf-ln-h{fill:none;stroke:var(--surface-solid);stroke-width:5.5;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
.kf-cc .kf-ln{fill:none;stroke:var(--accent);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 4px color-mix(in srgb,var(--accent) 45%,transparent))}
.kf-cc .kf-pt{fill:var(--surface-solid);stroke:var(--accent);stroke-width:2;transition:r .15s,opacity .15s}${HI}{r:5.5px;fill:var(--accent)}
.kf-cc figcaption small{margin-left:4px;font-size:11px;color:var(--muted)}.kf-cc figcaption .kf-lsw{width:14px;height:3px;border-radius:2px;background:var(--accent);vertical-align:3px}
html.mo .kf-cc:not(.mo-in) .kf-line{clip-path:inset(0 100% 0 0)}html.mo .kf-cc.mo-in .kf-line{clip-path:inset(0 0 0 0);transition:clip-path 1.2s var(--ease-out) .35s}
html.mo .kf-cc:not(.mo-in) .kf-pt{opacity:0}html.mo .kf-cc.mo-in .kf-pt{transition:opacity .3s calc(.5s + var(--i,0) * 110ms),r .15s}
.kf-sk{margin:6px 0 4px;position:relative}.kf-sk svg{width:100%;max-width:520px;height:auto;display:block;touch-action:pan-y;cursor:pointer}.kf-sk svg:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:8px}
.kf-sk .g-m{stop-color:var(--accent)}.kf-sk .g-c{stop-color:var(--muted)}.kf-sk .g-g{stop-color:#f04452}
.kf-sk-l{opacity:.38;transition:opacity .15s}html[data-theme=dark] .kf-sk-l{opacity:.5}.kf-sk-node{transition:opacity .15s}.kf-sk .n-m{fill:var(--accent)}.kf-sk .n-c{fill:var(--muted)}.kf-sk .n-g{fill:#f04452}
.kf-sk[data-on] svg .kf-sk-l{opacity:.1}.kf-sk[data-on] .kf-sk-node{opacity:.35}.kf-sk[data-on] .kf-sk-l.on{opacity:.62}.kf-sk[data-on] .kf-sk-node.on{opacity:1}
.kf-sk-t text{paint-order:stroke;stroke:var(--surface-solid);stroke-width:3px;stroke-linejoin:round;pointer-events:none}.kf-sk-n{font-size:10.5px;font-weight:800;fill:var(--fg)}.kf-sk-n.k-c{fill:var(--fg2)}.kf-sk-n.k-g{fill:#f04452}.kf-sk-v{font-size:9.5px;font-weight:600;fill:var(--muted);font-variant-numeric:tabular-nums}
html.mo .kf-sk:not(.mo-in) .kf-sk-l{clip-path:inset(0 100% 0 0)}html.mo .kf-sk.mo-in .kf-sk-l{clip-path:inset(0 0 0 0);transition:clip-path .8s var(--ease-out) calc(var(--c,0) * 260ms + 120ms),opacity .15s}
html.mo .kf-sk:not(.mo-in) .kf-sk-node,html.mo .kf-sk:not(.mo-in) .kf-sk-t{opacity:0}html.mo .kf-sk.mo-in .kf-sk-node{transition:opacity .35s calc(var(--c,0) * 260ms)}html.mo .kf-sk.mo-in .kf-sk-t{transition:opacity .5s .9s}
.kf-radar .grid{fill:none;stroke:var(--line-strong);stroke-width:1;stroke-opacity:.75}.kf-radar .grid.edge{stroke-opacity:1}.kf-radar .spoke{stroke-dasharray:2 3;stroke-linecap:round}.kf-radar .spoke.na{stroke-opacity:.4}
.kf-radar .lv{font-size:8.5px!important;font-weight:600!important;fill:var(--muted)!important}
.kf-radar .area{stroke:var(--accent);stroke-width:2;stroke-linejoin:round;filter:drop-shadow(0 0 8px color-mix(in srgb,var(--accent) 40%,transparent))}
.kf-radar .s0{stop-color:var(--accent);stop-opacity:.1}.kf-radar .s1{stop-color:var(--accent);stop-opacity:.28}.kf-radar .s2{stop-color:var(--accent);stop-opacity:.42}
.kf-radar .dot{fill:var(--accent);stroke:var(--surface-solid);stroke-width:2}.kf-radar .dot.hi{r:6.5px}
.kf-radar text{font-size:12px;font-weight:700;fill:var(--fg2)}.kf-radar text.na{fill:var(--muted)}
@media (max-width:820px){.ig-health .kf-radar .lv{display:none}}
`;

// ---------------------------------------------------------------- page script

/** The sankey plays when it is well on screen, and a finger or a mouse on a node or a ribbon lights its path and says its value. */
export const KIT_FINANCE_JS = `;(function(){
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io=!reduce&&'IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){var el=e.target;if(!e.isIntersecting){el.classList.remove('mo-in');return;}if(e.intersectionRatio>=0.4)el.classList.add('mo-in');});},{threshold:[0,0.4,0.7]}):null;
  var wire=function(fig){
    var svg=fig.querySelector('svg');if(!svg)return;if(io)io.observe(fig);else fig.classList.add('mo-in');
    var tp=document.createElement('div');tp.className='mo-tip';tp.hidden=true;tp.setAttribute('role','status');if(getComputedStyle(fig).position==='static')fig.style.position='relative';fig.appendChild(tp);
    var nodes=[].slice.call(svg.querySelectorAll('.kf-sk-node')),links=[].slice.call(svg.querySelectorAll('.kf-sk-l')),cur=-1;
    var off=function(){cur=-1;fig.removeAttribute('data-on');nodes.concat(links).forEach(function(x){x.classList.remove('on');});tp.hidden=true;};
    var on=function(el){
      fig.setAttribute('data-on','');nodes.concat(links).forEach(function(x){x.classList.remove('on');});el.classList.add('on');
      var id=el.getAttribute('data-id');
      if(id){links.forEach(function(l){if(l.getAttribute('data-a')===id||l.getAttribute('data-b')===id)l.classList.add('on');});}
      else{nodes.forEach(function(nd){var k=nd.getAttribute('data-id');if(k===el.getAttribute('data-a')||k===el.getAttribute('data-b'))nd.classList.add('on');});}
      tp.innerHTML=el.getAttribute('data-tip')||'';tp.hidden=false;
      var r=el.getBoundingClientRect(),f=fig.getBoundingClientRect(),w=tp.offsetWidth,x=r.left-f.left+r.width/2,y=r.top-f.top;
      tp.style.left=Math.max(w/2+2,Math.min(fig.clientWidth-w/2-2,x))+'px';tp.classList.toggle('below',y-tp.offsetHeight-12<0);tp.style.top=(y-tp.offsetHeight-12<0?r.bottom-f.top:y)+'px';
    };
    var pick=function(e){var t=e.target.closest&&e.target.closest('.kf-sk-node,.kf-sk-l');if(t)on(t);else if(e.pointerType!=='mouse')off();};
    svg.addEventListener('pointerover',pick);svg.addEventListener('pointerdown',pick);
    svg.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse')off();});
    svg.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'||e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();var d=e.key==='ArrowRight'||e.key==='ArrowDown'?1:-1;cur=cur<0?(d>0?0:nodes.length-1):(cur+d+nodes.length)%nodes.length;on(nodes[cur]);}else if(e.key==='Escape')off();});
    svg.addEventListener('blur',off);
    document.addEventListener('pointerdown',function(e){if(!fig.contains(e.target))off();});
  };
  var seen=typeof WeakSet==='function'?new WeakSet():null;
  var scan=function(){document.querySelectorAll('.kf-sk').forEach(function(f){if(seen?seen.has(f):f.dataset.kfSeen)return;if(seen)seen.add(f);else f.dataset.kfSeen='1';wire(f);});};
  var q=false;new MutationObserver(function(){if(q)return;q=true;setTimeout(function(){q=false;scan();},120);}).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan);else scan();
})();`;
