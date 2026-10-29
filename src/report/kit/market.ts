// G-265: Bklit UI chart kit, market charts, redrawn as plain SVG in GNOMON's look (Bklit is MIT; only its look is copied).
//   kmDonut      pie-chart       a ring of slices with the total in the middle (오늘 오른·보합·내린 종목)
//   kmGauge      gauge-chart     a notched arc lit from neutral toward the reading (시장 온도: 강세 − 약세)
//   kmNotchArc   gauge-chart     the same notches for the stock page's semicircle gauges (renderMarket miniGauge)
//   kmHeatmap    heatmap-chart   업종 × 테마 tiles coloured by today's move (themes page, drawn in the browser)
//   kmSunburst   sunburst-chart  업종 (inner ring) → 대표 종목 (outer ring), sized by 시가총액 (themes page)
//   kmWorldMap   choropleth      the countries GNOMON has an index for, coloured by its move (market daily)
//   kmStatArea   stat-card-area  big number, trend badge and a soft area line that answers the finger (index cards)
// Korean colours: up red #f04452, down blue #3182f6. Text, lines and surfaces come from the theme variables, so every
// chart reads in light and dark. Motion runs only under html.mo; without it each chart is drawn finished.
import { fadeGrad, gradId, smoothD } from '../chartLook.js';
import { esc } from '../html.js';

const UP = '#f04452', DOWN = '#3182f6';
const r1 = (v: number) => Math.round(v * 10) / 10;
const signed = (v: number, d = 2) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;
const toneOf = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');
/** Red for up, blue for down, faint grey for flat or unknown; stronger with the size of the move (full at ±3%). */
export function heatStyle(v: number | null | undefined, full = 3, floor = 0.14): string {
  if (v == null || !Number.isFinite(v)) return 'fill:var(--line-strong);fill-opacity:.5';
  if (v === 0) return 'fill:var(--muted);fill-opacity:.18';
  const k = Math.min(1, Math.abs(v) / full);
  return `fill:${v > 0 ? UP : DOWN};fill-opacity:${(floor + (0.92 - floor) * k).toFixed(2)}`;
}
const tipAttrs = (name: string, v: string, t: string, s = '') => ` data-km-tip="${esc(name)}" data-km-v="${esc(v)}" data-km-t="${t}"${s ? ` data-km-s="${esc(s)}"` : ''}`;

// ---------------------------------------------------------------- pie-chart (donut with the total in the middle)

export interface DonutPart { label: string; value: number; color: string; tone?: 'up' | 'down' | '' }
/** Point on a circle, angle in degrees clockwise from twelve o'clock. */
const at = (cx: number, cy: number, r: number, deg: number) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)] as const;
function ringSlice(cx: number, cy: number, r0: number, r1x: number, a0: number, a1: number): string {
  const big = a1 - a0 > 180 ? 1 : 0, [x0, y0] = at(cx, cy, r1x, a0), [x1, y1] = at(cx, cy, r1x, a1), [x2, y2] = at(cx, cy, r0, a1), [x3, y3] = at(cx, cy, r0, a0);
  return `M${r1(x0)} ${r1(y0)}A${r1x} ${r1x} 0 ${big} 1 ${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}A${r0} ${r0} 0 ${big} 0 ${r1(x3)} ${r1(y3)}Z`;
}
/**
 * A donut: one slice per part, small gaps between them, and the centre saying the headline (big value, small label).
 * Hover or tap a slice and the centre and a bubble show that slice.
 */
export function kmDonut(parts: readonly DonutPart[], center: { v: string; l: string; tone?: string }, aria: string, unit = '개'): string {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  const live = parts.filter((p) => p.value > 0), pad = live.length > 1 ? 1.6 : 0;
  let a = 0;
  const slices = total ? live.map((p, i) => {
    const span = (p.value / total) * 360, a0 = a + pad, a1 = Math.max(a0 + 0.5, a + span - pad); a += span;
    const share = Math.round((p.value / total) * 100);
    const d = span >= 359.9 ? ringSlice(60, 60, 41, 56, 0, 359.99) : ringSlice(60, 60, 41, 56, a0, a1);
    return `<path class="km-sl" d="${d}" style="fill:${p.color};--i:${i}"${tipAttrs(p.label, `${share}%`, p.tone ?? '', `${p.value.toLocaleString('ko-KR')}${unit}`)}/>`;
  }).join('') : `<circle cx="60" cy="60" r="48.5" fill="none" style="stroke:var(--line-strong)" stroke-width="15"/>`;
  return `<div class="km-donut km-chart km-anim" data-km-notip><svg viewBox="0 0 120 120" role="img" aria-label="${esc(aria)}">${slices}</svg><div class="km-center"><b class="km-cv ${center.tone ?? ''}">${esc(center.v)}</b><span class="km-cl">${esc(center.l)}</span></div></div>`;
}

// ---------------------------------------------------------------- gauge-chart (notched radial gauge)

/** Bklit's notch: a trapezoid between two angles with softly rounded corners. */
function notch(cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number, cr = 1.4): string {
  const p = [at(cx, cy, rOut, a0), at(cx, cy, rOut, a1), at(cx, cy, rIn, a1), at(cx, cy, rIn, a0)];
  const lerp = (u: readonly [number, number], v: readonly [number, number], t: number) => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
  const len = (u: readonly [number, number], v: readonly [number, number]) => Math.hypot(v[0] - u[0], v[1] - u[1]);
  let d = '';
  for (let i = 0; i < 4; i++) {
    const c = p[i]!, prev = p[(i + 3) % 4]!, next = p[(i + 1) % 4]!;
    const s = lerp(c, prev, Math.min(0.45, cr / len(c, prev))), e = lerp(c, next, Math.min(0.45, cr / len(c, next)));
    d += `${i ? 'L' : 'M'}${r1(s[0]!)} ${r1(s[1]!)}Q${r1(c[0])} ${r1(c[1])} ${r1(e[0]!)} ${r1(e[1]!)}`;
  }
  return d + 'Z';
}
const mix = (a: string, b: string, t: number) => {
  const h = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(h(a, i) + (h(b, i) - h(a, i)) * t).toString(16).padStart(2, '0')).join('');
};

/**
 * A notched gauge for a lean between −1 (all bearish, left, blue) and +1 (all bullish, right, red).
 * The notches from neutral (top) to the reading light up, deeper in colour the further they go.
 */
export function kmGauge(value: number | null, center: { v: string; l: string; tone?: string }, aria: string, ends: [string, string] = ['약세', '강세']): string {
  const N = 33, sweep = 240, step = sweep / N, half = sweep / 2, cx = 80, cy = 78;
  const v = value == null ? null : Math.max(-1, Math.min(1, value)), va = v == null ? null : v * half;
  const notches = Array.from({ length: N }, (_, i) => {
    const mid = -half + (i + 0.5) * step, d = notch(cx, cy, 52, 70, mid - step * 0.34, mid + step * 0.34);
    const lit = va != null && (Math.abs(mid) < step / 2 || (va > 0 ? mid > 0 && mid <= va + step / 2 : va < 0 && mid < 0 && mid >= va - step / 2));
    if (!lit) return `<path d="${d}" class="km-off" style="fill:var(--line-strong)"/>`;
    const k = Math.abs(mid) / half, color = Math.abs(mid) < step / 2 ? 'var(--muted)' : mid > 0 ? mix('#f9b9bd', UP, Math.min(1, k * 1.25)) : mix('#a9cbfb', DOWN, Math.min(1, k * 1.25));
    return `<path d="${d}" class="km-on" style="fill:${color};--i:${Math.round(Math.abs(mid) / step)}"/>`;
  }).join('');
  const [lx, ly] = at(cx, cy, 61, -half), [rx, ry] = at(cx, cy, 61, half);
  return `<div class="km-gauge km-anim"><svg viewBox="0 0 160 132" role="img" aria-label="${esc(aria)}">${notches}<text x="${r1(lx)}" y="${r1(ly + 16)}" text-anchor="middle" class="km-end">${esc(ends[0])}</text><text x="${r1(rx)}" y="${r1(ry + 16)}" text-anchor="middle" class="km-end">${esc(ends[1])}</text></svg><div class="km-center"><b class="km-cv ${center.tone ?? ''}">${esc(center.v)}</b><span class="km-cl">${esc(center.l)}</span></div></div>`;
}

/**
 * The stock page's semicircle gauges in the same notched look: the arc from −1 (left) to +1 (right) cut into bands,
 * each band a few notches in its own colour. Returns paths with class g-seg (and "on" for the scored band), so the
 * existing glow and the needle on top keep working.
 */
export function kmNotchArc(cx: number, cy: number, rIn: number, rOut: number, colors: readonly string[], bounds: readonly number[], score: number | null, per = 3): string {
  const ang = (s: number) => -90 + ((s + 1) / 2) * 180;
  return colors.map((color, i) => {
    const a0 = ang(bounds[i]!), a1 = ang(bounds[i + 1]!), on = score !== null && score >= bounds[i]! && (score < bounds[i + 1]! || i === colors.length - 1);
    const st = (a1 - a0) / per;
    return Array.from({ length: per }, (_, j) => `<path class="g-seg${on ? ' on' : ''}" style="color:${color};fill:currentColor" d="${notch(cx, cy, rIn, rOut, a0 + j * st + st * 0.16, a0 + (j + 1) * st - st * 0.16, 1.1)}"/>`).join('');
  }).join('');
}

// ---------------------------------------------------------------- stat-card-area

export interface StatAreaInput {
  title: string;
  /** Small words right of the title (the asset's name when the card is not an index). */
  sub?: string;
  value: number | null;
  /** Today's change in percent, shown as the trend badge. */
  change: number | null;
  /** [date, close] oldest first; the area line. */
  series?: readonly (readonly [string, number])[];
  /** Fraction digits of the big number. */
  digits?: number;
  /** G-282 (Bklit area chart · Step): draw the line as steps, for numbers that jump and hold (a policy rate). */
  step?: boolean;
  /** G-282 (Bklit line chart · Dashed Tail): the last point is still trading, so its segment is dashed. */
  openTail?: boolean;
  /** HTML under the area (already escaped). */
  foot?: string;
  href?: string;
  /** G-265 stat-card-line: a thin line with today's dot, no fill (Bklit stat-card-line-01). */
  line?: boolean;
  /** Word under the big number (default 종가). */
  label?: string;
  /** Badge text and tone instead of the % change (e.g. a 20-session move in bp). */
  badge?: { text: string; tone: string };
  /** How the period under the line is described (default 거래일). */
  unit?: string;
}
const fmtNum = (v: number, digits: number) => v.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 2) });
/**
 * Bklit's stat card: title and trend badge, a big number, and under it a soft gradient area of the recent closes.
 * Drag or hover the area and the big number shows that day's close and its date.
 */
