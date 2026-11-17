# Weekly Instagram schedule proposal — @bet.mx.ufc

Status: implemented. Feed auto-scheduling is enabled with a minimum six-hour review/cancel window; stories remain manual.

## Active automation

- Fighter research: Monday/Wednesday/Friday 10:30 Chihuahua (`9ee8cf7ee313`), via `ufc-weekly-research.sh` → `scripts/fighters/weekly-gather.py`. Full card, official UFC PNGs first; no Git commits or app writes.
- Daily review pack: Sunday–Friday 12:15 Chihuahua (`d0214314bf1c`), via `ufc-daily-content.sh` → `weekly-content.mjs --notify`. Stories and due feed images go to Telegram with public-ready captions; sticker instructions arrive separately. The wrapper also prepares and schedules future Monday/Thursday feeds and Friday carousel with at least six hours to review/cancel.
- Saturday pack: 07:00 Chihuahua (`7098ba415005`) to precede this week's morning card. Event-specific posting times still require confirmation; this is a preparation time, not an Instagram publish time.
- Weekly read-only health check: Monday 09:00 (`00130d8c0b7d`).
- Today’s launch research: UFC Fight Night: Procházka vs. Stirling, 2026-11-21; 22 fighters, 22 official portraits, no gather failures. Exact user-supplied Procházka URL downloaded successfully.
- Today’s stories: Telegram messages 621/622, delivery verified against stored messages. Today’s feed: Antwork draft `PgEQGKo2d3x77cpLLROh`, status read back as draft. Review link sent separately (623). Since the 13:00 slot passed, stories can be posted this evening after approval; feed proposed for 19:00 if approved in time.

The content plan below describes publication targets. Daniel reviews scheduled feed posts and can cancel them in Antwork; stories and native stickers are posted manually.

## Feed scheduling — active

`prepare-week.py` runs after card gathering and from the daily wrapper. Monday/Thursday feeds and Friday19:00 full-card carousel are scheduled at least six hours ahead, with exact remote readback and Telegram edit/deschedule links. Thursday Nov19 post `bo1qxx8EpTKmVNJzncyh` and Friday Nov20 carousel `kg3Nj8hhdJx0yuzArsV4` were verified scheduled. Monday's elapsed slot was not backdated. Scheduled content changes flag review rather than replace automatically; canceled posts remain canceled. Cancel in the linked Antwork editor using Desprogramar; opening the link alone does not cancel. Stories and experimental copy stay manual.

- Feed auto-scheduling is authorized again for @bet.mx.ufc. Prepare Monday/Thursday posts and Friday full-card carousel at least six hours before their 19:00 Chihuahua publication slots; most of the week is prepared days ahead. Never catch up an elapsed slot by publishing immediately. Telegram must include review/cancel links. Stories with native stickers remain manual.
- Rotate at least one featured fighter from each of the top four ordered confirmed bouts across the week instead of repeating only the headliner. Use explicit segment metadata when available; do not infer a main-card label from bout order alone.
- Add Friday 19:00 full-card carousel (one post, multiple slides): complete fight list, verified date and known start times. Unknown main/prelim start times stay pending.
- Trivia question and answer both use portraits. Keep the answer/record off the question art/caption and reveal it on the answer frame.
- Humor/copywriter direction is a review test, not an automatically approved tone. See `copywriting-direction.md`.

## Variation and weekly visual report

- Rotate portrait matchup polls, two-fighter hype/emoji-slider stories, single-fighter spotlights, quizzes, question boxes, and countdowns only with a same-day verified source. Preserve clean sticker space; native stickers are not baked into JPGs.
- Matchup stories show both official portraits, full names and professional records directly in the artwork. Public-ready photo captions stay separate from review/sticker instructions.
- After a successful card gather, run `node scripts/instagram/weekly-report.mjs --event="<exact event name>" --notify`. It sends a three-page numbered visual report to Telegram: every story/feed slot, preparation and posting times, interaction, pending review/manual posting and full card. Unchanged plans are not resent; card/content changes produce a revised plan.
- Current full week: 20 stories + 3 feed posts = 23 numbered pieces; 22 fighters across 11 bouts. Elapsed slots are marked, not backdated. Pending results/times remain conditional.
Timezone: America/Chihuahua. Posting slots are hypotheses to test, not analytics-backed best times.

## Gather before content

