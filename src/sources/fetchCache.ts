// Site-only runs: a merge rebuilds the site from the answers the last full run got, instead of asking Naver,
// DART, Upbit and the rest again (#150: a merge-heavy day ran the whole collection 12-14 times).
// The full run records every successful GET; a push run replays them and goes to the network only for a miss.
// Files are named by a hash of the URL, so keys in query strings never show up in a file name.
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface Meta { url: string; status: number; contentType: string | null }

const keyOf = (url: string) => createHash('sha256').update(url).digest('hex').slice(0, 40);
const urlOf = (input: RequestInfo | URL) => (typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
const methodOf = (input: RequestInfo | URL, init?: RequestInit) => (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

/** Saves each successful GET's body under `dir` and hands back an equivalent response. */
export function recordingFetch(base: typeof fetch, dir: string): typeof fetch {
  let ready: Promise<unknown> | null = null;
  return async (input, init) => {
    const response = await base(input, init);
    if (methodOf(input, init) !== 'GET' || response.status !== 200) return response;
    const body = Buffer.from(await response.arrayBuffer());
    const url = urlOf(input), key = keyOf(url);
    ready ??= mkdir(dir, { recursive: true });
    await ready;
    const meta: Meta = { url, status: response.status, contentType: response.headers.get('content-type') };
    await writeFile(join(dir, `${key}.body`), body);
    await writeFile(join(dir, `${key}.json`), JSON.stringify(meta));
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}

/** Answers a GET from `dir` when a recording no older than `maxAgeMs` exists; anything else goes to `base`. */
export function replayingFetch(base: typeof fetch, dir: string, maxAgeMs: number, now = () => Date.now()): typeof fetch {
  return async (input, init) => {
    if (methodOf(input, init) !== 'GET') return base(input, init);
    const url = urlOf(input), key = keyOf(url);
    try {
      const metaPath = join(dir, `${key}.json`);
      if (now() - (await stat(metaPath)).mtimeMs > maxAgeMs) return base(input, init);
      const meta = JSON.parse(await readFile(metaPath, 'utf8')) as Meta;
      if (meta.url !== url) return base(input, init);
      const body = await readFile(join(dir, `${key}.body`));
      return new Response(body, { status: meta.status, headers: meta.contentType ? { 'content-type': meta.contentType } : {} });
    } catch {
      return base(input, init);
    }
  };
}
