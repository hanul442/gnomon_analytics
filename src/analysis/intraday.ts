// Intraday scan (docs/DESIGN.md §5.15, G-52): from the minute feed's last ~10 sessions, how today's
// volume so far compares with the same time of day in earlier sessions, and how far the price moved
// from the previous close. Pure; the API's cron runs it every 10 minutes during the session.

import type { IntradaySession } from '../types.js';

export interface IntradayRead { date: string; time: string; close: number; prevClose: number; changePct: number; pace: number | null; cumVolume: number }
export interface IntradaySignal { kind: 'VOLUME' | 'UP' | 'DOWN'; text: string }

/** Cumulative volume at or before `time`, or null if the session has no bar by then. */
function cumAt(s: IntradaySession, time: string): number | null {
  let v: number | null = null;
  for (let i = 0; i < s.times.length && s.times[i]! <= time; i += 1) v = s.cumVolumes[i]!;
  return v;
}

export function readIntraday(sessions: readonly IntradaySession[], today: string): IntradayRead | null {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1));
  const cur = sorted.find((s) => s.date === today), past = sorted.filter((s) => s.date < today);
  if (!cur || !cur.times.length || !past.length) return null;
  const i = cur.times.length - 1, time = cur.times[i]!, close = cur.closes[i]!, cum = cur.cumVolumes[i]!;
  const prev = past.at(-1)!, prevClose = prev.closes.at(-1)!;
  const base = past.slice(-5).map((s) => cumAt(s, time)).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);
  const median = base.length ? base[Math.floor(base.length / 2)]! : null;
  return { date: today, time, close, prevClose, changePct: (close / prevClose - 1) * 100, pace: median ? cum / median : null, cumVolume: cum };
}

/** Thresholds: volume at least 3× the usual pace for this time of day (after 09:30), or a ±5% move. */
export function intradaySignals(r: IntradayRead, name: string): IntradaySignal[] {
  const out: IntradaySignal[] = [];
  const pct = `${r.changePct > 0 ? '+' : ''}${r.changePct.toFixed(1)}%`;
  if (r.pace != null && r.pace >= 3 && r.time >= '09:30') out.push({ kind: 'VOLUME', text: `${name} 거래량이 평소 이 시간의 ${r.pace.toFixed(1)}배예요 (${r.time} 기준, ${pct})` });
  if (r.changePct >= 5) out.push({ kind: 'UP', text: `${name} ${pct} 올랐어요 (${r.time} 기준)` });
  if (r.changePct <= -5) out.push({ kind: 'DOWN', text: `${name} ${pct} 내렸어요 (${r.time} 기준)` });
  return out;
}
