# Three-minute demo — storyboard & narration

Audience: hackathon judges. No technical background assumed. Record screen + terminal; keep the browser screenshots large.

## 0:00–0:25 — The problem (show `evidence/demo-before.png`)
**Narration:** "Online stores break silently. A button gets covered, a price goes stale — and nobody notices until sales drop. We built an agent that finds these problems, fixes them, and proves the fix — by itself."
Show: the Add to Cart button hidden under the black promo bar.

## 0:25–1:20 — Repair with proof (run `npm run demo`, or replay `artifacts/demo-*/run/`)
**Narration:** "Watch the terminal. The agent photographs the store at phone and desktop sizes, collects exact measurements, and shows them to Muse Wonder — Meta's model — along with this screenshot. Wonder proposes a repair. But the model doesn't get the final say: automated browser tests click the real button and check the real cart total. If the fix fails, it's undone automatically. Here both fixes passed — the button is back, and the cart now charges the catalog price."
Show: probe failures → the two patch lines → `evidence/demo-after.png` → `verification.json` (state: repaired).

## 1:20–2:20 — The hard part: a store that looks healthy (show `evidence/investigation-before.png`, then `artifacts/investigation-proof/run/`)
**Narration:** "This store passes every automated check. So the agent goes shopping itself: it mixes products in the cart, changes quantities, applies discount codes — and notices the discount is wrong only when several products are together. It doesn't guess: it re-runs that exact basket and proves the total is wrong — 199.10 instead of 190.80. Only then does it repair the code, and verify the same basket now totals correctly."
Show: `investigation-proof-trail.json` (observations → confirmation: expected 19080 vs observed 19910) → the one-line patch.

## 2:20–3:00 — A second Meta model checks the work (open any `verification.json`)
**Narration:** "Finally, a second Meta model — Muse Spark Open, running on open weights — independently reviews every repair. It can approve, raise a concern, and trigger extra testing or a human review. It cannot overrule the tests, and it cannot touch the code. Two Meta models, separate jobs, and automated proof neither one can fake. In blind tests set by an external reviewer, this went from finding one of three hidden problems to all three."
Show: `openWeightVerification` entries (approve/concern, response ids) and `evidence/README.md`.

**Fallback:** if the network fails during recording, replay the committed artifacts — every screenshot, model decision, patch and receipt above is on disk.
