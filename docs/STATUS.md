# Status

Updated: 2026-10-28

## Completed
- Missions 001–007 as recorded. `e69dc40` pushed to the private repo (Mission 008 Task 1: tests 25/25 + secret scan re-verified before pushing).
- Mission 008: investigation coverage matrix (mixed cart / quantity / promo-on-mixed-cart), 6-turn + 30k-token investigation budgets, coverage-complete verdict forcing; confirmation scenarios (`expectedScenarioMinor`) turning suspicions into deterministic confirmed defects with probe+scenario verified repairs and rollback; CRLF-tolerant patch application (`resolveRepair`).
- **Autonomous investigation proof (live, `artifacts/investigation-proof/`)**: target store passes every probe signal, yet Wonder's observations (mixed cart + SAVE10) exposed a promo defect (discount on first line only), the agent confirmed it deterministically (expected 19080 vs observed 19910 minor units), repaired it (`discount` rebased to subtotal), and verified probe + scenario green. Run history includes two honest failures first: a false verified-healthy (promo tested on one product only → coverage matrix fixed) and CRLF patch rejections (→ resolveRepair).
- Reliability repeats: investigation-target proof succeeded on the fixed system (8,829 receipt tokens, ~89s); healthy realistic store re-investigated to `verified-healthy` with 3 observations / 13,653 investigation tokens (down from 21,937 in Mission 007); stub-provider state-machine tests cover both paths without network.
- Demo: `npm run demo` (copies `fixtures/demo-broken/`, real Meta calls, prints patches + verification; latest run: 2 repairs, 6,572 tokens, 40s). Repeatable with no manual reset.
- Tests: 27/27. Main storefront green. Committed locally; NOT pushed (awaiting approval).

## Ongoing
- Final submission preparation (demo script/video, README polish) — next mission.

## Blocked
- Muse Spark Open (Baseten): **no `BASETEN_API_KEY`** — exact requirement: a Baseten API key with access to `meta-models/muse-spark-open` set as `BASETEN_API_KEY` in the environment or project `.env`. Adapter ready; zero simulated responses used.

## Weaknesses / remaining limitations
- The confirmed-repair path only supports cart-total scenarios (cart-scenario/apply-promo/inspect-cart); other suspicion classes still end as suspected-unverified.
- Investigation reliability is model-dependent: in 3 live investigation-target attempts, outcomes were 1 false-healthy (pre-fix), 1 confirmed-but-unrepaired (CRLF, pre-fix), 1 full success (post-fix). One post-fix success is a demonstration, not a reliability statistic.
- Investigation tokens remain material (~9–14k per run) even with budgets.

## Next
- Samir approval to push Mission 008; BASETEN_API_KEY for the Open Weights verifier; record the 3-minute demo from `npm run demo` + the investigation-proof artifacts.
