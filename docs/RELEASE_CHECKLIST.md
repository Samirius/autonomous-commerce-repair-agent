# Release checklist — before submitting to the Meta Global AI Developer Hackathon

Deadline: **Wed 2026-11-04 21:00 EST = Thu 2026-11-05 04:00 Cairo.** Target: submit by Tue 2026-11-03.
Everything below marked *owner* needs Samir; nothing here may be automated without his explicit approval.

## Verified by engineering (2026-10-30, branch `audit-fixes-2026-10-30`)
- [x] Fresh clone → `npm ci` → `npx playwright install chromium` → `npm test` **31/31 pass** (no key needed)
- [x] Full-history secret scan (`git log -p --all`, key/token patterns): no credentials found
- [x] `LICENSE` (MIT) added
- [x] `npm run replay` works without a key; `npm run demo` without a key exits cleanly with that hint
- [x] Fresh-store fixtures validated offline (`node eval/fresh-2026-10-30/validate-fixtures.mjs`: 4/4 VALID); runner dry-run tested against a local stub model (results discarded)
- [ ] Live `npm run demo` re-run after the fixes — not done (no key available to engineering)

## Required environment variables (documented in `.env.example`, never committed)
| Variable | Required for | Source |
|---|---|---|
| `MODEL_API_KEY` | Muse Wonder planner/investigator (Meta Model API) | Meta Model API dashboard |
| `MODEL_PROVIDER` / `MODEL_NAME` / `MODEL_BASE_URL` / `MODEL_TIMEOUT_MS` | Optional (defaults: meta / muse-wonder-1.0 / api.meta.ai / 120000) | — |
| `BASETEN_API_KEY` | Muse Spark Open reviewer — without it reviews are recorded as `unavailable` | Baseten dashboard. **The previously exposed key has NOT been rotated yet** |

## Remaining actions, in order
1. [ ] *owner* Rotate the exposed Baseten key; put the new one in local `.env` only
2. [ ] *owner* Review and merge `audit-fixes-2026-10-30` into `main`
3. [ ] *owner* `.env` with `MODEL_API_KEY` (+ `BASETEN_API_KEY`); run `npm run demo` once (sanity) and `npm run eval:fresh` **once**; commit `evidence/fresh-2026-10-30/` exactly as produced
4. [ ] *owner* Decide on the historical local path (commit `e661e16`): accept, or rewrite history before public release
5. [ ] *owner* Approve making the repository **public**; then check repo, `evidence/` and README render while logged out
6. [ ] *owner* Record the three-minute video following `docs/STORYBOARD.md` — include the fresh-store table, misses included
7. [ ] *owner* Submission form: Indie Developer track, theme *Build for Your World*, description from `docs/PROJECT.md`, repo + video links
8. [ ] *owner* Final logged-out check of every link, then submit

## Blockers
- None technical. Items 1, 3 (live runs) and 5–8 need Samir.
