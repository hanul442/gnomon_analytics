import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempDir } from '../testTmp.js';
import { updateContest } from './contest.js';

test('contest log: one decision per settled session, kept as made; the season files and index', async () => {
  const root = await tempDir(), site = join(root, 'site');
  await mkdir(join(root, 'data', 'analysts'), { recursive: true }); await mkdir(join(root, 'data', 'prices'), { recursive: true }); await mkdir(join(site, 's'), { recursive: true });
  const bar = (date: string, close: number) => JSON.stringify({ symbol: '000660', date, close });
  await writeFile(join(root, 'data', 'prices', '000660.jsonl'), [bar('2026-10-29', 100), bar('2026-10-30', 101)].join('\n') + '\n');
  await writeFile(join(root, 'data', 'analysts', '000660.jsonl'), JSON.stringify({ symbol: '000660', analyst: 'trend_momentum', reportDate: '2026-10-30', baseDate: '2026-10-30', baseClose: 101, stance: 'BULLISH', confidence: 70, target: 110, promptVersion: 'x', madeAt: '2026-10-30T10:00:00Z' }) + '\n');
  // 17:00 KST on the 30th: not settled yet, nothing logged.
  let idx = await updateContest(root, site, new Date('2026-10-30T08:00:00Z'), new Map([['000660', 'SK하이닉스']]));
  assert.equal(idx.asOf, null);
  idx = await updateContest(root, site, new Date('2026-10-30T10:00:00Z'), new Map([['000660', 'SK하이닉스']]));
  assert.equal(idx.asOf, '2026-10-30');
  assert.deepEqual(idx.target, ['000660']);
  assert.equal(idx.live[0]!.upPct, 70);
  // Monday's bars arrive through the stock page (an uncovered stock); a rerun does not log the 30th again.
  await writeFile(join(site, 's', '000660.json'), JSON.stringify({ bars: [['2026-11-02', 1, 1, 1, 105, 1]] }));
  idx = await updateContest(root, site, new Date('2026-11-02T10:00:00Z'), new Map());
  assert.equal(idx.current, '2026-11');
  assert.deepEqual(idx.seasons, ['2026-10', '2026-11']);
  const log = (await readFile(join(root, 'data', 'contest', 'committee.jsonl'), 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(log.map((e) => e.date), ['2026-10-30', '2026-11-02']);
  const nov = JSON.parse(await readFile(join(site, 'contest', '2026-11.json'), 'utf8'));
  assert.deepEqual(nov.sessions, ['2026-11-02']);
  assert.deepEqual(nov.closes['000660'], [105]);
  assert.equal(nov.names['000660'], 'SK하이닉스');
  assert.equal(JSON.parse(await readFile(join(site, 'contest', '2026-10.json'), 'utf8')).closed, true);
});
