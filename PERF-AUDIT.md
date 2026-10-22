# Performance audit backlog (queued 2026-10-22)

Scope: /Users/danielmartinez/Projects/new-raffles-app. Status: QUEUED — audit not yet run.
Run after SECURITY-AUDIT.md lands so the two audits don't touch the same checkout state.

Seed items (from the design audit, to verify during the perf audit):
- P1 `raffle/[id]/RafflePageClient.tsx:156` — raw `<img>`, no `next/image`, no width/height
  (CLS); blocked on Firestore `remotePatterns` config. Related: DESIGN-AUDIT F9.
- P2 Image handling app-wide: audit remaining raw `<img>`/PNG assets (see F36) for
  `next/image`, lazy loading, and srcset.
- P3 Firestore read patterns: check ticket grids / sales lists for N+1 reads and
  missing `limit()` / pagination.
- P4 Bundle size: audit client components importing heavy libs (spinners, toast) per route.
- P5 Font loading: Inter loaded in layout (F14 overlap) — check `display: swap` and preload.
- P6 Caching: `fetchRaffleData` uses `cache: "no-store"` on the hottest page — evaluate
  short revalidate window.
- P7 Measure first: Lighthouse/CWV baseline for storefront + raffle page before any fix.

Rules: measure before/after for any change; no behaviour change without Daniel's ok.
