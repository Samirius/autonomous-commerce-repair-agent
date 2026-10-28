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

## D4 — Run artifacts as the memory (2026-10-28)
Each run writes `artifacts/run-<ts>/` (screenshots, evidence, model decision, diff, verification, history) and appends a summary line to `memory/runs.jsonl`. Rationale: judges and future agents can audit exactly what the model decided and what the tests returned — no fabricated history.
