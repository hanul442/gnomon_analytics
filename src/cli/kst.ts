// KST calendar helpers for the daily run.

const KST_MS = 9 * 60 * 60_000;

export function kstParts(at: Date): { date: string; compact: string; hour: number } {
  const kst = new Date(at.getTime() + KST_MS);
  const date = kst.toISOString().slice(0, 10);
  return { date, compact: date.replaceAll('-', ''), hour: kst.getUTCHours() };
}

/** Pre-market trading starts at 08:00 KST; until then the last close is still the evening before's. */
const ROLLOVER_HOUR_KST = 8;
/**
 * The day a run reports on (G-217). GitHub starts the 18:30 schedule hours late, often past midnight; such a run
 * still settles the evening before, with `hour` counting on from 24, instead of landing on a new day before 18:00
 * and skipping the reports and daily picks of both days.
 */
export function runDay(at: Date): { date: string; compact: string; hour: number } {
  const k = kstParts(at);
  if (k.hour >= ROLLOVER_HOUR_KST) return k;
  const prev = kstParts(new Date(at.getTime() - 86_400_000));
  return { ...prev, hour: k.hour + 24 };
}
