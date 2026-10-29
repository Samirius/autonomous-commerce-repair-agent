// Generic commerce probe v2 (no AI, no defect names, no expected fixes).
// Investigates like a commerce engineer:
//  - every product PRESENTED on the page (name visible in the DOM): displayed
//    price (DOM attribute and visible text) vs the canonical catalog price
//  - every presented product's purchase control, at mobile/small/desktop
//  - cart behaviour per product (x2), in mixed-product carts, with quantity
//    controls and with each catalog promo code the UI supports
//  - console errors / page errors during load and interaction
// All money in integer minor units. Also exports runObservation(), the safe,
// allowlisted observation types the model may request mid-diagnosis.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function expectedTotalMinor(catalog, qty, product = catalog.products[0]) {
  let total = product.priceMinor * qty;
  const rule = catalog.rules?.bulkDiscount;
  if (rule && qty >= rule.minQty) total = Math.round(total * (100 - rule.percentOff) / 100);
  return total;
}
export function expectedCartMinor(catalog, items) {
  // items: [{id, qty}] — subtotal, then bulk rule on total qty, no promo
  let subtotal = 0, qty = 0;
  for (const it of items) {
    const p = catalog.products.find((x) => x.id === it.id);
    if (!p) continue;
    subtotal += p.priceMinor * it.qty; qty += it.qty;
  }
  const rule = catalog.rules?.bulkDiscount;
  if (rule && qty >= rule.minQty) return Math.round(subtotal * (100 - rule.percentOff) / 100);
  return subtotal;
}

// The ONE normalisation used both to execute a scenario in the browser and to
// compute its expected total: {id|productId, qty}, catalog ids only, qty 1..5,
// at most 4 lines. Expected and observed must describe the same basket.
export function normalizeScenarioItems(catalog, raw) {
  return (raw || []).map((it) => ({ id: it.id || it.productId, qty: it.qty ?? 1 }))
    .filter((it) => catalog.products.some((p) => p.id === it.id) && it.qty >= 1 && it.qty <= 5).slice(0, 4);
}

export function expectedScenarioMinor(catalog, items, promoCode = null) {
  // items: [{id, qty}] — bulk rule first (expectedCartMinor), then promo % off
  let total = expectedCartMinor(catalog, items);
  const pct = promoCode ? catalog.rules?.promoCodes?.[promoCode] : 0;
  if (pct) total -= Math.round(total * pct / 100);
  return total;
}

const parseMoney = (text) => {
  const m = String(text || '').replace(/,/g, '').match(/(\d+)\.(\d{2})/);
  return m ? Number(m[1]) * 100 + Number(m[2]) : null;
};

// Page-side: catalogue of presented products with their price + buy control.
// (Self-contained: no external references allowed inside evaluate.)
function presentedProductsJS() {
  const catalog = window.CATALOG;
  const all = [...document.querySelectorAll('body *')];
  const presented = [];
  for (const product of catalog.products) {
    const nameEls = all.filter((el) => el.children.length === 0 && el.textContent.trim() === product.name)
      .concat(all.filter((el) => el.children.length > 0 && el.children.length <= 3 && el.textContent.trim().startsWith(product.name) && el.textContent.trim().length < product.name.length + 30));
    if (!nameEls.length) continue;
    let container = nameEls[0];
    let priceMinorAttr = null, priceText = null, priceTextMinor = null, addSelector = null;
    for (let depth = 0; depth < 7 && container; depth++) {
      const priceEl = container.querySelector?.('[data-price-minor]');
      if (priceEl) { priceMinorAttr = Number(priceEl.dataset.priceMinor); priceText = priceEl.textContent.trim(); break; }
      container = container.parentElement;
    }
    if (priceText) {
      const m = priceText.replace(/,/g, '').match(/(\d+)\.(\d{2})/);
      priceTextMinor = m ? Number(m[1]) * 100 + Number(m[2]) : null;
    }
    // purchase control: inside the product container, else the featured CTA for the first product
    let scope = nameEls[0];
    for (let depth = 0; depth < 7 && scope && !addSelector; depth++) {
      const btn = scope.querySelector?.('[data-add], button');
      if (btn) addSelector = btn.dataset?.add ? `[data-add="${btn.dataset.add}"]` : (btn.id ? `#${btn.id}` : null);
      scope = scope.parentElement;
    }
    if (!addSelector && document.getElementById('add-to-cart') && catalog.products[0].id === product.id) addSelector = '#add-to-cart';
    presented.push({ id: product.id, name: product.name, catalogPriceMinor: product.priceMinor, priceMinorAttr, priceText, priceTextMinor, addSelector });
  }
  return presented;
}

