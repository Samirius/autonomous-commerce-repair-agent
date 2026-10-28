import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { runProbe } from '../scripts/probe.mjs';

const root = path.resolve('fixtures/realistic-store');

test('realistic fixture passes the generic probe (healthy store)', async () => {
  const probe = await runProbe(root);
  assert.equal(probe.pass, true, JSON.stringify(probe.signals.filter((s) => !s.pass), null, 2));
});

test('realistic fixture: multi-product cart, quantity changes and promo code', async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
  // Add product 1 (12900) and product 2 (4900)
  await page.click('[data-add="trail-runner"]');
  await page.click('[data-add="canvas-tote"]');
  assert.equal((await page.textContent('#cart-count')).trim(), '2');
  assert.equal(await page.evaluate(() => Number(document.getElementById('cart-total').dataset.totalMinor)), 17800);
  // Increase tote quantity to 2 -> +4900
  await page.click('[data-inc="canvas-tote"]');
  assert.equal(await page.evaluate(() => Number(document.getElementById('cart-total').dataset.totalMinor)), 22700);
  // Decrease tote back to 1
  await page.click('[data-dec="canvas-tote"]');
  assert.equal(await page.evaluate(() => Number(document.getElementById('cart-total').dataset.totalMinor)), 17800);
  // SAVE10 -> 10% off
  await page.fill('#promo-code', 'SAVE10');
  await page.click('#apply-promo');
  assert.equal(await page.evaluate(() => Number(document.getElementById('cart-discount').dataset.discountMinor)), 1780);
  assert.equal(await page.evaluate(() => Number(document.getElementById('cart-total').dataset.totalMinor)), 16020);
  await browser.close();
});
