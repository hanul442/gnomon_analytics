// Screener signal tracking (docs/DESIGN.md §5.16, G-53): records today's picks and scores old ones.

import { join } from 'node:path';
import { scoreKey, scoreSignals, signalBoard, todaysSignals, type SignalBoardRow, type SignalRecord, type SignalScore } from '../analysis/signalLog.js';
import { appendUnseen, readLog } from '../store/jsonlLog.js';
import type { PriceBar } from '../types.js';

export async function trackSignals(root: string, rows: readonly (readonly unknown[])[], dataDate: string | null, today: string): Promise<{ board: SignalBoardRow[]; recorded: number; scored: number }> {
  const sigPath = join(root, 'data', 'signals.jsonl'), scorePath = join(root, 'data', 'signal-scores.jsonl');
  const added = dataDate && rows.length ? await appendUnseen(sigPath, todaysSignals(rows, dataDate), (s) => `${s.date}|${s.preset}|${s.symbol}`) : [];
  const signals = await readLog<SignalRecord>(sigPath), old = await readLog<SignalScore>(scorePath);
  const lastClose = async (sym: string) => new Map([...new Map((await readLog<PriceBar>(join(root, 'data', 'prices', `${sym}.jsonl`))).map((b) => [b.date, b.close] as const))]);
  const P = await lastClose('KOSPI'), Q = await lastClose('KOSDAQ');
  const sessions = [...P.keys()].sort();
  const fresh = scoreSignals({ signals, scored: new Set(old.map((s) => scoreKey(s, s.horizon))), today, sessions, closeNow: new Map(rows.map((r) => [String(r[0]), Number(r[4])])), index: { P, Q } });
  const stored = fresh.length ? await appendUnseen(scorePath, fresh, (s) => scoreKey(s, s.horizon)) : [];
  return { board: signalBoard([...old, ...stored]), recorded: added.length, scored: stored.length };
}
