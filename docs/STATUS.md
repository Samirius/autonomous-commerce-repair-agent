# Status

Updated: 2026-10-30 (audit fixes + fresh-store evaluation harness, branch `audit-fixes-2026-10-30`)

## Current state
- Repository: `Samirius/autonomous-commerce-repair-agent`, **public since 2026-10-30** (owner-approved). The audit work (PR #1) was fast-forwarded into `main` on 2026-10-30.
- Tests: **33/33** (`npm test`, no API key needed), verified from a fresh clone on 2026-10-30.
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

## Fresh-store evaluation (run 2026-10-30, harness `990f684`)
`eval/fresh-2026-10-30/`: 3 hidden-defect stores + 1 healthy control, validated offline (4/4 VALID), rules in `PREREGISTRATION.md`. Run once per store on **GLM 5.3** via Hermes (Meta API credits ran out on 2026-10-30, so this is not a Meta-model result): **1 of 3 hidden bugs found and repaired** (store-a, bulk-discount threshold), **2 missed** (store-b, store-c: declared healthy after only small baskets), control store-d correctly left untouched. See `evidence/fresh-2026-10-30/glm-5.3/RESULTS.md`. Lesson: the coverage checklist can be satisfied by minimal baskets; next step is coverage derived from the catalog (every product, quantities at rule thresholds). A Meta-model run would be reported separately in `muse-wonder-1.0/`.

## Pending owner actions
1. ~~Rotate the exposed Baseten key~~ — not needed: that key has expired (owner-confirmed 2026-10-30). Any current key goes in local `.env` only.
2. ~~Merge `audit-fixes-2026-10-30`~~ — done 2026-10-30.
3. ~~Run `npm run eval:fresh`~~ — done 2026-10-30 on GLM 5.3 via Hermes (`MODEL_PROVIDER=hermes`); results committed as produced.
4. Local Windows path in commit `e661e16` (removed in `e5784df`, still in history): **decided 2026-10-30, keep history as is.** It reveals only the Windows username; rewriting would change every commit id the docs and evidence cite.
5. ~~Make the repository public~~ — done 2026-10-30. Record the video (`docs/STORYBOARD.md`); submit the form before 2026-11-04 21:00 EST (2026-11-05 04:00 Cairo).

## Known limitations
- Disposable JavaScript storefronts under the documented fixture contract only — not a production WooCommerce integration; no live store ever touched.
- Patch safety = file allowlist + pattern blocklist, not a sandbox.
- Investigation is probabilistic and token-costly (~8–14k tokens per live run); reliability counts are small and reported as such.
- The confirmed-repair path covers cart-total scenarios; other suspicion classes end as `suspected-unverified` by design.
