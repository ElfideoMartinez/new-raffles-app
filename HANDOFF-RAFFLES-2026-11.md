# Rifas Mtz follow-up backlog & handoff

**Branch:** `main`
**Production site:** `https://rifasmtz.web.app`
**Firebase project:** `raffleapp-dbc1b`
**Current scope:** Local changes only; no commit, push, or production deploy. Protect unrelated fighter research data (modified under `fighters/` by the earlier gather) and do not stage/reset it.

## Cloud Functions deploy scope
The prior command was `firebase deploy --only hosting:rifasmtz`: Hosting/SSR only; it did not deploy local `functions/src/` code. That change had no Functions source edits but **did** update `functions/package.json` and lockfile for the UUID remediation, so “there were no Functions changes” was incomplete. Decide dependency-only deploy separately after checking runtime/package resolution and production inventory. Production includes Functions absent from this checkout; never bulk deploy all Functions.

## Backlog

### P0 — Admin create-bet URL
- **Evidence:** `app/admin/bets/page.tsx` previously prefixed its internal route with `process.env.NEXT_PUBLIC_BASE_URL`, producing live `/admin/undefined/admin/create/bet` (404). The route exists at `app/admin/create/bet/page.tsx`.
- **Change:** changed to same-origin `/admin/create/bet`.
- **Verify:** compile and browser test link/direct route. E2E pending.

### P1 — Header logo + all-caps brand
- **Evidence:** `/Logo_dark2.jpeg` returned 404 in production; `/icon.jpg` returned 200. Original intended artwork not confirmed.
- **Change:** `MainHeader.tsx` uses available `/icon.jpg` and renders/accessibility-labels “RIFAS MTZ”. This is a provisional asset substitution, since only the old image URL’s failure and icon’s availability were established.
- **Verify:** needs screenshot/branding approval; e2e pending.

### P1 — Create bet from event card discoverability
- **Evidence:** `/admin/create-from-card` exists and uses existing admin-guarded `createBet`, explicit row approval + final create button, but wasn’t linked from bets management/admin nav.
- **Change:** added “Crear desde cartelera” in the admin nav and `/admin/bets`; preserved create flow.
- **Verify:** compile, authenticated browser/e2e pending.

### P1 — UFC research feed scheduler — REPAIRED; manual feed stage rerun verified
- **Cause:** scheduler’s scheduled-post provenance fingerprint included raw fighter-profile file hashes. `checked`-date refreshes changed raw hashes despite unchanged published facts, caption, artwork and schedule; an existing scheduled post was marked `needsReview`, and scheduler returned `ok:false`. `prepare-week.py` also hid subprocess stdout on failure. Python/SSL environment was a separate known risk: Homebrew Python works with its cert bundle; default python.org Python had lacked CA setup.
- **Change:** scheduler fingerprint now canonicalizes semantic source-file facts and ignores volatile file hash/check timestamp metadata; genuine source facts still trigger review. Test added for those opposite cases. Preparation failure reports now include stdout.
- **Verification:** `node --test scripts/instagram/auto-schedule.test.mjs`: 16/16 pass. `python3 scripts/instagram/prepare-week.test.py` and Python compilation pass. `PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH" python3 scripts/instagram/prepare-week.py` exited 0. Antwork readback confirmed existing scheduled posts `bo1qxx8EpTKmVNJzncyh` (Nov 20 01:00Z) and `kg3Nj8hhdJx0yuzArsV4` (Nov 21 01:00Z) remain `scheduled` under expected account/workspace. Receipt `needsReview:false`; no duplicate scheduled posts.
- **Scope caveat:** this was the feed-preparation/scheduler stage, not a rerun of cron `9ee8cf7ee313` or the 22-fighter research/Telegram stage; that full scheduled job has not rerun. Don’t change `~/.hermes/scripts/ufc-weekly-research.sh`; an earlier attempt was explicitly blocked. Full weekly-health suite previously had 81/82 pass; one weekly-report expectation was stale (test expects Saturday 07:00 while code reports Friday/weekend-off).

### P2 — Cart bet image and purchase-history return link
- **Change:** optional `image` field added to persisted cart bets, populated from bet-detail data when adding. Cart renders a thumbnail or legacy-safe “Sin imagen” placeholder. “Mis compras” gets “Volver a apuestas” in loading and loaded states.
- **Verify:** typecheck passed; visual/E2E coverage pending.

