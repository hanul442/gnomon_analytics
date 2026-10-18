import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchFredSeries, parseFredCsv } from './fred.js';

test('FRED CSV: dated numbers kept, missing days (.) skipped (G-230)', () => {
  const at = new Date('2026-10-17T00:00:00Z');
  const pts = parseFredCsv('observation_date,DGS10\n2026-10-16,.\n2026-10-14,5.19\n2026-10-15,5.10\nbad,1\n', 'DGS10', at);
  assert.deepEqual(pts.map((p) => [p.date, p.value]), [['2026-10-14', 5.19], ['2026-10-15', 5.1]]);
  assert.equal(pts[0]!.series, 'DGS10');
});

test('fetchFredSeries asks the public CSV with a start date and rejects odd ids (G-230)', async () => {
  let url = '';
  const pts = await fetchFredSeries('DEXKOUS', { now: () => new Date('2026-10-17T00:00:00Z'), days: 10, fetch: (async (u: string) => { url = u; return new Response('observation_date,DEXKOUS\n2026-10-15,1391.2\n'); }) as unknown as typeof fetch });
  assert.equal(url, 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXKOUS&cosd=2026-10-07');
  assert.equal(pts[0]!.value, 1391.2);
  await assert.rejects(fetchFredSeries('../x'), /BAD_FRED_SERIES/);
});
