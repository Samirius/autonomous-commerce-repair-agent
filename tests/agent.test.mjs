import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validateRepair, applyAndVerify } from '../src/agent.mjs';
import { createProvider } from '../src/provider.mjs';

const css = '.a { bottom: 16px; }\n';
const js = 'totalMinor = LEGACY_CART_PRICE_MINOR * count;\n';

test('validateRepair accepts a scoped patch in an allowed file', () => {
  assert.equal(validateRepair({ file: 'styles.css', old: 'bottom: 16px;', new: 'bottom: 96px;' }, css), null);
  assert.equal(validateRepair({ file: 'app.js', old: 'LEGACY_CART_PRICE_MINOR * count', new: 'product.priceMinor * count' }, js), null);
});
test('validateRepair rejects the read-only canonical catalog', () => {
  assert.match(validateRepair({ file: 'catalog.js', old: '8900', new: '7900' }, '8900'), /allowlist/);
});
test('validateRepair rejects execution constructs', () => {
  assert.match(validateRepair({ file: 'app.js', old: 'a', new: 'eval("x")' }, 'a'), /disallowed/);
});
test('validateRepair rejects old text that does not occur exactly once', () => {
  assert.match(validateRepair({ file: 'app.js', old: 'missing', new: 'x' }, js), /exactly once/);
});
test('validateRepair rejects hardcoding the canonical price', () => {
  const err = validateRepair(
    { file: 'app.js', old: 'LEGACY_CART_PRICE_MINOR * count', new: '8900 * count' }, js,
    { forbiddenLiterals: ['8900', '89.00'] });
  assert.match(err, /hardcodes canonical/);
});

async function brokenCopy() {
  const dir = await mkdtemp(path.join(tmpdir(), 'acra-'));
  const root = path.join(dir, 'storefront');
  await cp(path.resolve('storefront'), root, { recursive: true });
  // Recreate BOTH broken baselines explicitly (live storefront may be fixed)
  const cssPath = path.join(root, 'styles.css');
  await writeFile(cssPath, (await readFile(cssPath, 'utf8')).replace(/bottom: \d+px;(\s*\n\s*z-index: 10;)/, 'bottom: 16px;$1'));
  const appPath = path.join(root, 'app.js');
  const app = await readFile(appPath, 'utf8');
  if (!app.includes('LEGACY_CART_PRICE_MINOR')) {
    await writeFile(appPath, app.replace('product.priceMinor * count', 'LEGACY_CART_PRICE_MINOR * count'));
  }
  return root;
}

test('a CTA repair that still fails verification is rolled back', async () => {
  const root = await brokenCopy();
  const before = await readFile(path.join(root, 'styles.css'), 'utf8');
  const outcome = await applyAndVerify({ root, defectId: 'cta-overlap', repair: { file: 'styles.css', old: 'bottom: 16px;', new: 'bottom: 8px;' } });
  assert.equal(outcome.status, 'rolled-back');
  assert.equal(await readFile(path.join(root, 'styles.css'), 'utf8'), before);
});

test('a failed price repair rolls back app.js only, styles.css untouched', async () => {
  const root = await brokenCopy();
  const appBefore = await readFile(path.join(root, 'app.js'), 'utf8');
  const cssBefore = await readFile(path.join(root, 'styles.css'), 'utf8');
  // Still-wrong total (x1 instead of per-quantity catalog price) must fail the 2-click check
  const outcome = await applyAndVerify({
    root, defectId: 'price-mismatch', forbiddenLiterals: ['8900', '89.00'],
    repair: { file: 'app.js', old: 'totalMinor = LEGACY_CART_PRICE_MINOR * count;', new: 'totalMinor = product.priceMinor;' },
  });
  assert.equal(outcome.status, 'rolled-back');
  assert.equal(await readFile(path.join(root, 'app.js'), 'utf8'), appBefore);
  assert.equal(await readFile(path.join(root, 'styles.css'), 'utf8'), cssBefore);
});

test('a repair that regresses a previously repaired defect is rolled back', async () => {
  const root = await brokenCopy();
  // Fix CTA first for real
  const fix = await applyAndVerify({ root, defectId: 'cta-overlap', repair: { file: 'styles.css', old: 'bottom: 16px;', new: 'bottom: 100px;' } });
  assert.equal(fix.status, 'committed');
  // Now a price "repair" that re-breaks the CTA file must roll back on regression grounds.
  // (Simulated via styles.css with priorDefectIds containing the already-fixed defect.)
  const bad = await applyAndVerify({
    root, defectId: 'price-mismatch', priorDefectIds: ['cta-overlap'],
    repair: { file: 'styles.css', old: 'bottom: 100px;', new: 'bottom: 8px;' },
  });
  assert.equal(bad.status, 'rolled-back');
  assert.deepEqual(bad.regressions, ['cta-overlap']);
});

// --- Provider selection by configuration only (no code change, no network) ---
test('provider config: meta defaults to Muse Wonder on the Meta API', () => {
  const p = createProvider({ MODEL_PROVIDER: 'meta', MODEL_API_KEY: 'dummy' });
  assert.equal(p.provider, 'meta'); assert.equal(p.model, 'muse-wonder-1.0'); assert.equal(p.baseUrl, 'https://api.meta.ai/v1');
});
test('provider config: model/provider swap via env only', () => {
  const p = createProvider({ MODEL_PROVIDER: 'openai-compatible', MODEL_API_KEY: 'dummy', MODEL_NAME: 'some-other-model', MODEL_BASE_URL: 'https://example.invalid/v1' });
  assert.equal(p.provider, 'openai-compatible'); assert.equal(p.model, 'some-other-model'); assert.equal(p.baseUrl, 'https://example.invalid/v1');
});
test('provider config: unknown provider is rejected', () => {
  assert.throws(() => createProvider({ MODEL_PROVIDER: 'nope', MODEL_API_KEY: 'dummy' }), /Unknown MODEL_PROVIDER/);
});
