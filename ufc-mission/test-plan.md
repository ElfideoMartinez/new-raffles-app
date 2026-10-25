# Test Plan — UFC 333 (2026-10-24) vs new-raffles-app

App under test: /Users/danielmartinez/Projects/new-raffles-app (Next.js 14 + Firebase).
Primary flow under test: bet purchase + deposit via bank transfer (SPEI-style proof upload), per PAYMENTS-RESEARCH.md — non-credit methods prioritized. No card processor is currently integrated.

## Rules
- Mock/simulated tests use test data and never real money.
- Real deposits/wagers require explicit user authorization; stop at that boundary.
- No test action for a fight after its verified actual start time (event-card.md times, adjusted for delays).

## Test cases

### P0 — Bet purchase core (mock)
- T01 Browse bet list, open a bet page (`/bet/[id]`). Expected: odds/details render, no console errors.
- T02 Add bet selection(s) to cart, correct running total (sum of totalPrice).
- T03 Mixed cart (raffle tickets + bets): total = totalRafflePrice + totalBetsPrice (checkout math).
- T04 Checkout transfer page: 16-digit payment concept generated and stable during session.

### P1 — Deposit/transfer flow (mock unless authorized)
- T05 Name/phone validation: accents stripped, letters-only name, digits-only phone.
- T06 Proof image upload: valid image accepted, upload to Firebase Storage returns URL.
- T07 Submit transfer form: order created with correct concept, items, total, paymentMethod="transfer".
- T08 Success page reflects submitted order; user purchases page lists pending order.
- T09 Empty-cart guard: navigating to checkout with empty cart behaves safely (no crash).
- T10 Large/multiple selections: totals and ticket-number sorting remain correct.

### P1 — Admin visibility (mock)
- T11 Admin sales/salesBets shows the new pending transfer order.
- T12 Admin can mark order paid; buyer sees confirmed status.

### P2 — Resilience/edge
- T13 Invalid proof file types rejected gracefully.
- T14 Duplicate submission does not create duplicate orders (idempotency note).
- T15 Bet page behavior after a fight's start time (if app supports closing bets).

### Blocked-by-authorization (do NOT run without explicit user approval)
- R01 Real SPEI transfer to the operator account with real MXN.
- R02 Real wager on a UFC 333 fight.

## Acceptance criteria
- All P0/P1 pass or have documented defects with reproducible steps + evidence (screenshots in screenshots/, logs in action-log.jsonl).
- Every numeric total reconciles with recorded orders.
- Real vs mock clearly labeled in final-report.md.