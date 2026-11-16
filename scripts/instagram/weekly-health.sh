#!/usr/bin/env bash
# Read-only health check for the current UFC preview pipeline.
set -euo pipefail
ROOT="${UFC_REPO:-/Users/danielmartinez/Projects/new-raffles-app}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
cd "$ROOT"
printf 'UFC Instagram weekly health check\n'
for file in scripts/fighters/cron.sh scripts/fighters/insights.mjs scripts/instagram/build-drafts.mjs scripts/instagram/generate.mjs scripts/instagram/templates/feed-vs.html scripts/instagram/templates/story-survey.html; do
  test -f "$file" || { printf 'ERROR: missing %s\n' "$file"; exit 1; }
done
bash -n scripts/fighters/cron.sh
node --check scripts/fighters/insights.mjs
node --check scripts/instagram/build-drafts.mjs
python3 scripts/fighters/cron-regression.test.py
printf 'OK: required scripts/templates present; syntax and offline regression tests passed.\nNo content published, scheduled, or changed.\n'
