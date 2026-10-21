import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Anthropic from '@anthropic-ai/sdk';
import { checkLines, digestIssues, issueKey, ogImageOf, previewImage, type DigestSource } from './newsDigest.js';
import { mergeIssues, issuesList } from '../report/issuesAll.js';
import { renderIssuePage } from '../report/renderIssue.js';
import type { NewsIssueBoard } from './newsIssues.js';

const src: DigestSource = {
  url: 'https://news.google.com/rss/articles/abc', title: '두산에너빌리티, LIG D&A와 유도무기 개발 MOU 체결', publisher: '한국경제', lang: 'ko',
  headlines: [
    { title: 'LS에코에너지, 3분기 영업이익 221억원…전년比 50.2%↑', url: 'https://www.example.co.kr/a/1', publisher: '파이낸셜뉴스' },
    { title: '軍항공기 엔진 개발 경쟁 두산에너빌리티도 가세', url: 'https://news.google.com/rss/articles/def', publisher: '서울경제' },
  ],
};

test('ogImageOf reads og:image in any attribute order, https only', () => {
  assert.equal(ogImageOf('<meta property="og:image:width" content="500"><meta property="og:image" data-x="1" content="https://img.example/a.jpg">', 'https://x.kr/a'), 'https://img.example/a.jpg');
  assert.equal(ogImageOf('<meta content="/p.jpg" name="twitter:image">', 'https://x.kr/a'), 'https://x.kr/p.jpg');
  assert.equal(ogImageOf('<meta property="og:image" content="http://img.example/a.jpg">', 'http://x.kr/a'), null);
  assert.equal(ogImageOf('<title>none</title>', 'https://x.kr/a'), null);
});

test('previewImage skips Google News redirects and credits the publisher it came from', async () => {
  const seen: string[] = [];
  const fake = (async (url: string) => { seen.push(url); return new Response('<meta property="og:image" content="https://img.example/p.jpg">'); }) as unknown as typeof fetch;
  assert.deepEqual(await previewImage(src, fake), { src: 'https://img.example/p.jpg', credit: '파이낸셜뉴스' });
  assert.deepEqual(seen, ['https://www.example.co.kr/a/1']);
});

test('checkLines drops advice and numbers the headlines do not carry', () => {
  const heads = ['3분기 영업이익 221억원…전년比 50.2%↑'];
  assert.deepEqual(checkLines(['1. 3분기 영업이익이 221억원이었어요.', '영업이익이 50.2% 늘었어요.', '목표가를 30만원으로 올렸어요.', '매출은 1조원을 넘었어요.', '지금 매수할 만해요.'], heads),
    ['3분기 영업이익이 221억원이었어요.', '영업이익이 50.2% 늘었어요.']);
});

const fakeClient = (reply: string, calls: { n: number }) => ({ messages: { create: async () => { calls.n += 1; return { model: 'claude-haiku-5-5', stop_reason: 'end_turn', usage: { input_tokens: 500, output_tokens: 120 }, content: [{ type: 'text', text: reply }] }; } } }) as unknown as Anthropic;

test('digestIssues summarises once, keeps it in the log, and reuses it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gnm-dg-'));
  const path = join(dir, 'news-digests.jsonl');
  const calls = { n: 0 };
  const client = fakeClient('{"lines":["두산에너빌리티가 유도무기 엔진 개발 협약을 맺었어요.","3분기 영업이익은 221억원이에요.","여러 매체가 군 항공기 엔진 경쟁도 다뤘어요."]}', calls);
  const noFetch = (async () => new Response('', { status: 404 })) as unknown as typeof fetch;
  const used: number[] = [];
  const a = await digestIssues(path, [src], { client, fetch: noFetch, now: new Date('2026-10-21T00:00:00Z'), onUsage: (u) => { used.push(u.outputTokens); } });
  const d = a.get(issueKey(src.url))!;
  assert.equal(d.lines.length, 3);
  assert.equal(d.image, null);
  assert.deepEqual(used, [120]);
  const b = await digestIssues(path, [src], { client, fetch: noFetch, now: new Date('2026-10-21T01:00:00Z') });
  assert.deepEqual(b.get(d.key)!.lines, d.lines);
  assert.equal(calls.n, 1);
  assert.equal((await readFile(path, 'utf8')).trim().split('\n').length, 1);
  // Over budget: no call, an issue without a summary still gets its page.
  const c = await digestIssues(path, [{ ...src, url: 'https://x.kr/other' }], { client, fetch: noFetch, now: new Date(), allow: () => false });
  assert.deepEqual(c.get(issueKey('https://x.kr/other'))!.lines, []);
  assert.equal(calls.n, 1);
});

test('merged rows link to the in-app page; the page carries summary, stocks and the publisher link', () => {
  const kr: NewsIssueBoard = { from: null, to: null, articles: 3, issues: [{ rank: 1, title: src.title, url: src.url, publisher: '한국경제', outlets: 146, articles: 173, firstAt: '2026-10-20T06:12:00Z', lastAt: '2026-10-20T09:00:00Z', prev: null,
    stocks: [{ symbol: '034020', name: '두산에너빌리티', changePct: -8.0, articles: 120 }], headlines: [{ title: src.title, url: src.url, publisher: '한국경제', publishedAt: '' }, { title: '다른 제목', url: 'https://x.kr/2', publisher: '서울경제', publishedAt: '' }] }] };
  const key = issueKey(src.url);
  const digests = new Map([[key, { key, url: src.url, lines: ['첫 줄이에요.', '둘째 줄이에요.', '셋째 줄이에요.'], image: { src: 'https://img.example/p.jpg', credit: '한국경제' }, model: 'claude-haiku-5-5', at: '' }]]);
  const list = mergeIssues(kr, null, () => null, { digests, closes: new Map([['034020', 61700]]) });
  assert.equal(list[0]!.key, key);
  const html = issuesList(list, 10, true);
  assert.match(html, new RegExp(`href="issue/${key}\\.html"`));
  assert.match(html, /ia-lead/);
  assert.match(html, /사진 · 한국경제/);
  assert.match(html, /첫 줄이에요/);
  const page = renderIssuePage(list[0]!, { firstAt: kr.issues[0]!.firstAt });
  assert.match(page, /AI 3줄 요약/);
  assert.match(page, /61,700원/);
  assert.match(page, /href="\.\.\/stock\.html\?c=034020"/);
  assert.match(page, /한국경제에서 기사 보기/);
  assert.match(page, /referrerpolicy="no-referrer"/);
  assert.match(page, /10월 20일 15:12 처음 보도/);
  assert.match(page, /다른 제목/);
});
