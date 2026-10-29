# Fresh-store evaluation — results for glm-5.3 (one live run per store)

> **Not the entry's result.** This run used `hermes/zai/glm-5.3`, not Meta's Muse Wonder. It only shows the harness running on another provider.

Harness commit `990f684294f34fd466f18103acb3e41d0f8b7c77`; model `glm-5.3`; run 2026-10-29T23:52:20.231Z.
Rules fixed in advance: `eval/fresh-2026-10-30/PREREGISTRATION.md`. Nothing below was re-run or edited.

| Store | Has bug | Outcome | Agent state | Observations | Oracle before → after | Files changed | Tokens |
|---|---|---|---|---|---|---|---|
| store-a | yes | **FOUND+REPAIRED** | confirmed-issue-repaired | 2 | false → true | app.js | 0 |
| store-b | yes | **MISSED (false healthy)** | verified-healthy | 2 | false → false | none | 0 |
| store-c | yes | **MISSED (false healthy)** | verified-healthy | 2 | false → false | none | 0 |
| store-d | no (control) | **CORRECT-HEALTHY** | verified-healthy | 2 | true → true | none | 0 |

- **store-a** verdict: Bulk discount (minQty 4, 10% off) appears not to be applied independently of the promo code. In turn 1 the cart had 4 items (2×house-blend, 1×single-origin, 1×cold-brew-kit, subtotal $90.00), which meets the bulkDiscount minQty of 4, yet the only discount shown was $9.00 attributed to BREW10 (total  — confirmation expected 8100, observed 9000
- **store-b** verdict: All required commerce workflows actively verified against the catalog. (1) Mixed cart: 2x Arc Desk Lamp ($118.00) + 1x Felt Wrist Rest ($24.00) = subtotal 14200 minor, matching catalog 2*5900+2400. (2) Promo DESK15 on the mixed cart: discount 2130 minor = exactly 15% of 14200, total 12070 minor, pro
- **store-c** verdict: Mixed-cart scenario (2 wool-socks + 1 rain-shell + 1 field-cap) subtotal 18100 minor matches catalog (2*1800+11900+2600); TRAIL10 applied to the MIXED cart discounts 1810 (10%) for a total of 16290, exactly the catalog rule. Quantity change on field-cap went 4400 -> 7000 minor (1800+2600 -> 1800+2*2
- **store-d** verdict: Mixed-product cart (2×desk-lamp + monitor-arm + cable-tray, qty 4) produced subtotal 22600 minor matching catalog rules; DESK15 applied 15% discount of 3390 for a correct 19210 total; independent quantity-change scenario (+1 desk-lamp) raised count 2→3 and total 8300→14200, exactly +5900; all displa

Full bundles (gitignored): `eval/results/fresh-2026-10-29T23-44-17-309Z`. Replay: `npm run replay -- evidence/fresh-2026-10-30/glm-5.3/store-a-verification.json`.
