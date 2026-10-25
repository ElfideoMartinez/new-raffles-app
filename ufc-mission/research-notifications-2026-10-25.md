# Notification services research — backlog item 16 (2026-10-25)

Scope: FCM vs OneSignal vs raw web-push vs SSE for new-raffles-app
(Next.js + Firebase). Bounded research only — no code changes, no deploys,
no new dependencies. Branch `design/ratified-decisions`, commit `f7f5ace`.

---

## 0. Current state of the code (verified today)

- **Push channel is FCM web (v1 SDK) with VAPID key.**
  `app/firebaseMessaging.js` initializes `getMessaging`, `getToken` with a
  VAPID key, and `onMessage`; a service worker exists at
  `public/firebase-messaging-sw.js`.
- **Roster is device-level and unowned.**
  `app/components/WithAuth.tsx:36-58` writes `setDoc(doc(collection(db,
  "notificationTokens"), token), { userId: "daniel", token, createdAt })`.
  The `userId: "daniel"` hardcode is at `WithAuth.tsx:53` — the 2026-10-24
  finding stands exactly as written.
- **Known short-circuit bug confirmed.**
  `WithAuth.tsx:31-36`: if `localStorage.getItem("notificationToken")` finds
  anything, the function returns early and **never re-registers or refreshes
  the Firestore doc**. Two consequences: (a) if the Firestore doc was deleted
  or the token was rotated by the browser, the app keeps a stale token forever
  (push silently undeliverable to that device); (b) registration only ever
  happens once per browser profile. FCM docs recommend `getToken` on every
  load and syncing to the backend when it changes.
- **Admin send endpoint is already gated (backlog 3 landed).**
  `functions/src/index.ts:155-161`: `sendPurchaseNotifications` calls
  `rejectUnlessAdmin(...)` first, then `logAdminAction(...)` to the
  `adminWriteLog` audit trail. `rejectUnlessAdmin` (index.ts:120-146) verifies
  an admin ID token (`assertAdmin`) and returns 401/403 with CORS applied
  first. The comment at index.ts:156-159 states the public site does not call
  it. **Item 3's gating is in the current code — not pending.**
- **Settlement notifications (backlog 13) also use FCM multicast + ledger.**
  `functions/src/index.ts:2201-2210` reads all `notificationTokens`,
  builds per-sale notifications, dedupes via
  `notifications/${betId}__${sale.saleId}` idempotency guard
  (index.ts:2210), and sends with `sendEachForMulticast` (index.ts:2255).
  Two more multicast senders exist (index.ts:196 purchase-manual,
  index.ts:1069 and 1508 other paths) — all reading the same device roster.
- **Firestore rules already anticipate identity rosters.**
  `firestore.rules:90-93`: `match /notificationTokens/{tokenId}` allows
  read/write only when signed in **and** `tokenId == request.auth.uid` or
  `resource.data.userId == request.auth.uid`. The rules are *stricter than
  the current client*: today's client writes `tokenId = token` with
  `userId: "daniel"`, which only passes because the admin user is the one
  registering (and `resource.data.userId` never matches a real uid). This is
  an accident, not a design. The per-sale rules at
  `firestore.rules:64,80,83` already do `userId == request.auth.uid` — the
  identity pattern exists elsewhere in the app.

---

## 1. Multi-recipient rosters: device-level vs identity-level

| | Roster-by-device (current) | Roster-by-identity (accounts + `tokenId == request.auth.uid`) |
|---|---|---|
| Model | Each browser registers a token; broadcast = all docs in `notificationTokens` | One uid → N device tokens; doc id = uid, tokens in a map/array field or `notificationTokens/{uid}/tokens/{token}` |
| Who can be targeted | Nobody — everyone gets everything | Any signed-in user by uid; a "send to sale.userId" query becomes trivial |
| Per-person prefs | Impossible (nothing identifies the person) | Trivial: store prefs on the user doc |
| Multi-device | All devices are equal, no dedupe, stale tokens accumulate | Per-uid token map with prune-on-send (FCM returns unregistered tokens) |
| Migration effort | Zero (status quo) | Small-medium, see below |

**Migration effort, roster-by-identity (concrete):**
1. Give customers real accounts. The app already records optional
   `userId` on sales: `functions/src/index.ts:1186-1198` verifies an ID token
   and stores `userId = uid`; rules read it (`firestore.rules:64`). What is
   missing is a sign-up/sign-in surface for customers — today only the admin
   signs in (`WithAuth.tsx:21-27` redirects everyone else to `/admin`).
