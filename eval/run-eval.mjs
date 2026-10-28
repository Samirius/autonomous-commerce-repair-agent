// Blind evaluation harness (Mission 003).
// For each unseen variant: copy it to a work dir, run the PRIVATE oracle
// (expect fail), run discovery mode against the copy only, re-run the oracle.
// The agent never sees eval/, variant names, or oracle assertions.
// Usage: node eval/run-eval.mjs [--only v1,v3]
import { cp, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { runOracle } from './oracles.mjs';
import { discoverAndRepair } from '../src/discover.mjs';
import { createProvider } from '../src/provider.mjs';
import { createVerifier } from '../src/verifier.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const resultsDir = path.resolve('eval', 'results', `eval-${stamp}`);
await mkdir(resultsDir, { recursive: true });

const { readdirSync } = await import('node:fs');
const variants = readdirSync(path.resolve('eval', 'variants'), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name).sort()
  .filter((v) => !onlyArg || onlyArg.some((o) => v.startsWith(o)));

const provider = createProvider();
const verifier = createVerifier();
console.log(`provider=${provider.provider}/${provider.model} verifier=${verifier.available ? `${verifier.provider}/${verifier.model}` : `unavailable (${verifier.reason})`}`);
const rows = [];
for (const variant of variants) {
  const work = path.join(resultsDir, 'work', variant);
  await cp(path.resolve('eval', 'variants', variant), work, { recursive: true });
  const before = await runOracle(variant, work);
  const summary = await discoverAndRepair({ root: work, runDir: path.join(resultsDir, variant), provider, verifier });
  const after = await runOracle(variant, work);
  const attempts = summary.receipts.length;
  const tokens = summary.receipts.reduce((n, r) => n + (r.model?.usage?.total_tokens || 0), 0);
  const regressions = Object.keys(before.checks).filter((k) => before.checks[k] && !after.checks[k]);
  const row = {
    variant, oracleBeforePass: before.pass, oracleAfterPass: after.pass,
    discovered: attempts > 0, success: !before.pass && after.pass,
    attempts, repairsCommitted: summary.repairsCommitted,
    rolledBack: summary.receipts.filter((r) => r.status === 'rolled-back').length,
    rejected: summary.receipts.filter((r) => r.status === 'rejected').length,
    regressions, tokens,
    beforeChecks: before.checks, afterChecks: after.checks,
  };
  rows.push(row);
  console.log(`${variant}: before=${before.pass} after=${after.pass} attempts=${attempts} tokens=${tokens} regressions=${regressions.length}`);
  await writeFile(path.join(resultsDir, `${variant}-oracle.json`), JSON.stringify({ before, after }, null, 2));
}
const totals = {
  variants: rows.length,
  discovered: rows.filter((r) => r.discovered).length,
  succeeded: rows.filter((r) => r.success).length,
  failed: rows.filter((r) => !r.success).length,
  totalAttempts: rows.reduce((n, r) => n + r.attempts, 0),
  totalTokens: rows.reduce((n, r) => n + r.tokens, 0),
  totalRegressions: rows.reduce((n, r) => n + r.regressions.length, 0),
  verifierAvailable: verifier.available,
};
await writeFile(path.join(resultsDir, 'summary.json'), JSON.stringify({ totals, rows }, null, 2));
console.log('TOTALS', JSON.stringify(totals));
console.log(`results: ${resultsDir}`);
