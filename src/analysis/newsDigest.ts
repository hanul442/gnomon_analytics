// G-284 (한서님 10/21 "뉴스도 … 자체 사이트에서 보여주는거"): an in-app page per news issue, copyright-safe.
// We keep no article text and store no photo. Each issue gets:
// - a three-line summary that AI writes from the issue's headlines only (many outlets' titles of one story),
//   facts only, no outlook or advice; a line with a number the headlines do not carry is dropped;
// - the publisher's own preview picture (og:image) as a link to their server, shown with its credit.
// Digests are kept in data/news-digests.jsonl by issue key, so an issue is summarised once.

import { createHash } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

export const DIGEST_MODEL = 'claude-haiku-5-5';
export const DIGEST_PROMPT = 'gnomon.news-digest.v1';

export interface DigestImage { src: string; credit: string }
export interface NewsDigest {
  key: string;
  url: string;
  /** Three short sentences; empty when no summary could be written yet. */
  lines: string[];
  /** A Korean title for an English issue. */
  ko?: string;
  image: DigestImage | null;
  model: string | null;
  at: string;
}

/** What a digest is made from (a Korean or world issue, before the two are merged). */
export interface DigestSource { url: string; title: string; publisher: string; lang: 'ko' | 'en'; headlines: readonly { title: string; url: string; publisher: string }[] }

/** Stable id of an issue: its lead story's link. */
export const issueKey = (url: string) => createHash('sha1').update(url).digest('hex').slice(0, 10);

/** The og:image (or twitter:image) of a page, an absolute https link, or null. */
export function ogImageOf(html: string, pageUrl: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (!/(?:property|name)\s*=\s*["'](?:og:image|og:image:url|twitter:image)["']/i.test(tag)) continue;
    const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.trim().replace(/&amp;/g, '&');
    if (!content) continue;
    try {
      const u = new URL(content, pageUrl);
      if (u.protocol === 'https:') return u.href;
    } catch { /* not a link */ }
  }
  return null;
}

/** Google News links are redirects with no picture of their own. */
const direct = (url: string) => /^https:\/\//.test(url) && !/^https:\/\/news\.google\.com\//.test(url);

/** The first preview picture among the issue's direct publisher links (at most three tried). */
export async function previewImage(src: DigestSource, fetchFn: typeof fetch = fetch): Promise<DigestImage | null> {
  const seen = new Set<string>();
  const tries = [{ url: src.url, publisher: src.publisher }, ...src.headlines].filter((h) => direct(h.url) && !seen.has(h.url) && seen.add(h.url)).slice(0, 3);
  for (const h of tries) {
    try {
      const res = await fetchFn(h.url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; GNOMON)', accept: 'text/html' }, signal: AbortSignal.timeout(6000), redirect: 'follow' });
      if (!res.ok) continue;
      const html = (await res.text()).slice(0, 300_000);
      const img = ogImageOf(html, h.url);
      if (img) return { src: img, credit: h.publisher };
    } catch { /* next */ }
  }
  return null;
}

const DigestSchema = z.object({ lines: z.array(z.string()).min(1).max(4), ko: z.string().optional() });

export const DIGEST_SYSTEM = `당신은 뉴스 요약 편집자예요. 같은 사건을 다룬 여러 언론사의 기사 제목만 받아요.
규칙:
- 제목들에 나온 사실만 써요. 제목에 없는 숫자·이름·원인·전망은 만들지 않아요.
- 정확히 3문장, 해요체 완결 문장, 한 문장은 70자 이내예요.
- 1문장: 무슨 일이 있었는지. 2문장: 구체적인 내용(숫자는 제목에 있는 그대로). 3문장: 여러 매체가 함께 다룬 다른 측면.
- 주가 전망, 매수·매도 의견, 좋다·나쁘다 평가, 투자 권유는 쓰지 않아요.
- 제목이 영어면 한국어로 옮겨 요약하고, ko에 한국어 제목(40자 이내)을 넣어요.
JSON 하나로만 답해요: {"lines":["…","…","…"],"ko":"…(영어일 때만)"}`;

const ADVICE = /매수|매도|추천|목표가|사세요|파세요|팔아|살 만|담아|비중|수익\s*보장|오를\s*것|내릴\s*것|급등\s*예상|호재|악재/;
const nums = (s: string) => (s.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/,/g, ''));

/**
 * The lines that pass: full sentences of a sane length, no advice words, and every number in them
 * also in the headlines (so a made-up figure never reaches the page).
 */
