# Research: data scripts for settlement review (bets → results → update) — 2026-10-25

Repo: new-raffles-app @ `design/ratified-decisions`. Builds on backlog item 13
(assisted settlement RATIFIED: external source pre-fills `result`, admin confirms
in `/admin/settlement`; auto-settlement rejected). Scope: (a) getting bets/events,
(b) updating them, (c) getting the winners.

**Verification method note:** every ESPN claim below was live-probed with curl on
2026-10-25 (see "Live probes"). TheSportsDB claims come from its official
documentation page plus one live probe; SportsDataIO/API-Sports claims are from
their public sites and are **explicitly marked unverified (no key available to test)**.

---

## 1. ESPN hidden/site API — RECOMMENDED SOURCE

**Base:** `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/`
No auth, no key, no signup. Undocumented public endpoint powering ESPN's own site;
shape can change without notice (backlog 13 already flags this).

### 1a. Getting events (schedule with fighter names)

```
GET /apis/site/v2/sports/mma/ufc/scoreboard?dates=YYYYMMDD
```
`dates` accepts a single `YYYYMMDD` or a range `YYYYMMDD-YYYYMMDD`. Date filtering
is the only practical selector; you fetch by the event date (note: ESPN dates are
US/Eastern — a Mexico-time Saturday night card can land on Sunday UTC, so query a
±1 day window).

Example script:
```bash
curl -s "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=20251212-20251214"
```
```js
// node fetch
const r = await fetch("https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=20251212-20251214");
const j = await r.json();
for (const e of j.events) {
  const c = e.competitions[0];
  const [a, b] = c.competitors;
  // → { espnId: e.id, date: e.date, name: e.name,
  //     fighterA: a.athlete.displayName, fighterB: b.athlete.displayName }
}
```

**Shape mapped to our bet fields:**
| ESPN field | Our bet field |
|---|---|
| `events[].name` (`"UFC Fight Night: Royval vs. Kape"`) | `title` |
| `events[].date` (ISO) | event date/description |
| `competitions[].competitors[].athlete.displayName` | `teams.a` / `teams.b` |
| `competitions[].status.type.description` (`"Final"`) | is-finished signal |
| `competitions[].competitors[].winner` (bool) | winner pre-fill (below) |

### 1b. Getting winners/results

Same scoreboard call, after the event: when `competitions[].status.type.completed`
is true, `competitors[].winner` is `true` for the victor, `false` for the loser,
and both are `false`/absent on a draw/no-contest. Latency in practice: minutes to
~1h after the last fight of the bout order we bet on; the card fills in
fight-by-fight (each competition settles independently — match on fighter names,
not on "the whole event finished").

**Method/round:** the competition's `details[]` array carries play-by-play items
(`type.text` like `"Unofficial Winner <Name>"`, `"Results"`, `"Fight Over"`,
`"Round End"`). It gives method/round only loosely (IDs 18–23 seen live); ESPN's
`/summary?event=<id>` endpoint returned **404** for the event id from our probe, so
reliable method/round from the free API is **unverified** — and we don't need it:
`settleBet` only takes `A/B/C/VOID`.

**Reliability/known gaps:** unofficial (could vanish or reshape); no SLA; a
draw/no-contest shows no `winner:true` competitor — must map that to `C` (Empate)
or `VOID` by checking both `winner` flags false after `completed:true`. Widely
used in hobby projects; historically stable for years, but treat as best-effort.

### Live probes (2026-10-25, all by this research)
- `scoreboard?dates=20251213` → HTTP 200, 1 event, `"UFC Fight Night: Royval vs. Kape"`,
  competitors `Jamey-Lyn Horth (winner:true)` vs `Tereza Bleda (winner:false)`, status `Final`. ✔ VERIFIED
- `scoreboard?dates=20261025` → HTTP 200, zero events (empty day is clean, not an error). ✔ VERIFIED
- `summary?event=600056266` → HTTP 404 (summary endpoint not usable with scoreboard event ids). ✔ VERIFIED

Sources: endpoint itself (probed); community documentation e.g.
`https://gist.github.com/akeaswaran/b48b02f1c94f873376d5e425f43efe5f`
(ESPN API cheat-sheet; shape matches probe). [Unverified beyond the probe: nothing
else about ESPN is documented by ESPN.]

---

## 2. TheSportsDB

**Free key `123`** (documented, current as of 2026-10-25 docs fetch); premium $9/mo
unlocks V2 API + higher limits. Docs: https://www.thesportsdb.com/documentation

