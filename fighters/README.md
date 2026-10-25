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
