#!/bin/bash
# ufc-fighter-gather — migrated off OpenClaw into the Hermes scheduler (2026-11-04).
# Script-only job: no LLM anywhere (that was the original rate-limit failure mode).
#
# Behaviour (unchanged contract):
#  - repo /Users/danielmartinez/Projects/new-raffles-app, branch main only
#  - auto-discovers the NEXT upcoming UFC event from the ESPN scoreboard (today..+90d)
#    and runs scripts/fighters/gather.mjs --date=<that date> --max=20 --any-license
#  - if any fighters/*/photo.jpg is NEW or CHANGED: commit fighters/ locally (never push /
#    deploy / touch Firebase) and send the report to Telegram directly via Bot API
#  - if nothing new: print nothing (silent watchdog path) and exit 0
#  - on script failure: send the error to Telegram and exit non-zero (Hermes records the error)
set -uo pipefail

REPO="${UFC_REPO:-/Users/danielmartinez/Projects/new-raffles-app}"
BRANCH=main
ENV_FILE="${UFC_TELEGRAM_ENV:-$HOME/.hermes/scripts/.ufc-telegram.env}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
# Auto-schedule needs the Antwork publish-scoped key; source it if present.
[ -f "$HOME/.hermes/scripts/.antwork.env" ] && . "$HOME/.hermes/scripts/.antwork.env"

# ---- telegram send (report + failure alerts go through the same bot as before) ----
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
tg() { # tg <text>  ->  send message, return curl status
  local text="$1"
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] || return 1
  python3 - "$TELEGRAM_BOT_TOKEN" "${TELEGRAM_CHAT_ID:-5262019985}" "$text" <<'PYEOF'
import json, sys, urllib.request
tok, chat, text = sys.argv[1], sys.argv[2], sys.argv[3]
req = urllib.request.Request(
    f"https://api.telegram.org/bot{tok}/sendMessage",
    data=json.dumps({"chat_id": chat, "text": text}).encode(),
    headers={"Content-Type": "application/json"})
print(urllib.request.urlopen(req, timeout=30).read().decode()[:200])
PYEOF
}

cd "$REPO" || { tg "UFC fighter gather FAILED: repo missing at $REPO"; echo "UFC fighter gather: repo missing at $REPO" >&2; exit 1; }

# Process any "Cancelar" button presses on Telegram (ig_cancel:<postId>) -> unschedule
# in Antwork. Runs every cycle (even when the gather is silent) so cancel is responsive.
if [ -f scripts/instagram/ig-cancel.mjs ]; then
  node scripts/instagram/ig-cancel.mjs || { echo "UFC cancel handler failed" >&2; exit 1; }
fi

cur=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
if [ "$cur" != "$BRANCH" ]; then
  echo "UFC fighter gather: wrong branch $cur (expected $BRANCH); refusing to write" >&2
  exit 1
fi

# Required stages fail visibly before doing network work.
for required in scripts/fighters/gather.mjs scripts/fighters/insights.mjs scripts/instagram/build-drafts.mjs; do
  [ -f "$required" ] || { echo "UFC pipeline missing required script: $required" >&2; exit 1; }
done
run_stage() {
  local stage="$1"; shift
  if "$@" >"$log" 2>&1; then
    cat "$log"
  else
    local rc=$?
    echo "UFC pipeline FAILED at $stage (exit $rc)" >&2
    cat "$log" >&2
    tg "UFC pipeline FAILED at $stage (exit $rc); see cron output." >/dev/null 2>&1 || true
    exit "$rc"
  fi
}

# ---- find the next upcoming UFC event (ESPN scoreboard, today..+90 days) ----
DATE_ARG=$(python3 - <<'PYEOF'
import json, urllib.request, datetime, sys
UA = {"User-Agent": "raffles-fighters-gatherer/1.0 (local research script; contact: repo owner)"}
today = datetime.date.today()
end = today + datetime.timedelta(days=90)
url = f"https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates={today:%Y%m%d}-{end:%Y%m%d}"
def get(u):
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30))
try:
    evs = sorted(get(url).get("events", []), key=lambda e: e.get("date", ""))
except Exception as e:
    print(f"ESPN scoreboard query failed: {e}", file=sys.stderr); sys.exit(1)
if not evs:
    print("No upcoming UFC event found within 90 days.", file=sys.stderr); sys.exit(1)
ev = evs[0]
utc_date = ev["date"][:10]
# Verify gather.mjs's own single-date query will return this event; try utc date then neighbours.
cands = [utc_date,
          (datetime.date.fromisoformat(utc_date) + datetime.timedelta(days=1)).isoformat(),
          (datetime.date.fromisoformat(utc_date) - datetime.timedelta(days=1)).isoformat()]
for cand in cands:
    try:
        found = get(f"https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates={cand.replace('-','')}")
    except Exception:
        continue
    if any(e.get("id") == ev.get("id") or e.get("date") == ev.get("date") for e in found.get("events", [])):
        print(cand); sys.exit(0)
print(f"could not confirm a single-date scoreboard hit for event {ev.get('name')} ({ev.get('date')})", file=sys.stderr)
sys.exit(1)
PYEOF
) || { msg="UFC fighter gather FAILED while finding the next UFC event (exit $?), $(date '+%Y-%m-%d %H:%M %Z')."; tg "$msg"; echo "$msg" >&2; exit 1; }

echo "Next UFC event date: $DATE_ARG" >&2

