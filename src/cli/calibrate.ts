// G-264: refits the committee number's Platt line (src/analysis/baseOdds.ts) from every scored committee report.
// Every report's analyst calls are logged in data/analysts/<symbol>.jsonl and never rewritten, and the base
// chance can be recomputed from the prices up to the report's session, so each past committee number is
// rebuilt and checked against the close 20 sessions later. Korean listed stocks only (the base model's ground).
// Writes data/calibration/committee.json; composeReport attaches it to the report, and the line is used only
// once CALIBRATION_MIN numbers are scored.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AnalystCall } from '../analysis/analysts.js';
import { baseUpProb, fitPlatt, IDENTITY, saidOdds, type Calibration } from '../analysis/baseOdds.js';
import { asOf, readLog } from '../store/jsonlLog.js';
import { priceKey } from './marketData.js';
import type { PriceBar } from '../types.js';

export const CALIBRATION_PATH = ['data', 'calibration', 'committee.json'] as const;

/** One past committee number with its outcome. Pure. */
export function scoredOdds(calls: readonly AnalystCall[], bars: readonly PriceBar[], horizon = 20): { p: number; base: number; up: boolean }[] {
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : 1));
  const at = new Map(sorted.map((b, i) => [b.date, i]));
  const groups = new Map<string, AnalystCall[]>();
  for (const c of calls) { const k = `${c.reportDate}|${c.baseDate}`; groups.set(k, [...(groups.get(k) ?? []), c]); }
  const out: { p: number; base: number; up: boolean }[] = [];
  for (const group of groups.values()) {
    const i = at.get(group[0]!.baseDate);
    if (i === undefined || i + horizon >= sorted.length) continue;
    const base = baseUpProb(sorted.slice(Math.max(0, i - 260), i + 1));
    if (base == null) continue;
    out.push({ p: saidOdds(base, group), base, up: sorted[i + horizon]!.close > sorted[i]!.close });
  }
  return out;
}

export async function refreshCommitteeCalibration(root: string, now: Date): Promise<Calibration> {
  const listed = new Set((JSON.parse(await readFile(join(root, 'data', 'universe', 'stocks.json'), 'utf8').catch(() => '[]')) as { symbol: string; market: string }[])
    .filter((s) => s.market === 'KOSPI' || s.market === 'KOSDAQ').map((s) => s.symbol));
  const points: { p: number; base: number; up: boolean }[] = [];
  for (const file of (await readdir(join(root, 'data', 'analysts')).catch(() => [] as string[])).filter((f) => f.endsWith('.jsonl')).sort()) {
    const symbol = file.slice(0, -6);
    if (!listed.has(symbol)) continue;
    const calls = (await readLog<AnalystCall>(join(root, 'data', 'analysts', file))).filter((c) => c.madeAt <= now.toISOString());
    if (!calls.length) continue;
    const bars = asOf(await readLog<PriceBar>(join(root, 'data', 'prices', `${symbol}.jsonl`)).catch(() => [] as PriceBar[]), priceKey, now);
    points.push(...scoredOdds(calls, bars));
  }
  const c = points.length ? fitPlatt(points, now.toISOString()) : { ...IDENTITY, madeAt: now.toISOString() };
  await mkdir(join(root, ...CALIBRATION_PATH.slice(0, -1)), { recursive: true });
  await writeFile(join(root, ...CALIBRATION_PATH), `${JSON.stringify(c, null, 1)}\n`);
  return c;
}

export async function readCommitteeCalibration(root: string): Promise<Calibration | null> {
  try { return JSON.parse(await readFile(join(root, ...CALIBRATION_PATH), 'utf8')) as Calibration; } catch { return null; }
}
