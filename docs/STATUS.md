# Status

Updated: 2026-10-28

## Completed
- Mission 001: single-defect CTA repair, live Meta run verified (see git history e661e16).
- Mission 002: canonical catalog (`storefront/catalog.js`, integer minor units, agent read-only); price-mismatch defect added (cart used stale `LEGACY_CART_PRICE_MINOR=7900` vs canonical 8900).
- Deterministic checks now return a defect list: cta-overlap (mobile 390×844 + desktop 1280×800) and price-mismatch (displayed price + 2-click cart total vs catalog, integer minor units). Before-run: both RED (cart 15800 vs expected 17800).
- Agent generalized: severity-prioritized queue, one defect at a time, model selects file (allowlist styles.css/app.js/index.html; catalog.js excluded) and patch — no defect→fix mappings. Generic validation incl. anti-hardcoding of canonical values and no execution constructs. Per-defect verify + regression recheck of previously repaired defects; rollback is per-file; queue continues on failure; max 2 model attempts/defect with failure feedback.
- Provider config tests added (meta defaults, env-only provider/model swap, unknown provider rejected) — no network.
- Tests: 11/11 passing (validation, catalog rejection, anti-hardcode, CTA rollback, price per-file rollback, regression rollback, provider config).
- Live Mission 002 run `run-2026-10-28T15-36-24-508Z`: queue [cta-overlap, price-mismatch]; muse-wonder-1.0 repaired both on attempt 1 — styles.css `bottom: 16px→100px`; app.js `LEGACY_CART_PRICE_MINOR * count` → `product.priceMinor * count` (catalog-derived, no hardcoded 8900). Final check: all pass. Receipts in artifacts + memory/runs.jsonl.

## Ongoing
- None for Mission 002.

## Blocked
- None.

## Weaknesses noted
- The model's price repair left the now-unused `LEGACY_CART_PRICE_MINOR` constant in app.js (dead code; harmless, but a cleanup pass could remove it).
- Price check isolates pricing with DOM clicks when the CTA is obscured; pointer-level cart proof only exists via the CTA defect check.

## Next
- Mission 003 candidate: third defect class + judge-facing demo script (reset-to-broken → run → receipts), and remove the dead legacy constant via a model cleanup repair or leave as evidence.
