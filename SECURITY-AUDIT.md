# Security & consistency audit — new-raffles-app

**Date:** 2026-10-22
**Branch audited:** `design/ratified-decisions` (tree clean at audit time)
**Mode:** READ-ONLY. Nothing was fixed, rotated, deployed, or committed. The only
file created is this one, and it is left **untracked**.
**Scope:** `functions/src/index.ts`, `app/**` (including `app/api/**`),
`firestore.rules`, `storage.rules`, `firebase.json`, `.env*` **key names only**,
git history for secret material. `DESIGN-AUDIT.md` was cross-checked only where
it touches security-adjacent claims.

**Surface anchor:** 24 exported Cloud Functions in one 2003-line file
(`functions/src/index.ts`), 4 Next.js route handlers under `app/api/`, 15 of the
24 functions behind the `rejectUnlessAdmin` guard, 9 public by design or in fact.
A Next route handler is counted separately from a Cloud Function throughout.

---

## 1. Environment gotchas (read this before running anything)

1. **Only `.env.example` is tracked.** `git ls-files | grep -E '^\.env'` returns
   exactly `.env.example`. `.env.local` and `.env.production` exist on disk but
   were untracked in commit `48b968f`. Anyone cloning needs their own copies.
2. **`.env.local` is missing keys the code reads.** It has
   `NEXT_PUBLIC_FIREBASE_FUNCTIONS_BASE_URL` and `NEXT_PUBLIC_BASE_URL` but **no**
   `NEXT_PUBLIC_API_BASE_URL` and **no** `STRIPE_SECRET_KEY`. Consequence:
   `app/api/checkout/create/card/route.ts:46-51` throws immediately in local dev.
3. **`.env.production` has no `STRIPE_SECRET_KEY` either.** It holds only
   `NEXT_PUBLIC_*` values. That is config-only, not a leak — `NEXT_PUBLIC_*` is
   public by design.
4. **`NEXT_PUBLIC_QUICK_TICKET_BASE_URL` is declared in code but appears in no
   env file.** `app/config/api.ts:36-37` therefore always uses the baked-in
   `createquickticket-*.run.app` URL.
5. **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is empty in all three env files.**
   Whatever supplies it in production was not observable from the checkout
   (see §5).
6. **Env vars are decorative in practice.** `app/config/api.ts:24-33` falls back
   to hardcoded production hosts, so a missing variable still "works". Do not
   read "app boots" as "env is configured".
7. **`firestore.rules:5` and `storage.rules:5` both say "NOT DEPLOYED, NOT
   EMULATOR-TESTED".** Treat them as a proposal, not as protection.
8. **No Realtime Database rules file exists in the repo.** `firebase.json:1-51`
   has no `"database"` section, yet the app uses RTDB for `quickTickets` and
   `bets`.
9. **Functions build is `npm --prefix functions run build`** (`firebase.json:40-42`);
   the deployed functions come from `functions/lib`, not directly from `src`.
10. **Emulator/runtime proof was not attempted** — see §5. Do not assume a claim
    marked unverified has been run.

---

## 2. Findings, severity-ordered

### CRITICAL

#### S1 — Live Stripe secret key is in git history (rotation required)
Real `sk_live_<redacted>` and `sk_test_<redacted>` credentials were committed in
`functions/src/index.ts` and `app/api/checkout/create/card/route.ts`; the webhook
signing secret `whsec_<redacted>` was also in source. The working tree is clean
today, but history is not.

- Evidence: `grep -rnE "sk_live|sk_test|whsec_"` over `app` + `functions/src`
  returns **0** in the working tree. The same pattern over
  `git rev-list --all -- functions/src/index.ts app/api/checkout/create/card/route.ts`
  matches **162** historical blobs, including `"sk_live_<redacted>"`,
  `"sk_test_<redacted>"` and `const endpointSecret = "whsec_<redacted>";`.
  The sweep was proven against these known-present tokens before trusting its 0.
- Cross-check: `SECURITY-ROTATION.md:3-9` states the same and is accurate.
- **Rotation is the fix; history rewriting is secondary.** Current code correctly
  uses `defineSecret` (`functions/src/index.ts:23-24`, `:699-700`, `:1272-1274`).

### HIGH

