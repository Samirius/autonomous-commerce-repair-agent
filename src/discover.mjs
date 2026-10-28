// Discovery mode: no defect names, no expected fixes are provided.
// The agent probes generic commerce invariants, sends the screenshot +
// structured signals + source files to the model, applies ONE validated
// patch at a time, and commits only if failing signals strictly decrease
// with no regressions. Usage:
//   node src/discover.mjs --root <storefrontDir> --run-dir <artifactDir>
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { runProbe } from '../scripts/probe.mjs';
import { createProvider } from './provider.mjs';
import { createVerifier } from './verifier.mjs';
import { validateRepair, ALLOWED_FILES } from './agent.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };

export async function discoverAndRepair({ root, runDir, provider, verifier = null, maxRepairs = 4 }) {
  await mkdir(runDir, { recursive: true });
  const history = [];
  const receipts = [];
  const record = (step, detail) => { const e = { t: new Date().toISOString(), step, detail }; history.push(e); console.log(`[${step}]`, JSON.stringify(detail).slice(0, 500)); };
  const save = async () => writeFile(path.join(runDir, 'history.json'), JSON.stringify(history, null, 2));

  let probe = await runProbe(root, { screenshot: path.join(runDir, 'before.png') });
  await writeFile(path.join(runDir, 'probe-before.json'), JSON.stringify(probe, null, 2));
  const initialFailing = probe.signals.filter((s) => !s.pass).map((s) => s.id);
  record('probe-before', { failing: initialFailing });
  const catalogText = await readFile(path.join(root, 'catalog.js'), 'utf8').catch(() => '(no catalog.js)');
  const priceMinor = probe.signals.find((s) => s.id === 'cart-total-matches-catalog-rules')?.evidence?.catalog?.products?.[0]?.priceMinor;
  const forbiddenLiterals = priceMinor ? [String(priceMinor), (priceMinor / 100).toFixed(2)] : [];

  let repairsCommitted = 0;
  for (let round = 1; round <= maxRepairs; round++) {
    const failing = probe.signals.filter((s) => !s.pass);
    if (!failing.length) break;
    const passingBefore = new Set(probe.signals.filter((s) => s.pass).map((s) => s.id));
    const files = {};
    for (const f of [...ALLOWED_FILES, 'catalog.js']) files[f] = await readFile(path.join(root, f), 'utf8').catch(() => '(missing)');
    const shotPath = path.join(runDir, `round${round}.png`);
    probe = await runProbe(root, { screenshot: shotPath });
    const shotBytes = await readFile(shotPath);
    const imageDataUrl = `data:image/png;base64,${shotBytes.toString('base64')}`;
    const vision = { included: true, screenshot: shotPath, sha256: createHash('sha256').update(shotBytes).digest('hex'), bytes: shotBytes.length };

    let committed = false;
    for (let attempt = 1; attempt <= 2 && !committed; attempt++) {
      const result = await provider.chatJSON({
        system: 'You are an autonomous e-commerce repair agent inspecting an unfamiliar storefront. Reply with ONLY a JSON object, no markdown.',
        images: [imageDataUrl],
        user: [
          'A screenshot of the storefront (mobile) is attached. Generic invariant probe results (no defect list — diagnose the underlying issue yourself):',
          JSON.stringify(probe.signals.filter((s) => !s.pass), null, 2),
          '', 'Canonical catalog (READ-ONLY, never edit it, never hardcode its values into code):', '```js', catalogText, '```', '',
          ...Object.entries(files).flatMap(([n, c]) => [`--- ${n} ---`, '```', c, '```', '']),
          'Identify ONE underlying problem supported by the visual and structured evidence, select ONE file to fix it, and propose ONE narrowly scoped replacement.',
          `Allowed files: ${JSON.stringify(ALLOWED_FILES)}. "old" must occur exactly once. Do not remove/hide storefront elements or features. No execution/process/shell code.`,
          'Return JSON exactly: {"diagnosis":"...","evidenceSummary":"...","file":"<allowed file>","old":"exact substring","new":"replacement substring","rationale":"..."}',
        ].join('\n'),
      });
      const repair = result.parsed;
      record('diagnose', { round, attempt, model: result.model, id: result.id, file: repair.file, diagnosis: repair.diagnosis, vision });
      await writeFile(path.join(runDir, `model-decision-r${round}-a${attempt}.json`),
        JSON.stringify({ modelInfo: { provider: result.provider, model: result.model, id: result.id, usage: result.usage, rawText: result.rawText }, vision, repair }, null, 2));

      const filePath = path.join(root, repair.file || '');
      const original = ALLOWED_FILES.includes(repair.file) ? await readFile(filePath, 'utf8') : '';
      const error = validateRepair(repair, original, { forbiddenLiterals });
      if (error) { receipts.push({ round, attempt, status: 'rejected', error, repair, model: { model: result.model, id: result.id, usage: result.usage } }); record('rejected', { error }); continue; }
      await writeFile(filePath, original.replace(repair.old, repair.new));
      const after = await runProbe(root, { screenshot: path.join(runDir, `round${round}-after.png`) });
      const failingAfter = after.signals.filter((s) => !s.pass).map((s) => s.id);
      const regressions = after.signals.filter((s) => !s.pass && passingBefore.has(s.id)).map((s) => s.id);
      if (failingAfter.length < failing.length && !regressions.length) {
        committed = true; repairsCommitted += 1; probe = after;
        let verification = null;
        if (verifier?.available) {
          try { verification = await verifier.review({ repair, evidenceBefore: failing, evidenceAfter: failingAfter }); }
          catch (e) { verification = { error: String(e).slice(0, 300) }; }
        }
        receipts.push({ round, attempt, status: 'committed', repair, model: { provider: result.provider, model: result.model, id: result.id, usage: result.usage }, vision, failingAfter, openWeightVerification: verification });
        record('committed', { round, file: repair.file, failingAfter, openWeight: verification?.parsed || verification?.error || 'unavailable' });
      } else {
        await writeFile(filePath, original); // rollback, byte-for-byte
        receipts.push({ round, attempt, status: 'rolled-back', repair, model: { model: result.model, id: result.id, usage: result.usage }, vision, failingAfter, regressions });
        record('rolled-back', { round, failingAfter, regressions });
      }
    }
    if (!committed) { record('stop', { round, reason: 'no committing repair in 2 attempts' }); break; }
  }

  const final = await runProbe(root, { screenshot: path.join(runDir, 'after.png') });
  await writeFile(path.join(runDir, 'probe-after.json'), JSON.stringify(final, null, 2));
  const summary = { root, initialFailing, repairsCommitted, finalPass: final.pass, finalFailing: final.signals.filter((s) => !s.pass).map((s) => s.id), receipts, finishedAt: new Date().toISOString() };
  await writeFile(path.join(runDir, 'verification.json'), JSON.stringify(summary, null, 2));
  await save();
  return summary;
}

if (process.argv[1]?.endsWith('discover.mjs')) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const root = path.resolve(arg('--root', 'storefront'));
  const runDir = path.resolve(arg('--run-dir', path.join('artifacts', `discover-${Date.now()}`)));
  const summary = await discoverAndRepair({ root, runDir, provider: createProvider(), verifier: createVerifier() });
  console.log(`RESULT: finalPass=${summary.finalPass} repairs=${summary.repairsCommitted}`);
  process.exitCode = summary.finalPass ? 0 : 1;
}
