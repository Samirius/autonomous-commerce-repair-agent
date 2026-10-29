# Fresh-store evaluation — pre-registration (written 2026-10-30, before any live run)

## Why this exists
The Mission 008 hidden-defect demo is real, but the investigation coverage rule ("promo applied to a MIXED cart") was added after the first live run on that same store returned a false `verified-healthy`. A fair reader can ask whether the harness was tuned to that one bug. This evaluation tests the frozen harness on defects it was never tuned for.

## Stores (authored 2026-10-30, after the harness was frozen)
Neutral names; each store follows the fixture contract in `eval/external/README.md`.

| Store | Defect class (hidden from the agent) | Why the generic probe cannot see it |
|---|---|---|
| store-a | Bulk-discount threshold off by one (rule says 4+ items; store applies it from 5) | Probe baskets never reach 4 items |
| store-b | Cart subtotal ignores the 4th distinct product | Probe's mixed cart uses only 3 products |
| store-c | A stale 5% "multi-buy" for 3+ of one item that the catalog does not define | Probe never adds more than 2 of one item |
| store-d | None — healthy control (same 4-product layout as store-b) | — |

Validity is checked offline by `validate-fixtures.mjs` (no model calls): probe passes; the oracle fails on stores a–c and passes on d; the oracle passes on hand-repaired copies; one typed agent tool scenario reaches each defect.

**Author disclosure:** stores, oracles and this file were written by Claude (Claude Code session for Samir) on 2026-10-30. The author also fixed two harness bugs that day (see `docs/DECISIONS.md` D15) *before* writing the stores; no harness change was made with the stores' defects in mind, and none may be made between store runs. The author is not independent of the project. The oracles are independent of the probe's code (hand-computed integers, not `scripts/probe.mjs`).

## Procedure
1. Commit everything; record the harness commit SHA (the runner records it and flags uncommitted harness changes).
2. Run `npm run eval:fresh` **once**. Each store gets exactly one live run of `src/discover.mjs` via `eval/external/run-external.mjs`; the oracle never reaches the agent.
3. Commit `evidence/fresh-2026-10-30/` exactly as produced. No re-runs to improve numbers. If a run crashes for infrastructure reasons (HTTP error, timeout), it may be re-run once and the crash is reported alongside.

## Outcome classes (decided by agent state + oracle only)
Buggy stores: `FOUND+REPAIRED` (confirmed, repaired, oracle passes after) · `REPAIRED-BUT-ORACLE-FAILS` · `FOUND-NOT-REPAIRED` · `SUSPECTED-NOT-CONFIRMED` · `MISSED (false healthy)` · `MISSED (other state)`.
Control store: `CORRECT-HEALTHY` · `NO-FALSE-ALARM (other state)` · `FALSE-ALARM (code changed)`.

## What we will claim
Exactly the table in `evidence/fresh-2026-10-30/RESULTS.md`, as "n = 3 defect stores + 1 control, one run each". No rates, no generalisation beyond that. Misses are reported in the README and the video with the same prominence as successes.