#### S2 — Unauthenticated write surface: `app/api/checkout/success/route.ts`
`POST /api/checkout/success` accepts `{raffleId, ticketNumbers}` and marks tickets
`sold: true` through the **client** Firestore SDK. No auth, no token, no
ownership check, no validation that the caller paid.

- `app/api/checkout/success/route.ts:13-26` (handler; `:22` calls the writer)
- `app/api/checkout/success/route.ts:28-53` (writer; `:40` `updateDoc(... {sold:true})`)
- Written through `db` from `@/app/firebaseconfig` — this is not a server boundary.
  It writes as the anonymous/signed-in browser caller under whatever rules are
  actually live. Anyone who knows a `raffleId` can zero out inventory.
- `:15` checks `request.method !== "POST"` *after* `request.json()` at `:14`, so
  the check is dead code in a POST handler.

#### S3 — Unauthenticated write surface: `app/api/checkout/create/transfer/route.ts` — **FIXED IN CODE, PENDING DEPLOY**
`POST /api/checkout/create/transfer` writes the **entire request body** into the
`sales` collection via `addDoc`.

- `app/api/checkout/create/transfer/route.ts:7-19` (`:19` `await addDoc(salesCollection, data)`)
- No auth, no schema, no price recomputation. The caller controls `verified`,
  `totalRafflePrice`, `paymentImage`, `tickets` — everything.
- `:8` method check is dead code (the export is `POST`-only).

**Fix (code only, not deployed):** the route is deleted. Transfer writes now go
through `createTransferSale` (`functions/src/index.ts:1156`), which validates
every field server-side, recomputes `totalRafflePrice` from
`raffles/{id}.pricePerTicket` (`:1281-1300`), derives `verified` itself
(`:1413`), ignores every client-supplied total, and writes through the Admin
SDK inside a transaction (`:1416-1479`). `GET /app/api/checkout/create/transfer`
now 404s because no handler exists. No caller existed in `app/` (see S4).

#### S4 — The transfer checkout is dead, and the UI reports success anyway — **FIXED IN CODE, PENDING DEPLOY**
The `checkTransfer` function was put behind the admin guard, but its only caller
is the public transfer checkout page. This is the classic guard-breaks-callers
case: token not sent **and** status not checked.

- Guard: `functions/src/index.ts:1100-1101` (`rejectUnlessAdmin`).
- Caller: `app/checkout/transfer/page.tsx:241-263` — bare `fetch`, headers are only
  `Content-Type`, **no `Authorization` header**.
- `app/checkout/transfer/page.tsx:264-269` parses the JSON and immediately
  `router.push("/checkout/success")`; there is no `res.ok` / `result.status`
  check anywhere in the handler.
- Result: every transfer purchase gets 401 from the function, the customer sees a
  success page and an emptied cart, and **no sale is recorded**. The guard looks
  correct in isolation; the feature is broken in production.
- Same class of dead endpoint: `functions/src/index.ts:577-578` (`success`) is
  admin-gated and has **no caller anywhere in `app/`** (grep for `apiUrl("success")`
  and `/success` API calls returns none; the success *page* is client-only).

**Fix (code only, not deployed):** the customer path no longer calls an
admin-only function. `app/checkout/transfer/page.tsx:249` posts to the new
public, server-validated `createTransferSale`; `:266-272` throws unless
`res.ok`, and `:283` shows a Spanish error toast instead of continuing.
`router.push("/checkout/success")` now only runs after a 2xx. The page attaches
`Authorization: Bearer <idToken>` when a customer is signed in (`:246-254`) and
sends no token when anonymous, because checkout is public — see the note in
"Remediation log" below. `checkTransfer`
(`functions/src/index.ts:920`) is left untouched and now has **zero callers**;
retire it after this deploy if nothing else uses it.

#### S5 — No Realtime Database rules in the repo, but RTDB holds prize state
`quickTickets` documents contain `activationCode`, `isWinner`, and `winnerLevel`,
and are written from a public function.

- Writer: `functions/src/index.ts:218-233` (`rtdb.ref("quickTickets/...").set(...)`,
  includes `activationCode` and `isWinner` in `ticketData`).
- `firebase.json` defines hosting, functions, firestore and storage rules but **no
  database rules**; `git ls-files | grep -i database` returns nothing.
