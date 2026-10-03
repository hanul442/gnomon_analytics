// News relevance, classification, outlet tier and same-story grouping
// (docs/DESIGN.md §4.3). Pure functions.

import type { NewsItem } from '../types.js';
import { outletName } from '../sources/news.js';

export type NewsImportance = 'HIGH' | 'MEDIUM' | 'LOW';
export type OutletTier = 'OFFICIAL' | 'WIRE_BIZ' | 'GENERAL';

const ALIASES = /SK\s*하이닉스|하이닉스|SK\s*hynix/i;
/** Sports, entertainment, personnel and obituary items are not investment news. */
const EXCLUDED = /야구|축구|농구|배구|골프|e스포츠|프로게임|와이번스|랜더스|나이츠|연예|드라마|예능|\[인사\]|\[부고\]|부고|인사 발령|^\[포토\]|\[사진\]/;

export function isRelevant(title: string): boolean {
  return ALIASES.test(title) && !EXCLUDED.test(title);
}

const RULES: readonly { category: string; importance: NewsImportance; pattern: RegExp }[] = [
  { category: '실적', importance: 'HIGH', pattern: /실적|영업이익|영업익|매출|순이익|어닝|잠정치/ },
  { category: '규제·정책', importance: 'HIGH', pattern: /규제|관세|제재|수출\s*통제|보조금|법안|소송|공정위|칩스법/ },
  { category: '고객·수주', importance: 'MEDIUM', pattern: /수주|공급\s*계약|납품|엔비디아|NVIDIA|애플|AMD|마이크로소프트|구글|TSMC|고객사|브로드컴/i },
  { category: '증권가 전망', importance: 'MEDIUM', pattern: /목표가|목표주가|투자의견|컨센서스|리포트|증권사|애널리스트/ },
  // "투자" alone, not 투자의견/투자자/투자심리.
  { category: '투자·설비', importance: 'MEDIUM', pattern: /투자(?!의견|자|심리)|증설|공장|팹|용인|청주|인디애나|M15|클러스터/ },
  { category: 'HBM·제품', importance: 'MEDIUM', pattern: /HBM|D램|DRAM|낸드|NAND|메모리|eSSD|CXL|AI\s*반도체/i },
  { category: '주가·수급', importance: 'LOW', pattern: /주가|외국인|기관|순매수|순매도|시가총액|시총|코스피|급등|급락|신고가|상승|하락/ },
];

export function classifyNews(title: string): { category: string; importance: NewsImportance } {
  const rule = RULES.find((r) => r.pattern.test(title));
  return rule ? { category: rule.category, importance: rule.importance } : { category: '기타', importance: 'LOW' };
}

const WIRE_BIZ = new Set([
  '연합뉴스', '연합뉴스TV', '뉴스1', '뉴시스', '매일경제', '한국경제', '서울경제', '머니투데이', '이데일리', '파이낸셜뉴스',
  '아시아경제', '헤럴드경제', '조선비즈', '전자신문', '디지털타임스', '지디넷코리아', '더벨', '디일렉', '뉴스핌', '비즈니스워치',
  '연합인포맥스', '이투데이', '디지털데일리', '서울경제TV', '한국경제TV', '머니투데이방송', '아주경제', '아이뉴스24',
  'Reuters', 'Bloomberg', 'WSJ', 'FT',
]);

/** "매일경제 마켓" and other section names count as their outlet. */
export function outletTier(publisher: string): OutletTier {
  const name = publisher.trim();
  return [...WIRE_BIZ].some((outlet) => name === outlet || name.startsWith(`${outlet} `)) ? 'WIRE_BIZ' : 'GENERAL';
}

export interface NewsCluster {
  /** URL of the representative article. */
  id: string;
  title: string;
  url: string;
  publisher: string;
  tier: OutletTier;
  category: string;
  importance: NewsImportance;
  firstAt: string;
  lastAt: string;
  /** Articles in the story, oldest first. Repeats do not add evidence weight. */
  articles: { title: string; url: string; publisher: string; publishedAt: string }[];
}

function bigrams(title: string): Set<string> {
  // The company name is in every headline; leave it out so it cannot make stories look alike.
  const text = title.replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(new RegExp(ALIASES.source, 'gi'), '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
  const out = new Set<string>();
  for (let i = 0; i < text.length - 1; i += 1) out.add(text.slice(i, i + 2));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

const SAME_STORY = 0.45;
const WINDOW_MS = 48 * 60 * 60_000;
const TIER_RANK: Record<OutletTier, number> = { OFFICIAL: 0, WIRE_BIZ: 1, GENERAL: 2 };
const IMPORTANCE_RANK: Record<NewsImportance, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/**
 * Groups relevant articles into stories: an article joins a story when its
 * headline is similar (character-bigram Jaccard ≥ 0.45) to any article of
 * the story published within 48 hours. Duplicate URLs count once.
 */
export function clusterNews(items: readonly NewsItem[]): NewsCluster[] {
  const unique = new Map<string, NewsItem>();
  for (const item of items) if (isRelevant(item.title) && !unique.has(item.url)) unique.set(item.url, { ...item, publisher: outletName(item.publisher) });
  const sorted = [...unique.values()].sort((a, b) => (a.publishedAt < b.publishedAt ? -1 : a.publishedAt > b.publishedAt ? 1 : a.url < b.url ? -1 : 1));
  const groups: { members: NewsItem[]; grams: Set<string>[] }[] = [];
  for (const item of sorted) {
    const grams = bigrams(item.title);
    const at = Date.parse(item.publishedAt);
    const group = groups.find((g) => g.members.some((m, i) => at - Date.parse(m.publishedAt) <= WINDOW_MS && jaccard(g.grams[i]!, grams) >= SAME_STORY));
    if (group) { group.members.push(item); group.grams.push(grams); } else groups.push({ members: [item], grams: [grams] });
  }
  return groups.map(({ members }) => {
    const rep = [...members].sort((a, b) => TIER_RANK[outletTier(a.publisher)] - TIER_RANK[outletTier(b.publisher)] || (a.publishedAt < b.publishedAt ? -1 : 1))[0]!;
    // The story's importance is the highest any of its headlines earns.
    const readings = members.map((m) => classifyNews(m.title)).sort((a, b) => IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance]);
    const best = readings[0]!;
    return {
      id: rep.url, title: rep.title, url: rep.url, publisher: rep.publisher, tier: outletTier(rep.publisher),
      category: best.category, importance: best.importance,
      firstAt: members[0]!.publishedAt, lastAt: members.at(-1)!.publishedAt,
      articles: members.map((m) => ({ title: m.title, url: m.url, publisher: m.publisher, publishedAt: m.publishedAt })),
    };
  }).sort((a, b) => IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance] || (a.lastAt < b.lastAt ? 1 : -1));
}
