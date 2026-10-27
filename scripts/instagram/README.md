# Instagram Content Generator — scripts/instagram/

Reproducible pipeline for backlog item 17: from a small JSON input, produce
ready-to-post Instagram assets at exact sizes plus the caption text.
Replaces the hand-built pack in `instagram-pack/graphics/` (which stays as the
reference look; CSS/typography only, no AI image generation needed).

- **feed.jpg** — 1080×1350 (4:5)
- **story.jpg** — 1080×1920 (9:16)
- **caption.txt** — caption + hashtags + first-comment suggestion
- **manifest.json** — metadata, verified dimensions, file sizes, Antwork media notes

### Per-fighter cards (fighter photo wiring, fixed 2026-10-26)

Set `fighter` in the input to a fighter slug and the generator wires everything
itself: it loads `fighters/<slug>/profile.json` (name, initials, stats, facts)
and embeds `fighters/<slug>/photo.jpg` as a data URI when the profile has a
photo (`photo.file`). No photo / `photo: null` -> initials fallback from the
profile. Explicit keys in an object-form `fighter` still win over the profile.

```jsonc
{ "slug": "fighter-merab-dvalishvili", "fighter": "merab-dvalishvili", ... }
```

You can also set `"fighter": { "slug": "…", "image": "fighters/<slug>/x.jpg" }
to override the photo file, or pass `photoDataUri` directly.

Examples: `instagram-pack/templates/fighter-card-merab.json` (renders the real
photo), `fighter-card-temirov.json` (photo: null -> initials fallback).

## Publishing constraints enforced

Per `ufc-mission/promotion-options.md` §7 (Antwork route, account
@bet.mx.ufc, id `gUi1o3IWQLG6ws6vHnYi`):

| Constraint | How it's enforced |
|---|---|
| Images must be .jpg/.jpeg | PNG screenshot converted with `sips -s format jpeg` |
| ≤ 8 MB | Verified after conversion; auto-recompresses (quality 90→50) if over |
| Exact dimensions | Re-read from the JPEG via `sips -g pixelWidth/-Height`; printed per run; non-matching runs exit 1 |
| No external network assets | Templates are pure CSS/typography; the renderer **blocks all http/https page requests** (logged if attempted) |

## Run

```sh
node scripts/instagram/generate.mjs scripts/instagram/examples/ufc333-bets.json
# output -> instagram-pack/out/ufc333-bets/
```

Requires: Node + `puppeteer-core` (already a repo dependency pattern — see
`scripts/viewport-shot.mjs`) and local Google Chrome
(`/Applications/Google Chrome.app`; override with `CHROME_PATH`).

## Input JSON schema

Top-level keys (`slug`, `brand`, `event`, `caption` required):

```jsonc
{
  "slug": "ufc333-bets",            // output folder name: instagram-pack/out/<slug>/
  "template": "event",              // reserved for future template families
  "locale": "es-MX",
  "feedTemplate": "optional custom feed template path (default templates/feed-event.html)",
  "storyTemplate": "optional custom story template path (default templates/story-event.html)",
  "brand": { "name", "handle", "url", "tagline" },
  "event": { "kicker", "title", "subtitle", "meta" },
  "highlights": [ { "label", "value" } ],   // rows in the feed card
  "banner": "short uppercase strapline",
  "body": "1–3 line supporting copy",
  "cta": "e.g. Link en la bio",
  "caption": {
    "text": "full caption (URL included in text — no @link-in-bio, per project rule)",
    "hashtags": "#UFC333 #RifasMtz …",
    "first_comment": "optional honesty/rules comment"
  },
  "story": { "headline", "sub", "lines": ["…"], "sticker_note": "manual-from-phone note" }
}
```

Templates are plain HTML with `{{dotted.path}}` tokens, `{{#each list}}…{{/each}}`
loops, and `{{this}}` inside loops. They must stay self-contained: no external
fonts, images, or network requests (the renderer blocks them and the run fails
if a blocked request is essential).

## Worked example (verified 2026-10-25)

```
$ node scripts/instagram/generate.mjs scripts/instagram/examples/ufc333-bets.json
Generated ufc333-bets -> instagram-pack/out/ufc333-bets
  feed.jpg:  1080x1350px (expected 1080x1350) [OK] · 0.25 MB [OK ≤8MB]
  story.jpg: 1080x1920px (expected 1080x1920) [OK] · 0.20 MB [OK ≤8MB]
  caption.txt + manifest.json written
```

Outputs: `instagram-pack/out/ufc333-bets/{feed.jpg, story.jpg, caption.txt, manifest.json}`.
Caption is the Slot 2 (tarjeta de peleas) hype variant from
`instagram-pack/captions.md`, with the real app URL in the caption text.

## What remains for a human

- Copy approval (Daniel) before any post.
- Publishing via Antwork: `add_media` (attach feed.jpg; story.jpg if using
  `publishType: story` — untested, otherwise post the story manually from the
  phone with countdown/poll stickers as before) → `create_post` → `schedule_post`.
- Stories are still posted manually from the phone per the project decision.