import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { loadRequests, parseRequests } from './requests.js';

test('requests.json is valid; a missing file means none; bad rows are rejected', async () => {
  assert.ok((await loadRequests(join(process.cwd(), 'requests.json'))).some((r) => r.symbol === '452190'));
  assert.deepEqual(await loadRequests(join(process.cwd(), 'no-such-file.json')), []);
  assert.throws(() => parseRequests([{ symbol: '4521', requestedAt: '2026-10-04' }]), /symbol/);
  assert.deepEqual(parseRequests([{ symbol: 'KRW-WLD', requestedAt: '2026-10-05' }, { symbol: '069500', requestedAt: '2026-10-05' }]).map((r) => r.symbol), ['KRW-WLD', '069500']);
  assert.throws(() => parseRequests([{ symbol: 'BTC-ETH', requestedAt: '2026-10-05' }]), /symbol/);
  assert.throws(() => parseRequests([{ symbol: '452190', requestedAt: '10/4' }]), /requestedAt/);
});
