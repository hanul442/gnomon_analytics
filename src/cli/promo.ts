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
import { blogText, opinionsOf, PROMO_SITE, promoDay, promoIndexHtml, scoreCalls, type MarketLike, type PromoCall } from '../report/promoCards.js';
import { deckInstaCaption, deckSlides, deckStoryHtml, deckXCaption, deckXHtml, type DeckExtras } from '../report/promoDeck.js';

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

/**
 * The deck's extras (한서 11/6): the five largest KOSPI stocks' signal from the screener the daily run just built
 * (site/screener.json; preferred shares left out), and each opinion stock's last 60 closes up to `date`.
 */
export async function loadDeckExtras(root: string, date: string, symbols: readonly string[], market: unknown = null): Promise<DeckExtras> {
  // Today's change from the market report (closing prices, same as the index numbers), else the screener's.
  const close = new Map(((market as { groups?: { id: string; assets?: { name: string; returnPct?: number | null }[] }[] } | null)?.groups?.find((g) => g.id === 'M1')?.assets ?? []).map((a) => [a.name, a.returnPct ?? null]));
  const side = (lv: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null => (/BULLISH$/.test(lv) ? 'BULLISH' : /BEARISH$/.test(lv) ? 'BEARISH' : lv === 'NEUTRAL' ? 'NEUTRAL' : null);
  const sc = JSON.parse(await readFile(join(root, 'site', 'screener.json'), 'utf8').catch(() => '{}')) as { date?: string; rows?: unknown[][] };
  const majors = sc.date === date ? (sc.rows ?? [])
    .filter((r) => r[2] === 'P' && typeof r[3] === 'number' && !/우[A-C]?$/.test(String(r[1])) && side(String(r[6])))
    .sort((a, b) => (b[3] as number) - (a[3] as number)).slice(0, 5)
    .map((r) => ({ name: String(r[1]), pct: close.get(String(r[1])) ?? (typeof r[5] === 'number' ? r[5] : null), stance: side(String(r[6]))! })) : [];
  const closes = new Map<string, { date: string; close: number }[]>();
  for (const s of symbols) {
    const bars = asOf(await readLog<PriceBar>(join(root, 'data', 'prices', `${s}.jsonl`)).catch(() => [] as PriceBar[]), priceKey, new Date()).filter((b) => b.date <= date && b.close > 0);
    if (bars.length) closes.set(s, bars.slice(-60).map((b) => ({ date: b.date, close: b.close })));
  }
  return { majors, closes };
}

const isFriday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() === 5;

async function render(cards: { file: string; html: string; w: number; h: number; jpg?: boolean }[], outDir: string): Promise<void> {
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
      // G-321: Instagram's publishing API takes JPEG only.
      if (c.jpg) await page.screenshot({ path: join(outDir, c.file.replace(/\.png$/, '.jpg')), type: 'jpeg', quality: 90, clip: { x: 0, y: 0, width: c.w, height: c.h } });
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
    days.push({ date, files: ['story.png', 'x.png', ...files.filter((f) => /^deck\d\d-.*\.png$/.test(f)), 'opinion1.png', 'opinion2.png', 'cover.png', 'miss.png'].filter((f) => files.includes(f)), captions: [...(await cap('x.txt', 'X 글')), ...(await cap('insta.txt', '인스타 글')), ...(await cap('blog.txt', '블로그 주간 글'))] });
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
    // G-322: one info-style carousel (deckNN-<role>), a story and an X card that share the cover's hook.
    const deck = deckSlides(d, ops, fontDir, weekly, await loadDeckExtras(root, date, ops.map((o) => o.symbol), market));
    const cards = [
      { file: 'story.png', html: deckStoryHtml(d, ops, fontDir), w: 1080, h: 1920, jpg: true },
      { file: 'x.png', html: deckXHtml(d, ops, fontDir), w: 1200, h: 675 },
      ...deck.map((s, i) => ({ file: `deck${String(i + 1).padStart(2, '0')}-${s.role}.png`, html: s.html, w: 1080, h: 1350, jpg: true })),
    ];
    await mkdir(outDir, { recursive: true });
    await render(cards, outDir);
    await writeFile(join(outDir, 'x.txt'), `${deckXCaption(d, ops, PROMO_SITE)}\n`);
    await writeFile(join(outDir, 'insta.txt'), `${deckInstaCaption(d, ops)}\n`);
    if (weekly) await writeFile(join(outDir, 'blog.txt'), `${blogText(d)}\n`);
    console.log(`promo: ${date} cards ${cards.map((c) => c.file).join(', ')} · scored today ${d.scored.length}, this week ${d.week.length}`);
  }
  console.log(`promo: site pages for ${await buildPromoSite(root)} day(s)`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
