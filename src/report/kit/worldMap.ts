// G-268: the world map with every country GNOMON has an index for (Bklit choropleth look, like kmWorldMap, which only
// knows Korea and the United States). Each country is filled by its main index's move; the big ones carry a small
// label, and every country (Hong Kong as a dot) answers a tap with its index and move through the kit's bubble.
import { esc } from '../html.js';
import { heatStyle } from './market.js';
import { WORLD_COUNTRIES_110, WORLD_LAND_110 } from './worldGeo.js';

export interface WorldMapEntry { iso: string; country: string; index: string; change: number | null; note?: string }

const signed = (v: number, d = 2) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;
const toneOf = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');
const tip = (name: string, v: string, t: string, s = '') => ` data-km-tip="${esc(name)}" data-km-v="${esc(v)}" data-km-t="${t}"${s ? ` data-km-s="${esc(s)}"` : ''}`;

/** Where a label sits, in map units (x 0…720, y 10…260); `r` anchors its right edge there. */
const PIN: Record<string, { x: number; y: number; r?: boolean }> = {
  US: { x: 168, y: 94 }, BR: { x: 262, y: 186 }, EU: { x: 372, y: 52 }, IN: { x: 502, y: 140 }, CN: { x: 522, y: 76 }, KR: { x: 666, y: 124, r: true }, JP: { x: 666, y: 66, r: true },
};
/** The part of the world drawn: Alaska's tip to Japan's east, the Arctic islands to the south of Australia. */
const X0 = 96, W = 572, Y0 = 26, H = 224;

/**
 * `entries` holds one row per country (the first index of each). Europe's label is the average of the European rows
 * it is given under iso 'EU' (the caller decides which index stands for Europe).
 */
/** G-295: an issue pin, numbered by the region's best issue rank; a tap opens that region's sheet (issueMap.ts). */
export interface WorldMapPin { id: string; n: number; x: number; y: number; label: string }

export function kmWorldMapAll(entries: readonly WorldMapEntry[], caption: string, opts: { plain?: boolean; pins?: readonly WorldMapPin[] } = {}): string {
  const by = new Map(entries.map((e) => [e.iso, e] as const));
  const shapes = Object.entries(WORLD_COUNTRIES_110).map(([iso, d]) => {
    const e = by.get(iso);
    if (!e) return '';
    const v = e.change == null ? '자료 없음' : `${signed(e.change)}%`;
    return `<path d="${d}" class="km-ct" style="${heatStyle(e.change, 2.5, 0.3)}"${tip(`${e.country} · ${e.index}`, v, toneOf(e.change), e.note ?? '')} tabindex="0"/>`;
  }).join('');
  const hk = by.get('HK');
  const dot = hk ? `<circle cx="588" cy="124" r="5" class="km-ct km-dot" style="${heatStyle(hk.change, 2.5, 0.5)}"${tip(`${hk.country} · ${hk.index}`, hk.change == null ? '자료 없음' : `${signed(hk.change)}%`, toneOf(hk.change), hk.note ?? '')} tabindex="0"/>` : '';
  const pins = opts.plain ? '' : Object.entries(PIN).map(([iso, p]) => {
    const e = by.get(iso);
    if (!e || e.change == null) return '';
    const label = iso === 'EU' ? '유럽' : e.country;
    return `<span class="wm-pin${p.r ? ' r' : ''}" style="left:${(((p.x - X0) / W) * 100).toFixed(1)}%;top:${(((p.y - Y0) / H) * 100).toFixed(1)}%" aria-hidden="true"><span>${esc(label)}</span><b class="${toneOf(e.change)}">${signed(e.change, 1)}%</b></span>`;
  }).join('');
  const at = (x: number, y: number) => `left:${(((x - X0) / W) * 100).toFixed(1)}%;top:${(((y - Y0) / H) * 100).toFixed(1)}%`;
  const ipins = (opts.pins ?? []).map((p, k) => `<button type="button" class="wm-ip" data-im="${esc(p.id)}" style="${at(p.x, p.y)};--i:${k}" aria-label="${esc(`${p.label} 이슈 ${p.n}위, 눌러서 보기`)}">${p.n}</button>`).join('');
  const aria = '세계 증시 지도: ' + entries.map((e) => `${e.country} ${e.index} ${e.change == null ? '자료 없음' : signed(e.change) + '%'}`).join(', ');
  return `<figure class="km-map wm-map km-chart km-anim"><div class="wm-box"><svg viewBox="${X0} ${Y0} ${W} ${H}" role="img" aria-label="${esc(aria)}"><path d="${WORLD_LAND_110}" class="km-land"/>${shapes}${dot}</svg>${pins}${ipins}</div>${caption ? `<figcaption class="fine">${esc(caption)}</figcaption>` : ''}</figure>`;
}

export const KIT_WORLD_CSS = `.wm-box{position:relative}.wm-map .km-ct{stroke-width:.8;outline:none}.wm-map .km-ct:focus-visible{stroke:var(--fg);stroke-width:1.6}.km-dot{stroke:var(--surface-solid);stroke-width:1.5}
.wm-pin{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;padding:2px 6px;border-radius:9px;background:color-mix(in srgb,var(--surface-solid) 86%,transparent);box-shadow:0 1px 4px rgba(0,0,0,.12);line-height:1.15;pointer-events:none;white-space:nowrap}
.wm-pin.r{transform:translate(-100%,-50%)}.wm-pin span{font-size:12px;font-weight:700;color:var(--fg2)}.wm-pin b{font-size:14px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--fg)}.wm-pin b.up{color:#f04452}.wm-pin b.down{color:#3182f6}
html.mo .wm-map:not(.km-in) .wm-pin{opacity:0}html.mo .wm-map.km-in .wm-pin{transition:opacity .5s .5s}
.wm-ip{position:absolute;transform:translate(-50%,-50%);display:grid;place-items:center;width:22px;height:22px;padding:0;border:0;border-radius:11px;background:var(--fg);color:var(--surface-solid);font:inherit;font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums;box-shadow:0 0 0 2.5px var(--surface-solid),0 2px 6px rgba(0,0,0,.25);cursor:pointer;z-index:2}
.wm-ip::before{content:"";position:absolute;inset:-10px}.wm-ip:focus-visible{outline:2px solid var(--fg);outline-offset:3px}
html.mo .wm-map:not(.km-in) .wm-ip{transform:translate(-50%,-50%) scale(0)}html.mo .wm-map.km-in .wm-ip{transition:transform .5s calc(.35s + var(--i,0) * .07s) cubic-bezier(.34,1.56,.64,1)}
@media(min-width:620px){.wm-ip{width:26px;height:26px;border-radius:13px;font-size:14px}}
@media (prefers-reduced-motion: reduce){html.mo .wm-map .wm-ip{transform:translate(-50%,-50%);transition:none}}
@media(min-width:620px){.wm-pin span{font-size:14px}.wm-pin b{font-size:15.5px}}`;
