# Dependabot vulnerability remediation handoff

> Handed off: 2026-11-17. Source of truth: GitHub Dependabot alerts on
> `ElfideoMartinez/new-raffles-app` (default branch `main`), plus local `npm audit`.

## Repo / environment facts (read first)

- Repo: `~/Projects/new-raffles-app`, single `main` branch. Push now works:
  token is a classic PAT (`ghp_`…) read from `~/.hermes/scripts/.github-token.env`
  (`GITHUB_TOKEN`), scopes include `repo` + `workflow`. Push pattern that works:
  ```
  set -a; . ~/.hermes/scripts/.github-token.env; set +a
  git -c credential.helper= -c credential.username=x-access-token \
      -c http.version=HTTP/1.1 push origin HEAD:main
  ```
  `http.postBuffer` is already raised to **500MB** (needed — one early 400/`RPC failed`
  came from the 162-commit pack; this fixed it). Do not reset it.
- Two lockfiles to keep in sync: **`package-lock.json`** (app) and
  **`functions/package-lock.json`** (Firebase functions). Both show alerts — most are
  the same transitive dependencies (node-forge, body-parser, etc.) in both trees.
- Runtime: local `node v20.19.1`; deploy engines must be **node 22**
  (Node 20 decommissioned 2026-10-31) — see `raffles-app`/UFC skill notes. When
  bumping anything, verify the repo's `engines`/deploy config still allows the run.
- **Do not** just `npm audit fix --force` and push: several flagged packages are
  transitives guarded by a `next` major pinned at `^14.2.17` (locked `14.2.22`), and a
  force-fix can drag breaking major bumps across the whole tree. Fix deliberately (below).
- Never commit unrelated uncommitted work (`app/`, `scripts/` WIP may be dirty); commit
  only the lockfiles/deps this task touches, on `main`, then push with the pattern above.

## Scale of the problem

GitHub report line at last push: **263 alerts** (14 critical, 108 high, 101 moderate,
40 low) across the two npm lockfiles.

Local `npm audit` (app, `--omit=dev`, ~top-level): **47 vulnerabilities**
(6 critical, 15 high, 23 moderate, 3 low).

## Highest-priority packages (critical first)

| Package | Locked ver | Issue | Where | Fix direction |
|---|---|---|---|---|
| **next** | 14.2.22 | 3 critical (GHSA-2464-fhr4-w9xw ≤15.5.27; GHSA-2xp9-vwfh-vxw4 <15.5.24; GHSA-p293-qw3h-jr36 <15.5.24) + high | app `package-lock.json` | **Need ≥14.2.x patched, ideally bump minor.** `^14.2.17` → `npm update next` picks latest 14.x patched; assess a 15.x major upgrade separately (breaking). |
| **protobufjs** | 7.4.0 | critical GHSA-xq3m-2v4x-88gg (≥7.0.0,<7.5.5) | app (transitive — likely via firebase/firebase-admin → @grpc/grpc-js) | bump transitives: `npm update` the chain, requires @grpc/grpc-js ≥ the version pulling protobufjs ≥7.5.5. |
| **proxy-addr** | (transitive) | critical GHSA-jqcg-44mw-7w3h (<2.0.8) | app | transitive (express/body-parser chain) — resolved by bumping body-parser/express. |
| **body-parser** | 1.20.3 | high GHSA-27r3-jxmh-p828 (<1.20.9) | app + functions | `npm update body-parser` in BOTH trees. |
| **node-forge** | 1.3.1 | 8 high + 7 medium + 6 low per tree, both lockfiles | app + functions | transitive (firebase-admin → @firebase/* ?). Requires upstream bump; see if `npm update node-forge` resolves or must come via firebase-admin. |
| **undici** | 6.19.7 | high/low (≥4.0.0,<6.29.1 etc.) | app | transitive; bump chain. |
| **@grpc/grpc-js** | 1.9.15 | high GHSA-m9gg-hp2v-232j (<1.13.6) | app | bump transitives. |
| **vite** | 5.4.15 | high GHSA-587h-7wmj-h5pm (≤6.4.3) | app (dev tooling) | likely dev-only tooling of next build; patched upstream. |
| **extract-zip**, **svgo**, **nanoid**, **browserslist**, **brace-expansion**, **source-map-js** | — | high | app | mostly transitive/build tooling; resolve by the same `npm update` pass. |

## Recommended procedure (deliberate, then verify)

1. On `main`, working tree clean for the touched files.
2. App tree: `npm update <pkg>` for the directly-fixable ones (body-parser, next
   within `^14.2.17`, and any with `fix available via npm audit fix` that is non-breaking).
   Then `npm audit --omit=dev` to see what remains; chase the remaining criticals by
   bumping the direct deps that pull them (esp. firebase / firebase-admin / express).
3. Functions tree: repeat inside `functions/` (`cd functions && npm update …`).
4. After each bump: **build/test first** (`npm run build`, existing tests —
   `node --test` the instagram scripts, verify the app start / mock server on 3001 if
   touched) — this is a live app repo; do not land a broken build.
5. Commit ONLY the changed `package*.json` + lockfiles (+ package.json engines if you
   must claim node 22) with a message like `deps: remediate dependabot alerts`.
   Do not sweep in unrelated dirty files.
6. Push with the working pattern above. Local HEAD history stays intact (no force).
7. Re-check: `curl` the dependabot alerts API again
   (`…/dependabot/alerts?state=open&per_page=100`) and the `npm audit` count; report
   new totals vs the 263 / 47 above. Expect several to remain (deepable-transitive,
   no upstream fix yet) — document the remaining ones with a "no fix / wait for
   upstream" tag rather than force-fixing.

## Live data snapshot (committed context)

`/tmp/dba.json` holds the last `dependabot/alerts?state=open&per_page=100` dump
(100 alerts: 5 critical / 39 high / 37 medium / 19 low, all npm). Note this is the
first page only — total is ~263; use pagination if you want the full set. The package
breakdown (name / manifest / severity counts) recovered from it is listed above.

## Guard rails

- Never `npm audit fix --force` on this repo without reviewing the breaking bumps.
- Keep both lockfiles symmetric where a package appears in both.
- Verify deploys still meet node 22 engines after upgrades.
- This is a PREVIEW/handoff only — nothing in this doc has been changed/excluded; no
  dependency was bumped or committed as part of writing it (worktree clean re: deps).
