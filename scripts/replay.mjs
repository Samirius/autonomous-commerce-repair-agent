// Keyless replay of recorded runs: prints the evidence -> verdict ->
// confirmation -> patch -> verification trail from committed run records.
// Makes no model calls and changes no files; nothing is re-executed.
// Usage: npm run replay                      (curated evidence/ runs)
//        npm run replay -- <verification.json> [...]
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const defaults = [
  'evidence/demo-verification.json',
  'evidence/investigation-proof-verification.json',
  'evidence/healthy-investigation-verification.json',
];
const files = process.argv.slice(2).length ? process.argv.slice(2) : defaults.filter((f) => existsSync(f));
const money = (m) => (Number.isFinite(m) ? (m / 100).toFixed(2) : String(m));
const short = (s, n = 160) => String(s ?? '').replace(/\s+/g, ' ').slice(0, n);

for (const file of files) {
  const run = JSON.parse(await readFile(file, 'utf8'));
  console.log(`\n=== ${file} (recorded ${run.finishedAt || 'unknown time'}) ===`);
  console.log(`initial failing probe signals: ${run.initialFailing?.length ? run.initialFailing.join(', ') : 'none (store passes every automated check)'}`);
  const inv = run.investigation;
  if (inv) {
    const obs = (run.receipts || []).filter((r) => r.status === 'investigation-observation');
    console.log(`investigation: ${obs.length} observation(s) chosen by the model over ${inv.turns} turn(s), ${inv.tokensUsed} tokens`);
    for (const r of obs) {
      const items = (r.request.items || []).map((i) => `${i.qty}x ${i.id || i.productId}`).join(' + ');
      const cart = r.observation?.cart || r.observation?.afterQty;
      console.log(`  - ${r.request.kind}: ${items}${r.request.promoCode ? ` with ${r.request.promoCode}` : ''} -> cart total ${money(cart?.totalMinor)}`);
    }
    if (inv.verdict) console.log(`model verdict: ${inv.verdict.verdict} — ${short(inv.verdict.suspectedIssue || inv.verdict.evidenceSummary)}`);
    if (inv.confirmation) console.log(`deterministic confirmation: expected ${money(inv.confirmation.expected)}, observed ${money(inv.confirmation.observed)} -> ${inv.confirmation.confirmed ? 'DEFECT CONFIRMED' : 'not confirmed'}`);
  }
  for (const r of (run.receipts || []).filter((x) => x.repair)) {
    console.log(`patch [${r.status}] ${r.repair.file}: ${short(r.repair.diagnosis, 120)}`);
    console.log(`    - ${short(r.repair.old, 140)}`);
    console.log(`    + ${short(r.repair.new, 140)}`);
    if (r.model?.id) console.log(`    model ${r.model.model || ''} response ${r.model.id}, ${r.model.usage?.total_tokens ?? '?'} tokens`);
    if (r.review) console.log(`    open-weight review: ${r.review.openWeight}${r.openWeightVerification?.id ? ` (response ${r.openWeightVerification.id})` : ''}`);
  }
  console.log(`final state: ${run.state}; repairs committed: ${run.repairsCommitted}; final probe pass: ${run.finalPass}`);
}
if (!files.length) console.log('No recorded runs found.');
