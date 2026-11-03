// G-309: makes the day's SNS cards (PNG) and captions under promo/<date>/, and the site/promo/ page that lists them.
//   node dist/cli/promo.js            render today's cards if missing, then build site/promo/
//   node dist/cli/promo.js --need     exit 0 when today's cards still need rendering (the workflow installs Chromium only then)
//   node dist/cli/promo.js --site     only rebuild site/promo/ from promo/ (no browser)
//   --date=YYYY-MM-DD picks a market report day; --weekly forces the weekly cards; --force re-renders.

import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { AnalystCall } from '../analysis/analysts.js';
import { asOf, readLog } from '../store/jsonlLog.js';
import { priceKey } from './marketData.js';
import type { PriceBar } from '../types.js';
import { blogText, coverHtml, instaCaption, missHtml, opinionHtml, opinionsOf, promoDay, promoIndexHtml, scoreCalls, storyHtml, xCaption, xHtml, type MarketLike, type PromoCall } from '../report/promoCards.js';

const KEEP_DAYS = 14;
const exists = (p: string) => stat(p).then(() => true, () => false);

async function latestMarketDate(root: string): Promise<string | null> {
  const files = (await readdir(join(root, 'reports', 'market')).catch(() => [] as string[])).filter((f) => /^daily-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  return files.at(-1)?.slice(6, 16) ?? null;
}

async function nameOf(root: string, symbol: string, universe: Map<string, string>): Promise<string> {
  const known = universe.get(symbol);
  if (known) return known;
  const files = (await readdir(join(root, 'reports', symbol)).catch(() => [] as string[])).filter((f) => f.endsWith('.json')).sort();
  for (const f of files.reverse()) {
    const r = JSON.parse(await readFile(join(root, 'reports', symbol, f), 'utf8').catch(() => '{}')) as { name?: string };
    if (r.name) return r.name;
  }
  return symbol;
}

/** Committee calls from `date`'s stock reports, with stock names, for the opinion cards. */
export async function loadDayCalls(root: string, date: string): Promise<(AnalystCall & { name: string })[]> {
  const universe = new Map((JSON.parse(await readFile(join(root, 'data', 'universe', 'stocks.json'), 'utf8').catch(() => '[]')) as { symbol: string; name: string }[]).map((s) => [s.symbol, s.name]));
  const out: (AnalystCall & { name: string })[] = [];
  for (const file of (await readdir(join(root, 'data', 'analysts')).catch(() => [] as string[])).filter((f) => f.endsWith('.jsonl')).sort()) {
    const calls = (await readLog<AnalystCall>(join(root, 'data', 'analysts', file))).filter((c) => c.reportDate === date);
    if (!calls.length) continue;
    const name = await nameOf(root, file.slice(0, -6), universe);
    out.push(...calls.map((c) => ({ ...c, name })));
  }
  return out;
}

export async function loadScoredCalls(root: string, now: Date): Promise<PromoCall[]> {
  const universe = new Map((JSON.parse(await readFile(join(root, 'data', 'universe', 'stocks.json'), 'utf8').catch(() => '[]')) as { symbol: string; name: string }[]).map((s) => [s.symbol, s.name]));
  const out: PromoCall[] = [];
  for (const file of (await readdir(join(root, 'data', 'analysts')).catch(() => [] as string[])).filter((f) => f.endsWith('.jsonl')).sort()) {
    const symbol = file.slice(0, -6);
    const calls = (await readLog<AnalystCall>(join(root, 'data', 'analysts', file))).filter((c) => c.madeAt <= now.toISOString());
    if (!calls.length) continue;
    const bars = asOf(await readLog<PriceBar>(join(root, 'data', 'prices', `${symbol}.jsonl`)).catch(() => [] as PriceBar[]), priceKey, now);
    out.push(...scoreCalls(symbol, await nameOf(root, symbol, universe), calls, bars));
  }
  return out;
}

const isFriday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() === 5;

async function render(cards: { file: string; html: string; w: number; h: number }[], outDir: string): Promise<void> {
  const { chromium } = await import('playwright');
  const tmp = await mkdtemp(join(tmpdir(), 'gnm-promo-'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    for (const c of cards) {
      const html = join(tmp, c.file.replace(/\.png$/, '.html'));
      await writeFile(html, c.html);
      await page.setViewportSize({ width: c.w, height: c.h });
      await page.goto(pathToFileURL(html).href);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: join(outDir, c.file), clip: { x: 0, y: 0, width: c.w, height: c.h } });
    }
  } finally {
    await browser.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

export async function buildPromoSite(root: string): Promise<number> {
  const promo = join(root, 'promo'), site = join(root, 'site', 'promo');
  const dates = (await readdir(promo).catch(() => [] as string[])).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse().slice(0, KEEP_DAYS);
  if (!(await exists(join(root, 'site')))) return 0;
  await rm(site, { recursive: true, force: true });
  await mkdir(site, { recursive: true });
  const days = [];
  for (const date of dates) {
    const files = (await readdir(join(promo, date))).sort();
    await mkdir(join(site, date), { recursive: true });
    for (const f of files) await copyFile(join(promo, date, f), join(site, date, f));
    const cap = async (f: string, label: string) => (files.includes(f) ? [{ label, text: await readFile(join(promo, date, f), 'utf8') }] : []);
    days.push({ date, files: ['story.png', 'x.png', 'opinion1.png', 'opinion2.png', 'cover.png', 'miss.png'].filter((f) => files.includes(f)), captions: [...(await cap('x.txt', 'X 글')), ...(await cap('insta.txt', '인스타 글')), ...(await cap('blog.txt', '블로그 주간 글'))] });
  }
  await writeFile(join(site, 'index.html'), promoIndexHtml(days));
  return days.length;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const root = process.cwd();
  if (args.includes('--site')) { console.log(`promo: site pages for ${await buildPromoSite(root)} day(s)`); return; }
  const date = args.find((a) => a.startsWith('--date='))?.slice(7) ?? (await latestMarketDate(root));
  if (!date) { console.log('promo: no market report yet'); if (args.includes('--need')) process.exit(1); return; }
  const outDir = join(root, 'promo', date);
  // Weekend market reports carry Friday's index closes: no cards for them.
  const weekend = [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
  const done = weekend || (await exists(join(outDir, 'story.png')));
  if (args.includes('--need')) process.exit(done && !args.includes('--force') ? 1 : 0);
  if (!done || args.includes('--force')) {
    const market = JSON.parse(await readFile(join(root, 'reports', 'market', `daily-${date}.json`), 'utf8')) as MarketLike;
    const d = promoDay(market, await loadScoredCalls(root, new Date()));
    const fontDir = pathToFileURL(resolve(root, 'node_modules', 'pretendard', 'dist', 'web', 'static', 'woff2')).href;
    const weekly = args.includes('--weekly') || isFriday(date);
    const ops = opinionsOf(await loadDayCalls(root, date), date, 2);
    const cards = [
      { file: 'story.png', html: storyHtml(d, fontDir), w: 1080, h: 1920 },
      { file: 'x.png', html: xHtml(d, fontDir), w: 1200, h: 675 },
      ...ops.map((o, i) => ({ file: `opinion${i + 1}.png`, html: opinionHtml(o, fontDir, ops.length > 1 ? `${i + 1} / ${ops.length}` : ''), w: 1080, h: 1350 })),
      ...(weekly ? [{ file: 'cover.png', html: coverHtml(d, fontDir), w: 1080, h: 1350 }, { file: 'miss.png', html: missHtml(d, fontDir), w: 1080, h: 1350 }] : []),
    ];
    await mkdir(outDir, { recursive: true });
    await render(cards, outDir);
    await writeFile(join(outDir, 'x.txt'), `${xCaption(d)}\n`);
    await writeFile(join(outDir, 'insta.txt'), `${instaCaption(d)}\n`);
    if (weekly) await writeFile(join(outDir, 'blog.txt'), `${blogText(d)}\n`);
    console.log(`promo: ${date} cards ${cards.map((c) => c.file).join(', ')} · scored today ${d.scored.length}, this week ${d.week.length}`);
  }
  console.log(`promo: site pages for ${await buildPromoSite(root)} day(s)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
