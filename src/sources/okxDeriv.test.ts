import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchOkxDeriv, parseOkxDeriv } from './okxDeriv.js';

// Shapes as OKX answered on 2026-10-08 (diag workflow), trimmed.
export const OKX_PARTS = JSON.parse(readFileSync(join(process.cwd(), 'test', 'fixtures', 'okx.json'), 'utf8')) as Record<string, unknown>;
const AT = new Date('2026-10-08T12:47:47Z');

test('funding, open interest with 30-day history, long/short and liquidations in USD', () => {
  const d = parseOkxDeriv('BTC', OKX_PARTS, AT);
  assert.equal(d.instId, 'BTC-USDT-SWAP');
  assert.ok(Math.abs(d.funding!.rate - 0.0000567508) < 1e-9);
  assert.equal(d.oi!.usd, 2572755060.3);
  assert.equal(d.oi!.history.length, 8);
  assert.ok(d.oi!.history[0]![0] < d.oi!.history.at(-1)![0], 'oldest first');
  assert.deepEqual(d.longShort.map((x) => x[1]), [0.98, 1.61, 1.73]);
  assert.equal(d.liquidations!.count, 3);
  assert.ok(Math.abs(d.liquidations!.longUsd - (4 * 0.01 * 82241 + 0.41 * 0.01 * 82283.6)) < 1e-6);
  assert.equal(d.liquidations!.shortUsd, 2 * 0.01 * 83000);
});

test('a failed or missing part only blanks itself', () => {
  const d = parseOkxDeriv('XYZ', { funding: { code: '51001', msg: 'Instrument ID does not exist' }, oi: null, lsr: OKX_PARTS.lsr }, AT);
  assert.equal(d.funding, null);
  assert.equal(d.oi, null);
  assert.equal(d.liquidations, null);
  assert.equal(d.longShort.length, 3);
});

test('fetch asks six public endpoints and rejects odd symbols', async () => {
  const asked: string[] = [];
  const fake = (async (url: string | URL | Request) => { asked.push(new URL(String(url)).pathname); return new Response(JSON.stringify({ code: '0', data: [] })); }) as typeof fetch;
  await fetchOkxDeriv('ETH', fake, AT);
  assert.equal(asked.length, 6);
  assert.ok(asked.every((p) => p.startsWith('/api/v5/')));
  await assert.rejects(fetchOkxDeriv('eth/../x', fake), /BAD_CCY/);
});
