import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { appendNew, asOf, readLog } from './jsonlLog.js';

type Rec = { key: string; value: number; retrievedAt: string };
const keyOf = (r: Rec) => r.key;

test('identical re-fetches add nothing; changes are appended, never overwritten', async () => {
  const path = join(await mkdtemp(join(tmpdir(), 'gnm-')), 'log.jsonl');
  assert.equal((await appendNew<Rec>(path, [{ key: 'a', value: 1, retrievedAt: '2026-10-01T00:00:00Z' }], keyOf)).length, 1);
  assert.equal((await appendNew<Rec>(path, [{ key: 'a', value: 1, retrievedAt: '2026-10-02T00:00:00Z' }], keyOf)).length, 0);
  assert.equal((await appendNew<Rec>(path, [{ key: 'a', value: 2, retrievedAt: '2026-10-03T00:00:00Z' }], keyOf)).length, 1);
  const all = await readLog<Rec>(path);
  assert.deepEqual(all.map((r) => r.value), [1, 2]);
  assert.deepEqual(asOf(all, keyOf, new Date('2026-10-02T12:00:00Z')).map((r) => r.value), [1]);
  assert.deepEqual(asOf(all, keyOf, new Date('2026-10-03T12:00:00Z')).map((r) => r.value), [2]);
  assert.deepEqual(asOf(all, keyOf, new Date('2026-09-30T00:00:00Z')), []);
});

test('missing log is empty; a corrupt line is an error', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gnm-'));
  assert.deepEqual(await readLog(join(dir, 'none.jsonl')), []);
  await writeFile(join(dir, 'bad.jsonl'), '{"ok":1}\n{oops\n');
  await assert.rejects(readLog(join(dir, 'bad.jsonl')), /CORRUPT_LOG_LINE:.*:2/);
  assert.equal(await readFile(join(dir, 'bad.jsonl'), 'utf8'), '{"ok":1}\n{oops\n');
});