export function checkLines(lines: readonly string[], headlines: readonly string[]): string[] {
  const known = new Set(headlines.flatMap(nums));
  return lines.map((l) => l.trim().replace(/^\d[.)]\s*|^[-•·]\s*/, ''))
    .filter((l) => l.length >= 8 && l.length <= 110 && !ADVICE.test(l) && nums(l).every((n) => known.has(n)))
    .slice(0, 3);
}

const jsonIn = (text: string): unknown => { const a = text.indexOf('{'), b = text.lastIndexOf('}'); if (a < 0 || b <= a) throw new Error('NO_JSON'); return JSON.parse(text.slice(a, b + 1)); };

export interface DigestUsage { model: string; inputTokens: number; outputTokens: number }

/** One issue's summary, or null (no client, an API error, or fewer than two lines that pass the checks). */
export async function summarize(src: DigestSource, client: Anthropic): Promise<{ lines: string[]; ko?: string; usage: DigestUsage } | null> {
  if (typeof client.messages?.create !== 'function') return null;
  const titles = [src.title, ...src.headlines.map((h) => h.title)].filter((t, i, a) => a.indexOf(t) === i).slice(0, 12);
  try {
    const res = await client.messages.create({
      model: DIGEST_MODEL, max_tokens: 600,
      system: [{ type: 'text', text: DIGEST_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: JSON.stringify({ 언어: src.lang === 'en' ? '영어' : '한국어', 제목들: titles }) }],
    });
    const usage = { model: res.model || DIGEST_MODEL, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    const parsed = DigestSchema.safeParse(jsonIn(text));
    if (!parsed.success) return null;
    const lines = checkLines(parsed.data.lines, titles);
    if (lines.length < 2) return null;
    const ko = src.lang === 'en' && parsed.data.ko?.trim() ? parsed.data.ko.trim().slice(0, 60) : undefined;
    return { lines, ...(ko ? { ko } : {}), usage };
  } catch { return null; }
}

export async function readDigests(path: string): Promise<Map<string, NewsDigest>> {
  const out = new Map<string, NewsDigest>();
  const text = await readFile(path, 'utf8').catch(() => '');
  for (const line of text.split('\n')) {
    if (!line) continue;
    try { const d = JSON.parse(line) as NewsDigest; out.set(d.key, d); } catch { /* skip a broken line */ }
  }
  return out;
}

export interface DigestOptions {
  client?: Anthropic | null;
  fetch?: typeof fetch;
  now: Date;
  /** New AI summaries per run (the rest wait for the next run). */
  limit?: number;
  /** Asked before each AI call; false stops summarising (the monthly budget). */
  allow?: () => boolean;
  onUsage?: (u: DigestUsage) => Promise<void> | void;
}

/**
 * Digests for the given issues: kept ones as they are, new ones made (picture and, with a client, summary)
 * and appended to `path`. An issue kept without a summary gets one when a client is there.
 */
export async function digestIssues(path: string, sources: readonly DigestSource[], o: DigestOptions): Promise<Map<string, NewsDigest>> {
  const kept = await readDigests(path);
  const out = new Map<string, NewsDigest>();
  const fresh: NewsDigest[] = [];
  let budget = o.limit ?? 30;
  const work = sources.map((src) => async () => {
    const key = issueKey(src.url);
    const old = kept.get(key);
    if (old && (old.lines.length || !o.client)) { out.set(key, old); return; }
    const image = old?.image ?? await previewImage(src, o.fetch);
    let made: Awaited<ReturnType<typeof summarize>> = null;
    if (o.client && budget > 0 && (o.allow?.() ?? true)) {
      budget -= 1;
      made = await summarize(src, o.client);
      if (made) await o.onUsage?.(made.usage);
    }
    if (old && !made) { out.set(key, old); return; }
    const d: NewsDigest = { key, url: src.url, lines: made?.lines ?? [], ...(made?.ko ? { ko: made.ko } : {}), image, model: made?.usage.model ?? null, at: o.now.toISOString() };
    out.set(key, d); fresh.push(d);
  });
  // Five at a time: page fetches and AI calls both wait on the network.
  for (let i = 0; i < work.length; i += 5) await Promise.all(work.slice(i, i + 5).map((f) => f()));
  if (fresh.length) {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, fresh.map((d) => JSON.stringify(d)).join('\n') + '\n');
  }
  return out;
}
