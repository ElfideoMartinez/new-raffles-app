# Needs-Daniel — Firebase console actions (2026-10-23 ~21:10 CST)

Context: the coding agent deployed `createTransferSale` (new) and the
admin-auth fix for `getSalesBets` to project `raffleapp-dbc1b` tonight and
verified both with curl. Everything below could not be done from the CLI and
needs you. Nothing here touches Stripe keys or credentials.

---

## 1. Re-enable the deactivated Realtime DB (the one that matters for getAllBets)

**Why:** `raffleapp-dbc1b-default-rtdb` is deactivated, so `getAllBets`
504s and `/bet/[id]` pages have no live data. The functions call
`getDatabase()` with no explicit `databaseURL`, so they resolve to this
default instance — re-enabling **this exact instance** needs **zero code
changes and no redeploy**. Creating a different instance instead would
require code changes + redeploy. Recommend re-enabling.

### Option A — Console (try this first)

1. Open the project: https://console.firebase.google.com/project/raffleapp-dbc1b/database
   (this lands you on **Realtime Database** if the instance exists; if it
   shows the Firestore page instead, click **Realtime Database** in the
   left **Build** menu).
2. Look for the instance `raffleapp-dbc1b-default-rtdb` (location
   us-central1). If Firebase deactivated it for inactivity/plan limits, the
   page usually shows a banner or status on the instance — look for any
   **Re-enable / Restore / Reactivate** button and click it.
3. If the console asks you to **upgrade to Blaze** first (check
   https://console.firebase.google.com/project/raffleapp-dbc1b/usage or the
   bottom-left project settings → **Usage and billing**), decide: RTDB on
   Blaze charges only for storage beyond the free 1 GB and connections
   beyond 100 — the bet data here is tiny, so expect ~$0.
4. If the console shows **no** re-enable button (the console does not
   always expose one), use Option B.

**Verify after enabling** (works from any terminal, or just use the app):

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://us-central1-raffleapp-dbc1b.cloudfunctions.net/getAllBets
# Expect 200 (with JSON bets), NOT 504.

curl -s -o /dev/null -w "%{http_code}\n" \
  https://us-central1-raffleapp-dbc1b.cloudfunctions.net/getBetData?id=<someRealBetId>
# 200/404 vs the old 504/timeout — proves the DB answers.
```

Also open the app: https://raffleapp-dbc1b.web.app → any `/bet/[id]` page
should load bet data instead of hanging.

### Option B — Management API (if the console offers no button)

Your `gcloud` refresh token is stale (the agent got `invalid_grant`), so
log in first:

```bash
gcloud auth login
gcloud config set project raffleapp-dbc1b

# 1. Confirm the instance and its current state:
TOKEN=$(gcloud auth print-access-token)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firebasedatabase.googleapis.com/v1beta/projects/raffleapp-dbc1b/locations/-/instances"
# Look for "raffleapp-dbc1b-default-rtdb" and its "databaseState"
# (expect DEACTIVATED or DISABLED) and note its exact location field.

# 2. Re-enable it (set LOCATION to the value from step 1, e.g. us-central1):
curl -s -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"databaseState":"ACTIVE"}' \
  "https://firebasedatabase.googleapis.com/v1beta/projects/raffleapp-dbc1b/locations/LOCATION/instances/raffleapp-dbc1b-default-rtdb?updateMask=databaseState"

# 3. Re-run step 1 and confirm databaseState is ACTIVE, then run the two
#    curl verification commands from Option A step 4.
```

**What changes if you re-enable:** nothing in code, nothing redeployed.
**What changes if you instead create a new instance:** the functions code
(`functions/src/index.ts`, `admin.initializeApp()` at the top) and the web
client would both need a `databaseURL` pointing at the new instance URL,
plus a redeploy — not recommended tonight.

---

## 2. Firebase CLI login — NOT needed

The CLI was already authenticated tonight (`firebase projects:list` worked
with project `raffleapp-dbc1b` selected). No action. (Include this section
only for completeness; if a future session reports auth errors, run
`firebase login` yourself — never let an agent do interactive browser login.)

---

## 3. Other things only you can do

1. **Regression-check the getSalesBets auth fix with a real admin login**
   (the agent could only verify the 401-unauthenticated side):
   1. Open https://raffleapp-dbc1b.web.app/admin and sign in with your
      admin account (the one that carries the `admin: true` custom claim).
   2. Go to the **Sales Bets** admin page (the UI page at `app/admin/salesBets/page.tsx`
      — labeled **Sales Bets** in the admin menu).
   3. Confirm the sales-bets list still loads (a signed-in admin should get
      the normal list; expect 200 server-side). If it shows an error, open
      DevTools → Network → the `getSalesBets` request and note the status.
2. **Glance at function logs:** https://console.firebase.google.com/project/raffleapp-dbc1b/functions/logs
   → select `createTransferSale` and `getSalesBets` → confirm no errors
   after tonight's ~21:00 CST deploy.
3. **Real-money testing stays NOT authorized** (your 18:07 CST rule).
   Nothing tonight created orders or moved money.
4. **Test-account cleanup after the event test:** delete the Firebase Auth
   test user `ufc-test-1792801216865@example.com` (uid `XjFG5wIoBTYBxHUXysxTOYVuNOu1`)
   via https://console.firebase.google.com/project/raffleapp-dbc1b/authentication/users
   once the event test ends.
5. **Standing item (not tonight):** `SECURITY-ROTATION.md` — the Stripe live
   key / webhook secret committed to git history still need rotation. Do not
   do it mid-event; schedule it separately.
