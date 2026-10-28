// External blind-evaluation runner (Mission 004).
// The evaluator supplies a fixture directory (and optionally their own
// oracle module) from OUTSIDE the agent's accessible tree. This runner:
//   1. copies the fixture to a neutral directory named `target/` — the
//      fixture/scenario name never reaches the agent (not even as a path),
//   2. optionally runs the evaluator's oracle on the pristine copy,
//   3. runs the agent (src/discover.mjs) as a SUBPROCESS whose only inputs
//      are the copied target dir and an artifacts dir — the oracle path is
//      never passed to it, in argv or env,
//   4. optionally re-runs the oracle, diffs pristine vs final per file,
//   5. writes a self-contained results bundle (manifest.json).
//
// Usage:
//   node eval/external/run-external.mjs --fixture <abs path> [--oracle <abs path to .mjs exporting runOracle(rootDir)>] [--out <dir>]
// Env: MODEL_API_KEY (or project .env) for the agent's model provider.
import { cp, mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const fixture = arg('--fixture');
if (!fixture || !existsSync(fixture)) { console.error('Required: --fixture <existing directory>'); process.exit(2); }
const oraclePath = arg('--oracle');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(arg('--out') || path.join('eval', 'results', `external-${stamp}`));
const pristineDir = path.join(outDir, 'pristine');
const targetDir = path.join(outDir, 'target');
const agentDir = path.join(outDir, 'agent');
await mkdir(outDir, { recursive: true });
await cp(fixture, pristineDir, { recursive: true });
await cp(fixture, targetDir, { recursive: true });

async function hashFiles(dir) {
  const out = {};
  for (const f of (await readdir(dir)).sort()) {
    const p = path.join(dir, f);
    try { out[f] = createHash('sha256').update(await readFile(p)).digest('hex').slice(0, 16); } catch { /* dirs ignored */ }
  }
  return out;
}

let oracle = null;
async function runEvaluatorOracle(label) {
  const mod = await import(pathToFileURL(path.resolve(oraclePath)).href);
  const result = await mod.runOracle(targetDir);
  await writeFile(path.join(outDir, `oracle-${label}.json`), JSON.stringify(result, null, 2));
  return result;
}
if (oraclePath) oracle = { before: await runEvaluatorOracle('before') };

// Agent subprocess: scrubbed env (model keys only), no oracle information.
const env = { ...process.env };
delete env.ORACLE_PATH;
const child = spawnSync(process.execPath, [path.resolve('src/discover.mjs'), '--root', targetDir, '--run-dir', agentDir],
  { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 600_000 });
await writeFile(path.join(outDir, 'agent-stdout.log'), child.stdout || '');
await writeFile(path.join(outDir, 'agent-stderr.log'), (child.stderr || '').slice(-4000));

let agentSummary = null;
try { agentSummary = JSON.parse(await readFile(path.join(agentDir, 'verification.json'), 'utf8')); } catch { /* agent failed */ }
if (oraclePath) oracle.after = await runEvaluatorOracle('after');

// Per-file diffs (pristine vs agent's final target)
await mkdir(path.join(outDir, 'diffs'), { recursive: true });
const beforeHashes = await hashFiles(pristineDir);
const afterHashes = await hashFiles(targetDir);
const changedFiles = Object.keys({ ...beforeHashes, ...afterHashes }).filter((f) => beforeHashes[f] !== afterHashes[f]);
for (const f of changedFiles) {
  let diff = '';
  try { diff = execFileSync('git', ['diff', '--no-index', '--', path.join(pristineDir, f), path.join(targetDir, f)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch (e) { diff = e.stdout || '(diff unavailable)'; }
  await writeFile(path.join(outDir, 'diffs', `${f}.diff`), diff);
}

const manifest = {
  interface: 'external-eval/v1',
  finishedAt: new Date().toISOString(),
  fixtureFileHashes: beforeHashes,
  agentExitCode: child.status,
  agentSummary: agentSummary && {
    repairsCommitted: agentSummary.repairsCommitted, finalPass: agentSummary.finalPass,
    attempts: agentSummary.receipts?.length ?? null,
    tokens: agentSummary.receipts?.reduce((n, r) => n + (r.model?.usage?.total_tokens || 0), 0),
    receipts: agentSummary.receipts,
  },
  changedFiles, oracle,
  bundleContents: ['manifest.json', 'pristine/', 'target/ (agent final state)', 'agent/ (probe, screenshots, model decisions, patches, history, verification)', 'diffs/', 'oracle-before.json / oracle-after.json (if --oracle given)', 'agent-stdout.log / agent-stderr.log'],
};
await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`bundle: ${outDir}`);
console.log(`agent exit=${child.status} repairs=${agentSummary?.repairsCommitted} probeFinalPass=${agentSummary?.finalPass} oracleAfter=${oracle?.after?.pass ?? 'n/a'} changed=${changedFiles.join(',') || 'none'}`);