export function kmStatArea(i: StatAreaInput): string {
  const digits = i.digits ?? 2, t = toneOf(i.change);
  const badge = i.badge ? `<span class="km-badge ${i.badge.tone}">${esc(i.badge.text)}</span>` : i.change == null ? '<span class="km-badge">—</span>' : `<span class="km-badge ${t}">${i.change > 0 ? '▲' : i.change < 0 ? '▼' : ''} ${signed(i.change)}%</span>`;
  const lbl = esc(i.label ?? '종가');
  const s = (i.series ?? []).filter((p) => Number.isFinite(p[1]));
  let area = '';
  if (s.length >= 2) {
    const lo = Math.min(...s.map((p) => p[1])), hi = Math.max(...s.map((p) => p[1])), sp = hi - lo || 1, W = 200, H = 56;
    const pts = s.map((p, k) => [r1((k / (s.length - 1)) * W), r1(4 + (1 - (p[1] - lo) / sp) * (H - 8))] as const);
    const trend = (s.at(-1)![1] / s[0]![1] - 1) * 100, color = i.badge ? (i.badge.tone === 'up' ? UP : i.badge.tone === 'down' ? DOWN : 'var(--muted)') : trend > 0 ? UP : trend < 0 ? DOWN : 'var(--muted)', id = gradId('kma');
    const tail = !!i.openTail && pts.length >= 3, body = tail ? pts.slice(0, -1) : pts;
    const line = i.step ? body.map((p, k) => (k ? `H${p[0]}V${p[1]}` : `M${p[0]},${p[1]}`)).join('') : smoothD(body.map((p) => p.join(',')).join(' '));
    const tailD = tail ? `M${pts.at(-2)!.join(',')}L${pts.at(-1)!.join(',')}` : '';
    const data = s.map((p, k) => [p[0], p[1], pts[k]![0], pts[k]![1]]);
    area = `${i.line ? '<div class="km-sa-wrap">' : ''}<svg class="km-sa" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(`${i.title} 최근 ${s.length}거래일 ${signed(trend, 1)}%`)}" tabindex="0" data-km-spark="${esc(JSON.stringify(data))}" data-km-digits="${digits}"><defs>${fadeGrad(id, trend > 0 ? UP : trend < 0 ? DOWN : '#8b95a1', 0.32)}</defs>${i.line ? '' : `<path class="km-sa-f" d="${line}${tail ? `L${pts.at(-1)!.join(',')}` : ''}L${W} ${H}L0 ${H}Z" fill="url(#${id})"/>`}<path class="km-sa-l" d="${line}" fill="none" stroke="${color}" stroke-width="${i.line ? 1.6 : 2}" vector-effect="non-scaling-stroke" stroke-linecap="round"/>${tailD ? `<path class="km-sa-tail" d="${tailD}" fill="none" stroke="${color}" stroke-width="${i.line ? 1.6 : 2}" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" stroke-linecap="round"/>` : ''}</svg>${i.line ? `<i class="km-ld" style="left:${(pts.at(-1)![0] / W * 100).toFixed(1)}%;top:${(pts.at(-1)![1] / H * 100).toFixed(1)}%;color:${color}" aria-hidden="true"></i></div>` : ''}<small class="km-sa-n">최근 ${s.length}${esc(i.unit ?? '거래일')} <span class="${toneOf(trend)}">${signed(trend, 1)}%</span></small>`;
  }
  const tag = i.href ? 'a' : 'div';
  return `<${tag} class="card km-stat${i.line ? ' km-stat-line' : ''} km-anim"${i.href ? ` href="${esc(i.href)}"` : ''}><div class="km-st-h"><span class="km-st-t">${esc(i.title)}${i.sub ? ` <small>${esc(i.sub)}</small>` : ''}</span>${badge}</div><div class="km-st-v"><b class="km-sv" data-v0="${i.value == null ? '—' : esc(fmtNum(i.value, digits))}">${i.value == null ? '—' : esc(fmtNum(i.value, digits))}</b><small class="km-sl" data-l0="${lbl}">${lbl}</small></div>${area}${i.foot ?? ''}</${tag}>`;
}

// ---------------------------------------------------------------- choropleth-chart (a compact world map)

