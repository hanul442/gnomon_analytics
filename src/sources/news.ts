// News headlines from the Naver news search API and RSS feeds
// (Google News search, outlet feeds). Only headline, outlet, link and
// publish time are kept — never the article body (docs/DESIGN.md §4.3).

import type { NewsItem } from '../types.js';

export const NAVER_NEWS_SOURCE = 'naver:news-search';
export const GOOGLE_NEWS_SOURCE = 'google:news-rss';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };

/** Strips tags (Naver wraps matches in <b>) and decodes HTML entities. */
export function plainText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code[0] === '#') {
        const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const TRACKING = /^(utm_|fbclid$|gclid$|ref$|from$)/i;

/** Stable URL identity: https, lowercase host, no tracking params, no fragment, no trailing slash. */
export function canonicalUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  return url.toString().replace(/\/$/, '');
}

/** Outlet names by domain suffix. */
const OUTLETS: readonly [string, string][] = [
  ['yna.co.kr', '연합뉴스'], ['yonhapnewstv.co.kr', '연합뉴스TV'], ['news1.kr', '뉴스1'], ['newsis.com', '뉴시스'],
  ['mk.co.kr', '매일경제'], ['hankyung.com', '한국경제'], ['sedaily.com', '서울경제'], ['mt.co.kr', '머니투데이'],
  ['edaily.co.kr', '이데일리'], ['fnnews.com', '파이낸셜뉴스'], ['asiae.co.kr', '아시아경제'], ['heraldcorp.com', '헤럴드경제'],
  ['biz.chosun.com', '조선비즈'], ['etnews.com', '전자신문'], ['dt.co.kr', '디지털타임스'], ['zdnet.co.kr', '지디넷코리아'],
  ['thebell.co.kr', '더벨'], ['thelec.kr', '디일렉'], ['inews24.com', '아이뉴스24'], ['newspim.com', '뉴스핌'],
  ['ajunews.com', '아주경제'], ['bizwatch.co.kr', '비즈니스워치'], ['businesspost.co.kr', '비즈니스포스트'], ['bloter.net', '블로터'],
  ['chosun.com', '조선일보'], ['joongang.co.kr', '중앙일보'], ['donga.com', '동아일보'], ['hani.co.kr', '한겨레'],
  ['khan.co.kr', '경향신문'], ['kmib.co.kr', '국민일보'], ['seoul.co.kr', '서울신문'], ['munhwa.com', '문화일보'],
  ['sbs.co.kr', 'SBS'], ['kbs.co.kr', 'KBS'], ['imbc.com', 'MBC'], ['ytn.co.kr', 'YTN'], ['jtbc.co.kr', 'JTBC'],
  ['yonhapinfomax.co.kr', '연합인포맥스'], ['etoday.co.kr', '이투데이'], ['ddaily.co.kr', '디지털데일리'], ['sentv.co.kr', '서울경제TV'],
  ['g-enews.com', '글로벌이코노믹'], ['wowtv.co.kr', '한국경제TV'], ['mtn.co.kr', '머니투데이방송'], ['daum.net', '다음뉴스'],
  ['reuters.com', 'Reuters'], ['bloomberg.com', 'Bloomberg'], ['wsj.com', 'WSJ'], ['ft.com', 'FT'],
];

const ALIASES: Record<string, string> = { chosunbiz: '조선비즈', 'chosun biz': '조선비즈', yonhap: '연합뉴스', 'the elec': '디일렉' };

/**
 * Display name for an outlet: domain-like names ("yna.co.kr", stored before
 * this mapping existed) become outlet names; known English names are
 * translated; anything else is kept as given.
 */
export function outletName(name: string): string {
  const trimmed = name.trim();
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) return outletFromUrl(`https://${trimmed}`) ?? trimmed;
  return ALIASES[trimmed.toLowerCase()] ?? trimmed;
}

export function outletFromUrl(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  const hit = OUTLETS.find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  return hit ? hit[1] : host.replace(/^(www|m|news|n)\./, '');
}

function isoFromDate(value: string): string | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

interface NaverNewsRow { title?: unknown; originallink?: unknown; link?: unknown; pubDate?: unknown }

export function parseNaverNews(body: unknown, retrievedAt: Date): NewsItem[] {
  if (body === null || typeof body !== 'object' || !Array.isArray((body as { items?: unknown }).items)) {
    const message = body && typeof body === 'object' ? String((body as Record<string, unknown>).errorMessage ?? '') : '';
    throw new Error(`NAVER_NEWS_UNEXPECTED_RESPONSE${message ? `:${message.slice(0, 120)}` : ''}`);
  }
  const items: NewsItem[] = [];
  for (const row of (body as { items: NaverNewsRow[] }).items) {
    const raw = typeof row.originallink === 'string' && row.originallink ? row.originallink : typeof row.link === 'string' ? row.link : '';
    const url = canonicalUrl(raw);
    const title = typeof row.title === 'string' ? plainText(row.title) : '';
    const publishedAt = typeof row.pubDate === 'string' ? isoFromDate(row.pubDate) : null;
    if (!url || !title || !publishedAt) continue;
    items.push({ url, title, publisher: outletFromUrl(url) ?? '알 수 없음', publishedAt, source: NAVER_NEWS_SOURCE, retrievedAt: retrievedAt.toISOString() });
  }
  return items;
}

