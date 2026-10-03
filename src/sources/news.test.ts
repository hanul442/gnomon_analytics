import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalUrl, decodeFeed, fetchNaverNews, outletFromUrl, parseNaverNews, parseRss, plainText } from './news.js';

const AT = new Date('2026-10-05T09:30:00Z');

test('plain text strips tags and decodes entities', () => {
  assert.equal(plainText('<b>SK하이닉스</b>, &quot;HBM4&quot; 공급 &amp; 증설 &#39;속도&#39; &#x2026;'), 'SK하이닉스, "HBM4" 공급 & 증설 \'속도\' …');
  assert.equal(plainText('<![CDATA[ SK하이닉스 <b>신고가</b> ]]>'), 'SK하이닉스 신고가');
});

test('canonical URLs drop tracking and normalize', () => {
  assert.equal(canonicalUrl('http://WWW.Hankyung.com/article/1?utm_source=naver&id=2#top'), 'https://www.hankyung.com/article/1?id=2');
  assert.equal(canonicalUrl('javascript:alert(1)'), null);
  assert.equal(outletFromUrl('https://www.hankyung.com/article/1'), '한국경제');
  assert.equal(outletFromUrl('https://biz.chosun.com/x'), '조선비즈');
  assert.equal(outletFromUrl('https://www.unknown-news.kr/x'), 'unknown-news.kr');
});

// Shape of the Naver news search API response.
const NAVER = {
  lastBuildDate: 'Mon, 05 Oct 2026 18:30:00 +0900', total: 2, start: 1, display: 2,
  items: [
    { title: '<b>SK하이닉스</b>, 3분기 영업이익 &quot;사상 최대&quot;', originallink: 'https://www.yna.co.kr/view/AKR1?input=1195m', link: 'https://n.news.naver.com/mnews/article/001/1', description: '본문 일부', pubDate: 'Mon, 05 Oct 2026 17:10:00 +0900' },
    { title: '<b>하이닉스</b> 관련', originallink: '', link: 'https://n.news.naver.com/mnews/article/009/2', description: '', pubDate: 'bad date' },
  ],
};

test('Naver news keeps headline, outlet, link and time only', () => {
  const items = parseNaverNews(NAVER, AT);
  assert.equal(items.length, 1);
  assert.deepEqual(items[0], {
    url: 'https://www.yna.co.kr/view/AKR1?input=1195m', title: 'SK하이닉스, 3분기 영업이익 "사상 최대"', publisher: '연합뉴스',
    publishedAt: '2026-10-05T08:10:00.000Z', source: 'naver:news-search', retrievedAt: '2026-10-05T09:30:00.000Z',
  });
  assert.ok(!JSON.stringify(items).includes('본문 일부'));
  assert.throws(() => parseNaverNews({ errorMessage: 'Authentication failed', errorCode: '024' }, AT), /NAVER_NEWS_UNEXPECTED_RESPONSE:Authentication failed/);
});

test('Naver fetch sends the key headers and pages until a short page', async () => {
  const seen: { start: string | null; id: string | null }[] = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    seen.push({ start: u.searchParams.get('start'), id: (init?.headers as Record<string, string>)['X-Naver-Client-Id'] ?? null });
    return new Response(JSON.stringify(NAVER));
  }) as typeof fetch;
  await fetchNaverNews({ clientId: 'id', clientSecret: 'secret', query: 'SK하이닉스', fetch: fakeFetch, now: () => AT });
  assert.deepEqual(seen, [{ start: '1', id: 'id' }]);
  await assert.rejects(fetchNaverNews({ clientId: '', clientSecret: 's', query: 'q' }), /NAVER_API_KEY_MISSING/);
  const denied = (async () => new Response('{}', { status: 401 })) as typeof fetch;
  await assert.rejects(fetchNaverNews({ clientId: 'i', clientSecret: 's', query: 'q', fetch: denied }), (e: Error) => e.message === 'NAVER_NEWS_HTTP_401');
});

// Shape of a Google News search RSS item.
const GOOGLE = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>"SK하이닉스" - Google 뉴스</title>
<item><title>SK하이닉스, HBM4 양산 돌입 - 전자신문</title><link>https://news.google.com/rss/articles/CBMi?oc=5</link>
<pubDate>Mon, 05 Oct 2026 06:00:00 GMT</pubDate><description>&lt;a href="x"&gt;...&lt;/a&gt;</description><source url="https://www.etnews.com">전자신문</source></item>
<item><title>링크 없는 항목</title><pubDate>Mon, 05 Oct 2026 06:00:00 GMT</pubDate></item>
</channel></rss>`;

test('RSS items drop the " - 언론사" suffix and use <source> as the outlet', () => {
  const items = parseRss(GOOGLE, 'google:news-rss', AT);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.title, 'SK하이닉스, HBM4 양산 돌입');
  assert.equal(items[0]?.publisher, '전자신문');
  assert.equal(items[0]?.publishedAt, '2026-10-05T06:00:00.000Z');
  assert.throws(() => parseRss('<html>blocked</html>', 'x', AT), /RSS_UNEXPECTED_RESPONSE/);
});

test('EUC-KR feeds are decoded by their declared charset', () => {
  const xml = '<?xml version="1.0" encoding="euc-kr"?><rss><channel><item><title>하이닉스</title></item></channel></rss>';
  // "하이닉스" in EUC-KR
  const euc = new Uint8Array([...Buffer.from('<?xml version="1.0" encoding="euc-kr"?><rss><channel><item><title>', 'latin1'), 0xc7, 0xcf, 0xc0, 0xcc, 0xb4, 0xd0, 0xbd, 0xba, ...Buffer.from('</title></item></channel></rss>', 'latin1')]);
  assert.equal(decodeFeed(euc, 'text/xml'), xml);
  assert.equal(decodeFeed(new TextEncoder().encode('<rss>가</rss>'), 'application/rss+xml; charset=UTF-8'), '<rss>가</rss>');
});

test('Naver paging continues when a full page had a malformed row', async () => {
  const full = { items: Array.from({ length: 100 }, (_, i) => ({ title: `SK하이닉스 ${i}`, originallink: i === 0 ? 'not a url' : `https://www.yna.co.kr/${i}`, pubDate: 'Mon, 05 Oct 2026 17:10:00 +0900' })) };
  const starts: string[] = [];
  const fakeFetch = (async (url: string | URL | Request) => {
    const start = new URL(String(url)).searchParams.get('start')!;
    starts.push(start);
    return new Response(JSON.stringify(start === '1' ? full : { items: [] }));
  }) as typeof fetch;
  const items = await fetchNaverNews({ clientId: 'i', clientSecret: 's', query: 'q', fetch: fakeFetch, now: () => AT });
  assert.equal(items.length, 99);
  assert.deepEqual(starts, ['1', '101']);
});
