# AGENTS.md — operating instructions for any coding agent on this repo

- Product owner: Samir. This repo is the Meta Global AI Developer Hackathon entry (Oct 26–Nov 4, 2026), fresh code only — never copy pre-hackathon implementation code in.
- Core AI must stay visibly Meta-powered (Meta Model API). Keep the model behind `src/provider.mjs`; never hardcode a provider/model into the agent loop.
- Never commit secrets. Keys live in `.env` (gitignored) or the shell environment. Never print a key.
- Never touch a production/client store, deploy publicly, or send external messages without Samir's approval.
- The deterministic check (`scripts/check.mjs`) is the source of truth for pass/fail. Never claim a test passed without running it; never fabricate a model call — record real model id/usage in the run artifacts.
- Repairs are narrowly scoped by design: only `storefront/styles.css`, exact-once `old` substring, validated in `validateRepair`. Do not widen the allowlist silently — log such a change in `docs/DECISIONS.md`.
- Every agent run must leave artifacts in `artifacts/run-<timestamp>/` and append to `memory/runs.jsonl`.
- Workflow: write/adjust the failing check first, watch it fail, then make the minimal change, then re-run `npm test` + `npm run check`.
- Keep `docs/STATUS.md` current at the end of any work session.