// Natural Earth 110m country outlines (public domain), projected plate carrée at 2 units a degree (lon −180…180,
// lat 84…−58), simplified and rounded by hand-run Douglas–Peucker. Korea and the United States are kept apart to colour.
const WORLD_LAND = 'M428 170l10 7 0 8 3 4 -4 2 -8 0 -1 -4 -7 -2 -2 -4 0 -4 3 -2 -1 -5zM343 113l0 3 -7 0 -2 9 -8 1 6 -3 5 -9zM114 70l-9 -4 -6 -7 1 -3 -11 -8 -4 2 -7 -3 0 -18 9 1 18 -3 3 2 9 -1 13 2 2 1 -3 1 4 1 9 0 2 -1 -2 -1 6 -1 9 3 6 -2 5 2 4 -3 -5 -2 3 -4 4 1 3 3 -2 1 4 0 0 2 3 -2 3 5 4 -6 9 3 -2 1 1 2 -9 1 -5 5 -7 2 -5 6 0 2 3 0 1 4 3 -1 17 5 2 6 3 2 3 -3 -3 -4 7 -4 -4 -5 2 -2 -1 -5 8 0 5 3 4 0 0 4 4 2 6 -5 6 7 -1 1 8 3 5 6 -9 4 -11 -1 -11 7 9 -4 5 1 -2 1 1 4 3 1 5 -3 1 2 -11 5 -1 -2 3 -2 -5 1 -2 -1 0 -4 -2 0 -5 5 -8 0 -3 3 -4 0 -7 4 0 -8 -12 -6 -6 1 -6 -1 -1 -2zM192 43l4 -1 -2 2zM200 22l-2 -1 1 -1 8 2zM166 10l3 1 -5 1 -1 -2zM184 19l-9 -1 -3 -3 -6 -1 11 0 2 1 -1 1 4 1 18 0 -1 2zM137 12l3 1 -7 0zM249 65l-3 3 7 2 -1 1 3 2 -1 2 -2 -3 -3 2 -8 -1 4 -6zM192 38l8 3 -14 0 2 -4zM202 23l2 -1 18 5 4 3 -4 1 14 3 0 2 -4 2 -8 -3 0 2 7 4 -1 2 -8 -2 6 3 -18 -5 -5 1 -2 -1 1 -2 8 0 -1 -1 4 -3 -9 -3 2 0 -3 -2 -8 1 -17 -3 1 -4 7 -2 0 3 7 -3 4 3 -1 1zM171 20l8 0 -8 4 -3 -2zM114 16l8 -3 6 0 -2 2zM95 60l2 0 -1 2 2 2 -4 -3zM149 9l9 1 3 2 -11 -1 2 0zM113 71l-5 -1 -5 -4 5 1zM117 19l12 2 -15 5 -6 -2 4 -3 -2 -2zM144 16l4 0 1 1 -2 1 -22 0 4 -3 13 2 -3 -2 2 -1zM147 22l4 4 7 2 -3 1 1 1 -23 1 -8 -3 10 -1 -11 0 -1 -1 5 -1 -7 0 9 -4 2 1 -1 1 9 -1 4 3 1 -1 -2 -2zM159 23l-2 -2 8 -1 1 1 -2 1 3 1 0 2 -7 0 -5 -2zM163 15l2 0 -1 3 -9 -1 0 -2zM168 7l7 -2 13 4 -10 3 -6 -2 2 -1 -6 0zM177 4l18 -2 41 1 -22 6 -8 0 3 2 -5 1 -4 2 4 0 -5 2 -18 -1 3 -1 -1 -2 7 1 -6 -2 6 -2 -3 0 -1 -2 10 0 -11 0zM210 33l-4 1 2 -3zM535 70l-5 4 -4 -1 -1 4 -5 1 1 5 -13 -2 -1 2 -3 -1 -7 5 -4 -1 -1 -4 -8 -1 -7 -4 -5 1 0 7 -4 -2 -3 1 0 -2 -4 -3 5 -2 0 -3 -9 1 -4 -4 2 -4 2 1 5 -3 9 2 12 -1 -3 -2 3 -4 15 -3 9 4 7 -2 -1 1 7 6 8 0 3 3 3 -1zM472 85l0 -7 5 -1 7 4 8 1 1 4 4 1 5 -4 0 3 4 0 -2 2 -3 0 0 -2 -6 3 2 3 -1 2 -11 -6 -2 -3 -2 1 -4 -4 -1 2zM642 173l13 7 1 1 -2 0 0 2 8 6 -4 0 -9 -6 -4 4 -3 -1zM663 180l-4 1 -2 -2 5 0 2 -3 1 2zM642 173l0 13 -4 -2 -3 1 2 -5 -10 -5 -1 1 -2 -2 4 -1 -7 -3 7 0 1 4 2 1 4 -4zM596 160l-1 2 3 4 -2 0 -4 10 -12 -2 -2 -5 1 -5 2 2 7 0 4 -7zM619 174l3 2 -6 -1zM616 164l1 6 -2 -1zM606 166l4 -1 -3 3 -7 0 2 3 5 -2 -4 3 3 7 -2 0 1 -2 -2 1 -1 -5 -1 6 -2 0 -1 -7 2 -5 2 -2zM603 185l3 -1 -3 2 -3 0 1 -2zM577 181l5 0 9 4 -2 1 -16 -3 -2 -1 1 -2zM569 170l3 4 0 6 -3 0 -18 -23 6 2zM223 273l1 3 6 1 -7 1zM245 228l-2 9 4 4 -2 3 -10 2 0 4 -5 0 0 2 3 1 -4 5 -4 1 0 2 4 1 -7 7 0 3 2 1 -8 -1 -3 -5 2 -1 3 -8 -2 -2 0 -6 7 -33 4 -5 3 0 1 2 1 -2 3 0 3 4 7 3 -2 3 2 1 4 0 3 -4 1 3zM223 273l0 5 3 0 -1 1 -10 -2 -4 -3 7 2 1 -2zM221 203l3 11 2 0 -3 3 0 5 -4 9 1 5 -4 14 0 6 2 2 -5 11 2 0 1 3 7 1 -3 0 -3 3 -7 -3 -1 -8 3 -3 -3 -1 2 -1 0 -4 3 1 1 -4 -2 -1 0 3 -2 -1 3 -7 -1 -5 4 -9 3 -22 -1 -6zM419 177l2 8 -4 0 0 7 2 0 0 3 -5 -4 -10 -1 0 -5 -3 -3 -6 2 -2 -4 -9 0 1 -2 7 -2 7 -18 6 2 6 -3 11 4 -4 12zM443 171l-1 -9 5 -4 3 0 8 -9 0 -4 4 -1 -1 6 -6 10zM438 177l-10 -7 2 -6 -2 -5 3 -2 5 4 6 -2 2 1 -2 2 1 9zM409 152l-5 -12 4 -3 0 -9 2 0 0 -4 24 0 1 7 2 1 -3 1 -1 8 -4 5 -1 5 -2 -7 -2 0 1 2 -3 3 -2 -2 -2 2 -5 0 -3 -2zM408 129l0 8 -4 3 2 6 -10 6 -5 1 -3 -4 3 -1 -4 -9 3 -4 2 -8 -2 -5 2 -1zM217 129l0 3 -6 -1 4 0 -2 -2 1 -1zM217 132l0 -4 5 1 -1 1 2 1zM548 6l4 -1 8 3 0 2 -10 0 -8 -3zM566 9l5 2 -12 1zM638 16l12 1 -12 2 -4 -2zM656 17l5 1 -9 0zM640 21l4 -1 3 2zM467 20l15 -5 16 0 -21 4 -6 4 0 2 4 2 -12 -2 2 -3 4 -1zM646 61l3 9 -3 -1 -1 3 2 4 -3 0 -1 -15 2 -2zM622 84l0 -6 4 0 4 -7 -8 1 -7 -4 -3 -6 -10 -1 -2 1 1 2 -2 4 -3 1 -7 -1 -8 2 -7 -3 -7 1 -3 -3 -6 -1 -3 5 -11 -3 -9 4 -1 -2 -3 1 -3 -3 -8 0 -7 -6 1 -1 -7 2 -9 -4 -15 3 -3 4 3 2 -4 1 -14 -2 -8 3 -2 -1 -2 4 5 4 -5 4 4 5 -2 2 -4 -3 -18 -5 5 -4 -2 0 2 -2 2 0 0 -3 -5 -2 -2 1 -5 -3 0 -2 -4 1 -1 -2 2 -1 -3 -4 -6 -1 -1 -5 3 -3 -2 -1 7 -5 -3 -1 0 -5 -2 -2 2 -1 -3 -3 7 -2 17 4 1 2 -5 2 -11 -1 4 1 0 3 4 1 -1 -2 6 1 5 -4 4 1 1 -2 -2 -3 6 1 1 1 -3 0 2 2 14 -5 2 0 -2 2 13 -1 2 -1 -2 -1 1 -1 16 4 1 -1 -4 -2 1 -1 -2 -2 5 -4 7 0 0 8 2 1 -4 4 2 1 5 -4 0 -2 -3 -1 2 -2 -3 -2 4 -1 -1 -2 4 4 -1 -2 3 -1 8 2 -2 -4 3 -1 10 0 -2 -1 2 -1 28 -3 2 -2 24 3 -9 4 12 0 7 2 16 -1 3 1 2 4 4 0 2 -2 15 1 -2 -2 3 -1 25 4 12 0 2 1 -1 2 17 0 3 2 3 -1 -2 -1 1 -1 16 1 3 1 0 9 0 -3 0 2 -5 1 4 4 -10 1 -8 4 -14 0 -3 4 2 1 0 3 -2 0 0 2 -3 1 -1 3 -3 0 -3 4 -3 -9 1 -3 15 -8 2 -3 -9 4 -1 -3 -6 1 -5 3 2 2 -26 0 -14 9 8 0 5 3 -3 9 -10 10 -5 0zM427 76l6 2 -6 1 -2 -2zM238 272l5 -2 2 1zM390 9l4 -1 9 2 -11 4 -11 -5zM422 29l-5 1 1 -2 -6 0 -3 3 -7 -2 -2 2 -4 0 -4 2 -5 7 -2 0 0 8 -11 4 -3 -1 -1 -7 28 -16 18 -2 7 1 -3 1zM415 8l-15 1 -5 -2zM409 12l-8 1 2 -1 -1 -1zM266 3l40 -2 12 2 -22 1 18 0 2 1 -2 1 14 -2 8 1 -16 3 5 0 -4 2 0 3 2 1 -6 1 3 1 1 2 -2 0 2 1 -4 1 2 0 -1 1 -5 0 2 3 -5 -1 6 2 0 2 -7 -2 1 1 -3 2 8 0 -35 9 -1 3 -5 3 -1 5 -3 0 -7 -2 -6 -5 -5 -7 2 -3 3 0 1 -3 -7 1 0 -3 6 1 -9 -2 3 -2 -8 -6 -20 -1 -6 -2 9 -1 -13 -1 16 -3 -5 -1 12 -3 -1 -1 24 -1 12 2zM498 265l3 2 -4 1zM393 225l5 1 2 -1 0 -7 2 4 4 -3 5 0 8 -7 2 0 3 5 0 3 -2 -1 -1 2 2 2 3 -2 -1 4 -9 9 -16 4 -4 -2 0 -5zM418 226l-1 -1 -3 3 2 1 3 -2zM418 226l0 2 -4 0 1 -2zM126 103l12 2 9 -1 7 6 3 -2 5 7 4 1 -2 7 4 7 3 2 5 -1 5 -6 5 0 -1 5 -7 2 -1 1 2 3 -2 0 -1 3 -4 -3 -5 1 -9 -3 -9 -6 0 -5 -8 -6 -7 -11 -4 -2 0 2 11 15 -1 1 -4 -3 0 -2 -6 -4 2 -2 -4 -3zM245 228l9 5 -2 4 -4 1 -5 -2zM253 236l1 -3 -9 -5 8 -6 0 -2 -2 -1 0 -3 -2 0 0 -3 -5 -1 0 -11 -4 0 -1 -5 -8 -3 -2 -5 -10 2 0 -3 -5 0 -2 -4 2 -4 6 -2 0 -10 2 -1 -2 -1 5 -1 2 3 6 -3 -3 -4 10 -2 2 7 6 -2 6 1 3 -4 3 5 -1 3 4 0 0 2 7 1 1 2 12 2 7 4 0 7 -8 10 0 6 -4 10 -11 4 -4 4 0 4 -4 6 -4 2zM221 190l8 -2 2 5 7 2 2 6 4 0 -1 2 2 0 -1 5 -8 -1 -1 5 -3 0 -1 2 -1 -2 -3 0 -3 2 -3 -11 2 -10zM220 177l-6 2 -2 4 2 4 5 0 0 3 4 3 -2 5 1 3 -3 4 -12 -9 -5 -11 -5 -5 0 -3 2 -2 0 2 3 1 2 -4 6 -4 -1 -2 5 5 6 0zM226 165l-6 0 2 1 -2 1 0 10 0 -4 -6 0 -4 -5 -8 -3 4 -5 -2 -6 2 -2 -1 -1 4 -2 1 -3 7 -3 1 1 -5 6 3 4 4 0 1 2 4 -1 -1 7zM205 151l1 1 -2 2 0 -3 -3 -1 -3 4 0 -2 -4 0 0 -3 9 0zM195 149l-1 3 -3 -4 -3 0 0 -2 5 0zM193 146l-4 0 -4 -4 2 -1 -1 -1 8 -2zM194 138l-4 0 -1 2 -3 0 0 2 -2 -1 1 -1 -4 -1 3 -3 7 0zM181 139l4 1 -1 2 -4 -1zM176 139l0 -2 3 -1 -2 -3 5 -1 0 4 2 1 -4 4zM182 132l2 -1 -1 5zM239 158l-3 2 -6 0 3 4 -6 3 -3 -5 1 -7 -4 1 -1 -2 -4 0 -3 -4 1 -3 3 -3 0 6 0 -4 3 -1 -1 -1 10 4 7 -1 -1 1 5 3 -3 5zM247 164l-6 0 0 -4 -4 -4 3 -5 6 5 -2 4zM251 163l-4 1 -3 -6 2 -2 6 0zM257 160l-3 4 -3 -1 1 -7zM372 69l4 1 -4 5 2 1 -1 2 2 2 -2 2 -16 0 1 -6 -7 -4 2 -2 4 1 -1 -3 7 0 0 -2zM209 168l1 2 -6 4 -2 4 -3 -1 1 -5 -1 1 -1 -3 2 -4 2 -1zM195 122l6 0 8 5 3 0 -8 1 2 -1 -6 -3 -10 0zM422 213l-6 -2 -4 -4 -1 -4 3 1 5 -5 7 2 0 6zM419 212l-8 7 -10 2 -1 -9 2 0 1 -8 4 1 4 -2 1 4zM400 218l0 7 -5 1 -1 -2 -3 0 -2 -12 -6 -9 27 0 -3 2 -5 0zM327 141l-2 -2 2 -3 5 -1 4 4 1 4 -10 0 -1 -1 6 -1zM337 143l0 -6 12 0 -2 -19 3 0 16 12 3 0 -2 7 -9 1 -6 3 -4 7 -4 0 -2 -5zM326 126l8 -1 2 -9 7 0 0 -3 7 5 -3 0 2 19 -12 0 -1 2 -4 -4 -5 1 1 -4zM365 155l-1 1 -1 -2 -1 -6 2 -4 4 3 -3 4zM390 122l2 5 -2 8 -3 4 2 2 -1 2 -1 -2 -13 1 -3 -2 -3 1 -1 4 -5 -3 -1 -4 6 -1 2 -7 15 -9 4 2zM365 155l0 -4 3 -4 0 -6 19 0 2 3 -3 7 -2 0 -2 4 -4 0 0 2 -5 3 -4 -5zM389 142l2 6 -3 0 3 5 -2 6 3 3 0 3 -13 -2 1 -1 -3 -3 1 -4 4 0 2 -4 2 0zM362 146l2 10 -3 -2 -1 -8zM360 146l2 10 -6 3 -2 -1 0 -12zM344 148l9 0 2 4 -1 6 -9 1 -2 -3zM333 143l9 0 2 9 -3 1 -3 -5 -3 0 -1 2 -3 -2 -1 -2zM327 143l6 1 -3 2zM343 153l2 6 -8 -5 3 -3zM334 150l1 -2 3 0 2 3 -3 3zM349 147l2 -5 7 -4 3 0 1 4 2 1 -2 3 -8 0 0 3zM415 158l-4 -1 -6 3 -6 -2 -2 3 -5 2 -3 -7 2 -3 5 -1 10 -6 1 4zM397 161l-5 15 -3 2 -5 0 -2 -2 2 -1 -1 -1 2 -2 4 0 0 -6 -3 -3 6 2 2 -4zM383 163l3 0 3 3 0 6 -4 0 -3 4 -4 -7 1 -3 4 0zM379 163l4 0 0 3 -4 0zM421 185l5 1 0 10 -6 2 1 1 -7 5 -8 -1 -2 -3 0 -6 4 0 0 -4 2 0 9 5 0 -3 -2 0 0 -7zM426 186l3 2 0 7 2 1 1 4 -2 2 -1 -5 -4 -2 2 -2zM429 191l8 0 4 -2 1 8 -12 10 -1 2 2 7 -7 5 -2 -8 4 -6 0 -6 -5 -1 -1 -2 6 -2 3 1 1 5 2 -2 -1 -4 -2 -1zM424 221l-1 2 -2 -2 1 -2zM385 180l8 0 2 4 3 0 1 -2 4 1 1 7 4 0 0 4 -4 0 0 6 2 3 -23 0 2 -9 2 -1zM421 173l1 2 -3 2 -1 -3zM431 103l-1 6 -1 -4 1 -3 2 -1zM459 193l2 5 -1 2 -1 -1 1 3 -6 16 -4 1 -3 -4 2 -15 4 0 3 -5 1 1 1 -4zM379 107l-4 -6 2 -4 -1 -2 3 -2 1 2 2 -1 0 4 -2 1 3 3zM343 113l0 -3 5 -1 10 -6 -2 -5 5 -3 16 -1 -2 7 5 8 -1 7 5 5 -13 8 -5 1 -2 -3zM431 103l7 -2 0 3 -4 1 2 2 -4 3 -2 -1zM463 120l5 0 4 -4 1 1 -3 6 -6 -1zM456 108l1 3 -4 -1zM438 104l0 -3 4 -2 1 -4 5 -2 4 4 -1 3 4 3 2 5 -8 2 -8 -6zM470 123l2 -5 8 5 -4 4 0 3 -5 2 0 2 -5 1 -2 -5 6 -2zM565 144l1 -4 9 0 0 3 -3 3 -5 1zM570 139l-4 1 -1 4 -5 -3 -2 9 2 0 4 6 -2 1 -6 -6 3 -7 -3 -6 2 -2 -3 -5 5 -4 3 2 -1 4 4 -2 3 2 2 4zM575 140l-5 -1 1 -2 -3 -5 -2 -1 -4 2 1 -4 -3 -2 2 -2 2 1 -1 -3 3 3 3 0 1 2 -2 1 7 7zM560 127l-5 4 3 5 -2 2 3 6 -2 4 1 -3 -2 -7 -2 -4 -3 3 -3 -1 1 -4 -4 -5 0 -3 5 -9 3 -2 1 1 2 -3 1 5 -2 4 4 2 -1 2 4 0zM569 147l6 -4 0 -7 -7 -7 2 -1 -1 -2 -3 0 -2 -3 7 -2 5 4 -5 5 7 7 1 4 -1 4 -8 6zM621 83l1 1 -1 -1 -4 5 -2 0 2 3 -5 2 -3 -1 2 -3 -2 0 1 -2 4 -3 2 1 4 -3zM536 69l8 -3 11 3 3 -5 6 1 3 3 7 -1 7 3 12 -2 -2 5 5 -1 4 2 -16 4 0 3 -14 4 -6 -2 -11 0 -2 -3 -10 -3 1 -3 -6 -3zM555 111l-1 3 -1 -1 -3 2 -5 9 -1 -3 -2 0 3 -3 -9 -2 2 2 -2 1 2 6 -4 0 -1 3 -12 8 -1 11 -5 5 -8 -16 -2 -11 -4 1 -3 -2 1 -2 -3 -1 2 -2 4 0 -3 -5 5 -2 7 -9 -4 -4 7 0 2 -2 2 2 -1 6 5 3 -2 2 11 5 5 0 0 -3 3 3 5 -1 -1 -2 6 -3zM545 124l0 3 -2 -5 -5 2 -2 -5 2 -1 -2 -2 9 2 -3 3 2 0zM543 112l1 2 -6 0 2 -3zM536 112l0 3 -5 0 -11 -5 3 -3 9 5zM516 97l-2 2 -7 0 4 4 -7 9 -5 2 3 5 -4 0 -2 2 -3 -4 -10 1 4 -4 -5 -6 11 0 1 -3 5 -1 5 -9 6 -1zM493 93l5 1 5 -3 -1 1 2 3 3 -2 3 1 -6 1 -5 9 -5 1 -1 3 -11 0 2 -1 -3 -5 1 -5 4 0zM496 94l1 -2 -2 -3 6 -3 1 2 -3 1 8 0 3 2 0 2 -6 2 -2 -3 1 -1zM502 83l5 0 1 -2 13 2 -13 6 -9 0 7 -3 -4 0zM465 84l3 -1 6 2 3 -3 16 11 -7 4 -4 0 0 -2 -7 -3 -7 2 0 -4 -3 -2 1 -2 3 0 -2 -2 -1 2zM457 108l-2 -5 -4 -3 1 -3 -4 -5 0 -3 4 2 5 -2 -1 1 2 3 7 2 10 -3 7 3 -1 7 3 5 -2 1 5 6 -4 4 -8 -1 -1 -3 -5 1 -6 -3 -3 -4zM431 103l2 -3 0 -6 12 0 -2 1 -1 4zM453 90l-1 1 -5 -5 4 0zM382 50l3 -2 0 -8 2 0 5 -7 8 -3 7 2 1 4 -6 2 1 1 -9 6 4 3 -4 3 -2 5 -6 1zM416 56l6 1 3 4 -2 1 1 2 -17 1 0 -5zM424 64l4 -1 3 4 9 2 0 3 -10 3 0 2 -7 -2 -7 2 4 -2 -2 -3 -4 -1 -4 2 -6 -2 5 -7zM407 60l1 3 -2 0 2 4 -3 2 1 1 -6 0 -5 -3 -2 1 -5 -6 0 -2 7 -2zM394 72l-2 3 -13 -1 7 -1 1 -3 6 0zM404 71l1 1 -5 4 -5 0 -3 -2 2 -2zM413 72l5 0 2 3 -4 2 0 -3zM416 77l3 0 -2 4 -9 0 -8 -5 5 -4 9 0zM413 57l-7 3 0 -2 -3 0 -1 -2 8 -1zM415 53l1 3 -3 1 -3 -2 -8 1 3 -4 2 2 2 -2zM416 49l-1 4 -8 -2 2 -2zM388 60l2 6 -6 1 3 3 -1 3 -11 0 1 -3 -4 -1 0 -5 2 0 0 -3 4 -1 -1 -2zM405 80l12 1 -2 2 1 1 -4 0 -2 2 -4 -1zM406 85l4 1 2 -2 1 2 -6 1 2 1 -4 -1 3 5 -2 0 1 1 -2 2 -5 -6 2 -3zM450 94l-17 0 0 2 -4 -2 -1 2 -9 0 -4 -1 -2 -3 1 -2 -2 -1 15 -5 10 2 8 -1 5 4 -2 0zM412 84l4 0 2 2 -5 2zM402 86l-2 3 -1 -6 2 0zM393 75l5 1 1 2 -8 0 6 5 -7 -3 0 -2 -3 0zM379 73l2 2 -3 1 -6 -1 1 -2zM372 66l-1 3 -6 -3zM374 61l-2 5 -5 -1 2 -3zM342 84l5 0 -2 10 -3 0 1 -1 -2 -2zM345 94l2 -10 -5 0 -1 -2 15 -1 10 2 -7 6 1 2 -4 4 -8 1zM348 60l0 2 -5 3 -3 -1 2 -2 -1 -2 4 -2 0 2zM692 210l2 2 -1 1 -5 -5zM714 248l-2 3 -3 0 0 -10 -4 -4 7 6 5 0zM699 255l5 -5 4 0 -3 5 1 1 -3 0 -3 5 -7 -1zM655 250l2 0 -1 4 -4 1 -3 -6zM612 232l-5 4 -7 0 -4 2 -5 -1 -1 -2 2 -3 -5 -11 0 -8 6 -4 9 -2 4 -6 1 2 0 -2 2 0 2 -5 8 2 2 -3 -1 -1 5 -2 0 -2 2 2 6 0 1 1 -3 5 8 5 3 0 3 -14 2 7 4 2 1 7 6 4 1 4 1 -1 6 7 1 5 -1 7 -3 3 -3 9 -7 3 -3 -2 -3 2 -6 -2 -5 -7 -2 2 2 -5 -4 4 -4 -4 1 -1 -6 -2zM524 153l-3 3 -2 -4 1 -4zM579 132l-2 -3 5 -1zM521 83l-1 -5 5 -1 1 -4 4 1 6 -5 0 2 6 3 -1 3 6 1 6 5 11 0 6 2 8 -2 6 -2 0 -3 15 -3 1 -1 -4 -2 -5 0 2 -4 6 0 2 -4 -1 -2 2 -1 10 1 3 6 7 4 8 -1 -4 7 -4 0 1 2 -2 3 -1 -1 -4 3 -2 -1 -10 6 -2 0 2 -3 -1 -1 -8 5 4 3 3 -2 3 1 -7 5 6 7 0 5 -9 11 -13 4 -1 2 -2 -1 1 -1 -7 -1 -2 -3 -8 2 1 3 -2 -2 -4 0 1 -2 -4 -2 2 -7 -1 -2 -4 0 0 -2 -7 3 -5 -1 -2 2 -6 -1 -15 -7 1 -6 -6 -3 -2 -5 -3 -2zM604 119l-3 5 0 -5 2 -2zM381 74l7 1 0 2 -3 0 0 3 12 8 -3 -1 0 3 -3 2 0 -4 -7 -3 -4 -5 -2 -1 -3 2 -2 -3 1 -2zM390 92l0 3 -5 -2zM377 86l3 1 -1 3 -2 0zM380 58l-3 0 -1 -3 5 -2 1 2 -3 2zM348 60l-3 0 0 -2 4 1zM354 61l-4 -3 0 -2 -1 1 -1 -5 6 -1 -2 2 4 0 -2 3 2 0 7 7 -2 3 -13 2 5 -3 -3 0 -1 -1 3 -1 -2 -1zM331 35l2 3 -9 3 -10 -1 2 -1 -4 -1 4 -1 -5 0 2 -2 6 2 3 -2zM453 84l2 2 2 -2 4 3 -3 4 -2 -1 1 -1 -4 1 -2 -2 -1 -3 3 1zM440 81l11 2 2 3 -10 -1zM605 148l3 -2 -2 4zM613 151l-2 6 -3 -1 -1 -4 -3 2 2 -3 2 1 3 -2 0 -2zM605 132l-2 7 5 1 0 3 -4 -3 -2 1 -2 -3 1 -7zM560 155l7 3 0 8 -6 -6zM596 160l-4 -1 -4 7 -7 0 -2 -2 2 1 7 -6 3 0 2 -5 5 3zM388 75l5 -1 -2 3 -4 0zM417 30l3 3 -2 1 2 2 0 5 3 1 -7 5 -13 0 -1 -4 9 -6 -4 -2 0 -3 -6 -2 8 1 3 -3 6 0zM405 70l-11 2 2 -3zM390 66l8 3 -9 2 -5 -4zM433 139l1 -6 3 -1 9 11 -6 -4zM644 90l-3 8 -7 1 -2 2 -2 -2 -8 1 2 2 -1 3 -3 0 1 -2 -2 -2 6 -4 6 0 2 -4 2 1 4 -2 2 -6 2 -1zM649 80l2 -1 0 2 -5 3 -3 -1 -3 2 4 -8zM625 101l3 -2 2 1 -4 3zM244 208l0 4 5 1 0 3 2 0 -2 7 -6 -1 2 -3 -7 -3 -3 -4 1 -5zM464 130l2 3 -2 4 -13 4 -1 2 -4 -1 1 -2 -2 -3 2 -4 8 1 3 -3zM430 109l2 1 3 -2 1 -1 -2 -2 7 -1 8 6 6 0 4 3 5 9 7 2 -1 4 -12 3 -3 3 -8 -1 -1 2 -8 -10 -5 -10 -4 -3zM356 98l2 5 -10 6 -5 1 -1 4 -5 0 -5 9 -2 2 -4 0 5 -10 10 -7 0 -5 4 -2 3 -5zM434 124l-24 0 0 -19 19 1 1 3 -2 4 -3 -5 0 3 6 11zM410 124l0 4 -2 1 -16 -8 -4 2 -4 -2 -5 -5 1 -11 3 -3 7 1 1 2 7 2 5 -5 7 2zM456 152l-6 6 -11 3 -7 -2 0 -2 -6 -5 2 -1 5 -12 2 1 1 -2 9 5 -2 2 3 1 -1 1 2 3zM445 143l2 0 -2 2 1 1 -3 -1zM458 145l-2 7 -9 -2 -2 -3 1 -2 2 2zM428 170l-9 1 3 -11 2 1 4 -2 2 5zM421 170l1 3 -4 1zM397 83l-6 -5 8 0zM405 83l0 3 -4 0 0 -2zM398 76l7 3 1 3 -3 2 1 -1 -2 -2 -3 1zM400 83l-2 1 -1 -2 2 -1 2 1zM422 161l-6 -2 -8 -8 2 -4 3 2 5 0 2 -2 2 2 3 -3 -1 -2 2 0 0 3 2 1 0 3 -2 1 5 5z';
const WORLD_KR = 'M612 93l0 -1 2 -1 3 0 2 3 0 3 -1 1 -5 1 -1 -4 2 -1z';
const WORLD_US = 'M114 70l56 0 0 -1 1 2 4 0 2 1 1 -1 3 1 2 -1 12 6 1 4 -2 2 1 2 7 -3 0 -1 4 0 3 -3 8 0 0 -1 2 0 0 -1 3 -3 0 1 2 -1 0 4 2 1 -8 4 0 1 2 1 0 1 -5 0 -2 1 3 0 -3 1 -1 0 0 -1 -1 1 1 0 0 2 -2 1 -1 -1 1 2 -2 3 1 -2 -2 -2 0 2 -1 0 1 0 0 2 1 0 1 3 -6 3 -1 2 -3 1 -2 2 0 3 3 6 -1 4 -2 -1 0 -1 -3 -4 1 -1 -2 -3 -4 1 -2 -2 -5 0 -1 1 0 1 1 0 -1 1 -1 -1 0 1 -2 0 -4 -2 -3 1 -2 2 -2 0 -2 2 0 3 1 0 -2 0 -3 -2 0 -1 -4 -5 -2 0 -1 2 -3 -1 0 -1 -4 -4 -3 0 0 1 -6 0 -7 -2 -5 0 -2 -2 -1 0 0 -1 -4 -1 0 -1 -2 -2 -2 -4 -1 0 -3 -5 1 -1 -1 -4 1 -1 0 -7 -1 -1 0 -2 3 1 1 2zM49 128l1 0 0 2 -2 0 0 -3 0 1zM48 126l0 1 -1 0 0 -1zM27 47l2 0 0 1 -4 0zM54 52l2 1 -4 2 -1 -2 1 -1zM78 29l0 18 2 0 5 3 4 -2 8 7 3 1 -1 2 -3 -1 0 -2 -3 -1 -1 -2 -5 0 -7 -3 -8 -1 -6 -2 -2 1 0 1 -7 2 -1 -1 1 -2 2 -1 0 -1 -4 3 -3 1 1 1 -1 2 -5 1 0 1 -6 3 -3 0 -4 2 -4 0 6 -3 3 0 6 -3 0 -2 1 -1 -2 1 -1 -1 -1 1 -1 -1 -1 1 -1 -1 -3 1 0 -2 -1 -1 -6 -1 -1 -2 3 -3 6 -1 1 -1 -1 -1 1 -1 -3 1 -8 0 -3 -2 3 -1 4 -1 2 0 -1 1 5 0 -11 -5 8 -2 0 -1 2 -1 11 -2 4 2 1 -1 4 0 -1 1 6 0 4 1 11 0zM17 40l1 1 5 0 -1 1 -3 0 0 -1 -3 0z';

