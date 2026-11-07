// G-321: what the SNS auto-post job sends for a promo day, and the checks it runs before sending.
// The cards and captions come from promo/<date>/ (G-309); this file only decides and signs.

import { createHmac, randomBytes } from 'node:crypto';
import { PROMO_NOTE, xWeight } from './promoCards.js';

export type Channel = 'x' | 'insta' | 'story' | 'reel' | 'blog';
export type Mode = 'off' | 'manual' | 'on';

export interface PlannedPost {
  channel: Channel;
  /** Files under promo/<date>/, in order (images for X/Instagram, the text file for the blog). */
  images: string[];
  text: string;
}

/**
 * X bills a post with a link far more than a plain one (pay-per-use since 2026), so by default the
 * link line becomes a pointer to the profile link. PROMO_X_LINK=on keeps the link.
 */
export function xWithoutLink(text: string): string {
  const lines = text.replace(/^https?:\/\/\S+$/m, '전체 리포트는 프로필 링크에서').split('\n');
  // The pointer weighs a little more than a link (23), so the summary line (2nd) may need a trim.
  while (xWeight(lines.join('\n')) > 280 && (lines[1]?.length ?? 0) > 2) lines[1] = lines[1]!.replace(/…$/, '').slice(0, -2).replace(/\s+\S*$/, '') + '…';
  return lines.join('\n');
}

export const modeOf = (v: string | undefined): Mode => (v === 'on' || v === 'manual' ? v : 'off');

/** Weekday (0 = Sunday) of a YYYY-MM-DD date. */
const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/**
 * The plan for one promo day, following the promo doc's routine:
 * X every weekday (x.png + x.txt), an Instagram story every weekday (story.jpg),
 * an Instagram feed post every weekday (한서 11/5) (the day's G-322 carousel; Friday's adds the weekly scorecard and miss),
 * and on Friday the Naver blog text (sent as an issue to copy, Naver has no write API).
 * Instagram takes JPEG only, so a day rendered before G-321 (PNG only) gets no Instagram posts.
 */
export function planDay(date: string, files: readonly string[], texts: { x?: string | undefined; insta?: string | undefined; blog?: string | undefined }): PlannedPost[] {
  const has = (f: string) => files.includes(f);
  const d = dow(date);
  if (d === 0 || d === 6) return [];
  const out: PlannedPost[] = [];
  if (texts.x && has('x.png')) out.push({ channel: 'x', images: ['x.png'], text: texts.x.trim() });
  if (has('story.jpg')) out.push({ channel: 'story', images: ['story.jpg'], text: '' });
  if (texts.insta) {
    // G-322 carousel (deckNN-<role>.jpg, in order); days made before it use the old opinion/cover/miss cards.
    const deck = files.filter((f) => /^deck\d\d-.*\.jpg$/.test(f)).sort();
    const feed = deck.length ? deck.slice(0, 10) : [...(d === 5 ? ['cover.jpg', 'miss.jpg'] : []), 'opinion1.jpg', 'opinion2.jpg'].filter(has);
    if (feed.length) out.push({ channel: 'insta', images: feed, text: texts.insta.trim() });
  }
  if (texts.blog) {
    const deck = files.filter((f) => /^deck\d\d-(week|miss)\.png$/.test(f)).sort();
    out.push({ channel: 'blog', images: deck.length ? [deck[0]!, 'story.png', ...deck.slice(1)].filter(has) : ['cover.png', 'story.png', 'miss.png'].filter(has), text: texts.blog.trim() });
  }
  return out;
}

/** One ready-made vertical video in promo/reels/ (queue in promo/reels/reels.json). */
export interface ReelItem { file: string; caption: string }

/**
 * Reels go out on Tuesdays and Fridays (한서 11/7), the next one in the queue that has not gone out yet.
 * Instagram fetches the video from the site (site/promo/reels/).
 */
export function planReel(date: string, queue: readonly ReelItem[], done: Readonly<Record<string, unknown>>): PlannedPost | null {
  const d = dow(date);
  if (d !== 2 && d !== 5) return null;
  const next = queue.find((r) => !done[r.file]);
  return next ? { channel: 'reel', images: [next.file], text: next.caption.trim() } : null;
}

