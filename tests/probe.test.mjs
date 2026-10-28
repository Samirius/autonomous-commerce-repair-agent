import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runProbe, runObservation } from '../scripts/probe.mjs';

async function copyFixture() {
  const dir = await mkdtemp(path.join(tmpdir(), 'acra-probe-'));
  const root = path.join(dir, 'store');
  await cp(path.resolve('fixtures/realistic-store'), root, { recursive: true });
  return root;
}
const failingIds = (probe) => probe.signals.filter((s) => !s.pass).map((s) => s.id);

test('probe v2: healthy realistic store passes all generalized invariants', async () => {
  const probe = await runProbe(path.resolve('fixtures/realistic-store'));
  assert.equal(probe.pass, true, JSON.stringify(failingIds(probe)));
  const ids = probe.signals.map((s) => s.id);
  for (const expected of ['mixed-cart-total-matches-catalog', 'quantity-increase-updates-total', 'promo-code-applies-correctly:SAVE10', 'no-console-errors']) {
    assert.ok(ids.includes(expected), `missing signal ${expected}`);
  }
  assert.ok(ids.filter((i) => i.startsWith('displayed-price-matches-catalog:')).length >= 3, 'per-product price signals for all presented products');
  assert.ok(ids.filter((i) => i.startsWith('cart-total-for-product:')).length >= 3, 'per-product cart signals');
});

test('probe v2: a subtotal bug is caught by per-product and mixed-cart signals', async () => {
  const root = await copyFixture();
  const appPath = path.join(root, 'app.js');
  await writeFile(appPath, (await readFile(appPath, 'utf8')).replace('subtotal += p.priceMinor * qty;', 'subtotal += p.priceMinor;'));
  const probe = await runProbe(root);
  assert.equal(probe.pass, false);
  assert.ok(failingIds(probe).some((i) => i.startsWith('cart-total')), JSON.stringify(failingIds(probe)));
});

test('probe v2: console errors are captured as a failing signal', async () => {
  const root = await copyFixture();
  const appPath = path.join(root, 'app.js');
  await writeFile(appPath, (await readFile(appPath, 'utf8')) + "\nconsole.error('simulated storefront error');\n");
  const probe = await runProbe(root);
  assert.ok(failingIds(probe).includes('no-console-errors'));
});

test('runObservation: only allowlisted kinds, validated against the catalog', async () => {
  const root = path.resolve('fixtures/realistic-store');
  assert.match((await runObservation(root, { kind: 'run-arbitrary-js' })).error, /kind/);
  assert.match((await runObservation(root, { kind: 'cart-scenario', items: [{ id: 'not-a-product', qty: 1 }] })).error, /items/);
  const ok = await runObservation(root, { kind: 'cart-scenario', items: [{ id: 'trail-runner', qty: 1 }, { id: 'canvas-tote', qty: 2 }], promoCode: 'SAVE10' });
  assert.equal(ok.cart.count, 3);
  assert.equal(ok.cart.totalMinor, Math.round((12900 + 4900 * 2) * 0.9));
});