async function freshPage(browser, url, errors, viewport = { width: 390, height: 844 }) {
  const page = await browser.newPage({ viewport });
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console: ${msg.text().slice(0, 200)}`); });
  page.on('pageerror', (err) => errors.push(`pageerror: ${String(err).slice(0, 200)}`));
  await page.goto(url);
  return page;
}
const readCart = (page) => page.evaluate(() => ({
  count: Number(document.getElementById('cart-count')?.textContent || NaN),
  totalMinor: Number(document.getElementById('cart-total')?.dataset.totalMinor ?? NaN),
}));
async function domClick(page, selector, times = 1) {
  await page.evaluate(([sel, n]) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`not found: ${sel}`);
    for (let i = 0; i < n; i++) el.click();
  }, [selector, times]);
}

export async function runProbe(rootDir, opts = {}) {
  const url = pathToFileURL(path.join(rootDir, 'index.html')).href;
  const browser = await chromium.launch();
  const signals = [];
  const errors = [];
  const viewports = [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'small', width: 360, height: 740 },
    { name: 'desktop', width: 1280, height: 800 },
  ];

  // --- layout/usability per viewport (+ screenshots) ---
  for (const vp of viewports) {
    const page = await freshPage(browser, url, errors, { width: vp.width, height: vp.height });
    const ev = await page.evaluate(async () => {
      const out = { viewport: { width: innerWidth, height: innerHeight }, overflowX: document.documentElement.scrollWidth > innerWidth, interactives: [] };
      for (const el of document.querySelectorAll('button, a, input, select')) {
        el.scrollIntoView({ block: 'center' });
        await new Promise((r) => setTimeout(r, 30));
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        out.interactives.push({
          id: el.id || null, text: (el.textContent || el.value || '').trim().slice(0, 40),
          box: { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom },
          inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          hitIsSelf: !!hit && (hit === el || el.contains(hit)),
          hitElement: hit ? { id: hit.id || null, className: String(hit.className || ''), tag: hit.tagName } : null,
        });
      }
      return out;
    });
    if (vp.name === 'mobile' && opts.screenshot) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await mkdir(path.dirname(path.resolve(opts.screenshot)), { recursive: true });
      await page.screenshot({ path: opts.screenshot });
    }
    if (vp.name === 'desktop' && opts.screenshotDesktop) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await mkdir(path.dirname(path.resolve(opts.screenshotDesktop)), { recursive: true });
      await page.screenshot({ path: opts.screenshotDesktop });
    }
    for (const el of ev.interactives) {
      signals.push({ id: `interactive-usable@${vp.name}:${el.id || el.text}`, pass: el.inViewport && el.hitIsSelf, evidence: { viewport: vp, ...el } });
    }
    signals.push({ id: `no-horizontal-overflow@${vp.name}`, pass: !ev.overflowX, evidence: { viewport: vp, overflowX: ev.overflowX } });
    await page.close();
  }

  // --- presented products: prices vs catalog ---
  let page = await freshPage(browser, url, errors);
  const catalog = await page.evaluate(() => window.CATALOG);
  const presented = await page.evaluate(presentedProductsJS);
  await page.close();
  signals.push({ id: 'catalog-products-presented', pass: presented.length > 0, evidence: { presented: presented.map((p) => p.id), catalogCount: catalog.products.length } });
  for (const p of presented) {
    signals.push({
      id: `displayed-price-matches-catalog:${p.id}`,
      pass: p.priceMinorAttr === p.catalogPriceMinor && (p.priceTextMinor === null || p.priceTextMinor === p.catalogPriceMinor),
      evidence: p,
    });
  }
  // Backwards-compatible featured-product signal (Mission 002/003 consumers)
  const featured = presented.find((p) => p.id === catalog.products[0].id);
  signals.push({ id: 'displayed-price-matches-catalog', pass: !!featured && featured.priceMinorAttr === catalog.products[0].priceMinor, evidence: featured || { presented: [] } });

  // --- per-product cart behaviour (x2 each, isolated logic via DOM clicks) ---
  for (const p of presented) {
    if (!p.addSelector) {
      signals.push({ id: `product-purchasable:${p.id}`, pass: false, evidence: { ...p, reason: 'no purchase control found' } });
      continue;
    }
    const pg = await freshPage(browser, url, errors);
    let cart = { count: NaN, totalMinor: NaN }, clickError = null;
    try { await domClick(pg, p.addSelector, 2); cart = await readCart(pg); } catch (e) { clickError = String(e).slice(0, 200); }
    signals.push({
      id: `cart-total-for-product:${p.id}`,
      pass: cart.count === 2 && cart.totalMinor === expectedTotalMinor(catalog, 2, catalog.products.find((x) => x.id === p.id)),
      evidence: { product: p.id, qty: 2, cart, clickError },
    });
    await pg.close();
  }

  // --- featured-product legacy signals (kept for existing consumers) ---
  {
    const pg = await freshPage(browser, url, errors);
    await domClick(pg, '#add-to-cart', 1).catch(() => {});
    const after1 = await readCart(pg);
    await domClick(pg, '#add-to-cart', 1).catch(() => {});
    const after2 = await readCart(pg);
    signals.push({ id: 'cart-count-matches-clicks', pass: after1.count === 1 && after2.count === 2, evidence: { after1, after2 } });
    signals.push({
      id: 'cart-total-matches-catalog-rules',
      pass: after1.totalMinor === expectedTotalMinor(catalog, 1) && after2.totalMinor === expectedTotalMinor(catalog, 2),
      evidence: { after1, after2, expectedQty1: expectedTotalMinor(catalog, 1), expectedQty2: expectedTotalMinor(catalog, 2), catalog },
    });
    await pg.close();
  }

  // --- mixed-product cart ---
  if (presented.length >= 2 && presented.every((p) => p.addSelector)) {
    const pg = await freshPage(browser, url, errors);
    const items = presented.slice(0, 3).map((p) => ({ id: p.id, qty: 1 }));
    let cart = { count: NaN, totalMinor: NaN }, clickError = null;
    try {
      for (const p of presented.slice(0, 3)) await domClick(pg, p.addSelector, 1);
      cart = await readCart(pg);
    } catch (e) { clickError = String(e).slice(0, 200); }
    signals.push({
      id: 'mixed-cart-total-matches-catalog',
      pass: cart.count === items.length && cart.totalMinor === expectedCartMinor(catalog, items),
      evidence: { items, cart, clickError },
    });
    await pg.close();
  }

  // --- quantity controls (if the UI exposes them for a presented product) ---
  {
    const pg = await freshPage(browser, url, errors);
    if (featured?.addSelector) {
      await domClick(pg, featured.addSelector, 1);
      const hasQty = await pg.evaluate(() => !!document.querySelector('[data-inc], [data-dec]'));
      if (hasQty) {
        const beforeQty = await readCart(pg);
      await pg.evaluate(() => document.querySelector('[data-inc]')?.click());
      const afterInc = await readCart(pg);
      signals.push({
        id: 'quantity-increase-updates-total',
        pass: afterInc.count === beforeQty.count + 1 && afterInc.totalMinor === expectedCartMinor(catalog, [{ id: featured.id, qty: 2 }]),
        evidence: { beforeQty, afterInc },
      });
      }
    }
    await pg.close();
  }

  // --- every promo code from the catalog, if the UI supports applying one ---
  const promoCodes = Object.entries(catalog.rules?.promoCodes || {});
  for (const [code, pct] of promoCodes) {
    const pg = await freshPage(browser, url, errors);
    const hasPromoUI = await pg.evaluate(() => !!document.getElementById('promo-code') && !!document.getElementById('apply-promo'));
    if (hasPromoUI && featured?.addSelector) {
      await domClick(pg, featured.addSelector, 1);
      await pg.fill('#promo-code', code);
      await pg.click('#apply-promo');
      const cart = await readCart(pg);
      const expected = Math.round(featured.catalogPriceMinor * (100 - pct) / 100);
      signals.push({ id: `promo-code-applies-correctly:${code}`, pass: cart.totalMinor === expected, evidence: { code, pct, cart, product: featured.id } });
    }
    await pg.close();
  }

  // --- pointer-level purchase test for the featured product ---
  {
    const pg = await freshPage(browser, url, errors);
    let ok = false;
    try { await pg.click('#add-to-cart', { timeout: 3000 }); ok = (await readCart(pg)).count === 1; } catch { ok = false; }
    signals.push({ id: 'pointer-purchase-works:featured', pass: ok, evidence: { method: 'real pointer click on #add-to-cart' } });
    await pg.close();
  }

  await browser.close();
  signals.push({ id: 'no-console-errors', pass: errors.length === 0, evidence: { errors: errors.slice(0, 10) } });
  return { pass: signals.every((s) => s.pass), signals, presented, catalog };
}

// Safe, allowlisted observations the MODEL may request mid-diagnosis.
// No arbitrary code: only these scenario shapes, validated against the catalog.
export async function runObservation(rootDir, request) {
  const kinds = ['cart-scenario', 'product-detail', 'console-reload', 'quantity-change', 'apply-promo', 'inspect-cart', 'viewport'];
  if (!request || !kinds.includes(request.kind)) return { error: `observation kind must be one of ${kinds.join(', ')}` };
  const url = pathToFileURL(path.join(rootDir, 'index.html')).href;
  const browser = await chromium.launch();
  const errors = [];
  const page = await freshPage(browser, url, errors);
  const catalog = await page.evaluate(() => window.CATALOG);
  const normItems = (raw) => normalizeScenarioItems(catalog, raw);
  const addItems = async (items) => {
    const presented = await page.evaluate(presentedProductsJS);
    for (const it of items) {
      const p = presented.find((x) => x.id === it.id);
      if (!p?.addSelector) throw new Error(`product ${it.id} is not presented/purchasable on the page`);
      await domClick(page, p.addSelector, it.qty);
    }
  };
  let result;
  if (request.kind === 'console-reload') {
    const beforeReload = errors.length;
    await page.reload();
    await page.waitForTimeout(150);
    result = { kind: request.kind, reloaded: true, reloadErrors: errors.slice(beforeReload), allErrors: errors };
  } else if (request.kind === 'viewport') {
    const allowed = [360, 390, 768, 1280];
    const width = allowed.includes(request.width) ? request.width : 390;
    await page.setViewportSize({ width, height: Math.round(width * 1.8) });
    await page.waitForTimeout(100);
    const summary = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      overflowX: document.documentElement.scrollWidth > innerWidth,
      title: document.title,
    }));
    result = { kind: request.kind, ...summary, screenshotRequested: true, width };
  } else if (request.kind === 'product-detail') {
    const presented = await page.evaluate(presentedProductsJS);
    result = { kind: request.kind, product: presented.find((p) => p.id === (request.productId || request.id)) || null, presented };
  } else {
    const items = normItems(request.items);
    if (!items.length) { await browser.close(); return { error: 'observation needs items [{id|productId, qty 1..5}] using catalog product ids' }; }
    try { await addItems(items); } catch (e) { await browser.close(); return { error: String(e).slice(0, 200) }; }
    let promoApplied = null;
    if (request.kind === 'cart-scenario' && request.promoCode && catalog.rules?.promoCodes?.[request.promoCode]) {
      const hasUI = await page.evaluate(() => !!document.getElementById('promo-code') && !!document.getElementById('apply-promo'));
      if (hasUI) { await page.fill('#promo-code', request.promoCode); await page.click('#apply-promo'); }
      promoApplied = hasUI ? request.promoCode : null;
    }
    if (request.kind === 'apply-promo') {
      const code = request.promoCode;
      if (!code || !catalog.rules?.promoCodes?.[code]) { await browser.close(); return { error: `promoCode must be one of ${Object.keys(catalog.rules?.promoCodes || {}).join(', ')}` }; }
      const hasUI = await page.evaluate(() => !!document.getElementById('promo-code') && !!document.getElementById('apply-promo'));
      if (!hasUI) { await browser.close(); return { error: 'promo UI not present on this page' }; }
      await page.fill('#promo-code', code);
      await page.click('#apply-promo');
      promoApplied = code;
    }
    if (request.kind === 'quantity-change') {
      const target = request.productId || request.id || items[0].id;
      const beforeQty = await readCart(page);
      const delta = request.delta === -1 ? -1 : 1;
      const selector = delta === 1 ? `[data-inc="${target}"]` : `[data-dec="${target}"]`;
      const hasControl = await page.evaluate((sel) => !!document.querySelector(sel), selector);
      if (!hasControl) { await browser.close(); return { error: `quantity control ${selector} not present after adding items` }; }
      await page.evaluate((sel) => document.querySelector(sel).click(), selector);
      const afterQty = await readCart(page);
      result = { kind: request.kind, target, delta, beforeQty, afterQty, errors };
      await browser.close();
      return result;
    }
    const cart = await readCart(page);
    const cartState = await page.evaluate(() => ({
      lines: [...document.querySelectorAll('#cart-lines, .cart-line, [data-cart-line]')].map((el) => el.textContent.trim().slice(0, 160)).slice(0, 8),
      subtotalMinor: Number(document.getElementById('cart-subtotal')?.dataset.subtotalMinor ?? NaN),
      discountMinor: Number(document.getElementById('cart-discount')?.dataset.discountMinor ?? NaN),
      promoStatus: document.getElementById('promo-status')?.textContent ?? null,
      checkoutText: document.getElementById('checkout')?.textContent ?? null,
    }));
    result = { kind: request.kind, items, promoApplied, cart, cartState, catalogRuleSummary: catalog.rules || null, errors };
    if (request.kind === 'inspect-cart' && request.tryCheckout) {
      const hasCheckout = await page.evaluate(() => !!document.getElementById('checkout'));
      if (hasCheckout) {
        await page.click('#checkout');
        result.checkoutStatus = await page.evaluate(() => document.getElementById('checkout-status')?.textContent ?? null);
      }
    }
  }
  await browser.close();
  return result;
}

export async function runViewportScreenshot(rootDir, width, outPath) {
  const allowed = [360, 390, 768, 1280];
  const w = allowed.includes(width) ? width : 390;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: w, height: Math.round(w * 1.8) } });
  await page.goto(pathToFileURL(path.join(rootDir, 'index.html')).href);
  await mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
  await page.screenshot({ path: outPath });
  await browser.close();
  return { width: w, screenshot: path.basename(outPath) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runProbe(path.resolve(process.argv[2] || 'storefront'));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}
