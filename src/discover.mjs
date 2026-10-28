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
import { runProbe, runObservation, runViewportScreenshot } from '../scripts/probe.mjs';
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

  let probe = await runProbe(root, { screenshot: path.join(runDir, 'before.png'), screenshotDesktop: path.join(runDir, 'before-desktop.png') });
  await writeFile(path.join(runDir, 'probe-before.json'), JSON.stringify(probe, null, 2));
  const initialFailing = probe.signals.filter((s) => !s.pass).map((s) => s.id);
  record('probe-before', { failing: initialFailing });
  const catalogText = await readFile(path.join(root, 'catalog.js'), 'utf8').catch(() => '(no catalog.js)');
  const priceMinor = probe.signals.find((s) => s.id === 'cart-total-matches-catalog-rules')?.evidence?.catalog?.products?.[0]?.priceMinor;
  const forbiddenLiterals = priceMinor ? [String(priceMinor), (priceMinor / 100).toFixed(2)] : [];

  // INVESTIGATION PHASE — runs when no deterministic signal has failed.
  // Wonder actively investigates workflows via typed observations before any
  // verdict. Classification (never repair on suspicion alone):
  //   verified-healthy | investigation-incomplete | suspected-unverified | confirmed-issue
  let investigation = null;
  if (!initialFailing.length) {
    investigation = { state: 'investigation-incomplete', observations: [], verdict: null, turns: 0 };
    const shotPath = path.join(runDir, 'investigation.png');
    await runProbe(root, { screenshot: shotPath });
    let notes = '';
    let extraImages = [];
    for (let turn = 1; turn <= 8; turn++) {
      investigation.turns = turn;
      const shotBytes = await readFile(shotPath);
      const images = [`data:image/png;base64,${shotBytes.toString('base64')}`, ...extraImages];
      const result = await provider.chatJSON({
        system: 'You are an autonomous commerce engineer investigating a storefront. Reply with ONLY a JSON object, no markdown.',
        images,
        user: [
          'All deterministic probe signals currently PASS. Passing probes are not proof of health — actively investigate the commerce workflows before reaching a verdict.',
          `Probe signals that passed: ${JSON.stringify(probe.signals.map((s) => s.id))}`,
          `Products presented on the page: ${JSON.stringify(probe.presented || [])}`,
          '', 'Canonical catalog:', '```js', catalogText, '```', '',
          notes ? `Investigation so far:\n${notes}` : '',
          'Available typed tools (request ONE per turn):',
          `Investigation turn ${turn} of 8. Observations completed so far: ${investigation.observations.length}. Once you have 2+ observations, return a verdict on the NEXT turn unless you can name one specific workflow that remains untested and is required for the verdict. On turn 8 you must return a verdict.`,
          '{"observationRequest":{"kind":"cart-scenario","items":[{"id":"<product id>","qty":2}],"promoCode":"<optional>"}}',
          '{"observationRequest":{"kind":"quantity-change","items":[{"id":"<product id>","qty":1}],"productId":"<id>","delta":1}}',
          '{"observationRequest":{"kind":"apply-promo","items":[{"id":"<product id>","qty":1}],"promoCode":"<code from catalog>"}}',
          '{"observationRequest":{"kind":"inspect-cart","items":[{"id":"<product id>","qty":1}],"tryCheckout":true}}',
          '{"observationRequest":{"kind":"product-detail","productId":"<id>"}} | {"observationRequest":{"kind":"console-reload"}} | {"observationRequest":{"kind":"viewport","width":360|390|768|1280}}',
          'You must perform at least 2 observations of different kinds, covering cart behaviour and any available promotions, before a healthy verdict.',
          'When done, return ONE verdict: {"verdict":"healthy","evidenceSummary":"..."} or {"verdict":"suspected","suspectedIssue":"...","evidenceSummary":"..."}.',
          'Do NOT propose code repairs in this phase: an unverified suspicion never modifies code. If your evidence suggests a real issue, mark it suspected and describe exactly what deterministic evidence would confirm it.',
        ].join('\n'),
      });
      await writeFile(path.join(runDir, `investigation-turn${turn}.json`),
        JSON.stringify({ modelInfo: { provider: result.provider, model: result.model, id: result.id, usage: result.usage, rawText: result.rawText }, response: result.parsed }, null, 2));
      const parsed = result.parsed;
      if (parsed.observationRequest) {
        const req = parsed.observationRequest;
        let observation = await runObservation(root, req);
        if (req.kind === 'viewport' && !observation.error) {
          const vp = await runViewportScreenshot(root, req.width || 390, path.join(runDir, `investigation-viewport-${req.width || 390}.png`));
          observation = { ...observation, ...vp };
          extraImages = [`data:image/png;base64,${(await readFile(path.join(runDir, vp.screenshot))).toString('base64')}`];
        }
        investigation.observations.push({ turn, request: req, observation });
        receipts.push({ status: 'investigation-observation', request: req, observation, model: { model: result.model, id: result.id, usage: result.usage } });
        record('investigation-observation', { turn, kind: req.kind, result: JSON.stringify(observation).slice(0, 300) });
        notes += `\n[turn ${turn} ${req.kind}] ${JSON.stringify(observation).slice(0, 1500)}`;
        continue;
      }
      if (parsed.verdict === 'healthy') {
        if (investigation.observations.length >= 2) { investigation.state = 'verified-healthy'; investigation.verdict = parsed; }
        else { notes += `\n[system] Healthy verdict rejected: only ${investigation.observations.length} observation(s) performed. Investigate at least 2 different workflow kinds first.`; investigation.verdict = parsed; continue; }
      } else if (parsed.verdict === 'suspected' || parsed.verdict === 'issue' || parsed.repair) {
        investigation.state = 'suspected-unverified';
        investigation.verdict = parsed;
      } else {
        investigation.verdict = parsed;
      }
      break;
    }
    await writeFile(path.join(runDir, 'investigation.json'), JSON.stringify(investigation, null, 2));
    record('investigation', { state: investigation.state, observations: investigation.observations.length, turns: investigation.turns });
    // Re-probe: if active investigation surfaced a deterministic failure, it
    // becomes a confirmed issue and flows into the normal repair loop below.
    probe = await runProbe(root, { screenshot: path.join(runDir, 'before.png'), screenshotDesktop: path.join(runDir, 'before-desktop.png') });
    if (!probe.pass) record('investigation-confirmed', { failing: probe.signals.filter((s) => !s.pass).map((s) => s.id) });
  }

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
    const vision = { included: true, screenshot: path.basename(shotPath), sha256: createHash('sha256').update(shotBytes).digest('hex'), bytes: shotBytes.length };

    let committed = false;
    for (let attempt = 1; attempt <= 2 && !committed; attempt++) {
      const modelSignals = failing.map(({ evidence, ...rest }) => {
        const { expectedQty1, expectedQty2, ...observed } = evidence || {};
        return { ...rest, evidence: observed };
      });
      // The model may first request up to 2 safe observations (allowlisted
      // kinds only — see runObservation) before proposing a repair.
      let repair = null, result = null, observationNotes = '';
      for (let obsStep = 0; obsStep <= 2 && !repair; obsStep++) {
        result = await provider.chatJSON({
          system: 'You are an autonomous e-commerce repair agent inspecting an unfamiliar storefront. Reply with ONLY a JSON object, no markdown.',
          images: [imageDataUrl],
          user: [
            'A screenshot of the storefront (mobile) is attached. Generic invariant probe results (no defect list — diagnose the underlying issue yourself; expected totals are deliberately withheld, derive them from the catalog):',
            JSON.stringify(modelSignals, null, 2),
            observationNotes ? `\nAdditional observations you requested:\n${observationNotes}` : '',
            '', 'Canonical catalog (READ-ONLY, never edit it, never hardcode its values into code):', '```js', catalogText, '```', '',
            ...Object.entries(files).flatMap(([n, c]) => [`--- ${n} ---`, '```', c, '```', '']),
            'Identify ONE underlying problem supported by the visual and structured evidence, select ONE file to fix it, and propose ONE narrowly scoped replacement.',
            `Allowed files: ${JSON.stringify(ALLOWED_FILES)}. "old" must occur exactly once. Do not remove/hide storefront elements or features. No execution/process/shell code.`,
            'Return JSON exactly: {"diagnosis":"...","evidenceSummary":"...","file":"<allowed file>","old":"exact substring","new":"replacement substring","rationale":"..."}',
            'OR, if evidence is insufficient, request ONE safe observation instead: {"observationRequest":{"kind":"cart-scenario","items":[{"id":"<catalog product id>","qty":2}],"promoCode":"<optional catalog promo code>"},"reason":"..."} — other kinds: product-detail {productId}, console-reload, quantity-change {items, productId, delta}, apply-promo {items, promoCode}, inspect-cart {items, tryCheckout}, viewport {width}. You may request at most 2 observations, then you must propose a repair.',
          ].join('\n'),
        });
        const parsed = result.parsed;
        await writeFile(path.join(runDir, `model-decision-r${round}-a${attempt}${obsStep ? `-obs${obsStep}` : ''}.json`),
          JSON.stringify({ modelInfo: { provider: result.provider, model: result.model, id: result.id, usage: result.usage, rawText: result.rawText }, vision, response: parsed }, null, 2));
        if (parsed.observationRequest && obsStep < 2) {
          const observation = await runObservation(root, parsed.observationRequest);
          receipts.push({ round, attempt, status: 'observation', request: parsed.observationRequest, observation, model: { model: result.model, id: result.id, usage: result.usage } });
          record('observation', { round, attempt, kind: parsed.observationRequest.kind, result: JSON.stringify(observation).slice(0, 300) });
          observationNotes += `\n[${parsed.observationRequest.kind}] ${JSON.stringify(observation).slice(0, 1500)}`;
          continue;
        }
        repair = parsed;
      }
      record('diagnose', { round, attempt, model: result.model, id: result.id, file: repair.file, diagnosis: repair.diagnosis, vision });

      const filePath = path.join(root, repair.file || '');
      const original = ALLOWED_FILES.includes(repair.file) ? await readFile(filePath, 'utf8') : '';
      const error = validateRepair(repair, original, { forbiddenLiterals });
      if (error) { receipts.push({ round, attempt, status: 'rejected', error, repair, model: { model: result.model, id: result.id, usage: result.usage } }); record('rejected', { error }); continue; }
      await writeFile(filePath, original.replace(repair.old, repair.new));
      const patchRecord = `file: ${repair.file}\nstatus: PENDING\n--- old ---\n${repair.old}\n--- new ---\n${repair.new}\n`;
      await mkdir(path.join(runDir, 'patches'), { recursive: true });
      await writeFile(path.join(runDir, 'patches', `r${round}-a${attempt}.patch.txt`), patchRecord);
      const after = await runProbe(root, { screenshot: path.join(runDir, `round${round}-after.png`) });
      const failingAfter = after.signals.filter((s) => !s.pass).map((s) => s.id);
      const regressions = after.signals.filter((s) => !s.pass && passingBefore.has(s.id)).map((s) => s.id);
      if (failingAfter.length < failing.length && !regressions.length) {
        await writeFile(path.join(runDir, 'patches', `r${round}-a${attempt}.patch.txt`), patchRecord.replace('PENDING', 'committed'));
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
        await writeFile(path.join(runDir, 'patches', `r${round}-a${attempt}.patch.txt`), patchRecord.replace('PENDING', 'rolled-back'));
        receipts.push({ round, attempt, status: 'rolled-back', repair, model: { model: result.model, id: result.id, usage: result.usage }, vision, failingAfter, regressions });
        record('rolled-back', { round, failingAfter, regressions });
      }
    }
    if (!committed) { record('stop', { round, reason: 'no committing repair in 2 attempts' }); break; }
  }

  const final = await runProbe(root, { screenshot: path.join(runDir, 'after.png'), screenshotDesktop: path.join(runDir, 'after-desktop.png') });
  await writeFile(path.join(runDir, 'probe-after.json'), JSON.stringify(final, null, 2));
  const state = repairsCommitted > 0
    ? (final.pass ? 'confirmed-issue-repaired' : 'repair-incomplete')
    : (investigation?.state || (final.pass ? 'no-known-failures-incomplete' : 'confirmed-issue'));
  const summary = { target: path.basename(root), state, investigation: investigation && { state: investigation.state, observations: investigation.observations.length, turns: investigation.turns, verdict: investigation.verdict }, initialFailing, repairsCommitted, finalPass: final.pass, finalFailing: final.signals.filter((s) => !s.pass).map((s) => s.id), receipts, finishedAt: new Date().toISOString() };
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
