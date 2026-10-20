// G-268: world news issues. Headlines from Korean world/economy feeds and English business feeds are tagged with
// topics by key words (중동·원유, 미국 금리 …), then ranked with the same rule as the stock news issues
// (rankNewsIssues): same-story clusters, joined when they share a topic and two key words, ordered by outlets.
// Each topic names the markets it is about, so an issue shows how those moved the same day. That is a
// side-by-side, never a cause. Pure functions.

import type { NewsItem } from '../types.js';
import { rankNewsIssues, type NewsIssueBoard } from './newsIssues.js';

export type WorldTag = '지정학' | '경제·금리' | '기업·기술' | '한국';
export interface WorldTopic { id: string; label: string; tag: WorldTag; words: RegExp; markets: readonly string[] }

/** Topics in priority order; an article may carry several. `markets` are WorldMarkets keys (index codes or macro keys). */
export const WORLD_TOPICS: readonly WorldTopic[] = [
  { id: 'T:mideast', label: '중동·원유', tag: '지정학', words: /후티|이란|이스라엘|중동|사우디|하마스|가자|호르무즈|원유|유가|OPEC|Houthi|Iran|Israel|Saudi|Gaza|crude|oil price|OPEC/i, markets: ['WTI', 'BRENT'] },
  { id: 'T:ukraine', label: '러시아·우크라이나', tag: '지정학', words: /우크라|러시아|푸틴|젤렌스키|종전|Ukraine|Russia|Putin|Zelensky/i, markets: ['.STOXX50E', 'NG'] },
  { id: 'T:nk', label: '북한', tag: '지정학', words: /북한|김정은|평양|North Korea|Kim Jong/i, markets: ['USDKRW', 'KOSPI'] },
  { id: 'T:uspol', label: '미국 정치·관세', tag: '지정학', words: /트럼프|백악관|관세|무역\s?협정|Trump|White House|tariff/i, markets: ['.INX', 'DXY'] },
  { id: 'T:rates', label: '금리·물가', tag: '경제·금리', words: /연준|파월|FOMC|금리|국채|물가|인플레|CPI|금통위|기준금리|\bFed\b|Powell|rate cut|rate hike|Treasury|inflation/i, markets: ['US10Y', 'KR10Y'] },
  { id: 'T:fx', label: '환율·달러', tag: '경제·금리', words: /환율|달러|원화|엔화|위안화|dollar|\byen\b|currency/i, markets: ['USDKRW', 'DXY'] },
  { id: 'T:gold', label: '금·원자재', tag: '경제·금리', words: /금값|금 시세|국제 금|구리|원자재|gold price|copper|commodit/i, markets: ['GOLD', 'COPPER'] },
  { id: 'T:chip', label: '반도체·AI', tag: '기업·기술', words: /반도체|엔비디아|TSMC|하이닉스|삼성전자|\bAI\b|인공지능|딥시크|DeepSeek|Nvidia|chip|semiconductor|OpenAI/i, markets: ['.SOX', '.IXIC'] },
  { id: 'T:china', label: '중국', tag: '경제·금리', words: /중국|시진핑|베이징|China|Chinese|Beijing|Xi Jinping/i, markets: ['.SSEC', '.HSI'] },
  { id: 'T:japan', label: '일본', tag: '경제·금리', words: /일본|닛케이|니케이|일본은행|Japan|Nikkei|BOJ/i, markets: ['.N225', 'USDJPY'] },
  { id: 'T:europe', label: '유럽', tag: '경제·금리', words: /유럽|유로존|ECB|독일|프랑스|영국|Europe|eurozone|Germany|France|Britain|\bUK\b/i, markets: ['.STOXX50E', 'EURUSD'] },
  { id: 'T:korea', label: '한국 증시', tag: '한국', words: /코스피|코스닥|증시|외국인 순매|KOSPI|Korea/i, markets: ['KOSPI', 'KOSDAQ'] },
];

export interface WorldFeed { url: string; source: string; lang: 'ko' | 'en'; publisher?: string }
export const WORLD_FEEDS: readonly WorldFeed[] = [
  { url: 'https://news.google.com/rss/headlines/section/topic/WORLD?hl=ko&gl=KR&ceid=KR:ko', source: 'google:topic-world-ko', lang: 'ko' },
  { url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=ko&gl=KR&ceid=KR:ko', source: 'google:topic-business-ko', lang: 'ko' },
  { url: 'https://www.yna.co.kr/rss/international.xml', source: 'rss:yna-world', lang: 'ko', publisher: '연합뉴스' },
  { url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en', source: 'google:topic-business-en', lang: 'en' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'rss:bbc-business', lang: 'en', publisher: 'BBC' },
];

export const topicsOf = (title: string): WorldTopic[] => WORLD_TOPICS.filter((t) => t.words.test(title));

export interface WorldIssue {
  rank: number;
  title: string;
  url: string;
  publisher: string;
  outlets: number;
  articles: number;
  lastAt: string;
  isNew: boolean;
  prevRank: number | null;
  lang: 'ko' | 'en';
  tag: WorldTag | null;
  topics: string[];
  /** Market keys the issue's topics name, first topic first, no repeats, at most three. */
  markets: string[];
  headlines: { title: string; url: string; publisher: string; publishedAt: string }[];
}
export interface WorldIssueBoard { from: string | null; to: string | null; articles: number; issues: WorldIssue[] }

const hangul = /[가-힣]/;

/**
 * Ranks the last 24 hours of world headlines. An article without any topic still ranks (as its own story), so a big
 * story the word lists miss is not dropped; it just shows no tag and no market.
 */
export function rankWorldIssues(items: readonly NewsItem[], now: Date, limit = 15): WorldIssueBoard {
  const byId = new Map(WORLD_TOPICS.map((t) => [t.id, t] as const));
  const tagged = items.map((item) => ({ item, symbols: topicsOf(item.title).map((t) => t.id) }));
  const names = new Map(WORLD_TOPICS.map((t) => [t.id, t.label] as const));
  const board: NewsIssueBoard = rankNewsIssues(tagged, { now, names, limit });
  return {
    from: board.from, to: board.to, articles: board.articles,
    issues: board.issues.map((i) => {
      const topics = i.stocks.map((s) => byId.get(s.symbol)).filter((t): t is WorldTopic => !!t);
      // The lead topic is the one the most articles carry; ties keep WORLD_TOPICS order.
      topics.sort((a, b) => (i.stocks.find((s) => s.symbol === b.id)!.articles - i.stocks.find((s) => s.symbol === a.id)!.articles) || WORLD_TOPICS.indexOf(a) - WORLD_TOPICS.indexOf(b));
      return {
        rank: i.rank, title: i.title, url: i.url, publisher: i.publisher, outlets: i.outlets, articles: i.articles, lastAt: i.lastAt,
        isNew: !i.prev, prevRank: i.prev?.rank ?? null, lang: hangul.test(i.title) ? 'ko' : 'en',
        tag: topics[0]?.tag ?? null, topics: topics.map((t) => t.label),
        markets: [...new Set(topics.flatMap((t) => t.markets))].slice(0, 3),
        headlines: i.headlines,
      };
    }),
  };
}
