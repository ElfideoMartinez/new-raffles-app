# Backlog — new-raffles-app

Ordered by what blocks real money and nightly operations first, then UX.
Maintained during the UFC 333 event test (2026-10-24). Read this before starting
any admin-side work; most items below came from live-testing failures, not
speculation.

Legend: **P0** money/data correctness · **P1** operational risk · **P2** UX · **P3** nice to have

---

## P0 — correctness / money

### 1. `oddsTie` is written as `undefined`
**Fixed 2026-10-24** — see Done. Omitted the key entirely when empty in
`createBet`; no longer assigns `undefined`.

### 2. Pari-mutuel odds are a placeholder, not a price
`createBet` defaults `oddsTeamA`/`oddsTeamB` to `"1.0"`. The app is a pari-mutuel
pool (`settleBet`: `pool × (1 − takeRate) / winningTickets`), so no pre-match odds
exist. Showing `1.0` reads as a promise the system will not honour.
**Partially fixed 2026-10-24**: the bet list card now shows live pool share
(`Reparto actual`) instead of the odds fields. Still open: the admin forms
(`admin/bets`, `admin/create/bet`) still expose odds inputs that do nothing, and
nothing validates them. Either remove the inputs or make them clearly
"cosmetic/ignored".

---

## P1 — operational risk

### 3. `sendPurchaseNotifications` is a public, unauthenticated push endpoint
Anyone can POST to it and push a notification to every registered device.
Source already flags this (`TODO(hardening)`). Needs auth or rate limiting before
it can be relied on. See item 7.

### 4. Seller/admin pages duplicate logic: `/admin/sales` vs `/admin/salesBets`
Both pages are near-identical (same fetch, same loading, same tabs, same card
grid). Every fix this session had to be applied twice, and the CORS bug had to be
deployed twice because of it. **Consolidating these is the highest-value admin
change and should be the first task of the admin UX audit (item 12).**

### 5. No bet cutoff behaviour
Verified live (T15): a bet stays open for purchases after the fight has started.
`isFinished` only greys out the UI; the server accepts `createTransferSale` for a
started bout. Needs a server-side close time enforced in the create path, not just
a UI state.

---

## P2 — admin UX / UI (audit scope, 2026-10-24)

### 12. Admin UX/UI audit
Focus ordered by impact:
1. Merge `/admin/sales` and `/admin/salesBets` (item 4).
2. Persistent admin navigation. Today there is none: every page dead-ends into a
   "Volver al inicio" link back to the dashboard.
3. Dashboard is 9 buttons in 2 ungrouped rows; group by task (Ventas, Apuestas,
   Configuración, Publicación).
4. `/admin/edit/bet` and `/admin/edit/raffle` both stall-then-jump: a single
   select acts as both picker and loader with no persistent selection.
5. Buttons need loading + failure states as a consistent pattern (items 6, 7).

### 6. Email should be optional on the sale form
Buyers currently must supply an email. Many only use WhatsApp. Make it optional
and adjust the confirmation copy (`fewTicketsNote`) accordingly.

### 7. Confirm-payment button: error indication
`BetSaleCard` shows a toast on failure but the card gives no persistent signal.
A failed confirm looks identical to a never-attempted one a minute later.

### 8. Confirm-payment button: loading state
`isLoading` disables the button and swaps in a `FadeLoader`, but there is no
label change or in-place progress. Folds into the pattern work in item 12.5.

### 9. Post-payment navigation
`app/checkout/success/page.tsx` links back with a hardcoded `<Link href='../'>`,
so it always goes up one level regardless of origin. Capture the origin route
before checkout and return there, falling back to the list view. **This is a code
issue, not a Firebase console setting.**

---

## P2 — feature work

### 13. Winner retrieval without AI
Determine the official winner programmatically instead of an admin typing it into
`settleBet`.
- `site.api.espn.com/.../scoreboard?sports=mma&league=ufc&dates=YYYYMMDD` — no
  auth, undocumented, can change shape without notice.
- TheSportsDB — free tier, has MMA.
- SportsDataIO / API-Sports — paid, documented, SLA. The only one defensible for
  payouts.

**Design decision required before building:** auto-settlement (system pays from
scraped data) vs. assisted settlement (scrape pre-fills `result`, admin confirms).
Recommend **assisted** — same time saved, human stays on the money. Scraping an
undocumented endpoint to decide payouts is a real risk of paying the wrong people.

