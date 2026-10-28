# Status

Updated: 2026-10-28

## Completed
- Missions 001–002: known-defect multi-repair on the main storefront, live Meta runs verified (git e661e16, 9e3d38e).
- Mission 003 Part B (vision): audit found Mission 001/002 model calls were text-only. Provider now sends the screenshot as a base64 `image_url` part; proof = screenshot SHA-256/size recorded beside each model response id. Standalone live probe: Muse Wonder identified the covering promo banner from the screenshot alone (chatcmpl-01a1832c…, 1,545 tokens).
- Mission 003 Part A (blind eval): generic invariant probe (`scripts/probe.mjs`) + discovery mode (`src/discover.mjs`, no defect names/fixes given). Six unseen variants in `eval/variants/`, private oracle in `eval/oracles.mjs`. Blind run `eval-2026-10-28T15-44-14-331Z`: **6/6 discovered, 6/6 repaired, 1 attempt each, 0 regressions, 0 unexpected rollbacks, 17,758 tokens total** (2,475–3,505 per variant). Summary committed at `docs/eval-mission003-summary.json`; full artifacts in `eval/results/` (gitignored).
- Mission 003 Part C (open-weight verifier): Baseten adapter implemented (`src/verifier.mjs`) for `meta-models/muse-spark-open`; advisory only.
- Security: agent allowlist + path/traversal rejection tests (cannot patch eval/oracles/catalog/agent itself); secret scan of tracked files clean; no project `.env`.
- Tests: 14/14 passing. Main storefront check still green.

## Ongoing
- None for Mission 003.

## Blocked
- Muse Spark Open real request: **no BASETEN_API_KEY available** (unauthenticated endpoint probe returned HTTP 403). Adapter reports unavailable; no response fabricated. Unblocks instantly when a key is provided.

## Weaknesses noted
- Blind variants are still single-product, single-page stores authored by us; "unseen" means unseen by the agent/model, not independently authored. A truly external test set remains the biggest credibility gap.
- Discovery commit rule (failing signals must strictly decrease) can reject a correct partial fix that does not reduce the signal count.
- USD cost per model is not exposed by the Meta API responses; tokens are tracked exactly, dollar cost is not claimed.

## Next
- Provide BASETEN_API_KEY → run verifier live on the eval set for the Open Weights track.
- Judge demo: re-break main storefront, run `npm run agent`, show receipts; optionally add independently-authored variants.
