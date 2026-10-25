# Backlog — new-raffles-app

> **Deferred from the client-login task (2026-10-25)** — for Daniel to decide:
> 1. Deploy: `getMyPurchases`, `sendTestPush` and the `enabled` token filters
>    are committed but NOT deployed; also the first Firestore rules deploy
>    (rules:90-93) if not yet live — client-side settings writes depend on them.
> 2. Legacy device association is client-side only (localStorage
>    "purchases" groups). Server-side association for pre-login sales
>    (userId:null docs) needs a data model decision (e.g. backfill by phone/email).
>    **DONE 2026-10-25**: backfill run with approval — 2 salesBets matched by
>    email (0 unmatched), evidence recorded on each doc
>    (`backfill: {by:'email', matchedTo, at}`); anonymous purchase path verified
>    unchanged. See `ufc-mission/backfill-2026-10-25.md`.
> 3. In-app notifications feed (`notifications/*` docs written by settleBet)
>    has no client reader yet; Notificaciones page currently covers push settings only.
> 4. `NEXT_PUBLIC_ENABLE_MOCK_AUTH=1` exists for local screenshots only
>    (scripts/client-shots.mjs); production builds must never set it.
Ordered by what blocks real money and nightly operations first, then UX.
Maintained during the UFC 333 event test (2026-10-24). Read this before starting
any admin-side work; most items below came from live-testing failures, not
speculation.

Legend: **P0** money/data correctness · **P1** operational risk · **P2** UX · **P3** nice to have

---

## Done (this session)
- **Done 2026-10-25 (backlog 19, Notificaciones copy + two stop options)**:
  Rewrote `app/user/notificaciones/page.tsx` client copy in short plain Spanish
  (no dev jargon: no "token FCM", "reglas de Firestore"). Two distinct stop
  options, both working signed-in and each stating what it does:
  (a) **Pausar en este dispositivo** — keeps the roster doc
  (`notificationTokens/{uid}`), sets `enabled:false`; all bulk send paths in
  `functions/src/index.ts` skip tokens with `enabled === false` (verified at
  all four multicast sites: sendPurchaseNotifications, createSale,
  transferSale, settlement). A **Reactivar** button restores delivery.
  (b) **Dejar de recibir notificaciones** — deletes the roster doc
  client-side with `deleteDoc` (simplest correct path: firestore.rules
  `notificationTokens` write rule allows the owner delete,
  `tokenId == request.auth.uid`); clears the localStorage token cache and
  resets state, so the "Activar notificaciones" button offers clean
  re-registration. Behind a confirm dialog ("¿Detener por completo?", danger
  buttons, "no se puede deshacer") per ui-standard-2026-10-25.
  Evidence: `npx tsc --noEmit` + `npm run build` clean; headless-Chrome
  captures `ufc-mission/notificaciones-19-unregistered-390.png` and
  `notificaciones-19-stop-confirm-390.png` (real dialog render, verified).
- **Done 2026-10-25 (backlog 20, sendTestPush diagnosis)**:
  Diagnosis: the token WAS registered and the FCM send path is healthy.
  Live Firestore read (Firebase CLI ADC credential): roster has 10 docs; the
  current-registration docs (`eQg3NpHRtwX7CPYnp21IXQRbcYV2`,
  `rmjwwrxVv8NeMAL5GRY3020aPrM2` — same physical device/browser, two
  accounts) each hold FCM token `fhpQY_RQRoQHL2cCKlb-TG:APA91bF…`, updated
  2026-10-25 17:55/18:07 UTC. Sender ID matches the project
  (messagingSenderId 630899937485 == projectNumber, verified via Firebase
  projects API). Reproduction: a direct FCM v1 send to the real registered
  token returned SUCCESS verbatim:
  `{"name":"projects/raffleapp-dbc1b/messages/e8b7d7c8-5c51-4a6c-afc4-2be02583b615"}`.
  Function logs show Daniel's earlier test calls (17:18 UTC) hit sendTestPush
  BEFORE any token doc existed under his uid (first registration 17:55 UTC)
  → the function 404s "device not registered" — that was the drop: he pressed
  "Enviar prueba" before his phone finished registering. Fixes so his next
  visit just works:
  1. `public/manifest.json` added (name, short_name, icons, standalone,
     gcm_sender_id 630899937485) + `manifest: "/manifest.json"` in
     `app/layout.tsx` — iOS PWA web-push requires a manifest (prior silent
     drop risk when added to home screen).
  2. `sendTestPush` now surfaces the FCM-level error (`fcmError.code/message`)
     on failure instead of a generic 500.
  3. New `summarizeAndPruneMulticast` helper: every bulk send logs
     sent/failed/unregistered/invalid counts and prunes UNREGISTERED tokens
     by deleting their roster docs, so dead registrations stop being retried
     and clients re-register naturally. Bulk sends already respected
     `enabled !== false` (verified, unchanged).
  **Daniel's action on his phone**: open the site, sign in, tap "Activar
  notificaciones", then "Enviar prueba" — the roster already holds a valid
  token and FCM accepts sends to it, so the test should arrive (for iOS he
  must have added the site to the home screen as a PWA for background push;
  foreground notifications show without it). If the test still fails, the
  failure reason is now visible in the response/logs (fcmError).
  Evidence: FCM send response above; `firebase functions:log --only
  sendTestPush`; `npx tsc --noEmit` + `npm run build` clean (app +
  functions). NOT deployed — deploy waits for Daniel.
