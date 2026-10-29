# Leakage audit — is discovery genuinely independent? (Mission 004, 2026-10-28)

Scope: `src/agent.mjs` (known-defect flow), `src/discover.mjs` + `scripts/probe.mjs` (discovery flow), `eval/` (Mission 003 blind run). Verdicts are about what the **model** receives, not what is saved to disk.

## Verdict

Discovery is **genuinely model-driven but not raw-evidence-only**. The model is never given a fix, a file choice, or the oracle. It *is* given (a) which generic invariants fail, (b) observed values, and (c) the full source of the storefront — including, in places, code whose names/comments make the cause easy to read. Diagnosis is therefore best described as **evidence-guided code inspection**, not unaided discovery from pixels. The known-defect flow (`npm run agent`) is explicitly *not* discovery and should never be cited as such.

## Findings

| # | Channel | What the model receives | Leakage | Severity | Action |
|---|---------|------------------------|---------|----------|--------|
| L1 | Known-defect flow (`src/agent.mjs`) | Defect id, title ("Cart total disagrees with canonical catalog price"), severity, full check evidence | The diagnosis is essentially handed over; only the patch is model-authored | High — if cited as "discovery" | Documented: this flow is *guided repair*. Autonomous-discovery claims may only cite discovery mode / external eval |
| L2 | Probe signal ids (`scripts/probe.mjs`) | Failing invariant names, e.g. `cart-total-matches-catalog-rules`, `interactive-usable@mobile:add-to-cart` | Names the *symptom class*, not the cause, file, or fix | Low — comparable to a failing test name | Accepted; documented here |
| L3 | Probe expected values | `expectedQty1/expectedQty2` totals alongside observed totals | The desired numeric outcome — an answer-key fragment (cause/fix still not given) | Medium | **Mitigated**: discovery now strips `expectedQty*` from the model prompt (kept in saved probe artifacts for humans). Expected totals remain derivable from the catalog, which is legitimate storefront source |
| L4 | Source comments (main storefront) | `// Intentional Mission 002 defect: the cart charges a stale legacy unit price…` in `storefront/app.js` | States the cause in plain English | High (main demo only) | **Mitigated**: comment removed (behavior-neutral; the defect it described was repaired in Mission 002, so it was also stale) |
| L5 | Source identifiers | `LEGACY_CART_PRICE_MINOR`, `subtotal(qty) { return price * (qty + 1) }`, `count * count` | Cause is easy to read once the failing invariant is known | Medium, inherent | Accepted and disclosed: this is code inspection. Renaming identifiers to neutralize this would be artificial and would misrepresent real codebases, where names are evidence too |
| L6 | Eval work-dir names (Mission 003) | Agent process worked in `…/work/v3-discount-double-applied/`; the **prompt** never contained the path, but the path existed in the process's arguments/logs | Latent: any future logging of `root` into a prompt would leak the defect class | Medium (latent) | **Mitigated** in the external interface: fixtures are copied to a neutral `target/` directory. Internal `eval/run-eval.mjs` still names dirs by variant — do not copy that pattern into prompts |
| L7 | Probe ↔ oracle correlation | `eval/oracles.mjs` and `scripts/probe.mjs` were written by the same author and share the expected-total formula | The oracle is independent code, but not an independent *specification* | Medium | Disclosed. This is the core reason for the external evaluator interface (Objective B): ChatGPT's scenarios must bring their own assertions |
| L8 | Catalog in prompt | Full canonical catalog (prices, discount rules) | None — this is the storefront's own source of truth, required to judge consistency; editing it is blocked by the allowlist | None | — |
| L9 | Screenshot | Real screenshot image (Mission 003+) | None — raw observation | None | — |
| L10 | Retry feedback | "Patch applied but verification still failed / rejected because…" | Reveals patch outcome, not the fix | Low | Accepted; standard repair-loop feedback |

## What the model is never given (verified by code inspection)

- The oracle (`eval/oracles.mjs`) — not imported by agent code, not in the prompt, agent works on a copied directory.
- Any expected patch, file ranking, or defect→fix mapping (none exist in `src/`).
- Variant names or scenario descriptions (prompts contain probe signals, catalog, file contents, screenshot only).
- Answer keys for the external evaluation — none exist in this repo by design (see `eval/external/README.md`).

## Bottom line for competition claims

- Claim: "The agent diagnoses and repairs from probe evidence, screenshots and source inspection, verified by deterministic tests." — supported.
- Do not claim: "The agent discovers defects from raw screenshots alone" or cite the known-defect queue flow as discovery.
- Investigation-phase prompts contain no source files (screenshot, catalog, presented products and observation results only); source is given only for the repair after deterministic confirmation (verified 2026-10-30, `src/discover.mjs`).
- L11 (2026-10-30): the coverage rule "promo applied to a MIXED cart" was added after a miss on the Mission 008 target, so that target is not a blind test of the final harness. Addressed by the pre-registered fresh-store evaluation (`eval/fresh-2026-10-30/`).
- Strongest remaining proof would be ChatGPT's externally authored scenarios run through `eval/external/run-external.mjs` with ChatGPT's own oracle kept outside this repo.
