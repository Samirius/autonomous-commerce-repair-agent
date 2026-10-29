// Repeatable 3-minute demo (Mission 008).
// Copies the pristine broken fixture to a fresh target, runs discovery with
// real Meta API calls, and prints the evidence -> patch -> verification
// trail. No manual resetting: the fixture is never modified.
// Usage: npm run demo        (MODEL_API_KEY via env or .env)
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { discoverAndRepair } from '../src/discover.mjs';
import { createProvider } from '../src/provider.mjs';
import { createVerifier } from '../src/verifier.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
// Fail fast, before creating any artifact folder, and point keyless viewers
// (e.g. judges) at the recorded runs instead of a stack trace.
let provider;
try { provider = createProvider(); } catch (e) {
  console.error(`Live demo needs a Meta Model API key: ${e.message}`);
  console.error('Without a key, replay the recorded runs instead:  npm run replay');
  process.exit(2);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const demoRoot = path.resolve('artifacts', `demo-${stamp}`);
const target = path.join(demoRoot, 'target');
const runDir = path.join(demoRoot, 'run');
await mkdir(demoRoot, { recursive: true });
await cp(path.resolve('fixtures/demo-broken'), target, { recursive: true });

console.log('=== Autonomous Commerce Repair Agent — demo ===');
console.log(`Pristine broken fixture copied to a fresh target (fixture untouched).`);
console.log(`Artifacts: ${demoRoot}\n--- agent run (live model calls: ${provider.provider}/${provider.model}) ---`);
const started = Date.now();
const summary = await discoverAndRepair({ root: target, runDir, provider, verifier: createVerifier() });
const elapsedS = Math.round((Date.now() - started) / 1000);

const tokens = summary.receipts.reduce((n, r) => n + (r.model?.usage?.total_tokens || 0), 0);
console.log('\n--- demo result ---');
console.log(`state:            ${summary.state}`);
console.log(`initial failures: ${summary.initialFailing.join(', ') || 'none'}`);
console.log(`repairs:          ${summary.repairsCommitted} committed`);
console.log(`final probe pass: ${summary.finalPass}`);
console.log(`model receipts:   ${summary.receipts.length} (${tokens} tokens, ${elapsedS}s)`);
for (const r of summary.receipts) {
  if (r.repair) console.log(`  patch [${r.status}] ${r.repair.file}: ${r.repair.old} -> ${r.repair.new}`);
}
console.log(`\nbefore screenshot: ${path.join(runDir, 'before.png')}`);
console.log(`after screenshot:  ${path.join(runDir, 'after.png')}`);
console.log(`evidence:          ${path.join(runDir, 'probe-before.json')} / probe-after.json`);
console.log(`verification:      ${path.join(runDir, 'verification.json')}`);
await writeFile(path.join(demoRoot, 'demo-summary.json'), JSON.stringify({ ...summary, elapsedS, tokens }, null, 2));
process.exitCode = summary.finalPass ? 0 : 1;
