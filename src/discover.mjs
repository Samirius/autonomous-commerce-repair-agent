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
import { runProbe, runObservation, runViewportScreenshot, expectedScenarioMinor } from '../scripts/probe.mjs';
import { createProvider } from './provider.mjs';
import { createVerifier, classifyReview } from './verifier.mjs';
import { validateRepair, resolveRepair, applyPatchText, ALLOWED_FILES } from './agent.mjs';

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : fallback; };

export async function discoverAndRepair({ root, runDir, provider, verifier = null, maxRepairs = 4 }) {
  await mkdir(runDir, { recursive: true });
  const history = [];
  const receipts = [];
  const record = (step, detail) => { const e = { t: new Date().toISOString(), step, detail }; history.push(e); console.log(`[${step}]`, JSON.stringify(detail).slice(0, 500)); };
  const save = async () => writeFile(path.join(runDir, 'history.json'), JSON.stringify(history, null, 2));

  // Open-weight review wrapper: separate statuses, bounded follow-up.
  // On concern/reject it schedules ONE additional full deterministic probe
  // and flags the repair for human review. It never changes pass/fail.
  const reviewWithStatus = async ({ repair, evidenceBefore, evidenceAfter, deterministicPass }) => {
    if (!verifier?.available) {
      return { openWeightVerification: null, review: classifyReview({ deterministicPass, openWeight: null, evidenceAfter }) };
    }
    let ow = null;
    try { ow = await verifier.review({ repair, evidenceBefore, evidenceAfter }); }
    catch (e) { ow = { error: String(e).slice(0, 300) }; }
    const review = classifyReview({ deterministicPass, openWeight: ow, evidenceAfter });
    if (review.humanReviewRequired) {
      const extra = await runProbe(root);
      review.additionalVerification = { type: 'full-probe-rerun', probePass: extra.pass, failingSignals: extra.signals.filter((s) => !s.pass).map((s) => s.id) };
      review.actionTaken = extra.pass ? 'additional deterministic verification passed; repair still flagged for human review' : 'additional deterministic verification FAILED; human review required before trusting this repair';
      record('review-followup', { openWeight: review.openWeight, additionalProbePass: extra.pass });
    }
    record('review', { deterministic: review.deterministic, openWeight: review.openWeight, humanReviewRequired: review.humanReviewRequired });
    return { openWeightVerification: ow, review };
  };

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
  let repairsCommitted = 0;
  if (!initialFailing.length) {
    investigation = { state: 'investigation-incomplete', observations: [], verdict: null, turns: 0, tokensUsed: 0, tokenBudget: 30000, coverage: { mixedCart: false, promo: false, quantity: false } };
    const hasPromoCodes = Object.keys(probe.catalog?.rules?.promoCodes || {}).length > 0;
    if (!hasPromoCodes) investigation.coverage.promo = true;
    const coverageComplete = () => investigation.coverage.mixedCart && investigation.coverage.promo && investigation.coverage.quantity;
    const shotPath = path.join(runDir, 'investigation.png');
    await runProbe(root, { screenshot: shotPath });
    let notes = '';
    let extraImages = [];
    for (let turn = 1; turn <= 6; turn++) {
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
          `Investigation turn ${turn} of 6. Observations completed: ${investigation.observations.length}. Coverage so far: ${JSON.stringify(investigation.coverage)} (required before a healthy verdict: a mixed-product cart, a quantity change, and — when the catalog defines promo codes — a promo applied to a MIXED cart, since promo-on-one-product cannot reveal composition-dependent defects). Once coverage is complete, return a verdict on the NEXT turn. On turn 6 you must return a verdict.`,
          `Token budget for this investigation: ${investigation.tokenBudget} total; used so far: ${investigation.tokensUsed}. Be economical: prefer observations that complete missing coverage.`,
          '{"observationRequest":{"kind":"cart-scenario","items":[{"id":"<product id>","qty":2}],"promoCode":"<optional>"}}',
          '{"observationRequest":{"kind":"quantity-change","items":[{"id":"<product id>","qty":1}],"productId":"<id>","delta":1}}',
          '{"observationRequest":{"kind":"apply-promo","items":[{"id":"<product id>","qty":1}],"promoCode":"<code from catalog>"}}',
          '{"observationRequest":{"kind":"inspect-cart","items":[{"id":"<product id>","qty":1}],"tryCheckout":true}}',
          '{"observationRequest":{"kind":"product-detail","productId":"<id>"}} | {"observationRequest":{"kind":"console-reload"}} | {"observationRequest":{"kind":"viewport","width":360|390|768|1280}}',
          'You must perform at least 2 observations of different kinds, covering cart behaviour and any available promotions, before a healthy verdict.',
          'When done, return ONE verdict: {"verdict":"healthy","evidenceSummary":"..."} or {"verdict":"suspected","suspectedIssue":"...","evidenceSummary":"...","confirmation":{"kind":"cart-scenario","items":[{"id":"<product id>","qty":1}],"promoCode":"<optional>"}} — the confirmation is a typed scenario the agent will re-run and check deterministically against the catalog; only a confirmed discrepancy can lead to repair.',
          'Do NOT propose code repairs in this phase: an unverified suspicion never modifies code. If your evidence suggests a real issue, mark it suspected and describe exactly what deterministic evidence would confirm it.',
        ].join('\n'),
      });
      await writeFile(path.join(runDir, `investigation-turn${turn}.json`),
        JSON.stringify({ modelInfo: { provider: result.provider, model: result.model, id: result.id, usage: result.usage, rawText: result.rawText }, response: result.parsed }, null, 2));
      const parsed = result.parsed;
      investigation.tokensUsed += result.usage?.total_tokens || 0;
      if (parsed.observationRequest) {
        const req = parsed.observationRequest;
        if (coverageComplete()) {
          notes += '\n[system] Coverage is complete. Observation NOT executed — return a verdict on the next turn.';
          record('investigation-coverage-complete', { turn });
          continue;
        }
        if (investigation.tokensUsed > investigation.tokenBudget) { record('investigation-token-budget', { tokensUsed: investigation.tokensUsed }); break; }
        let observation = await runObservation(root, req);
        if (req.kind === 'viewport' && !observation.error) {
          const vp = await runViewportScreenshot(root, req.width || 390, path.join(runDir, `investigation-viewport-${req.width || 390}.png`));
          observation = { ...observation, ...vp };
          extraImages = [`data:image/png;base64,${(await readFile(path.join(runDir, vp.screenshot))).toString('base64')}`];
        }
        investigation.observations.push({ turn, request: req, observation });
        const distinctIds = new Set((req.items || []).map((it) => it.id || it.productId));
        if (distinctIds.size >= 2) investigation.coverage.mixedCart = true;
        // Promo coverage only counts when a promo is applied to a MIXED cart:
        // promo-on-single-product cannot reveal composition-dependent defects.
        if ((req.kind === 'apply-promo' || req.promoCode) && distinctIds.size >= 2) investigation.coverage.promo = true;
        if (req.kind === 'quantity-change') investigation.coverage.quantity = true;
        receipts.push({ status: 'investigation-observation', request: req, observation, model: { model: result.model, id: result.id, usage: result.usage } });
        record('investigation-observation', { turn, kind: req.kind, result: JSON.stringify(observation).slice(0, 300) });
        notes += `\n[turn ${turn} ${req.kind}] ${JSON.stringify(observation).slice(0, 1500)}`;
        continue;
      }
      if (parsed.verdict === 'healthy') {
        if (coverageComplete() && investigation.observations.length >= 2) { investigation.state = 'verified-healthy'; investigation.verdict = parsed; }
        else { notes += `\n[system] Healthy verdict rejected: coverage incomplete ${JSON.stringify(investigation.coverage)} after ${investigation.observations.length} observation(s). Complete the missing coverage first.`; investigation.verdict = parsed; continue; }
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

    // CONFIRMATION — a suspected verdict may name a typed confirmation
    // scenario. The agent re-runs it and checks the outcome deterministically
    // against the catalog. Only a confirmed discrepancy becomes repairable;
    // the repair must then pass BOTH the full probe and the scenario.
    if (probe.pass && investigation.state === 'suspected-unverified') {
      const spec = investigation.verdict?.confirmation || investigation.verdict?.confirmationScenario;
      const confirmable = spec && ['cart-scenario', 'apply-promo', 'inspect-cart'].includes(spec.kind);
      if (confirmable) {
        const items = (spec.items || []).map((it) => ({ id: it.id || it.productId, qty: it.qty ?? 1 }));
        const expected = expectedScenarioMinor(probe.catalog, items, spec.promoCode || null);
        const confirmationObs = await runObservation(root, spec);
        const observed = confirmationObs?.cart?.totalMinor;
        investigation.confirmation = { spec, expected, observed, confirmed: typeof observed === 'number' && observed === expected ? false : typeof observed === 'number' };
        record('confirmation', investigation.confirmation);
        if (investigation.confirmation.confirmed) {
          investigation.state = 'confirmed-issue';
          const files = {};
          for (const f of [...ALLOWED_FILES, 'catalog.js']) files[f] = await readFile(path.join(root, f), 'utf8').catch(() => '(missing)');
          const shotB = await readFile(path.join(runDir, 'before.png'));
          for (let attempt = 1; attempt <= 2; attempt++) {
            const result = await provider.chatJSON({
              system: 'You are an autonomous e-commerce repair agent. Reply with ONLY a JSON object, no markdown.',
              images: [`data:image/png;base64,${shotB.toString('base64')}`],
              user: [
                'A commerce defect has been CONFIRMED by deterministic scenario evidence (totals in integer minor units; derive the correct total from the catalog yourself):',
                JSON.stringify({ suspectedIssue: investigation.verdict.suspectedIssue || investigation.verdict.evidenceSummary, confirmationScenario: spec, observedTotalMinor: observed }, null, 2),
                '', 'Canonical catalog (READ-ONLY, never edit it, never hardcode its values):', '```js', catalogText, '```', '',
                ...Object.entries(files).flatMap(([n, c]) => [`--- ${n} ---`, '```', c, '```', '']),
                'Propose ONE narrowly scoped repair in ONE allowed file. "old" must occur exactly once. No execution/process/shell code.',
                `Allowed files: ${JSON.stringify(ALLOWED_FILES)}.`,
                'Return JSON exactly: {"diagnosis":"...","evidenceSummary":"...","file":"<allowed file>","old":"exact substring","new":"replacement substring","rationale":"..."}',
              ].join('\n'),
            });
            const repair = result.parsed;
            await writeFile(path.join(runDir, `model-decision-confirmed-a${attempt}.json`),
              JSON.stringify({ modelInfo: { provider: result.provider, model: result.model, id: result.id, usage: result.usage, rawText: result.rawText }, repair, confirmation: investigation.confirmation }, null, 2));
            const filePath = path.join(root, repair.file || '');
            const original = ALLOWED_FILES.includes(repair.file) ? await readFile(filePath, 'utf8') : '';
            const vError = validateRepair(repair, original, { forbiddenLiterals });
            if (vError) { receipts.push({ status: 'rejected', phase: 'confirmed-repair', error: vError, repair, model: { model: result.model, id: result.id, usage: result.usage } }); record('confirmed-rejected', { attempt, error: vError }); continue; }
            await writeFile(filePath, applyPatchText(original, repair));
            const verifyProbe = await runProbe(root);
            const verifyObs = await runObservation(root, spec);
            const scenarioOk = verifyObs?.cart?.totalMinor === expected;
            if (verifyProbe.pass && scenarioOk) {
              repairsCommitted += 1;
              investigation.state = 'confirmed-issue-repaired';
              const { openWeightVerification, review } = await reviewWithStatus({ repair, evidenceBefore: investigation.confirmation, evidenceAfter: { scenarioTotalMinor: verifyObs.cart.totalMinor, expected, probePass: true }, deterministicPass: true });
              receipts.push({ status: 'committed', phase: 'confirmed-repair', repair, model: { provider: result.provider, model: result.model, id: result.id, usage: result.usage }, verify: { probePass: true, scenarioTotalMinor: verifyObs.cart.totalMinor, expected }, openWeightVerification, review });
              record('confirmed-committed', { attempt, file: repair.file });
              probe = verifyProbe;
              break;
            }
            await writeFile(filePath, original); // rollback, byte-for-byte
            receipts.push({ status: 'rolled-back', phase: 'confirmed-repair', repair, model: { model: result.model, id: result.id, usage: result.usage }, verify: { probePass: verifyProbe.pass, scenarioTotalMinor: verifyObs?.cart?.totalMinor, expected } });
            record('confirmed-rolled-back', { attempt, probePass: verifyProbe.pass, scenarioOk });
          }
          if (investigation.state !== 'confirmed-issue-repaired') investigation.state = 'confirmed-issue-unrepaired';
          await writeFile(path.join(runDir, 'investigation.json'), JSON.stringify(investigation, null, 2));
        }
      }
    }
  }

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
      await writeFile(filePath, applyPatchText(original, repair));
      const patchRecord = `file: ${repair.file}\nstatus: PENDING\n--- old ---\n${repair.old}\n--- new ---\n${repair.new}\n`;
      await mkdir(path.join(runDir, 'patches'), { recursive: true });
      await writeFile(path.join(runDir, 'patches', `r${round}-a${attempt}.patch.txt`), patchRecord);
      const after = await runProbe(root, { screenshot: path.join(runDir, `round${round}-after.png`) });
      const failingAfter = after.signals.filter((s) => !s.pass).map((s) => s.id);
      const regressions = after.signals.filter((s) => !s.pass && passingBefore.has(s.id)).map((s) => s.id);
      if (failingAfter.length < failing.length && !regressions.length) {
        await writeFile(path.join(runDir, 'patches', `r${round}-a${attempt}.patch.txt`), patchRecord.replace('PENDING', 'committed'));
        committed = true; repairsCommitted += 1; probe = after;
        const { openWeightVerification: verification, review } = await reviewWithStatus({ repair, evidenceBefore: { failingSignalsBefore: failing.map((s) => s.id) }, evidenceAfter: { failingSignalsAfter: failingAfter, repairVerificationPassed: true, note: 'this repair committed (its signals improved, no regressions); failingSignalsAfter lists unrelated defects still in the queue' }, deterministicPass: true });
        receipts.push({ round, attempt, status: 'committed', repair, model: { provider: result.provider, model: result.model, id: result.id, usage: result.usage }, vision, failingAfter, openWeightVerification: verification, review });
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
  const summary = { target: path.basename(root), state, investigation: investigation && { state: investigation.state, observations: investigation.observations.length, turns: investigation.turns, verdict: investigation.verdict, confirmation: investigation.confirmation || null, coverage: investigation.coverage, tokensUsed: investigation.tokensUsed }, initialFailing, repairsCommitted, finalPass: final.pass, finalFailing: final.signals.filter((s) => !s.pass).map((s) => s.id), receipts, finishedAt: new Date().toISOString() };
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