- If the live RTDB is still on default/legacy rules, the winning tickets and
  their activation codes are readable by anyone who can reach the database URL —
  a direct prize-fraud path. The live rules were **not observed** (§5), so this
  is a high-severity unverified exposure, not a confirmed one.
- Related: `app/config/api.ts:36-37` points quick-ticket traffic at a **second,
  separately deployed host**, so it is easy to miss in a single-project review.

### MEDIUM

#### S6 — The rules in the repo would break the app if deployed as-is
`firestore.rules:5` says not deployed. Two write paths in `app/` contradict the
rules, so "deploy the rules" is not a safe standalone fix:

- `app/components/WithAuth.tsx:50-58` writes `notificationTokens` with the **FCM
  token as the document id** and a hardcoded `userId: "daniel"` (`:53`). Rules at
  `firestore.rules:93-96` require `tokenId == request.auth.uid` or
  `resource.data.userId == request.auth.uid` — both fail. Every signed-in user's
  notification registration would be denied, and all users would claim to be
  "daniel".
- `app/helpers/firebase.ts:7-13` writes `sales` with `verified: true` (`:9`) and
  no `userId`, while `firestore.rules:64-67` require `userId == request.auth.uid`
  and `verified == false`. This helper has **zero callers** (`addNewSale` is
  exported and never imported), so the mismatch is latent dead code today — but
  it is a trap for whoever revives it.

#### S7 — Public endpoints return whole Firestore documents
- `functions/src/index.ts:465` (`getRaffleData`) returns every ticket doc as
  `doc.data()`; the ticket model comment at `:810` declares `sold_to`, which would
  name a buyer. No writer for `sold_to` on tickets was found, so the leak is
  contingent on historical data (§5).
- `functions/src/index.ts:855-859` (`getAllRaffles`) spreads `...doc.data()` for
  every raffle, including any internal field later added to the document.
- Consequence: the public API surface is "the collection schema", so any new
  internal field is public by default. Prefer explicit field projection.

#### S8 — Stripe webhook is not idempotent
`functions/src/index.ts:1322-1349` adds a `sales` document on every
`checkout.session.completed` with no uniqueness check on `payment_intent`
(`:1327-1328` stores it but never queries it). Stripe retries deliveries; each
retry creates a duplicate sale and re-runs `setTicketsAsSold`
(`:1346-1350`). Consequence: duplicated revenue rows and admin reconciliation
noise.

#### S9 — No availability check: the same ticket can be sold twice
- `createCheckoutSession` prices the cart (`functions/src/index.ts:699-790`) from
  `pricePerTicket` but never checks whether the requested `ticketNumbers` are
  already sold.
- `setTicketsAsSold` (`functions/src/index.ts:511-545`) sets `sold: true`
  unconditionally; it never reads current state or fails on a conflict.
- Two concurrent checkouts can both pay for ticket 42. This is a money bug, not
  just a consistency nit.
- **Partially fixed (code only):** the bank-transfer path now checks ticket
  existence and `sold === true` inside a Firestore transaction
  (`functions/src/index.ts:1384-1444`), so two transfers cannot claim the same
  ticket. Card checkout and the shared `setTicketsAsSold` are still unchecked.

#### S10 — Public, unauthenticated push fan-out
`functions/src/index.ts:123-190` (`sendPurchaseNotifications`) reads every token in
`notificationTokens` and pushes to all of them. No auth, no rate limit; the code
itself flags it at `:117-119`. Anyone can spam every registered device and drain
the FCM quota.

#### S11 — Firebase web config is hardcoded instead of env-driven
`app/firebaseconfig.js:12-20` contains the project config including the web API
key (`AIza<redacted>`). A Firebase web API key is **public by design** and is not
a credential leak — but it cannot be rotated per environment and it duplicates in
`app/firebaseMessaging.js:6` and `public/firebase-messaging-sw.js:9`. Treat as
config drift, not exposure.

#### S12 — Hardcoded hosts make the env vars decorative
`app/config/api.ts:24-33` (`PROD_FUNCTIONS_BASE`, `PROD_QUICK_TICKET_BASE`) are
fallbacks, so `NEXT_PUBLIC_API_BASE_URL` being present in only one env file proves
nothing. Emulator and staging runs silently target production if a variable is
missing. Note also `functions/src/index.ts:757-762`: the Stripe `return_url` is
selected by `NODE_ENV`, not by configuration, so a stray production deploy of a
staging build sends customers to the live site.