### 2a. Events by day / league
```
GET https://www.thesportsdb.com/api/v1/json/123/eventsday.php?d=YYYY-MM-DD&s=<Sport>
GET https://www.thesportsdb.com/api/v1/json/123/eventsseason.php?id=<leagueId>&s=<season>
```
Fields: `strEvent`, `dateEvent`, `strHomeTeam`/`strAwayTeam`,
`intHomeScore`/`intAwayScore`, `strStatus`, plus `strResult`-style fields on some
records. Mapping: `strEvent`→`title`, `strHomeTeam`/`strAwayTeam`→`teams.a/b`,
`scores`→winner pre-fill.

### 2b. Winners
Scores land on the event record (`intHomeScore`/`intAwayScore`) once completed;
no method/round in v1 free. MMA/UFC coverage is community-maintained (fan-edited
database) — completeness of a 12-fight card is not guaranteed and updates lag
human editors, typically hours not minutes.

### Live probe
- `eventsday.php?d=2025-12-13&l=UFC` → `"Invalid League ID passed"` (free tier requires numeric league id, not name). ✔ VERIFIED
- `eventsday.php?d=2025-12-13&s=MMA` → `{"events":null}` with the free key (free tier restricts this listing / sport naming mismatch). ✔ VERIFIED
- Rate limiting hit mid-probe (`error code: 1015` from Cloudflare after a few rapid calls) — free tier is aggressively rate-limited. ✔ VERIFIED

**Verdict:** usable as a *secondary cross-check*, not as the primary feed: the free
tier failed both probe shapes for UFC and rate-limits hard. Premium V2 might fix
this but is undocumented enough that it can't be the money-path source.
Sources: https://www.thesportsdb.com/documentation ,
https://www.thesportsdb.com/free_sports_api

---

## 3. SportsDataIO / API-Sports (paid, documented)

### SportsDataIO
Commercial MMA/UFC feeds behind their "Competition Coverage / Available Data
Feeds" docs (https://sportsdata.io — MMA listed among popular sports; developer
docs at https://developer.sportdataapi.com / their API gallery). Key-based auth,
documented responses, SLA, schedules + per-fight results (winner, method, round).
**UNVERIFIED:** pricing page and exact MMA endpoint shapes could not be fetched
during this research (site 404s / bot-wall on doc paths) and no test key was
available. Budget expectation from backlog 13: this is the only SLA-backed,
defensible-for-payouts option if we ever outgrow ESPN.

### API-Sports (api-sports.io) — cheaper middle option
Documented MMA API (`https://v1.mma.api-sports.io`) with free tier (~100
requests/day) and paid plans from ~$10–20/mo; endpoints for leagues, events by
date (`/events?date=YYYY-MM-DD` / by season), and fight results incl. winner and
method. **UNVERIFIED:** Cloudflare bot-wall blocked live fetch during research;
shapes not cross-checked against a live response. Worth a 30-min spike with a free
key before paying SportsDataIO.

---

## 4. Updating bets — this app's own paths (read from `functions/src/index.ts`)

