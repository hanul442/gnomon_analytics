import test from 'node:test';
import assert from 'node:assert/strict';
import { serious, staleData, issueBody } from '../scripts/audit-issue.mjs';

test('G-312: only serious findings make the live-audit issue; the alpha-pause 401 on /me is expected', () => {
  const rows = serious([
    { as: 'anon', width: 390, path: 'index.html', stuckLoading: 1, smallTargets: 3 },
    { as: 'alpha', width: 390, path: 'index.html', errors: ['401 GET /me'], notLoggedIn: true },
    { as: 'anon', width: 1280, path: 'us.html?s=AAPL', errors: ['404 GET u/AAPL.json', '401 GET /me'], overflowPx: 12 },
  ]);
  assert.deepEqual(rows, [{ as: 'anon', width: 1280, path: 'us.html?s=AAPL', errors: ['404 GET u/AAPL.json'], overflowPx: 12 }]);
  assert.match(issueBody(rows, [], ''), /404 GET u\/AAPL\.json/);
});

test('G-312: a weekday with no daily run for over 30 hours, or a failed source, counts as stopped data', () => {
  const wed = new Date('2026-11-04T03:00:00Z');
  assert.equal(staleData({ at: '2026-11-03T02:40:00Z', universe: [] }, wed).length, 0);
  assert.equal(staleData({ at: '2026-11-02T02:40:00Z', universe: [] }, wed).length, 1);
  assert.equal(staleData({ at: '2026-11-03T02:40:00Z', universe: [{ source: 'upbit', ok: false }] }, wed).length, 1);
  // Sunday KST: the weekend gap is normal.
  assert.equal(staleData({ at: '2026-10-30T02:40:00Z', universe: [] }, new Date('2026-11-01T03:00:00Z')).length, 0);
});
