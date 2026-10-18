// G-230: US macro series from FRED's public CSV download (no API key):
//   https://fred.stlouisfed.org/graph/fredgraph.csv?id=<SERIES>&cosd=<YYYY-MM-DD>
// Missing days are written as '.', and are skipped.

export const FRED_SOURCE = 'fred:csv';

export const MACRO_SERIES = [
  { id: 'DGS10', label: '미국 10년 국채 금리', unit: '%' },
  { id: 'DFF', label: '미국 기준금리(실효)', unit: '%' },
  { id: 'DEXKOUS', label: '원/달러 환율', unit: '원' },
  { id: 'VIXCLS', label: '미국 변동성 지수(VIX)', unit: '' },
] as const;
export type MacroId = typeof MACRO_SERIES[number]['id'];

export interface MacroPoint { series: string; date: string; value: number; source: string; retrievedAt: string }
export const macroKey = (p: MacroPoint) => `${p.series}:${p.date}`;

/** "observation_date,DGS10\n2026-10-15,5.10\n2026-10-16,." → points, oldest first. */
export function parseFredCsv(body: string, series: string, retrievedAt: Date): MacroPoint[] {
  const out: MacroPoint[] = [];
  for (const line of body.split(/\r?\n/).slice(1)) {
    const [d, v] = line.split(',');
    const value = Number(v);
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !v || v.trim() === '.' || !Number.isFinite(value)) continue;
    out.push({ series, date: d, value, source: FRED_SOURCE, retrievedAt: retrievedAt.toISOString() });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchFredSeries(series: string, options: { now?: () => Date; fetch?: typeof fetch; days?: number } = {}): Promise<MacroPoint[]> {
  if (!/^[A-Z0-9]{2,20}$/.test(series)) throw new Error('BAD_FRED_SERIES');
  const now = (options.now ?? (() => new Date()))();
  const from = new Date(now.getTime() - (options.days ?? 400) * 86_400_000).toISOString().slice(0, 10);
  const r = await (options.fetch ?? fetch)(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=${from}`, { signal: AbortSignal.timeout(20_000), headers: { 'user-agent': 'Mozilla/5.0 (gnomon-analytics)' } });
  if (!r.ok) throw new Error(`FRED_HTTP_${r.status}`);
  const points = parseFredCsv(await r.text(), series, now);
  if (!points.length) throw new Error('FRED_EMPTY');
  return points;
}
