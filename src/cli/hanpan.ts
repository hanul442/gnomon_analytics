// 오늘의 한 판 (G-338): the settled evening run scores the open pick from its stock's KRX closes and opens the next one
// from the committee reports on the site. Other runs only read the kept state (data/hanpan.json) for the home page.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chooseHanpan, makePick, scorePick, HANPAN_KEEP, type HanpanCandidate, type HanpanState, type SeatDot } from '../analysis/hanpan.js';
import { fetchNaverDailyBars } from '../sources/naverPrice.js';
import { seatsOf } from '../report/committeeSeats.js';
import { madeOn, type HomeEntry } from '../report/renderHtml.js';
import type { UniverseRow } from '../sources/naverList.js';
import type { PriceBar } from '../types.js';

const PREFERRED = /우[A-C]?$|우\(전환\)$|[0-9]우$/;
const DOT: Record<string, SeatDot> = { bull: 'u', neutral: 'n', bear: 'd', abstain: 'a' };

export async function readHanpan(root: string): Promise<HanpanState> {
  try { const s = JSON.parse(await readFile(join(root, 'data', 'hanpan.json'), 'utf8')) as HanpanState; return Array.isArray(s?.picks) ? s : { picks: [] }; } catch { return { picks: [] }; }
}

/** Korean stocks on the site with a committee report, with today's market cap. */
export function hanpanCandidates(home: readonly HomeEntry[], universe: readonly UniverseRow[] | null): HanpanCandidate[] {
  const cap = new Map((universe ?? []).filter((r) => r.marketCap && !PREFERRED.test(r.name)).map((r) => [r.symbol, r.marketCap!] as const));
  const out: HanpanCandidate[] = [];
  for (const e of home) {
    const r = e.report, c = r?.commentary?.status === 'OK' ? r.commentary : undefined, m = cap.get(e.symbol);
    if (!r || !c || !m || !/^\d{6}$/.test(e.symbol) || (e.kind && e.kind !== 'stock')) continue;
    const dots = seatsOf(r).map((s) => DOT[s.stance] ?? 'a');
    if (!dots.length) continue;
    out.push({ symbol: e.symbol, name: e.name, marketCap: m, reportDate: madeOn(e), dots, why: (c.summary?.text ?? '').split(/(?<=[.?!요])\s/)[0]?.slice(0, 120) ?? '' });
  }
  return out;
}

export interface HanpanRun { settled: boolean; fetch?: typeof fetch; now?: Date; bars?: (symbol: string) => Promise<PriceBar[]> }

/** Scores and opens picks on a settled run, then keeps the state in data/ and site/. */
export async function updateHanpan(root: string, home: readonly HomeEntry[], universe: readonly UniverseRow[] | null, run: HanpanRun): Promise<HanpanState> {
  const state = await readHanpan(root);
  if (!run.settled) return state;
  const now = run.now ?? new Date();
  const bars = run.bars ?? ((s: string) => fetchNaverDailyBars(s, 10, { krxClose: true, now: () => now, ...(run.fetch ? { fetch: run.fetch } : {}) }));
  const safe = async (s: string) => { try { return await bars(s); } catch { return [] as PriceBar[]; } };
  for (let i = Math.max(0, state.picks.length - 3); i < state.picks.length; i++) {
    const p = state.picks[i]!;
    if (!p.endDate) state.picks[i] = scorePick(p, await safe(p.symbol));
  }
  const today = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
  const next = chooseHanpan(hanpanCandidates(home, universe), state.picks.map((p) => p.symbol), today);
  if (next) {
    const base = (await safe(next.symbol)).sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1);
    const last = state.picks.at(-1);
    // One pick per session: a re-run the same evening, or a holiday run that sees the last session again, adds nothing.
    if (base && base.close > 0 && (!last || base.date > last.baseDate)) state.picks.push(makePick(next, base));
  }
  state.picks = state.picks.slice(-HANPAN_KEEP);
  await mkdir(join(root, 'data'), { recursive: true });
  await writeFile(join(root, 'data', 'hanpan.json'), `${JSON.stringify(state, null, 1)}\n`);
  return state;
}
