// G-258: Bklit UI chart kit, stock charts, redrawn as plain SVG in GNOMON's style (Bklit UI is MIT; only the look is
// borrowed, no React). Server-side pictures are functions that return markup; the ones drawn from data the page
// fetches (peer scatter, screener funnel, live coin line) live in KIT_STOCK_JS as window.GNM_kit.*.
//   profit-loss line  pnlLine()        전략 레이스 · 모의투자 장부 rows (renderArena.ts)
//   line chart        multiLine()      전략별 수익 곡선 (renderArena.ts arenaPanel)
//   ring chart        ringChart()      위원회 합의 (renderParliament.ts) · 성적표 (renderScorecard.ts)
//   heatmap calendar  dailyCalendar()  요약 탭, 지난 1년 하루 등락 (appParts.ts latestLists)
//   scatter           GNM_kit.scatter  같은 테마 PER·ROE (peers.ts)
//   funnel            GNM_kit.funnel   스크리너 조건별 남은 종목 (renderScreener.ts)
//   live line         KIT_STOCK_JS     코인 실시간 가격 (coin pages, from /ticks and the live feed)
// Candles stay on lightweight-charts. Every picture is finished without motion; html.mo only adds the entrance.
import { smoothD, SMOOTH_JS, gradId } from '../chartLook.js';
import { esc } from '../html.js';

const UP = '#f04452', DOWN = '#3182f6';
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------- profit-loss line

/**
 * A small line coloured by its side of the baseline: above it red (gain), below it blue (loss), Korean convention.
 * `values` are equity multiples by default (1 = start). Keeps the `.spark` class so it traces in like other sparklines.
 */
export function pnlLine(values: readonly number[], label: string, opts: { base?: number; w?: number; h?: number } = {}): string {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return '';
  const w = opts.w ?? 140, h = opts.h ?? 40, base = opts.base ?? 1;
  const lo = Math.min(base, ...v), hi = Math.max(base, ...v), span = hi - lo || 1;
  const y = (x: number) => h - 3 - ((x - lo) / span) * (h - 6);
  const pts = v.map((x, i) => `${r1((i / (v.length - 1)) * w)},${r1(y(x))}`).join(' ');
  const by = r1(y(base)), d = smoothD(pts), id = gradId('kpl'), end = v.at(-1)!;
  const area = `${d}L${w},${by}L0,${by}Z`;
  return `<svg viewBox="0 0 ${w} ${h}" class="spark kit-pnl" role="img" aria-label="${esc(label)}"><defs>`
    + `<clipPath id="${id}u"><rect x="0" y="0" width="${w}" height="${by}"/></clipPath><clipPath id="${id}d"><rect x="0" y="${by}" width="${w}" height="${r1(h - by)}"/></clipPath>`
    + `<linearGradient id="${id}gu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${UP}" stop-opacity=".2"/><stop offset="1" stop-color="${UP}" stop-opacity="0"/></linearGradient>`
    + `<linearGradient id="${id}gd" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${DOWN}" stop-opacity=".2"/><stop offset="1" stop-color="${DOWN}" stop-opacity="0"/></linearGradient></defs>`
    + `<line class="kp-base" x1="0" x2="${w}" y1="${by}" y2="${by}"/>`
    + `<g clip-path="url(#${id}u)"><path class="kp-a" d="${area}" fill="url(#${id}gu)"/><path class="spark-l" d="${d}" fill="none" stroke="${UP}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`
    + `<g clip-path="url(#${id}d)"><path class="kp-a" d="${area}" fill="url(#${id}gd)"/><path class="spark-l" d="${d}" fill="none" stroke="${DOWN}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>`
    + `<circle cx="${w}" cy="${r1(y(end))}" r="2.4" fill="${end >= base ? UP : DOWN}"/></svg>`;
}

// ---------------------------------------------------------------- multi-series line chart

export interface LineSeries { name: string; color: string; values: readonly number[]; dash?: boolean }

