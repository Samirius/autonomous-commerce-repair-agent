# Submission readiness (Mission 009)

## Architecture in one paragraph
Playwright probes a storefront and reports generic commerce invariants (per-product prices vs a canonical catalog in integer minor units, cart/mixed/quantity/promo behaviour, layout usability at 390/360/1280, console errors) with screenshots. **Muse Wonder** (`muse-wonder-1.0`, Meta Model API, multimodal) diagnoses from that evidence + source and either requests typed browser observations, proposes one scoped patch, or — in investigation mode — actively works the store before any verdict. Code validates every patch (file allowlist, exact-once match, a blocklist of obvious execution constructs — not a sandbox — and no hardcoded canonical values), applies it, re-verifies deterministically, and rolls back per-file on failure. **Muse Spark Open** (`meta-models/muse-spark-open` via Baseten) independently reviews each committed repair: approve / concern / reject / unavailable are separate statuses from the deterministic verdict; a concern triggers one bounded additional probe and a human-review flag, and can never overrule tests or edit code.

## Which Meta model did what (all live, ids in artifacts)
| Role | Model | Evidence |
|---|---|---|
| Diagnosis, investigation, patch proposals | Muse Wonder (`muse-wonder-1.0`) | `artifacts/*/model-decision-*.json`, `investigation-turn*.json` — response ids + token usage per call |
| Independent repair review | Muse Spark Open (`meta-models/muse-spark-open`) | `openWeightVerification` + `review` in **demo-run** `verification.json` files (e.g. `artifacts/demo-*/run/`); the Mission 008 investigation-proof run predates this wiring and has no such receipt — its repair was reviewed separately in `evidence/openweight-verifier-live-check.json` |
| Pass/fail authority | Deterministic Playwright checks (no model) | `probe-before.json` / `probe-after.json`, external oracles (Missions 005/006, ChatGPT-authored), fresh-store oracles (`eval/fresh-2026-10-30/oracles/`) |

## Reproducible setup
```bash
npm install
npx playwright install chromium   # one-time, if the browser is not cached
cp .env.example .env   # MODEL_API_KEY (Meta), BASETEN_API_KEY (Baseten)
npm test               # 33 tests
npm run replay         # keyless replay of recorded runs
npm run demo           # repeatable end-to-end demo with real Meta calls
```

## Public repository readiness checklist
- [x] Tracked-file secret scan clean; keys only in env/`.env` (gitignored). The one Baseten key exposed in chat was never committed; it has since expired (owner-confirmed 2026-10-30), so no rotation is needed
- [x] No `.env`, `node_modules`, or eval result bundles tracked; local absolute paths sanitized from artifacts
- [x] README: purpose, models, installation, demo commands, architecture pointers
- [x] Continuity docs: `docs/STATUS.md`, `docs/DECISIONS.md` (D1–D14), `docs/LEAKAGE_AUDIT.md`, this file, `docs/DEMO_SCRIPT.md`
- [x] Meaningful commit history (mission-by-mission, no pre-hackathon code)
- [ ] Samir's explicit approval before making the repository public (currently PRIVATE)
- [ ] Decide whether gitignored eval bundles should be published as evidence zips alongside the repo

## Demo reliability (Mission 009, 4 consecutive `npm run demo` runs)
4/4 succeeded (`confirmed-issue-repaired`, 2 repairs each, 0 rollbacks): Wonder 7,437–8,044 tokens/run, Spark Open 2,608–2,743 tokens/run across 2 reviews, 42–56s each. Verdicts: 8/8 open-weight approvals in the final configuration (an earlier run produced a legitimate `concern`, which is preserved in its bundle and motivated the evidence-payload fix). Failures are not deleted: failed/incomplete runs remain in `artifacts/` and in git history.

## Remaining limitations
- Contract-bound probing: stores must expose the fixture conventions (catalog global, cart/price element ids, promo/quantity controls); exotic stacks (shadow DOM, server carts, canvas) get partial coverage.
- Discount semantics are ours (bulk-then-promo on the subtotal); tiered/BOGO/tax/shipping models can be falsely flagged or missed.
- Investigation is model-driven and therefore probabilistic: across all live investigation-target attempts we saw false-healthy, confirmed-unrepaired, and full success outcomes before the fixes; current configuration succeeded, but n is small.
- Confirmed-repair path covers cart-total scenarios; other suspicion classes end as `suspected-unverified` by design.
- Patch validation blocks obvious execution constructs by pattern only; e.g. `fetch(...)` or DOM-wiping code would pass. Safe here only because every target is a disposable copy.
- The investigation coverage rule (promo on a mixed cart) was added after a false `verified-healthy` on the Mission 008 target; the fresh-store evaluation exists to test the harness on defects it was not tuned for.
- Costs are tracked in tokens; the Meta API does not return USD amounts, so no dollar figures are claimed.
