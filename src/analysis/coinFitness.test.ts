import assert from 'node:assert/strict';
import test from 'node:test';
import { coinFitness, wonWords } from './coinFitness.js';
import { matchPaprika, parsePaprikaTickers } from '../sources/coinpaprika.js';
import { parseUpbitMarkets } from '../sources/upbit.js';
import { coinFitnessCard } from '../report/coinFitness.js';

const TICKERS = [
  { id: 'btc-bitcoin', name: 'Bitcoin', symbol: 'BTC', rank: 1, total_supply: 20_100_966, max_supply: 21_000_000, first_data_at: '2010-07-17T00:00:00Z', quotes: { USD: { price: 81_446, market_cap: 1_637_155_066_957, ath_price: 126_173, ath_date: '2025-10-06T19:00:40Z' } } },
  { id: 'puffer-puffer', name: 'Puffer', symbol: 'PUFFER', rank: 893, total_supply: 1e9, max_supply: 1e9, first_data_at: '2025-02-04T00:00:00Z', quotes: { USD: { price: 0.042, market_cap: 7_489_297, ath_price: 0.491, ath_date: '2025-02-05T07:38:05Z' } } },
  { id: 'ai-other', name: 'Other AI', symbol: 'AI', rank: 500, total_supply: 1e6, max_supply: 0, quotes: { USD: { price: 3 } } },
  { id: 'bad', symbol: 'X', quotes: { USD: { price: 0 } } },
];

test('G-273: CoinPaprika tickers parse; a coin is matched by symbol and price, not by symbol alone', () => {
  const list = parsePaprikaTickers(TICKERS);
  assert.deepEqual(list.map((c) => c.id), ['btc-bitcoin', 'puffer-puffer', 'ai-other']);
  assert.equal(list[2]!.maxSupply, null);
  assert.equal(matchPaprika(list, 'BTC', 109_061_000, 1337)?.id, 'btc-bitcoin');
  // Upbit's AI trades near 100원; the AI on CoinPaprika is 3 dollars: a different coin.
  assert.equal(matchPaprika(list, 'AI', 100, 1337), null);
  assert.equal(matchPaprika(list, 'BTC', 109_061_000, null), null);
  assert.deepEqual(parsePaprikaTickers({ error: 1 }), []);
});

test('G-273: five axes from stated thresholds; a missing source leaves its axis out of the mean', () => {
  const [btc, puffer] = parsePaprikaTickers(TICKERS);
  const b = coinFitness({ date: '2026-10-20', upbitPrice: 109_061_000, value24hKrw: 670e8, usdtKrw: 1337, paprika: btc!, history: null, upbitFirst: '2025-09-15', listed: false });
  assert.deepEqual(b.axes.map((a) => [a.key, a.score]), [['size', 100], ['liquidity', 71], ['supply', 96], ['gap', 99], ['age', 100]]);
  assert.equal(b.axes[0]!.value, '시가총액 약 2,189조 원');
  assert.equal(b.timeline.map((t) => t.text).join('|'), '해외 거래소에서 첫 거래|역대 최고가 (지금의 약 1.5배)');
  const p = coinFitness({ date: '2026-10-20', upbitPrice: 56.2, value24hKrw: 178e8, usdtKrw: 1337, paprika: puffer!, upbitFirst: '2026-10-15', listed: true,
    history: { source: 'bithumb', upbitSince: '2026-10-15', added: 394, ratio: 1, premiumPct: null, trimmed: true }, cautions: ['거래량 급등'] });
  assert.deepEqual(p.axes.map((a) => a.score), [20, 56, 100, 99, 34]);
  assert.equal(p.axes[4]!.value, '거래 1년 8개월 · 업비트 6일');
  assert.equal(p.timeline.at(-1)!.text, '업비트 원화 마켓 상장');
  assert.match(p.historyNote, /394일은 빗썸 가격을/);
  const none = coinFitness({ date: '2026-10-20', upbitPrice: 10, value24hKrw: 5e8, usdtKrw: 1337, paprika: null, history: null, upbitFirst: '2026-10-01', listed: true });
  assert.deepEqual(none.axes.map((a) => a.score), [null, 17, null, null, null]);
  assert.equal(none.total, 17);
  assert.equal(none.axes[4]!.value, '업비트 20일');
  const html = coinFitnessCard(p);
  assert.match(html, /코인 체력 한눈에/);
  assert.match(html, /cf-chip on">거래량 급등 · 켜짐/);
  assert.match(html, /5개 중 1개 켜짐/);
  assert.equal(wonWords(1.78e10), '178억 원');
});

test('G-273: Upbit caution flags come with the market list', () => {
  const [m] = parseUpbitMarkets([{ market: 'KRW-PUFFER', korean_name: '퍼퍼', market_event: { warning: false, caution: { PRICE_FLUCTUATIONS: true, TRADING_VOLUME_SOARING: false, GLOBAL_PRICE_DIFFERENCES: true } } }]);
  assert.deepEqual(m!.cautions, ['가격 급등락', '해외 가격 차이']);
});