### 13b. No settle control in the admin UI  [P0 — blocks settlement]
`settleBet` is deployed and does the pari-mutuel payout maths, but **nothing in
`/admin` calls it**. There is no button, no form, no link. Settlement is therefore
impossible without hand-crafting an authenticated request.

Consequences found on 2026-10-24:
- No bet was settled during the entire event test.
- The winner banner on `/bet` and `/bet/[id]` has therefore **never rendered real
  data** and remains unverified.
- `settleBet` itself has never executed in production; the "Successful create
  operation" log entry was its first deploy, not a successful run.

Needed: an admin action on `/admin/bets` (or a per-bet page) that offers
A / B / Empate / VOID, shows the resulting per-ticket payout before committing,
and requires an explicit confirm. It must surface idempotency ("already settled")
clearly.

**Auth note for future automation:** `assertAdmin` needs a Firebase **ID token**
with `admin: true`. The Firebase CLI refresh-token credential can mint Google
access tokens (enough for Firestore/RTDB Admin access) but **cannot mint an ID
token**: `createCustomToken` + exchange requires `iam.serviceAccounts.signBlob`,
which the runtime service account lacks. Any scripted settlement must either use
a real signed-in session or add that IAM permission.

### 14. Dedicated bets listing page
Research and implement a real bets page (browse all bets, filter by open/finished,
see settled results). Today `/bet` is a bare card list.

### 15. Batch message winners automatically
After settlement, generate and send winner notifications in bulk. Blocked on a
real messaging channel: pairs with item 16 and cannot use the public push endpoint
(item 3). Needs winners identified per sale (`settleBet` already writes
`settlements.<betId>.status` = `paid`/`lost`/`refund`, so the data exists).

### 16. Notification services research
Evaluate Firebase Cloud Messaging properly against alternatives (OneSignal, web
push, server-sent events). Cover: multi-recipient rosters, per-person preferences,
delivery reliability, abuse surface on item 3. Includes the roster-by-identity
design (accounts + rules `tokenId == request.auth.uid`) that the 2026-10-24
device-roster work deliberately deferred.

### 17. Content generator + asset formatter for Instagram
Post-test follow-up. Generate post assets from templates and format them to
1080×1350 (feed) / 1080×1920 (story).
**Blocker note:** the creative-director subagent failed on 2026-10-24 with an
OpenRouter billing 403 (credits exhausted); the content pack was built by hand as
a result. Resolve provider credits before building a pipeline on it.

---

## Done during the 2026-10-24 UFC test

Recorded so they are not re-reported:

- CORS headers now applied before the admin auth check on all 16 admin functions;
  preflights answer 204 with `Authorization, Content-Type, Accept`. Root cause of
  admin pages reporting opaque "CORS errors" instead of 401/403.
- `/admin/salesBets` and `/admin/sales` white-screened on any non-2xx
  (`setSales(undefined)` → `.filter()` throw). Now render a typed error state via
  `app/components/ApiErrorState.tsx`.
- `totalBets` was never written by `createBet` and drifted from the outcome
  counters. Now derived as `betsTeamA + betsTeamB + tieBets`; three live records
  backfilled.
- Tie-odds display formula (`totalBets / (tieBets || 1) * 100 - 100`) returned
  `-100` or `150`. Deleted; replaced with pool share.
- Storefront copy, contact email, contact phone **list**, and bank account moved
  to Firestore (`appConfig/storefront`, `appConfig/checkoutSuccess`) with an admin
  editor at `/admin/config`. No redeploy needed for copy changes.
- Empate given a distinct yellow badge in the admin sale card.
- Winner display added to bet list card and bet detail (reads `settled` /
  `result` / `payoutPerTicket` from `settleBet`). **Not yet observed against a
  settled bet** — needs one real settlement to verify.
- Custom 404 page (`app/not-found.tsx`).
- **Item 1 (2026-10-24)**: `createBet` no longer writes `oddsTie: undefined`;
the key is omitted entirely when empty (`functions/src/index.ts`). Verified
with `cd functions && npx tsc --noEmit` (clean).
- `/user/purchases`: per-purchase "Ver detalles" toggle + "Reportar problema"
  link to a new informational `/soporte` page (no support backend exists yet).
- `/admin/edit/bet`: fixed render crash from non-tuple `teams`, and a missing
  `setIsLoadingBet(false)` that left the page stuck on the loader forever.
