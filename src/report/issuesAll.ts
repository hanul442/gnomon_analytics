// G-277 (한서님 10/21: "세계 뉴스랑 한국 뉴스 따로따로 되있는건 좀 열받긴함"): one issue ranking for both.
// Korean stock news issues (rankNewsIssues over every collected stock's news) and world issues (rankWorldIssues)
// are merged into one list. Each board ranks by outlets, but their sizes differ a lot (a Korean story runs in a
// hundred outlets, an English wire story in a handful), so each issue is scored against the top of its own board
// and the two lists interleave by that share. Each row says where it came from with a small 한국 / 세계 tag.

import { esc } from './html.js';
import type { NewsIssue, NewsIssueBoard } from '../analysis/newsIssues.js';
import type { WorldIssue, WorldIssueBoard } from '../analysis/worldNews.js';
import { issueKey, type DigestImage, type NewsDigest } from '../analysis/newsDigest.js';

export interface MergedIssue {
  rank: number;
  /** G-280: the in-app page is issue/<key>.html. */
  key: string;
  /** G-280: the AI summary (three lines from the headlines), empty when not written yet. */
  lines: string[];
  /** A Korean title for an English issue (AI). */
  ko?: string;
  image: DigestImage | null;
  /** The stocks the story names (Korean issues), for the stock page's 소식 part. */
  symbols: string[];
  from: '한국' | '세계';
  title: string;
  url: string;
  publisher: string;
  outlets: number;
  articles: number;
  isNew: boolean;
  /** Places moved up (+) or down (−) since the day before inside its own board; null when new or unknown. */
  moved: number | null;
  lang: 'ko' | 'en';
  /** Stocks the story names (Korean issues) or markets that moved the same day (world issues), already worded. */
  chips: { name: string; move: string; tone: string; href?: string; price?: string }[];
  headlines: { title: string; url: string; publisher: string }[];
}

type Chip = MergedIssue['chips'][number];
const tone = (v: number | null | undefined) => (v == null || v === 0 ? '' : v > 0 ? 'up' : 'down');
const stockHref = (s: string) => (/^KRW-/.test(s) ? `coin.html?m=${encodeURIComponent(s)}` : /^[0-9][0-9A-Z]{5}$/.test(s) ? `stock.html?c=${encodeURIComponent(s)}` : `us.html?s=${encodeURIComponent(s)}`);

export interface MergeExtras { digests?: ReadonlyMap<string, NewsDigest>; closes?: ReadonlyMap<string, number | null> }

export function mergeIssues(kr: NewsIssueBoard | null | undefined, world: WorldIssueBoard | null | undefined, marketChip: (key: string) => Chip | null = () => null, extras: MergeExtras = {}): MergedIssue[] {
  const k = kr?.issues ?? [], w = world?.issues ?? [];
  const dig = (url: string) => { const key = issueKey(url), d = extras.digests?.get(key); return { key, lines: d?.lines ?? [], ...(d?.ko ? { ko: d.ko } : {}), image: d?.image ?? null }; };
  const price = (s: string) => { const c = extras.closes?.get(s); return c == null ? undefined : `${Math.round(c).toLocaleString('ko-KR')}원`; };
  const topK = Math.max(1, ...k.map((i) => i.outlets)), topW = Math.max(1, ...w.map((i) => i.outlets));
  const fromK = (i: NewsIssue) => ({ share: i.outlets / topK, order: i.rank, item: {
    ...dig(i.url), symbols: i.stocks.map((s) => s.symbol),
    from: '한국' as const, title: i.title, url: i.url, publisher: i.publisher, outlets: i.outlets, articles: i.articles, isNew: !i.prev,
    moved: i.prev ? i.prev.rank - i.rank : null, lang: 'ko' as const,
    chips: i.stocks.slice(0, 3).map((s) => ({ name: s.name, move: s.changePct == null ? '' : `${s.changePct > 0 ? '+' : ''}${s.changePct.toFixed(1)}%`, tone: tone(s.changePct), href: stockHref(s.symbol), ...(price(s.symbol) ? { price: price(s.symbol)! } : {}) })),
    headlines: i.headlines.map((h) => ({ title: h.title, url: h.url, publisher: h.publisher })),
  } });
  const fromW = (i: WorldIssue) => ({ share: i.outlets / topW, order: i.rank, item: {
    ...dig(i.url), symbols: [] as string[],
    from: '세계' as const, title: i.title, url: i.url, publisher: i.publisher, outlets: i.outlets, articles: i.articles, isNew: i.isNew,
    moved: i.prevRank ? i.prevRank - i.rank : null, lang: i.lang,
    chips: i.markets.map(marketChip).filter((c): c is Chip => !!c),
    headlines: i.headlines.map((h) => ({ title: h.title, url: h.url, publisher: h.publisher })),
  } });
  // Same share: the higher place in its own board first, then Korean first (it is the app's home market).
  return [...k.map(fromK), ...w.map(fromW)]
    .sort((a, b) => b.share - a.share || a.order - b.order || (a.item.from === '한국' ? -1 : 1))
    .map((x, n) => ({ rank: n + 1, ...x.item }));
}

const chipHtml = (c: Chip) => (c.href ? `<a class="ia-chip" href="${esc(c.href)}">${esc(c.name)}${c.move ? ` <b class="${c.tone}">${esc(c.move)}</b>` : ''}</a>` : `<span class="ia-chip">${esc(c.name)}${c.move ? ` <b class="${c.tone}">${esc(c.move)}</b>` : ''}</span>`);

