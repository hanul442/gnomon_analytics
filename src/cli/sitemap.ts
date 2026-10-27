// G-302: sitemap.xml for search engines (Google Search Console, Naver Search Advisor). Lists the public pages
// the site build wrote: every stock's live page, the all-stock pages (s/, u/, c/), in-app issue pages and the main
// screens. Dated archive pages (reports/) and private screens are left out. A project page on GitHub Pages cannot
// own /robots.txt, so the sitemap is submitted by hand in each search console.

import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Signed-in or personal screens, payment, test fixtures and the error page are not for search.
const SKIP = /fixture|preview|^(509op|account|alerts|archive|checkout|inbox|issues|login|mydebates|myreports|onboarding|ops|paper|pricing|profile|settings|survey|watch)\.html$/;
const MAX = 50_000;

export async function writeSitemap(siteDir: string, siteUrl: string, now: Date): Promise<number> {
  if (!/^https:\/\//.test(siteUrl)) return 0;
  const base = siteUrl.replace(/\/?$/, '/'), day = now.toISOString().slice(0, 10), out: string[] = [];
  const list = async (dir: string) => (await readdir(join(siteDir, dir), { withFileTypes: true }).catch(() => []));
  for (const e of await list('')) {
    if (e.isFile() && e.name.endsWith('.html') && !SKIP.test(e.name)) out.push(e.name === 'index.html' ? '' : e.name);
    if (!e.isDirectory() || e.name === 'assets' || e.name.startsWith('.')) continue;
    if (['s', 'u', 'c', 'issue'].includes(e.name)) { for (const f of await list(e.name)) if (f.isFile() && f.name.endsWith('.html')) out.push(`${e.name}/${f.name}`); continue; }
    if ((await list(e.name)).some((f) => f.isFile() && f.name === 'index.html')) out.push(`${e.name}/index.html`);
  }
  const urls = [...new Set(out)].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b))).slice(0, MAX);
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(base + encodeURI(u))}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  await writeFile(join(siteDir, 'sitemap.xml'), xml);
  return urls.length;
}