2. Change client registration (`WithAuth.tsx` or a new customer-side
   component): write `doc(notificationTokens, user.uid)` with
   `tokens: { [token]: true }`, `merge: true`. ~30 lines.
3. Fix the localStorage short-circuit (see §3) so token rotation syncs.
4. Change the three/four multicast senders in `functions/src/index.ts`
   (196, 1069, 1508, 2255) to iterate the new shape. ~1–2 h.
5. Rules are **already written** (`firestore.rules:90-93`) — no change needed;
   the current client is the non-compliant party.
6. Existing device-roster docs need a one-time migration or a dual-read
   during transition.

Estimated: **1–2 focused sessions** for steps 2–4 plus the token-bug fix;
step 1 (customer accounts UX, Spanish-language) is the real cost and is a
product decision, not a plumbing one.

---

## 2. Per-person preferences (mute / win-only / all)

- **FCM (current)**: possible only after identity rosters exist. Prefs are one
  map field on the user doc; the sender filters uids before building the
  multicast list (`functions/src/index.ts:2201` loop already iterates sales —
  filtering there is ~10 lines per sender). No vendor feature needed.
- **OneSignal**: has segmented delivery, but segmentation is by OneSignal's
  own user model — you'd sync tags on every preference change and trust their
  targeting. Extra moving part for a need FCM already covers.
- **Raw web-push**: prefs live wherever your roster lives; same as FCM, more
  code per send.
- **SSE**: trivially per-connection, but only works with the tab open — not a
  real notification channel for this use case (see §3).

Verdict: preferences are a **roster problem, not a vendor problem**. Any
option works once identity exists; FCM needs the least extra machinery.

---

## 3. Delivery reliability (iOS/Android web + PWA)

- **FCM web push** (current): iOS Safari 16.4+ supports Web Push including
  installed PWAs; Android Chrome is fully supported. Foreground messages
  arrive via `onMessage` (`app/firebaseMessaging.js:60-73`); background
  delivery depends on `public/firebase-messaging-sw.js`, which exists. Real
  reliability risk is **the app's own registration bug**: the localStorage
  short-circuit (`WithAuth.tsx:31-36`) means rotated/deleted tokens are never
  re-registered, so delivery silently fails for stale devices until the doc
  is cleaned. FCM multicast responses report `unregistered`/`invalid` tokens
  (`functions/src/index.ts:196` logs the response but **never prunes** dead
  tokens from the roster — a slow roster rot worth fixing regardless).
- **OneSignal**: same underlying Web Push on the same browsers; adds an SDK
  and their dashboard. Reliability is equivalent at the browser level; you
  gain their inbox/analytics, lose direct ownership of tokens.
- **Raw web-push (web-push npm lib)**: identical browser support, but you
  implement payload encryption, subscription expiry handling, and per-platform
  quirks yourself. For a single-developer app this is strictly more work for
  the same result.
- **SSE**: works only while the page is open. iOS Safari kills background
  connections; Android Chrome similar. Cannot deliver a "you won / payment
  received" notification after the user closes the tab — which is the
  entire point of this app's notifications (settlement happens hours/days
  after purchase). **Not viable as the primary channel.**

Note: this app has no `manifest.json` (nothing matches `public/manifest*`),
so iOS "install to home screen" PWA prompt behavior is limited; that affects
iOS notification *permission ergonomics*, not the vendor choice.

---

## 4. Abuse surface: `sendPurchaseNotifications` gating

**Current actual state: gated.** `functions/src/index.ts:157-161` — the first
statement is `if (await rejectUnlessAdmin(req, res, "POST, OPTIONS")) return;`,
which verifies an admin ID token and logs every call to `adminWriteLog`
(index.ts:162-166). Backlog item 3's fix landed in the current branch; the
2026-10-24 concern is resolved in code.

What each option requires to keep sends admin-only:

- **FCM (keep)**: nothing further. The Admin SDK send path is
  server-side-only (`admin.messaging()` at index.ts:196/1069/1508/2255);
  the HTTP trigger is admin-gated; the client FCM SDK can only *receive*.
  The VAPID key in `app/firebaseMessaging.js` is a public identifier by
  design, not a secret. Residual risk: only that `rejectUnlessAdmin` stays
  first in every future sender — worth a one-line note in the backlog, not
  new code.