/** G-280: the publisher's own preview picture, loaded from their server (never stored), with its credit. */
export const issueImage = (img: DigestImage | null, cls: string) => (img
  ? `<figure class="${cls}"><img src="${esc(img.src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"><figcaption>사진 · ${esc(img.credit)}</figcaption></figure>`
  : '');

/** One row; `lead` is the big first card of the full list (picture, summary line). */
function row(i: MergedIssue, full: boolean, base: string, lead = false): string {
  const move = i.isNew ? '<span class="ia-new">NEW</span>' : i.moved ? `<span class="ia-mv ${i.moved > 0 ? 'up' : 'down'}">${i.moved > 0 ? '▲' : '▼'}${Math.abs(i.moved)}</span>` : '';
  const chips = i.chips.map(chipHtml).join('');
  const href = `${base}issue/${i.key}.html`;
  const line = full && i.lines[0] ? `<p class="ia-s">${esc(i.lines[0])}</p>` : '';
  const title = i.ko ?? i.title;
  const meta = `${i.lang === 'en' ? '영문 · ' : ''}매체 ${i.outlets}곳 · ${esc(i.publisher)}`;
  if (lead) return `<li class="ia-row ia-lead" data-tag="${i.from}"><a class="ia-lead-a" href="${esc(href)}">${issueImage(i.image, 'ia-fig')}<div class="ia-h"><b class="ia-rk1">${i.rank}</b><span class="ia-from${i.from === '세계' ? ' w' : ''}">${i.from}</span>${move}<small class="ia-m">${meta}</small></div><span class="ia-t ia-t1">${esc(title)}</span>${line}</a>${chips ? `<div class="ia-chips">${chips}</div>` : ''}</li>`;
  return `<li class="ia-row" data-tag="${i.from}"><b class="ia-rk">${i.rank}</b><div class="ia-b"><div class="ia-h"><span class="ia-from${i.from === '세계' ? ' w' : ''}">${i.from}</span>${move}</div><a class="ia-t" href="${esc(href)}">${esc(title)}</a>${line}<small class="ia-m">${meta}</small>${chips ? `<div class="ia-chips">${chips}</div>` : ''}</div></li>`;
}

/** The list (top `limit`), or a short note when nothing was collected. */
export function issuesList(list: readonly MergedIssue[], limit: number, full: boolean, base = ''): string {
  if (!list.length) return '<p class="muted ia-empty">아직 모은 뉴스가 없어요. 다음 업데이트 뒤 다시 확인해 주세요.</p>';
  return `<ol class="ia-list">${list.slice(0, limit).map((i, n) => row(i, full, base, full && n === 0)).join('')}</ol>`;
}

/** 전체 · 한국 · 세계 filter for the full list (the page script hides rows by data-tag). */
export const ISSUES_FILTER = '<div class="wd-filter ia-filter" role="group" aria-label="어디 뉴스"><button type="button" data-wd-tag="" aria-pressed="true">전체</button><button type="button" data-wd-tag="한국" aria-pressed="false">한국</button><button type="button" data-wd-tag="세계" aria-pressed="false">세계</button></div>';

export const ISSUES_CSS = `<style>
.ia-list{list-style:none;margin:0;padding:0}.ia-row{display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;padding:14px 0;border-top:1px solid var(--line)}.ia-row:first-child{border-top:0;padding-top:4px}.ia-row[hidden]{display:none}
.ia-rk{font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.5}.ia-h{display:flex;gap:6px;align-items:center;margin-bottom:3px}
.ia-from{font-size:11px;font-weight:700;padding:1px 7px;border-radius:6px;background:var(--soft);color:var(--fg2)}.ia-from.w{background:var(--fg);color:var(--surface-solid)}
.ia-new,.ia-mv{font-size:11px;font-weight:800}.ia-new{color:var(--fg)}
.ia-t{display:block;font-size:15.5px;font-weight:600;line-height:1.45;color:inherit;text-decoration:none;word-break:keep-all}.ia-t:hover{text-decoration:underline}
.ia-m{display:block;font-size:12px;color:var(--muted);margin-top:3px}
.ia-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.ia-chip{display:inline-flex;gap:4px;align-items:center;min-height:28px;padding:2px 10px;border-radius:999px;background:var(--soft);font-size:12.5px;font-weight:600;color:var(--fg2);text-decoration:none}
.ia-more summary{cursor:pointer;font-size:12.5px;color:var(--muted);min-height:30px;display:inline-flex;align-items:center;margin-top:4px}.ia-more ul{margin:2px 0;padding-left:16px}.ia-more li{font-size:13px;line-height:1.5;margin:3px 0}.ia-more a{color:inherit}.ia-more small{color:var(--muted)}
.ia-empty{margin:4px 0}
.ia-s{margin:4px 0 0;font-size:14px;line-height:1.55;color:var(--fg2);word-break:keep-all}
.ia-lead{display:block;padding:0 0 16px}.ia-lead-a{display:block;color:inherit;text-decoration:none}.ia-lead .ia-h{margin-top:12px}.ia-lead .ia-m{margin:0 0 0 2px}
.ia-rk1{font-size:15px;font-weight:800;margin-right:2px}.ia-t1{font-size:19px;font-weight:700;letter-spacing:-.3px;margin-top:2px}
.ia-fig{position:relative;margin:0;border-radius:16px;overflow:hidden;background:var(--soft);aspect-ratio:16/9}.ia-fig img{display:block;width:100%;height:100%;object-fit:cover}
.ia-fig figcaption{position:absolute;left:10px;bottom:10px;font-size:11px;font-weight:600;color:#fff;background:rgba(23,24,26,.62);padding:3px 8px;border-radius:6px}
.ia-lead[hidden]{display:none}
</style>`;