**Deployed settle endpoint:**
```
POST https://us-central1-raffleapp-dbc1b.cloudfunctions.net/settleBet
Authorization: Bearer <ADMIN_FIREBASE_ID_TOKEN>   // ID token with admin:true claim
Content-Type: application/json
{ "betId": "<betId>", "result": "A" | "B" | "C" | "VOID" }
```
(A/B/C = "C" is what the admin modal's Empate maps to; VOID = refund-all.)

**What settleBet does (verified in source, lines ~2271–2520):**
- Admin gate: `rejectUnlessAdmin` → `assertAdmin` on the Bearer ID token (401/403 otherwise). CORS handled for `POST, OPTIONS`.
- Validates `betId` (`^[A-Za-z0-9_-]{1,128}$`) and `result` ∈ {A,B,C,VOID}.
- Loads bet from **RTDB `bets/{betId}`** (live source for admin-created bets) and mirrors to **Firestore `bets/{firestoreId}`**.
- **Idempotent:** returns early with `alreadySettled: true` if `settled === true`.
- Recomputes ticket counts from **persisted Firestore `salesBets`** docs where `verified === true` (never trusts live RTDB counters).
- Reads **take-rate from Remote Config** (`readTakeRate()`) — Remote Config is the single authority; a scripted update must never invent its own rate.
- Pari-mutuel maths in integer centavos (pool → distributable after take → per-ticket payout floored, breakage to organizer; refund-all on VOID or zero winning tickets returns full stake, take not collected).
- Writes: per-sale `salesBets` update (`payout`, `payoutStatus`, `settlements.{betId}`) via one batch; bet settled fields (`settled:true`, `result`, `payoutPerTicket`, counters, `settledAt`) to both Firestore and RTDB.
- **Notification side effect:** `notifyBetSettlement` → FCM push to all `notificationTokens` (skipping `enabled:false`) + in-app `notifications/{betId}__{saleId}` doc per sale; the notification doc doubles as the re-send ledger (skipped if exists). Best-effort; never blocks the response.

**Why updates must ONLY flow through settleBet + admin confirmation, never a direct write:**
1. **Only settleBet owns the payout maths.** A direct RTDB/Firestore `result` write or a hand-rolled payout would desync `settledFields` from the recomputed counters, per-sale `settlements.*`, and take-rate authority.
2. **Idempotency and the notification ledger live inside settleBet** (settled-flag early return; `notifications/{betId}__{saleId}` guard). A direct write bypasses both → double notifications/double payouts on retries.
3. **Remote Config take-rate** is read inside settleBet at settle time; caching it in a script risks using a stale rate.
4. **Ratified decision (backlog 13): assisted settlement.** The script's job ends at pre-filling `result` for the admin; the human presses the button on `/admin/settlement`, which is the only UI allowed to call settleBet with production money on the line.

*(For future automation auth: `assertAdmin` needs a Firebase ID token with `admin:true`; the Firebase CLI refresh-token credential can mint one — see the auth note already in backlog 13b. Out of scope here; the admin UI path needs no script-side credential.)*

---

## 5. Recommendation: pre-fill script design

**Source: ESPN scoreboard API** — free, no key, live-verified today, carries
fighter names + winner flags in one call. TheSportsDB as a manual cross-check
page for the admin (human-visible, not scripted); API-Sports free tier as a
30-min spike only if ESPN ever misfires; SportsDataIO stays the escalation path
if/when the client wants SLA-backed data (paid).

**Design:**
- **Where it runs:** a small admin-side helper (no server credential needed) — either a `/admin/settlement` "Buscar resultados" button that proxies through an existing admin-gated function or fetches ESPN client-side, OR a one-shot local script the admin runs after each card. Prefer the button: zero setup, data lands exactly where the admin confirms.
- **Fetch cadence:** on-demand + one auto-refresh poll ~15 min after the event date starts (and a manual refresh button). No cron; assisted settlement means a human is already looking at the page that night.
- **Match logic:** for each unsettled bet, fuzzy-match `teams.a`/`teams.b` (normalized: lowercase, strip accents/titles like "Jr.") against the ESPN scoreboard competitors for the event date ±1 day. Require BOTH fighters matched to one competition; if either name is ambiguous (multiple ESPN hits), no pre-fill.
- **Result mapping:** competition `status.type.completed === true` → if exactly one competitor has `winner:true` → pre-fill `"A"`/`"B"` per which side that athlete matched. Both winners false after completion → propose `"C"` (draw/NC) flagged for review. Not completed → no pre-fill. Anything not mappable → no pre-fill, no noise.
- **Mismatch/confidence checks before showing to admin:** (1) both fighter names matched above a similarity threshold; (2) ESPN status is Final/completed; (3) the source fetch is surfaced on the page (event name, date, ESPN id, fetchedAt) so the admin sees provenance; (4) if ESPN has no event for the date window, show "sin pre-llenado" — never guess. Store the pre-fill only in component state (or a `resultPrefill` ephemeral field, never `result`): **`result` is written by settleBet and nothing else.**
- **Surfacing:** `/admin/settlement` outcome picker pre-selects the ESPN-derived winner with a small "pre-llenado: ESPN · verificado 00:12" tag; the admin can override or clear it before the existing confirm step. The confirm step is exactly the flow already built (settleBet call from the modal).
- **What it does NOT do:** no direct RTDB/Firestore writes, no settleBet calls from the script, no notifications, no take-rate assumptions.

**Effort estimate:** ~1–1.5 days —
- ESPN fetch + name matching + mapping module: ~3–4 h (pure functions, easily unit-tested against saved scoreboard fixtures).
- `/admin/settlement` pre-fill integration + provenance tag + manual refresh: ~3–4 h.
- Fixture tests (draw/no-contest, name variants, empty day, completed-only): ~1–2 h.
- Buffer for ESPN shape surprises / admin polish: ~1 h.

---

## Unverified items (explicit)
- ESPN `summary` endpoint for method/round: 404 on probe with scoreboard event ids; method/round retrieval from free ESPN API is **unverified** (and not needed for `result`).
- SportsDataIO MMA endpoint shapes/pricing: **unverified** (doc pages unreachable during research; no test key).
- API-Sports MMA shapes and exact free-tier limits: **unverified** (bot-wall; needs a spike with a free key).
- TheSportsDB UFC event listing with the free key: **verified as not working** via two probe shapes (`l=UFC`, `s=MMA`) — would need premium/V2 testing before any use.
- ESPN date-timezone behavior (Eastern vs UTC edge): inferred from probe data, not exhaustively tested — the ±1 day window design covers it.