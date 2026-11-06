import assert from 'node:assert/strict';
import test from 'node:test';
import { NAVER_WEEK_SOURCE, parseNaverDailyChart, parseNaverMinuteCandles, parseNaverMinuteChart, withKrxCloses } from './naverPrice.js';

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

test('KRX close (11/6): the 15:30 minute print replaces the day feed close, which carries NXT after-hours trades', () => {
  const at = new Date('2026-11-06T12:00:00Z');
  const day = parseNaverDailyChart('<chartdata><item data="20261104|1458000|1476000|1303000|1420000|4591188" /><item data="20261105|1320000|1320000|1250000|1262000|4281006" /><item data="20261106|1089000|1217000|1089000|1155000|7550170" /></chartdata>', '000660', at);
  const minute = parseNaverMinuteChart('<chartdata><item data="202611051529|null|null|null|1263000|4100000" /><item data="202611051530|null|null|null|1264000|4112091" /><item data="202611051600|null|null|null|1267000|4117240" /><item data="202611061420|null|null|null|1140000|7000000" /></chartdata>', '000660', at);
  const fixed = withKrxCloses(day, minute);
  assert.deepEqual(fixed.map((b) => b.close), [1420000, 1264000, 1155000], 'only a day whose session reached 15:30 changes');
  assert.equal(fixed[1]!.high, 1320000);
});
