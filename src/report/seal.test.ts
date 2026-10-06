import assert from 'node:assert/strict';
import test from 'node:test';
import { deepPath, seal, unseal } from './seal.js';

test('seal: round trip; a wrong key or a changed text fails; every seal differs (G-61)', async () => {
  const text = '위원회 토론 <b>본문</b> '.repeat(500);
  const a = await seal(text, 'k1'), b = await seal(text, 'k1');
  assert.notEqual(a, b);
  assert.equal(await unseal(a, 'k1'), text);
  await assert.rejects(unseal(a, 'k2'));
  const bad = (a[20] === 'A' ? 'B' : 'A');
  await assert.rejects(unseal(a.slice(0, 20) + bad + a.slice(21), 'k1'));
  assert.ok(!a.includes('위원회'));
  assert.equal(deepPath('KRW-BTC', '2026-10-05'), 'KRW-BTC/deep/2026-10-05.txt');
});
