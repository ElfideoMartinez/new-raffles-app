# fighters/ — fighter profiles for content generation

One folder per fighter, created as they come to us (never mass-imported).
Each folder feeds `scripts/instagram/generate.mjs` so hype/history cards can be
regenerated without re-researching.

## Layout

```
fighters/<slug>/
  profile.json    required — the facts + stats + short history
  photo.jpg       optional — official/press image, ≤2 MB (jpg/jpeg)
  sources.md      recommended — where each fact came from (URL + date)
```

`profile.json` schema:

```jsonc
{
  "slug": "alexander-volkanovski",
  "name": "Alexander Volkanovski",
  "nickname": "The Great",
  "initials": "AV",                  // used when photo.jpg is absent
  "country": "Australia",
  "division": "Pluma",
  "record": { "wins": 26, "losses": 4, "draws": 0 },
  "stats": [ { "label": "KOs", "value": "13" }, { "label": "UFC", "value": "2019" } ],
  "facts": [
    "Excampeón pluma, 5 defensas titulares",
    "Peleó en tres divisiones"
  ],
  "previousFights": [
    { "date": "2024-10-26", "opponent": "Max Holloway", "result": "U-DEC", "event": "UFC 308" }
  ],
  "sources": [{"url": "https://...", "checked": "2026-10-25"}]
}
```

## Rules
- Facts only from verifiable sources; list them in `sourceUrls`. No invented stats.
- Images: keep the source URL in `image_source`; only files we may reuse (press/CC).
- Never overwrite a card's facts to make a nicer graphic.

## Photo integrity

The gatherer uses `scripts/fighters/photo.mjs` (macOS `sips` required). It checks
HTTP status, MIME type, JPEG/PNG signatures and end markers, then fully decodes
the pixels before conversion and again after metadata removal. Photos are JPEG,
at most 1200px on their longest edge and ≤2 MB. New files are staged and only
renamed over the saved photo once validation succeeds; conversion failures are
not accepted as successful downloads. Exact download URLs are recorded in new
`profile.photo.download_url` entries, alongside the Commons attribution page.

JPEG DHT/Huffman tables are coding data, **not metadata**. Never remove them.
Reading dimensions alone (`sips -g`) or a browser's permissive `Image.decode()`
can miss this corruption. Regression checks: `node --test scripts/fighters/photo.test.mjs`.

The admin roster embeds these files at build time. Local photo repairs do not
update a previously deployed build; that requires a separately authorized deploy.
