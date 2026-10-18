// Data for the hidden-future evaluation v2 (G-245): ten years of daily prices for every stock DART knows a
// stock code for, delisted ones included (Naver keeps their charts), the KOSPI/KOSDAQ index, investor flows for
// the stocks that were ever among the most traded, and their major filings (with OPENDART_API_KEY).
// Everything goes to .cache/eval/ (not committed; Actions keeps it in its cache).
//
//   node dist/cli/evalFetch.js [--limit 0] [--count 2700] [--flowsTop 200] [--flowsFrom 2020-01-01]

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { liquidSets } from '../analysis/evalPanel.js';
import { eventOf } from '../analysis/edge.js';
import { fetchDartFilings } from '../sources/opendart.js';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] ?? d : d; };
const LIMIT = Number(arg('limit', '0')), COUNT = Number(arg('count', '2700')), FLOWS_TOP = Number(arg('flowsTop', '200')), FLOWS_FROM = arg('flowsFrom', '2020-01-01');
const root = process.cwd(), dir = join(root, '.cache', 'eval');
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; GnomonAnalytics/1.0; +https://hanul442.github.io/gnomon_analytics/)' };

/** Not ordinary common shares: SPACs, ship and infra funds, REITs, preferred shares. */
export const NOT_COMMON = /스팩|기업인수목적|선박|거북선|하이골드|바다로|맥쿼리인프라|리츠|REIT|인프라|펀드|ETN|\d호$|우$|우B$|우\(전환\)$|\d우[A-Z]?$/;

async function pool<T>(items: readonly T[], n: number, f: (x: T) => Promise<void>) {
  let k = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (k < items.length) { const x = items[k++]!; try { await f(x); } catch (e) { console.error(String(e).slice(0, 160)); } } }));
}
const exists = (p: string) => stat(p).then(() => true, () => false);

async function chart(symbol: string): Promise<{ name: string; bars: number[][] } | null> {
  const r = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${symbol}&timeframe=day&count=${COUNT}&requestType=0`, { headers: UA, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`chart ${symbol} ${r.status}`);
  const body = new TextDecoder('euc-kr').decode(await r.arrayBuffer());
  const name = /name="([^"]*)"/.exec(body)?.[1] ?? '';
  const bars: number[][] = [];
  for (const m of body.matchAll(/item data="(\d{8})\|([^"]*)"/g)) {
    const [o, h, l, c, v] = m[2]!.split('|').map(Number);
    if (c! > 0) bars.push([Number(m[1]), o || c!, h || c!, l || c!, c!, v || 0]);
  }
  return bars.length ? { name, bars } : null;
}

async function flows(symbol: string, from: string): Promise<number[][]> {
  // [yyyymmdd, foreign net, institution net, foreign hold ratio]; 60 sessions a page, walked back by bizdate.
  const out = new Map<number, number[]>();
  let biz = '';
  for (let page = 0; page < 80; page += 1) {
    const r = await fetch(`https://m.stock.naver.com/api/stock/${symbol}/trend?pageSize=60${biz ? `&bizdate=${biz}` : ''}`, { headers: { ...UA, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    if (!r.ok) break;
    const rows = await r.json() as { bizdate: string; foreignerPureBuyQuant: string; organPureBuyQuant: string; foreignerHoldRatio: string }[];
    if (!Array.isArray(rows) || !rows.length) break;
    const num = (s: string) => Number(String(s).replace(/[,+%]/g, '')) || 0;
    for (const x of rows) out.set(Number(x.bizdate), [Number(x.bizdate), num(x.foreignerPureBuyQuant), num(x.organPureBuyQuant), num(x.foreignerHoldRatio)]);
    const oldest = rows.at(-1)!.bizdate;
    if (oldest <= from.replace(/-/g, '') || oldest === biz) break;
    // The next page ends the session before the oldest one seen.
    const d = new Date(Date.UTC(+oldest.slice(0, 4), +oldest.slice(4, 6) - 1, +oldest.slice(6, 8)) - 86_400_000);
    biz = d.toISOString().slice(0, 10).replace(/-/g, '');
  }
  return [...out.values()].sort((a, b) => a[0]! - b[0]!);
}

async function main() {
  await mkdir(join(dir, 'prices'), { recursive: true });
  await mkdir(join(dir, 'flows'), { recursive: true });
  await mkdir(join(dir, 'events'), { recursive: true });
  const corp = (JSON.parse(await readFile(join(root, 'data/universe/dart-corp-codes.json'), 'utf8')) as { codes: Record<string, string> }).codes;
  let codes = Object.keys(corp).filter((c) => /^\d{5}0$/.test(c)).sort();
  if (LIMIT) codes = codes.slice(0, LIMIT);
  // Indices first: their sessions are the calendar.
  for (const ix of ['KOSPI', 'KOSDAQ']) { const c = await chart(ix); if (c) await writeFile(join(dir, `${ix}.json`), JSON.stringify(c.bars)); }
  const names: Record<string, string> = JSON.parse(await readFile(join(dir, 'names.json'), 'utf8').catch(() => '{}'));
  let done = 0;
  await pool(codes, 8, async (code) => {
    const p = join(dir, 'prices', `${code}.json`);
    if (!(await exists(p))) {
      const c = await chart(code);
      if (c && !NOT_COMMON.test(c.name)) { names[code] = c.name; await writeFile(p, JSON.stringify(c.bars)); } else await writeFile(p, '[]');
    }
    if (++done % 250 === 0) console.error(`prices ${done}/${codes.length}`);
  });
  await writeFile(join(dir, 'names.json'), JSON.stringify(names));

  // The stocks that were among the most traded on any evaluation date since FLOWS_FROM get flows and filings.
  const series: { symbol: string; bars: number[][] }[] = [];
  for (const code of Object.keys(names)) { const bars = JSON.parse(await readFile(join(dir, 'prices', `${code}.json`), 'utf8')) as number[][]; if (bars.length) series.push({ symbol: code, bars }); }
  const calendar = (JSON.parse(await readFile(join(dir, 'KOSPI.json'), 'utf8')) as number[][]).map((b) => b[0]!);
  const top = new Set<string>();
  for (const set of liquidSets(series, calendar, FLOWS_TOP, Number(FLOWS_FROM.replace(/-/g, '')))) for (const s of set.symbols) top.add(s);
  console.error(`flow/event stocks ${top.size}`);
  done = 0;
  await pool([...top], 6, async (code) => {
    const p = join(dir, 'flows', `${code}.json`);
    if (!(await exists(p))) await writeFile(p, JSON.stringify(await flows(code, FLOWS_FROM)));
    if (++done % 50 === 0) console.error(`flows ${done}/${top.size}`);
  });
  const key = process.env.OPENDART_API_KEY ?? '';
  if (key) {
    done = 0;
    await pool([...top], 3, async (code) => {
      const p = join(dir, 'events', `${code}.json`);
      if (await exists(p)) return;
      const out: [number, string][] = [];
      for (const kind of ['B', 'I']) {
        const list = await fetchDartFilings({ apiKey: key, corpCode: corp[code]!, kind, from: FLOWS_FROM.replace(/-/g, ''), to: '20991231', maxPages: 30 });
        for (const f of list) { const e = eventOf(f.title); if (e) out.push([Number(f.filedDate.replace(/-/g, '')), e.key]); }
      }
      await writeFile(p, JSON.stringify(out.sort((a, b) => a[0] - b[0])));
      if (++done % 50 === 0) console.error(`events ${done}/${top.size}`);
    });
  } else console.error('OPENDART_API_KEY not set: no filings');
}

void main().catch((e) => { console.error(e); process.exit(1); });