- **OneSignal**: requires locking down their REST API app key — it must live
  only in Cloud Functions env config, never client-side; plus an admin-gate
  on any function that calls it (same `rejectUnlessAdmin` pattern). One more
  secret to rotate (see SECURITY-ROTATION.md discipline).
- **Raw web-push**: VAPID private key is a true secret that signs every
  push — must be server-env-only. Same admin-gate requirement. Slightly
  larger blast radius if leaked (key can push to all subscriptions).
- **SSE**: any client can open a connection; authorization would need to be
  re-implemented per stream. Largest custom auth surface for the weakest
  channel.

FCM has the smallest and already-implemented abuse surface.

---

## 5. Cost/effort verdict and recommendation

Context: small raffle audience, Spanish-language UI, admin-triggered
settlement notifications already shipped via FCM multicast + Firestore
notifications ledger with idempotency (`functions/src/index.ts:2210,2255`).

| Option | Switch cost | Ongoing | Fit |
|---|---|---|---|
| **Keep FCM** | 0 | 0 | ✅ already built, gated, audited |
| OneSignal | new SDK, key rotation, re-registration of all devices, vendor lock | vendor dashboard dependency | overkill at this scale |
| Raw web-push | re-encode all sends, new subscription flow | self-maintained crypto/expiry | strictly more work |
| SSE | rebuild channel | no background delivery | not viable for this use case |

### VERDICT: **KEEP FCM.** Do not switch vendors.

**Why:** every requirement in item 16 (rosters, preferences, reliability,
abuse surface) is either already satisfied by the current FCM stack or is
blocked only by the **identity model**, not the vendor. Switching to
OneSignal or web-push would re-implement the same roster problem on a new
platform while discarding a working, admin-gated, audit-logged send path
(`functions/src/index.ts:155-161`) and a working settlement pipeline
(index.ts:2201-2255). SSE cannot deliver to a closed tab, which is the
dominant use case.

**Estimated effort (keep-FCM, fix-forward):**
- Token-registration bug fix + prune dead tokens on send (read the multicast
  response and delete `unregistered` docs): ~half a session.
- Roster-by-identity migration (client writes uid-keyed docs; four senders
  read the new shape; rules already compliant at `firestore.rules:90-93`):
  1–2 sessions, *contingent on Daniel choosing the identity model*.
- Per-person prefs after identity lands: ~10 lines per sender.

### THE ONE DECISION DANIEL MUST MAKE — identity model A vs B:

- **Model A — Accounts for customers.** Everyone signs in (Google or
  email). `sale.userId` (already captured at `functions/src/index.ts:1198`)
  maps to a real uid; full per-person targeting, prefs, and the rules at
  `firestore.rules:90-93` work as designed. Cost: a customer-facing auth UX
  in Spanish, and friction at purchase time.
- **Model B — Claimed-device roster.** Keep device-level registration but
  link each token doc to a sale/customer record (e.g. token doc stores the
  last `saleId` or a customer phone/email captured at checkout — the field
  is optional today per backlog line 43). Targeting is then by sale cohort,
  not person. Cost: near-zero auth work; limits: no true per-person prefs,
  cross-device identity still impossible.

Model A is the strategic fix; Model B is the pragmatic half-step. The
verified code supports both without rule changes.

---

## Sources (file:line, verified 2026-10-25)

- `app/components/WithAuth.tsx:21-58` — auth redirect, token registration,
  `userId: "daniel"` hardcode (line 53), localStorage short-circuit (31-36)
- `app/firebaseMessaging.js` — FCM init, VAPID `getToken`, `onMessage`
- `public/firebase-messaging-sw.js` — background SW exists
- `functions/src/index.ts:120-146` — `rejectUnlessAdmin` (CORS-first, 401/403)
- `functions/src/index.ts:155-166` — `sendPurchaseNotifications` admin-gated
  + `logAdminAction`
- `functions/src/index.ts:196, 1069, 1508, 2255` — `sendEachForMulticast`
  senders; 2201 roster read; 2210 idempotency ledger; no dead-token pruning
- `functions/src/index.ts:1186-1198` — optional `userId` captured from ID token
- `firestore.rules:64,80,83` — existing `userId == request.auth.uid` pattern
- `firestore.rules:88-93` — `notificationTokens` rules already identity-shaped
- `ufc-mission/backlog.md:171-176` — item 16 original scope; line 43 optional email