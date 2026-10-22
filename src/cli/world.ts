// G-268: collects the world screen's numbers and news each run (best effort) and builds world.html from what was saved.
//   data/world/markets.json   the last WorldMarkets snapshot (replaced each run; a failed run keeps the one before)
//   data/world-news.jsonl     world headlines, appended (two days are needed to show rank changes)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appendUnseen, readLog } from '../store/jsonlLog.js';
import { fetchRss } from '../sources/news.js';
import { fetchWorldMarkets, type WorldMarkets } from '../sources/naverGlobal.js';
import { rankWorldIssues, WORLD_FEEDS } from '../analysis/worldNews.js';
import { movedToHome } from '../report/renderWorld.js';
import type { NewsItem } from '../types.js';

const marketsFile = (root: string) => join(root, 'data', 'world', 'markets.json');
const newsFile = (root: string) => join(root, 'data', 'world-news.jsonl');
/** Headlines older than this are dropped from the log when it is rewritten (the page needs 48 hours). */
const KEEP_MS = 4 * 86_400_000;

export async function collectWorld(root: string, options: { fetch?: typeof fetch; now?: () => Date } = {}): Promise<{ source: string; ok: boolean; count: number; error?: string }[]> {
  const status: { source: string; ok: boolean; count: number; error?: string }[] = [];
  const markets = await fetchWorldMarkets(options);
  for (const s of markets.status.filter((x) => !x.ok)) status.push({ source: s.source, ok: false, count: 0, ...(s.error ? { error: s.error } : {}) });
  if (markets.indices.length || markets.macro.length) {
    await mkdir(join(root, 'data', 'world'), { recursive: true });
    await writeFile(marketsFile(root), JSON.stringify(markets) + '\n');
  }
  status.push({ source: 'naver:global', ok: markets.indices.length > 0, count: markets.indices.length + markets.macro.length });
  const fresh: NewsItem[] = [];
  for (const feed of WORLD_FEEDS) {
    try {
      const items = await fetchRss(feed.url, feed.source, { ...options, ...(feed.publisher ? { publisher: feed.publisher } : {}) });
      fresh.push(...items);
      status.push({ source: feed.source, ok: true, count: items.length });
    } catch (e) { status.push({ source: feed.source, ok: false, count: 0, error: e instanceof Error ? e.message.slice(0, 80) : 'UNKNOWN' }); }
  }
  if (fresh.length) {
    const now = (options.now ?? (() => new Date()))().getTime();
    const old = await readLog<NewsItem>(newsFile(root)).catch(() => [] as NewsItem[]);
    const keep = old.filter((n) => now - Date.parse(n.publishedAt) < KEEP_MS);
    await mkdir(join(root, 'data'), { recursive: true });
    if (keep.length !== old.length) await writeFile(newsFile(root), keep.map((n) => JSON.stringify(n)).join('\n') + (keep.length ? '\n' : ''));
    await appendUnseen(newsFile(root), fresh.filter((n) => now - Date.parse(n.publishedAt) < KEEP_MS), (n) => n.url);
  }
  return status;
}

/** world.html and world.json from the saved snapshot and headlines; an empty page when nothing was ever collected. */
export async function writeWorldPage(root: string, siteDir: string, now: Date): Promise<void> {
  const markets = JSON.parse(await readFile(marketsFile(root), 'utf8').catch(() => 'null')) as WorldMarkets | null;
  const news = rankWorldIssues(await readLog<NewsItem>(newsFile(root)).catch(() => [] as NewsItem[]), now);
  const page = markets ? { markets, news } : null;
  // G-277: the world screen lives in home now; world.html sends old links there.
  await writeFile(join(siteDir, 'world.html'), movedToHome('sum'));
  await writeFile(join(siteDir, 'world.json'), JSON.stringify(page ? { generatedAt: markets!.generatedAt, indices: markets!.indices.map(({ series: _s, ...q }) => q), macro: markets!.macro.map(({ series: _s, ...q }) => q), news: news.issues.slice(0, 5) } : null));
}
