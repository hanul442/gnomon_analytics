import assert from 'node:assert/strict';
import test from 'node:test';
import type { NewsItem } from '../types.js';
import { classifyNews, clusterNews, isRelevant, outletTier } from './news.js';
import { aliasPattern } from '../config/tickers.js';

const SK = aliasPattern({ newsAliases: ['SK\\s*하이닉스', '하이닉스', 'SK\\s*hynix'] });
const SAMSUNG = aliasPattern({ newsAliases: ['삼성전자', '삼성\\s*전자', 'Samsung\\s*Electronics'] });

function item(title: string, publishedAt: string, publisher = '연합뉴스', url = `https://x.kr/${encodeURIComponent(title)}`): NewsItem {
  return { url, title, publisher, publishedAt, source: 'naver:news-search', retrievedAt: '2026-10-05T09:30:00.000Z' };
}

test('relevance needs the company in the headline and skips sports or personnel items', () => {
  assert.equal(isRelevant('SK하이닉스, HBM4 양산', SK), true);
  assert.equal(isRelevant('하이닉스 주가 신고가', SK), true);
  assert.equal(isRelevant('SK hynix expands Indiana plant', SK), true);
  assert.equal(isRelevant('삼성전자 HBM 공급', SK), false);
  assert.equal(isRelevant('[인사] SK하이닉스', SK), false);
  assert.equal(isRelevant('SK하이닉스 배구단 우승', SK), false);
  // Each stock has its own name pattern.
  assert.equal(isRelevant('삼성전자 HBM 공급', SAMSUNG), true);
  assert.equal(isRelevant('SK하이닉스, HBM4 양산', SAMSUNG), false);
});

test('classification and outlet tier', () => {
  assert.deepEqual(classifyNews('SK하이닉스 3분기 영업이익 사상 최대'), { category: '실적', importance: 'HIGH' });
  assert.deepEqual(classifyNews('SK하이닉스, 엔비디아에 HBM4 공급'), { category: '고객·수주', importance: 'MEDIUM' });
  assert.deepEqual(classifyNews('SK하이닉스 목표가 상향'), { category: '증권가 전망', importance: 'MEDIUM' });
  assert.deepEqual(classifyNews('SK하이닉스 투자의견 매수 유지'), { category: '증권가 전망', importance: 'MEDIUM' });
  assert.deepEqual(classifyNews('SK하이닉스, 용인에 20조 투자'), { category: '투자·설비', importance: 'MEDIUM' });
  assert.deepEqual(classifyNews('SK하이닉스 HBM4 양산'), { category: 'HBM·제품', importance: 'MEDIUM' });
  assert.deepEqual(classifyNews('SK하이닉스 외국인 순매수'), { category: '주가·수급', importance: 'LOW' });
  assert.deepEqual(classifyNews('SK하이닉스 봉사활동'), { category: '기타', importance: 'LOW' });
  assert.equal(outletTier('연합뉴스'), 'WIRE_BIZ');
  assert.equal(outletTier('어느블로그'), 'GENERAL');
  assert.equal(outletTier('매일경제 마켓'), 'WIRE_BIZ');
  assert.equal(outletTier('매일경제신문사'), 'GENERAL');
});

test('similar headlines within 48 hours become one story; repeats count once', () => {
  const stories = clusterNews([
    item('SK하이닉스, 3분기 영업이익 11조 사상 최대', '2026-10-05T01:00:00Z', '어느매체', 'https://a.kr/1'),
    item('[속보] SK하이닉스 3분기 영업이익 11조…사상 최대', '2026-10-05T01:05:00Z', '연합뉴스', 'https://yna.co.kr/1'),
    item('SK하이닉스 3분기 영업이익 11조 사상최대 실적', '2026-10-05T02:00:00Z', '뉴스1', 'https://news1.kr/1'),
    item('SK하이닉스 3분기 영업이익 11조 사상최대 실적', '2026-10-05T02:00:00Z', '뉴스1', 'https://news1.kr/1'),
    item('SK하이닉스, 용인 클러스터 착공', '2026-10-05T03:00:00Z', '전자신문', 'https://etnews.com/1'),
    item('SK하이닉스 3분기 영업이익 11조 사상 최대', '2026-10-09T01:00:00Z', '연합뉴스', 'https://yna.co.kr/2'),
  ], SK);
  assert.equal(stories.length, 3);
  const earnings = stories.find((st) => st.articles.length === 3)!;
  assert.equal(earnings.category, '실적');
  assert.equal(earnings.articles.length, 3);
  // The representative comes from a wire/business outlet, not the first unknown one.
  assert.equal(earnings.publisher, '연합뉴스');
  assert.equal(earnings.firstAt, '2026-10-05T01:00:00Z');
});

test('stored domain-like outlet names are shown as outlet names', () => {
  const [story] = clusterNews([item('SK하이닉스 단독 소식', '2026-10-05T01:00:00Z', 'g-enews.com', 'https://g.kr/1')]);
  assert.equal(story?.publisher, '글로벌이코노믹');
  assert.equal(clusterNews([item('SK하이닉스 다른 소식', '2026-10-05T01:00:00Z', 'Chosunbiz', 'https://c.kr/1')])[0]?.publisher, '조선비즈');
});
