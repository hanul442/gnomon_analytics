// Append-only JSONL log. A record is identified by a key; re-fetching an
// identical record adds nothing, and a changed record is appended as a new
// version instead of overwriting the old one. Readers choose the latest
// version that was known at their cutoff.

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface Versioned {
  retrievedAt: string;
}

/** Stable JSON for content comparison: sorted keys, retrievedAt ignored. */
function contentOf(record: object): string {
  const { retrievedAt: _ignored, ...rest } = record as Record<string, unknown>;
  return JSON.stringify(rest, (_key, value: unknown) =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : value);
}

export async function readLog<T>(path: string): Promise<T[]> {
  let body: string;
  try {
    body = await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return body.split('\n').filter((line) => line.trim()).map((line, index) => {
    try {
      return JSON.parse(line) as T;
    } catch {
      throw new Error(`CORRUPT_LOG_LINE:${path}:${index + 1}`);
    }
  });
}

/** Appends records whose content differs from the latest stored version of their key. */
export async function appendNew<T extends Versioned>(path: string, incoming: readonly T[], keyOf: (record: T) => string): Promise<T[]> {
  const latest = new Map<string, string>();
  for (const record of await readLog<T>(path)) latest.set(keyOf(record), contentOf(record));
  const added: T[] = [];
  for (const record of incoming) {
    const key = keyOf(record);
    const content = contentOf(record);
    if (latest.get(key) === content) continue;
    latest.set(key, content);
    added.push(record);
  }
  if (added.length) {
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, added.map((record) => `${JSON.stringify(record)}\n`).join(''), 'utf8');
  }
  return added;
}

/** Latest version of each key retrieved at or before `cutoff`. */
export function asOf<T extends Versioned>(records: readonly T[], keyOf: (record: T) => string, cutoff: Date): T[] {
  const result = new Map<string, T>();
  for (const record of records) {
    const at = Date.parse(record.retrievedAt);
    if (!Number.isFinite(at)) throw new Error('INVALID_RETRIEVED_AT');
    if (at > cutoff.getTime()) continue;
    const key = keyOf(record);
    const current = result.get(key);
    if (!current || Date.parse(current.retrievedAt) <= at) result.set(key, record);
  }
  return [...result.values()];
}
