# Project description — Indie Developer track

**Project:** Autonomous Commerce Repair Agent
**Theme:** *Build for Your World* — built for the world of independent store owners who lose revenue to silent storefront defects they cannot see and cannot afford to hire anyone to hunt down.
**Track:** Indie Developer (also aiming at Best Agentic Use-Case and Best Build on Meta Open Weights)

## What it does
An autonomous agent that detects, repairs and *verifies* real e-commerce defects: it observes a storefront with a real browser (screenshots, geometry, click/hit-tests, cart behaviour), diagnoses problems with Muse Wonder, applies one narrowly-scoped code repair at a time, proves the fix with deterministic browser tests, and rolls back automatically when a repair fails. When every test passes, it does not stop — it goes shopping itself (mixed carts, quantity changes, promo codes) to hunt for defects no test reported, confirms anything it suspects with deterministic evidence before touching code, and submits every repair to an independent Muse Spark Open review.

## Technical differentiator
Autonomous, *evidence-backed* commerce repair: the model proposes, deterministic tests decide, a second model reviews, and every step — screenshots (with hashes), model response ids, token usage, patches, receipts — is recorded and auditable. Suspicion alone never modifies code; only deterministically confirmed defects are repaired. On outside-authored cases (ChatGPT as reviewer) it went from 1/3 to 3/3 after the probe was widened in response — a re-test, not a blind result. A pre-registered fresh-store evaluation (3 hidden-defect stores + 1 healthy control, harness frozen, one run each) reports hits and misses as they happened: `evidence/fresh-2026-10-30/RESULTS.md`.

## Meta models used
- **Muse Wonder (`muse-wonder-1.0`)** — Meta Model API, multimodal: diagnosis, autonomous investigation (typed browser tools), and patch proposals. Chosen via an env-configured, provider-independent layer.
- **Muse Spark Open (`meta-models/muse-spark-open`)** — Meta open weights via Baseten: independent repair review (approve / concern / reject), with concerns triggering bounded additional verification and human-review flags. It can never overrule deterministic tests or modify code.

## Exact limitations
Currently an agent for **disposable JavaScript storefronts** that follow a documented fixture contract (canonical catalog global, defined cart/price element conventions). It is **not a production WooCommerce integration**: no live store was ever touched, no credentials for any real shop exist in the system, and discount semantics are limited to the catalog rules it can read (bulk/promo percentages). Investigation is model-driven and therefore probabilistic; reliability figures come from small, honestly-reported run counts. Next step toward production would be a WooCommerce adapter behind the same probe/repair/verify contract, with human approval gates.
