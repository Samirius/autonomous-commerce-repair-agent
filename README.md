# Autonomous Commerce Repair Agent

AI system that autonomously detects, repairs and verifies real e-commerce storefront problems:
**Observe → Diagnose → Plan → Act → Verify → Rollback or Commit → Remember.**

Built from scratch for the Meta Global AI Developer Hackathon (Oct 26–Nov 4, 2026), Indie Developer track, theme *Build for Your World*.

**Models used**
- **Muse Wonder** (`muse-wonder-1.0`, Meta Model API, multimodal) — diagnosis, autonomous investigation, and patch proposals, via a provider-independent layer (`src/provider.mjs`, selected by env vars).
- **Muse Spark Open** (`meta-models/muse-spark-open`, Meta open weights via Baseten) — independent review of committed repairs (`src/verifier.mjs`). Advisory only: it can approve, raise a concern (which triggers one bounded additional deterministic verification and a human-review flag), or reject — it can never overrule deterministic tests or modify code. Without `BASETEN_API_KEY` it is recorded as `unavailable`; nothing is ever simulated.
- **Deterministic Playwright checks** — always the final pass/fail authority. No model judges its own work.

## Install

```bash
git clone https://github.com/Samirius/autonomous-commerce-repair-agent.git
cd autonomous-commerce-repair-agent
npm install
npx playwright install chromium   # one-time browser download, if not already cached
cp .env.example .env              # fill in the keys below
npm test                          # 33 tests, no API key needed
npm run replay                    # no key? replay the recorded runs (no model calls)
```

`.env` (never committed):

```
MODEL_API_KEY=...        # Meta Model API key (Muse Wonder) — required for live runs
BASETEN_API_KEY=...      # Baseten key (Muse Spark Open reviewer) — optional but recommended
# MODEL_PROVIDER=meta  MODEL_NAME=muse-wonder-1.0  MODEL_BASE_URL=https://api.meta.ai/v1
```

Swap models/providers with env vars only (`MODEL_PROVIDER=openai-compatible`, `MODEL_BASE_URL`, `MODEL_NAME`; `MODEL_IMAGES=off` for a text-only model, recorded as `vision.included: false`) — no code changes. `MODEL_PROVIDER=hermes` routes calls through a local Hermes agent CLI (default GLM 5.3 via z.ai) so no key is stored in this repo; it is text-only and returns no response ids or token counts. The entry's evidence comes from Meta models; any run on another provider is stored and labelled separately.

## Two different modes — do not confuse them

**Guided repair** (`npm run agent`, code in `src/agent.mjs`): a deterministic checker names the failing defects on the demo storefront, and the model proposes repairs for that queue. This demonstrates the repair/verify/rollback loop; it is **not** autonomous discovery and is never cited as such (see `docs/LEAKAGE_AUDIT.md`).

**Autonomous discovery + investigation** (`npm run demo`, or `node src/discover.mjs --root <storeDir> --run-dir <outDir>`, code in `src/discover.mjs`): no defect names or expected fixes are given. A generic probe reports commerce invariants; if they fail, the model repairs from evidence. If they all pass, Wonder must actively investigate the store with typed browser tools (mixed carts, quantity changes, promotions, cart/checkout inspection) before any verdict, and a suspicion becomes repairable only after the agent confirms it deterministically. Start here for the real demonstration.

```bash
npm run demo     # pristine broken store copied fresh -> real Meta repairs -> verified outcome
npm run check    # deterministic check of the demo storefront only
npm test         # full test suite
npm run replay   # keyless: print the recorded evidence trails (no model calls)
npm run eval:fresh   # live: pre-registered fresh-store evaluation, one run per store
```

## What it has proven (evidence in `evidence/`)
- Fresh-store evaluation (2026-10-30): 3 new hidden-defect stores + 1 healthy control, authored after the harness was frozen, rules pre-registered in `eval/fresh-2026-10-30/PREREGISTRATION.md`, run once per store on **GLM 5.3** via Hermes (Meta API credits ran out on 2026-10-30, so this is not a Meta-model result): **1 of 3 hidden bugs found and repaired** (bulk-discount threshold), **2 missed** (the agent declared healthy after only small baskets: it never put all 4 products, or 3 of one item, in the cart), healthy control correctly left untouched. `evidence/fresh-2026-10-30/glm-5.3/RESULTS.md`. Lesson: the coverage checklist can be satisfied by minimal baskets; the next step is coverage derived from the catalog (every product, quantities at rule thresholds).
- Earlier outside cases written outside this repo by ChatGPT acting as external reviewer: **1/3 detected** in the first run; after the probe was widened in response to that result, **3/3 repaired and verified by the reviewer's own withheld oracles**. Because the probe changed after those cases were seen, the 3/3 is a re-test, not a blind result; the bundles are not in this repo. Internal blind set: 6/6 (same author as the probe).
- A store passing every automated check was investigated autonomously: Wonder's mixed-cart + promo exploration exposed a hidden discount defect, the agent confirmed it deterministically (expected 19080 vs observed 19910 minor units), repaired it, and re-verified both the full probe and the exact scenario.
- A healthy store was investigated to `verified-healthy` with zero code changes — suspicion alone never patches code.
- Every committed repair carries an audit trail: screenshots (SHA-256 recorded), model response ids, token usage, patches, and — in runs where the reviewer was enabled — a separate Muse Spark Open verdict. Which runs contain which records is stated precisely in `evidence/README.md`.

## Limitations (exact)
Currently an agent for **disposable JavaScript storefronts** following the fixture contract in `eval/external/README.md` (canonical catalog data, defined cart/price element conventions, money in integer minor units). It is **not a production WooCommerce integration**; no live or client store has ever been touched. Patch safety is an allowlist of files plus a blocklist of obvious execution constructs; it is not a sandbox, which is acceptable only because targets are disposable copies. Full limitation list: `docs/SUBMISSION.md`.

## Documentation
- `docs/STORYBOARD.md` — three-minute demo storyboard & narration
- `docs/PROJECT.md` — hackathon project description (Indie track)
- `docs/SUBMISSION.md` — architecture, which model did what, reliability results
- `docs/RELEASE_CHECKLIST.md` — what remains before submission (owner actions)
- `docs/LEAKAGE_AUDIT.md` — what the model is and is not shown, and why
- `docs/DECISIONS.md`, `docs/STATUS.md` — architecture decisions and project status
- `eval/external/README.md` — bring-your-own-fixture external evaluation interface