### LOW

#### S13 — Wildcard CORS on admin endpoints
25 occurrences of `Access-Control-Allow-Origin: "*"` in
`functions/src/index.ts`, including guarded endpoints. Because auth is a Bearer
token and not a cookie, this is not credential theft — but it contradicts the
"admin-only" intent and lets any origin script the endpoints with a stolen token.

#### S14 — Admin UI gate checks "signed in", not "admin"
`app/components/WithAuth.tsx:15-23` only tests `user != null`. A non-admin can
load every admin screen and gets 401/403 from each call. The server is the real
boundary (good), but the UI misleads and the error path is noisy.

#### S15 — Unauthenticated Stripe session minting in an unused route
`app/api/checkout/create/card/route.ts:45-51` creates Stripe prices/sessions with
no auth or rate limit, reading raffle price through the client SDK (`:67`). The
route comments say the UI no longer calls it (`:8-12`) and grep confirms no
caller. Either delete it or rate-limit it; today it is free price-object spam for
anyone who finds the path.

#### S16 — Dead response-shape and method checks
`app/api/checkout/success/route.ts:15`, `app/api/checkout/create/transfer/route.ts:8`,
and `functions/src/index.ts:1106-1108` (checkTransfer allows GET in CORS but
rejects it) are inconsistencies that make the endpoints look safer than they are.

---

### Remediation log — 2026-10-22 (transfer checkout hardening)

Scope: S3, S4 and the transfer half of S9. Code only — **nothing was deployed**,
no rules were deployed, no credential touched.

| Change | File |
|---|---|
| New public, server-validated `createTransferSale` (Admin SDK, transaction) | `functions/src/index.ts:1089-1537` (`export` at `:1156`) |
| Deleted the unauthenticated `POST /api/checkout/create/transfer` route | `app/api/checkout/create/transfer/route.ts` (removed) |
| Client posts to `createTransferSale`, sends ID token when signed in, gates the redirect on `res.ok`, surfaces a Spanish error | `app/checkout/transfer/page.tsx:241-292` |
| `sales` client writes denied; Admin SDK only | `firestore.rules:55-66` |

Why the function is **public and not admin-guarded**: its only caller is the
public cart checkout. Making it admin-guarded is what produced S4 in the first
place (the customer never has an admin token). Trust is established the same way
as `createCheckoutSession` does for cards: server-side pricing from the raffle
documents, server-decided `verified`, and a transaction that rejects any ticket
that is already sold. The customer's ID token is optional and only recorded as
`sales.userId`.

Behaviour details worth knowing before deploying:

- `verified` is server-computed: `true` when the sale is auto-confirmed (≤ 5
  tickets, tickets marked sold immediately — the rule the old handler applied),
  otherwise `false` and it waits for an admin, as the page copy promises.
- The sale document id is `transfer_<paymentConceptKey>`, making a retry
  idempotent instead of creating a second sale.
- `bets` line prices are read from `bets/{id}` (Firestore, then RTDB) rather than
  trusting the cart.
- Admin notification reuses `notificationTokens` and is best effort.

Still required, outside this change: deploy the function and `firestore.rules`
(§4 steps 3–4). The receipt-upload gap is now covered by a rule instead: see
"Remediation log — 2026-10-23 (storage rule for receipt uploads)" below.

## Remediation log — 2026-10-23 (storage rule for receipt uploads)

Closes the receipt-upload gap flagged in this log and in "Callers found
broken": `app/checkout/transfer/page.tsx:236` uploads the customer's payment
receipt to `salesImages/<paymentConceptKey>`, which the proposed
`storage.rules` denied — deploying those rules as written would have broken the
transfer checkout.

| Change | File |
|---|---|
| New `salesImages/{conceptKey}` rule: image-only, 5 MB cap, object name must match the 16-digit pago-concept key the server validates (`functions/src/index.ts:1230-1234`); write does not require auth because the customer path is public by design. | `storage.rules` |

Rules-file edit only — nothing deployed, per run policy.

## 3. Measured consistency

Sweeps run with `find … | xargs grep -nE` (never unquoted `--include=`, which zsh
expands and which silently reports 0). File base: **54** `app/**/*.{ts,tsx,js}`
files. Proof of working sweep: the `console.` count returns 155, matching a direct
count, and the secret sweep was proven against the historical tokens in S1.

