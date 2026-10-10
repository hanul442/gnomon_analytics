import assert from 'node:assert/strict';
import test from 'node:test';
import type { DailyReport } from './dailyReport.js';
import { withCurrency } from './format.js';
import { edgeFlows } from './renderEdge.js';

test('insider rows (G-194): a list a phone can hold, Form 4 names in title case and officer titles shortened', () => {
  const report = { edge: { insider: { netShares: -1200, netValue: -300000, buys: 0, sells: 1, items: [
    { symbol: 'AAPL.O', receiptNo: 'x', url: 'https://www.sec.gov/x', date: '2026-10-02', reporter: 'COOK TIMOTHY D', position: 'Chief Executive Officer', isExec: true, isMajor: false, shares: 3280557, delta: -1200, ratio: null, retrievedAt: '' },
    { symbol: 'AAPL.O', receiptNo: 'z', date: '2026-09-29', reporter: 'MCDONALD ROBERT III', position: '', isExec: false, isMajor: false, shares: 10, delta: 10, ratio: null, retrievedAt: '' },
    { symbol: 'AAPL.O', receiptNo: 'y', date: '2026-09-30', reporter: 'Kondo Chris', position: 'Senior Vice President, General Counsel', isExec: true, isMajor: false, shares: null, delta: 500, ratio: null, retrievedAt: '' },
  ] }, holders: [], value: null } } as unknown as DailyReport;
  const html = withCurrency('USD', () => edgeFlows(report));
  assert.ok(!html.includes('<table'), 'no table to run past the edge');
  assert.match(html, /<b>Cook Timothy D<\/b><small>CEO · <a href="https:\/\/www\.sec\.gov\/x"/);
  assert.match(html, /<b>Kondo Chris<\/b><small>SVP, GC · /);
  assert.match(html, /<b class="down">-1,200주<\/b><small>보유 3,280,557주<\/small>/);
  assert.match(html, /<b class="up">\+500주<\/b><\/div>/, 'no holding line when the filing has none');
  assert.match(html, /<b>McDonald Robert III<\/b><small><a [^>]+>보고 2026-09-29<\/a>/, 'suffixes keep capitals; no stray separator without a role');
  const kr = edgeFlows({ edge: { insider: { netShares: 5, netValue: 1, buys: 1, sells: 0, items: [{ symbol: '009540', receiptNo: '1', date: '2026-10-01', reporter: 'HD현대', position: 'Director', isExec: false, isMajor: true, shares: 1, delta: 5, ratio: null, retrievedAt: '' }] }, holders: [], value: null } } as unknown as DailyReport);
  assert.match(kr, /<b>HD현대<\/b><small>Director · /, 'a Korean filer shows as filed');
});
