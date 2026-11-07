import assert from 'node:assert/strict';
import test from 'node:test';
import { krxCloseUrl, nxtClosedDate, parseKrxClose, parseNaverQuotes, quoteUrl, withKrxClose } from './naverQuote.js';

test('naver quotes: price, signed change from the direction code, market status (G-62)', () => {
  const q = parseNaverQuotes({ datas: [
    { itemCode: '005930', closePrice: '71,000', compareToPreviousClosePrice: '500', compareToPreviousPrice: { code: '2', name: 'RISING' }, fluctuationsRatio: '0.71', marketStatus: 'OPEN', localTradedAt: '2026-10-06T10:01:00+09:00' },
    { itemCode: '000660', closePrice: '1,789,000', compareToPreviousClosePrice: '-53,000', compareToPreviousPrice: { code: '5', name: 'FALLING' }, fluctuationsRatio: '-2.88', marketStatus: 'CLOSE' },
    { itemCode: 'bad', closePrice: '1' }, { itemCode: '111110', closePrice: '-' },
  ] });
  assert.deepEqual(q.map((x) => [x.symbol, x.price, x.change, x.changePct, x.open]), [['005930', 71000, 500, 0.71, true], ['000660', 1789000, -53000, -2.88, false]]);
  assert.deepEqual(parseNaverQuotes(null), []);
  // After 15:30 a stock that trades on Nextrade shows the NXT price, not the KRX close (G-128).
  const nxt = parseNaverQuotes({ datas: [{ itemCode: '005930', closePrice: '263,000', compareToPreviousClosePrice: '-5,500', compareToPreviousPrice: { code: '5', name: 'FALLING' }, fluctuationsRatio: '-2.05', marketStatus: 'OPEN', marketSessionType: 'afterMarket', localTradedAt: '2026-10-08T19:54:44+09:00',
    overMarketPriceInfo: { tradingSessionType: 'AFTER_MARKET', overMarketStatus: 'OPEN', overPrice: '262,500', compareToPreviousPrice: { code: '5', name: 'FALLING' }, compareToPreviousClosePrice: '-6,000', fluctuationsRatio: '-2.23', localTradedAt: '2026-10-08T19:54:44+09:00' } }] });
  assert.deepEqual(nxt.map((x) => [x.price, x.change, x.changePct, x.open, x.session]), [[262500, -6000, -2.23, true, 'after']]);
  // Without Nextrade (most ETFs) the KRX close stands after hours.
  assert.equal(parseNaverQuotes({ datas: [{ itemCode: '069500', closePrice: '105,650', marketStatus: 'CLOSE', marketSessionType: 'regularMarket', overMarketPriceInfo: null }] })[0]!.session, 'closed');
  assert.equal(quoteUrl(['005930', '000660']), 'https://polling.finance.naver.com/api/realtime/domestic/stock/005930,000660');
});

test('closed NXT stock: the 15:30 KRX close replaces the 20:00 Nextrade close (evaluation 11/7)', () => {
  const [q] = parseNaverQuotes({ datas: [{ itemCode: '005930', closePrice: '193,500', compareToPreviousClosePrice: '-8,000', compareToPreviousPrice: { code: '5', name: 'FALLING' }, fluctuationsRatio: '-3.97', marketStatus: 'CLOSE', localTradedAt: '2026-11-06T20:00:00+09:00',
    overMarketPriceInfo: { tradingSessionType: 'AFTER_MARKET', overMarketStatus: 'CLOSE', overPrice: '193,400' } }] });
  assert.equal(nxtClosedDate(q!), '2026-11-06');
  assert.equal(krxCloseUrl('005930', '2026-11-06'), 'https://api.stock.naver.com/chart/domestic/item/005930/minute?startDateTime=202611061529&endDateTime=202611061531');
  const krx = parseKrxClose([{ localDateTime: '20261106152900', currentPrice: 189000 }, { localDateTime: '20261106153000', currentPrice: 188700 }]);
  assert.equal(krx, 188700);
  const fixed = withKrxClose(q!, krx!, '2026-11-06');
  assert.deepEqual([fixed.price, fixed.change, fixed.changePct, fixed.open, fixed.at], [188700, -12800, -6.35, false, '2026-11-06T15:30:00+09:00']);
  // A KRX-only stock (last trade 15:30) and an open quote need nothing.
  assert.equal(nxtClosedDate({ ...q!, at: '2026-11-06T15:30:00+09:00' }), null);
  assert.equal(nxtClosedDate({ ...q!, session: 'after', open: true }), null);
  assert.equal(parseKrxClose([]), null);
});
