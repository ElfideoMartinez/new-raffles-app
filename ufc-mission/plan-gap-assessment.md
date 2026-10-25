# Plan gap assessment — account + "test in pair with the event test"

Date: 2026-10-23 18:35 CST. App: /Users/danielmartinez/Projects/new-raffles-app (raffleapp-dbc1b).

## Question
Can we create a new account via the API and run a test paired with the UFC 333 event test?

## Answers
| Item | Result |
|---|---|
| Create account via API | **Yes** — Firebase Auth REST `accounts:signUp` works for the web API key. Created `ufc-test-1792801216865@example.com`. |
| Buyer "creates account" in the product | **No such feature** — no signup UI/route for customers. Account ≠ buyer identity for this app. |
| Orders need an account | **No** — `createTransferSale` accepts anonymous buyers; token only links the sale to a uid. |
| Run T01–T14 via API today | **No** — `createTransferSale` 404 (undeployed); bets unreadable (RTDB deactivated → 504). Raffle reads OK (2 raffles). |
| Pair a test with the event | **Yes, with a pairing map** (below) — but it must be mock/local for bet coverage until the two blockers clear. |

## Pairing map: test cases → UFC 333 timeline (2026-10-24, CST)
Times from event-card.md. Account-level tests are time-independent; event-paired ones use real fight state.

| Window (CST) | Event state | Paired tests |
|---|---|---|
| 07:30 readiness (scheduled J1) | pre-event | T01 raffle list, T02 cart math, T04 concept stability, T05 validation, T09 empty cart, T13 invalid file |
| 08:00 early prelims | fights live | T06 proof upload (small fake receipt), T14 duplicate submit (idempotency `transfer_<concept>`) |
| 10:00 prelims | mid-card | T07/T08 transfer submit → success + pending purchases (needs `createTransferSale` deployed) |
| 12:00 main card | main card live | T11 admin sees pending transfer sale; a 6+ ticket cart to exercise the "needs verification" branch |
| 12:30 mid-event job | monitoring | T15 post-start behavior: try a bet page after its fight has started — expect closed/refusal |
| 15:30 completion job | event done | T12 mark paid → buyer sees confirmed (admin token needed); reconcile every total |
| Never | — | R01/R02 real money — still unauthorized |

## Bet-half dependency
T03 mixed cart and T10 ticket-number sorting need bets to load. Options:
1. Deploy the current functions source (fixes `createTransferSale`; does not fix RTDB being deactivated).
2. Re-enable RTDB or migrate bets to Firestore.
3. Run the bet cases against `mock/server.mjs` (already wired in playwright.config.ts) and label them mock in final-report.md.

## Account usage rule
Use the test account only as an optional identity on transfer sales (Authorization header) so admin-side filtering/reconciliation is attributable. Do not reuse it for any raffle/bet creation.
