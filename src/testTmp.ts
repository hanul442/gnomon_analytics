// Temporary directories for tests, removed when the test process exits (tests used to leave thousands behind).
import { mkdtemp } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const made: string[] = [];
process.on('exit', () => { for (const d of made) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } } });

export async function tempDir(prefix = 'gnm-'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}