- **Done 2026-10-25 (client login + client sidebar: Mis compras / Notificaciones, Model A identity)**:
  Added Firebase Auth email/password login + registration for customers at
  `/login` (Spanish UX, UI-standard card/forms, friendly Firebase error
  messages). `app/components/clientAuth.ts` exposes `useClientAuth`, sign-in /
  register / logout helpers and `userApiFetch` (client endpoints, Bearer ID
  token — any signed-in user, NOT admin-only). Client menu (`HamburgerMenu`)
  now carries "Mis compras" (`/user/my-purchases`), "Notificaciones"
  (`/user/notificaciones`), plus login state: anonymous visitors see "Iniciar
  sesión", signed-in clients see their account name/email + "Cerrar sesión".
  Anonymous browsing still works everywhere.
  Purchases → clients: `createTransferSale` already records the Bearer token's
  uid as `userId` on `sales`/`salesBets`; checkout already sends that token
  when a customer is signed in. New user-gated Cloud Function `getMyPurchases`
  returns the caller's own docs (`userId == auth.uid`); the page merges the
  legacy localStorage "purchases" groups as the device-association fallback for
  pre-login purchases (marked "Compra sin cuenta"). Status badges: Pendiente /
  Confirmada / Ganada (+payout) / Perdida / reembolso, grouped per sale doc,
  newest first, ApiErrorState on failure.
  Notifications: fixed the WithAuth token-registration short-circuit (it used
  to return early on a cached localStorage token and never re-register, and
  wrote `userId:"daniel"` hardcoded). Registration now ALWAYS fetches the FCM
  token and writes `notificationTokens/{uid}` under the SIGNED-IN user's uid
  (matching firestore.rules:90-93 `tokenId == request.auth.uid`); anonymous
  visitors cache locally and register on first sign-in. `/user/notificaciones`
  manages the identity roster: device label, enable/disable toggle persisted on
  the same doc, explicit permission request button, and an "Enviar prueba"
  button behind the new user-gated `sendTestPush` Cloud Function (verifies the
  caller's ID token, sends FCM ONLY to `notificationTokens/{callerUid}` — never
  public, never cross-device). All three bulk notification paths now skip
  tokens with `enabled === false`. Admin auth path untouched.
  New functions are NOT deployed — deploy waits for Daniel.
  Evidence: `npx tsc --noEmit` clean (app + functions), `npm run build` clean,
  headless-Chrome renders against the mock (mock routes `getMyPurchases` /
  `sendTestPush` added): `ufc-mission/client-sidebar-*.png`,
  `client-login.png`, `client-compras-populated.png` (all badge states),
  `client-compras-empty.png`, `client-notificaciones.png`; no horizontal
  overflow at 390px or 1440px.
