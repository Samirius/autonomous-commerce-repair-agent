# Curated public evidence (sanitized)

Selected run records, safe for a public repository: no credentials, no local paths, no client data. Full bundles remain in `artifacts/` (partly gitignored); these are the judge-facing highlights. Model response ids and token usage are intentionally retained — they are the proof the calls were real.

| File | What it proves |
|---|---|
| `demo-verification.json` | Guided/demo run: 2 Wonder repairs committed, each with a Muse Spark Open review (separate deterministic/open-weight statuses), response ids, tokens |
| `demo-before.png` / `demo-after.png` | The demo store before (CTA covered by the promo bar) and after repair. These screenshots are also sent to Wonder as image input; their SHA-256 is recorded in the run decisions |
| `investigation-proof-verification.json` | The autonomous-investigation proof: probe passed, Wonder's observations exposed a hidden promo defect, deterministic confirmation (expected 19080 vs observed 19910 minor units), repair committed and double-verified |
| `investigation-proof-trail.json` | The investigation state trail: observations, coverage, confirmation spec/outcome |
| `investigation-before.png` | The investigation target — a store that looks and probes healthy |
| `healthy-investigation-verification.json` | A healthy store investigated to `verified-healthy` with zero code changes (suspicion never patches) |
| `openweight-verifier-live-check.json` | Standalone live Muse Spark Open review (`meta-models/muse-spark-open` via Baseten) |
| `blind-eval-mission003-summary.json` | Internal blind evaluation: 6/6 unseen variants repaired (Mission 005→006 external results, 1/3 → 3/3 oracle-verified, are described in `docs/STATUS.md`; the external bundles are held by the evaluator) |
