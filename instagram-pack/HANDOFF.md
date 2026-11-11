# HANDOFF — UFC Instagram content flow (@bet.mx.ufc)

Last updated: 2026-11-10. Owner: Daniel. Repo: `~/Projects/new-raffles-app`.

## Standing rules
- Never `git push`, never deploy, never touch production Firebase.
- Publish only from `@bet.mx.ufc` (never `@elfideomartinez`).
- Feed captions never mention bets. Bets are only mentioned in stories.
- Nothing goes live without Daniel's explicit approval on Telegram.

## What changed (2026-11-10)
1. **Fighter photos come from the UFC athlete page first.**
   - `scripts/fighters/ufc-photo.mjs` saves `athlete_bio_full_body` transparent PNGs as `fighters/<slug>/photo.png`.
   - `scripts/fighters/gather.mjs` runs it as step 3a.
   - Commons search is opt-in only (`--commons-fallback`). It caused the off-topic photos.
   - A non-UFC `photo.png` is a manual cutout and is never overwritten.
   - 58 fighters have cutouts. Two still need one: **Abdul-Rakhman Yakhyaev** and **Lone'er Kavanagh** (no full-body image on their page).
2. **Gather cron no longer auto-schedules.**
   - `~/.hermes/scripts/ufc-fighter-gather.sh` now runs `build-drafts.mjs --notify` (drafts + Telegram only).
   - Scheduling is manual, after approval (see below).
3. **New fight-week poster.**
   - Template: `scripts/instagram/templates/feed-fightweek.html`.
   - Builder: `scripts/instagram/build-fightweek.mjs` reads names and records from `profile.json`.
   - Example output: `instagram-pack/out/fightweek-ciryl-gane-josh-hokit/feed.jpg`.

## Approving and scheduling a draft
1. Telegram shows the draft and story image (Rustmonkeybot, chat 5262019985).
2. Daniel approves in chat.
3. Run: `node scripts/instagram/build-drafts.mjs --event="<event name>" --schedule`
   - The draft manifest prevents double-scheduling.
   - Credentials: `~/.hermes/scripts/.antwork.env` (chmod 600).

## Open issues
- **Cron branch guard:** the gather cron only runs on `design/ratified-decisions`. The repo is currently on `feat/live-price-knobs`, so the cron will exit silently until the branch is switched or the guard is changed.
- **Uncommitted work:** `ufc-photo.mjs`, the `gather.mjs` changes, `build-fightweek.mjs`, and `feed-fightweek.html` are not committed. The cron's commit step stages `fighters/` and `public/bet-cards/` only.
- **Not yet run end to end:** a live gather with the new photo step, and the cron after the schedule change.
- **TokCloner:** `TOKCLONER_API_KEY` is not set. The tool clones carousels, not single posters.
- **Instagram posting:** the `insta-content-engine` skill's `instagrapi` posting logs in with an account password. The repo rule is Antwork-only, so don't use it.
- **Fight-week poster layout:** the gap between the fighters and the info block is loose (vision review).

## Next steps
1. Switch the repo to `design/ratified-decisions` (or change the cron guard), then run one gather and check Telegram.
2. Supply cutouts for the two fighters above.
3. Commit the photo and poster changes on their own commit, prefixed `fighters:` or `instagram:`.
4. ~~Tighten the fight-week poster spacing.~~ Done 2026-11-10: the headline-to-fighters gap was the only loose band (~45px). Fighter boxes are now 676px tall, matchup starts 18px higher, and the info/footer gaps are 22px/16px. Re-rendered `out/fightweek-ciryl-gane-josh-hokit/feed.jpg` with no text overflow (uncommitted, like the rest of the poster work).
