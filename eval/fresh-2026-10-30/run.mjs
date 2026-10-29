// Fresh-store evaluation: ONE live run per store, harness frozen, results
// published whatever they are (see PREREGISTRATION.md for the rules).
// Each store goes through eval/external/run-external.mjs: neutral target/
// copy, agent subprocess, oracle kept outside the agent.
// Usage (repo root, MODEL_API_KEY in env or .env):  npm run eval:fresh
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { createProvider } from '../../src/provider.mjs';

if (existsSync('.env')) process.loadEnvFile('.env');
try { createProvider(); } catch (e) { console.error(`${e.message}\nThis evaluation makes live Meta Model API calls; put MODEL_API_KEY in .env first.`); process.exit(2); }

const base = 'eval/fresh-2026-10-30';
const stores = [
  { id: 'store-a', buggy: true },
  { id: 'store-b', buggy: true },
  { id: 'store-c', buggy: true },
  { id: 'store-d', buggy: false },
];
const harnessCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'src', 'scripts', 'eval/external', base], { encoding: 'utf8' }).trim();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outRoot = path.resolve('eval', 'results', `fresh-${stamp}`);
const evidenceDir = path.join('evidence', 'fresh-2026-10-30');
await mkdir(evidenceDir, { recursive: true });

// Pre-registered outcome classes (PREREGISTRATION.md). Decided only from the
// agent's recorded state and the independent oracle, never from model text.
function classify(store, m) {
  const state = m.agentSummary?.state || 'agent-failed';
  const oracleAfter = m.oracle?.after?.pass;
  if (store.buggy) {
    if (state === 'confirmed-issue-repaired' && oracleAfter) return 'FOUND+REPAIRED';
    if (state === 'confirmed-issue-repaired') return 'REPAIRED-BUT-ORACLE-FAILS';
    if (state === 'confirmed-issue-unrepaired') return 'FOUND-NOT-REPAIRED';
    if (state === 'suspected-unverified') return 'SUSPECTED-NOT-CONFIRMED';
    if (state === 'verified-healthy') return 'MISSED (false healthy)';
    return `MISSED (${state})`;
  }
  if (state === 'verified-healthy' && !m.changedFiles.length) return 'CORRECT-HEALTHY';
  if (m.changedFiles.length) return 'FALSE-ALARM (code changed)';
  return `NO-FALSE-ALARM (${state})`;
}

const rows = [];
for (const store of stores) {
  console.log(`\n=== ${store.id} ===`);
  const out = path.join(outRoot, store.id);
  const child = spawnSync(process.execPath, ['eval/external/run-external.mjs', '--fixture', path.resolve(base, 'fixtures', store.id), '--oracle', path.resolve(base, 'oracles', `${store.id}.mjs`), '--out', out], { stdio: 'inherit' });
  let manifest = null;
  try { manifest = JSON.parse(await readFile(path.join(out, 'manifest.json'), 'utf8')); } catch { /* runner failed */ }
  if (existsSync(path.join(out, 'agent', 'verification.json'))) await copyFile(path.join(out, 'agent', 'verification.json'), path.join(evidenceDir, `${store.id}-verification.json`));
  const inv = manifest?.agentSummary?.investigation;
  rows.push({
    store: store.id, buggy: store.buggy, outcome: manifest ? classify(store, manifest) : `RUNNER-FAILED (exit ${child.status})`,
    agentState: manifest?.agentSummary?.state ?? null,
    observations: inv?.observations ?? null, verdict: inv?.verdict ?? null, confirmation: inv?.confirmation ?? null,
    repairsCommitted: manifest?.agentSummary?.repairsCommitted ?? null, changedFiles: manifest?.changedFiles ?? null,
    oracleBefore: manifest?.oracle?.before?.pass ?? null, oracleAfter: manifest?.oracle?.after?.pass ?? null,
    oracleAfterFailing: manifest?.oracle?.after?.failing ?? null, tokens: manifest?.agentSummary?.tokens ?? null,
  });
}

const report = { evaluation: 'fresh-stores-2026-10-30', harnessCommit, harnessDirty: !!dirty, ranAt: new Date().toISOString(), model: process.env.MODEL_NAME || 'muse-wonder-1.0', bundles: path.relative(process.cwd(), outRoot).split(path.sep).join('/'), rows };
await writeFile(path.join(evidenceDir, 'results.json'), JSON.stringify(report, null, 2));
const md = [
  '# Fresh-store evaluation — results (one live run per store)',
  '',
  `Harness commit \`${harnessCommit}\`${dirty ? ' (WARNING: uncommitted harness changes at run time)' : ''}; model \`${report.model}\`; run ${report.ranAt}.`,
  'Rules fixed in advance: `eval/fresh-2026-10-30/PREREGISTRATION.md`. Nothing below was re-run or edited.',
  '',
  '| Store | Has bug | Outcome | Agent state | Observations | Oracle before → after | Files changed | Tokens |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map((r) => `| ${r.store} | ${r.buggy ? 'yes' : 'no (control)'} | **${r.outcome}** | ${r.agentState} | ${r.observations ?? '-'} | ${r.oracleBefore} → ${r.oracleAfter} | ${r.changedFiles?.join(', ') || 'none'} | ${r.tokens ?? '-'} |`),
  '',
  ...rows.map((r) => `- **${r.store}** verdict: ${(r.verdict?.suspectedIssue || r.verdict?.evidenceSummary || 'none').replace(/\s+/g, ' ').slice(0, 300)}${r.confirmation ? ` — confirmation expected ${r.confirmation.expected}, observed ${r.confirmation.observed}` : ''}`),
  '',
  `Full bundles (gitignored): \`${report.bundles}\`. Replay: \`npm run replay -- evidence/fresh-2026-10-30/store-a-verification.json\`.`,
].join('\n');
await writeFile(path.join(evidenceDir, 'RESULTS.md'), md + '\n');
console.log(`\n${md}`);
