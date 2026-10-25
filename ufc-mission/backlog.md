# Backlog — new-raffles-app

Ordered by what blocks real money and nightly operations first, then UX.
Maintained during the UFC 333 event test (2026-10-24). Read this before starting
any admin-side work; most items below came from live-testing failures, not
speculation.

Legend: **P0** money/data correctness · **P1** operational risk · **P2** UX · **P3** nice to have

---

## Done (this session)
- **Done 2026-10-25 (backlog 12.2, persistent admin navigation)**: new
  `app/admin/layout.tsx` renders a shared nav bar (Inicio, Ventas/Rifas,
  Ventas/Apuestas, Apuestas, Configuración) above every page in the `/admin`
  segment, with the current page highlighted; skipped on the login page
  (`/admin`). Pages no longer dead-end after one "Volver al inicio" link.
  Evidence: `npx tsc --noEmit` clean at repo root.
- **Done 2026-10-24 (backlog 12.1, merged /admin/sales + /admin/salesBets)**: new
  `app/components/AdminSalesListPage.tsx` owns the fetch/tabs/error/grid shell
  (auth-error handling preserved); both pages are thin wrappers reusing the
  card components' own types. Routes and links unchanged. Evidence: `npx tsc
  --noEmit` clean at repo root.
- **Done 2026-10-24 (backlog 7+8, folded into one pattern change)**: `BetSaleCard` confirm/reject now shows a persistent on-card error banner (role=alert, cleared on next attempt) on failure, and the loading button is labelled "Procesando…" alongside a compact `FadeLoader`. Evidence: `app/components/BetSaleCard.tsx`, `npx tsc --noEmit` clean.


### 6. Email optional on the sale form
**Done 2026-10-24** — sale form validates email only when non-empty; label now says "(opcional)". Confirmation copy confirmed WhatsApp-first (no email promise), no change needed there.

---

## P0 — correctness / money

### 1. `oddsTie` is written as `undefined`
**Fixed 2026-10-24** — see Done. Omitted the key entirely when empty in
`createBet`; no longer assigns `undefined`.

---

## P1 — operational risk

### 3. `sendPurchaseNotifications` is a public, unauthenticated push endpoint
**Fixed 2026-10-24** — see Done. Now requires admin auth via
`rejectUnlessAdmin` and logs an `adminWriteLog` entry on each send.

### 4. Seller/admin pages duplicate logic: `/admin/sales` vs `/admin/salesBets`
**Done 2026-10-24 (backlog 12.1)** — see Done. Both routes now render through a
shared `AdminSalesListPage` shell; routes/links unchanged.

### 5. No bet cutoff behaviour
**Fixed 2026-10-24** — see Done. `createTransferSale` rejects bet lines whose
event `date` has passed (409 "Esta apuesta ya cerró").

---

## P2 — admin UX / UI (audit scope, 2026-10-24)

### 12. Admin UX/UI audit
Focus ordered by impact:
1. Merge `/admin/sales` and `/admin/salesBets` (item 4).
2. Persistent admin navigation.
   **Done 2026-10-25 (backlog 12.2)** — shared `app/admin/layout.tsx` renders a
   nav bar above every /admin page (skipped on login) with active-page
   highlight; pages no longer dead-end.
3. Dashboard grouping.
   **Done 2026-10-25 (backlog 12.3)** — dashboard now groups buttons under
   Rifas / Apuestas / Boletos rápidos / Configuración headings in
   `app/admin/dashboard/page.tsx`.
4. `/admin/edit/bet` and `/admin/edit/raffle` both stall-then-jump: a single
   select acts as both picker and loader with no persistent selection.
   **Done 2026-10-25 (backlog 12.4)** — picker selects are now controlled
   (`value` bound to the loaded id, disabled while loading) in both edit
   pages, so the selection persists through the load instead of jumping
   back to the placeholder. Evidence: `npx tsc --noEmit` clean at repo root.
5. Buttons need loading + failure states as a consistent pattern (items 6, 7).

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

### 2. Pari-mutuel odds are a placeholder, not a price (done 2026-10-24)
Removed the unused odds inputs from admin forms: `admin/create/bet` no longer
shows Cuota Equipo A/B or Cuota Empate (kept the functional "¿Permitir empate?"
checkbox) and shows a pari-mutuel payout explanation instead; `admin/bets` edit
modal no longer shows or submits oddsTeamA/oddsTeamB; validation no longer
requires them. Commit `backlog(2)`.

- **Fixed 2026-10-24 (backlog 9)**: post-payment navigation returns the buyer
  to their origin route. Cart page saves its pathname in sessionStorage before
  linking to checkout; `/checkout/success` reads it, sanitizes it, clears it,
  and falls back to `/` if absent.
  Evidence: `app/user/cart/page.tsx`, `app/checkout/success/page.tsx`,
  `npx tsc --noEmit` clean.

Recorded so they are not re-reported:
- **Fixed 2026-10-24 (backlog 5)**: `createTransferSale` now enforces the bet
  cutoff server-side: if the bet's event `date` has passed, the line is rejected
  with 409 "Esta apuesta ya cerró" instead of trusting UI `isFinished`.
  Evidence: `functions/src/index.ts` (bet loop, ~:1328), `cd functions &&
  npx tsc --noEmit` clean.
- **Fixed 2026-10-24 (backlog 3)**: `sendPurchaseNotifications` now requires admin auth via `rejectUnlessAdmin` (401/403, CORS preflight handled) and appends an `adminWriteLog` entry. Evidence: `functions/src/index.ts` (~:160), `cd functions && npx tsc --noEmit` clean.

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
