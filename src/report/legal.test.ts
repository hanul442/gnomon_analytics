import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArticles, renderPrivacy, renderTerms } from './legal.js';
import { TERMS_MD, PRIVACY_MD, POLICY_MD } from './legalText.js';

test('legal texts split into numbered articles in order, ending with 부칙 where present', () => {
  const terms = parseArticles(TERMS_MD), privacy = parseArticles(PRIVACY_MD), policy = parseArticles(POLICY_MD);
  assert.equal(terms.filter((a) => a.no !== '부칙').length, 21);
  assert.equal(privacy.filter((a) => a.no !== '부칙').length, 10);
  assert.equal(policy.length, 7);
  for (const arts of [terms, privacy, policy]) {
    arts.filter((a) => a.no !== '부칙').forEach((a, i) => assert.equal(a.no, `제${i + 1}조`));
  }
  assert.equal(terms.at(-1)!.no, '부칙');
});

test('no contract-party shorthand or unfilled blanks reach the public pages', () => {
  for (const md of [TERMS_MD, PRIVACY_MD, POLICY_MD]) {
    assert.doesNotMatch(md, /(^|[\s(“])[갑을](은|는|이|가|의|에게|과|와)\s/);
    assert.doesNotMatch(md, /\[[^\]]*\]/);
  }
});

test('terms and privacy pages render articles, tables and the overseas-transfer recipients', () => {
  const terms = renderTerms(), privacy = renderPrivacy();
  assert.ok(terms.includes('id="t8"') && terms.includes('id="o4"') && terms.includes('href="privacy.html"'));
  assert.ok(privacy.includes('<table>') && privacy.includes('privacy@anthropic.com') && privacy.includes('start="3"'));
  assert.doesNotMatch(terms + privacy, /\*\*/);
});
