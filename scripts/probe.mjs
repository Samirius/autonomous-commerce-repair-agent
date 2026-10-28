// Generic commerce probe (no AI, no defect names, no expected fixes).
// Reports whether generic storefront invariants hold, with evidence.
// Used by discovery mode and saved as structured evidence. The blind
// evaluation oracle in eval/ is separate and is never shown to the agent.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function expectedTotalMinor(catalog, qty) {
  const product = catalog.products[0];
  let total = product.priceMinor * qty;
  const rule = catalog.rules?.bulkDiscount;
  if (rule && qty >= rule.minQty) total = Math.round(total * (100 - rule.percentOff) / 100);
  return total;
}

export async function runProbe(rootDir, opts = {}) {
  const url = pathToFileURL(path.join(rootDir, 'index.html')).href;
  const browser = await chromium.launch();
  const signals = [];
  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small', width: 360, height: 740 },
    { name: 'desktop', width: 1280, height: 800 },
  ];
  let screenshotTaken = null;
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(url);
    const ev = await page.evaluate(() => {
      const out = { viewport: { width: innerWidth, height: innerHeight }, overflowX: document.documentElement.scrollWidth > innerWidth, interactives: [] };
      for (const el of document.querySelectorAll('button, a, input, select')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        out.interactives.push({
          id: el.id || null, text: (el.textContent || '').trim().slice(0, 40),
          box: { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
          inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          hitIsSelf: !!hit && (hit === el || el.contains(hit)),
          hitElement: hit ? { id: hit.id || null, className: String(hit.className || ''), tag: hit.tagName } : null,
        });
      }
      return out;
    });
    if (vp.name === 'mobile' && opts.screenshot) {
      await mkdir(path.dirname(path.resolve(opts.screenshot)), { recursive: true });
      await page.screenshot({ path: opts.screenshot });
      screenshotTaken = opts.screenshot;
    }
    for (const el of ev.interactives) {
      signals.push({ id: `interactive-usable@${vp.name}:${el.id || el.text}`, pass: el.inViewport && el.hitIsSelf, evidence: { viewport: vp, ...el } });
    }
    signals.push({ id: `no-horizontal-overflow@${vp.name}`, pass: !ev.overflowX, evidence: { viewport: vp, overflowX: ev.overflowX } });
    await page.close();
  }

  // Commerce-data invariants on a fresh page (DOM clicks isolate logic from layout)
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url);
  const data = await page.evaluate(() => {
    const catalog = window.CATALOG;
    const priceEl = document.getElementById('product-price');
    return {
      catalog,
      displayedPriceMinor: priceEl ? Number(priceEl.dataset.priceMinor) : null,
      displayedPriceText: priceEl?.textContent ?? null,
    };
  });
  await page.evaluate(() => { document.getElementById('add-to-cart').click(); });
  const after1 = await page.evaluate(() => ({
    count: Number(document.getElementById('cart-count').textContent),
    totalMinor: Number(document.getElementById('cart-total').dataset.totalMinor),
  }));
  await page.evaluate(() => { document.getElementById('add-to-cart').click(); });
  const after2 = await page.evaluate(() => ({
    count: Number(document.getElementById('cart-count').textContent),
    totalMinor: Number(document.getElementById('cart-total').dataset.totalMinor),
  }));
  await page.close();
  await browser.close();

  signals.push({ id: 'displayed-price-matches-catalog', pass: data.displayedPriceMinor === data.catalog.products[0].priceMinor, evidence: data });
  signals.push({ id: 'cart-count-matches-clicks', pass: after1.count === 1 && after2.count === 2, evidence: { after1, after2 } });
  signals.push({
    id: 'cart-total-matches-catalog-rules', pass: after1.totalMinor === expectedTotalMinor(data.catalog, 1) && after2.totalMinor === expectedTotalMinor(data.catalog, 2),
    evidence: { after1, after2, expectedQty1: expectedTotalMinor(data.catalog, 1), expectedQty2: expectedTotalMinor(data.catalog, 2), catalog: data.catalog },
  });
  return { pass: signals.every((s) => s.pass), signals, screenshot: screenshotTaken };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runProbe(path.resolve(process.argv[2] || 'storefront'), { screenshot: process.argv[3] });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}
