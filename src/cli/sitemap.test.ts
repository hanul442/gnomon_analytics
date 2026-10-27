import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSitemap } from './sitemap.js';
import { seoMeta } from '../report/alpha.js';

test('G-302: the sitemap lists public pages and leaves out personal screens, fixtures and dated archives', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gnm-sitemap-'));
  for (const d of ['005930', '005930/reports', 's', 'issue', 'assets']) await mkdir(join(dir, d), { recursive: true });
  for (const f of ['index.html', 'scorecard.html', 'settings.html', 'debate-fixture.html', '005930/index.html', '005930/reports/2026-10-24.html', '005930/archive.html', 's/000020.html', 's/000020.json', 'issue/abc.html', 'assets/x.html']) await writeFile(join(dir, f), '');
  assert.equal(await writeSitemap(dir, '', new Date()), 0);
  assert.equal(await writeSitemap(dir, 'https://example.github.io/app', new Date('2026-10-27T00:00:00Z')), 5);
  const xml = await readFile(join(dir, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, ['https://example.github.io/app/', 'https://example.github.io/app/005930/index.html', 'https://example.github.io/app/issue/abc.html', 'https://example.github.io/app/s/000020.html', 'https://example.github.io/app/scorecard.html']);
  assert.match(xml, /<lastmod>2026-10-27<\/lastmod>/);
});

test('G-302: pages carry a description and link-preview tags, escaped', () => {
  const m = seoMeta('A & "B"', '설명 <b>');
  assert.match(m, /<meta name="description" content="설명 &lt;b>">/);
  assert.match(m, /og:title" content="A &amp; &quot;B&quot;"/);
});