| Signal | Count | Consequence |
|---|---|---|
| `console.` in `app/**` | **155** | Logs cart contents, tokens, sale payloads in production console; some lines print notification tokens (`WithAuth.tsx:41`) |
| `: any` in `app/**` | **32** | Type checks pass over unvalidated sale/raffle payloads — the same payloads S2/S3 write to Firestore |
| `#[0-9a-fA-F]{6}` in `app/**/*.{ts,tsx,js}` | **0** | Hex colours live in `globals.css`/`tailwind.config.ts`, consistent with DESIGN-AUDIT's scope |
| `<img ` in `app/**` | **3** | Bypasses `next/image`; combined with admin-supplied URLs this is the `next.config.mjs` constraint DESIGN-AUDIT notes |
| `addDoc\|setDoc\|updateDoc\|deleteDoc` in `app/**` | **8** | 4 are the two unauthenticated route handlers (S2, S3); 1 is the dead `addNewSale`; 1 is `WithAuth` (S6) |
| `Access-Control-Allow-Origin` in `app/**` | **0** | All CORS is server-side in Functions — one policy surface, but wildcard throughout (S13) |
| `console.` → `toast.` ratio | 155 vs **30** | Failures are logged for developers, not surfaced to customers; S4's false success is this pattern taken to its conclusion |
| `alert(` in `app/**` | **1** | `app/checkout/card/page.tsx` has a bare `alert;` statement (`:36` of the excerpt, near the missing-client-secret branch) — a no-op |

Guarded vs public surface:

| Class | Count | Evidence |
|---|---|---|
| Exported Cloud Functions | **24** | `grep -nE '^export const .* = functions' functions/src/index.ts` |
| …behind `rejectUnlessAdmin` | **15** | call sites at lines 475, 541, 578, 876, 915, 978, 1038, 1101, 1359, 1403, 1624, 1661, 1698, 1739, 1860 |
| …public by design/in fact | **9** | `sendPurchaseNotifications`, `createQuickTicket`, `getRaffleData`, `createCheckoutSession`, `getAllRaffles`, `stripeWebHook`, `getAllBets`, `getBetData`, `getRemoteConfigValues` |
| Next route handlers | **4** | `app/api/**/route.ts` |
| …unauthenticated **write** surfaces | **2** | S2, S3 |
| …unauthenticated read/session surfaces | **2** | `app/api/raffle/route.ts`, `app/api/checkout/create/card/route.ts` |
| Tracked env files | **1** | `.env.example` |
| RTDB rules files | **0** | S5 |

---

## 4. Execution order

