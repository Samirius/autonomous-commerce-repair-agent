// Deterministic storefront checks (no AI involved) — the ONLY source of pass/fail.
// Defects:
//  1. cta-overlap (critical): #add-to-cart obscured at any viewport. Checked at
//     mobile 390x844 AND desktop 1280x800: bounding box in viewport,
//     elementFromPoint at CTA centre is the CTA, real click increments cart.
//  2. price-mismatch (high): all money compared in integer minor units.
//     Displayed product price and cart total (after 2 clicks) must equal the
//     canonical catalog priceMinor (x quantity) from window.CATALOG.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const cliRoot = path.resolve(opt('--root', 'storefront'));
const evidencePath = opt('--evidence', null);
const screenshotPath = opt('--screenshot', null);

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

async function ctaEvidence(page) {
  return page.evaluate(() => {
    const cta = document.getElementById('add-to-cart');
    const r = cta.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      cta: { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom },
      hitElement: hit ? { id: hit.id || null, className: hit.className || null, tag: hit.tagName } : null,
      hitIsCta: !!hit && (hit === cta || cta.contains(hit)),
      ctaInViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    };
  });
}

export async function runAllChecks(rootDir, opts = {}) {
  const url = pathToFileURL(path.join(rootDir, 'index.html')).href;
  const browser = await chromium.launch();
  const defects = [];

  const ctaByViewport = {};
  let ctaPass = true;
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(url);
    const ev = await ctaEvidence(page);
    let clickOk = false;
    try { await page.click('#add-to-cart', { timeout: 3000 }); clickOk = (await page.textContent('#cart-count')).trim() === '1'; } catch { clickOk = false; }
    if (vp.name === 'mobile' && (opts.screenshot || screenshotPath)) {
      const shot = opts.screenshot || screenshotPath;
      await mkdir(path.dirname(path.resolve(shot)), { recursive: true });
      await page.screenshot({ path: shot });
    }
    ctaByViewport[vp.name] = { ...ev, clickOk };
    ctaPass = ctaPass && ev.ctaInViewport && ev.hitIsCta && clickOk;
    await page.close();
  }
  defects.push({
    id: 'cta-overlap', title: 'Add to Cart CTA obscured by overlapping element',
    severity: 'critical', severityRank: 1, pass: ctaPass,
    checks: {
      mobileInViewport: ctaByViewport.mobile.ctaInViewport, mobileNotObscured: ctaByViewport.mobile.hitIsCta, mobileClickable: ctaByViewport.mobile.clickOk,
      desktopInViewport: ctaByViewport.desktop.ctaInViewport, desktopNotObscured: ctaByViewport.desktop.hitIsCta, desktopClickable: ctaByViewport.desktop.clickOk,
    },
    evidence: ctaByViewport,
  });

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);
  const priceEv = await page.evaluate(() => {
    const product = window.CATALOG.products[0];
    return {
      catalog: { id: product.id, priceMinor: product.priceMinor, currency: product.currency },
      displayedPriceMinor: Number(document.getElementById('product-price').dataset.priceMinor),
    };
  });
  let cartCount = null, cartTotalMinor = null;
  try {
    // DOM click: isolate pricing logic from the CTA-overlap defect (which blocks pointer events)
    await page.evaluate(() => { document.getElementById('add-to-cart').click(); document.getElementById('add-to-cart').click(); });
    cartCount = Number((await page.textContent('#cart-count')).trim());
    cartTotalMinor = await page.evaluate(() => Number(document.getElementById('cart-total').dataset.totalMinor));
  } catch { /* click failure already reported by cta-overlap */ }
  await page.close();
  await browser.close();

  const expectedTotalMinor = priceEv.catalog.priceMinor * 2;
  const priceChecks = {
    displayedPriceMatchesCatalog: priceEv.displayedPriceMinor === priceEv.catalog.priceMinor,
    cartTotalMatchesCatalog: cartTotalMinor === expectedTotalMinor,
  };
  defects.push({
    id: 'price-mismatch', title: 'Cart total disagrees with canonical catalog price',
    severity: 'high', severityRank: 2, pass: Object.values(priceChecks).every(Boolean),
    checks: priceChecks,
    evidence: { ...priceEv, quantity: 2, cartCount, cartTotalMinor, expectedTotalMinor },
  });

  return { pass: defects.every((d) => d.pass), defects };
}

export const runCheck = runAllChecks;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runAllChecks(cliRoot);
  if (evidencePath) {
    await mkdir(path.dirname(path.resolve(evidencePath)), { recursive: true });
    await writeFile(evidencePath, JSON.stringify(result, null, 2));
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}
