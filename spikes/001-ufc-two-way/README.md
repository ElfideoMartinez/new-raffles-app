# UFC two-way winner — local rules draft

**Scope:** product exploration only. Nothing here changes current app behavior, payment processing, or the rules of existing tickets. Open `comparison.html` locally for the demo; `three-rule-baseline.html` preserves the original comparison.

## Platform preview

The app-native route is `app/ufc-preview/page.tsx`, backed by `app/components/UfcTicketBuilder.tsx`. The deployable static build uses just these components, the app theme and formatter, and a fixture storefront. It deliberately excludes production auth, payment, cart persistence, and settlement services.

Run `bash spikes/001-ufc-two-way/build-platform-preview.sh` from the repository after installing dependencies. Serve the generated `out/` and point `PREVIEW_ORIGIN` at it to run `node --test spikes/001-ufc-two-way/platform.test.cjs`. The same test runs against the deployed preview URL.

## Saved options

1. **Three-way winner (existing model):** A, B, or Draw. A draw pays the Draw selection. An unbacked winning selection or void result refunds all verified stakes, without fees.
2. **Two-way winner (proposed default):** A or B only. Settle on the official winner; an official technical decision counts as a decision. An official draw (including a technical draw), no contest, cancellation, or fighter replacement refunds the affected market in full, without fees. A disqualification with an official winner still settles the winner pool.
3. **Winner + method (proposed optional extra):** The base ticket stays unchanged. Optionally buy a *second* ticket in a separate pool: A/B × KO/TKO, submission, or decision. Both picks must match the official result. A wrong method does not cancel a winning base ticket. Technical decisions count as decisions; technical submissions count as submissions. A draw, no contest, cancellation, fighter replacement, or disqualification refunds the method pool. An unbacked winning selection refunds only its own pool. Start with one eligible fight in a pilot; defer if there is not enough interest to support six outcomes.

### Why not a multiplier or a true parlay?

For this experiment the customer pays two visible stakes and the gross returns **add**, not multiply. Winner and method on the same fight are related; do not multiply the two pool estimates or promise fixed odds. A true combo-only ticket would require both picks and would pay nothing when the winner is right but the method is wrong. A free bonus would need a separately funded, capped budget. Neither is part of this proposal.

## Draw and refund flow

1. **Before purchase:** show `Si hay empate oficial, se devuelve el importe de cada boleto, sin comisión.` Show separate items and full total before confirmation. Do not preselect the extra.
2. **At cutoff:** lock sales and apply the documented cutoff for payment verification; show `Pendiente de resultado oficial` until the official result is confirmed. Draft policy: reconcile in-flight payments before settling; no silent forfeiture or post-result entry.
3. **Admin preview:** record `Empate oficial` (distinct from `Sin resultado`), official source, and optionally the technical-draw subtype. Show verified tickets, full refund amounts by market and purchase, and zero fees. Confirm the settlement once; retries must not duplicate refund obligations or transfers.
4. **Customer purchase history:** show `Empate oficial · Reembolso pendiente` with the base and extra item amounts, then `Reembolsado` only after the original payment rail (or documented manual transfer) has confirmed the refund. A failed transfer remains unpaid and available for ops review. Sample: base-only $50 MXN back; base $50 + optional extra $20 = $70 back. No profit or fee. Notify after recording the obligation; do not imply money has moved until it has.

## Money rules and pre-build checks

- Pools and fees are independent. Demo fee is 10% on settled pools, using integer-centavo arithmetic and flooring per ticket to the centavo. The feel test uses illustrative pools, not live odds. A fee on all stakes can make a heavily backed winning ticket return less than its stake; decide explicitly whether to retain that rule or charge only against losing-side stakes before a real pilot. Define how rounding remainders are recorded.
- Lock the fee and rules version per market before taking entries; include the buyer's proposed stake on both sides of the estimate calculation (total pool and selected outcome). Distinguish the financial obligation, actual transfer, and receipt. Use per-market settlement records for orders with multiple tickets; do not rely on a single sale-level payout status.
- Existing implementation to reuse, not assume complete: `functions/src/index.ts` (`settleBet`) grades A/B/C/VOID and records payout fields; `app/admin/settlement/SettlementReview.tsx` has a refund preview; `app/user/my-purchases/page.tsx` already displays a refund outcome. Those records alone do not prove a refund was transferred. Preserve legacy three-way behavior; do not route old Draw tickets through new terms.
- Before a funded rollout, review applicable requirements, approve payment/refund operations, and add settlement, idempotency, audit, and end-to-end tests. Acceptance cases: winner with matching method, winner with wrong method, wrong fighter, draw/technical draw, no contest, DQ, missing winning selection in just one market, transfer failure, duplicate confirmation, cutoff boundary, and mixed-market orders.

**Verdict:** Pilot the base first. The optional exact-method ticket is compatible because it does not change the base pool or the draw rule. Refund execution and method-pool participation remain unverified by this local simulation.
