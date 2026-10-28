// Autonomous Commerce Repair Agent — Mission 002: multi-defect repair.
// Observe -> Discover -> Prioritize -> (Diagnose -> Plan -> Act -> Verify ->
// Rollback or Commit) per defect -> Regression recheck -> Remember
// The model selects the file and the patch. There are NO defect->fix mappings
// in this file: validation is generic (allowlist, exact-once, safety,
// anti-hardcoding of canonical values), verification is deterministic.
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { runAllChecks } from '../scripts/check.mjs';
import { createProvider } from './provider.mjs';

// Files the model may repair. catalog.js is deliberately NOT here: it is the
// canonical source of truth and must never be edited to match buggy code.
export const ALLOWED_FILES = ['styles.css', 'app.js', 'index.html'];
const READ_ONLY_FILES = ['catalog.js'];
const MAX_ATTEMPTS = 2;

// Resolve a model patch against file content, tolerating LF vs CRLF
// line-ending differences (models emit LF; files on disk may be CRLF).
// Returns the effective {old, new} in the file's own line endings, or null.
export function resolveRepair(repair, content) {
  if (!repair?.old) return null;
  const variants = [repair.old, repair.old.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), repair.old.replace(/\r\n/g, '\n')];
  for (const old of [...new Set(variants)]) {
    if (content.split(old).length - 1 === 1) {
      const newText = old.includes('\r\n') ? repair.new.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n') : repair.new;
      return { old, new: newText };
    }
  }
  return null;
}

export function applyPatchText(content, repair) {
  const effective = resolveRepair(repair, content) || repair;
  return content.replace(effective.old, effective.new);
}