const niceStep = (span: number, n: number) => { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
const fmtTick = (v: number, unit: string) => `${v > 0 ? '+' : ''}${Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : r1(v)}${unit}`;

/**
 * Several smooth lines on one scale with a legend and a crosshair (KIT_STOCK_JS) that lists every series at the
 * finger. Series are aligned at their last point. `x` labels one point each (shown in the bubble and under the plot).
 */
export function multiLine(series: readonly LineSeries[], opts: { label: string; x: readonly string[]; unit?: string; zero?: number }): string {
  const ss = series.filter((s) => s.values.length >= 2);
  if (!ss.length) return '';
  const n = Math.min(...ss.map((s) => s.values.length)), unit = opts.unit ?? '%';
  const vals = ss.map((s) => s.values.slice(-n).map((v) => r2(v)));
  const x = opts.x.slice(-n);
  const all = [...vals.flat(), ...(opts.zero === undefined ? [] : [opts.zero])], lo0 = Math.min(...all), hi0 = Math.max(...all), pad = (hi0 - lo0 || 1) * 0.08;
  const lo = lo0 - pad, hi = hi0 + pad, W = 600, H = 200;
  const yy = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const step = niceStep(hi - lo, 4), ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(r2(t));
  const grid = ticks.map((t) => `<line x1="0" x2="${W}" y1="${r1(yy(t))}" y2="${r1(yy(t))}" class="kl-g${opts.zero !== undefined && Math.abs(t - opts.zero) < 1e-9 ? ' kl-z' : ''}"/>`).join('');
  const lines = vals.map((v, k) => `<path class="kl-l" d="${smoothD(v.map((p, i) => `${r1((i / (n - 1)) * W)},${r1(yy(p))}`).join(' '))}" fill="none" style="stroke:${ss[k]!.color}"${ss[k]!.dash ? ' stroke-dasharray="5 4"' : ''} stroke-width="2" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const labels = ticks.map((t) => `<span style="top:${r1((yy(t) / H) * 100)}%">${esc(fmtTick(t, unit))}</span>`).join('');
  const last = (v: number[]) => v.at(-1)!;
  const tone = (v: number) => (v > (opts.zero ?? 0) ? 'up' : v < (opts.zero ?? 0) ? 'down' : '');
  const legend = ss.map((s, k) => `<li><i style="background:${s.color}"${s.dash ? ' class="dash"' : ''}></i>${esc(s.name)} <b class="${tone(last(vals[k]!))}">${esc(fmtTick(last(vals[k]!), unit))}</b></li>`).join('');
  const data = { x, u: unit, lo: r2(lo), hi: r2(hi), s: ss.map((s, k) => ({ n: s.name, c: s.color, v: vals[k] })) };
  const mid = x[Math.floor((n - 1) / 2)] ?? '';
  return `<figure class="kit-lc" data-lc="${esc(JSON.stringify(data))}"><ul class="kl-leg">${legend}</ul>`
    + `<div class="kl-plot" tabindex="0" role="img" aria-label="${esc(opts.label)}"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">${grid}${lines}</svg><div class="kl-y" aria-hidden="true">${labels}</div></div>`
    + `<div class="kl-x" aria-hidden="true"><span>${esc(x[0] ?? '')}</span><span>${esc(mid)}</span><span>${esc(x.at(-1) ?? '')}</span></div></figure>`;
}

// ---------------------------------------------------------------- ring chart

export interface Ring { label: string; value: number | null; color: string; text: string }

/**
 * Concentric progress rings (outermost first), a big number in the middle and a legend beside. `value` is 0–1;
 * a null value draws only the track. `cls` is added to the figure (callers keep their own hooks).
 */
export function ringChart(rings: readonly Ring[], opts: { label: string; big: string; small?: string; cls?: string }): string {
  const rs = rings.slice(0, 4), S = 120, c = S / 2, sw = rs.length > 3 ? 7 : 9, gap = sw + 4;
  const arcs = rs.map((r, i) => {
    const rad = c - sw / 2 - 2 - i * gap, v = r.value == null ? 0 : Math.max(0, Math.min(1, r.value));
    return `<circle class="kr-t" cx="${c}" cy="${c}" r="${rad}" stroke-width="${sw}"/>`
      + (v > 0 ? `<circle class="kr-arc" cx="${c}" cy="${c}" r="${rad}" stroke-width="${sw}" pathLength="100" stroke-dasharray="${r1(v * 100)} 100" transform="rotate(-90 ${c} ${c})" style="stroke:${r.color};--i:${i}"/>` : '');
  }).join('');
  const legend = rs.map((r) => `<li><i style="background:${r.color}"></i><span>${esc(r.label)}</span><b>${esc(r.text)}</b></li>`).join('');
  return `<figure class="kit-ring${opts.cls ? ` ${opts.cls}` : ''}"><div class="kr-fig"><svg viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(opts.label)}">${arcs}</svg><div class="kr-c"><b>${esc(opts.big)}</b>${opts.small ? `<small>${esc(opts.small)}</small>` : ''}</div></div><ul class="kr-leg">${legend}</ul></figure>`;
}

// ---------------------------------------------------------------- calendar heatmap

const dayNo = (s: string) => Math.floor(Date.parse(`${s.slice(0, 10)}T00:00:00Z`) / 864e5);
/** Monday = 0 … Sunday = 6 (1970-01-01 was a Thursday). */
const dow = (n: number) => (((n + 3) % 7) + 7) % 7;
const level = (p: number) => { const a = Math.abs(p); return a < 0.05 ? 'z' : `${p > 0 ? 'u' : 'd'}${a < 1 ? 1 : a < 2 ? 2 : a < 4 ? 3 : 4}`; };

/**
 * GitHub-style calendar of each session's close-to-close move over the last year (≤250 sessions), red up and
 * blue down by size, in two bands of half a year so the squares stay finger-sized on a phone. Weekdays only
 * for stocks; coins (which trade every day) get all seven rows.
 */
export function dailyCalendar(bars: readonly { date: string; close: number }[], opts: { title?: string } = {}): string {
  const b = bars.filter((x) => Number.isFinite(x.close) && x.close > 0).slice(-251);
  if (b.length < 30) return '';
  const days = b.slice(1).map((x, i) => { const n = dayNo(x.date); return { date: x.date.slice(0, 10), n, pct: (x.close / b[i]!.close - 1) * 100, close: x.close }; });
  const seven = days.some((d) => dow(d.n) >= 5), rows = seven ? 7 : 5;
  const mon = days[0]!.n - dow(days[0]!.n), weeks = Math.floor((days.at(-1)!.n - mon) / 7) + 1;
  const per = Math.ceil(weeks / 2), P = 12, cell = 10, left = 16, top = 12, bandH = top + rows * P, W = left + per * P, H = bandH * 2 + 10;
  const at = new Map(days.map((d, i) => [d.n, i]));
  const pos = (n: number) => { const wk = Math.floor((n - mon) / 7), band = wk >= per ? 1 : 0; return { x: left + (wk - band * per) * P, y: band * (bandH + 10) + top + dow(n) * P, wk, band }; };
  let cells = '', months = '';
  for (let n = days[0]!.n; n <= days.at(-1)!.n; n += 1) {
    if (dow(n) >= rows) continue;
    const p = pos(n), i = at.get(n);
    cells += i === undefined ? `<rect x="${p.x}" y="${p.y}" width="${cell}" height="${cell}" rx="2" class="kc e"/>` : `<rect x="${p.x}" y="${p.y}" width="${cell}" height="${cell}" rx="2" class="kc ${level(days[i]!.pct)}" data-i="${i}"/>`;
  }
  // A month's name over the first week that holds its first day, never closer than three weeks to the last name.
  let lastM = -1, lastAt = -9;
  for (let wk = 0; wk < weeks; wk += 1) {
    const n = Math.max(days[0]!.n, mon + wk * 7), m = new Date(n * 864e5).getUTCMonth(), band = wk >= per ? 1 : 0, col = wk - band * per;
    if (col === 0) lastAt = -9;
    if (m !== lastM && col - lastAt >= 3) { months += `<text x="${left + col * P}" y="${band * (bandH + 10) + 8}" class="kc-m">${!months || m === 0 ? `${String(new Date(n * 864e5).getUTCFullYear()).slice(2)}년 ` : ''}${m + 1}월</text>`; lastAt = col; }
    lastM = m;
  }
  const wd = ['월', '', '수', '', '금', '', '일'];
  const wlab = [0, 1].map((band) => wd.slice(0, rows).map((t, r) => (t ? `<text x="0" y="${band * (bandH + 10) + top + r * P + 8.5}" class="kc-m">${t}</text>` : '')).join('')).join('');
  const up = days.filter((d) => d.pct >= 0.05).length, down = days.filter((d) => d.pct <= -0.05).length;
  const best = days.reduce((a, d) => (d.pct > a.pct ? d : a)), worst = days.reduce((a, d) => (d.pct < a.pct ? d : a));
  const md = (s: string) => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일`;
  const sg = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
  const data = days.map((d) => [d.date, r2(d.pct), d.close]);
  const swatch = (c: string) => `<i class="kc-sw ${c}"></i>`;
  return `<section class="block kit-cal-sec"><div class="block-head"><h2>${esc(opts.title ?? '지난 1년 하루 등락')}</h2><span class="muted small">${esc(days[0]!.date.slice(2).replace(/-/g, '.'))} ~ ${esc(days.at(-1)!.date.slice(2).replace(/-/g, '.'))} · ${days.length}거래일</span></div><div class="card">`
    + `<figure class="kit-cal" data-cal="${esc(JSON.stringify(data))}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`하루 등락 달력: 오른 날 ${up}일, 내린 날 ${down}일`)}">${months}${wlab}${cells}</svg>`
    + `<figcaption class="kc-leg"><span>내림</span>${['d4', 'd3', 'd2', 'd1', 'z', 'u1', 'u2', 'u3', 'u4'].map(swatch).join('')}<span>오름</span></figcaption></figure>`
    + `<p class="kc-sum">오른 날 <b class="up">${up}일</b> · 내린 날 <b class="down">${down}일</b> · 가장 크게 오른 날 ${esc(md(best.date))} <b class="up">${sg(best.pct)}</b> · 가장 크게 내린 날 ${esc(md(worst.date))} <b class="down">${sg(worst.pct)}</b></p>`
    + `<p class="fine">칸 하나가 하루예요. 전날 종가 대비 등락이 클수록 진해요(1%·2%·4% 기준). 빈 칸은 장이 쉰 날이에요. 칸을 누르면 그날 등락이 나와요.</p></div></section>`;
}

// ---------------------------------------------------------------- styles

export const KIT_STOCK_CSS = `
.race .spark.race-pnl{display:block;width:100%;max-width:440px;height:auto;margin:2px 0 10px}
.kit-pnl .kp-base{stroke:var(--muted);stroke-opacity:.45;stroke-dasharray:2 3}
html.mo .kit-pnl:not(.mo-in) .kp-a{opacity:0}html.mo .kit-pnl.mo-in .kp-a{opacity:1;transition:opacity .6s .7s}
.kit-lc{margin:0;position:relative;min-width:0}.kl-leg{list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px;margin:0 0 10px;padding:0;font-size:12.5px;color:var(--fg2)}.kl-leg li{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.kl-leg i{width:12px;height:3px;border-radius:2px}.kl-leg i.dash{background:repeating-linear-gradient(90deg,var(--muted) 0 4px,transparent 4px 6px)!important}.kl-leg b{font-variant-numeric:tabular-nums}
.kl-plot{position:relative;height:200px;touch-action:pan-y;cursor:crosshair;border-radius:8px}.kl-plot:focus-visible{outline:2px solid var(--accent);outline-offset:3px}.kl-plot svg{position:absolute;left:0;top:0;width:calc(100% - 46px);height:100%;overflow:visible}
.kl-g{stroke:var(--line);stroke-width:1;vector-effect:non-scaling-stroke}.kl-z{stroke:var(--muted);stroke-opacity:.55;stroke-dasharray:3 3}
.kl-y span{position:absolute;right:0;transform:translateY(-50%);font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;pointer-events:none}
.kl-x{display:flex;margin-right:46px;justify-content:space-between;margin-top:6px;font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.kl-dot{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;border:2px solid var(--surface-solid,#fff);pointer-events:none;box-sizing:border-box}.kl-dot[hidden]{display:none}
html.mo .kit-lc:not(.kit-in) .kl-l{clip-path:inset(0 100% 0 0)}html.mo .kit-lc.kit-in .kl-l{clip-path:inset(0 0 0 0);transition:clip-path 1.3s var(--ease-out)}
.sc-ring{margin:18px 0 0;max-width:460px}.pl-ring{margin:4px 0 12px;max-width:420px}
.kit-ring{display:flex;align-items:center;gap:16px;margin:0;min-width:0}.kr-fig{position:relative;flex:none;width:112px;height:112px}.kr-fig svg{width:100%;height:100%;display:block}
.kr-t{fill:none;stroke:var(--soft);stroke:color-mix(in srgb,var(--muted) 16%,transparent)}.kr-arc{fill:none;stroke-linecap:round;transition:stroke-dasharray 1.1s var(--ease-out) calc(var(--i,0) * 140ms)}
html.mo .kit-ring:not(.kit-in) .kr-arc{stroke-dasharray:0 100}
.kr-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none}.kr-c b{font-size:22px;line-height:1.1;font-weight:800;color:var(--fg);font-variant-numeric:tabular-nums}.kr-c small{font-size:11px;color:var(--muted);margin-top:2px}
.kr-leg{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px;min-width:0;flex:1}.kr-leg li{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center;font-size:13px;color:var(--fg2)}.kr-leg i{width:10px;height:10px;border-radius:50%}.kr-leg span{min-width:0;overflow-wrap:anywhere}.kr-leg b{color:var(--fg);font-variant-numeric:tabular-nums;white-space:nowrap}
.kit-cal{margin:0;position:relative}.kit-cal svg{display:block;width:100%;max-width:560px;height:auto;touch-action:pan-y}
.kc{fill:var(--line)}.kc.e{fill:none;stroke:var(--line);stroke-width:1}.kc.z{fill:var(--muted);fill-opacity:.3}
.kc.u1{fill:${UP};fill-opacity:.28}.kc.u2{fill:${UP};fill-opacity:.5}.kc.u3{fill:${UP};fill-opacity:.75}.kc.u4{fill:${UP}}
.kc.d1{fill:${DOWN};fill-opacity:.28}.kc.d2{fill:${DOWN};fill-opacity:.5}.kc.d3{fill:${DOWN};fill-opacity:.75}.kc.d4{fill:${DOWN}}
.kc[data-i]{cursor:pointer}.kc.hi{stroke:var(--fg);stroke-width:1.5}.kc-m{font-size:8px;fill:var(--muted)}
.kc-leg{display:flex;align-items:center;gap:3px;margin-top:8px;font-size:11.5px;color:var(--muted)}.kc-leg span{margin:0 4px}.kc-sw{display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--line)}
.kc-sw.z{background:color-mix(in srgb,var(--muted) 30%,transparent)}.kc-sw.u1{background:${UP}47}.kc-sw.u2{background:${UP}80}.kc-sw.u3{background:${UP}bf}.kc-sw.u4{background:${UP}}.kc-sw.d1{background:${DOWN}47}.kc-sw.d2{background:${DOWN}80}.kc-sw.d3{background:${DOWN}bf}.kc-sw.d4{background:${DOWN}}
.kc-sum{margin:10px 0 0;font-size:13.5px;line-height:1.7;color:var(--fg2)}
html.mo .kit-cal:not(.kit-in) .kc{opacity:0}html.mo .kit-cal.kit-in .kc{opacity:1;transition:opacity .5s}
.kit-scatter{position:relative;margin:4px 0 12px}.kit-scatter svg{display:block;width:100%;touch-action:pan-y}.ks-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin:0 0 6px}.ks-h b{font-size:15px}.ks-h small{font-size:12px;color:var(--muted)}
.ks-g{stroke:var(--line)}.ks-m{stroke:var(--muted);stroke-opacity:.5;stroke-dasharray:3 3}.ks-t{font-size:10.5px;fill:var(--muted);font-variant-numeric:tabular-nums}.ks-n{font-size:11.5px;font-weight:800;fill:var(--fg)}
.ks-d{fill:var(--accent);fill-opacity:.5;stroke:var(--accent);stroke-width:1.2;cursor:pointer;transition:r .15s,fill-opacity .15s}.ks-d.me{fill:${UP};fill-opacity:1;stroke:var(--surface-solid,#fff);stroke-width:2}.ks-d.hi{fill-opacity:.95}
html.mo .kit-scatter:not(.kit-in) .ks-d{opacity:0;transform:scale(.2)}.ks-d{transform-box:fill-box;transform-origin:center}html.mo .kit-scatter.kit-in .ks-d{opacity:1;transform:none;transition:opacity .4s calc(var(--i,0) * 60ms),transform .55s var(--ease-spring,ease-out) calc(var(--i,0) * 60ms),r .15s}
.kit-funnel[hidden],.kit-live[hidden],.kit-scatter[hidden]{display:none!important}
.kit-funnel{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(70px,1fr) auto;column-gap:10px;margin:2px 0 12px;padding:10px 12px;border-radius:12px;background:var(--soft)}
.kf-h{grid-column:1/-1;display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px;font-size:13px}.kf-h b{font-size:13.5px}.kf-h small{color:var(--muted);font-size:11.5px}
.kf-l,.kf-n{height:28px;display:flex;align-items:center;font-size:12.5px;min-width:0}.kf-l{color:var(--fg2)}.kf-l span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kf-n{justify-content:flex-end;gap:6px;font-variant-numeric:tabular-nums;white-space:nowrap}.kf-n b{font-size:13px}.kf-n small{color:var(--muted);font-size:11px}
.kf-s{grid-column:2;grid-row:2/span var(--rows);width:100%;height:calc(var(--rows) * 28px);display:block}.kf-s rect{fill:var(--accent);transform-box:fill-box;transform-origin:center}.kf-s path{fill:var(--accent);fill-opacity:.14}
html.mo .kit-funnel:not(.kit-in) .kf-s rect{transform:scaleX(0)}html.mo .kit-funnel.kit-in .kf-s rect{transform:none;transition:transform .7s var(--ease-out) calc(var(--i,0) * 90ms)}
html.mo .kit-funnel:not(.kit-in) .kf-s path{opacity:0}html.mo .kit-funnel.kit-in .kf-s path{opacity:1;transition:opacity .5s .4s}
.kit-live .card{position:relative}.kv-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.kv-h h2{margin:0;font-size:16px}.kv-h small{color:var(--muted);font-size:12px}
.kv-plot{position:relative;height:150px;margin-top:10px;overflow:hidden;touch-action:pan-y}.kv-plot svg{position:absolute;left:0;top:0;display:block}
.kv-l{fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.kv-g{stroke:var(--line)}
.kv-val{position:absolute;right:4px;transform:translateY(-50%);padding:2px 8px;border-radius:999px;font-size:12px;font-weight:800;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none}
html.mo .kv-val{transition:top .45s var(--ease-out),background .3s}
.kv-pulse{transform-box:fill-box;transform-origin:center;opacity:0}html.mo .kv-pulse{animation:kv-pulse 1.8s ease-out infinite}
@keyframes kv-pulse{0%{transform:scale(.6);opacity:.8}100%{transform:scale(2.6);opacity:0}}
.kv-foot{display:flex;justify-content:space-between;margin-top:6px;font-size:11.5px;color:var(--muted)}
@media (max-width:600px){.kl-plot{height:180px}.kr-fig{width:100px;height:100px}.kit-ring{gap:12px}.kr-leg li{font-size:12.5px}}
`;

// ---------------------------------------------------------------- page script

export const KIT_STOCK_JS = `
(function () {
  ${SMOOTH_JS}
  var root = document.documentElement, NS = 'http://www.w3.org/2000/svg', UP = '${UP}', DOWN = '${DOWN}';
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var r1 = function (v) { return Math.round(v * 10) / 10; };
  var sg = function (v, u) { return (v > 0 ? '+' : '') + (Math.abs(v) >= 100 ? Math.round(v).toLocaleString('ko-KR') : r1(v)) + (u == null ? '%' : u); };
  var won = function (v) { var a = Math.abs(v); if (root.getAttribute('data-ccy') === 'USD') return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (a >= 100 ? Math.round(v).toLocaleString('ko-KR') : v.toLocaleString('ko-KR', { maximumFractionDigits: a >= 1 ? 2 : 4 })) + '원'; };
  var mkTip = function (host) { if (getComputedStyle(host).position === 'static') host.style.position = 'relative'; var t = document.createElement('div'); t.className = 'mo-tip'; t.hidden = true; t.setAttribute('role', 'status'); host.appendChild(t); return t; };
  var place = function (t, host, x, y) { t.hidden = false; var w = t.offsetWidth, hw = host.clientWidth; t.style.left = Math.max(w / 2 + 2, Math.min(hw - w / 2 - 2, x)) + 'px'; t.classList.toggle('below', y - t.offsetHeight - 12 < 0); t.style.top = y + 'px'; };
  var outside = function (host, hide) { document.addEventListener('pointerdown', function (e) { if (!host.contains(e.target)) hide(); }); };
  // ---- entrance: a picture plays once it is well on screen, and again after it was scrolled away ----
  var SEL = '.kit-ring, .kit-lc, .kit-cal, .kit-funnel, .kit-scatter';
  var io = root.classList.contains('mo') && 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && e.intersectionRatio >= 0.3) e.target.classList.add('kit-in'); else if (!e.isIntersecting) e.target.classList.remove('kit-in'); }); }, { threshold: [0, 0.3, 0.6] }) : null;
  var watch = function (el) { if (el.__kitSeen) return; el.__kitSeen = 1; if (io) io.observe(el); else el.classList.add('kit-in'); };

  // ---- line chart: crosshair with every series' value at the finger ----
  var lineChart = function (fig) {
    var D = null; try { D = JSON.parse(fig.getAttribute('data-lc') || 'null'); } catch (e) {} var plot = fig.querySelector('.kl-plot'); if (!D || !plot) return;
    var n = D.x.length, tp = mkTip(fig), vl = document.createElement('i'), dots = D.s.map(function (s) { var d = document.createElement('i'); d.className = 'kl-dot'; d.style.background = s.c; d.hidden = true; plot.appendChild(d); return d; }), idx = -1, timer = 0;
    vl.className = 'mo-hline'; vl.hidden = true; plot.appendChild(vl);
    var hide = function () { tp.hidden = vl.hidden = true; dots.forEach(function (d) { d.hidden = true; }); idx = -1; };
    var at = function (i) {
      idx = Math.max(0, Math.min(n - 1, i)); var w = plot.clientWidth - 46, h = plot.clientHeight, x = idx / (n - 1) * w, f = fig.getBoundingClientRect(), p = plot.getBoundingClientRect(), top = h;
      vl.hidden = false; vl.style.left = x + 'px'; vl.style.top = '0px'; vl.style.height = h + 'px';
      var rows = D.s.map(function (s, k) { var v = s.v[idx], y = h - (v - D.lo) / (D.hi - D.lo) * h; dots[k].hidden = false; dots[k].style.left = x + 'px'; dots[k].style.top = y + 'px'; top = Math.min(top, y); return [v, k]; });
      rows.sort(function (a, b) { return b[0] - a[0]; });
      tp.innerHTML = '<b>' + esc(D.x[idx]) + '</b>' + rows.map(function (r) { var s = D.s[r[1]]; return '<br><i style="background:' + esc(s.c) + '"></i>' + esc(s.n) + ' <b class="' + (r[0] > 0 ? 'up' : r[0] < 0 ? 'down' : '') + '">' + esc(sg(r[0], D.u)) + '</b>'; }).join('');
      place(tp, fig, p.left - f.left + x, p.top - f.top + top);
    };
    var move = function (e) { var r = plot.getBoundingClientRect(); at(Math.round((e.clientX - r.left) / Math.max(1, r.width - 46) * (n - 1))); };
    plot.addEventListener('pointermove', move); plot.addEventListener('pointerdown', move);
    plot.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
    plot.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') { clearTimeout(timer); timer = setTimeout(hide, 2200); } });
    plot.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); at(idx < 0 ? n - 1 : idx + (e.key === 'ArrowRight' ? 1 : -1)); } else if (e.key === 'Escape') hide(); });
    plot.addEventListener('blur', hide); outside(fig, hide);
  };

  // ---- calendar: the day under the finger ----
  var calendar = function (fig) {
    var D = []; try { D = JSON.parse(fig.getAttribute('data-cal') || '[]'); } catch (e) {} var svg = fig.querySelector('svg'); if (!D.length || !svg) return;
    var tp = mkTip(fig), cur = null, W = ['일', '월', '화', '수', '목', '금', '토'];
    var hide = function () { tp.hidden = true; if (cur) cur.classList.remove('hi'); cur = null; };
    var show = function (el) {
      if (!el || !el.hasAttribute('data-i')) return; var d = D[Number(el.getAttribute('data-i'))]; if (!d) return;
      if (cur) cur.classList.remove('hi'); cur = el; el.classList.add('hi');
      var dt = new Date(d[0] + 'T00:00:00Z'), r = el.getBoundingClientRect(), f = fig.getBoundingClientRect();
      tp.innerHTML = esc(d[0].slice(2).replace(/-/g, '.')) + ' (' + W[dt.getUTCDay()] + ') <b class="' + (d[1] > 0 ? 'up' : d[1] < 0 ? 'down' : '') + '">' + (d[1] > 0 ? '+' : '') + d[1].toFixed(2) + '%</b> · 종가 ' + esc(won(d[2]));
      place(tp, fig, r.left - f.left + r.width / 2, r.top - f.top);
    };
    var pick = function (e) { var el = document.elementFromPoint(e.clientX, e.clientY); if (el && el.classList && el.classList.contains('kc')) show(el); };
    svg.addEventListener('pointermove', pick); svg.addEventListener('pointerdown', pick);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
    outside(fig, hide);
  };

  // ---- scatter: one dot per peer, this stock in red, medians as dashed lines ----
  var nice = function (lo, hi, n) { var raw = (hi - lo) / n || 1, p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), m = raw / p, st = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p, out = []; for (var t = Math.ceil(lo / st) * st; t <= hi + 1e-9; t += st) out.push(Math.round(t * 1e6) / 1e6); return out; };
  var median = function (xs) { var a = xs.slice().sort(function (x, y) { return x - y; }); if (!a.length) return null; var m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  var scatter = function (host, pts, o) {
    o = o || {}; host.__ks = [pts, o]; host.classList.add('kit-scatter');
    if (pts.length < 2) { host.hidden = true; return; } host.hidden = false;
    var W = Math.max(200, host.clientWidth || 320), H = 220, L = 40, R = 12, T = 14, B = 30;
    var xs = pts.map(function (p) { return p.x; }), ys = pts.map(function (p) { return p.y; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), px = (x1 - x0 || 1) * 0.1, py = (y1 - y0 || 1) * 0.12;
    x0 -= px; x1 += px; y0 -= py; y1 += py; if (x0 < 0 && Math.min.apply(null, xs) >= 0) x0 = 0;
    var X = function (v) { return L + (v - x0) / (x1 - x0) * (W - L - R); }, Y = function (v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); };
    var g = '', mx = median(xs), my = median(ys);
    nice(x0, x1, 4).forEach(function (t) { if (t < x0 || t > x1) return; g += '<line class="ks-g" x1="' + r1(X(t)) + '" x2="' + r1(X(t)) + '" y1="' + T + '" y2="' + (H - B) + '"/><text class="ks-t" x="' + r1(X(t)) + '" y="' + (H - B + 14) + '" text-anchor="middle">' + t + '</text>'; });
    nice(y0, y1, 4).forEach(function (t) { if (t < y0 || t > y1) return; g += '<line class="ks-g" x1="' + L + '" x2="' + (W - R) + '" y1="' + r1(Y(t)) + '" y2="' + r1(Y(t)) + '"/><text class="ks-t" x="' + (L - 6) + '" y="' + r1(Y(t) + 3.5) + '" text-anchor="end">' + t + '</text>'; });
    if (mx != null) g += '<line class="ks-m" x1="' + r1(X(mx)) + '" x2="' + r1(X(mx)) + '" y1="' + T + '" y2="' + (H - B) + '"/>';
    if (my != null) g += '<line class="ks-m" x1="' + L + '" x2="' + (W - R) + '" y1="' + r1(Y(my)) + '" y2="' + r1(Y(my)) + '"/>';
    g += '<text class="ks-t" x="' + (W - R) + '" y="' + (H - 4) + '" text-anchor="end">' + esc(o.xl || '') + ' →</text><text class="ks-t" x="4" y="' + (T - 4) + '">↑ ' + esc(o.yl || '') + '</text>';
    var order = pts.map(function (p, i) { return i; }).sort(function (a, b) { return (pts[a].me ? 1 : 0) - (pts[b].me ? 1 : 0); });
    var dots = order.map(function (i, k) { var p = pts[i]; return '<circle class="ks-d' + (p.me ? ' me' : '') + '" data-k="' + i + '" cx="' + r1(X(p.x)) + '" cy="' + r1(Y(p.y)) + '" r="' + (p.me ? 7 : 5.5) + '" style="--i:' + k + '"/>'; }).join('');
    var me = pts.filter(function (p) { return p.me; })[0], lab = '';
    if (me) { var lx = X(me.x), right = lx < W * 0.6; lab = '<text class="ks-n" x="' + r1(lx + (right ? 11 : -11)) + '" y="' + r1(Y(me.y) + 4) + '" text-anchor="' + (right ? 'start' : 'end') + '">' + esc(me.name) + '</text>'; }
    host.innerHTML = (o.title ? '<div class="ks-h"><b>' + esc(o.title) + '</b><small>' + esc(o.sub || '') + '</small></div>' : '') + '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" tabindex="0" role="img" aria-label="' + esc(o.label || o.title || '') + '">' + g + dots + lab + '</svg>' + (o.note ? '<p class="fine">' + esc(o.note) + '</p>' : '');
    var svg = host.querySelector('svg'), tp = mkTip(host), cur = -1;
    var hide = function () { tp.hidden = true; svg.querySelectorAll('.ks-d.hi').forEach(function (d) { d.classList.remove('hi'); d.setAttribute('r', d.classList.contains('me') ? 7 : 5.5); }); cur = -1; };
    var show = function (i) { hide(); cur = i; var p = pts[i], d = svg.querySelector('[data-k="' + i + '"]'); if (!d) return; d.classList.add('hi'); d.setAttribute('r', p.me ? 8.5 : 7.5);
      var r = d.getBoundingClientRect(), f = host.getBoundingClientRect();
      tp.innerHTML = '<b>' + esc(p.name) + '</b>' + (p.me ? ' · 이 종목' : '') + '<br>' + esc(o.xl || 'x') + ' <b>' + esc(o.xf ? o.xf(p.x) : p.x) + '</b> · ' + esc(o.yl || 'y') + ' <b>' + esc(o.yf ? o.yf(p.y) : p.y) + '</b>';
      place(tp, host, r.left - f.left + r.width / 2, r.top - f.top); };
    var pick = function (e) { var r = svg.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = -1, bd = 26 * 26; pts.forEach(function (p, i) { var dx = X(p.x) - x, dy = Y(p.y) - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }); if (best >= 0) { if (best !== cur) show(best); } else if (e.pointerType === 'mouse') hide(); };
    svg.addEventListener('pointermove', pick); svg.addEventListener('pointerdown', pick);
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hide(); });
    svg.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); var k = order.indexOf(cur); k = k < 0 ? order.length - 1 : (k + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length; show(order[k]); } else if (e.key === 'Escape') hide(); });
    svg.addEventListener('blur', hide); outside(host, hide);
    host.__ksW = host.clientWidth; if (ro && !host.__ksRo) { host.__ksRo = 1; ro.observe(host); }
    watch(host);
  };

  // ---- funnel: 전체 → each condition in turn → what is left ----
  var funnel = function (host, steps, o) {
    o = o || {}; host.__kf = [steps, o];
    if (!steps || steps.length < 2) { host.hidden = true; host.innerHTML = ''; return; } host.hidden = false; host.classList.add('kit-funnel');
    var n0 = Math.max(1, steps[0].n), RH = 28, H = steps.length * RH, w = function (n) { return Math.max(3, n / n0 * 100); }, shape = '';
    steps.forEach(function (s, i) {
      var a = w(s.n), y = i * RH + 6, h = RH - 12;
      shape += '<rect x="' + r1((100 - a) / 2) + '" y="' + y + '" width="' + r1(a) + '" height="' + h + '" style="--i:' + i + ';fill-opacity:' + (i === steps.length - 1 ? 1 : r1(0.9 - i * 0.5 / steps.length)) + '"/>';
      if (i < steps.length - 1) { var b = w(steps[i + 1].n), y2 = (i + 1) * RH + 6; shape += '<path d="M' + r1((100 - a) / 2) + ',' + (y + h) + 'L' + r1((100 + a) / 2) + ',' + (y + h) + 'L' + r1((100 + b) / 2) + ',' + y2 + 'L' + r1((100 - b) / 2) + ',' + y2 + 'Z"/>'; }
    });
    var rows = steps.map(function (s, i) { var drop = i ? steps[i - 1].n - s.n : 0; return '<div class="kf-l" style="grid-row:' + (i + 2) + '"><span title="' + esc(s.label) + '">' + esc(s.label) + '</span></div><div class="kf-n" style="grid-row:' + (i + 2) + '">' + (i && drop > 0 ? '<small>−' + drop.toLocaleString('ko-KR') + '</small>' : '') + '<b>' + s.n.toLocaleString('ko-KR') + '</b></div>'; }).join('');
    host.style.setProperty('--rows', steps.length);
    host.innerHTML = '<div class="kf-h"><b>' + esc(o.title || '조건별로 남은 종목') + '</b><small>' + esc(o.sub || '위에서부터 차례로 걸러요') + '</small></div>' + rows + '<svg class="kf-s" viewBox="0 0 100 ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(steps.map(function (s) { return s.label + ' ' + s.n + '개'; }).join(', ')) + '">' + shape + '</svg>';
    watch(host);
  };

  // ---- live line: a coin's price as it trades, scrolling left, the last point pulsing ----
  var live = function () {
    var q = new URLSearchParams(location.search), sym = q.get('m') || ((document.querySelector('[data-symbol]') || {}).dataset || {}).symbol || '';
    if (!/^KRW-[A-Z0-9]{1,15}$/.test(sym)) { var lv = document.querySelector('.hero [data-live^="KRW-"]'); sym = lv ? lv.getAttribute('data-live') : ''; }
    if (!/^KRW-[A-Z0-9]{1,15}$/.test(sym) || document.querySelector('.kit-live')) return;
    var hero = document.querySelector('#tab-home .hero') || document.querySelector('.hero'); if (!hero) return;
    var sec = document.createElement('section'); sec.className = 'block kit-live'; sec.hidden = true;
    sec.innerHTML = '<div class="card"><div class="kv-h"><h2>실시간 가격</h2><small data-kv-note>업비트 체결가 · 최근 3분</small></div><div class="kv-plot" role="img" aria-label="실시간 가격 선"></div><div class="kv-foot"><span data-kv-from></span><span>지금</span></div></div>';
    hero.after(sec);
    var plot = sec.querySelector('.kv-plot'), pts = [], SPAN = 180, raf = 0, shift = 0, from = 0, to = 0, t0 = 0, last = 0;
    var draw = function () {
      if (pts.length < 2) return; sec.hidden = false;
      var W = plot.clientWidth || 320, H = plot.clientHeight || 150, now = pts[pts.length - 1].t, start = now - SPAN, vis = pts.filter(function (p) { return p.t >= start - 10; });
      if (vis.length < 2) vis = pts.slice(-2);
      var lo = Math.min.apply(null, vis.map(function (p) { return p.v; })), hi = Math.max.apply(null, vis.map(function (p) { return p.v; })), sp = hi - lo || Math.abs(hi) * 0.001 || 1, padR = 64;
      var X = function (t) { return (t - start) / SPAN * (W - padR) + shift; }, Y = function (v) { return 12 + (1 - (v - lo) / sp) * (H - 24); };
      var line = smoothD(vis.map(function (p) { return r1(X(p.t)) + ',' + r1(Y(p.v)); }).join(' ')), lp = vis[vis.length - 1], up = lp.v >= pts[0].v, col = up ? UP : DOWN, lx = r1(X(lp.t)), ly = r1(Y(lp.v));
      var grid = [0.25, 0.5, 0.75].map(function (k) { return '<line class="kv-g" x1="0" x2="' + W + '" y1="' + r1(12 + k * (H - 24)) + '" y2="' + r1(12 + k * (H - 24)) + '"/>'; }).join('');
      plot.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><defs><linearGradient id="kv-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".2"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>' + grid + '<path d="' + line + 'L' + lx + ',' + H + 'L' + r1(X(vis[0].t)) + ',' + H + 'Z" fill="url(#kv-g)"/><path class="kv-l" d="' + line + '" style="stroke:' + col + '"/><circle class="kv-pulse" cx="' + lx + '" cy="' + ly + '" r="5" fill="' + col + '"/><circle cx="' + lx + '" cy="' + ly + '" r="4" fill="' + col + '" stroke="var(--surface-solid,#fff)" stroke-width="1.5"/></svg><span class="kv-val" style="top:' + ly + 'px;background:' + col + '">' + esc(won(lp.v)) + '</span>';
      var f = sec.querySelector('[data-kv-from]'); if (f) { var d = new Date((start + 9 * 3600) * 1000); f.textContent = d.toISOString().slice(11, 19); }
    };
    // A new point slides in from the right: the whole line eases left by one step (motion only).
    var slide = function (px) {
      if (!root.classList.contains('mo') || document.hidden) { shift = 0; draw(); return; }
      cancelAnimationFrame(raf); from = px; t0 = 0;
      var step = function (ts) { if (!t0) t0 = ts; var k = Math.min(1, (ts - t0) / 600), e = 1 - Math.pow(1 - k, 3); shift = from * (1 - e); draw(); if (k < 1) raf = requestAnimationFrame(step); };
      raf = requestAnimationFrame(step);
    };
    var add = function (t, v) {
      if (!(v > 0)) return; if (t <= last) t = last + 0.5; var prevT = pts.length ? pts[pts.length - 1].t : t; last = t; pts.push({ t: t, v: v });
      while (pts.length > 2 && pts[1].t < t - SPAN - 30) pts.shift();
      var W = plot.clientWidth || 320; slide((t - prevT) / SPAN * (W - 64));
    };
    var api = window.GNM && GNM.api;
    if (api) fetch(api + '/ticks/' + sym).then(function (r) { return r.json(); }).then(function (r) {
      var ps = (r && r.points) || []; if (!ps.length) return; var end = ps[ps.length - 1].time, off = (pts.length ? pts[0].t - 1 : Date.now() / 1000) - end;
      // Recent trades keep their spacing and end where the live feed starts.
      pts.unshift.apply(pts, ps.slice(-120).filter(function (p) { return p.price > 0; }).map(function (p) { return { t: p.time + off, v: p.price }; }));
      last = pts.length ? pts[pts.length - 1].t : 0;
      // The window holds about the last 60 trades (three minutes at least, an hour at most) at a fixed time scale.
      var k = Math.max(0, pts.length - 60); SPAN = Math.max(180, Math.min(3600, Math.round(last - pts[k].t)));
      sec.querySelector('[data-kv-note]').textContent = '업비트 체결가 · 최근 ' + Math.round(SPAN / 60) + '분'; if (r.kind && r.kind !== 'trades') sec.querySelector('[data-kv-note]').textContent = '최근 1분 종가 · 이후 실시간';
      shift = 0; draw();
    }).catch(function () {});
    window.addEventListener('gnm-quote', function (e) { var d = e.detail; if (!d || d.symbol !== sym || !(d.quote && d.quote.price > 0)) return; add(Date.now() / 1000, d.quote.price); });
    var rw = 0; window.addEventListener('resize', function () { clearTimeout(rw); rw = setTimeout(function () { shift = 0; draw(); }, 150); });
    window.GNM_kitLive = { add: add, points: pts };
  };

  window.GNM_kit = { scatter: scatter, funnel: funnel };
  // Pictures drawn before this script ran (the page asked early) are drawn now; JS-drawn ones follow a resize.
  var scan = function () {
    document.querySelectorAll(SEL).forEach(watch);
    document.querySelectorAll('.kit-lc').forEach(function (f) { if (!f.__kitLc) { f.__kitLc = 1; lineChart(f); } });
    document.querySelectorAll('.kit-cal').forEach(function (f) { if (!f.__kitCal) { f.__kitCal = 1; calendar(f); } });
  };
  // A scatter drawn while its tab was hidden (no width yet) or before a rotation is drawn again at its new width.
  var ro = 'ResizeObserver' in window ? new ResizeObserver(function (es) { es.forEach(function (e) { var h = e.target, w = Math.round(e.contentRect.width); if (!h.__ks || !w || Math.abs(w - (h.__ksW || 0)) < 4) return; h.__ksW = w; scatter(h, h.__ks[0], h.__ks[1]); }); }) : null;
  var queued = false;
  new MutationObserver(function () { if (queued) return; queued = true; setTimeout(function () { queued = false; scan(); }, 150); }).observe(document.documentElement, { childList: true, subtree: true });
  var boot = function () { scan(); live(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
`;