export interface MapEntry { iso: 'KR' | 'US'; country: string; index: string; change: number | null; date?: string | null }
/**
 * A small world map: grey land, and each country GNOMON has an index for filled by its move, with a label so a
 * country as small as Korea still reads. Tap or hover a country for its index and move.
 */
export function kmWorldMap(entries: readonly MapEntry[], caption: string): string {
  const shape: Record<MapEntry['iso'], { d: string; lx: number; ly: number; anchor: string; dot?: [number, number] }> = {
    KR: { d: WORLD_KR, lx: 712, ly: 160, anchor: 'end', dot: [615, 95] },
    US: { d: WORLD_US, lx: 192, ly: 92, anchor: 'middle' },
  };
  const live = entries.filter((e) => shape[e.iso]);
  const fills = live.map((e) => {
    const s = shape[e.iso], v = e.change == null ? '자료 없음' : `${signed(e.change)}%`;
    return `<path d="${s.d}" class="km-ct" style="${heatStyle(e.change, 2, 0.35)}"${tipAttrs(`${e.country} · ${e.index}`, v, toneOf(e.change), e.date ? `${e.date} 종가 기준` : '')}/>`;
  }).join('');
  const labels = live.map((e) => {
    const s = shape[e.iso], v = e.change == null ? '—' : `${signed(e.change)}%`;
    const dot = s.dot ? `<circle cx="${s.dot[0]}" cy="${s.dot[1]}" r="11" class="km-ring" style="stroke:${e.change == null ? 'var(--muted)' : e.change >= 0 ? UP : DOWN}"/><path d="M${s.dot[0] + 7} ${s.dot[1] + 9}L${s.lx - 40} ${s.ly - 24}" class="km-lead"/>` : '';
    return `${dot}<text x="${s.lx}" y="${s.ly}" text-anchor="${s.anchor}" class="km-ml"><tspan class="km-mn">${esc(e.country)} ${esc(e.index)}</tspan><tspan x="${s.lx}" dy="25" class="km-mv ${toneOf(e.change)}">${esc(v)}</tspan></text>`;
  }).join('');
  return `<figure class="km-map km-chart km-anim"><svg viewBox="0 0 720 284" role="img" aria-label="${esc('세계 증시 지도: ' + live.map((e) => `${e.country} ${e.index} ${e.change == null ? '자료 없음' : signed(e.change) + '%'}`).join(', '))}"><path d="${WORLD_LAND}" class="km-land"/>${fills}${labels}</svg><figcaption class="fine">${esc(caption)}</figcaption></figure>`;
}

