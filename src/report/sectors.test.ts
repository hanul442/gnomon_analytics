import assert from 'node:assert/strict';
import test from 'node:test';
import { SECTORS, SECTOR_THEME_WORDS } from './sectors.js';
import { sectorThemes, themesHome } from './renderThemes.js';

const m = (n: number) => Array.from({ length: n }, (_, i) => [String(i)]);

test('sector chips (G-201): every survey sector has its words; each finds its themes, strongest first', () => {
  assert.deepEqual(Object.keys(SECTOR_THEME_WORDS).sort(), [...SECTORS].sort());
  const themes = [
    { no: '1', name: 'HBM(고대역폭메모리)', avg: 1.2, members: m(5) },
    { no: '2', name: '반도체 장비', avg: 3.456, members: m(8) },
    { no: '3', name: '시스템반도체', avg: null, members: m(4) },
    { no: '4', name: '반도체 소형', avg: 9, members: m(2) },
    { no: '5', name: '2차전지(전고체)', avg: -0.5, members: m(6) },
    { no: '6', name: '카지노', avg: 2, members: m(6) },
    { no: '7', name: '바이오인식(생체인식)', avg: 5, members: m(6) },
    { no: '8', name: '제약업체', avg: 1, members: m(6) },
  ];
  const s = sectorThemes(themes);
  assert.deepEqual(s['반도체'], [['2', '반도체 장비', 3.46], ['1', 'HBM(고대역폭메모리)', 1.2], ['3', '시스템반도체', null]], 'strongest first, up to three, two-member themes left out');
  assert.deepEqual(s['2차전지·소재'], [['5', '2차전지(전고체)', -0.5]]);
  assert.deepEqual(s['바이오·헬스케어'], [['8', '제약업체', 1]], '바이오인식 is not 바이오');
  assert.equal(s['금융'], undefined, 'no match: the chip opens 테마 전체');
  assert.ok(themesHome({ date: '2026-10-10', fields: [], themes: themes as never }).sectors['반도체']);
});
