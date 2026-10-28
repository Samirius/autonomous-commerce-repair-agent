// Deterministic storefront check (no AI involved).
// Pass criteria at a 390x844 viewport:
//  1. #add-to-cart has a bounding box fully inside the viewport
//  2. elementFromPoint at the CTA centre is the CTA (or inside it) — not overlapped
//  3. a real Playwright click lands and increments the cart counter to 1
// Exit 0 = pass, 1 = fail. Always writes evidence JSON when --evidence is given.
import { chromium } from 'playwright';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const root = path.resolve(opt('--root', 'storefront'));
const evidencePath = opt('--evidence', null);
const screenshotPath = opt('--screenshot', null);

export async function runCheck(rootDir, opts = {}) {
  const shot = opts.screenshot || screenshotPath;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const url = pathToFileURL(path.join(rootDir, 'index.html')).href;
  await page.goto(url);
  const evidence = await page.evaluate(() => {
    const cta = document.getElementById('add-to-cart');
    const r = cta.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      cta: { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, text: cta.textContent.trim() },
      hitElement: hit ? { id: hit.id || null, className: hit.className || null, tag: hit.tagName } : null,
      hitIsCta: !!hit && (hit === cta || cta.contains(hit)),
      ctaInViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    };
  });
  let clickOk = false;
  let cartCount = null;
  try {
    await page.click('#add-to-cart', { timeout: 3000 });
    cartCount = await page.textContent('#cart-count');
    clickOk = cartCount.trim() === '1';
  } catch {
    clickOk = false;
  }
  if (shot) {
    await mkdir(path.dirname(path.resolve(shot)), { recursive: true });
    await page.screenshot({ path: shot, fullPage: false });
  }
  await browser.close();
  const checks = {
    ctaInViewport: evidence.ctaInViewport,
    ctaNotObscured: evidence.hitIsCta,
    ctaClickableIncrementsCart: clickOk,
  };
  return { pass: Object.values(checks).every(Boolean), checks, cartCount, ...evidence };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runCheck(root);
  if (evidencePath) {
    await mkdir(path.dirname(path.resolve(evidencePath)), { recursive: true });
    await writeFile(evidencePath, JSON.stringify(result, null, 2));
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.pass ? 0 : 1);
}
