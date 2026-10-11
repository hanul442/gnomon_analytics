// G-200: 회사 정보 card for Korean stocks (Toss's 종목정보 → 회사 정보): logo, name and market, what the company
// does (WiseReport 기업개요; first sentence, the rest behind 자세히 보기), its rank by market value in its Naver
// industry with the industry's top three, and the 주요제품 매출구성 as a donut. Filled in the browser from the API's
// /company (kept a day). No API, or nothing to show, hides the card.

import { esc } from './html.js';

export function companySlot(code: string): string {
  return `<section class="block co-card" data-company="${esc(code)}" hidden><div class="card"><div class="co-body"><p class="muted">불러오는 중이에요…</p></div></div></section>`;
}

export const COMPANY_CSS = `.co-card .card{padding-bottom:18px}.co-head{display:flex;align-items:center;gap:12px}.co-logo{position:relative;flex:none;width:48px;height:48px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:var(--soft);font-weight:800;font-size:19px;color:var(--fg2)}.co-logo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#fff}
.co-id{flex:1;min-width:0}.co-id b{display:block;font-size:18px;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.co-id small{color:var(--muted);font-size:13px}.co-more{flex:none}
.co-sum{margin:14px 0 0;font-size:14.5px;line-height:1.7;color:var(--fg2)}.co-sum li{margin:0 0 6px}.co-sum ul{margin:0;padding-left:18px}.co-sum small{display:block;margin-top:6px;color:var(--muted);font-size:12px}
.co-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:16px 0 0}.co-tile{display:flex;flex-direction:column;gap:4px;min-width:0;padding:14px;border-radius:16px;background:var(--soft);border:1px solid var(--line);color:inherit;text-decoration:none}.co-tile span{font-size:12px;color:var(--muted)}.co-tile b{font-size:16px;line-height:1.35;overflow-wrap:anywhere}.co-tile em{font-style:normal;font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--accent-strong)}.co-tile em small{font-size:13px;font-weight:700;color:var(--muted);margin-left:4px}
.co-top{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:3px;font-size:13px}.co-top li{display:flex;gap:6px;min-width:0}.co-top i{font-style:normal;color:var(--muted);flex:none;width:14px}.co-top a{color:var(--fg);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.co-top li.me a{font-weight:800;color:var(--accent-strong)}
.co-mix{margin:18px 0 0;padding-top:16px;border-top:1px solid var(--line)}.co-mix-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap}.co-mix-h b{font-size:16px}.co-mix-h small{color:var(--muted);font-size:12px}
.co-mix-row{display:grid;grid-template-columns:132px minmax(0,1fr);gap:18px;align-items:center;margin-top:12px}.co-donut{position:relative;width:132px;height:132px}.co-donut svg{width:100%;height:100%;transform:rotate(-90deg)}.co-donut circle{fill:none;stroke-width:16;transition:stroke-dasharray .9s var(--ease-out,cubic-bezier(.2,.8,.2,1))}.co-donut div{position:absolute;inset:0;display:grid;place-content:center;text-align:center}.co-donut div b{font-size:19px;font-variant-numeric:tabular-nums}.co-donut div small{font-size:10.5px;color:var(--muted);max-width:64px;margin:0 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.co-legend{list-style:none;margin:0;padding:0;max-width:440px;display:flex;flex-direction:column;gap:8px;min-width:0}.co-legend li{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:8px;align-items:center;font-size:13.5px}.co-legend i{width:10px;height:10px;border-radius:3px}.co-legend span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.co-legend b{font-variant-numeric:tabular-nums}.co-note{margin:10px 0 0;font-size:12px;color:var(--muted)}
@media (max-width:420px){.co-mix-row{grid-template-columns:108px minmax(0,1fr);gap:14px}.co-donut{width:108px;height:108px}.co-tile{padding:12px}.co-tile em{font-size:21px}}
@media (prefers-reduced-motion:reduce){.co-donut circle{transition:none}}`;

