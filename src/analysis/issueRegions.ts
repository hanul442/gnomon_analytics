// G-295 (한서님 10/24 "이슈랑 세계지도 있는거 잘쓰려면"): where an issue happened and what to look at in Korea.
// Each world topic (worldNews.ts WORLD_TOPICS) gets a region on the world map and a few Korean sectors with one or
// two well-known stocks each. Korean stock news issues sit on 한국. These are fixed lists written by hand: the screen
// shows how those stocks moved the same day, side by side, never as a cause or a pick. Pure data.

export interface IssueRegion {
  id: string;
  name: string;
  /** Map units of kit/worldMap.ts (x = (lon + 180) × 2, y = 170 − 2 × lat), nudged so close pins don't overlap. */
  x: number;
  y: number;
  /** The country whose main index stands for the region on the map (WorldMapEntry iso), if any. */
  iso?: string;
  /** A market key (WorldMarkets) shown in the region's sheet when it has no index of its own. */
  market?: string;
}

export const ISSUE_REGIONS: readonly IssueRegion[] = [
  { id: 'kr', name: '한국', x: 606, y: 104, iso: 'KR' },
  { id: 'us', name: '미국', x: 176, y: 90, iso: 'US' },
  { id: 'cn', name: '중국', x: 556, y: 98, iso: 'CN' },
  { id: 'jp', name: '일본', x: 646, y: 88, iso: 'JP' },
  { id: 'eu', name: '유럽', x: 380, y: 68, iso: 'EU' },
  { id: 'ru', name: '러시아·우크라이나', x: 428, y: 58 },
  { id: 'me', name: '중동', x: 464, y: 112, market: 'BRENT' },
];

export interface KrSector { name: string; stocks: readonly (readonly [symbol: string, name: string])[] }

/** Topic label → the region it happens in and the Korean sectors people usually look at alongside it. */
export const TOPIC_LINKS: Readonly<Record<string, { region: string; sectors: readonly KrSector[] }>> = {
  '중동·원유': { region: 'me', sectors: [
    { name: '정유', stocks: [['010950', 'S-Oil'], ['096770', 'SK이노베이션']] },
    { name: '항공', stocks: [['003490', '대한항공']] },
    { name: '해운', stocks: [['011200', 'HMM']] },
  ] },
  '러시아·우크라이나': { region: 'ru', sectors: [
    { name: '방산', stocks: [['012450', '한화에어로스페이스'], ['064350', '현대로템']] },
    { name: '건설', stocks: [['000720', '현대건설']] },
  ] },
  '북한': { region: 'kr', sectors: [{ name: '방산', stocks: [['012450', '한화에어로스페이스'], ['103140', '풍산']] }] },
  '미국 정치·관세': { region: 'us', sectors: [
    { name: '자동차', stocks: [['005380', '현대차'], ['000270', '기아']] },
    { name: '철강', stocks: [['005490', 'POSCO홀딩스']] },
  ] },
  '금리·물가': { region: 'us', sectors: [{ name: '은행', stocks: [['105560', 'KB금융'], ['055550', '신한지주']] }] },
  '환율·달러': { region: 'kr', sectors: [{ name: '수출', stocks: [['005930', '삼성전자'], ['005380', '현대차']] }] },
  '금·원자재': { region: 'us', sectors: [{ name: '비철금속', stocks: [['010130', '고려아연']] }] },
  '반도체·AI': { region: 'us', sectors: [{ name: '반도체', stocks: [['005930', '삼성전자'], ['000660', 'SK하이닉스'], ['042700', '한미반도체']] }] },
  '중국': { region: 'cn', sectors: [
    { name: '화장품', stocks: [['090430', '아모레퍼시픽'], ['051900', 'LG생활건강']] },
    { name: '철강', stocks: [['005490', 'POSCO홀딩스']] },
  ] },
  '일본': { region: 'jp', sectors: [{ name: '여행', stocks: [['039130', '하나투어']] }] },
  '유럽': { region: 'eu', sectors: [{ name: '2차전지', stocks: [['373220', 'LG에너지솔루션']] }] },
  '한국 증시': { region: 'kr', sectors: [] },
};

/** The region of an issue: its lead topic's region, or 한국 for Korean stock news. Null when the topic is unknown. */
export function regionOf(from: '한국' | '세계', topics: readonly string[]): string | null {
  if (from === '한국') return 'kr';
  for (const t of topics) { const l = TOPIC_LINKS[t]; if (l) return l.region; }
  return null;
}

/** The Korean sectors for an issue's topics, first topic first, no repeated sector. */
export function sectorsOf(topics: readonly string[]): KrSector[] {
  const out: KrSector[] = [], seen = new Set<string>();
  for (const t of topics) for (const s of TOPIC_LINKS[t]?.sectors ?? []) if (!seen.has(s.name)) { seen.add(s.name); out.push(s); }
  return out;
}
