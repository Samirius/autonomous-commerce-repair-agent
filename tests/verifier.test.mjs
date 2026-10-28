import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVerifier } from '../src/verifier.mjs';
import { validateRepair } from '../src/agent.mjs';

test('open-weight verifier reports unavailable without credentials (never fabricates)', () => {
  const v = createVerifier({});
  assert.equal(v.available, false);
  assert.equal(v.model, 'meta-models/muse-spark-open');
  assert.equal(v.baseUrl, 'https://inference.baseten.co/v1');
  assert.match(v.reason, /BASETEN_API_KEY/);
});
test('open-weight verifier is constructible from env config only', () => {
  const v = createVerifier({ BASETEN_API_KEY: 'dummy' });
  assert.equal(v.available, true);
  assert.equal(v.model, 'meta-models/muse-spark-open');
  assert.equal(typeof v.review, 'function');
});
test('agent cannot patch evaluation or traversal paths', () => {
  for (const file of ['../eval/oracles.mjs', 'eval/oracles.mjs', '/etc/passwd', 'catalog.js', '..\\src\\agent.mjs']) {
    assert.notEqual(validateRepair({ file, old: 'a', new: 'b' }, 'a'), null, file);
  }
});
