# Three-minute demo — storyboard & narration

Audience: hackathon judges. No technical background assumed. Record screen + terminal; keep browser screenshots large.

**The centerpiece is segment 2** — a hidden defect in a store that looks completely healthy. Keep segment 1 short; it is the supporting act.

## 0:00–0:30 — Hook + the easy win, briefly (show `evidence/demo-before.png`, then `evidence/demo-after.png`)
**Narration:** "Online stores break silently — a button gets covered, a price goes stale — and nobody notices until sales drop. Our agent repairs the obvious breaks too: here it found the covered Buy button and the wrong cart price, fixed both, and proved the fix with real browser tests. But obvious breaks are the easy part."
Show: covered button → after screenshot → one line: both repairs verified.

## 0:30–2:15 — CENTERPIECE: the healthy-looking store with a hidden defect
Show `evidence/investigation-before.png` (store looks normal), then replay `artifacts/investigation-proof/run/` (`investigation-proof-trail.json`, screenshots).
**Narration:** "This store passes *every* automated check we have. So the agent goes shopping by itself. It mixes products in the cart, changes quantities, tries the discount code — and notices something: with several products together, the discount is calculated on just the first item. It doesn't guess and it doesn't patch on a hunch. It re-runs that exact basket and proves the total is wrong: 199.10 where the catalog says 190.80. Only with that proof does Muse Wonder repair the code — one line — and then the agent re-tests everything, including that exact basket. Correct."
Show: observations → confirmation (expected 19080 vs observed 19910) → the one-line patch → final verified outcome.

## 2:15–3:00 — A second Meta model checks the work + why it generalizes
Show a demo-run `verification.json` (e.g. under `artifacts/demo-*/run/`; those runs carry `openWeightVerification` receipts).
**Narration:** "In our demo runs, every repair Muse Wonder makes is independently reviewed by a second Meta model — Muse Spark Open, running on open weights. It can approve, or raise a concern, which triggers extra testing and flags a human to look. It cannot overrule the automated tests, and it can't touch the code. Two Meta models, separate jobs, proof neither can fake. And we tested it honestly: three brand-new stores with hidden bugs, written after the agent was frozen, one run each. Here is what it found — and what it missed."
Show: open-weight verdict entries (approve/concern, response ids) → the table in `evidence/fresh-2026-10-30/glm-5.3/RESULTS.md` (read the misses out loud too).

**Accuracy note for the presenter:** the centerpiece investigation run (Mission 008) was recorded before the open-weight review was wired into that path, so its receipts contain no Spark Open verdict; the same repair was reviewed separately (`evidence/openweight-verifier-live-check.json`), and the demo runs in segment 3 do carry in-process reviews. Do not claim otherwise.

**Fallback:** if the network fails during recording, replay the committed artifacts — every screenshot, model decision, patch and receipt above is on disk.
