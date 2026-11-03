import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { AiBudget } from './aiBudget.js';
import { fillBudgetSkipped } from './daily.js';
import { tempDir } from '../testTmp.js';

// A real report whose committee was skipped by the October budget (PANW.O, 10/26): US, so no DART call.
const source = join(process.cwd(), 'reports', 'PANW.O', '2026-10-26.json');

test('fillBudgetSkipped only touches reports the monthly budget skipped, and respects the budget', async (t) => {
  const original = JSON.parse(await readFile(source, 'utf8'));
  if (original.commentary?.status !== 'SKIPPED') return t.skip('fixture report already filled');
  const root = await tempDir('fill-');
  const put = async (sym: string, body: unknown) => { await mkdir(join(root, 'reports', sym), { recursive: true }); await writeFile(join(root, 'reports', sym, '2026-10-26.json'), JSON.stringify(body)); };
  await put('PANW.O', original);
  await put('OTHER', { ...original, symbol: 'OTHER', commentary: { ...original.commentary, error: 'NO_EVIDENCE' } });
  await put('DONE', { ...original, symbol: 'DONE', commentary: { ...original.commentary, status: 'OK' } });
  const now = new Date('2026-10-28T08:00:00Z');

  // No API key: the committee is still skipped, so the stored report stays as it was.
  const noKey = await fillBudgetSkipped(root, '2026-10-26', new AiBudget(root, '2026-10', 35, 0), { now, apiKey: '' });
  assert.deepEqual(noKey, { 'PANW.O': 'SKIPPED' });
  assert.equal(JSON.parse(await readFile(join(root, 'reports', 'PANW.O', '2026-10-26.json'), 'utf8')).commentary.error, original.commentary.error);

  // A spent budget never calls the model.
  const spent = await fillBudgetSkipped(root, '2026-10-26', new AiBudget(root, '2026-10', 35, 35), { now, apiKey: '' });
  assert.deepEqual(spent, { 'PANW.O': 'BUDGET' });

  await assert.rejects(fillBudgetSkipped(root, '10/26', new AiBudget(root, '2026-10', 35, 0), { now, apiKey: '' }), /YYYY-MM-DD/);
});