// ---------------------------------------------------------------- heatmap and sunburst (drawn in the browser)
// These three run in the themes page script too (handed over with .toString()), so they are plain JavaScript inside:
// no imports, no outer helpers, only var and functions.

export interface SectorRow { s: string; themes: { no: string; name: string; avg: number | null; n: number; value: number }[]; stocks: { sym: string; name: string; ch: number | null; cap: number | null }[] }
type ThemeLike = { no: string; name: string; avg: number | null; value: number; members: readonly (readonly unknown[])[] };

/**
 * Each sector's themes (name holds one of its words, three members or more; the four with the most trading value)
 * and its representative stocks (the five largest by 시가총액 among those themes' members, a stock shown once).
 */
export function kmSectorMap(themes: readonly ThemeLike[], words: Record<string, readonly string[]>, skip: Record<string, readonly string[] | undefined>): SectorRow[] {
  var used: Record<string, number> = {}, out: SectorRow[] = [];
  Object.keys(words).forEach(function (s) {
    var w = (words[s] || []).map(function (x) { return x.toLowerCase(); }), k = (skip[s] || []).map(function (x) { return x.toLowerCase(); });
    var hit = themes.filter(function (t) { var n = t.name.toLowerCase(); return t.members.length >= 3 && w.some(function (x) { return n.indexOf(x) >= 0; }) && !k.some(function (x) { return n.indexOf(x) >= 0; }); });
    if (!hit.length) return;
    var by: Record<string, SectorRow['stocks'][number]> = {};
    hit.forEach(function (t) { t.members.forEach(function (m) { var sym = String(m[0]); if (!by[sym]) by[sym] = { sym: sym, name: String(m[1]), ch: m[3] == null ? null : Number(m[3]), cap: m[5] == null ? null : Number(m[5]) }; }); });
    var stocks = Object.keys(by).map(function (x) { return by[x]!; }).filter(function (x) { return !used[x.sym] && x.ch != null; })
      .sort(function (a, b) { return (b.cap || 0) - (a.cap || 0) || (a.sym < b.sym ? -1 : 1); }).slice(0, 5);
    stocks.forEach(function (x) { used[x.sym] = 1; });
    out.push({ s: s, themes: hit.slice().sort(function (a, b) { return (b.value || 0) - (a.value || 0); }).slice(0, 4).map(function (t) { return { no: t.no, name: t.name, avg: t.avg, n: t.members.length, value: t.value || 0 }; }), stocks: stocks });
  });
  return out;
}

