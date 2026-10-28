// Autonomous Commerce Repair Agent — Mission 001 vertical slice.
// Observe -> Diagnose -> Plan -> Act -> Verify -> Rollback or Commit -> Remember
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { runCheck } from '../scripts/check.mjs';
import { createProvider } from './provider.mjs';

const ALLOWED_FILE = 'styles.css'; // repairs may only touch the storefront stylesheet

export function validateRepair(repair, css) {
  if (!repair || typeof repair !== 'object') return 'repair is not an object';
  if (repair.file !== ALLOWED_FILE) return `repair.file must be "${ALLOWED_FILE}", got "${repair.file}"`;
  if (!repair.old || !repair.new || repair.old === repair.new) return 'repair.old/new missing or identical';
  if (repair.new.length > 2000 || repair.old.length > 2000) return 'repair snippet too large';
  if (/expression\(|javascript:|<\/|@import\s+url/i.test(repair.new)) return 'repair.new contains a disallowed construct';
  const occurrences = css.split(repair.old).length - 1;
  if (occurrences !== 1) return `repair.old must occur exactly once in styles.css (found ${occurrences})`;
  return null;
}

// Apply a repair, verify deterministically, roll back on failure.
export async function applyAndVerify({ root, repair, runDir }) {
  const cssPath = path.join(root, 'styles.css');
  const original = await readFile(cssPath, 'utf8');
  const error = validateRepair(repair, original);
  if (error) return { status: 'rejected', error, diff: '' };
  const patched = original.replace(repair.old, repair.new);
  await writeFile(cssPath, patched);
  let diff = '';
  try { diff = execFileSync('git', ['diff', '--', 'storefront/styles.css'], { cwd: path.resolve(root, '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { diff = '(git diff unavailable)'; }
  if (runDir) await writeFile(path.join(runDir, 'repair.diff'), diff);
  const after = await runCheck(root, { screenshot: runDir ? path.join(runDir, 'after.png') : undefined });
  if (!after.pass) {
    await writeFile(cssPath, original); // ROLLBACK
    return { status: 'rolled-back', diff, after };
  }
  return { status: 'committed', diff, after };
}

async function main() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const forceBad = process.argv.includes('--force-bad-repair');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.resolve('artifacts', `run-${stamp}`);
  await mkdir(runDir, { recursive: true });
  const root = path.resolve('storefront');
  const history = [];
  const record = (step, detail) => { const e = { t: new Date().toISOString(), step, detail }; history.push(e); console.log(`[${step}]`, typeof detail === 'string' ? detail : JSON.stringify(detail)); };

  // OBSERVE
  const before = await runCheck(root, { screenshot: path.join(runDir, 'before.png') });
  await writeFile(path.join(runDir, 'evidence-before.json'), JSON.stringify(before, null, 2));
  record('observe', { pass: before.pass, checks: before.checks, hitElement: before.hitElement, cta: before.cta });
  if (before.pass) { record('done', 'storefront already passes; nothing to repair'); await save(); return; }

  // DIAGNOSE + PLAN (Meta model via provider layer)
  const css = await readFile(path.join(root, 'styles.css'), 'utf8');
  let repair, modelInfo;
  if (forceBad) {
    repair = { file: 'styles.css', old: 'bottom: 16px;', new: 'bottom: 8px;', diagnosis: 'FORCED BAD REPAIR (rollback test)', rationale: 'Moves CTA down, still obscured — verification must fail and roll back.' };
    modelInfo = { provider: 'none', model: 'none', note: 'forced bad repair, no model call made' };
    record('plan', repair);
  } else {
    const provider = createProvider();
    const result = await provider.chatJSON({
      system: 'You are the repair planner for an autonomous e-commerce repair agent. Reply with ONLY a JSON object, no markdown.',
      user: [
        'A mobile storefront check FAILED at viewport 390x844. Evidence:',
        JSON.stringify(before, null, 2),
        '',
        'Current storefront/styles.css:',
        '```css', css, '```',
        '',
        'Propose ONE narrowly scoped CSS repair so the Add to Cart CTA is fully visible, not overlapped by any other element, and clickable.',
        'Rules: only change styles.css; "old" must be an exact substring occurring once; keep the promo banner visible; do not hide/remove the CTA or promo; prefer moving the CTA above the fixed promo or reserving space.',
        'Return JSON exactly: {"diagnosis":"...","file":"styles.css","old":"exact substring","new":"replacement substring","rationale":"..."}',
      ].join('\n'),
    });
    modelInfo = { provider: result.provider, model: result.model, id: result.id, usage: result.usage, rawText: result.rawText };
    repair = result.parsed;
    record('diagnose', { model: result.model, diagnosis: repair.diagnosis });
    record('plan', repair);
  }
  await writeFile(path.join(runDir, 'model-decision.json'), JSON.stringify({ modelInfo, repair }, null, 2));

  // ACT + VERIFY + ROLLBACK/COMMIT
  const outcome = await applyAndVerify({ root, repair, runDir });
  record('verify', { status: outcome.status, after: outcome.after ?? outcome.error });
  await writeFile(path.join(runDir, 'evidence-after.json'), JSON.stringify(outcome.after ?? { error: outcome.error }, null, 2));

  // REMEMBER
  const verification = {
    run: path.basename(runDir), status: outcome.status, beforePass: before.pass,
    afterPass: outcome.after?.pass ?? false, checks: outcome.after?.checks ?? null,
    model: modelInfo, repair, verifiedAt: new Date().toISOString(),
  };
  await writeFile(path.join(runDir, 'verification.json'), JSON.stringify(verification, null, 2));
  await mkdir('memory', { recursive: true });
  await appendFile(path.join('memory', 'runs.jsonl'), JSON.stringify(verification) + '\n');
  record('remember', `memory/runs.jsonl + ${runDir}`);
  await save();
  console.log(`RESULT: ${outcome.status}`);
  process.exitCode = outcome.status === 'committed' ? 0 : 1;

  async function save() {
    await writeFile(path.join(runDir, 'history.json'), JSON.stringify(history, null, 2));
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('agent.mjs')) {
  if (!process.env.AGENT_LIB_ONLY) await main();
}