- **Done 2026-10-25 (admin settlement + nav UI/UX alignment, per-buyer grouping)**:
  Wrote down the app's actual UI standard first (`ufc-mission/ui-standard-2026-10-25.md`:
  tokens from `tailwind.config.ts`, radius ladder, card/button/badge patterns,
  loading/empty/error states, Spanish copy tone), then aligned `/admin/settlement`:
  no new one-off styles; replaced off-token classes in SettlementReview
  (`bg-gray-*` → ink ramp, `border-ink-200` → `border-ink-300`, `bg-danger-100` →
  `bg-danger-50`, back button to the standard secondary `rounded-sm bg-ink-100`).
  Payout list is now GROUPED per buyer: same buyer holding several sale documents
  (grouped by email → phone → name) renders as one buyer group with a header
  carrying contact, sale count, total tickets, pick summary and the per-buyer
  projected payout (winner/refund), with each sale listed beneath it (sale id,
  tickets, picks, payout). Admin nav (`app/admin/layout.tsx`) reorganised into
  labelled Spanish sections — Inicio / Ventas/Compras / Apuestas y rifas /
  Liquidación / Ajustes — mapping every admin route (incl. quickTickets and the
  create/edit pages, previously absent from the nav). Token fixes riding along:
  added `danger-800` to the tailwind ramp so the existing `hover:bg-danger-800`
  on both Liquidar buttons actually does something (it was a silent no-op), and
  fixed the same broken-token classes in `admin/bets`' SettleBetModal and the
  shared `ApiErrorState` (default `red-*`/`gray-*` → danger/ink tokens).
  Dev-only test seam: SettlementReview accepts an optional `sales` prop so the
  local screenshot harness can render it without Firebase auth (production
  callers unchanged). NOTE for the backlog: sales vs salesBets near-duplicate
  pages were NOT merged (kept separate routes as instructed) — candidate for a
  future consolidation; also `/admin/config` and the `admin/edit|create/*` forms
  still use stock `gray-*`/`blue-*`/`yellow-*` classes instead of tokens
  (untouched here, follow-up).
  Evidence: `npx tsc --noEmit` clean; `npm run build` clean (settlement 7.41 kB);
  headless-Chrome renders against the local mock (with a second same-buyer sale
  added to `mock/server.mjs` fixtures) with zero overflow at 1440px and 390px:
  `ufc-mission/before-settlement-review-flat-1440.png` (before: flat table, Ana
  Prueba split into two rows) / `...-flat-390.png`,
  `ufc-mission/after-settlement-review-grouped-1440.png` (after: 3 compradores ·
  4 ventas, Ana grouped 6 boletos) / `...-grouped-390.png`,
  `ufc-mission/after-settlement-review-outcome-selected.png` (Gana A: buyer
  totals $585 = $98 × 6, per-sale $390 + $195); the sectioned admin nav is
  visible at the top of the before/after pairs.
- **Done 2026-10-25 (admin settlement review + confirm screen)**: new admin page
  `/admin/settlement` (WithAuth-guarded, linked from the shared admin nav as
  "Liquidación"). Bet selector lists all bets (open/finished, unsettled first);
  the review view computes payouts CLIENT-SIDE from verified `salesBets` docs
  mirroring settleBet's maths (pool = tickets × price; take 10% default;
  per-ticket = floor(distributable / winners); refund-all on VOID/zero winners),
  shows per-sale buyer name/email, tickets, pick, projected payout or $0, pool
  total, take, and per-ticket rate. Winner-pick control (A / B / Empate / VOID)
  matches settleBet's `result` param. The ONLY path to settleBet is one explicit
  "Liquidar" button with the projected winner total on it, gated by a confirm
  checkbox; nothing settles on navigation/auto/timers. After settle, the full
  settleBet response (incl. `notificationsQueued`) is shown. Finding:
  settleBet does NOT support skipping notifications — no "liquidar sin
  notificaciones" checkbox was added (would require a param change in
  functions/src/index.ts); recorded as backlog follow-up (see 13b note).
  Evidence: `npx tsc --noEmit` clean; `npm run build` clean with the new route
  (7.08 kB); screenshots rendered against the local mock
  (`screenshots/admin-settlement-review-fixture.png`,
  `screenshots/admin-settlement-confirm-gate-fixture.png`).