**1. Rotate credentials first — before any code fix.** Follow
`SECURITY-ROTATION.md` §1–§3 in the Stripe Dashboard: roll the live secret key,
roll the test key, roll the webhook signing secret. Then set
`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Secret Manager
(`SECURITY-ROTATION.md` §4) and grep Stripe logs for the last 30 days for requests
you did not make. *This requires your Stripe console access — I did not do it.*

**2. Check the RTDB rules in the Firebase console (S5).** If they are default/open,
close them before anything else is deployed; prize activation codes are the
highest-value data in the app.

**3. Neutralise the two unauthenticated write surfaces (S2, S3).** Delete both
route handlers, or replace them with a server-verified path. Deleting
`app/api/checkout/success/route.ts` is safe: nothing in `app/` calls it. Deleting
`app/api/checkout/create/transfer/route.ts` requires confirming the transfer page
does not use it — it posts to the `checkTransfer` Cloud Function instead
(`app/checkout/transfer/page.tsx:242`), so the route is redundant.

**4. Decide the transfer flow before touching the guard (S4).** Transfer is a
customer-facing action, so the fix is not "give the customer an admin token". Move
the write into a public, validated function (server-side pricing + availability)
or route it through the now-unused route handler with proper validation, then
re-enable the customer path. Add `if (!res.ok) throw` at
`app/checkout/transfer/page.tsx:264` regardless.

**5. Make the webhook idempotent and the inventory atomic (S8, S9).** Key the
sale on `payment_intent`, and check `sold !== true` inside a transaction before
flipping tickets.

**6. Reconcile rules with client code, then deploy (S6).** Fix
`WithAuth.tsx:53` / the token-id scheme and delete the dead `addNewSale` helper
before deploying `firestore.rules`; deploying first breaks notification
registration.

**7. Config hygiene (S11, S12, S15).** Move the Firebase web config to env,
remove or gate the unused card route, and decide whether the hardcoded
production fallbacks stay.

**8. Only then, optionally, rewrite history (S1).** Rotation already neutralises
the keys; history rewriting is cleanup, and it must come after step 1.

---

## 5. Not verified

- **Live Firestore and RTDB rules.** I read the repo files only. `firestore.rules`
  and `storage.rules` self-declare as not deployed; the live console state is
  unknown, so S5/S6 are labelled as exposure risk, not confirmed exposure.
- **Whether the leaked Stripe keys were used by anyone.** Requires Stripe dashboard
  logs; not observed.
- **Whether `sold_to` or buyer contact data actually exists in `tickets`.** No
  writer was found in the current tree; historical documents were not queried.
- **Whether the deployed Next build includes `app/api/**`.** The routes are in the
  source tree and `firebase.json` deploys the app as a framework backend, but I did
  not inspect the deployed build or hit the URLs.
- **Emulator or runtime proof.** No function was executed, no request was sent, no
  emulator was booted. All findings are from source reading and git history.
- **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` wiring.** Empty in all three env files;
  how production gets a publishable key (or whether the card page even initialises)
  was not traced into `stripePromise`.
- **Traffic volume and abuse history** for `sendPurchaseNotifications`,
  `createQuickTicket`, and the public read endpoints.
- **DESIGN-AUDIT.md claims were not re-derived.** I only confirmed its one
  security-adjacent claim: `B2delete` ("`app/api/admin/**` deleted, zero callers")
  holds — no `app/api/admin` directory exists. Its other entries are presentation
  issues and are outside this audit's scope; there is no conflict between the two
  documents.

## 6. What I did not change

The audit pass itself was read-only: no source file, rule file, env file,
function, deployment, or git history was modified, and no credential was rotated
or tested. `SECURITY-AUDIT.md` was created untracked at audit time.

A **separate remediation pass** on 2026-10-22 (see "Remediation log" above) then
changed exactly four things for the transfer flow: `functions/src/index.ts`
(`createTransferSale`), `app/checkout/transfer/page.tsx`, the deleted
`app/api/checkout/create/transfer/route.ts`, and the `sales` block of
`firestore.rules`. It was committed on `design/ratified-decisions` and **not
pushed or deployed**. Everything else in this document still describes the tree
as it was before that commit.

---

## 7. Open questions for you

1. **Is the bank-transfer checkout meant to be self-serve?** It is currently
   admin-only at the function and public at the page (S4). Which side is correct
   decides whether the fix is a public validated function or an admin-assisted
   flow.
2. **Is Realtime Database still in production use?** If `quickTickets` moved to
   Firestore, the second function host (`app/config/api.ts:36-37`) and RTDB rules
   question both disappear.
3. **Should `app/api/checkout/create/card/route.ts` be deleted?** It is unused and
   unauthenticated (S15); deleting it shrinks the surface with no feature loss.
4. **Who holds `admin: true`, and is `/admins/{uid}` seeded?** `firestore.rules`
   supports both mechanisms (`:32-37`) and says to pick one before deploy.
5. **Are there historical `sales` documents written by the client path with
   `verified: true`?** If so they need reconciliation against Stripe (S6/S8), not
   just deletion of the code.
6. **Do you want the two route handlers kept as a planned fallback?** If yes, they
   need auth and server-side pricing rather than deletion.

---

### Self-check

- Every finding carries `file:line` or a reproducible count: S1 (162 + 0, sweep
  proven), S2–S3 (route line numbers), S4 (caller + guard lines), S5 (`firebase.json`
  + writer lines), S6–S16 (line numbers). ✅
- Both sweeps were proven against known-present tokens (`console.` = 155 direct;
  secret pattern matched 162 historical blobs) before trusting their zeros. ✅
- No secret value appears in this document; only `sk_live_<redacted>`,
  `sk_test_<redacted>`, `whsec_<redacted>`, `AIza<redacted>`. ✅
- Required section order followed: environment gotchas → findings →
  consistency → execution order → not verified → open questions. ✅
- Single first action: **rotate the Stripe live key** (§4 step 1, S1).
