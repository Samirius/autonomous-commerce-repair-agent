import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVerifier, classifyReview } from '../src/verifier.mjs';
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
test('classifyReview separates deterministic and open-weight statuses', () => {
  const approved = classifyReview({ deterministicPass: true, evidenceAfter: { probePass: true }, openWeight: { parsed: { verdict: 'approve' } } });
  assert.equal(approved.deterministic, 'passed'); assert.equal(approved.openWeight, 'approved'); assert.equal(approved.humanReviewRequired, false);
  const concern = classifyReview({ deterministicPass: true, evidenceAfter: { probePass: true }, openWeight: { parsed: { verdict: 'concern' } } });
  assert.equal(concern.openWeight, 'concern'); assert.equal(concern.humanReviewRequired, true);
  const rejected = classifyReview({ deterministicPass: false, evidenceAfter: {}, openWeight: { parsed: { verdict: 'reject' } } });
  assert.equal(rejected.deterministic, 'failed'); assert.equal(rejected.openWeight, 'rejected');
  const unavailable = classifyReview({ deterministicPass: true, openWeight: null, evidenceAfter: {} });
  assert.equal(unavailable.openWeight, 'unavailable'); assert.equal(unavailable.humanReviewRequired, false);
});
test('classifyReview never lets missing evidence become an approval', () => {
  for (const empty of [null, undefined, {}]) {
    const r = classifyReview({ deterministicPass: true, evidenceAfter: empty, openWeight: { parsed: { verdict: 'approve' } } });
    assert.equal(r.openWeight, 'concern');
    assert.equal(r.humanReviewRequired, true);
  }
  const errord = classifyReview({ deterministicPass: true, evidenceAfter: { x: 1 }, openWeight: { error: 'HTTP 500' } });
  assert.equal(errord.openWeight, 'unavailable');
});
test('agent cannot patch evaluation or traversal paths', () => {
  for (const file of ['../eval/oracles.mjs', 'eval/oracles.mjs', '/etc/passwd', 'catalog.js', '..\\src\\agent.mjs']) {
    assert.notEqual(validateRepair({ file, old: 'a', new: 'b' }, 'a'), null, file);
  }
});