/** 업종 rows × their four busiest themes; each tile is the theme's average move today and opens the theme. */
export function kmHeatmap(rows: readonly SectorRow[]): string {
  var e = function (s: unknown) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]!; }); };
  var heat = function (v: number | null) { if (v == null) return 'fill:var(--line-strong);fill-opacity:.5'; if (v === 0) return 'fill:var(--muted);fill-opacity:.18'; var k = Math.min(1, Math.abs(v) / 3); return 'fill:' + (v > 0 ? '#f04452' : '#3182f6') + ';fill-opacity:' + (0.14 + 0.78 * k).toFixed(2); };
  var pct = function (v: number | null) { return v == null ? '-' : (v > 0 ? '+' : '') + v.toFixed(2) + '%'; };
  var W = 360, L = 86, G = 3, C = 4, cw = (W - L - G * (C - 1)) / C, CH = 36, k = 0;
  var body = rows.map(function (r, i) {
    var y = i * (CH + G), cells = '';
    for (var j = 0; j < C; j++) {
      var t = r.themes[j], x = L + j * (cw + G);
      if (!t) { cells += '<rect x="' + x + '" y="' + y + '" width="' + cw + '" height="' + CH + '" rx="7" style="fill:var(--line);fill-opacity:.6"/>'; continue; }
      var nm = t.name.replace(/\([^)]*\)/g, '').trim(), short = nm.length > 6 ? nm.slice(0, 5) + '…' : nm, strong = t.avg != null && Math.abs(t.avg) >= 1.6;
      cells += '<a href="#' + e(t.no) + '" class="km-cell" style="--i:' + (k++) + '" data-km-tip="' + e(nm) + '" data-km-v="' + e(pct(t.avg)) + '" data-km-t="' + (t.avg == null || t.avg === 0 ? '' : t.avg > 0 ? 'up' : 'down') + '" data-km-s="' + e(r.s + ' · ' + t.n + '종목') + '"><rect x="' + x + '" y="' + y + '" width="' + cw + '" height="' + CH + '" rx="7" style="' + heat(t.avg) + '"/><text x="' + (x + cw / 2) + '" y="' + (y + 15) + '" text-anchor="middle" class="km-hn' + (strong ? ' on' : '') + '">' + e(short) + '</text><text x="' + (x + cw / 2) + '" y="' + (y + 28) + '" text-anchor="middle" class="km-hv' + (strong ? ' on' : '') + '">' + e(pct(t.avg)) + '</text></a>';
    }
    return '<text x="0" y="' + (y + CH / 2 + 4) + '" class="km-hs">' + e(r.s) + '</text>' + cells;
  }).join('');
  var H = rows.length * (CH + G) - G;
  return '<div class="km-heat km-chart km-anim"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="업종별 테마 등락 히트맵">' + body + '</svg><div class="km-scale" aria-hidden="true"><span>-3%</span><i></i><span>+3%</span></div></div>';
}

/** 업종 in the inner ring, their largest stocks in the outer ring; sized by 시가총액 when every stock has one, else by count. */
export function kmSunburst(rows: readonly SectorRow[]): string {
  var e = function (s: unknown) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c]!; }); };
  var heat = function (v: number | null) { if (v == null) return 'fill:var(--line-strong);fill-opacity:.5'; if (v === 0) return 'fill:var(--muted);fill-opacity:.2'; var k = Math.min(1, Math.abs(v) / 3); return 'fill:' + (v > 0 ? '#f04452' : '#3182f6') + ';fill-opacity:' + (0.2 + 0.72 * k).toFixed(2); };
  var pct = function (v: number | null) { return v == null ? '-' : (v > 0 ? '+' : '') + v.toFixed(2) + '%'; };
  var tone = function (v: number | null) { return v == null || v === 0 ? '' : v > 0 ? 'up' : 'down'; };
  var list = rows.filter(function (r) { return r.stocks.length; });
  var byCap = list.every(function (r) { return r.stocks.every(function (x) { return (x.cap || 0) > 0; }); });
  var size = function (x: { cap: number | null }) { return byCap ? (x.cap || 0) : 1; };
  var total = 0; list.forEach(function (r) { r.stocks.forEach(function (x) { total += size(x); }); });
  if (!total) return '';
  var cx = 120, cy = 120, P = Math.PI / 180;
  var pt = function (r: number, a: number) { return (cx + r * Math.sin(a * P)).toFixed(1) + ' ' + (cy - r * Math.cos(a * P)).toFixed(1); };
  var arc = function (r0: number, r1: number, a0: number, a1: number) { var big = a1 - a0 > 180 ? 1 : 0; return 'M' + pt(r1, a0) + 'A' + r1 + ' ' + r1 + ' 0 ' + big + ' 1 ' + pt(r1, a1) + 'L' + pt(r0, a1) + 'A' + r0 + ' ' + r0 + ' 0 ' + big + ' 0 ' + pt(r0, a0) + 'Z'; };
  var a = 0, inner = '', outer = '', labels = '', chips = '', k = 0;
  list.forEach(function (r) {
    var w = 0, wc = 0; r.stocks.forEach(function (x) { w += size(x); wc += size(x) * (x.ch || 0); });
    var avg = w ? wc / w : null, span = (w / total) * 360, a0 = a, top = r.themes[0];
    inner += '<a href="#' + e(top ? top.no : '') + '"><path class="km-seg" style="' + heat(avg) + ';--i:' + (k++) + '" d="' + arc(46, 78, a0, a0 + span) + '" data-km-tip="' + e(r.s) + '" data-km-v="' + e(pct(avg)) + '" data-km-t="' + tone(avg) + '"/></a>';
    if (span >= 20) { var m = a0 + span / 2, word = r.s.split('·')[0]!; labels += '<text x="' + (cx + 62 * Math.sin(m * P)).toFixed(1) + '" y="' + (cy - 62 * Math.cos(m * P) + 3).toFixed(1) + '" text-anchor="middle" class="km-sbl' + (avg != null && Math.abs(avg) >= 1.6 ? ' on' : '') + '">' + e(word.length > 4 ? word.slice(0, 4) : word) + '</text>'; }
    var b = a0;
    r.stocks.forEach(function (x) {
      var s2 = (size(x) / total) * 360;
      outer += '<a href="stock.html?c=' + encodeURIComponent(x.sym) + '"><path class="km-seg" style="' + heat(x.ch) + ';--i:' + (k++) + '" d="' + arc(80, 114, b, b + s2) + '" data-km-tip="' + e(x.name) + '" data-km-v="' + e(pct(x.ch)) + '" data-km-t="' + tone(x.ch) + '"/></a>';
      b += s2;
    });
    chips += '<li data-km-tip="' + e(r.s) + '" data-km-v="' + e(pct(avg)) + '" data-km-t="' + tone(avg) + '"><span>' + e(r.s) + '</span><b class="' + tone(avg) + '">' + e(pct(avg)) + '</b></li>';
    a += span;
  });
  return '<div class="km-sun km-chart km-anim" data-km-notip><div class="km-sun-c"><svg viewBox="0 0 240 240" role="img" aria-label="업종과 대표 종목 시장 지도">' + inner + outer + labels + '</svg><div class="km-center"><b class="km-cv">' + list.length + '개 업종</b><span class="km-cl">눌러서 보기</span></div></div><ul class="km-sun-l">' + chips + '</ul><p class="fine">안쪽은 업종, 바깥쪽은 업종별 대표 종목 5개예요. 칸 크기는 ' + (byCap ? '시가총액' : '종목 수') + '에 비례하고 색은 오늘 등락이에요.</p></div>';
}

// ---------------------------------------------------------------- styles and the page script

