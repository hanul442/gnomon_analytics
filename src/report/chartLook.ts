// G-254: small line charts drawn as smooth curves (Bklit UI look, docs/DESIGN.md).
// The curve is monotone: it passes through every close and never overshoots past a high or a low,
// so the picture never shows a price that did not happen.

/**
 * "x,y x,y …" (the points of a polyline) → an SVG path `d` through the same points.
 * Plain JavaScript inside on purpose: SMOOTH_JS hands this very function to the page scripts.
 */
export function smoothD(pts: string): string {
  var p = String(pts).trim().split(/\s+/).map(function (s) { var a = s.split(','); return [Number(a[0]), Number(a[1])]; });
  var n = p.length, f = function (v: number) { return Math.round(v * 10) / 10; };
  if (n < 3) return p.map(function (q, i) { return (i ? 'L' : 'M') + f(q[0]!) + ',' + f(q[1]!); }).join('');
  var m: number[] = [], t: number[] = [];
  for (var i = 0; i < n - 1; i++) { var dx = p[i + 1]![0]! - p[i]![0]!; m.push(dx ? (p[i + 1]![1]! - p[i]![1]!) / dx : 0); }
  t.push(m[0]!);
  for (var j = 1; j < n - 1; j++) {
    var h0 = p[j]![0]! - p[j - 1]![0]!, h1 = p[j + 1]![0]! - p[j]![0]!, s0 = m[j - 1]!, s1 = m[j]!;
    var mid = h0 + h1 ? (s0 * h1 + s1 * h0) / (h0 + h1) : 0;
    t.push((Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(mid)));
  }
  t.push(m[n - 2]!);
  var d = 'M' + f(p[0]![0]!) + ',' + f(p[0]![1]!);
  for (var k = 0; k < n - 1; k++) {
    var a = p[k]!, b = p[k + 1]!, w = (b[0]! - a[0]!) / 3;
    d += 'C' + f(a[0]! + w) + ',' + f(a[1]! + w * t[k]!) + ' ' + f(b[0]! - w) + ',' + f(b[1]! - w * t[k + 1]!) + ' ' + f(b[0]!) + ',' + f(b[1]!);
  }
  return d;
}

/** The same function as page-script source, for scripts that redraw a mini chart in the browser. */
export const SMOOTH_JS = smoothD.toString();

let gid = 0;
/** A unique gradient id per drawn chart on the page. */
export const gradId = (p: string) => `${p}${(gid = (gid + 1) % 1e6)}`;

/** The soft fill under a line: colour at the top fading to nothing at the bottom. */
export const fadeGrad = (id: string, color: string, top = 0.22) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity="${top}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>`;
