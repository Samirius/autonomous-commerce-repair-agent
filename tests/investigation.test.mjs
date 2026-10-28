import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { discoverAndRepair } from '../src/discover.mjs';

function stubProvider(script) {
  let i = 0;
  return {
    provider: 'stub', model: 'stub-model',
    async chatJSON() {
      const parsed = script[Math.min(i++, script.length - 1)];
      return { provider: 'stub', model: 'stub-model', id: `stub-${i}`, usage: { total_tokens: 10 }, rawText: JSON.stringify(parsed), parsed };
    },
  };
}
async function copyFixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'acra-inv-'));
  const root = path.join(dir, 'store');
  await cp(path.resolve('fixtures/realistic-store'), root, { recursive: true });
  return { root, runDir: path.join(dir, 'run') };
}

test('investigation: healthy verdict only after >=2 observations -> verified-healthy, no code changed', async () => {
  const { root, runDir } = await copyFixture();
  const before = await readFile(path.join(root, 'app.js'), 'utf8');
  const provider = stubProvider([
    { observationRequest: { kind: 'cart-scenario', items: [{ id: 'trail-runner', qty: 1 }, { id: 'canvas-tote', qty: 1 }], promoCode: 'SAVE10' } },
    { observationRequest: { kind: 'quantity-change', items: [{ productId: 'trail-runner', qty: 1 }], productId: 'trail-runner', delta: 1 } },
    { verdict: 'healthy', evidenceSummary: 'mixed cart, promo and quantity behaved as catalog specifies' },
  ]);
  const summary = await discoverAndRepair({ root, runDir, provider });
  assert.equal(summary.state, 'verified-healthy');
  assert.equal(summary.investigation.observations, 2);
  assert.equal(summary.repairsCommitted, 0);
  assert.equal(await readFile(path.join(root, 'app.js'), 'utf8'), before);
});

test('investigation: suspected + confirmed scenario discrepancy is repaired and verified', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'acra-inv-'));
  const root = path.join(dir, 'store');
  await cp(path.resolve('fixtures/investigation-target'), root, { recursive: true });
  const provider = stubProvider([
    { observationRequest: { kind: 'cart-scenario', items: [{ id: 'trail-runner', qty: 1 }, { id: 'canvas-tote', qty: 1 }], promoCode: 'SAVE10' } },
    { observationRequest: { kind: 'quantity-change', items: [{ id: 'trail-runner', qty: 1 }], productId: 'trail-runner', delta: 1 } },
    { verdict: 'suspected', suspectedIssue: 'promo total in mixed cart looks wrong', confirmation: { kind: 'cart-scenario', items: [{ id: 'trail-runner', qty: 1 }, { id: 'canvas-tote', qty: 1 }], promoCode: 'SAVE10' } },
    { diagnosis: 'discount base wrong', file: 'app.js', old: 'const discount = Math.round(firstPrice * promoPercent / 100);', new: 'const discount = Math.round(subtotal * promoPercent / 100);', rationale: 'discount must be computed on the subtotal' },
  ]);
  const summary = await discoverAndRepair({ root, runDir: path.join(dir, 'run'), provider });
  assert.equal(summary.state, 'confirmed-issue-repaired');
  assert.equal(summary.repairsCommitted, 1);
  assert.equal(summary.investigation.confirmation.observed, 16510);
  assert.equal(summary.investigation.confirmation.expected, 16020);
});

test('investigation: a bare repair proposal on a passing store is suspicion, never a patch', async () => {
  const { root, runDir } = await copyFixture();
  const before = await readFile(path.join(root, 'app.js'), 'utf8');
  const provider = stubProvider([
    { verdict: 'issue', repair: { file: 'app.js', old: 'let count', new: 'let hacked' }, evidenceSummary: 'unverified guess' },
  ]);
  const summary = await discoverAndRepair({ root, runDir, provider });
  assert.equal(summary.state, 'suspected-unverified');
  assert.equal(summary.repairsCommitted, 0);
  assert.equal(await readFile(path.join(root, 'app.js'), 'utf8'), before);
});

test('investigation: immediate healthy verdict with no observations is incomplete, not verified', async () => {
  const { root, runDir } = await copyFixture();
  const provider = stubProvider([
    { verdict: 'healthy', evidenceSummary: 'looks fine' },
    { verdict: 'healthy', evidenceSummary: 'looks fine' },
    { verdict: 'healthy', evidenceSummary: 'looks fine' },
    { verdict: 'healthy', evidenceSummary: 'looks fine' },
    { verdict: 'healthy', evidenceSummary: 'looks fine' },
  ]);
  const summary = await discoverAndRepair({ root, runDir, provider });
  assert.equal(summary.state, 'investigation-incomplete');
  assert.equal(summary.repairsCommitted, 0);
});