/**
 * 한서's answer on a review issue (11/7: every post waits for 한서's OK).
 * "올려" (or ㅇㅋ·ok·승인) posts everything; naming channels posts only those; "… 빼고" posts the rest;
 * "취소" (or 안 올려) posts nothing. Anything else is not an answer.
 */
export function parseApproval(comment: string): { go: false; cancel: boolean } | { go: true; only: Channel[] | null; skip: Channel[] } {
  const t = comment.trim().toLowerCase();
  if (/취소|안\s*올려|올리지\s*마/.test(t)) return { go: false, cancel: true };
  if (!/올려|ㅇㅋ|오케이|\bok\b|승인|좋아/.test(t)) return { go: false, cancel: false };
  const words: [RegExp, Channel][] = [[/스토리/, 'story'], [/캐러셀|게시물|피드/, 'insta'], [/릴스/, 'reel'], [/\bx\b|엑스|트위터/, 'x']];
  const named = words.filter(([re]) => re.test(t)).map(([, c]) => c);
  if (!named.length) return { go: true, only: null, skip: [] };
  return /빼고|빼서|제외/.test(t) ? { go: true, only: null, skip: named } : { go: true, only: named, skip: [] };
}

/**
 * Words that would make a post read as investment advice, a returns ad or a paid service
 * (유사투자자문 risk, and no paid activity during military service). Same list as the promo doc's checklist.
 */
const BANNED: [RegExp, string][] = [
  [/수익률|수익\s*보장|원금|고수익|대박/, '수익률·수익 이야기'],
  [/적중률/, '적중률 자랑'],
  [/사세요|파세요|매수하세요|매도하세요|담으세요|사야|팔아야|따라\s*사/, '사라·팔라'],
  [/(종목|매수|매도)\s*추천|추천주|급등주|목표가/, '종목 추천·목표가'],
  [/리딩|오픈\s*채팅|오픈톡|텔레그램|카톡방|단톡방/, '리딩방'],
  [/유료|할인|무료\s*체험|구독료|결제|VIP|프리미엄\s*회원/i, '돈 이야기'],
  [/무조건|확실히\s*(오|내)/, '단정'],
  [/군복|부대|복무|전역|휴가\s*나/, '군 복무 이야기'],
];

/** Problems with a post's text; an empty list means it may go out. */
export function checkText(text: string, channel: Channel): string[] {
  const out = BANNED.filter(([re]) => re.test(text)).map(([, why]) => why);
  if (channel !== 'story' && !text.includes(PROMO_NOTE)) out.push(`"${PROMO_NOTE}" 문구 없음`);
  return out;
}

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

export interface OAuth1Keys { consumerKey: string; consumerSecret: string; token: string; tokenSecret: string }

/**
 * OAuth 1.0a header for an X API call. JSON and multipart bodies are not signed, only the URL's query.
 * `nonce` and `ts` are for tests.
 */
export function oauth1Header(method: string, url: string, k: OAuth1Keys, nonce = randomBytes(16).toString('hex'), ts = Math.floor(Date.now() / 1000).toString()): string {
  const u = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: k.consumerKey, oauth_nonce: nonce, oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: ts, oauth_token: k.token, oauth_version: '1.0',
  };
  const params = [...Object.entries(oauth), ...u.searchParams.entries()].map(([a, b]) => [enc(a), enc(b)] as const).sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : 1) : a[0] < b[0] ? -1 : 1));
  const base = [method.toUpperCase(), enc(`${u.origin}${u.pathname}`), enc(params.map(([a, b]) => `${a}=${b}`).join('&'))].join('&');
  const sig = createHmac('sha1', `${enc(k.consumerSecret)}&${enc(k.tokenSecret)}`).update(base).digest('base64');
  return 'OAuth ' + Object.entries({ ...oauth, oauth_signature: sig }).map(([a, b]) => `${enc(a)}="${enc(b)}"`).join(', ');
}