### P2 — Dashboard section sales overview
- `app/admin/dashboard/page.tsx` has navigation only. Existing destinations: Rifas `/admin/sales`, Apuestas `/admin/salesBets`, Rápidas `/admin/quickTickets/active`.
- `getSales` (`GET /getSales`) is admin-guarded but reads every Firestore `sales` doc unbounded and returns potentially sensitive buyer info. Current transfer records include `raffles[]` lines, `totalRafflePrice`, `verified`, `createdAt`; legacy shapes vary.
- `getSalesBets` (`GET /getSalesBets`) is admin-guarded, returns latest 500 docs ordered by `createdAt desc`; docs can include `totalBetsPrice`, `verified`, `createdAt`, and `bets[]` lines.
- Rápidas has no trustworthy sales ledger in the checkout: the `quickTickets` RTDB nodes include ticket/status/winner data but no price, paid amount, or payment-confirmed marker. Counts can be described as generated tickets or status counts, not sales or revenue.
- **Recommendation:** use a read-only admin-claim aggregate endpoint for Rifas and Apuestas, with explicit period/legacy handling and scope, rather than fetching whole sale rows into the dashboard. Until then, any card must say Rifas = all available docs and Apuestas = latest 500. For Rápidas show ticket counts/status only. Confirm period and whether “sales” means payment-confirmed totals vs order totals before computing revenue.
- Status: metrics not implemented.

### P2 — Separate shop text/config sections
- **Change:** `/admin/config` sections now have bordered surface cards; save button uses theme token classes rather than inline color style.
- **Verify:** typecheck passed; visual widths and save/reload behavior pending.

### P1 — Apuestas / Rápidas security and consistency audit (confirmed issues; fixes pending)
- **High, rules/privacy:** `database.rules.json` permits any authenticated user to read the entire `quickTickets` collection (`auth != null`), and permits unauthenticated reads of individual tickets. Ticket records contain `activationCode`, symbols, winner state/level and claim state (`functions/src/index.ts` ticket creation shape). The public player creation endpoint returns the ticket ID, so public access to the entire ticket payload is sensitive. Restrict collection reads to admin custom claim and review what the player's per-ticket read must expose; test only in the RTDB emulator.
- **High, rules/write conflict:** rules deny client writes at both `quickTickets` and `$ticketId`. Nonetheless admin UI directly `update()`s status to `active` and `claimed`, while player page directly `set()`s `status: "finnished"` after scratching. These requests should be denied; UI must not imply success. Use an admin-guarded server endpoint for admin changes; provide a narrowly validated server-side player completion path without broadening rules.
- **High, Apuestas closure:** `settleBet` writes `settled: true` and `result` but not necessarily `isFinished`. Storefront `/bet` and `/bet/[id]` determine purchase eligibility using `isFinished` only, so settled bets can still appear open and be added to cart. Use settled/result as closed state; show winner/result and block selection on both routes. Regression case: settled=true, result populated, isFinished=false.
- **High, Apuestas RTDB rules:** admin bets screen subscribes directly to RTDB `bets` and updates bet records client-side, but checked-in `database.rules.json` has no grants for `bets`. These client reads/writes conflict with checked-in rules. Listener has no error callback; mutation promise is not awaited before optimistic state/toast. Route writes through guarded Function and visibly handle read/write errors. Verify actual intended policy in emulator.
- **Medium, unbounded records:** quick-ticket admin page reads whole `quickTickets` collection with `onValue(ref(...))`, which grows without bound. Add pagination/capped reads; ensure pending and winners use bounded queries as well. `getSalesBets` already caps at 500; `getSales` still reads every document.
- **Medium, tab/loading/accessibility:** quick-ticket admin page lacks loading/error states and an `onValue` error handler; tab buttons lack selected-state semantics and complete keyboard tab navigation; panel ID is static and not associated with selected tab. “Claimed” checkbox label is unassociated. Reuse `AdminTabs`/shared shell and provide retry/error states.
- Bets storefront `/bet` uses live ticket distribution rather than fixed odds (correct pari-mutuel pattern), conditional image, and ended-bet routes; current narrow-screen e2e verifies 320px layout. Admin bet management still needs a wider route-level audit after the settled-state and rules issues are addressed.

### P3 — “Follow us on X” (research only; do not implement)
- X official follow widget docs: https://docs.x.com/x-for-websites/follow-button/overview. Instagram materials cover profile/post embedding rather than equivalent standalone follow widget: https://help.instagram.com/620154495870484/ and https://developers.facebook.com/documentation/instagram-platform/embed-button/.
- Recommendation: plain accessible branded links to public profiles to avoid third-party script/privacy/performance cost; consider X widget only if native appearance is worth the dependency. Handles/design need confirmation.

## Remaining work
1. Finish Apuestas/Rápidas source and browser sweep; fix protected quick-ticket actions via a secure server path after testing against emulator/rules.
2. Decide dashboard metrics/period and implement aggregate-only API.
3. Add targeted E2E: internal admin link is exact relative URL; purchase-history back link visible; cart bet thumbnail including legacy cart; create-from-card nav; screenshot header/config; mobile quick-ticket tabs.
4. Run full pipeline in order: `npm run typecheck`, `npm run lint`, `npm run build`, then one serial `npm run test:e2e` (local mock only). Do not stage fighter files; no production deploy or push.
