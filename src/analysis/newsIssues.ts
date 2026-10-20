// News issue ranking (G-243): the stories most outlets covered in the last 24 hours, across every
// collected stock's news, with the stocks each story is about and the change from the 24 hours before.
// Counts only; no reading of direction or advice. Pure functions.

import type { NewsItem } from '../types.js';
import { clusterNews, type NewsCluster } from './news.js';

/** One collected article and the stocks whose news file holds it. */
export interface TaggedArticle { item: NewsItem; symbols: readonly string[] }

export interface IssueStock { symbol: string; name: string; changePct: number | null; articles: number }
export interface IssueHeadline { title: string; url: string; publisher: string; publishedAt: string }

export interface NewsIssue {
  rank: number;
  title: string;
  url: string;
  publisher: string;
  /** Distinct outlets that ran the story; the ranking key. */
  outlets: number;
  articles: number;
  firstAt: string;
  lastAt: string;
  /** The same issue in the previous 24 hours' top list; null when it was not there. */
  prev: { rank: number; outlets: number } | null;
  stocks: IssueStock[];
  /** One headline per story inside the issue, most covered first. */
  headlines: IssueHeadline[];
}

export interface NewsIssueBoard {
  /** Window end (the newest article at or before the build) and start, ISO UTC. */
  to: string | null;
  from: string | null;
  articles: number;
  issues: NewsIssue[];
}

const HOUR = 3600_000;
// Words that say nothing about which story it is.
const STOP = new Set(['단독', '속보', '종합', '포토', '사진', '영상', '뉴스', '기자', '오늘', '올해', '내년', '이번', '관련', '위해', '대한', '통해', '대해', '그리고', '하지만', '추진', '확대', '강화', '본격', '기대', '전망', '나선다', '나서', '밝혀', '밝혔다', '했다', '한다', '이다', '있다', '없다', '것', '등']);
const JOSA = /(으로|에서|에게|까지|부터|보다|처럼|이라|라고|이며|하고|은|는|이|가|을|를|의|에|와|과|도|만|로)$/;

/** The words of a headline that name the story: brackets, stock names and particles left out. */
export function keyWords(title: string, names: readonly string[] = []): Set<string> {
  let text = title.replace(/\[[^\]]*\]|\([^)]*\)|<[^>]*>/g, ' ');
  for (const name of names) if (name) text = text.split(name).join(' ');
  const out = new Set<string>();
  for (const raw of text.split(/[^\p{L}\p{N}]+/u)) {
    const word = raw.length > 2 ? raw.replace(JOSA, '') : raw;
    if (word.length >= 2 && !STOP.has(word)) out.add(word.toLowerCase());
  }
  return out;
}

/** A Google News title ends in " - outlet"; some carry a trailing "> 뉴스" section crumb. */
export const cleanTitle = (title: string) => title.replace(/\s+(?:-|\|)\s+[^-|]{1,20}$/, '').replace(/\s*>\s*[^>]{1,10}$/, '').trim();

const shared = (a: Set<string>, b: Set<string>) => { let n = 0; for (const x of a) if (b.has(x)) n += 1; return n; };

interface Story { cluster: NewsCluster; symbols: Map<string, number>; outlets: Set<string> }
interface Issue { stories: Story[]; words: Set<string>; symbols: Set<string> }

function stories(articles: readonly TaggedArticle[]): Story[] {
  const tags = new Map(articles.map((a) => [a.item.url, a.symbols] as const));
  return clusterNews(articles.map((a) => a.item)).map((cluster) => {
    const symbols = new Map<string, number>();
    for (const a of cluster.articles) for (const s of tags.get(a.url) ?? []) symbols.set(s, (symbols.get(s) ?? 0) + 1);
    return { cluster, symbols, outlets: new Set(cluster.articles.map((a) => a.publisher)) };
  });
}

/**
 * Same-story clusters (clusterNews) are joined into one issue when they share a stock and at least
 * two key words with the issue's first (most covered) story, e.g. two wordings of one contract.
 * Joining only against the first story keeps a chain of loosely similar stories from merging.
 */
