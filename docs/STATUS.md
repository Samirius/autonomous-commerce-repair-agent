# Status

Updated: 2026-10-28

## Completed
- Missions 001–003 as previously recorded (guided multi-defect repair; blind internal eval 6/6; vision input proven).
- Mission 004-A: leakage audit (`docs/LEAKAGE_AUDIT.md`). Discovery is evidence-guided code inspection, not raw-pixel discovery; known-defect flow is guided repair and must not be cited as discovery. Mitigations applied: probe `expectedQty*` withheld from model prompts (L3), stale "intentional defect" comment removed from main storefront (L4), neutral `target/` naming in the external interface (L6). Disclosed, not fixable by design: probe↔oracle spec correlation (L7), descriptive identifiers (L5).
- Mission 004-B: external evaluator interface (`eval/external/`) — fixture + optional evaluator oracle from outside the repo, agent as subprocess, neutral copy, results bundle (manifest, pristine/target, decisions, patches, diffs, oracle before/after). Smoke-tested on the healthy realistic fixture: agent exit 0, 0 model calls, 0 changes.
- Mission 004-C: realistic disposable fixture (`fixtures/realistic-store/`): 3 products, cart line quantities (+/−, remove at 0), promo codes SAVE10/WELCOME15 from canonical catalog rules, subtotal/discount/total in integer minor units, responsive 3-col → 1-col. Probe now scrolls interactives into view before hit-testing (multi-section pages). Fixture passes the generic probe; behavior covered by tests.
- Mission 004-E: tracked files sanitized (one Mission 001 history.json contained an absolute local path — replaced; future records use relative names). Secret scan clean. README now has installation, models used, demo + external-eval commands. Not published.

## Ongoing
- None.

## Blocked
- Muse Spark Open real request (Mission 004-D): still **no BASETEN_API_KEY** in the environment. Adapter + integration points are in place; verifier remains `available:false`. No other work is blocked on it.

## Weaknesses / risks
- External proof still pending: ChatGPT's independently authored scenarios have not run yet — that is now unblocked by the interface and is the decisive generalization test.
- Probe contract assumes one featured product (`products[0]`) for price/cart invariants; richer carts (the realistic fixture included) are only partially probed.
- Discovery commit rule (failing signals must strictly decrease) can reject correct partial fixes.
- Eval artifacts/results are gitignored, so public-repo readers see summaries, not full bundles, unless we choose to publish a bundle.

## Next
- Samir/ChatGPT: author external fixtures + oracle outside the repo, run `eval/external/run-external.mjs`, review the bundle.
- Provide BASETEN_API_KEY → first real Muse Spark Open verification.
- Publication only after Samir approves.
