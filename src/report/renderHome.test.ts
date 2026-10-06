import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHome } from './renderHome.js';
import type { HomeEntry } from './renderHtml.js';
import type { DailyReport } from './dailyReport.js';

const entry = (symbol: string, changePct: number, kind: HomeEntry['kind'] = 'stock'): HomeEntry => ({
  symbol, name: symbol, href: `${symbol}/index.html`, group: 'daily', tier: 'brief', pickDate: '2026-10-06', kind, reasons: ['테스트'],
  report: { symbol, name: symbol, date: '2026-10-06', headline: '한 줄', price: { close: 100, changePct, volume: 1, volumeRatio20: 1 } } as unknown as DailyReport,
});

test('home: no view bar or market tabs; temperature card; today picks carry a score and a reason per view (G-67)', () => {
  const html = renderHome({ entries: [entry('AAA', 9), entry('BBB', 0.1, 'etf')], selection: null, universe: null, pulse: null, indices: [] });
  assert.ok(!html.includes('id="pz-note"') && !html.includes('class="mkt-tabs"'));
  assert.ok(html.includes('data-s-trader=') && html.includes('pw-trader') && html.includes('오늘 ▲ +9.00%'));
  const s = (sym: string, v: string) => Number(new RegExp(`data-s-${v}="([-\\d.]+)"[^>]*>(?:(?!class="tp").)*?${sym}/index`, 's').exec(html)?.[1]);
  assert.ok(s('AAA', 'trader') > s('BBB', 'trader'), 'the big mover leads for traders');
  assert.ok(s('BBB', 'beginner') > s('AAA', 'beginner'), 'the ETF leads for beginners');
});

test('the shared scripts parse (a bad escape in a template once broke every page)', async () => {
  const { APP_JS, UI_JS } = await import('./renderHtml.js');
  for (const js of [APP_JS, UI_JS]) assert.doesNotThrow(() => new Function(js));
});
