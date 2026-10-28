# Status

Updated: 2026-10-28

## Completed
- Missions 001–006 as recorded (blind external eval: Mission 005 1/3 → Mission 006 3/3 oracle-verified by ChatGPT). Commit `7dc725c` pushed to the private repo.
- Mission 007: investigation phase in discovery — when probes pass, Wonder must request typed observations (cart-scenario, quantity-change, apply-promo, inspect-cart with optional checkout, product-detail, console-reload, viewport) before any verdict; states: verified-healthy / investigation-incomplete / suspected-unverified / confirmed-issue; suspicion never patches code. Review fixes: all promo codes iterated (was first only), `id` vs `productId` normalized, console-reload actually reloads, desktop screenshots saved when requested.
- Tests: 25/25 (`npm test`), incl. stub-provider investigation tests (verified-healthy gating, suspicion-never-patches, premature-verdict = incomplete) and promo/productId/reload tests. Main storefront check green.
- Live tool-use demo (`artifacts/investigation-demo/run/`, committed; the copied target is gitignored): Wonder made 7 observation requests across 6 tool kinds on a copy of the healthy realistic store, then returned a quantified healthy verdict → state `verified-healthy`, 21,937 tokens, target byte-identical to the fixture. First two demo attempts hit the turn budget without a verdict (`investigation-incomplete`); adding explicit turn/budget pressure to the prompt fixed convergence — recorded honestly in DECISIONS D13.

## Ongoing
- Awaiting review of Mission 007 commit (local only, not pushed).

## Blocked
- Muse Spark Open (Baseten): still no `BASETEN_API_KEY` in the environment. Adapter remains `available:false`; nothing fabricated.

## Weaknesses / remaining limitations
- Investigation only triggers when the initial probe fully passes; a store with one known failure gets repairs, not open-ended exploration of other workflows.
- The model will happily spend its whole observation budget exploring; verdict convergence depends on explicit budget-pressure wording.
- The investigation demo's run artifacts are committed under `artifacts/investigation-demo/run/` (target copy gitignored); other eval bundles remain gitignored, so parts of the evidence trail are docs + reproducible commands only.
- Probe/observation semantics remain contract-bound (fixture ids, our discount math) as previously noted.

## Next
- Push Mission 007 after review; provide BASETEN_API_KEY for the Open Weights verifier; prepare the 3-minute demo (re-break → guided run → investigation on healthy store).
