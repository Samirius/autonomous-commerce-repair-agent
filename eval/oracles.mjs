// PRIVATE evaluation oracle — independent deterministic assertions.
// Never imported by, passed to, or shown to the agent. The agent only ever
// receives a copied storefront directory; this file stays outside it.
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function expected(catalog, qty) {
  let t = catalog.products[0].priceMinor * qty;
  const r = catalog.rules?.bulkDiscount;
  if (r && qty >= r.minQty) t = Math.round(t * (100 - r.percentOff) / 100);
  return t;
}

export async function runOracle(variantId, rootDir) {
  const url = pathToFileURL(path.join(rootDir, 'index.html')).href;
  const browser = await chromium.launch();
  const checks = {};
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);
  const data = await page.evaluate(() => {
    const cta = document.getElementById('add-to-cart');
    const r = cta.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      catalog: window.CATALOG,
      displayedPriceMinor: Number(document.getElementById('product-price').dataset.priceMinor),
      ctaUsable: !!hit && (hit === cta || cta.contains(hit)),
      ctaInViewport: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      cookieVisible: !!document.getElementById('cookie-bar') && document.getElementById('cookie-bar').getBoundingClientRect().height > 0,
      overflowX: document.documentElement.scrollWidth > innerWidth,
    };
  });
  checks.displayedPriceMatchesCatalog = data.displayedPriceMinor === data.catalog.products[0].priceMinor;
  checks.ctaUsableMobile = data.ctaUsable && data.ctaInViewport;
  if (variantId.startsWith('v1')) checks.blockingBannerStillPresent = data.cookieVisible;
  await page.evaluate(() => { document.getElementById('add-to-cart').click(); });
  const q1 = await page.evaluate(() => ({ count: Number(document.getElementById('cart-count').textContent), total: Number(document.getElementById('cart-total').dataset.totalMinor) }));
  await page.evaluate(() => { document.getElementById('add-to-cart').click(); });
  const q2 = await page.evaluate(() => ({ count: Number(document.getElementById('cart-count').textContent), total: Number(document.getElementById('cart-total').dataset.totalMinor) }));
  checks.cartCountCorrect = q1.count === 1 && q2.count === 2;
  checks.cartTotalQty1Correct = q1.total === expected(data.catalog, 1);
  checks.cartTotalQty2Correct = q2.total === expected(data.catalog, 2);
  await page.close();

  if (variantId.startsWith('v2')) {
    const p2 = await browser.newPage({ viewport: { width: 360, height: 740 } });
    await p2.goto(url);
    const small = await p2.evaluate(() => {
      const cta = document.getElementById('add-to-cart');
      const r = cta.getBoundingClientRect();
      return { overflowX: document.documentElement.scrollWidth > innerWidth, ctaFullyVisible: r.left >= 0 && r.right <= innerWidth };
    });
    checks.noOverflowAt360 = !small.overflowX;
    checks.ctaFullyVisibleAt360 = small.ctaFullyVisible;
    await p2.close();
  }
  let pointerClickOk = false;
  const p3 = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p3.goto(url);
  try { await p3.click('#add-to-cart', { timeout: 3000 }); pointerClickOk = (await p3.textContent('#cart-count')).trim() === '1'; } catch { pointerClickOk = false; }
  checks.pointerClickWorks = pointerClickOk;
  await p3.close();
  await browser.close();
  return { variant: variantId, pass: Object.values(checks).every(Boolean), checks, observed: { q1, q2, displayedPriceMinor: data.displayedPriceMinor } };
}
