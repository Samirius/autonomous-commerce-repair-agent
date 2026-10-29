# Status

Updated: 2026-10-30 (audit fixes + fresh-store evaluation harness, branch `audit-fixes-2026-10-30`)

## Current state
- Repository: `Samirius/autonomous-commerce-repair-agent` (**PRIVATE**). `main` is at `1327dcd` (Mission 012). The audit work is on branch `audit-fixes-2026-10-30` pending Samir's merge.
- Tests: **31/31** (`npm test`, no API key needed), verified from a fresh clone on 2026-10-30.
- Licence: MIT (`LICENSE`).
- Keyless viewing: `npm run replay` prints the recorded evidence trails; `npm run demo` without a key now exits with that hint instead of a stack trace.

## Audit fixes (2026-10-30, see `docs/DECISIONS.md` D15)
- Patch text containing `$$`, `$&` or `$'` was corrupted on apply (every fixture formats money as `` `$${...}` ``). Fixed; regression test added.
- A confirmation basket outside the observation limits (qty > 5, > 4 lines, unknown ids), a promo code with no promo UI, or a missing cart total (NaN) could mark a HEALTHY store as a confirmed defect. Fixed: expected and observed now describe the same normalised basket; regression test added.
- Model and reviewer API calls now time out (`MODEL_TIMEOUT_MS`, default 120 s) instead of hanging the demo.
- External runner comment claimed a scrubbed environment; corrected to what the code does.
- Claim wording corrected in README, PROJECT, SUBMISSION, STORYBOARD, DEMO_SCRIPT, LEAKAGE_AUDIT, evidence/README.

## What was proven (see `evidence/README.md` for which record proves what)
- Guided multi-defect repair and the probe-driven discovery loop (Missions 001–003, 6/6 internal variants written by the same author as the probe).
- Outside-authored cases (ChatGPT as reviewer): 1/3 detected (Mission 005), then 3/3 repaired and oracle-verified (Mission 006) **after the probe was widened in response** — a re-test, not a blind result. Bundles are not in this repo.
- Autonomous investigation: probe-invisible promo defect found, deterministically confirmed (19080 vs 19910 minor units), repaired and double-verified (Mission 008); healthy store investigated to `verified-healthy`. Caveat: the mixed-cart promo coverage rule was added after a miss on that same target (LEAKAGE_AUDIT L11).
- Muse Spark Open performs real in-process reviews of committed repairs in demo runs. The Mission 008 investigation-proof run predates that wiring; its repair was reviewed separately (`evidence/openweight-verifier-live-check.json`).

## Fresh-store evaluation (ready, not yet run)
`eval/fresh-2026-10-30/`: 3 hidden-defect stores + 1 healthy control, authored after the harness fixes, validated offline (`node eval/fresh-2026-10-30/validate-fixtures.mjs`: all 4 VALID), rules in `PREREGISTRATION.md`. Needs one live run: `npm run eval:fresh` with `MODEL_API_KEY` in `.env`. Results land in `evidence/fresh-2026-10-30/` and are committed as produced.

## Pending owner actions
1. Rotate the previously exposed Baseten API key — still pending. Replacement key only in local `.env`.
2. Review and merge branch `audit-fixes-2026-10-30`.
3. Put `MODEL_API_KEY` (+ `BASETEN_API_KEY`) in `.env`, run `npm run eval:fresh` once, commit `evidence/fresh-2026-10-30/`.
4. Decide on the local Windows path that commit `e661e16` (Mission 001) added to `artifacts/run-2026-10-28T15-26-11-133Z/history.json` (removed in `e5784df`, still in history): accept it, or rewrite history before going public.
5. Approve making the repository public; record the video (`docs/STORYBOARD.md`); submit the form before 2026-11-04 21:00 EST (2026-11-05 04:00 Cairo).

## Known limitations
- Disposable JavaScript storefronts under the documented fixture contract only — not a production WooCommerce integration; no live store ever touched.
- Patch safety = file allowlist + pattern blocklist, not a sandbox.
- Investigation is probabilistic and token-costly (~8–14k tokens per live run); reliability counts are small and reported as such.
- The confirmed-repair path covers cart-total scenarios; other suspicion classes end as `suspected-unverified` by design.