/** G-282 (Bklit line · left and right Y axes): two numbers with different units on one chart, each read off its own side. */
export interface DualSide { name: string; series?: readonly (readonly [string, number])[]; digits?: number; unit?: string }
export function kmDualLine(a: DualSide, b: DualSide, note = ''): string {
  const mb = new Map((b.series ?? []).filter((p) => Number.isFinite(p[1])).map((p) => [p[0], p[1]] as const));
  const rows = (a.series ?? []).filter((p) => Number.isFinite(p[1]) && mb.has(p[0])).map((p) => [p[0], p[1], mb.get(p[0])!] as const);
  if (rows.length < 5) return '';
  const W = 320, H = 132, L = 44, R = 44, T = 8, B = 20, w = W - L - R, h = H - T - B;
  const side = (k: 1 | 2) => { const v = rows.map((r) => r[k]), lo = Math.min(...v), hi = Math.max(...v), pad = (hi - lo || Math.abs(hi) * 0.01 || 1) * 0.08; return { lo: lo - pad, hi: hi + pad }; };
  const sa = side(1), sb = side(2);
  const X = (k: number) => r1(L + (k / (rows.length - 1)) * w), Y = (v: number, s: { lo: number; hi: number }) => r1(T + (1 - (v - s.lo) / (s.hi - s.lo)) * h);
  const da = smoothD(rows.map((r, k) => `${X(k)},${Y(r[1], sa)}`).join(' ')), db = smoothD(rows.map((r, k) => `${X(k)},${Y(r[2], sb)}`).join(' '));
  const f = (v: number, d = 2) => v.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const ticks = [0, 0.5, 1].map((q) => { const y = r1(T + q * h), va = sa.hi - q * (sa.hi - sa.lo), vb = sb.hi - q * (sb.hi - sb.lo);
    return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="kd-g"/><text x="${L - 6}" y="${y + 3.5}" text-anchor="end" class="kd-t">${esc(f(va, a.digits ?? 2))}</text><text x="${W - R + 6}" y="${y + 3.5}" class="kd-t kd-tb">${esc(f(vb, b.digits ?? 2))}</text>`; }).join('');
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const dates = `<text x="${L}" y="${H - 4}" class="kd-t">${esc(md(rows[0]![0]))}</text><text x="${W - R}" y="${H - 4}" text-anchor="end" class="kd-t">${esc(md(rows.at(-1)![0]))}</text>`;
  const last = rows.at(-1)!;
  const aria = `${a.name} ${f(last[1], a.digits ?? 2)}${a.unit ?? ''}, ${b.name} ${f(last[2], b.digits ?? 2)}${b.unit ?? ''}`;
  return `<figure class="kit-dual"><figcaption class="kd-leg"><span><i class="kd-a"></i>${esc(a.name)} <small>왼쪽 축${a.unit ? ` · ${esc(a.unit)}` : ''}</small></span><span><i class="kd-b"></i>${esc(b.name)} <small>오른쪽 축${b.unit ? ` · ${esc(b.unit)}` : ''}</small></span></figcaption>`
    + `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${ticks}${dates}<path d="${db}" class="kd-lb"/><path d="${da}" class="kd-la"/></svg>${note ? `<p class="fine">${esc(note)}</p>` : ''}</figure>`;
}

export const KIT_MARKET_CSS = `.kit-dual{margin:0}.kit-dual svg{display:block;width:100%;height:auto}.kd-g{stroke:var(--line);stroke-width:1}.kd-t{font-size:12px;fill:var(--muted);font-variant-numeric:tabular-nums}.kd-la{fill:none;stroke:var(--fg);stroke-width:1.8;stroke-linecap:round}.kd-lb{fill:none;stroke:var(--fg);stroke-opacity:.4;stroke-width:1.6;stroke-dasharray:4 3;stroke-linecap:round}.kd-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:15.5px;margin:0 0 6px}.kd-leg small{color:var(--muted)}.kd-leg i{display:inline-block;width:14px;height:0;border-top:2px solid var(--fg);vertical-align:middle;margin-right:6px}.kd-leg i.kd-b{border-top:2px dashed color-mix(in srgb,var(--fg) 40%,transparent)}
.km-seg-sel{position:absolute;pointer-events:none;background:var(--fg);opacity:.08;border-left:1px solid var(--line-strong);border-right:1px solid var(--line-strong)}.km-seg-sel[hidden]{display:none}.km-sl b{font-weight:600}

.km-chart{position:relative}.km-chart [data-km-tip]{transition:opacity .15s}.km-chart[data-hi] [data-km-tip]:not(.hi){opacity:.42}.km-chart [data-km-tip].hi{opacity:1}
.km-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;text-align:center;pointer-events:none;max-width:62%}
.km-cv{font-size:20px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums;color:var(--fg);white-space:nowrap}.km-cl{font-size:14px;font-weight:600;color:var(--muted);margin-top:2px;line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.km-cv.up{color:var(--up,${UP})}.km-cv.down{color:var(--down,${DOWN})}
.km-donut{width:100%;max-width:132px;margin:0 auto}.km-donut svg{display:block;width:100%;height:auto;touch-action:manipulation}
.km-gauge{position:relative;width:100%;max-width:170px;margin:0 auto}.km-gauge svg{display:block;width:100%;height:auto}.km-gauge .km-center{top:59%}.km-end{font-size:14px;font-weight:700;fill:var(--muted)}
.km-tmp-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:start}.km-tmp-row figure{margin:0;min-width:0}.km-tmp-row figcaption{text-align:center;font-size:15px;color:var(--muted);margin-top:2px}
.km-legend{list-style:none;margin:0;padding:0;display:grid;gap:6px;align-content:center;font-size:15.5px}.km-legend li{display:flex;align-items:center;gap:6px;justify-content:space-between}.km-legend i{width:9px;height:9px;border-radius:3px;flex:none}.km-legend span{display:inline-flex;align-items:center;gap:6px;color:var(--fg2)}.km-legend b{font-variant-numeric:tabular-nums}
.km-stat{display:flex;flex-direction:column;gap:2px;min-width:0;overflow:hidden;text-decoration:none;color:inherit;position:relative}a.km-stat:hover{border-color:var(--accent)}
.km-st-h{display:flex;justify-content:space-between;align-items:center;gap:6px;min-width:0}.km-st-t{font-size:15.5px;font-weight:700;color:var(--fg2);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.km-st-t small{font-weight:600;color:var(--muted)}
.km-badge{flex:none;font-size:15px;font-weight:800;border-radius:999px;padding:2px 7px;background:var(--soft);color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}.km-badge.up{color:var(--up,${UP});background:rgba(240,68,82,.12)}.km-badge.down{color:var(--down,${DOWN});background:rgba(49,130,246,.13)}
.km-sa-wrap{position:relative;margin:8px 4px 0}.km-stat-line .km-sa-n{display:none}.km-sa-wrap .km-sa{width:100%;margin:0}.km-stat-line{position:relative}.km-ld{position:absolute;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;background:currentColor;box-shadow:0 0 0 3px color-mix(in srgb,currentColor 22%,transparent);pointer-events:none}
.km-st-v{display:flex;align-items:baseline;gap:6px;min-width:0}.km-sv{font-size:21px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap}.km-sl{font-size:15px;color:var(--muted);white-space:nowrap}
.km-sa{display:block;width:calc(100% + 28px);margin:6px -14px 0;height:56px;touch-action:pan-y;cursor:crosshair;outline:none}.km-sa:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}.km-sa-n{font-size:15px;color:var(--muted)}.km-sa-n .up{color:var(--up,${UP})}.km-sa-n .down{color:var(--down,${DOWN})}
.km-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 12px}.km-stats .km-stat{padding:12px 14px;box-shadow:none}
.km-map{margin:0}.km-map svg{display:block;width:100%;height:auto;touch-action:manipulation}.km-land{fill:var(--line-strong);fill-opacity:.7}.km-ct{stroke:var(--surface-solid);stroke-width:1;cursor:pointer}
.km-ring{fill:none;stroke-width:3}.km-lead{stroke:var(--muted);stroke-width:1.5;fill:none}.km-ml{paint-order:stroke;stroke:var(--surface-solid);stroke-width:5px;stroke-linejoin:round}.km-mn{font-size:21px;font-weight:700;fill:var(--fg)}.km-mv{font-size:24px;font-weight:800;fill:var(--fg)}.km-mv.up{fill:${UP}}.km-mv.down{fill:${DOWN}}.km-map figcaption{margin:6px 0 0}
.km-heat svg{display:block;width:100%;height:auto;touch-action:manipulation}.km-hs{font-size:14px;font-weight:700;fill:var(--fg2)}.km-hn{font-size:12px;font-weight:600;fill:var(--fg2)}.km-hv{font-size:14px;font-weight:800;fill:var(--fg);font-variant-numeric:tabular-nums}.km-hn.on,.km-hv.on{fill:#fff}
.km-scale{display:flex;align-items:center;gap:8px;justify-content:flex-end;font-size:15px;color:var(--muted);margin-top:8px}.km-scale i{width:120px;height:8px;border-radius:4px;background:linear-gradient(90deg,${DOWN},rgba(49,130,246,.14) 46%,rgba(240,68,82,.14) 54%,${UP})}
.km-sun-c{position:relative;width:100%;max-width:300px;margin:0 auto}.km-sun-c svg{display:block;width:100%;height:auto;touch-action:manipulation}.km-seg{stroke:var(--surface-solid);stroke-width:1.2;cursor:pointer}.km-sbl{font-size:12px;font-weight:700;fill:var(--fg);pointer-events:none}.km-sbl.on{fill:#fff}
.km-sun-l{list-style:none;margin:12px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:4px 14px;font-size:15.5px}.km-sun-l li{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--line)}.km-sun-l span{color:var(--fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.km-sun-l b{font-variant-numeric:tabular-nums;white-space:nowrap}.km-sun-l .up{color:var(--up,${UP})}.km-sun-l .down{color:var(--down,${DOWN})}
.km-tmap{padding:14px 16px;margin:12px 0}.km-tmap-h{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}.km-tmap-h h2{margin:0;font-size:18.5px}.km-tmap [data-tmp][hidden]{display:none}
html.mo .km-donut:not(.km-in) .km-sl{opacity:0;transform:scale(.82) rotate(-25deg)}.km-donut .km-sl{transform-box:view-box;transform-origin:60px 60px}
html.mo .km-donut.km-in .km-sl{transition:opacity .5s calc(var(--i,0)*120ms),transform .8s var(--ease-out) calc(var(--i,0)*120ms)}
html.mo .km-gauge:not(.km-in) .km-on{opacity:0}html.mo .km-gauge.km-in .km-on{transition:opacity .3s calc(var(--i,0)*35ms + .15s)}
html.mo .km-stat:not(.km-in) .km-sa-l{clip-path:inset(0 100% 0 0)}html.mo .km-stat.km-in .km-sa-l{clip-path:inset(0 0 0 0);transition:clip-path 1.1s var(--ease-out)}
html.mo .km-stat:not(.km-in) .km-sa-f{opacity:0}html.mo .km-stat.km-in .km-sa-f{transition:opacity .8s .5s}
html.mo .km-map:not(.km-in) .km-ct,html.mo .km-map:not(.km-in) .km-ml,html.mo .km-map:not(.km-in) .km-ring{opacity:0}html.mo .km-map.km-in .km-ct,html.mo .km-map.km-in .km-ml,html.mo .km-map.km-in .km-ring{transition:opacity .6s .2s}
html.mo .km-heat:not(.km-in) .km-cell{opacity:0}html.mo .km-heat.km-in .km-cell{transition:opacity .35s calc(min(var(--i,0),48)*18ms)}
html.mo .km-sun:not(.km-in) .km-seg{opacity:0;transform:scale(.7)}.km-sun .km-seg{transform-box:view-box;transform-origin:120px 120px}
html.mo .km-sun.km-in .km-seg{transition:opacity .45s calc(min(var(--i,0),70)*12ms),transform .7s var(--ease-out) calc(min(var(--i,0),70)*12ms)}
.km-heat{max-width:720px;margin:0 auto}
@media(min-width:760px){.km-sun{display:grid;grid-template-columns:300px minmax(0,1fr);gap:8px 28px;align-items:center}.km-sun-l{margin:0}.km-sun .fine{grid-column:1/-1}}
@media(max-width:480px){.km-cv{font-size:18.5px}.km-sv{font-size:19px}}
`;

export const KIT_MARKET_JS = `
(function () {
  var root = document.documentElement;
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  // ---- charts play once they are on screen (only under html.mo; otherwise they are drawn finished) ----
  // G-277 (한서님 10/21 '볼때마다 촥 그려지면서'): a chart plays again each time it comes back on screen (a tab switch, a scroll).
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.intersectionRatio >= 0.3) e.target.classList.add('km-in'); else if (!e.isIntersecting) e.target.classList.remove('km-in'); }); }, { threshold: [0, 0.3] }) : null;
  var scan = function () { document.querySelectorAll('.km-anim:not([data-km-seen])').forEach(function (el) { el.setAttribute('data-km-seen', ''); if (io && root.classList.contains('mo')) io.observe(el); else el.classList.add('km-in'); }); };
  var queued = false;
  new MutationObserver(function () { if (queued) return; queued = true; setTimeout(function () { queued = false; scan(); }, 100); }).observe(root, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
  // ---- the value bubble (.mo-tip) ----
  var tipOf = function (host) { var t = host.querySelector(':scope > .mo-tip'); if (!t) { if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; t = document.createElement('div'); t.className = 'mo-tip'; t.hidden = true; t.setAttribute('role', 'status'); host.appendChild(t); } return t; };
  var place = function (t, host, x, y) { t.hidden = false; var w = t.offsetWidth, hw = host.clientWidth; t.style.left = Math.max(w / 2 + 2, Math.min(hw - w / 2 - 2, x)) + 'px'; t.classList.toggle('below', y - t.offsetHeight - 12 < 0); t.style.top = y + 'px'; };
  // ---- a mark with data-km-tip: hover, focus or tap lights it; the chart's centre (if any) and a bubble say what it is ----
  var cur = null, host = null, held = null;
  var off = function () {
    if (!host) return; var t = host.querySelector(':scope > .mo-tip'); if (t) t.hidden = true; host.removeAttribute('data-hi'); if (cur) cur.classList.remove('hi');
    var c = host.querySelector('.km-center'); if (c && c.dataset.v0 != null) { var cv = c.querySelector('.km-cv'); cv.textContent = c.dataset.v0; cv.className = 'km-cv ' + c.dataset.t0; c.querySelector('.km-cl').textContent = c.dataset.l0; }
    cur = host = null;
  };
  var on = function (el) {
    var h = el.closest('.km-chart'); if (!h || cur === el) return; off(); cur = el; host = h; h.setAttribute('data-hi', ''); el.classList.add('hi');
    var name = el.getAttribute('data-km-tip') || '', v = el.getAttribute('data-km-v') || '', t = el.getAttribute('data-km-t') || '', s = el.getAttribute('data-km-s') || '';
    var c = h.querySelector('.km-center');
    if (c) { var cv = c.querySelector('.km-cv'), cl = c.querySelector('.km-cl'); if (c.dataset.v0 == null) { c.dataset.v0 = cv.textContent; c.dataset.l0 = cl.textContent; c.dataset.t0 = cv.className.replace('km-cv', '').trim(); } cv.textContent = v; cv.className = 'km-cv ' + t; cl.textContent = name; }
    if (c && h.hasAttribute('data-km-notip')) return;
    var tp = tipOf(h); tp.innerHTML = '<b>' + esc(name) + '</b>' + (v ? ' <span class="' + esc(t) + '">' + esc(v) + '</span>' : '') + (s ? '<br>' + esc(s) : '');
    var r = el.getBoundingClientRect(), hr = h.getBoundingClientRect(); place(tp, h, r.left - hr.left + r.width / 2, r.top - hr.top);
  };
  var mark = function (e) { return e.target && e.target.closest ? e.target.closest('[data-km-tip]') : null; };
  document.addEventListener('pointerover', function (e) { if (e.pointerType !== 'mouse') return; var el = mark(e); if (el) on(el); });
  document.addEventListener('pointerout', function (e) { if (e.pointerType !== 'mouse' || !cur) return; var to = e.relatedTarget; if (!to || !to.closest || to.closest('[data-km-tip]') !== cur) off(); });
  // A finger: the first tap on a mark shows it; a second tap on the same mark follows its link.
  document.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse') return; var el = mark(e); if (!el) { if (!(e.target.closest && e.target.closest('.km-sa'))) { off(); held = null; } return; } if (held !== el) { on(el); held = el; el.setAttribute('data-km-hold', ''); } });
  document.addEventListener('click', function (e) { var el = mark(e); if (el && el.hasAttribute('data-km-hold')) { el.removeAttribute('data-km-hold'); if (e.target.closest('a')) { e.preventDefault(); e.stopPropagation(); } } }, true);
  document.addEventListener('focusin', function (e) { var el = mark(e); if (el) on(el); });
  document.addEventListener('focusout', function (e) { if (mark(e) === cur) off(); });
  // ---- stat card: the big number follows the finger along the area ----
  var fmt = function (v, d) { return Number(v).toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: Math.min(d, 2) }); };
  var day = function (d) { d = String(d || ''); return /^\\d{4}-\\d{2}-\\d{2}/.test(d) ? d.slice(5, 7).replace(/^0/, '') + '월 ' + d.slice(8, 10).replace(/^0/, '') + '일' : d; };
  var stat = { svg: null, i: -1 };
  var parts = function (svg) {
    var card = svg.closest('.km-stat'); if (!card) return null; var dot = card.querySelector('.mo-hdot'), ln = card.querySelector('.mo-hline');
    if (!dot) { if (getComputedStyle(card).position === 'static') card.style.position = 'relative'; ln = document.createElement('i'); ln.className = 'mo-hline'; dot = document.createElement('i'); dot.className = 'mo-hdot'; ln.hidden = dot.hidden = true; card.appendChild(ln); card.appendChild(dot); }
    var seg = card.querySelector('.km-seg-sel'); if (!seg) { seg = document.createElement('i'); seg.className = 'km-seg-sel'; seg.hidden = true; card.appendChild(seg); }
    return { card: card, dot: dot, ln: ln, seg: seg, v: card.querySelector('.km-sv'), l: card.querySelector('.km-sl') };
  };
  // G-282 (Bklit segment selection): dragging from one day to another shades that stretch and shows its change.
  var scrub = function (svg, cx, a0) {
    var D = []; try { D = JSON.parse(svg.getAttribute('data-km-spark') || '[]'); } catch (x) {} if (D.length < 2) return; var p = parts(svg); if (!p) return;
    var r = svg.getBoundingClientRect(), cr = p.card.getBoundingClientRect(), i = Math.max(0, Math.min(D.length - 1, Math.round((cx - r.left) / r.width * (D.length - 1)))), q = D[i];
    var x = r.left - cr.left + q[2] / 200 * r.width, y = r.top - cr.top + q[3] / 56 * r.height;
    p.dot.style.color = D[D.length - 1][1] >= D[0][1] ? '#f04452' : '#3182f6'; p.dot.hidden = p.ln.hidden = false; p.dot.style.left = x + 'px'; p.dot.style.top = y + 'px'; p.ln.style.left = x + 'px'; p.ln.style.top = (r.top - cr.top) + 'px'; p.ln.style.height = r.height + 'px';
    if (p.v) p.v.textContent = fmt(q[1], Number(svg.getAttribute('data-km-digits') || 2)); if (p.l) p.l.textContent = day(q[0]) + (p.l.getAttribute('data-l0') === '종가' ? ' 종가' : '');
    if (a0 != null && a0 !== i && D[a0]) {
      var lo = Math.min(a0, i), hi = Math.max(a0, i), xa = r.left - cr.left + D[lo][2] / 200 * r.width, xb = r.left - cr.left + D[hi][2] / 200 * r.width, ch = (D[hi][1] / D[lo][1] - 1) * 100;
      p.seg.hidden = false; p.seg.style.left = xa + 'px'; p.seg.style.width = Math.max(1, xb - xa) + 'px'; p.seg.style.top = (r.top - cr.top) + 'px'; p.seg.style.height = r.height + 'px';
      if (p.l) { p.l.textContent = day(D[lo][0]) + ' → ' + day(D[hi][0]) + ' '; var b = document.createElement('b'); b.className = ch > 0 ? 'up' : ch < 0 ? 'down' : ''; b.textContent = (ch > 0 ? '+' : '') + ch.toFixed(2) + '%'; p.l.appendChild(b); }
    } else if (p.seg) p.seg.hidden = true;
    stat.svg = svg; stat.i = i;
  };
  var unscrub = function (svg) { var p = svg && parts(svg); if (!p) return; p.dot.hidden = p.ln.hidden = p.seg.hidden = true; if (p.v) p.v.textContent = p.v.getAttribute('data-v0'); if (p.l) p.l.textContent = p.l.getAttribute('data-l0'); stat.svg = null; stat.i = -1; };
  var sa = function (e) { return e.target && e.target.closest ? e.target.closest('.km-sa') : null; };
  var scrubT = null, drag = null;
  document.addEventListener('pointermove', function (e) { var s = sa(e) || (drag && drag.svg); if (s) scrub(s, e.clientX, drag && drag.svg === s ? drag.i0 : null); });
  document.addEventListener('pointerdown', function (e) { var s = sa(e); if (s) { scrub(s, e.clientX); drag = { svg: s, i0: stat.i }; clearTimeout(scrubT); } else if (stat.svg) unscrub(stat.svg); });
  document.addEventListener('pointerup', function (e) { var s = sa(e) || (drag && drag.svg), sel = drag && s && drag.i0 !== stat.i; drag = null; if (s && (e.pointerType !== 'mouse' || sel)) { clearTimeout(scrubT); scrubT = setTimeout(function () { unscrub(s); }, sel ? 3500 : 1800); } });
  document.addEventListener('pointercancel', function () { drag = null; });
  document.addEventListener('pointerout', function (e) { var s = sa(e); if (s && e.pointerType === 'mouse' && !(e.relatedTarget && s.contains(e.relatedTarget))) unscrub(s); });
  document.addEventListener('click', function (e) { if (sa(e) && e.target.closest('a')) e.preventDefault(); }, true);
  document.addEventListener('keydown', function (e) { var s = e.target && e.target.classList && e.target.classList.contains('km-sa') ? e.target : null; if (!s) return; var D = []; try { D = JSON.parse(s.getAttribute('data-km-spark') || '[]'); } catch (x) {} if (!D.length) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); var i = stat.svg === s ? stat.i : D.length; i = Math.max(0, Math.min(D.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1))); var r = s.getBoundingClientRect(); scrub(s, r.left + i / (D.length - 1) * r.width); } else if (e.key === 'Escape') unscrub(s); });
  document.addEventListener('focusout', function (e) { if (e.target && e.target.classList && e.target.classList.contains('km-sa')) unscrub(e.target); });
})();
`;
