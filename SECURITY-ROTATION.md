# Secret rotation and deployment runbook

**Status: ACTION REQUIRED.** Real Stripe credentials were committed to this
repository in `functions/src/index.ts` and `app/api/checkout/create/card/route.ts`
and are therefore still present in git history. This branch removes them from
the working tree, but removing them from history does **not** make them secret
again — anyone with a clone, a fork, a CI log or a backup already has them.

**Rotation is the fix. History rewriting is optional and secondary.**

Do steps 1–6 in order. Nothing in this file contains a credential value.

---

## 1. Roll the live secret key (`sk_live_…`)

1. Stripe Dashboard → **Developers → API keys** → the live secret key → **Roll
   key**. Stripe keeps the old key valid for 24 h by default; if you want a hard
   cutover, choose to expire it immediately (only do this after step 4 is done,
   otherwise checkouts break for up to the deploy window).
2. Record the new value in a password manager — not in a file in this repo.
3. Grep Stripe's **Developers → Logs** for the last 30 days for requests you did
   not make: unexpected `POST /v1/checkout/sessions`, `POST /v1/prices`,
   `POST /v1/refunds`, `GET /v1/charges`, `GET /v1/customers`. Any hit means
   someone used the leaked key; escalate before doing anything else.

## 2. Roll the old test key (`sk_test_…`)

1. Same page, test-mode secret key → **Roll key** (or delete it if unused).
2. Test keys cannot move real money, but they do expose the account's test data,
   webhook endpoints and customer objects. Roll it anyway so a future test-mode
   deploy cannot be driven by a leaked credential.
3. If the Next route handler in `app/api/checkout/create/card/route.ts` is ever
   revived, it must use **your own** test key from `.env.local`, never a literal.

## 3. Roll the webhook signing secret (`whsec_…`)

1. Stripe Dashboard → **Developers → Webhooks** → the endpoint that points at
   the `stripeWebHook` Cloud Function → **Roll secret**.
2. Copy the new signing secret — it is shown once.
3. Old signatures stop verifying as soon as you are deployed with the new
   secret (see step 5). Stripe's webhook panel shows a 400 for any retry in the
   meantime; that is expected, and delivery retries resume after the secret set.

## 4. Set the Cloud Functions secrets

From the repo root (this writes to Secret Manager for project
`raffleapp-dbc1b`; it does **not** deploy code):

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY --project raffleapp-dbc1b
# paste the NEW live key from step 1 when prompted

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project raffleapp-dbc1b
# paste the NEW signing secret from step 3

# optional sanity check (shows version/state, never the value):
firebase functions:secrets:access STRIPE_SECRET_KEY --project raffleapp-dbc1b >/dev/null && echo "readable"
```

`createCheckoutSession` and `stripeWebHook` now declare these secrets with
`defineSecret()` and bind them via `runWith({ secrets: [...] })`. Nothing else
in the codebase reads them.

> **Deploy note:** `firebase-functions` (v1 HTTP) does not support attaching
> secrets to an *already-deployed* HTTP function in place. The first
> `firebase deploy --only functions` after this branch lands may fail with
> "Cannot update... secret" style conflicts for `createCheckoutSession` and
> `stripeWebHook`. If so: delete just those two functions in the Firebase
> console (Cloud Functions list, region `us-central1`), then redeploy. URLs stay
> the same.

## 5. Set the hosting/env var for the Next app

Only needed if `app/api/checkout/create/card/route.ts` (the Next route handler)
is kept and deployed. The main checkout page talks to the Cloud Function, not to
this route.

```bash
# local development only — .env.local is gitignored
echo 'STRIPE_SECRET_KEY=<new key>' >> .env.local   # do not commit, do not paste into chat

# App Hosting / hosting env var (whichever the project uses):
firebase apphosting:secrets:set STRIPE_SECRET_KEY --project raffleapp-dbc1b
```

`STRIPE_SECRET_KEY` has no `NEXT_PUBLIC_` prefix, so it is never bundled to the
browser. `.env.example` lists the name with an empty value as documentation.

## 6. Verify payments and watch for abuse

1. **Webhook deliveries:** Stripe → Developers → Webhooks → the endpoint. In the
   last 30 days look for deliveries with a 4xx/5xx, deliveries from IPs outside
   Stripe's published ranges, or event types you never subscribed to.
2. **Payments:** Stripe → Payments. Reconcile the last 30 days against
   `sales` in Firestore (`paymentMethod == "card"`, `verified == true`). Any
   verified card sale with no matching Stripe charge — or vice versa — is an
   incident.
3. **Firestore:** check `sales` for docs with `paymentMethod: "card"` created at
   times with no corresponding Stripe session. The webhook is the only writer
   now, so any such doc predates this change or was written via the (deleted)
   client path.
4. **Functions logs:** Cloud Logging for `confirmSale`, `rejectSale`,
   `deleteRaffle`, `markTicketsAsSold`, `updateRaffle`, `updateBet`,
   `deleteBet`, `confirmRejectBetSale`, `createRaffle` in the last 30 days.
   A 401/403 burst after this deploy is the new guard working; a burst *before*
   it is worth reading.
5. After rotation, run one real low-value card checkout end to end and confirm:
   the sale lands in Firestore, the tickets flip to sold, and the webhook shows a
   200.

## 7. Git history

The values remain in history. If the repository is public, or has been shared
broadly, consider `git filter-repo` / BFG plus a force-push and a branch freeze —
but only **after** steps 1–6. Rotation already neutralises the leaked keys;
history rewriting only reduces future confusion.

## 8. Admin claim (needed for the new auth guard)

Admin endpoints now require an ID token with the custom claim `admin === true`.
Seed it once per admin account (Admin SDK, from a trusted machine):

```js
// one-off script, run with `node --experimental-...` or via the Admin SDK REPL
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "raffleapp-dbc1b" });
await admin.auth().setCustomUserClaims("<ADMIN_UID>", { admin: true });
```

The affected user must sign out and back in (or call
`getIdToken(/* forceRefresh */ true)`) before the claim appears in their token.