snap() { # slug<TAB>sha1 of every photo.jpg
  for f in fighters/*/photo.jpg; do
    [ -f "$f" ] || continue
    printf '%s\t%s\n' "$(basename "$(dirname "$f")")" "$(shasum "$f" | cut -d' ' -f1)"
  done | sort
}

before=$(snap)
log=$(mktemp "${TMPDIR:-$HOME/.hermes/cache/scratch}/ufc-gather.XXXXXX")
trap 'rm -f "$log"' EXIT
node scripts/fighters/gather.mjs --date="$DATE_ARG" --max=20 --any-license >"$log" 2>&1
rc=$?
if [ $rc -ne 0 ]; then
  report="UFC fighter gather FAILED (exit $rc) for $DATE_ARG, $(date '+%Y-%m-%d %H:%M %Z'). Last output:
$(tail -20 "$log")"
  rm -f "$log"
  tg "$report" >/dev/null 2>&1 || true
  echo "$report" >&2
  exit $rc
fi
rm -f "$log"
after=$(snap)
# Regenerate card relationship/insights data from the freshly gathered profiles
# (head-to-head, shared cards, first-fight detection). Local, no network.
run_stage insights node scripts/fighters/insights.mjs
rm -f "$log"
# Build the admin's "crear desde el card" payload (matchups + photos) into
# public/bet-cards/, render each matchup's VS bet-card image, and ping Telegram
# that the card is ready for approval.
# Non-fatal: a card-build failure must not fail the (already-successful) gather.
if [ -f scripts/fighters/build-bet-cards.mjs ]; then
  run_stage bet-cards node scripts/fighters/build-bet-cards.mjs --web --bet-images --notify
else
  echo "Optional bet-card builder absent; continuing Instagram preview pipeline."
fi
rm -f "$log"

today=$(date +%Y-%m-%d)
# Stage all of fighters/ (profiles + photos + insights) and commit only if anything
# actually changed — otherwise stay silent (watchdog path). Profiles/insights changes
# matter now (fight history accrues), not just new photos.
paths=(fighters/)
[ ! -d public/bet-cards/ ] || paths+=(public/bet-cards/)
git add -- "${paths[@]}" || { echo "UFC gather: git staging failed" >&2; exit 1; }
if git diff --cached --quiet -- "${paths[@]}"; then
  echo "UFC gather: no fighter changes; nothing new to preview."
  exit 0
fi
changed=$(comm -13 <(echo "$before") <(echo "$after") | cut -f1)
# Auto-draft the event's main-event content, auto-schedule the main feed (Daniel
# approved auto-schedule 2026-11-05; per-event dedupe via the draft manifest), and
# notify Telegram. Runs only when the gather actually changed fighters/. Non-fatal:
# draft/schedule/notify failures must not fail the (already-successful) gather.
event_name=$(node --input-type=module -e 'import fs from "node:fs"; console.log(JSON.parse(fs.readFileSync("fighters/_gather-report.json", "utf8")).event)')
run_stage instagram-preview node scripts/instagram/build-drafts.mjs "--event=$event_name" --notify
rm -f "$log"
git commit -q -m "fighters: gather run $today ($DATE_ARG)" -- "${paths[@]}" || { msg="UFC fighter gather: git commit failed"; tg "$msg"; echo "$msg" >&2; exit 1; }
sha=$(git rev-parse --short HEAD)

report=$(SHA="$sha" DATE_ARG="$DATE_ARG" node --input-type=module - "${changed:-}" <<'EOF'
import fs from "node:fs";
const changed = new Set((process.argv[2] || "").split("\n").filter(Boolean));
const rep = JSON.parse(fs.readFileSync("fighters/_gather-report.json", "utf8"));
const got = [], missing = [];
let roster = []; // current-event fighter dirs only
for (const d of fs.readdirSync("fighters", { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  let p = {}; try { p = JSON.parse(fs.readFileSync(`fighters/${d.name}/profile.json`, "utf8")); } catch {}
  if (rep.event && p._event?.name === rep.event) roster.push(d.name);
}
const scope = roster.length ? roster : null; // fall back to all dirs if _event missing
for (const d of fs.readdirSync("fighters", { withFileTypes: true })) {
  if (!d.isDirectory()) continue;
  if (scope && !scope.includes(d.name)) continue;
  let p = {}; try { p = JSON.parse(fs.readFileSync(`fighters/${d.name}/profile.json`, "utf8")); } catch {}
  const name = p.name || p.fullName || d.name;
  const lic = p.photo?.license || p.photoLicense || p.license || "license not recorded";
  if (changed.has(d.name)) got.push(`${name} (${lic})`);
  else if (!fs.existsSync(`fighters/${d.name}/photo.jpg`)) missing.push(name);
}
const evName = rep.event || "UFC";
const photoNote = got.length
  ? `\nNew/changed photos (${got.length}): ${got.join(", ")}.`
  : `\nNo new photos — but fighter profiles/insights were updated (records, shared cards, head-to-head).`;
console.log(`${evName} (${process.env.DATE_ARG}) fighter gather — committed locally as ${process.env.SHA} (no push/deploy).`);
console.log(photoNote);
console.log(missing.length ? `\nStill no photo (${missing.length}): ${missing.join(", ")}.` : "\nAll fighters have photos.");
EOF
)

# Deliver: Telegram first (that is the user-facing report), stdout for run history.
tg "$report" >/dev/null 2>&1 || { echo "UFC gather report delivery failed" >&2; exit 1; }
echo "$report"
exit 0
