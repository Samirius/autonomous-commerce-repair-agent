# Curated public evidence (sanitized)

Selected run records, safe for a public repository: no credentials, no local paths, no client data. Full bundles remain in `artifacts/` (partly gitignored); these are the judge-facing highlights. Model response ids and token usage are intentionally retained — they are the proof the calls were real.

| File | What it proves |
|---|---|
| `demo-verification.json` | A demo run (`npm run demo`, discovery mode): 2 Wonder repairs committed, **each carrying an in-process Muse Spark Open review** (separate deterministic/open-weight statuses), response ids, tokens |
| `demo-before.png` / `demo-after.png` | The demo store before (CTA covered by the promo bar) and after repair. These screenshots are also sent to Wonder as image input; their SHA-256 is recorded in the run decisions |
| `investigation-proof-verification.json` | The autonomous-investigation proof: probe passed, Wonder's observations exposed a hidden promo defect, deterministic confirmation (expected 19080 vs observed 19910 minor units), repair committed and double-verified. **This run predates the open-weight review wiring — its receipts contain no Spark Open verdict** (see `openweight-verifier-live-check.json` for the separate review of that same repair) |
| `investigation-proof-trail.json` | The investigation state trail: observations, coverage, confirmation spec/outcome |
| `investigation-before.png` | The investigation target — a store that looks and probes healthy |
| `healthy-investigation-verification.json` | A healthy store investigated to `verified-healthy` with zero code changes (suspicion never patches) |
| `openweight-verifier-live-check.json` | Standalone live Muse Spark Open review of the investigation-proof repair (`meta-models/muse-spark-open` via Baseten) — recorded separately from that run, not inside it |
| `blind-eval-mission003-summary.json` | Internal blind evaluation: 6/6 unseen variants repaired (Mission 005→006 outside-authored results, 1/3 then 3/3 after a probe change — a re-test, not blind — are described in `docs/STATUS.md`; those bundles are not in this repo) |
| `fresh-2026-10-30/` | Pre-registered fresh-store evaluation: 3 hidden-defect stores + 1 healthy control, one live run each, `RESULTS.md` as produced (appears after `npm run eval:fresh`) |
