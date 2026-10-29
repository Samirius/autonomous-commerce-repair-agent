// Offline fixture validation for the fresh-store evaluation (no model calls).
// For every store it checks, before any agent run:
//   1. the generic probe passes (the defect is invisible to automated checks),
//   2. the independent oracle FAILS on the pristine store (defect is real) —
//      or passes, for the healthy control,
//   3. the oracle PASSES on a hand-repaired copy (the oracle itself is right),
//   4. the agent's own typed tools can reach the defect: one cart-scenario
//      differs from the catalog-derived expectation.
// Usage: node eval/fresh-2026-10-30/validate-fixtures.mjs
import { mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { runProbe, runObservation, expectedScenarioMinor, normalizeScenarioItems } from '../../scripts/probe.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const stores = {
  'store-a': { buggy: true, fix: ['count > bulk.minQty', 'count >= bulk.minQty'], reach: { kind: 'cart-scenario', items: [{ id: 'house-blend', qty: 4 }] } },
  'store-b': { buggy: true, fix: ['lines.slice(0, SUMMARY_LINES).reduce', 'lines.reduce'], reach: { kind: 'cart-scenario', items: [{ id: 'desk-lamp', qty: 1 }, { id: 'monitor-arm', qty: 1 }, { id: 'cable-tray', qty: 1 }, { id: 'wrist-rest', qty: 1 }] } },
  'store-c': { buggy: true, fix: ['(qty >= 3 ? Math.round(p.priceMinor * 0.95) : p.priceMinor)', 'p.priceMinor'], reach: { kind: 'cart-scenario', items: [{ id: 'wool-socks', qty: 3 }] } },
  'store-d': { buggy: false, reach: { kind: 'cart-scenario', items: [{ id: 'desk-lamp', qty: 1 }, { id: 'monitor-arm', qty: 1 }, { id: 'cable-tray', qty: 1 }, { id: 'wrist-rest', qty: 1 }] } },
};

let allOk = true;
for (const [name, spec] of Object.entries(stores)) {
  const fixture = path.join(here, 'fixtures', name);
  const { runOracle } = await import(pathToFileURL(path.join(here, 'oracles', `${name}.mjs`)).href);
  const probe = await runProbe(fixture);
  const oraclePristine = await runOracle(fixture);
  let oracleFixed = null;
  if (spec.fix) {
    const dir = await mkdtemp(path.join(tmpdir(), 'fresh-fix-'));
    await cp(fixture, dir, { recursive: true });
    const app = await readFile(path.join(dir, 'app.js'), 'utf8');
    if (app.split(spec.fix[0]).length !== 2) throw new Error(`${name}: hand-fix anchor not found exactly once`);
    await writeFile(path.join(dir, 'app.js'), app.replace(spec.fix[0], () => spec.fix[1]));
    oracleFixed = await runOracle(dir);
  }
  const obs = await runObservation(fixture, spec.reach);
  const expected = expectedScenarioMinor(probe.catalog, normalizeScenarioItems(probe.catalog, spec.reach.items), null);
  const reachable = obs?.cart?.totalMinor !== expected;
  const ok = probe.pass && oraclePristine.pass === !spec.buggy && (!spec.fix || oracleFixed.pass) && reachable === spec.buggy;
  allOk &&= ok;
  console.log(`${name}: ${ok ? 'VALID' : 'INVALID'} | probe pass=${probe.pass} | oracle pristine pass=${oraclePristine.pass}${oraclePristine.failing.length ? ` (failing: ${oraclePristine.failing.join('; ')})` : ''} | oracle hand-fixed pass=${oracleFixed?.pass ?? 'n/a'} | tool scenario observed ${obs?.cart?.totalMinor} vs catalog ${expected}`);
}
process.exitCode = allOk ? 0 : 1;
