# 3-minute demo sequence (for recording / live judging)

> Superseded for presentation purposes by `docs/STORYBOARD.md` (Mission 012), which makes the autonomous investigation the centerpiece. This file remains the operational runbook. Note: `npm run demo` runs **autonomous discovery** (`src/discover.mjs`), not the guided defect-queue flow (`npm run agent`, `src/agent.mjs`).

Setup once: `npm install`, `npx playwright install chromium` (one-time, if not cached), `.env` with `MODEL_API_KEY` (Meta), `BASETEN_API_KEY` (Baseten, optional but recommended). Everything below runs from the repo root and needs no other preparation.

## Minute 1 — the broken store (discovery + repair)
Run: `npm run demo`
- On screen: the pristine broken fixture is copied fresh (CTA covered by the promo bar; cart charges a stale price).
- The agent shows probe failures at 3 viewports, sends Wonder screenshots + evidence, applies 2 patches (`bottom: 16px -> 100px`; legacy price -> catalog-derived), each deterministically verified.
- Point at: `before.png` vs `after.png` in the printed `artifacts/demo-*/run/` path, the two patch lines, and `verification.json`.
Say: "Wonder proposes; deterministic Playwright checks decide. A failing patch is rolled back automatically."

## Minute 2 — autonomous investigation (the differentiator)
Run: `node src/discover.mjs --root artifacts/investigation-proof/target --run-dir artifacts/investigation-proof/run2` (fresh copy of `fixtures/investigation-target` if re-running)
- This store passes **every** probe — yet Wonder's own mixed-cart + promo observation exposes a defect, asks for confirmation, and the agent confirms it deterministically (expected 19080 vs observed 19910 minor units), repairs it, and verifies probe + scenario.
Say: "No failing test told it where to look. It investigated like a commerce engineer, and suspicion alone never touches code — only a confirmed discrepancy does."

## Minute 3 — independent open-weight review + generalization
- Open any demo `verification.json`: each Wonder repair carries a Muse Spark Open review (approve/concern) with response ids and token usage; concerns trigger an extra deterministic probe and a human-review flag — the open-weight model can flag, never overrule.
- Show `docs/eval-mission003-summary.json` (internal blind set 6/6) and quote Mission 005→006 (external cases 1/3 → 3/3 oracle-verified).
Say: "Two Meta models with separate jobs — Wonder repairs, Spark Open reviews — and deterministic tests remain the final authority."

Fallback if the network fails mid-demo: replay from committed artifacts (`artifacts/demo-*/`, `artifacts/investigation-proof/run/`, investigation turns + screenshots are all on disk).
