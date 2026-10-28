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

## D4 — Run artifacts as the memory (2026-10-28)
Each run writes `artifacts/run-<ts>/` (screenshots, evidence, model decision, diff, verification, history) and appends a summary line to `memory/runs.jsonl`. Rationale: judges and future agents can audit exactly what the model decided and what the tests returned — no fabricated history.
