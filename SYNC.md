# Sync + regenerate the Instagram event ZIP (other session)

Standing context: everything is on the single `main` branch; the push is intentionally
paused (remote token is read-only for writes, so `push` 403s until you grant Contents: write —
that is expected and fine). The big build output (`instagram-pack/.automation/`,
`/instagram-pack/out/`, `/instagram-pack/posting-cards/`, `**/__pycache__/`) is gitignored.

## 1) Sync to the latest main

Run in a terminal, from the repo root:

```bash
cd /Users/danielmartinez/Projects/new-raffles-app

# Authorize with the token already on this machine (no re-paste needed)
set -a; . ~/.hermes/scripts/.github-token.env; set +a
cat > /tmp/gh-askpass.sh <<'EOF'
#!/bin/bash
echo "$GITHUB_TOKEN"
EOF
chmod 700 /tmp/gh-askpass.sh
export GIT_ASKPASS=/tmp/gh-askpass.sh GIT_TERMINAL_PROMPT=0

# Fetch + fast-forward to the latest main
git -c credential.helper= fetch origin
git checkout main
git merge --ff-only origin/main

# Confirm you're on the fighters-data commit
git log --oneline -1          # expect: 57a80ab fighters: commit gather-profile data...
git branch --show-current     # expect: main
```

**If `git checkout main` errors with "Your local changes would be overwritten," stop** —
that session's worktree has uncommitted files it wants to keep. Preserve them before switching
(e.g. `git stash`), then switch and re-apply.

## 2) Regenerate + send the event ZIP

Find the existing report manifest dir (globbed path), then rebuild the event pack and send it:

```bash
# Find the report manifest
ls -d instagram-pack/.automation/weekly-reports/ufc-fight-night-prochazka-vs-stirling-2026-11-21/2026-11-16/*/

# Rebuild event pack from the report manifest
node scripts/instagram/posting-cards.mjs \
  instagram-pack/.automation/weekly-reports/ufc-fight-night-prochazka-vs-stirling-2026-11-21/2026-11-16/<MANIFEST_DIR>/manifest.json

# Send the event zip to Telegram (verified against Telegram-returned bytes)
node scripts/instagram/handoff-telegram.mjs \
  instagram-pack/posting-cards/ufc-fight-night-prochazka-vs-stirling-2026-11-21.zip \
  'UFC Fight Night: Procházka vs. Stirling'
```

## 3) When ready to push (later)

Grant the fine-grained token **Contents: Read and write** on `ElfideoMartinez/new-raffles-app`
in GitHub, then from main:

```bash
set -a; . ~/.hermes/scripts/.github-token.env; set +a
git -c credential.helper= push origin HEAD:main
```
