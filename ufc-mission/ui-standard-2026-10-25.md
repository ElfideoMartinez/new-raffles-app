# UI/UX standard — new-raffles-app (audit 2026-10-25)

Established by the `work/ui-rework` branch (tokens ratified 2026-10-20/21,
documented inline in `tailwind.config.ts` and `app/globals.css`) and observed in
the admin pages (`admin/bets`, `admin/create/bet`, `admin/salesBets` via
`AdminSalesListPage`, `admin/config`, `admin/settlement`). This is the
convention the admin settlement page and nav must follow.

## Tokens (single source: tailwind.config.ts; mirrored as CSS vars in globals.css)

- **brand** (blue 50/100/300/500/600/700) — primary actions, links, active states.
- **accent** (teal 400/500/600) — second half of the CTA gradient only.
- **ink** (900/700/500/300/100) — all neutrals: text (900 headings/body-strong,
  700 body, 500 muted/hints), borders (300 inputs, 100 card borders), soft fills (100).
- **success** 50/500/700 — won/positive/settled. **warning** 50/500/700 —
  active/pending/caution (text-ink-900 on warning fills). **danger** 50/500/700 —
  lost/destructive/finalized (Finalizada badge, Liquidar confirm button).
- CTA gradient `bg-brand-cta` must carry `text-ink-900`, never white (AA, A1a).

## Radius ladder (ratified A3b — no ad-hoc radii)

- `rounded-sm` 0.5rem — inputs, buttons, badges, chips, small controls
- `rounded-card` 1rem — cards, panels, modals, dropdowns
- `rounded-md` 1.5rem — feature/hero containers only
- `rounded-pill` — primary storefront CTAs and status badges

## Recurring patterns

- **Card**: `bg-white rounded-card border border-ink-100 shadow-card p-4`
  (modals `p-6`), hover lift via `hover:shadow-card-hover transition-shadow`.
- **Buttons**:
  - Primary: `bg-brand-600 text-white rounded-sm hover:bg-brand-700 font-semibold transition-colors`.
  - Destructive/final (Liquidar): `bg-danger-700 text-white rounded-sm hover:bg-danger-800 font-semibold disabled:opacity-50 disabled:cursor-not-allowed`.
  - Secondary/neutral: `bg-ink-100 text-ink-900 rounded-sm hover:bg-ink-300 transition-colors`.
  - Keyboard focus: global `:focus-visible` ring (brand-700 outline), no per-button work needed.
- **Headings**: page `h1` centered `text-xl font-bold` (some legacy pages use
  text-3xl; new admin pages standardize on text-xl); section/card `text-lg font-bold text-ink-900`;
  labels `text-sm font-semibold text-ink-900`; modal title `text-xl font-bold text-ink-900`.
- **Status badges**: `px-2 py-1 rounded-pill text-xs` — success-700 (✓ Liquidada /
  Activa), danger-700 (Finalizada), warning-500 + text-ink-900 (pending).
- **Forms**: label `block text-sm font-medium text-ink-700 mb-1`; input
  `w-full p-2 rounded-sm bg-white text-ink-900 border border-ink-300 focus:border-brand-500`.
- **Loading**: centered `<FadeLoader color="var(--color-brand-700)" />` in a `h-64` (or `h-40`) flex area.
- **Empty state**: one quiet line — `text-ink-500 text-sm` ("No hay X registradas.").
- **Errors**: `ApiErrorState` for fetch failures (401/403 are states, never an
  empty list); inline alerts `rounded-sm bg-danger-100 border border-danger-500 text-danger-700 text-sm` with `role="alert"`.
- **Tables**: `w-full text-sm`, left-aligned, `text-ink-500` header row with
  bottom border (token ramp only: `border-ink-100`/`border-ink-300` — ink-200
  is NOT a token), rows separated by `border-b border-ink-100`.
- **Copy**: operator-facing Spanish, concise, explains consequences ("es
  permanente e idempotente"), em-dash "—" between teams, "…" for in-flight
  actions ("Procesando…", "Guardando…"). Money via `formatPrice`, dates via `formatDate`.
- **Layout**: page shell `flex flex-col w-full items-center px-4`; content
  max-width via `max-w-3xl`/`max-w-5xl`; card grids `grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
- Reduced-motion and the `.random-ticket-button` component live in globals.css; do not re-inline them.
