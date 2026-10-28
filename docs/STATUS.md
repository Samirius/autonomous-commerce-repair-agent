# Status

Updated: 2026-10-28

## Completed
- Mission 005 (external eval, first run): 1/3 detected. Bundles preserved at `~/Desktop/mission005-results.zip` (56 files).
- Mission 006: probe v2 (`scripts/probe.mjs`) — per-product price/cart investigation for every presented product, mixed carts, quantity controls, promo codes, console errors, pointer purchase, desktop screenshot. Model-requested safe observations in discovery (max 2/round, allowlisted kinds). Generalized invariant tests added (`tests/probe.test.mjs`, incl. observation validation).
- Tests: 20/20 passing (`npm test`).
- External re-run (upgraded, `eval/results/thirdparty-rerun-*`): all three cases now detected and repaired under the built-in probe — case-01 discount rounding (1 call, 3,404 tokens), case-02 second product priced from the featured product's catalog entry (1 call, 10,545 tokens), case-03 displayed price inflated by 1000 minor units (1 call, 2,509 tokens). No observation requests were needed. **External oracle verdict is still ChatGPT's to give** — probe-green is not oracle-green.
- Committed locally; NOT pushed (awaiting review).

## Ongoing
- Awaiting ChatGPT's oracle evaluation of the Mission 005/006 bundles and code review of the private repo.

## Blocked
- Muse Spark Open (Baseten): still no `BASETEN_API_KEY`. Unchanged, non-blocking.

## Weaknesses / remaining limitations
- Presentation detection is heuristic: a product counts as "presented" only if its catalog name appears in the DOM, and its price/buy control are located by walking up ancestors — exotic layouts (shadow DOM, canvas-rendered, paginated catalogs, server-rendered carts) can still be invisible.
- Probe scenarios assume the fixture contract ids (`#cart-count`, `#cart-total`, `#add-to-cart`, promo ids `#promo-code`/`#apply-promo`, `data-inc`/`data-dec`); stores using different conventions get layout + featured-product coverage only.
- Cart expected-value math encodes our bulk-discount semantics (rule applies on total quantity); a store whose discount semantics differ (per-line, tiered, BOGO, tax/shipping) would be falsely flagged or missed.
- Model-requested observations exist but were not needed in the re-run; their value is unproven on a case where initial evidence is genuinely insufficient.
- Discovery commit rule (failing signals must strictly decrease) remains.

## Next
- ChatGPT: oracle-verify `thirdparty-rerun-*` bundles (pristine vs target).
- Samir decision: push Mission 006 commit after review; provide BASETEN_API_KEY for the Open Weights verifier.
