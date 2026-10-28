# Autonomous Commerce Repair Agent

AI system that autonomously detects, repairs and verifies real e-commerce storefront problems:
**Observe → Diagnose → Plan → Act → Verify → Rollback or Commit → Remember.**

Built for the Meta Global AI Developer Hackathon (Oct 26–Nov 4, 2026). Core intelligence is Meta-powered (Meta Model API — Muse Wonder / Muse Spark); the model layer is provider-independent.

## Mission 001 — vertical slice

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
