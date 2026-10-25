# Event close-out — 2026-10-24 (UFC 333)

Written at the end of event day by the coordinator. Read this first in the
completion-verification run, and read `backlog.md` alongside it.

## Status

- **Event over** (retired at 15:15 CST by Daniel, main card completed).
- Mission state before this file: `MID_EVENT_MONITORING`. Set to
  `AWAITING_COMPLETION_VERIFICATION` by the same update.
- **Completion verification is scheduled for 17:15 CST** (event end + ~2 h), per
  Daniel's instruction at 15:15 CST: "read them at the UFC mission — completion
  verification in 2 hrs".
- All real-money tests R01/R02 remained unauthorized throughout. No real money
  moved. Test account `ufc-test-1792801216865@example.com` (uid
  `XjFG5wIoBTYBxHUXysxTOYVuNOu1`) still has `admin: true` and **must be deleted or
  de-privileged** as part of close-out.

## What was actually tested with the event

Bets existed and received real (test-account) transfer sales. Live RTDB state at
14:37 CST, bet `bet_1792863545086_02i5rr` (Volkanovski vs. Evloev):

```
betsTeamA: 27   betsTeamB: 3   tieBets: 20   totalBets: 50   pricePerTicket: 50
```

Other bets (`gt8167`, `ar7m64`, `jwll8b`, `qbxs4h`) held 0 or 6 tickets. Sales
moved on admin confirm, which is the core money path — that part is verified
working end-to-end on test data.

## Verified working (with evidence)

- **Transfer sale → admin confirm → counters move.** Confirmed against live RTDB
  after Daniel approved two payments; counters incremented and `totalBets`
  reconciled.
- **Admin auth.** `fideomartinez52@gmail.com` (uid
  `eQg3NpHRtwX7CPYnp21IXQRbcYV2`) granted `admin: true`, verified via
  `setCustomUserClaims` readback.
- **CORS on all 16 admin functions.** Preflight → `204` with
  `Authorization, Content-Type, Accept`; unauthenticated GET → `401` with CORS
  headers present. Verified by curl on `getSalesBets`, `confirmRejectBetSale`,
  `confirmSale`, `rejectSale`, `markTicketsAsSold`, `createBet`, `settleBet`.
- **Public API.** `getAllBets` returns 5 bets, `HTTP 200`; `getBetData` returns
  `HTTP 200` with valid payload.
- **Builds.** `tsc --noEmit` clean and `next build` succeeded before every deploy.

## Fixed during the event (all deployed and live)

See `backlog.md` § "Done during the 2026-10-24 UFC test" for the full list. The
four that caused visible user-facing failures:

1. Admin pages showed opaque CORS errors instead of 401/403 (headers set after the
   auth check).
2. `/admin/salesBets` and `/admin/sales` white-screened on any non-2xx.
3. `totalBets` missing/drifting (never written by `createBet`).
4. `/admin/edit/bet` stuck loading forever (no `setIsLoadingBet(false)` anywhere
   in the file) plus a render crash on non-tuple `teams`.

## NOT verified — do not claim these as working

- **Winner display is unproven.** The banner on `/bet` and `/bet/[id]` reads
  `settled` / `result` / `payoutPerTicket`, which only exist after `settleBet`
  runs. **No bet has been settled**, so this has never rendered real data. Verify
  by settling one test bet before believing it.
- **`settleBet` was never executed.** It deployed for the first time during this
  event (log said "Successful create operation"). Its payout maths
  (`pool × (1 − takeRate) / winningTickets`) is reviewed but untested live.
- **Batch winner messaging does not exist** (backlog item 15).
- **Instagram content was never posted.** Route was manual pack; the account does
  not exist yet. The creative-director subagent failed on an OpenRouter billing
  403 and the pack was hand-built.
- **Bet cutoff is not implemented.** A bet stays purchasable after its fight
  starts (finding T15). Not fixed.

## Open risks carried into close-out

1. `sendPurchaseNotifications` is a public unauthenticated push endpoint
   (backlog item 3). Must be gated before any real launch.
2. `oddsTie: data.oddsTie || undefined` (item 1) may throw on a bet created with
   tie odds.
3. Admin odds inputs are cosmetic placeholders (item 2) — `1.0` everywhere.
4. `/admin/sales` vs `/admin/salesBets` duplication (item 4) — every fix costs
   twice and has already caused a half-deployed fix once.

## Scheduled follow-up

- **17:15 CST — completion verification.** Read this file and `backlog.md`, then:
  1. Confirm the event is officially complete and record final results.
  2. Decide whether to settle the test bets (this is what proves the winner UI).
  3. Delete or de-privilege the test admin account.
  4. Produce the final report and set state `VERIFIED_COMPLETE`, or state exactly
     what blocked it.

## Housekeeping note

`ufc-mission/` and `content-pack/` are untracked in git. Nothing from this session
has been committed — Daniel has never asked for a push, and that boundary stands.
