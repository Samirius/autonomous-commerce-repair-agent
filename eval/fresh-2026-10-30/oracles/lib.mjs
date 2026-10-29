// Fresh-store evaluation oracle driver. Never imported by agent code; the
// agent only ever receives a neutral `target/` copy of a fixture.
// Expected totals live in the per-store modules as HAND-COMPUTED integers,
// deliberately not derived from scripts/probe.mjs (independent specification,
// see docs/LEAKAGE_AUDIT.md L7).
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function runScenarios(rootDir, scenarios) {
  const url = pathToFileURL(path.join(rootDir, 'index.html')).href;
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const s of scenarios) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(url);
      const observed = await page.evaluate(({ items, promo }) => {
        for (const [id, qty] of items) {
          const btn = document.querySelector(`[data-add="${id}"]`);
          if (!btn) return { error: `no add button for ${id}` };
          for (let i = 0; i < qty; i++) btn.click();
        }
        if (promo) {
          document.getElementById('promo-code').value = promo;
          document.getElementById('apply-promo').click();
        }
        return {
          count: Number(document.getElementById('cart-count').textContent),
          totalMinor: Number(document.getElementById('cart-total').dataset.totalMinor),
        };
      }, s);
      results.push({ name: s.name, expectedTotalMinor: s.totalMinor, expectedCount: s.count, observed, pass: observed.totalMinor === s.totalMinor && observed.count === s.count });
      await page.close();
    }
  } finally { await browser.close(); }
  return { pass: results.every((r) => r.pass), failing: results.filter((r) => !r.pass).map((r) => r.name), results };
}
