# External evaluator interface (v1)

For an evaluator (e.g. ChatGPT as external reviewer) to run **their own** blind scenarios against this agent, with their answer keys staying outside this repository.

## Rules of the interface

- The evaluator authors a **fixture** (a storefront directory) and, optionally, an **oracle** module. Both live **outside this repo** (or in a directory they control). The agent never receives the fixture's name, the scenario description, or the oracle.
- The runner copies the fixture to a neutral directory called `target/` before the agent sees it (see `docs/LEAKAGE_AUDIT.md`, finding L6).
- The agent runs as a subprocess (`src/discover.mjs`) whose only inputs are the target copy and an artifacts dir. The oracle path is never passed in argv or env.
- Deterministic assertions remain the evaluator's: this repo's probe is evidence for the model, **not** the evaluator's answer key.

## Fixture contract

A fixture is a static directory loadable via `file://` containing:

| File | Requirement |
|---|---|
| `index.html` | Loads `catalog.js` then `app.js`; contains `#product-price` (with `data-price-minor`), `#cart-count`, `#cart-total` (with `data-total-minor`), and `#add-to-cart` |
| `catalog.js` | Sets `window.CATALOG = { products: [{ id, name, priceMinor, currency }], rules?: { bulkDiscount?: { minQty, percentOff } } }`. Money in integer minor units. First product = featured product |
| `app.js` | Storefront behavior; prices/totals rendered from the catalog |
| `styles.css` | Layout |

The agent may only patch `styles.css`, `app.js`, `index.html` inside the copy. `catalog.js` is read-only canonical data. A healthy reference fixture implementing this contract (multi-product, quantities, promo codes, responsive) is at `fixtures/realistic-store/` — evaluators may copy it and introduce their own defect into **their copy**.

## Run it

```bash
# from the repo root; MODEL_API_KEY must be set (env or .env)
node eval/external/run-external.mjs --fixture /absolute/path/to/fixture
node eval/external/run-external.mjs --fixture /absolute/path/to/fixture --oracle /absolute/path/to/oracle.mjs
```

Oracle module contract: an `.mjs` file exporting `async function runOracle(rootDir)` returning a JSON-serializable object with at least `{ pass: boolean }`. It is executed by the runner **before and after** the agent, against the target copy — the agent subprocess never sees it.

## Results bundle

`--out` dir (default `eval/results/external-<timestamp>/`):

- `manifest.json` — fixture file hashes, agent exit code, repairs/attempts/tokens, changed files, oracle results
- `pristine/` and `target/` — fixture before vs after the agent
- `agent/` — probe before/after, screenshots (with SHA-256 in decision records), `model-decision-*.json` (raw model responses + usage), `patches/` (each attempted patch with committed/rolled-back status), `history.json`, `verification.json`
- `diffs/<file>.diff` — per-file diff for every changed file
- `agent-stdout.log`, `agent-stderr.log`

## Notes / limits

- If the fixture already passes every probe invariant, the agent does not stop: it runs the investigation phase (typed observations, coverage matrix, deterministic confirmation before any repair — see `docs/DECISIONS.md` D13–D14).
- The probe assumes the fixture contract above (single featured product for price/cart invariants; all interactives are checked at 390/360/1280 widths). An evaluator whose fixture deliberately departs from the contract should rely on their own oracle and treat agent repairs as proposals to assess.
- Do not place fixtures or oracles inside `eval/variants/` for a blind run — that directory is our own (Mission 003) test set, not the external one.
