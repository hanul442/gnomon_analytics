// G-284 (한서님 10/21): one news issue inside the app — its headline, the publisher's preview picture with credit,
// the AI three-line summary written from the headlines, the stocks it names (price, today's move, tap = the stock's
// committee) and the other outlets' headlines. The article itself stays on the publisher's site: the bottom bar's
// big button opens it. No article text is copied and no picture is stored.

import { esc } from './html.js';
import { shell } from './renderHtml.js';
import { issueImage, type MergedIssue } from './issuesAll.js';

const BACK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>';
const OUT = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>';
const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>';
const NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>';

const CSS = `<style>
.is-wrap{max-width:640px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
.is-sec{background:var(--surface-solid,var(--surface));border-radius:22px;padding:20px}
.is-k{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12.5px;font-weight:600;color:var(--muted)}
.is-from{font-size:11px;font-weight:700;padding:1px 7px;border-radius:6px;background:var(--soft);color:var(--fg2)}.is-from.w{background:var(--fg);color:var(--surface-solid)}
.is-h{margin:10px 0 6px;font-size:24px;line-height:1.38;font-weight:800;letter-spacing:-.5px;word-break:keep-all}
.is-orig{margin:0 0 6px;font-size:13.5px;color:var(--muted);line-height:1.45}
.is-pub{font-size:13px;color:var(--muted)}
.is-fig{position:relative;margin:14px 0 0;border-radius:16px;overflow:hidden;background:var(--soft);aspect-ratio:16/9}.is-fig img{display:block;width:100%;height:100%;object-fit:cover}
.is-fig figcaption{position:absolute;left:10px;bottom:10px;font-size:11px;font-weight:600;color:#fff;background:rgba(23,24,26,.62);padding:3px 8px;border-radius:6px}
.is-t{display:flex;align-items:center;gap:6px;margin:0 0 12px;font-size:15px;font-weight:700}.is-t svg{width:16px;height:16px}
.is-sum{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.is-sum li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;font-size:15.5px;line-height:1.6;word-break:keep-all}.is-sum b{font-size:14px;color:var(--muted)}
.is-fine{margin:14px 0 0;font-size:12px;line-height:1.5;color:var(--muted)}
.is-stk{display:flex;align-items:center;gap:12px;min-height:64px;color:inherit;text-decoration:none;border-top:1px solid var(--line)}.is-stk:first-of-type{border-top:0}
.is-av{flex:none;width:40px;height:40px;border-radius:20px;background:var(--soft);display:grid;place-items:center;font-size:14px;font-weight:800}
.is-nm{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.is-nm b{font-size:15.5px}.is-nm small{font-size:12.5px;color:var(--muted)}
.is-px{text-align:right;display:flex;flex-direction:column;gap:2px;font-variant-numeric:tabular-nums}.is-px b{font-size:15.5px}.is-px span{font-size:13px;font-weight:700}
.is-stk>svg{flex:none;width:16px;height:16px;color:var(--muted)}
.is-hl{display:flex;flex-direction:column;gap:3px;padding:11px 0;border-top:1px solid var(--line);color:inherit;text-decoration:none}.is-hl:first-of-type{border-top:0}
.is-hl span{font-size:14.5px;line-height:1.45;word-break:keep-all}.is-hl small{font-size:12px;color:var(--muted)}
.bottom-nav .nav-ctx a.nav-read{display:flex;flex:1;min-width:0;height:46px;margin:0 2px;padding:0 14px;border-radius:23px;flex-direction:row;align-items:center;justify-content:center;gap:6px;background:var(--fg);color:var(--page,#fff);font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bottom-nav .nav-ctx a.nav-read svg{flex:none;width:16px;height:16px}
.bottom-nav .nav-ctx a.nav-bk{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;flex:none;width:46px;height:56px;border-radius:23px;color:var(--fg);font-size:10.5px;font-weight:600;text-decoration:none}.bottom-nav .nav-ctx a.nav-bk svg{width:20px;height:20px}
</style>`;

const timeKst = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

export function renderIssuePage(i: MergedIssue, opts: { firstAt?: string | null } = {}): string {
  const base = '../';
  const title = i.ko ?? i.title;
  const when = timeKst(opts.firstAt);
  const head = `<section class="is-sec"><div class="is-k"><span class="is-from${i.from === '세계' ? ' w' : ''}">${i.from}</span>이슈 ${i.rank}위 · 매체 ${i.outlets}곳 · 기사 ${i.articles}건</div>
<h1 class="is-h">${esc(title)}</h1>${i.ko ? `<p class="is-orig" lang="en">${esc(i.title)}</p>` : ''}<div class="is-pub">${esc(i.publisher)}${when ? ` · ${esc(when)} 처음 보도` : ''}</div>${issueImage(i.image, 'is-fig')}</section>`;
  const summary = i.lines.length
    ? `<section class="is-sec"><h2 class="is-t">${SPARK}AI ${i.lines.length}줄 요약</h2><ol class="is-sum">${i.lines.map((l, n) => `<li><b>${n + 1}</b><span>${esc(l)}</span></li>`).join('')}</ol><p class="is-fine">같은 이슈를 다룬 여러 매체의 기사 제목을 AI가 모아 쓴 요약이에요. 제목에 있는 사실만 옮기고, 투자 권유가 아니에요. 자세한 내용은 기사 원문에서 확인해 주세요.</p></section>`
    : '';
  const stocks = i.chips.length
    ? `<section class="is-sec"><h2 class="is-t">${i.from === '한국' ? '관련 종목' : '같은 날 함께 움직인 시장'}</h2>${i.chips.map((c) => {
      const body = `<span class="is-av" aria-hidden="true">${esc(c.name.slice(0, 1))}</span><span class="is-nm"><b>${esc(c.name)}</b>${c.href ? '<small>위원회 보기</small>' : ''}</span><span class="is-px">${c.price ? `<b>${esc(c.price)}</b>` : ''}${c.move ? `<span class="${c.tone}">${esc(c.move)}</span>` : ''}</span>`;
      return c.href ? `<a class="is-stk" href="${esc(base + c.href)}">${body}${NEXT}</a>` : `<div class="is-stk">${body}</div>`;
    }).join('')}${i.from === '세계' ? '<p class="is-fine">같은 날 함께 움직인 값이고, 뉴스가 원인이라는 뜻이 아니에요.</p>' : ''}</section>`
    : '';
  const others = i.headlines.filter((h) => h.url !== i.url).slice(0, 8);
  const more = others.length
    ? `<section class="is-sec"><h2 class="is-t">같은 이슈, 다른 기사</h2>${others.map((h) => `<a class="is-hl" href="${esc(h.url)}" target="_blank" rel="noopener"><span>${esc(h.title)}</span><small>${esc(h.publisher)} · 원문 열기 ↗</small></a>`).join('')}</section>`
    : '';
  const body = `${CSS}<div class="is-wrap">${head}${summary}${stocks}${more}</div>`;
  const parts = `<a class="nav-bk" href="${base}index.html#news" aria-label="이슈 목록으로">${BACK}<span>목록</span></a><a class="nav-read" href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.publisher)}에서 기사 보기${OUT}</a>`;
  return shell(base, `${title} | GNOMON`, body, { active: 'home', parts, ads: false });
}
