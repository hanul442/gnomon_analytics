import assert from 'node:assert/strict';
import test from 'node:test';
import { VS_CHART_JS, vsChartSection } from './drawHistory.js';

test('drawHistory: the vs.html section lists past drawing reviews from the draw source and says it is education', () => {
  const html = vsChartSection();
  assert.match(html, /<section id="vs-chart"/);
  assert.match(html, /교육용 피드백/);
  assert.match(VS_CHART_JS, /\/questions\/mine\?source=draw/);
  assert.doesNotThrow(() => new Function(VS_CHART_JS));
});
