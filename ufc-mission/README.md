# UFC Event Test — Mission Workspace

Persistent workspace for the end-to-end UFC event test of `${app}` (repo root one level up).

- State machine: see `state.json`. Update atomically after each milestone.
- Never store credentials/secrets here.
- Real-money actions require explicit user authorization; stop at that boundary and continue other work.
- Recovery: reload `state.json` + `checklist.md` + `action-log.jsonl`, reconcile with actual app/scheduler state, resume at first incomplete/unverified task.

## Files
`state.json` · `checklist.md` · `event-card.md` · `test-plan.md` · `schedule.json` · `action-log.jsonl` · `blockers.md` · `final-report.md`

## Local timezone
America/Chihuahua (CST, UTC-6)