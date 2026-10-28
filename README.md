# Autonomous Commerce Repair Agent

AI system that autonomously detects, repairs and verifies real e-commerce storefront problems:
**Observe → Diagnose → Plan → Act → Verify → Rollback or Commit → Remember.**

Built for the Meta Global AI Developer Hackathon (Oct 26–Nov 4, 2026), from scratch during the hackathon.

**Models used:** Muse Wonder (`muse-wonder-1.0`, Meta Model API, multimodal — planner/diagnosis) via a provider-independent layer (`src/provider.mjs`, env-selected). Independent verifier: Muse Spark Open (`meta-models/muse-spark-open`, open weights) via Baseten (`src/verifier.mjs`) — advisory only, live-verified; deterministic Playwright checks are always the final pass/fail authority. Set `BASETEN_API_KEY` to enable it.

## Installation

```bash
git clone <this repo> && cd autonomous-commerce-repair-agent
npm install
cp .env.example .env   # MODEL_API_KEY from the Meta Model API dashboard
npm test               # 27 tests, no API key needed for most
npm run check          # deterministic check of the demo storefront
npm run agent          # guided repair of the demo storefront (Meta model)
npm run demo           # repeatable demo: pristine broken store -> real Meta repair -> verification
node eval/run-eval.mjs # internal blind evaluation (6 unseen variants)
```

External evaluators: see `eval/external/README.md` (bring your own fixture + oracle; they stay outside this repo). Independence audit: `docs/LEAKAGE_AUDIT.md`. Realistic multi-product fixture: `fixtures/realistic-store/`.

## Mission 003 — generalization, vision, open-weight verifier

- **Blind evaluation** (`eval/`): six unseen storefront variants (cookie-bar CTA overlap, 430px fixed-width overflow at 360px, bulk discount applied twice, quantity-squared cart total, subtotal charging an extra unit, displayed price from the wrong catalog product). The agent works on a copied storefront only; the private oracle (`eval/oracles.mjs`) is never shown to it. Discovery mode (`src/discover.mjs`) gets no defect names or expected fixes — only a generic invariant probe (`scripts/probe.mjs`: interactive usability at 390/360/1280, horizontal overflow, displayed-price and cart-total consistency in integer minor units), the screenshot, and the source files. Latest blind run: **6/6 discovered, 6/6 repaired, 1 attempt each, 0 regressions, 17,758 total tokens** (`docs/eval-mission003-summary.json`; full artifacts in `eval/results/`, gitignored).
- **Real multimodal input**: model requests now include the actual Playwright screenshot as a base64 `image_url` content part alongside structured evidence (previously screenshots were artifacts only). Each run records the screenshot SHA-256 + byte size next to the model response id as proof of what was sent.
- **Open-weight verifier** (`src/verifier.mjs`): provider-independent adapter for Muse Spark Open on Baseten (`meta-models/muse-spark-open`, `https://inference.baseten.co/v1`). Role: independent review of a committed repair — never the final authority; deterministic browser tests remain decisive. **Blocked**: no `BASETEN_API_KEY` in the environment (endpoint returns 403 unauthenticated); the adapter reports `available:false` and no response is fabricated. Set `BASETEN_API_KEY` and it activates with no code changes.

Run the blind evaluation:

```bash
node eval/run-eval.mjs            # all six variants
node eval/run-eval.mjs --only=v1,v3
```

## Mission 001/002 — main demo storefront


The storefront now has two independent defects, discovered and queued by severity (critical first):

1. **cta-overlap** (critical) — promo banner obscures the Add to Cart CTA; checked at mobile 390×844 **and** desktop 1280×800.
2. **price-mismatch** (high) — the cart charges a stale legacy price instead of the canonical catalog price. Canonical prices live in `storefront/catalog.js` (integer minor units, e.g. `priceMinor: 8900`); all money comparisons are integer minor units. `catalog.js` is **read-only** for the agent, and pasting the canonical price into code is rejected — a repair must derive the total from the catalog at runtime.

The agent has **no defect→fix mappings**: for each queued defect the model inspects the evidence and file contents, selects a file from the allowlist (`styles.css`, `app.js`, `index.html`), and proposes one scoped `old`→`new` replacement with its evidence rationale. Generic validation (allowlist, exact-once match, no execution constructs, no hardcoded canonical values) gates every patch. Each repair is verified independently; previously repaired defects are rechecked for regressions; only the failed repair's file is rolled back, and the queue continues.



A minimal local storefront ships with one intentional defect: at a 390px viewport a fixed promo banner (84px, `z-index:20`) obscures the fixed Add to Cart CTA. The agent:

1. **Observe** — Playwright opens the storefront at 390×844, screenshots it, and collects geometry/hit-test evidence.
2. **Diagnose + Plan** — a Meta model evaluates the evidence + CSS and returns one narrowly scoped CSS repair as JSON.
3. **Act** — an execution tool applies the repair only if it touches `storefront/styles.css`, its `old` text occurs exactly once, and it contains no disallowed constructs.
4. **Verify** — Playwright reloads and runs deterministic checks: CTA in viewport, not obscured (`elementFromPoint`), and a real click increments the cart.
5. **Rollback or Commit** — failing verification restores the original file byte-for-byte; passing verification writes a verification record.
6. **Remember** — every run appends to `memory/runs.jsonl` and saves full artifacts under `artifacts/run-<timestamp>/` (screenshots, evidence, model decision, diff, history).

## Setup

```bash
npm install
cp .env.example .env   # set MODEL_API_KEY from the Meta Model API dashboard
```

`.env` (never committed):

```
MODEL_PROVIDER=meta
MODEL_NAME=muse-wonder-1.0
MODEL_API_KEY=...
```

Swap providers without code changes: set `MODEL_PROVIDER=openai-compatible`, `MODEL_BASE_URL`, `MODEL_NAME`, `MODEL_API_KEY`.

## Run the demo

```bash
npm run check          # deterministic check only (fails on the broken storefront)
npm run agent          # full agent loop (Meta model proposes the repair)
npm test               # unit + rollback tests (rollback uses a temp copy with the defect recreated)
```

Serve the storefront statically if you want to view it: open `storefront/index.html` in a browser at a 390px-wide viewport.

## Layout

- `storefront/` — demo store (index.html, styles.css, app.js)
- `scripts/check.mjs` — deterministic Playwright verification (no AI)
- `src/provider.mjs` — provider-independent model layer
- `src/agent.mjs` — the agent loop + repair validation/rollback
- `tests/agent.test.mjs` — validation + rollback tests
- `artifacts/` — per-run proof (screenshots, evidence, diffs, decisions)
- `docs/STATUS.md`, `docs/DECISIONS.md` — project continuity
