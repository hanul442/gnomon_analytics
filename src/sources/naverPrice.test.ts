import assert from 'node:assert/strict';
import test from 'node:test';
import { NAVER_WEEK_SOURCE, parseNaverDailyChart, parseNaverMinuteCandles, parseNaverMinuteChart } from './naverPrice.js';

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

test('minute feed: regular session only, one record per day', async () => {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const body = await readFile(join(process.cwd(), 'test', 'fixtures', 'naver', 'minute.xml'), 'latin1');
  const days = parseNaverMinuteChart(body, '000660', new Date('2026-10-04T05:37:00Z'));
  assert.deepEqual(days.map((d) => d.date), ['2026-10-01', '2026-10-02']);
  const day = days[1]!;
  assert.equal(day.times[0], '09:00');
  assert.equal(day.times.at(-1), '15:30');
  assert.ok(day.times.every((t) => t >= '09:00' && t <= '15:30'));
  assert.equal(day.closes.length, day.times.length);
  assert.ok(day.cumVolumes.every((v, i) => i === 0 || v >= day.cumVolumes[i - 1]!));
});

test('week and index feeds parse as bars', async () => {
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), 'test', 'fixtures', 'naver');
  const weeks = parseNaverDailyChart(await readFile(join(dir, 'week.xml'), 'latin1'), '000660', new Date(), NAVER_WEEK_SOURCE);
  assert.equal(weeks.length, 260);
  assert.equal(weeks.at(-1)!.close, 1842000);
  assert.equal(weeks[0]!.source, 'naver:fchart:week');
  const kospi = parseNaverDailyChart(await readFile(join(dir, 'kospi.xml'), 'latin1'), 'KOSPI', new Date());
  assert.equal(kospi.at(-1)!.close, 7003.74);
});

test('minute candles: N-minute buckets from minute closes, volume from the cumulative count, regular session only', () => {
  const feed = `<chartdata symbol="005930" timeframe="minute">
<item data="202610060850|null|null|null|100|10" />
<item data="202610060900|null|null|null|100|100" />
<item data="202610060901|null|null|null|104|150" />
<item data="202610060904|null|null|null|98|180" />
<item data="202610060905|null|null|null|101|200" />
<item data="202610070900|null|null|null|110|30" />
</chartdata>`;
  const five = parseNaverMinuteCandles(feed, 5);
  assert.deepEqual(five.map((c) => [new Date(c.time * 1000).toISOString(), c.open, c.high, c.low, c.close, c.volume]), [
    ['2026-10-06T00:00:00.000Z', 100, 104, 98, 98, 180],
    ['2026-10-06T00:05:00.000Z', 101, 101, 101, 101, 20],
    ['2026-10-07T00:00:00.000Z', 110, 110, 110, 110, 30],
  ]);
  assert.equal(parseNaverMinuteCandles(feed, 1).length, 5);
  assert.throws(() => parseNaverMinuteCandles('<html>blocked</html>', 1), /NAVER_UNEXPECTED_RESPONSE/);
});
