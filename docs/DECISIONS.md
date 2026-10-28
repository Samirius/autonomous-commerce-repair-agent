# Decisions

## D1 — Provider-independent model layer (2026-10-28)
All model access goes through `src/provider.mjs` (`chatJSON`). Meta Model API is the default (`MODEL_PROVIDER=meta`, OpenAI-compatible endpoint `https://api.meta.ai/v1`); any OpenAI-compatible provider can be selected by env vars alone. Rationale: replace Wonder↔Spark or another provider without rewriting the workflow; keeps the demo Meta-powered while avoiding lock-in in agent logic.

## D2 — Deterministic verification, AI only proposes (2026-10-28)
Pass/fail is decided solely by Playwright geometry/hit-test/click checks (`scripts/check.mjs`), never by the model judging its own work. The model proposes one JSON repair; code validates scope (only `styles.css`, exact-once match) and rolls back byte-for-byte on failure. Rationale: verifiable, demo-safe, and the rollback path is real and tested.

## D3 — Static file storefront, no build step / no server (2026-10-28)
The demo store is plain HTML/CSS/JS loaded via `file://` in Playwright. Rationale: smallest verifiable slice; removes server/build failure modes from the hackathon demo.

## D4 — Run artifacts as the memory (2026-10-28)
Each run writes `artifacts/run-<ts>/` (screenshots, evidence, model decision, diff, verification, history) and appends a summary line to `memory/runs.jsonl`. Rationale: judges and future agents can audit exactly what the model decided and what the tests returned — no fabricated history.
