# Handoff — UFC 333 mission + Instagram promotion

Date: 2026-10-23. Workspace: `/Users/danielmartinez/Projects/new-raffles-app/ufc-mission/`
App: `/Users/danielmartinez/Projects/new-raffles-app` (Next.js 14 + Firebase, project `raffleapp-dbc1b`).

Start a new session, register/open this folder as the project (the workspace is
already a folder inside the repo), and say: "Read ufc-mission/HANDOFF.md and
continue." Everything needed is in this file plus the workspace files.

---

## 1. Mission state (UFC 333 event test)

- Event: UFC 333 Volkanovski vs. Evloev, 2026-10-24. Chihuahua times: early
  prelims 08:00, prelims 10:00, main card 12:00 (see `event-card.md`).
- Status: `SCHEDULED` (`state.json`). 3 persistent automations already scheduled
  on the Gateway (delivery → Telegram 5262019985):
  - `ufc-mission-pre-event` — 2026-10-24 07:30 CST (readiness + mock tests)
  - `ufc-mission-monitoring` — 12:30 CST (mid-event, fight cutoffs)
  - `ufc-mission-completion` — 17:30 CST (verify complete, then schedule final report +2h)
- Test plan: `test-plan.md` (T01–T15 mock; R01/R02 real money = NOT authorized).
- Rules: mock data only, no real money, no test actions after a fight's verified
  start time. Real vs mock must be labeled in `final-report.md`.

## 2. Blockers found this session (verified against live API)

1. **`createTransferSale` is not deployed** — live endpoint 404. Source exists
   (`functions/src/index.ts:1164`, compiled `functions/lib/index.js` from
   2026-10-21). Blocks T07/T08/T12 via API.
2. **Realtime DB deactivated** — `raffleapp-dbc1b-default-rtdb` returns
   "has been deactivated"; `getAllBets` → 504. Bet coverage (T01/T03/T10) has no
   live data source. Fix: re-enable RTDB or migrate bets to Firestore, or run
   bet cases against `mock/server.mjs` and label them mock.
3. **Security: `getSalesBets` answers unauthenticated GET → 200 with 14
   `betSales` records incl. name/phone/email.** Fix before event day.
4. Working endpoints: `getAllRaffles` (2 raffles live), Firebase Auth,
   `getRemoteConfigValues`. `checkTransfer` is deployed but admin-only now.

## 3. Test account (created, verified)

- Firebase Auth REST `accounts:signUp` works for this project's web API key.
- Created: `ufc-test-1792801216865@example.com`, uid `XjFG5wIoBTYBxHUXysxTOYVuNOu1`.
- Password is NOT stored in the workspace (deliberately). If it must be reused,
  reset the password via Firebase console or just create a fresh account in the
  new session. No orders, uploads, or money were used with it.
- Note: the app has no customer signup UI — only `/admin` uses auth. Buyers are
  anonymous; the Bearer token on `createTransferSale` is optional identity.

## 4. Instagram promotion plan (separate workstream)

- Goal: promote the raffles page in pair with the event (posts/stories timed to
  the fight card).
- **Account creation via API is not possible** (Meta offers no signup API;
  automation violates ToS). Account must be created manually by Daniel.
- No Instagram/Meta credentials stored on the Gateway yet.
- Next session decision (pick one):
  a. **Business route:** convert account to Business, link a Facebook Page,
     create a Meta app, get an access token with `instagram_content_publish`;
     then posts/stories can be published via API.
  b. **Manual route:** assistant builds a content pack (captions ES, generated
     images, story variants, exact CST times) and posts go out manually.
- Paired schedule draft (see `plan-gap-assessment.md`): countdown story 07:30,
  card graphic at early prelims 08:00, "place your bets" post 10:00, main-card
  hype + poll story 12:00, results/winner template after the event.
- **Anything API MCP** (`https://anything.notte.cc/mcp`): verified reachable;
  function `8487d353-6cfe-416e-a14e-659c14924eee` ("Instagram Comments Scraper",
  takes `post_url`) confirmed via `spec`. `run` requires a Notte API key or
  OAuth sign-in → 401 until then. Read-only scraper; not part of publishing.

## 5. What Daniel needs to do

1. Start a new session with this repo/project selected (clean context).
2. Say: "Read `ufc-mission/HANDOFF.md` and continue."
3. Decide the bet-data fix: deploy functions / re-enable RTDB / use mock.
4. Decide Instagram route (Business + token, or manual content pack).
5. Optional: create the Instagram account manually if promoting.
6. Optional: provide a Notte API key (via secrets vault, not chat) to test the
   comment scraper.

## 6. File map

- `state.json` — mission state machine
- `test-plan.md` — T01–T15, R01/R02 gated
- `event-card.md` — verified card + times + sources
- `schedule.json` — automation job ids/times
- `blockers.md` — authorization record + live-API findings
- `plan-gap-assessment.md` — pairing map tests ↔ event timeline
- `action-log.jsonl` — A001–A011
- `HANDOFF.md` — this file