Run fighter/content gathering Monday, Wednesday, and Friday at 10:30 AM Chihuahua, before the day's first content slot. The active jobs are listed above; use the cron tool to inspect or change them rather than editing this document alone.

- Monday: discover the next confirmed UFC event; gather the full card's fighter profiles, records, available fight history, event details, and official athlete portraits. Build sourced insights and prepare Monday–Tuesday content.
- Wednesday: refresh card changes, records, missing portraits, and sourced matchup insights. Prepare Wednesday–Thursday stories and Thursday's feed post.
- Friday: refresh the confirmed card and event times; gather verified weigh-in information if available (otherwise mark pending, never infer it). Prepare Friday–Saturday assets. Recheck late changes before manual publication.
- Sunday recap: verify actual results before writing recap stories. Do not assume the existing pre-event gather provides results.

### Preferred fighter-image sources

Use the fighter's official UFC athlete page to discover official full-body PNG cutouts from the `athlete_bio_full_body` image style, for example this exact user-supplied reference:

https://ufc.com/images/styles/athlete_bio_full_body/s3/2026-04/PROCHAZKA_JIRI_L_04-11.png?itok=kzDQfMFd

Discover each fighter's actual image URL; do not construct URLs by replacing names, dates, or query tokens. Confirm identity through the athlete/source page, not visual guessing. Save validated images as `fighters/<slug>/photo.png`, record the athlete page and exact image URL in provenance, and label them © UFC reference copies, not Creative Commons. Preserve supplied manual cutouts. If a source is blocked or absent, report the gap and use initials or a manually supplied, verified cutout; no automatic Commons fallback. Reference access is not proof of redistribution rights; check usage rights before publishing.

The repo already contains `scripts/fighters/ufc-photo.mjs`, called by the gather flow. Implementation should verify its source handling and missing-photo reporting against actual PNG/profile state, not only `photo.jpg` changes.

### Gather completion gate

Before rendering, report the event selected, fighter coverage, sourced facts available, missing/failed portraits, and unresolved schedule changes. Verify times and facts; never turn incomplete gathered history into a claim of a first meeting. Build drafts even if a refresh has no data changes when a new editorial slot is due; content cadence must not depend on a Git diff. Deduplicate by event + editorial slot, not event alone.

## Publishing cadence

| Day | Stories | Feed |
|---|---|---|
| Monday | 1 PM: 2 frames — next event + most-anticipated-fight poll | 7 PM: fight-week main-event poster |
| Tuesday | 7 PM: 3 frames — fighter spotlight, verified trivia question, answer | — |
| Wednesday | 7 PM: 3 frames — matchup comparison, winner poll, method question | — |
| Thursday | 1 PM: 2 frames — matchup teaser and predictions; reshare feed after publication | 7 PM: substantive matchup insight or comparison |
| Friday | 1 PM: 2 frames — confirmed event times + countdown; 7 PM: 2 frames — final picks + question box | 7 PM: full-card carousel (5 slides) |
| Saturday | 3–5 frames around actual event times — schedule, final poll, main-card reminder, verified reaction/result | Optional: one useful event-card post, not a duplicate poster |
| Sunday | 2 frames — verified recap + next-opponent poll | — |

Saturday slots follow the actual event, including morning cards. No-event weeks use evergreen fighter stories/trivia instead of false fight-week urgency.

## Review and delivery

- Gather → verify sources/images → render → Telegram review → Daniel approval.
- Feed: auto-scheduled in Antwork with review/deschedule links and minimum six-hour lead time; no betting language in feed copy.
- Stories: send ready images and numbered ideas to Telegram; Daniel publishes manually with native poll/countdown/question/link stickers.
- An optional Thursday/Friday app-test story uses honest test-only language; no promises of winnings or real-money claims.
- Feed auto-publication is authorized; native-sticker stories remain manual.

## Implementation acceptance criteria

1. Verify active Monday/Wednesday/Friday gather jobs and timezone; update existing jobs rather than create duplicates.
2. Exercise official UFC photo discovery and validation; preserve manual cutouts and report missing PNGs accurately.
3. Separate due content-slot creation from whether fighter files changed; support Monday and Thursday feed slots without event-level dedupe suppressing one.
4. Generate the proposed story packs and feed drafts with verified data; send previews for review, never publish unapproved content.
5. Test three event weeks and review story replies, poll participation, first-to-last-frame retention, feed saves/shares, and profile visits.