function issues(list: Story[], names: ReadonlyMap<string, string>): Issue[] {
  const sorted = [...list].sort((a, b) => b.outlets.size - a.outlets.size || b.cluster.articles.length - a.cluster.articles.length || (a.cluster.lastAt < b.cluster.lastAt ? 1 : -1));
  const out: Issue[] = [];
  for (const story of sorted) {
    const words = keyWords(story.cluster.title, [...story.symbols.keys()].map((s) => names.get(s) ?? ''));
    const home = out.find((i) => [...story.symbols.keys()].some((s) => i.symbols.has(s)) && shared(i.words, words) >= 2);
    if (home) { home.stories.push(story); continue; }
    out.push({ stories: [story], words, symbols: new Set(story.symbols.keys()) });
  }
  return out;
}

const outletCount = (i: Issue) => new Set(i.stories.flatMap((s) => [...s.outlets])).size;
const articleCount = (i: Issue) => i.stories.reduce((n, s) => n + s.cluster.articles.length, 0);

function ranked(list: Issue[]): Issue[] {
  return [...list].sort((a, b) => outletCount(b) - outletCount(a) || articleCount(b) - articleCount(a) || (a.stories[0]!.cluster.lastAt < b.stories[0]!.cluster.lastAt ? 1 : -1));
}

/**
 * Ranks the issues of the 24 hours ending at the newest article published at or before `now`
 * (so a weekend build still shows the last weekday's news, with its window stated), and finds
 * each one in the 24 hours before by the same joining rule.
 */
export function rankNewsIssues(
  articles: readonly TaggedArticle[],
  options: { now: Date; names: ReadonlyMap<string, string>; changes?: ReadonlyMap<string, number | null>; limit?: number; windowHours?: number },
): NewsIssueBoard {
  const nowMs = options.now.getTime();
  const span = (options.windowHours ?? 24) * HOUR;
  const seen = new Map<string, TaggedArticle>();
  for (const a of articles) {
    const at = Date.parse(a.item.publishedAt);
    if (!Number.isFinite(at) || at > nowMs) continue;
    const prior = seen.get(a.item.url);
    seen.set(a.item.url, prior ? { item: prior.item, symbols: [...new Set([...prior.symbols, ...a.symbols])] } : a);
  }
  const all = [...seen.values()];
  const endMs = all.reduce((m, a) => Math.max(m, Date.parse(a.item.publishedAt)), -Infinity);
  if (!Number.isFinite(endMs)) return { to: null, from: null, articles: 0, issues: [] };
  const within = (lo: number, hi: number) => all.filter((a) => { const t = Date.parse(a.item.publishedAt); return t > lo && t <= hi; });
  const today = within(endMs - span, endMs);
  const before = within(endMs - 2 * span, endMs - span);
  const now = ranked(issues(stories(today), options.names));
  const prev = ranked(issues(stories(before), options.names));
  const limit = options.limit ?? 20;
  return {
    to: new Date(endMs).toISOString(),
    from: new Date(endMs - span).toISOString(),
    articles: today.length,
    issues: now.slice(0, limit).map((issue, i) => {
      const lead = issue.stories[0]!.cluster;
      const counts = new Map<string, number>();
      for (const s of issue.stories) for (const [sym, n] of s.symbols) counts.set(sym, (counts.get(sym) ?? 0) + n);
      // Only the previous window's own top `limit` counts as a previous rank; below it the issue reads as new.
      const p = prev.slice(0, limit).findIndex((x) => [...x.symbols].some((s) => issue.symbols.has(s)) && shared(x.words, issue.words) >= 2);
      const times = issue.stories.flatMap((s) => [s.cluster.firstAt, s.cluster.lastAt]).sort();
      return {
        rank: i + 1, title: cleanTitle(lead.title), url: lead.url, publisher: lead.publisher,
        outlets: outletCount(issue), articles: articleCount(issue), firstAt: times[0]!, lastAt: times.at(-1)!,
        prev: p >= 0 ? { rank: p + 1, outlets: outletCount(prev[p]!) } : null,
        stocks: [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 6)
          .map(([symbol, n]) => ({ symbol, name: options.names.get(symbol) ?? symbol, changePct: options.changes?.get(symbol) ?? null, articles: n })),
        headlines: issue.stories.slice(0, 5).map((s) => ({ title: cleanTitle(s.cluster.title), url: s.cluster.url, publisher: s.cluster.publisher, publishedAt: s.cluster.lastAt })),
      };
    }),
  };
}