export function validateRepair(repair, content, opts = {}) {
  if (!repair || typeof repair !== 'object') return 'repair is not an object';
  const allowed = opts.allowedFiles || ALLOWED_FILES;
  if (!allowed.includes(repair.file)) return `repair.file "${repair.file}" is not in the allowlist ${JSON.stringify(allowed)} (catalog.js is read-only)`;
  if (!repair.old || !repair.new || repair.old === repair.new) return 'repair.old/new missing or identical';
  if (repair.new.length > 2000 || repair.old.length > 2000) return 'repair snippet too large';
  if (/expression\(|javascript:|<\/script|eval\s*\(|Function\s*\(|child_process|process\.|require\s*\(|import\s*\(|execSync|spawn\s*\(/i.test(repair.new)) {
    return 'repair.new contains a disallowed construct (no code execution / process access)';
  }
  for (const lit of opts.forbiddenLiterals || []) {
    if (lit && repair.new.includes(lit)) return `repair.new hardcodes canonical value "${lit}" — derive it from the canonical data instead`;
  }
  const occurrences = content.split(repair.old).length - 1;
  if (occurrences !== 1 && !resolveRepair(repair, content)) return `repair.old must occur exactly once in ${repair.file} (found ${occurrences})`;
  return null;
}

// Backwards-compatible name from Mission 001.
export const validatePatch = validateRepair;

function gitDiff(file) {
  try {
    return execFileSync('git', ['diff', '--', `storefront/${file}`], { cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return '(git diff unavailable)'; }
}

// Apply ONE repair to ONE file, verify the target defect + all previously
// repaired defects (regression), roll back only this file on any failure.
export async function applyAndVerify({ root, repair, defectId, priorDefectIds = [], checkFn = runAllChecks, forbiddenLiterals = [], runDir = null }) {
  const filePath = path.join(root, repair.file);
  const original = await readFile(filePath, 'utf8');
  const error = validateRepair(repair, original, { forbiddenLiterals });
  if (error) return { status: 'rejected', error, diff: '' };
  await writeFile(filePath, applyPatchText(original, repair));
  const diff = gitDiff(repair.file);
  if (runDir) await writeFile(path.join(runDir, `repair-${defectId}.diff`), diff);
  const result = await checkFn(root);
  const byId = Object.fromEntries(result.defects.map((d) => [d.id, d]));
  const targetPass = !!byId[defectId]?.pass;
  const regressions = priorDefectIds.filter((id) => !byId[id]?.pass);
  if (!targetPass || regressions.length) {
    await writeFile(filePath, original); // ROLLBACK — this file only
    return { status: 'rolled-back', diff, after: result, targetPass, regressions };
  }
  return { status: 'committed', diff, after: result, targetPass, regressions: [] };
}

async function proposeRepair(provider, { defect, files, catalogText, feedback, imageDataUrl = null }) {
  const result = await provider.chatJSON({
    system: 'You are the repair planner for an autonomous e-commerce repair agent. Reply with ONLY a JSON object, no markdown.',
    images: imageDataUrl ? [imageDataUrl] : [],
    user: [
      `Defect to repair: ${defect.id} — ${defect.title} (severity: ${defect.severity})`,
      'Deterministic evidence (integer minor currency units where money is involved):',
      JSON.stringify(defect, null, 2),
      '',
      'Canonical catalog (READ-ONLY evidence — never propose editing catalog.js, and never hardcode its values into code; fixed code must derive values from this data at runtime):',
      '```js', catalogText, '```',
      '',
      ...Object.entries(files).flatMap(([name, content]) => [`--- ${name} ---`, '```', content, '```', '']),
      feedback ? `Previous attempt failed: ${feedback}\nPropose a different, corrected repair.` : '',
      'Select the ONE file that causes this defect and propose ONE narrowly scoped replacement.',
      `Allowed files: ${JSON.stringify(ALLOWED_FILES)}. "old" must be an exact substring occurring exactly once in that file.`,
      'Do not hide or remove the CTA, the promo, the price, or the cart. Do not add any execution/process/shell code.',
      'Return JSON exactly: {"diagnosis":"...","evidenceSummary":"which evidence supports this","file":"<allowed file>","old":"exact substring","new":"replacement substring","rationale":"..."}',
    ].join('\n'),
  });
  return result;
}

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.resolve('artifacts', `run-${stamp}`);
  await mkdir(runDir, { recursive: true });
  const root = path.resolve('storefront');
  const history = [];
  const record = (step, detail) => { const e = { t: new Date().toISOString(), step, detail }; history.push(e); console.log(`[${step}]`, typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 600)); };
  const saveHistory = () => writeFile(path.join(runDir, 'history.json'), JSON.stringify(history, null, 2));

  // OBSERVE + DISCOVER
  const before = await runAllChecks(root, { screenshot: path.join(runDir, 'before.png') });
  await writeFile(path.join(runDir, 'evidence-before.json'), JSON.stringify(before, null, 2));
  record('observe', before.defects.map((d) => ({ id: d.id, pass: d.pass })));

  // PRIORITIZE (severity rank from the checks; no fix knowledge here)
  const queue = before.defects.filter((d) => !d.pass).sort((a, b) => a.severityRank - b.severityRank);
  record('queue', queue.map((d) => `${d.id} (${d.severity})`));
  if (!queue.length) { record('done', 'all checks pass; nothing to repair'); await saveHistory(); return; }

  const catalogText = await readFile(path.join(root, 'catalog.js'), 'utf8');
  const screenshotDataUrl = async () => {
    try { const b = await readFile(path.join(runDir, 'before.png')); return `data:image/png;base64,${b.toString('base64')}`; } catch { return null; }
  };
  const catalogPrice = before.defects.find((d) => d.id === 'price-mismatch')?.evidence?.catalog?.priceMinor;
  const provider = createProvider();
  record('provider', { provider: provider.provider, model: provider.model, baseUrl: provider.baseUrl });

  const repaired = [];
  const receipts = [];
  for (const defect of queue) {
    // Anti-hardcoding guard for commerce values: a repair may not paste in
    // the canonical price (or its formatted form) — it must read the catalog.
    const forbiddenLiterals = defect.id === 'price-mismatch' && catalogPrice
      ? [String(catalogPrice), (catalogPrice / 100).toFixed(2)] : [];
    let outcome = null, lastFeedback = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && outcome?.status !== 'committed'; attempt++) {
      const files = {};
      for (const f of [...ALLOWED_FILES, ...READ_ONLY_FILES]) files[f] = await readFile(path.join(root, f), 'utf8');
      const result = await proposeRepair(provider, { defect, files, catalogText, feedback: lastFeedback, imageDataUrl: await screenshotDataUrl() });
      const repair = result.parsed;
      record('diagnose', { defect: defect.id, attempt, model: result.model, file: repair.file, diagnosis: repair.diagnosis });
      await writeFile(path.join(runDir, `model-decision-${defect.id}-attempt${attempt}.json`),
        JSON.stringify({ modelInfo: { provider: result.provider, model: result.model, id: result.id, usage: result.usage, rawText: result.rawText }, repair }, null, 2));
      outcome = await applyAndVerify({ root, repair, defectId: defect.id, priorDefectIds: repaired, forbiddenLiterals, runDir });
      record('verify', { defect: defect.id, attempt, status: outcome.status, error: outcome.error || undefined, regressions: outcome.regressions });
      if (outcome.status === 'rejected') lastFeedback = `Patch rejected by validation: ${outcome.error}`;
      else if (outcome.status === 'rolled-back') lastFeedback = `Patch applied but deterministic verification still failed for ${defect.id}${outcome.regressions?.length ? `; regressions: ${outcome.regressions.join(',')}` : ''}. Rolled back.`;
      receipts.push({ defect: defect.id, attempt, status: outcome.status, file: repair.file, model: { provider: result.provider, model: result.model, id: result.id, usage: result.usage }, repair, error: outcome.error || null });
    }
    if (outcome?.status === 'committed') repaired.push(defect.id);
    else record('continue', `${defect.id} not repaired (${outcome?.status}); continuing with remaining queue when safe`);
  }

  // FINAL RECHECK (all defects, both viewports) + REMEMBER
  const after = await runAllChecks(root, { screenshot: path.join(runDir, 'after.png') });
  await writeFile(path.join(runDir, 'evidence-after.json'), JSON.stringify(after, null, 2));
  const summary = {
    run: path.basename(runDir), queue: queue.map((d) => d.id), repaired,
    finalPass: after.pass, defectsAfter: after.defects.map((d) => ({ id: d.id, pass: d.pass })),
    receipts, verifiedAt: new Date().toISOString(),
  };
  await writeFile(path.join(runDir, 'verification.json'), JSON.stringify(summary, null, 2));
  await mkdir('memory', { recursive: true });
  await appendFile(path.join('memory', 'runs.jsonl'), JSON.stringify(summary) + '\n');
  record('remember', `finalPass=${after.pass} repaired=${repaired.join(',')}`);
  await saveHistory();
  console.log(`RESULT: ${after.pass ? 'all defects repaired' : 'INCOMPLETE'} (${repaired.join(', ')})`);
  process.exitCode = after.pass ? 0 : 1;
}

if (process.argv[1]?.endsWith('agent.mjs') && !process.env.AGENT_LIB_ONLY) {
  await main();
}
