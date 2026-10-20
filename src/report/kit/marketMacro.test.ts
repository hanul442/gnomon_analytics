import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { macroCards } from '../../cli/marketReports.js';
import { macroStat } from '../marketReport.js';

test('G-265: macro cards carry the last 30 points and a 20-session move', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-macro-'));
  await mkdir(join(root, 'data', 'macro'), { recursive: true });
  const rows = Array.from({ length: 40 }, (_, i) => JSON.stringify({ series: 'DGS10', date: `2026-09-${String(i % 30 + 1).padStart(2, '0')}`.replace(/-09-(\d+)$/, (_m, d) => (i < 30 ? `-09-${d}` : `-10-${String(i - 29).padStart(2, '0')}`)), value: 4 + i / 100, source: 't', retrievedAt: 't' }));
  await writeFile(join(root, 'data', 'macro', 'DGS10.jsonl'), rows.join('\n') + '\n');
  const { macro } = await macroCards(root, '2026-10-31');
  assert.equal(macro?.length, 1);
  assert.equal(macro![0]!.spark.length, 30);
  assert.ok(Math.abs(macro![0]!.chg20! - 0.2) < 1e-9);
  const html = macroStat(macro![0]!);
  assert.match(html, /km-stat-line/);
  assert.match(html, /▲ 20bp/);
  assert.doesNotMatch(html, /km-sa-f/);
});

test('G-265: no macro files, no macro cards', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gnm-macro-'));
  assert.deepEqual(await macroCards(root, '2026-10-31'), {});
});
