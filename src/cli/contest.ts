// Contest data for the daily build (G-250): logs the committee's decision after each settled close (as made,
// never revised) and publishes the season files the API and vs.html read.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalystCall } from '../analysis/analysts.js';
import { CONTEST_METHOD, committeeEntryKey, committeeTarget, liveCalls, seasonFile, seasonOf, type CommitteeEntry, type ContestIndex } from '../analysis/contest.js';
import { appendUnseen, readLog } from '../store/jsonlLog.js';
import { runDay } from './kst.js';

const SETTLED_HOUR_KST = 18;


export async function updateContest(root: string, siteDir: string, now: Date, names: ReadonlyMap<string, string>): Promise<ContestIndex> {
  const day = runDay(now);
  const logPath = join(root, 'data', 'contest', 'committee.jsonl');
  // Names: this run's, else the last logged (a rebuild without today's stock list).
  const known = new Map((await readLog<CommitteeEntry>(logPath)).flatMap((e) => e.live.map((l) => [l.symbol, l.name] as const)).filter(([s, n]) => n !== s));
  const nameOf = (s: string) => names.get(s) ?? known.get(s) ?? s;
  const files = (await readdir(join(root, 'data', 'analysts')).catch(() => [] as string[])).filter((f) => f.endsWith('.jsonl'));
  const bars = new Map<string, { date: string; close: number }[]>();
  const stocks: Parameters<typeof liveCalls>[1][number][] = [];
  for (const f of files) {
    const symbol = f.slice(0, -'.jsonl'.length);
    if (!/^[0-9][0-9A-Z]{5}$/.test(symbol)) continue; // Korean stocks only
    // Covered stocks keep their bars in data/prices; every other listed stock's fresh bars are in this run's site/s page.
    const by = new Map((await readLog<{ date: string; close: number }>(join(root, 'data', 'prices', `${symbol}.jsonl`))).map((x) => [x.date, x.close] as const));
    try { for (const r of (JSON.parse(await readFile(join(siteDir, 's', `${symbol}.json`), 'utf8')) as { bars?: [string, number, number, number, number, number][] }).bars ?? []) by.set(r[0], r[4]); } catch { /* no page this run */ }
    const b = [...by].filter(([d, c]) => d <= day.date && c > 0).sort(([x], [y]) => (x < y ? -1 : 1)).map(([date, close]) => ({ date, close }));
    if (!b.length) continue;
    bars.set(symbol, b);
    stocks.push({ symbol, name: nameOf(symbol), calls: await readLog<AnalystCall>(join(root, 'data', 'analysts', f)), bars: b });
  }
  const latest = [...bars.values()].reduce((m, b) => (b.at(-1)!.date > m ? b.at(-1)!.date : m), '');
  // Decide once per session, after it is settled (that evening, or any later run that missed it).
  if (latest && (latest < day.date || day.hour >= SETTLED_HOUR_KST)) {
    const live = liveCalls(latest, stocks);
    await mkdir(join(root, 'data', 'contest'), { recursive: true });
    await appendUnseen<CommitteeEntry>(logPath, [{ date: latest, live, target: committeeTarget(live), method: CONTEST_METHOD, recordedAt: now.toISOString() }], committeeEntryKey);
  }
  const entries = await readLog<CommitteeEntry>(logPath);
  const current = seasonOf(day.date);
  // A season exists once a decision fills in it: the month of any entry, or of the first session after one.
  const sessionDates = [...new Set([...bars.values()].flatMap((b) => b.map((x) => x.date)))];
  const first = entries[0]?.date;
  const seasons = [...new Set([...entries.map((e) => seasonOf(e.date)), ...(first ? sessionDates.filter((d) => d > first).map(seasonOf) : [])])].filter((s) => s <= current).sort();
  // site/ is rebuilt from data/ every run, so every season is written each time (a closed one comes out the same).
  await mkdir(join(siteDir, 'contest'), { recursive: true });
  const allNames = new Map([...known, ...names, ...stocks.map((s) => [s.symbol, s.name] as const)].filter(([s, n]) => n !== s));
  for (const s of seasons) await writeFile(join(siteDir, 'contest', `${s}.json`), JSON.stringify(seasonFile({ season: s, builtAt: now.toISOString(), today: day.date, entries, bars, names: allNames })));
  const last = entries.at(-1);
  const index: ContestIndex = { method: CONTEST_METHOD, current, seasons: seasons.includes(current) ? seasons : [...seasons, current], asOf: last?.date ?? null, live: last?.live ?? [], target: last?.target ?? [] };
  await writeFile(join(siteDir, 'contest.json'), JSON.stringify(index));
  return index;
}