- **Done 2026-10-25 (finding, /bet list winner badge)**: the `/bet` list page shows
  NO winner badge on settled bet cards (Volkanovski/Pico cards show only "REPARTO
  ACTUAL"); the RESULTADO OFICIAL banner appears only on `/bet/[id]` detail.
  Evidence: `ufc-mission/settlement-verification-2026-10-25.md` and screenshots
  `evidence-banner-pico-45.jpg` / `evidence-banner-volkanovski-83.jpg`. Also noted:
  Kavanagh card shows "Apuesta Finalizada" (`isFinished`) without ever being settled
  — follow-up.
- **Done 2026-10-25 (backlog 13b, admin settle control)**: `/admin/bets` now has a
  per-bet "Liquidar" button (hidden behind a "✓ Liquidada" badge once `settled === true`)
  opening a settlement modal: A/B/Empate/VOID choice, per-ticket payout preview with an
  explicit estimate disclaimer (10% take, live RTDB counters; official maths stays in
  `settleBet`), checkbox confirm, "Procesando…" submit, persistent error banner, and
  clear "already settled" idempotency message. Calls `settleBet` via `authedApiFetch`
  (Firebase ID token with admin claim). No settlement was executed. Evidence:
  `app/admin/bets/page.tsx`, `npx tsc --noEmit` clean at repo root.
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

## P2 — client UX (reported by Daniel, 2026-10-25 11:58 — PARKED)

### 18. Client side menu: placement + missing sections
The hamburger/side menu looks wrong — it should overlay at the very top of
everything (full-height drawer above all content), and it is missing whole
sections: bets, quick bets (boletos rápidos), and raffles should be reachable
from the menu alongside Mis compras / Notificaciones.

### 19. Notificaciones page: simplify copy + two stop options
**DONE 2026-10-25** — see Done below.

### 20. sendTestPush not arriving on phone
**DONE 2026-10-25** — see Done below.

### 21. Merge "Editar Apuesta" into "Administrar apuesta" (Daniel, 12:11)
Keep one admin bets tab ("Administrar apuesta") that carries both functions —
editing the bet (dates, teams, status) and the settle control. Remove the
separate "Editar Apuesta" dashboard entry and fold /admin/edit/bet in
(redirect or absorb it); the `/admin/bets` page already contains an
"Editar Apuesta" section — build the unified tab on that. Update the
dashboard group and admin nav accordingly.

---

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

**DECISION RATIFIED 2026-10-25 (Daniel, explicit go): ASSISTED settlement.** An
admin confirms the winner (sports data may pre-fill `result`); the system does
payouts and notifications. **Auto-settlement from sports APIs is REJECTED/deferred.**
Winner-notification batch messaging built 2026-10-25: `settleBet` now sends, after
a successful settle, one notification per buyer sale — winners get "🏆 ¡Ganaste!
$X" and losers a "bet settled" notice (refund for VOID/zero-winning-ticket),
including bet id, matchup/title, winner name, per-ticket payout and per-sale
ticket totals. Channels: FCM push to registered `notificationTokens` (same
channel as `sendPurchaseNotifications`) + in-app record per sale in the
`notifications` Firestore collection (doc id `${betId}__${saleId}`), which also
serves as the idempotency ledger — re-settlement returns early on `settled:true`
and existing records are never re-sent. Evidence: `functions/src/index.ts`
(`notifyBetSettlement`), tsc clean, deployed and verified 2026-10-25 on the
already-settled test bets (see `ufc-mission/settlement-verification-2026-10-25.md`).

### 13b. No settle control in the admin UI  [P0 — blocks settlement]
**Done 2026-10-25** — see the Done entry at the top of this file (settle modal on
`/admin/bets`; verification against production data is waiting on Daniel's go).
`settleBet` is deployed and does the pari-mutuel payout maths, but **nothing in
`/admin` calls it**. There is no button, no form, no link. Settlement is therefore
impossible without hand-crafting an authenticated request.

Verification progress (2026-10-25, static, no production data touched): payout
maths in `functions/src/payout.ts` + `settleBet` reviewed clean — integer
centavos throughout, pool = round(tickets × price), distributable floored after
take, per-ticket payout floored with breakage to organizer, refund-all on VOID or
zero winning tickets returns full stake (take not collected), counters recomputed
from persisted verified `salesBets` docs (not live RTDB counters), idempotency
via `settled === true`, and the admin modal's Empate maps to `"C"` matching
`settleBet`'s accepted results. End-to-end settle-control check and winner-banner
check remain gated on Daniel's explicit go (requires one real settlement).

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
**Update 2026-10-25 (Daniel approved):** the Instagram account EXISTS since
2026-10-24: handle **@bet.mx.ufc**, and one successful post was made during the
UFC mission. Posting tooling can assume the account is real. Remaining work is
the content generator/formatter only.
**Blocker note (still open):** the creative-director subagent failed on
2026-10-24 with an OpenRouter billing 403 (credits exhausted); the content pack
was built by hand as a result. Resolve provider credits before building a
pipeline on it.

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
