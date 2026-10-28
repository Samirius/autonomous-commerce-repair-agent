# Decisions

## D1 — Provider-independent model layer (2026-10-28)
All model access goes through `src/provider.mjs` (`chatJSON`). Meta Model API is the default (`MODEL_PROVIDER=meta`, OpenAI-compatible endpoint `https://api.meta.ai/v1`); any OpenAI-compatible provider can be selected by env vars alone. Rationale: replace Wonder↔Spark or another provider without rewriting the workflow; keeps the demo Meta-powered while avoiding lock-in in agent logic.

## D2 — Deterministic verification, AI only proposes (2026-10-28)
Pass/fail is decided solely by Playwright geometry/hit-test/click checks (`scripts/check.mjs`), never by the model judging its own work. The model proposes one JSON repair; code validates scope (only `styles.css`, exact-once match) and rolls back byte-for-byte on failure. Rationale: verifiable, demo-safe, and the rollback path is real and tested.

## D3 — Static file storefront, no build step / no server (2026-10-28)
The demo store is plain HTML/CSS/JS loaded via `file://` in Playwright. Rationale: smallest verifiable slice; removes server/build failure modes from the hackathon demo.

## D5 — Multi-defect queue with per-defect verify/rollback (2026-10-28, Mission 002)
Checks return a defect list with severity ranks. The agent repairs one defect at a time in rank order; verification of a repair requires (a) its own defect passing and (b) every previously repaired defect still passing. Failure rolls back only that defect's file; the queue continues. Rationale: independent proof per defect and no cross-defect collateral damage.

## D6 — Canonical data is read-only; hardcoding it is a rejected repair (2026-10-28)
`storefront/catalog.js` is the source of truth and is outside the patch allowlist. Validation also rejects any patch whose replacement text contains the canonical price (minor or formatted) for the price-mismatch defect. Rationale: changing the catalog to match buggy code, or pasting `8900` into the cart, would fake the repair; the cart must derive totals from the catalog at runtime.

## D7 — No defect→fix mappings (2026-10-28)
The agent loop contains no per-defect solution logic. The model picks the file and the exact replacement from evidence + file contents; code only enforces generic scope/safety rules and deterministic verification. Two model attempts per defect, with validation/verification failure fed back, before the defect is left unrepaired and the queue moves on.

## D8 — Discovery mode with a generic invariant probe (2026-10-28, Mission 003)
For unseen defects the agent gets no defect ids or expected fixes. `scripts/probe.mjs` reports generic commerce invariants (interactive usability per viewport, horizontal overflow, price/cart consistency vs the catalog in integer minor units); the model diagnoses the underlying issue from probe + screenshot + sources. Discovery commits only when failing signals strictly decrease with zero regressions, else the file rolls back. The blind oracle lives in `eval/oracles.mjs`, is never imported by agent code, and the agent only ever works on a copied storefront under `eval/results/.../work/` — it cannot edit variants, oracles, or tests (allowlist + basename validation).

## D9 — Screenshots are model inputs, not just artifacts (2026-10-28)
Audit of Mission 001/002 found the model received text-only payloads. The provider now sends the Playwright screenshot as a base64 `image_url` part with the structured evidence, and each decision record stores the screenshot SHA-256/size plus the model response id, so visual input is provable. Verified live: Muse Wonder identified the covering promo banner from the screenshot alone.

## D10 — Open-weight verifier is advisory only (2026-10-28)
Muse Spark Open (Baseten) is integrated behind `src/verifier.mjs` to independently review committed repairs. It cannot override deterministic browser checks. Without `BASETEN_API_KEY` it reports unavailable; fabricating a verifier response is forbidden.

## D11 — External evaluator interface (2026-10-28, Mission 004)
Blind scenarios must be authored outside this repo. `eval/external/run-external.mjs` takes a fixture (and optionally the evaluator's own oracle module) from an external path, copies the fixture to a neutral `target/` dir, runs the agent as a subprocess that never receives the oracle path, and emits a results bundle (pristine/target, model decisions, patches, diffs, oracle before/after, manifest). Probe `expectedQty*` values are withheld from model prompts (audit finding L3); the stale "intentional defect" source comment was removed from the main storefront (L4). Probe interactives are now scrolled into view before hit-testing so multi-section realistic pages are not falsely flagged.

## D12 — Probe v2 and model-requested observations (2026-10-28, Mission 006)
Mission 005's external run exposed probe coverage as the bottleneck (1/3 detected; the probe only exercised the featured product). The probe now investigates every product presented on the page (per-product displayed price vs catalog, per-product cart x2, mixed-product carts, quantity controls, catalog promo codes through the UI, console/page errors, pointer purchase). The model may also request up to 2 safe observations mid-diagnosis (`cart-scenario`, `product-detail`, `console-reload` — allowlisted shapes validated against the catalog; no arbitrary code). Commit/rollback rules are unchanged. Mission 005 bundles are preserved in `~/Desktop/mission005-results.zip`; the upgraded system re-detected and repaired all three external cases under the built-in probe (external oracle verdict remains ChatGPT's).

## D13 — Agent-directed investigation phase (2026-10-28, Mission 007)
When no deterministic signal fails, the agent no longer stops at "probe green". Wonder must actively investigate via typed tools (cart-scenario, quantity-change, apply-promo, inspect-cart, product-detail, console-reload, viewport) — at least 2 observations before any healthy verdict, with turn/budget pressure (8 turns) to force convergence. Outcome states are explicit: `verified-healthy` (probe pass + investigated healthy verdict), `investigation-incomplete` (budget exhausted), `suspected-unverified` (suspicion without deterministic confirmation — never patched), `confirmed-issue` (failing signals → normal repair loop). Review fixes landed with it: all promo codes iterated, `id`/`productId` normalized in observations, `console-reload` really reloads, desktop screenshots saved (`before/after-desktop.png`). Live demo: `artifacts/investigation-demo/` — Wonder ran 7 observations (6 tool kinds) on the healthy realistic store and concluded `verified-healthy` with quantified evidence (21,937 tokens); target unchanged. Note: without budget pressure the model explored indefinitely — convergence instructions are load-bearing.

## D14 — Confirmation scenarios and demo (2026-10-28, Mission 008)
A suspected verdict can name a typed confirmation scenario; the agent re-runs it and compares the outcome deterministically with `expectedScenarioMinor` (bulk rule then promo, integer minor units). Confirmed discrepancies enter a repair path whose verification is probe-pass AND scenario-match; anything else rolls back. Coverage for a healthy verdict is a matrix, not a count: mixed cart, quantity change, and promo applied to a *mixed* cart (promo-on-one-product proved unable to reveal composition-dependent defects — live run 1 of the proof target returned a false `verified-healthy`). Patch application now resolves LF patches against CRLF files (`resolveRepair`/`applyPatchText` in `src/agent.mjs`): a live confirmed repair was initially rejected twice on line endings alone. Budgets: 6 investigation turns, 30,000-token investigation cap, coverage-complete stops further observations. Repeatable demo: `npm run demo` copies `fixtures/demo-broken/` to a fresh target and runs discovery end-to-end.

## D4 — Run artifacts as the memory (2026-10-28)
Each run writes `artifacts/run-<ts>/` (screenshots, evidence, model decision, diff, verification, history) and appends a summary line to `memory/runs.jsonl`. Rationale: judges and future agents can audit exactly what the model decided and what the tests returned — no fabricated history.
