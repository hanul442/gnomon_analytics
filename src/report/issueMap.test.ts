import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueMapParts, ISSUE_MAP_JS } from './issueMap.js';
import { mergeIssues } from './issuesAll.js';
import { regionOf, sectorsOf } from '../analysis/issueRegions.js';
import type { WorldIssueBoard } from '../analysis/worldNews.js';
import type { NewsIssueBoard } from '../analysis/newsIssues.js';
import type { UniverseRow } from '../sources/naverList.js';

const w = (rank: number, title: string, topics: string[]) => ({ rank, title, url: `https://x/${rank}`, publisher: 'BBC', outlets: 10 - rank, articles: 3, lastAt: '', isNew: false, prevRank: null, lang: 'ko' as const, tag: null, topics, markets: [], headlines: [] });
const world: WorldIssueBoard = { from: null, to: null, articles: 9, issues: [w(1, '브렌트유 117달러 돌파', ['중동·원유', '중국']), w(2, '관세 철폐 추진', ['미국 정치·관세']), w(3, '토픽 없는 기사', [])] };
const kr: NewsIssueBoard = { from: null, to: null, articles: 5, issues: [{ rank: 1, title: '대한항공 개인정보 유출', url: 'https://k/1', publisher: '연합', outlets: 20, articles: 5, lastAt: '', prev: null, stocks: [{ symbol: '003490', name: '대한항공', articles: 5, changePct: -2.4 }], headlines: [] }] } as unknown as NewsIssueBoard;
const uni = [{ symbol: '010950', name: 'S-Oil', changePct: 3.1 }, { symbol: '003490', name: '대한항공', changePct: -2.4 }] as UniverseRow[];

test('G-295: an issue gets its region from the lead known topic; Korean stock news sits on 한국', () => {
  assert.equal(regionOf('세계', ['중동·원유', '중국']), 'me');
  assert.equal(regionOf('세계', ['모르는 주제']), null);
  assert.equal(regionOf('한국', []), 'kr');
  assert.deepEqual(sectorsOf(['중동·원유', '중국']).map((s) => s.name), ['정유', '항공', '해운', '화장품', '철강']);
});

test('G-295: merged issues carry region and sectors, and the list says 한국에선 for world issues', () => {
  const list = mergeIssues(kr, world);
  const oil = list.find((i) => i.title.startsWith('브렌트유'))!;
  assert.equal(oil.region, 'me');
  assert.deepEqual(oil.sectors.slice(0, 3), ['정유', '항공', '해운']);
  assert.equal(list.find((i) => i.from === '한국')!.region, 'kr');
  assert.equal(list.find((i) => i.title === '토픽 없는 기사')!.region, null);
});

test('G-295: pins are numbered by the best rank, and a region sheet lists only its own topics\' stocks with today\'s move', () => {
  const issues = mergeIssues(kr, world);
  const p = issueMapParts({ issues, world: null, universe: uni })!;
  assert.ok(p);
  const oilRank = issues.find((i) => i.region === 'me')!.rank;
  assert.match(p.mini, new RegExp(`data-im="me"[^>]*>${oilRank}</button>`));
  const me = p.sheets.match(/<template id="im-me">([\s\S]*?)<\/template>/)![1]!;
  assert.match(me, /같은 날 한국에선/);
  assert.match(me, /S-Oil<\/b><small>정유<\/small><\/span><b class="up">▲ 3\.1%/);
  assert.ok(!me.includes('아모레퍼시픽'), 'China cosmetics belong to the 중국 sheet');
  assert.match(me, /원인이라는 뜻이 아니에요/);
  const k = p.sheets.match(/<template id="im-kr">([\s\S]*?)<\/template>/)![1]!;
  assert.match(k, /대한항공<\/b><small>뉴스에 나온 종목<\/small><\/span><b class="down">▼ 2\.4%/);
  assert.ok(!p.mini.includes('wm-pin'), 'the small map shows no number labels (each number in one place)');
  assert.doesNotThrow(() => new Function(ISSUE_MAP_JS.replace(/<\/?script>/g, '')));
});

test('G-295: no map when no issue has a region', () => {
  assert.equal(issueMapParts({ issues: mergeIssues(null, { ...world, issues: [w(3, '토픽 없는 기사', [])] }), world: null, universe: null }), null);
});
