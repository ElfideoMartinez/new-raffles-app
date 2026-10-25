# Blockers

- 2026-10-23 21:10 CST — **Tonight's functions deploy: DONE and verified.** Deployed selectively (`firebase deploy --only functions:getSalesBets,functions:createTransferSale --project raffleapp-dbc1b`) because a full deploy would have DELETED three live functions that are not in this checkout's source (`createCheckoutSession`, `stripeWebHook`, `ssrraffleappdbc1b`). Verified live: `createTransferSale` now returns 400 with Spanish validation message (was 404); `getSalesBets` without Authorization now returns 401 "Sign in as an administrator" on both cloudfunctions.net and run.app URLs (was 200 leaking 14 betSales records). No code changes were needed in source — the auth check already existed; it was just undeployed. Still needs Daniel: Realtime DB re-enable (blocker 3) — see `ufc-mission/needs-daniel-console.md`. Note: `getSalesBets` 200-with-admin-token path (regression check) could not be tested without an admin login — listed in the guide.

- 2026-10-23 18:07 CST — Real-money tests R01 (real SPEI deposit) and R02 (real wager): **NOT authorized** by Daniel ("no real money for now"). All testing stays mock/simulated. Authorization may be granted later on explicit user request.

## Plan vs live API (checked 2026-10-23 18:32 CST)

Blocking findings for running the plan as written against production:

1. ~~**`createTransferSale` is not deployed.**~~ **RESOLVED 2026-10-23 ~21:00 CST** — deployed and verified (400 on empty POST, not 404). `checkTransfer` requires an admin ID token (403 without).
2. **No buyer signup path in the app.** Only `/admin` has Firebase Auth (signIn + an unused createUser import). Buyers are anonymous with name/phone/email; `createTransferSale` treats a Bearer token as *optional* identity.
3. ~~**Realtime DB is deactivated** (`raffleapp-dbc1b-default-rtdb` → "has been deactivated")~~ **RESOLVED 2026-10-24 09:28 CST** — Daniel re-enabled the RTDB in the Firebase console. Verified live: `getAllBets` returns 200 with bet records. The frontend `/bet` route still returns 404 on the deployed site (web.app) — production frontend does not include/redeploy the bets section yet; backend data source is ready.
4. ~~**Security:** `getSalesBets` (admin-named) answers GET **without** Authorization → 200 with 14 `betSales` records including name/phone/email.~~ **RESOLVED 2026-10-23 ~21:00 CST** — deployed the auth-check version; unauthenticated GET now returns 401 (verified by curl on both URL forms). Admin-login regression check still pending with Daniel (see needs-daniel-console.md §3.1).

Test account: created via Firebase Auth REST API — `ufc-test-1792801216865@example.com`, uid `XjFG5wIoBTYBxHUXysxTOYVuNOu1`. Password intentionally not written to this workspace; stored only in my session. No orders, no money, no uploads were created with it. Delete the account when the event test ends.
