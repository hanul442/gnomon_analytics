import assert from 'node:assert/strict';
import test from 'node:test';
import type { NewsItem } from '../types.js';
import { cleanTitle, keyWords, rankNewsIssues, type TaggedArticle } from './newsIssues.js';

let n = 0;
function art(title: string, publishedAt: string, publisher: string, symbols: string[]): TaggedArticle {
  n += 1;
  const item: NewsItem = { url: `https://x.kr/${n}`, title, publisher, publishedAt, source: 'naver:news-search', retrievedAt: publishedAt };
  return { item, symbols };
}
const names = new Map([['298040', '효성중공업'], ['011200', 'HMM'], ['005930', '삼성전자'], ['066570', 'LG전자']]);

test('key words drop brackets, stock names and particles', () => {
  assert.deepEqual([...keyWords('[단독] 효성중공업, 창원 신공장을 준공…생산능력 2배', ['효성중공업'])], ['창원', '신공장', '준공', '생산능력', '2배']);
});

test('a Google News outlet suffix is cut from the title', () => {
  assert.equal(cleanTitle('삼성전자 3개 제품, 타임지 최고의 발명품 - 머니투데이'), '삼성전자 3개 제품, 타임지 최고의 발명품');
  assert.equal(cleanTitle('이규필 전 부사장 초청 특강 > 뉴스'), '이규필 전 부사장 초청 특강');
});

test('issues rank by distinct outlets, join wordings of one story and link stocks', () => {
  const day = '2026-10-16T0';
  const items = [
    // Same story, three outlets, plus a second wording sharing the stock and two key words.
    art('효성중공업, 창원 초고압차단기 신공장 준공', `${day}1:00:00Z`, '연합뉴스', ['298040']),
    art('효성중공업, 창원 초고압차단기 신공장 준공', `${day}1:10:00Z`, '뉴스1', ['298040']),
    art('효성중공업 창원 초고압차단기 신공장 준공했다', `${day}2:00:00Z`, '매일경제', ['298040']),
    art('효성중공업, 초고압차단기 생산능력 두 배로…창원 공장 가동', `${day}3:00:00Z`, '서울경제', ['298040']),
    // Two outlets; two stocks.
    art('삼성·LG전자 제품, 타임지 최고의 발명품 선정', `${day}4:00:00Z`, '한국경제', ['005930', '066570']),
    art('삼성·LG전자 제품, 타임지 최고의 발명품 선정돼', `${day}5:00:00Z`, '이데일리', ['066570']),
    // One outlet, and also covered the day before.
    art('HMM, 컨테이너선 12척에 2조 투자', `${day}6:00:00Z`, '연합뉴스', ['011200']),
    art('HMM, 컨테이너선 12척 발주 2조원 투자 검토', '2026-10-15T06:00:00Z', '뉴시스', ['011200']),
    // Later than the build: not counted.
    art('효성중공업 미래 기사', '2026-10-17T01:00:00Z', '연합뉴스', ['298040']),
  ];
  const board = rankNewsIssues(items, { now: new Date('2026-10-16T09:00:00Z'), names, changes: new Map([['298040', 3.2]]) });
  assert.equal(board.to, '2026-10-16T06:00:00.000Z');
  assert.equal(board.articles, 7);
  assert.deepEqual(board.issues.map((i) => [i.rank, i.outlets, i.articles]), [[1, 4, 4], [2, 2, 2], [3, 1, 1]]);
  const [top, second, third] = board.issues;
  assert.equal(top!.headlines.length, 2);
  assert.deepEqual(top!.stocks, [{ symbol: '298040', name: '효성중공업', changePct: 3.2, articles: 4 }]);
  assert.equal(top!.prev, null);
  assert.deepEqual(second!.stocks.map((s) => [s.name, s.articles]), [['LG전자', 2], ['삼성전자', 1]]);
  assert.deepEqual(third!.prev, { rank: 1, outlets: 1 });
});

test('the same URL in two stocks\' files counts once with both stocks', () => {
  const a = art('삼성·LG전자, 가전 협력', '2026-10-16T01:00:00Z', '연합뉴스', ['005930']);
  const b: TaggedArticle = { item: a.item, symbols: ['066570'] };
  const board = rankNewsIssues([a, b], { now: new Date('2026-10-16T09:00:00Z'), names });
  assert.equal(board.articles, 1);
  assert.deepEqual(board.issues[0]!.stocks.map((s) => s.symbol).sort(), ['005930', '066570']);
});

test('no news gives an empty board', () => {
  assert.deepEqual(rankNewsIssues([], { now: new Date(), names }), { to: null, from: null, articles: 0, issues: [] });
});
