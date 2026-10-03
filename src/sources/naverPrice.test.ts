import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNaverDailyChart } from './naverPrice.js';

const AT = new Date('2026-10-02T09:30:00Z');
const FEED = `<?xml version="1.0" encoding="EUC-KR" ?>
<protocol><chartdata symbol="000660" name="SK" count="3" timeframe="day" precision="0" origintime="19960625">
<item data="20260930|305000|310000|303500|309000|2800000" />
<item data="20261001|309000|314000|308000|311000|0" />
<item data="20261002|312000|320500|311000|318500|3512880" />
<item data="20261003|0|0|0|318500|0" />
<item data="20260231|1|1|1|1|1" />
</chartdata></protocol>`;

test('parses daily bars and drops halted or impossible days', () => {
  const bars = parseNaverDailyChart(FEED, '000660', AT);
  assert.deepEqual(bars.map((b) => [b.date, b.close, b.volume]), [
    ['2026-09-30', 309000, 2800000], ['2026-10-01', 311000, 0], ['2026-10-02', 318500, 3512880],
  ]);
  assert.equal(bars[2]?.retrievedAt, '2026-10-02T09:30:00.000Z');
});

test('a response that is not the chart feed is an error, not an empty history', () => {
  assert.throws(() => parseNaverDailyChart('<html>blocked</html>', '000660', AT), /NAVER_UNEXPECTED_RESPONSE/);
  assert.deepEqual(parseNaverDailyChart('<chartdata></chartdata>', '000660', AT), []);
});
