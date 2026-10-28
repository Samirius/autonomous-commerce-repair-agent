# Release checklist — before submitting to the Meta Global AI Developer Hackathon

Engineering is done. Everything below is an owner action; nothing here may be automated without Samir's explicit approval.

## Verified by engineering (2026-10-28)
- [x] Private repo pushed: `Samirius/autonomous-commerce-repair-agent` @ `e7dff21` (remote HEAD == local HEAD, visibility PRIVATE)
- [x] Clean-clone test: fresh clone → `npm install` → `npm test` **29/29 pass** → `npm run demo` completed with real Meta calls (2 repairs, verified) using only documented env vars
- [x] Tracked-file secret/sensitive scan clean; old exposed Baseten key not present anywhere in the repo
- [x] Curated public evidence in `evidence/` (sanitized, indexed)
- [x] Demo storyboard + narration: `docs/STORYBOARD.md`; project description: `docs/PROJECT.md`

## Required environment variables (documented in `.env.example`, never committed)
| Variable | Required for | Source |
|---|---|---|
| `MODEL_API_KEY` | Muse Wonder planner/investigator (Meta Model API) | Meta Model API dashboard |
| `MODEL_PROVIDER` / `MODEL_NAME` / `MODEL_BASE_URL` | Optional provider/model selection (defaults: meta / muse-wonder-1.0) | — |
| `BASETEN_API_KEY` | Muse Spark Open reviewer — without it the agent still works and records the review as `unavailable` | Baseten dashboard (rotate the previously exposed key) |

## Remaining owner actions before submission
1. [ ] Rotate the exposed Baseten API key (dashboard), put the replacement in local `.env` only
2. [ ] Approve making the GitHub repository **public** (currently private; submission links must be accessible without authentication)
3. [ ] After going public, verify the repo URL and `evidence/` render correctly while logged out
4. [ ] Record the three-minute video following `docs/STORYBOARD.md` (upload to the platform the submission form requires; keep the link unlisted/public as the form specifies)
5. [ ] Complete the hackathon submission form: Indie Developer track, theme *Build for Your World*, project description from `docs/PROJECT.md`, repo + video links
6. [ ] Final logged-out check: repo link, video link, and any demo links all open without authentication
7. [ ] Submit before the November 4, 2026 deadline

## Blockers
- None technical. Submission readiness depends only on the owner actions above (public-release approval, video, form).
