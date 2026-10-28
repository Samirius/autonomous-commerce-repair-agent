// One-off live check of the Baseten Muse Spark Open verifier (Mission 008 Task 5).
// Reads BASETEN_API_KEY from the environment; prints verdict + usage only.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createVerifier } from './verifier.mjs';

const v = createVerifier();
console.log('available:', v.available, v.provider, v.model, v.baseUrl);
if (!v.available) { console.log('BLOCKED:', v.reason); process.exit(1); }
const started = Date.now();
const r = await v.review({
  repair: {
    file: 'app.js',
    old: 'const discount = Math.round(firstPrice * promoPercent / 100);',
    new: 'const discount = Math.round(subtotal * promoPercent / 100);',
    diagnosis: 'Promo discount was computed on the first cart line instead of the subtotal',
  },
  evidenceBefore: { scenario: 'mixed cart (3 products, qty 1 each) + SAVE10', observedTotalMinor: 19910, expectedTotalMinor: 19080 },
  evidenceAfter: { scenario: 'same scenario after repair', observedTotalMinor: 19080, fullProbePass: true },
});
const record = { ...r, elapsedMs: Date.now() - started, reviewedAt: new Date().toISOString() };
console.log('response id:', r.id);
console.log('usage:', JSON.stringify(r.usage));
console.log('verdict:', JSON.stringify(r.parsed));
await mkdir(path.resolve('artifacts/openweight'), { recursive: true });
await writeFile(path.resolve('artifacts/openweight/verifier-live-check.json'), JSON.stringify(record, null, 2));
console.log('saved: artifacts/openweight/verifier-live-check.json');