export const COMPANY_JS = `
(function () {
  var boxes = document.querySelectorAll('[data-company]'); if (!boxes.length) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var base = document.body.getAttribute('data-base') || '';
  var COLORS = ['#00A6FB', '#86E3B5', '#FFB86B', '#C79BFF', '#FF7A7A', '#5CBBFF', '#E8D27A', '#9AA7B4'];
  var paint = function (box, c) {
    var parts = [];
    if (!c.summary.length && !c.mix && !(c.industry && c.industry.rank)) { box.hidden = true; return; }
    var logo = c.logo ? '<img src="' + esc(c.logo) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : '';
    parts.push('<div class="co-head"><span class="co-logo" aria-hidden="true">' + esc((c.name || '?').slice(0, 1)) + logo + '</span><div class="co-id"><b>' + esc(c.name) + '</b><small>국내 · ' + esc(c.code) + (c.market ? ' · ' + c.market : '') + '</small></div>' + (c.summary.length > 1 ? '<button type="button" class="chip-toggle co-more" aria-expanded="false">자세히 보기</button>' : '') + '</div>');
    if (c.summary.length) parts.push('<div class="co-sum" data-co-sum><p style="margin:0">' + esc(c.summary[0]) + '</p></div>');
    var tiles = [];
    if (c.industry && c.industry.rank) tiles.push('<div class="co-tile"><span>' + esc(c.industry.name) + '</span><em>' + c.industry.rank + '위<small>' + c.industry.count + '개 중</small></em><span>업종 안 시가총액 순위</span></div>');
    if (c.industry && c.industry.top && c.industry.top.length) tiles.push('<div class="co-tile"><span>같은 업종 시가총액 상위</span><ol class="co-top">' + c.industry.top.map(function (t, i) { return '<li' + (t[0] === c.code ? ' class="me"' : '') + '><i>' + (i + 1) + '</i><a href="' + base + 'stock.html?c=' + encodeURIComponent(t[0]) + '">' + esc(t[1]) + '</a></li>'; }).join('') + '</ol></div>');
    else if (c.sector) tiles.push('<div class="co-tile"><span>업종(WICS)</span><b>' + esc(c.sector) + '</b></div>');
    if (tiles.length) parts.push('<div class="co-tiles">' + tiles.join('') + '</div>');
    if (c.mix && c.mix.items.length) {
      var items = c.mix.items, sum = items.reduce(function (a, x) { return a + x[1]; }, 0), R = 42, L = 2 * Math.PI * R, off = 0;
      var arcs = items.map(function (x, i) { var len = x[1] / Math.max(sum, 100) * L, gap = items.length > 1 ? Math.min(2, len / 3) : 0, s = '<circle r="' + R + '" cx="60" cy="60" stroke="' + COLORS[i % COLORS.length] + '" stroke-dasharray="0 ' + L.toFixed(2) + '" data-len="' + Math.max(0, len - gap).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>'; off += len; return s; }).join('');
      var asOf = c.mix.asOf ? c.mix.asOf.replace('-', '.') + ' 기준 · ' : '';
      parts.push('<div class="co-mix"><div class="co-mix-h"><b>매출 구성</b><small>' + asOf + '출처: FnGuide(WiseReport)</small></div><div class="co-mix-row"><div class="co-donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle r="' + R + '" cx="60" cy="60" stroke="var(--soft)"/>' + arcs + '</svg><div><b>' + items[0][1].toFixed(0) + '%</b><small>' + esc(items[0][0]) + '</small></div></div><ul class="co-legend">' + items.map(function (x, i) { return '<li><i style="background:' + COLORS[i % COLORS.length] + '"></i><span title="' + esc(x[0]) + '">' + esc(x[0]) + '</span><b>' + x[1].toFixed(1) + '%</b></li>'; }).join('') + '</ul></div>' + (sum > 100.5 ? '<p class="co-note">부문 사이 내부 거래가 겹쳐 합이 100%를 넘어요(회사가 공시한 비율 그대로예요).</p>' : '') + '</div>');
    }
    box.querySelector('.co-body').innerHTML = parts.join('');
    box.hidden = false;
    var more = box.querySelector('.co-more');
    if (more) more.addEventListener('click', function () {
      var open = more.getAttribute('aria-expanded') !== 'true', sumEl = box.querySelector('[data-co-sum]');
      more.setAttribute('aria-expanded', String(open)); more.textContent = open ? '접기' : '자세히 보기';
      sumEl.innerHTML = open ? '<ul>' + c.summary.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' + (c.summaryAsOf ? '<small>' + esc(c.summaryAsOf.replace(/-/g, '.')) + ' 기준 · 출처: FnGuide(WiseReport)</small>' : '') : '<p style="margin:0">' + esc(c.summary[0]) + '</p>';
    });
    // The donut fills when it scrolls into view.
    var grow = function () { box.querySelectorAll('.co-donut circle[data-len]').forEach(function (k) { k.setAttribute('stroke-dasharray', k.getAttribute('data-len') + ' ' + (2 * Math.PI * 42).toFixed(2)); }); };
    var d = box.querySelector('.co-donut');
    if (d && 'IntersectionObserver' in window) { var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); requestAnimationFrame(grow); } }); io.observe(d); } else grow();
  };
  var go = function () { boxes.forEach(function (box) {
    var code = (box.getAttribute('data-company') || new URLSearchParams(location.search).get('c') || '').toUpperCase();
    var api = window.GNM && GNM.api; if (!api || !/^[0-9][0-9A-Z]{5}$/.test(code)) return;
    fetch(api + '/company?code=' + code).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.company) paint(box, j.company); else box.hidden = true; }).catch(function () { box.hidden = true; });
  }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
`;