export async function fetchNaverNews(options: {
  clientId: string;
  clientSecret: string;
  query: string;
  pages?: number;
  fetch?: typeof fetch;
  now?: () => Date;
}): Promise<NewsItem[]> {
  if (!options.clientId.trim() || !options.clientSecret.trim()) throw new Error('NAVER_API_KEY_MISSING');
  const all: NewsItem[] = [];
  for (let page = 0; page < (options.pages ?? 3); page += 1) {
    const url = new URL('https://openapi.naver.com/v1/search/news.json');
    url.searchParams.set('query', options.query);
    url.searchParams.set('display', '100');
    url.searchParams.set('start', String(page * 100 + 1));
    url.searchParams.set('sort', 'date');
    const response = await (options.fetch ?? fetch)(url, {
      headers: { 'X-Naver-Client-Id': options.clientId, 'X-Naver-Client-Secret': options.clientSecret },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      // Naver's error body carries a code (e.g. 024 = authentication failed); it holds no secrets.
      const detail = await response.json().then((b: unknown) => {
        if (b === null || typeof b !== 'object') return '';
        const { errorCode, errorMessage } = b as { errorCode?: unknown; errorMessage?: unknown };
        return `${String(errorCode ?? '')} ${String(errorMessage ?? '')}`.trim();
      }, () => '');
      throw new Error(`NAVER_NEWS_HTTP_${response.status}${detail ? `:${detail.slice(0, 120)}` : ''}`);
    }
    const body = (await response.json()) as unknown;
    all.push(...parseNaverNews(body, (options.now ?? (() => new Date()))()));
    // Page on the raw row count: dropping a malformed row must not end paging early.
    const rows = (body as { items?: unknown[] }).items?.length ?? 0;
    if (rows < 100) break;
  }
  return all;
}

function tag(block: string, name: string): string | null {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return match ? match[1]! : null;
}

/**
 * Parses RSS 2.0 items. Google News titles end in " - 언론사" and carry a
 * <source> element; that suffix is removed from the headline.
 */
export function parseRss(xml: string, sourceId: string, retrievedAt: Date, defaultPublisher?: string): NewsItem[] {
  if (!/<rss[\s>]|<channel[\s>]/i.test(xml)) throw new Error(`RSS_UNEXPECTED_RESPONSE:${sourceId}`);
  const items: NewsItem[] = [];
  for (const match of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const block = match[0];
    const url = canonicalUrl(plainText(tag(block, 'link') ?? ''));
    let title = plainText(tag(block, 'title') ?? '');
    const sourceName = plainText(tag(block, 'source') ?? '');
    const publishedAt = isoFromDate(plainText(tag(block, 'pubDate') ?? ''));
    if (sourceName && title.endsWith(` - ${sourceName}`)) title = title.slice(0, -(sourceName.length + 3)).trim();
    // Google sometimes names the outlet by its domain; map it to the outlet name.
    const named = sourceName ? outletName(sourceName) : '';
    if (!url || !title || !publishedAt) continue;
    items.push({
      url, title, publishedAt, source: sourceId, retrievedAt: retrievedAt.toISOString(),
      publisher: named || defaultPublisher || outletFromUrl(url) || '알 수 없음',
    });
  }
  return items;
}

export async function fetchRss(url: string, sourceId: string, options: { fetch?: typeof fetch; now?: () => Date; publisher?: string } = {}): Promise<NewsItem[]> {
  const response = await (options.fetch ?? fetch)(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GnomonAnalytics/0.1)' }, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`RSS_HTTP_${response.status}:${sourceId}`);
  return parseRss(decodeFeed(new Uint8Array(await response.arrayBuffer()), response.headers.get('content-type')), sourceId, (options.now ?? (() => new Date()))(), options.publisher);
}

/** Korean outlet feeds are sometimes EUC-KR; honour the declared charset. */
export function decodeFeed(bytes: Uint8Array, contentType: string | null): string {
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 300));
  const declared = /charset=["']?([\w-]+)/i.exec(contentType ?? '')?.[1] ?? /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(declared.toLowerCase()).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function googleNewsSearchUrl(query: string): string {
  const url = new URL('https://news.google.com/rss/search');
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'ko');
  url.searchParams.set('gl', 'KR');
  url.searchParams.set('ceid', 'KR:ko');
  return url.toString();
}
