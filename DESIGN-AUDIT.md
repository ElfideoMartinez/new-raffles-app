# Design Audit — Rifas Mtz (new-raffles-app)

- **Repo:** `new-raffles-app`, branch `fix/security-consistency` @ `346b8ef`
- **Audit branch:** `design/consistency-audit` (created from that HEAD; `fix/security-consistency` untouched)
- **Audited:** 2026-10-21
- **Scope:** presentation layer only (`app/**/*.tsx`, `app/globals.css`, `tailwind.config.ts`). No functional, auth, server or `functions/` changes.
- **Status of this doc:** findings + proposed fixes. Anything marked *judgement call* is **not** applied; it needs Daniel.

---

## 1. Current token reality

### 1.1 Do the CSS vars actually exist in Tailwind?

`app/globals.css:5-13` claims its five vars "mirror `tailwind.config.ts`". Verified against `tailwind.config.ts`:

| CSS var (`globals.css`) | Value | Tailwind token with the same **name** | Tailwind token with the same **value** | Verdict |
|---|---|---|---|---|
| `--color-ink-900` | `#0f172a` | `ink.900` ✅ | `ink.900` ✅ | **OK** |
| `--color-ink-inverse` | `#ffffff` | **none** ❌ | `white` (stock Tailwind) — not a brand token | **Invented name.** Value is fine, name is not in the theme. |
| `--color-brand-500` | `#3b82f6` | `brand.500` ✅ | `brand.500` ✅ | **OK** |
| `--color-brand-700` | `#1d4ed8` | `brand.700` ✅ | `brand.700` ✅ | **OK** |
| `--color-accent-400` | `#2dd4bf` | `accent.400` ✅ | `accent.400` ✅ | **OK** |

**Verdict: partially invented.** Four of five map 1:1 to a real Tailwind token; `--color-ink-inverse` is a name that exists nowhere in the theme. It is *used* (spinners in `WithAuth`, `SaleCard`, `BetSaleCard`, `page.tsx`, `raffle/[id]/*`, `bet/[id]/*`, `bet/page.tsx`, `admin/*`, `user/purchases`) and would silently **do nothing** anywhere it is passed to something that is not CSS: e.g. `OfferStar` defaults `fillColor = "var(--color-warning-500)"` (`OfferStar.tsx:17-19`) — `--color-warning-500` **does not exist at all** (no warning var was declared), so the polygon's `fill` resolves to invalid → falls back to black. This is a real, visible bug: the price star renders black instead of amber.
>
> Also: `--color-ink-inverse` is white, but **every spinner is placed on a white card**. That is invisible. Those spinners were probably intended to be `ink-900`.

### 1.2 Hover gradient in `.random-ticket-button`

`globals.css:59`:

```css
background: linear-gradient(135deg, #2563eb, #14b8a6); /* brand-600 → accent-500; not hoisted */
```

- Values **do** exist in `tailwind.config.ts` (`brand.600`, `accent.500`) — so they are brand colours, not accidents.
- They are **hard-coded hex in CSS**, which contradicts the base rule's use of `var()` two lines above. `gradient-from`/`to` can't be used in plain CSS; the fix is two more vars (`--color-brand-600`, `--color-accent-500`). That is a 1:1 mechanical fix, and it is the same pair Tailwind already declares as `bg-brand-cta-hover`.
- Drift risk: the base and hover gradients are defined in **three places** now — `globals.css` `.random-ticket-button`, `tailwind.config.ts` `brand-cta` / `brand-cta-hover`, and consumers that reference them. Any change to one silently desyncs the others.

### 1.3 The `#355b6eff` in `RaffleDetailsButton.tsx:14`

Traced through git:

| Commit | What happened |
|---|---|
| `0db2447` (2024-12-23, LuisMeraz) "Change GUI language and 'view raffle' button design" | Added `style={{ backgroundColor: '#355b6eff' }}` to the CTA, overriding `bg-blue-500`. Same commit wrote the Spanish label "Ver Rifa". |
| `7943af3` (2025-04-15) | The **same hex** was pasted onto the checkout-success "Ir a inicio" link (`#355b6eff`). |
| `70b4d5f` (2026-10-20) | CTA override removed; comment added claiming it "rendered as dark teal". Two **other** `#355b6eff` usages still existed at that commit (`Modal.tsx:25`, `checkout/success/page.tsx:118`). |
| `edfea52` (2026-10-21) | Surviving `#355b6eff` usages replaced with `var(--color-brand-700)` (`#1d4ed8`). |

**What the colour is:** `#355b6e` = `hsl(193, 26%, 32%)` — a **desaturated slate-teal**, ~L\*25. It is *not* on the brand ramp (brand is `hsl(217, 91%, 60%)`, accent is `hsl(173, 80%, 50%)`). It shares only the hue family with accent, at a quarter of the chroma and half the lightness.

**Was it deliberate or an accident?** Best evidence available:
- It was applied as a per-element `style={{}}` override in **one** commit, and then copy-pasted to a second unrelated component 4 months later — that pattern is *"a nice colour picked once and reused as a literal"*, not a system decision.
- The commit message only says "button design", no colour rationale; nothing else in the repo uses that hue; no design doc exists.
- `#355b6e**ff**` (alpha suffix written out, then used in `backgroundColor`) is a paste from a colour picker / devtools, not a hand-authored token.
- **Conclusion: accidental by origin, but it was the shipped brand colour for the primary storefront CTA for ~22 months.** That makes replacing it a *brand decision*, not a bug fix — it has been retired already (commit `70b4d5f`) and Daniel should confirm that retirement. See §4, Q1.

### 1.4 Token drift summary (honest)

- `tailwind.config.ts` defines `fontFamily.sans` as a **system-UI stack**, while `app/layout.tsx` loads **Inter** via `next/font` and applies `inter.className` on `<body>`. The Tailwind `sans` token is therefore **dead code and factually wrong** — `font-sans` anywhere in the app would render the system stack, not Inter. Nothing currently uses `font-sans`, so it's latent, not visible.
- `tailwind.config.ts:7-12` comment says the tokens are "derived from what the app already uses most" — but the majority of the admin + bet surfaces use **stock grey/slate/green/red/yellow** that have no token equivalent. So the token set covers the storefront and nothing else.
- `globals.css` still carries the create-next-app `--foreground-rgb` / `--background-start-rgb` / `--background-end-rgb` scaffold **and a `prefers-color-scheme: dark` block that flips body text to white** — while `tailwind.config.ts` has no dark mode plan and every surface assumes light. On a dark-mode OS, any text that has no explicit colour (cart `h1`, `purchases` items, `bet/page.tsx` empty state was already white...) flips to white on a near-white gradient. This is the most likely source of "invisible text" across screens.
- `--color-ink-inverse` and `--color-warning-500` are referenced in TSX but are not part of a documented contract.

---

## 2. Inventory

### 2.1 Typography

| Item | Reality | File |
|---|---|---|
| Family | **Inter** via `next/font/google`, `subsets: ["latin"]` only | `app/layout.tsx:5` |
| Family (token) | System stack in `tailwind.config.ts` — **conflicts with Inter** | `tailwind.config.ts:74-82` |
| Hard-coded sizes | `.random-ticket-button { font-size: 1.1rem }` (only CSS size outside Tailwind) | `globals.css:53` |
| Near-miss utility | `text-md` used twice — **does not exist in Tailwind 3** (no-op) | `bet/[id]/BetPageClient.tsx:483,497` |
| Scale in use | `text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl` plus raw `text-4xl`, `text-5xl` in scratchcard. No documented rhythm; headings jump 2xl → 3xl between storefront and bet. | multiple |
| Weights | `font-medium / semibold / bold / extrabold` all used; `extrabold` only on storefront (`page.tsx:24`, `Cards.tsx:71`) | — |
| Letter-spacing | `tracking-tight` only on storefront heading and header wordmark | `page.tsx:24`, `MainHeader.tsx:56` |
| Emoji as iconography | 🎯 🎟️ 🏆 👜 ℹ️ 📅 📞 📧 ✅ 🎉 🍀 ⚪ 🔴 ⚠️ used inline in copy — 15 occurrences. Reads as casual/WhatsApp, not a designed system. | multiple |

`subsets: ["latin"]` is fine for Spanish (á é í ó ú ñ ü all exist in latin); it would **not** cover `¡`/`¿`? — actually those are U+00A1/U+00BF, which *are* in the `latin` subset. Verified: no missing glyph risk for es-MX.

### 2.2 Spacing & radius

- **Padding:** `p-1, p-2, p-3, p-4, p-6, p-8, p-10`; `px-2/3/4/6`, `py-1/2/2.5/3/4`. No 4px/8px grid enforced but it mostly lands on one.
- **Radius:** declared tokens `rounded-card` (1rem) and `rounded-pill` (9999px). **In real use:** `rounded` (0.25rem), `rounded-md` (0.375), `rounded-lg` (0.5), `rounded-xl` (0.75), `rounded-card`, `rounded-full`, `rounded-pill`, plus `.random-ticket-button`'s hand-written `1.5rem`. **Seven radii, four of which are "just a bit rounder"**. This is the single most visible inconsistency: the storefront is 1rem cards + pills, the raffle-detail page is `rounded-lg`, bet is `rounded-xl`, admin is `rounded`/`rounded-md`/`rounded-lg`.
- **1.5rem pills:** the "rounded 1.5rem pills" brief refers to `.random-ticket-button`'s `border-radius: 1.5rem` — which is **not** the `rounded-pill` token *and* not visually a pill (it's a soft rectangle at 1.5rem on a ~44px-tall button). The storefront CTA uses `rounded-pill`. Two different shapes are both called "the button".

### 2.3 Shadows

| Token | Used by |
|---|---|
| `shadow-card` / `shadow-card-hover` | storefront card, empty state |
| `shadow-cta` | storefront CTA |
| `shadow-sm` | header, badges |
| `shadow-md` | legacy containers |
| `shadow-lg` / `shadow-xl` / `shadow-2xl` | admin, bet, modals |
| raw `0 6px 12px rgba(0,0,0,.15)` | `.random-ticket-button` (duplicate of `shadow-cta`) |

Six steps of elevation, three of them ad hoc. `shadow-cta` is defined with `rgba(0,0,0,0.15)` — a **pure-black shadow** — while `shadow-card` uses brand-tinted `rgba(15,23,42,…)`. Mixed shadow colour temperature.

### 2.4 Colour usage

| Token name | Hex | Where used as class |
|---|---|---|
| `brand-500` | `#3b82f6` | header gradient start, progress bar, focus outline |
| `brand-600` | `#2563eb` | CTA hover start, bet "Participar" |
| `brand-700` | `#1d4ed8` | success-page "Ir a inicio" (via `var`), modal close |
| `accent-400` | `#2dd4bf` | header gradient end, progress bar end |
| `accent-500/600` | `#14b8a6` / `#0d9488` | **declared but never used as a class** |
| `ink-900/700/500/300/100` | slate ramp | storefront + success; **not** used in admin/edit pages (they use `gray-950`, `gray-700`, `gray-600`, `gray-300`) |
| `success-50/500/700` | emerald | **never used**; admin uses `green-500/600` |
| `warning-*` | amber | **never used**; bet uses `yellow-300/400/500` |
| `danger-50/500/700` | red | `danger-500` only (sold-out badge, error card border) |

**Key finding:** three semantic families (`success`, `warning`, `danger`) were declared and then **not adopted**. The admin area — where confirm/reject is the core action — still uses raw `bg-green-500` / `bg-red-500` / `bg-yellow-*`. So there are *two* design systems live simultaneously: tokenised storefront, stock-Tailwind admin/bet.

### 2.5 Image treatment

| Surface | Technique | Ratio / fit | Notes |
|---|---|---|---|
| Storefront card | `next/image` `fill` + `object-cover` in `aspect-[4/3]` | 4:3, cover | Correct. `hover:scale-1.03`. |
| Raffle detail hero | raw `<img>` `object-fill` | **no ratio, no fit** | Distorts artwork — same bug that was fixed on the card but not here. `RafflePageClient.tsx:151-155`. |
| Bet detail hero | raw `<img>` with `h-[33vh] w-full` and `bg-cover bg-center` (useless on `<img>`) | 33vh, default `object-fit` | Stretches. `BetPageClient.tsx:398-402`. |
| Bet list card | `next/image` `fill` + `object-cover` in `h-48` | 2:1, cover | Inconsistent ratio vs storefront. |
| Admin edit previews | raw `<img>` with **no size constraint** | intrinsic | Can blow out the form layout with a large upload. `edit/raffle:365`, `edit/bet:441`. |
| Payment proof | raw `<img>` 64×96 `object-fit: fill` | 2:3, **fill** | Stretched receipts. `ImageModal.tsx:32-37`. |
| Trash icon | raw `<img>` + `filter: invert` | icon | Inverting a PNG to get "white" — fragile. 3 places. |
| Header logo / burger / back | `next/image` + `filter: invert` | 40/22px | Burger and back arrow are also reverse-coloured PNGs. |

`next.config.mjs` only whitelists `firebasestorage.googleapis.com` — correct for raffle images, and it's why `next/image` can't be used for arbitrary admin `image` URLs (bet creation accepts any URL in edit mode). That's a real constraint, not just laziness.

### 2.6 Language / copy consistency (es-MX)

- `lang="es"` ✅ (`layout.tsx:24`). Should arguably be `es-MX` for `es-419` accented forms; `es` is safe and valid.
- **Accents:** inconsistent. "linea" (should be "línea") on the storefront — `page.tsx:26`. "sesion" ×3 (`admin/page.tsx:36,41,68`). "Constraseña" is also a **typo** (`admin/page.tsx:53`). "participacion", "pondra" (`RafflePageClient.tsx:166`). "Terminos" / "Introduccion" on terms page. Admin copy is largely unaccented ("Titulo", "Descripcion", "Creacion"). Meanwhile newer copy *is* accented ("Descripción", "Cuéntanos"-class). Mixed register.
- **Currency:** rendered as `${value}` everywhere — no `$ 100.00 MXN`, no thousand separators, no decimals. `pricePerTicket` can be a *string* from Firestore. `bet/[id]` prints `winPerTicket.toFixed(2)` (`376.50`), the cart prints raw sums (`$50`), so **the same price can render with and without decimals on adjacent screens**. Terms page advertises "$10 a $200 MXN" but no price anywhere is labelled MXN.
- **Dates:** `new Date(d).toLocaleDateString()` (3 places), `toLocaleString()` (`formatDate.ts:3`, `purchases:63`). These use the **visitor's** locale, so a US-locale browser renders `10/21/2026` and a Mexican one `21/10/2026` — and the storefront card prints the **raw** `date` string from Firestore (`Cards.tsx:100`), which may be an ISO timestamp. Three date formats across four screens.
- **Admin English leakage:** "Set Active", "Pending", "All", "Winners", "Claimed:", "Created:", "Symbols:", "Winner" (`quickTickets/active`, `TicketCard`, `bet/page.tsx` error "Error loading bets / Please try again later"). Admin is internal, but the quick-ticket player screen is customer-facing.
- **Informal address:** storefront uses *tú* ("Elige", "Vuelve pronto"), checkout transfer uses *usted* ("Ingrese su nombre", "realice una transferencia"). Both on the same purchase funnel.

### 2.7 States

| State | Reality |
|---|---|
| **Hover** | Storefront CTA: gradient swap + `active:scale`. Admin buttons: colour swap. `.random-ticket-button`: `scale(1.05)` — the only scale-up in the app, 5% is a lot. Bet team cards hover. Cart ticket chips turn **green → red on hover** to signal "click removes" — colour-only affordance, fails colour-blind users. |
| **Focus** | **One** component has `focus-visible` (`RaffleDetailsButton`). Everything else either has `focus:outline-none` + a `focus:ring` (admin forms) or **nothing at all** (every button in cart, bet, quickTicket, header, modals, TicketButton). Storefront cards, header icon buttons, tab buttons: **no visible focus**. This is a WCAG 2.4.7 blocker. |
| **Disabled** | Four different treatments: `disabled:bg-gray-500`, `opacity-50`, `opacity-55` (invalid class, no-op), `opacity-80 cursor-not-allowed`, and `pointer-events-none` on a wrapping div. `.random-ticket-button` uses `.opacity-80.cursor-not-allowed` but still fires `onClick` (disabled attr is set, so native guard holds). |
| **Loading** | `FadeLoader` (12 places, white-on-white or `var(--color-ink-inverse)`), `ClipLoader`, raw `animate-spin` div with `border-blue-600` (bet detail), inline SVG spinner (create/bet). Five different loading languages. Most are **not** wrapped in `role="status"`/`aria-live`, so screen readers announce nothing. |
| **Error** | Storefront: designed card. Admin: `toast.error`. Bet list: bare red text. Bet detail: spinner forever on failure. Raffle detail: **silently renders an empty raffle** when fetch fails (`page.tsx:48-59` returns empty strings). |
| **Empty** | Storefront: card with heading + body. Cart: renders nothing (blank page under "Carrito"). Quick tickets: three different white boxes with English copy. |

### 2.8 Accessibility

**Alt text**

| Element | Current | Issue |
|---|---|---|
| `MainHeader` burger/back | `alt=""` | Correct — button already has `aria-label`. ✅ |
| `MainHeader` logo | `alt="Rifas Mtz"` | ✅ (link text duplicates it, acceptable) |
| `Cards` image | `alt={title \|\| "Rifa"}` | OK, but the card also has `<h2>{title}</h2>` → screen reader reads the title twice. Decorative-in-context. |
| `RafflePageClient` hero | `alt='Raffle Image'` | **Placeholder English.** Should be the award name. |
| `bet/[id]` hero | `alt={title}` | ✅ |
| `ImageModal` proof | `alt="payment"` | English placeholder; should be "Comprobante de pago de {name}". |
| `Modal` enlarged | `alt="Enlarged"` | English placeholder. |
| `DeleteRaffleModal` trash | `alt="Eliminar"` | Button has no other label → OK, but it's an icon-only button with a text alt, acceptable. |
| Cart trash ×2 | `alt="Quitar boleto"` / `"Quitar apuesta"` | OK. Should be `aria-label` on the button + `alt=""` on the img. Nit. |
| Admin edit previews | `alt="imagen actual de la rifa"` | Acceptable; no dimensions (CLS). |

**Focus rings:** see §2.7. Blocker.
**Interactive elements that are `<div onClick>`:** bet (`TeamCard` root, `BetPageClient.tsx:335-343`) and cart ticket chips (`<li onClick>`, `cart:78`). Not keyboard reachable, no role. Blocker.
**Tabs** (admin sales / salesBets): two `<button>`s with colour-only active state — no `aria-selected`, no `role="tablist"`. High.
**Modal (`Modal.tsx`, `DeleteRaffleModal`, `EditBetModal`):** no `role="dialog"`, no `aria-modal`, no focus trap, no Escape handler, scroll not locked. High.
**`<img>` with `onClick` and no keyboard handler:** `ImageModal.tsx:32-37`. High.
**Motion:** `.random-ticket-button:hover { transform: scale(1.05) }`, `group-hover:scale-[1.03]` on card images, `hover:scale-105` on receipts, `hover:scale-[1.02]` on create-bet submit. **No `prefers-reduced-motion` anywhere** in the repo. Medium.

**Contrast (WCAG 2.1 AA, computed from the token hexes):**

| Pair | Ratio | Verdict |
|---|---|---|
| `white` on `brand-500` (CTA gradient **start**) | **3.68 : 1** | AA-large only → **fails** for the 14px CTA label |
| `white` on `accent-400` (CTA gradient **end**) | **1.86 : 1** | **FAIL** — the right-hand side of every primary button, including the word "Rifa" |
| `white` on `brand-cta` (header gradient) | 3.68 → 1.86 | header wordmark is 16px bold → **fails** |
| `white` on `brand-600` (hover start) | 5.17 : 1 | pass |
| `white` on `brand-700` | 6.70 : 1 | pass |
| `white` on `accent-600` | 3.74 : 1 | AA-large only |
| `ink-900` on `accent-400` | 9.59 : 1 | pass — **this is the fix for the gradient** |
| `ink-900` on `warning-500` | 8.31 : 1 | pass — and **already the default in `OfferStar`**, if the var existed |
| `ink-500` on white | 5.86 : 1 | pass |
| `ink-500` on `ink-100` | 4.34 : 1 | **fails** for body text on tinted rows |
| `ink-900` on white | 16.3-ish (113 raw) | pass |
| `white` on `success-500` (admin confirm) | **2.54 : 1** | **FAIL** |
| `white` on `danger-500` (admin reject) | 3.76 : 1 | AA-large only → fails at 14px |
| `white` on `danger-700` | 6.47 : 1 | pass |
| `white` on `yellow-500` (cart "Pago por transferencia") | **1.92 : 1** | **FAIL — the checkout entry point is nearly unreadable** |
| `blue-900` on `yellow-400` (bet CTA) | 6.76 : 1 | pass |
| `green-900` on `yellow-300` (bet "Gana") | 6.91 : 1 | pass |

The gradient is the root cause: it runs from a mid-blue to a *light cyan-teal*, and white text cannot survive the teal end. This is an aesthetic-vs-AA trade-off that Daniel must choose (§4, Q2).

### 2.9 Cross-screen inconsistency

| Surface | Palette | Radius | Type | Shell |
|---|---|---|---|---|
| `/` storefront | brand/ink tokens | `rounded-card` + `rounded-pill` | Inter, extrabold | `max-w-7xl` container from layout ✅ |
| `raffle/[id]` | partial tokens + `gray-100` + `text-black` | `rounded-lg` | bold | `container w-11/12` ❌ ignores layout container |
| `bet/[id]` | **dark**: `bg-gray-100` outer but team cards green/red, bottom bar `bg-blue-600`, yellow CTA | `rounded-xl` / `rounded-lg` | xl/3xl bold | `min-h-screen`, fixed bottom bar overlaps layout padding |
| `bet` (list) | **dark cards on light page**: `bg-gray-800`, `text-white` headings on a white body | `rounded-lg` | 2xl/3xl | `text-white` headings are invisible on white |
| `user/cart` | stock green/red/yellow, no tokens | `rounded-lg` | default 16px, unstyled `h1` | `w-screen` inside `max-w-7xl` → horizontal overflow |
| `checkout/transfer` | stock blue-100/blue-300 | `rounded-lg` | default | `max-w-md` card ✅ |
| `checkout/success` | unstyled body text + one `brand-700` button | `rounded-md` | default | ✅ |
| admin (all) | stock grey/slate/green/red; **create/bet and bets are dark-mode** while dashboard/sales/edit are light | `rounded` / `rounded-md` / `rounded-lg` | | mixed |
| quickTicket | stock blue/green gradients + slate | `rounded-lg` | | English copy |

`bet/page.tsx` is the sharpest break: **dark-mode cards rendered on the light page shell** — `bg-gray-800` cards, `text-white` `<h1>`/`<h3>` sitting directly on white (`bet/page.tsx:63, 44-49`), so the page heading and the empty state are *white on white*.

---

## 3. Findings

Severity: **blocker** = breaks use or WCAG A/AA on a primary flow · **high** = clearly broken/contradictory, visible · **medium** = inconsistency a user would notice · **nit** = polish.

| # | Sev | File:line | What's wrong | Proposed fix | Auto token swap or judgement call? |
|---|---|---|---|---|---|
| F1 | blocker | `tailwind.config.ts:23-30`, `RaffleDetailsButton.tsx:22`, `MainHeader.tsx:26` | White text on `brand-cta` gradient fails AA at the teal end (1.86:1) on every primary CTA and the header. | Options: (a) darken gradient to `brand-600 → accent-600` (3.74 min, still only AA-large), (b) `ink-900` text on the gradient (9.59 at teal end), (c) flat `brand-600` fill with accent only as a 2px underline. | **Judgement call** — aesthetic direction. |
| F2 | blocker | `globals.css:74-80` + `layout.tsx` | `prefers-color-scheme: dark` flips `--foreground-rgb` to white while all surfaces stay light → white text on white in cart, purchases, terms, bet list. | Delete the dark block and the `-rgb` scaffold; set `body { color: theme(ink-900) }`. | **Mechanical** (no design decision — there is no dark mode). |
| F3 | blocker | every button outside `RaffleDetailsButton` | No visible keyboard focus (WCAG 2.4.7). | Add a single `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700` recipe via `@layer components`. | **Mechanical** if applied as a CSS base rule; component-by-component is judgement on where to apply. |
| F4 | blocker | `bet/[id]/BetPageClient.tsx:335-343`, `user/cart/page.tsx:78` | `<div onClick>` / `<li onClick>` — not focusable, no role. | Make them `<button>`/`<a>`; if that touches behaviour, add `role="button" tabIndex={0} onKeyDown`. | **Judgement call** (structural), flagged only. |
| F5 | high | `user/cart/page.tsx:153` | `bg-yellow-500 text-white` → 1.92:1. The only path from cart to checkout is barely legible. | `bg-warning-500 text-ink-900` (8.31:1) — or `bg-brand-600 text-white` (5.17:1). | **Judgement call** (which colour the checkout CTA should be), colours 1:1 available. |
| F6 | high | `OfferStar.tsx:17-19` | Uses `var(--color-warning-500)` which does not exist → star renders **black**. | Add `--color-warning-500: #f59e0b` to `:root`. | **Mechanical**. |
| F7 | high | 12 spinner call-sites (`var(--color-ink-inverse)`, `#fff`) | White spinner on white card = invisible loading. | Use `var(--color-brand-700)` (or `ink-700`). | **Judgement** on colour; mechanical on the var. |
| F8 | high | `SaleCard.tsx:163`, `BetSaleCard.tsx:149` | `bg-green-500`/`bg-red-500` + white → 2.54:1 / 3.76:1 on the admin's primary confirm/reject action. | `bg-success-700` / `bg-danger-700` (5.48 / 6.47). | **Mechanical** (tokens exist with those values). |
| F9 | high | `raffle/[id]/RafflePageClient.tsx:151-155` | Hero `<img>` with `object-fill`, no aspect ratio → distorted artwork (same defect fixed on the storefront card). | `next/image` with `aspect-[4/3]` + `object-cover`, `alt={awardName}`. | **Judgement** on crop ratio. |
| F10 | high | `bet/page.tsx:44-49,63,102` | White headings / empty state on the light body; dark `bg-gray-800` cards. | Convert to the storefront card recipe (`bg-white rounded-card shadow-card border-ink-100`). | **Judgement call** — visual restyle. |
| F11 | high | modals (`Modal.tsx`, `DeleteRaffleModal.tsx`, `admin/bets` EditBetModal) | No `role="dialog"`, no focus trap, no Esc, no scroll lock. | Add a shared `Dialog` primitive. | **Judgement** (component design), flagged. |
| F12 | high | `admin/sales`, `admin/salesBets` tabs | Active tab signalled by colour only; no `aria-selected`/`role="tab"`. | Add `role="tablist"`/`aria-selected` + underline indicator. | **Mechanical** for ARIA; the indicator is judgement. |
| F13 | high | `globals.css:59` | Hover gradient hard-codes `#2563eb, #14b8a6`. | Add `--color-brand-600`, `--color-accent-500`; use `var()`. | **Mechanical** (1:1 to `brand.600`/`accent.500`). |
| F14 | high | `tailwind.config.ts:74-82` vs `layout.tsx:5` | Tailwind `sans` = system stack, actual font = Inter. `font-sans` would be a lie. | Set `fontFamily.sans` to `var(--font-inter), <system stack>` and pass `variable: "--font-inter"`. | **Mechanical**. |
| F15 | medium | 4 radii families in live use | Cards 1rem, bet 0.75rem, admin 0.5rem, chips 0.375rem. | Ratify a 3-step radius scale: `sm 0.5rem` (chips/inputs), `card 1rem`, `pill 9999px`; retire `rounded`/`rounded-md` for surfaces. | **Judgement** (which steps). |
| F16 | medium | `.random-ticket-button` (1.5rem) vs `rounded-pill` CTA | Two "primary button" shapes. | Pick one; if pill, delete the 1.5rem rule. | **Judgement**. |
| F17 | medium | `globals.css:53` `font-size: 1.1rem` | Only raw font size outside Tailwind (17.6px oddity). | `text-lg` (1.125rem). | **Mechanical**-ish (1.1 → 1.125 is a 1.4% shift). |
| F18 | medium | `Cards.tsx:100`, `bet/page.tsx:132`, `admin/bets:300`, `formatDate.ts:3`, `purchases:63` | Four different date renderings; `toLocale*` follows the *browser* locale so the same raffle shows `10/21/2026` or `21/10/2026` depending on the visitor. Storefront prints the raw Firestore string. | One helper: `Intl.DateTimeFormat("es-MX", {dateStyle:"medium"})` → `21 oct 2026`. | **Mechanical** (locale choice is a nit, `es-MX` is safe). |
| F19 | medium | all price renderings (`${…}`) | No MXN label, no decimals consistency (`$50` vs `376.50`), thousands unseparated (`$12500`). | `Intl.NumberFormat("es-MX", {style:"currency", currency:"MXN"})` → `$50.00`. Requires a decision on whether to show `.00`. | **Judgement** on the `.00`. |
| F20 | medium | `page.tsx:26` ("linea"), `admin/page.tsx:36,41,68` ("sesion"), `admin/page.tsx:53` ("Constraseña" typo), `RafflePageClient.tsx:166`, terms page | Missing accents + one typo in customer- and admin-facing Spanish. | Accent pass; `Constraseña` → `Contraseña`. | **Mechanical** (pure spelling). |
| F21 | medium | `checkout/transfer` vs storefront | *usted* on checkout, *tú* on the shop. | Pick one — `tú` is the storefront's existing voice and matches a young raffle audience. | **Judgement**. |
| F22 | medium | `globals.css` + 6 files | Motion (scale 1.02–1.05, 300ms transitions, spinner) with no `prefers-reduced-motion` guard. | `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms!important; transition-duration:.01ms!important; transform:none!important } }` | **Mechanical** (standard guard), but it is a behaviour change — needs Daniel's ok. |
| F23 | medium | `raffle/[id]/page.tsx:48-59` | Fetch failure returns empty strings → a valid-looking but empty raffle page. | Return an error flag; render the storefront's error card. | **Judgement** (touches data flow). |
| F24 | medium | `user/cart/page.tsx:66,117` | `w-screen` inside the layout's `max-w-7xl` container → horizontal scroll on wide screens. | `w-full`. | **Mechanical**. |
| F25 | medium | `admin/create/bet` (dark) vs `admin/dashboard`/`sales`/`edit` (light) | The admin area is half dark-mode, half light. | Pick one (see Q4). | **Judgement**. |
| F26 | medium | `bet/page.tsx`, `quickTicket/play`, `TicketCard`, `quickTickets/active` | English leaked into customer-visible screens ("Ticket ID", "Set Active", "Please try again later", "Created:", "Winner"). | Translate; admin-only screens can stay English if Daniel prefers. | **Judgement** on admin; **mechanical** on quickTicket (customer-facing). |
| F27 | medium | `AddToCartButton.tsx:45` | `disabled:bg-gray-500` on `bg-blue-500` → a *grey* disabled state that looks like a different component; also `rounded` (0.25rem) the only 0.25rem radius in the app. | `disabled:bg-brand-300 disabled:text-white` + `rounded-card`... or `rounded-pill`. | **Judgement** (radius/shape). |
| F28 | medium | `TicketButton.tsx:62-66` | Four colour meanings (blue=sold, yellow=in cart, yellow=selected, green=available) with yellow meaning two things. | Sold → `ink-300` + strikethrough; selected → `brand-600`; in-cart → same with a dot. | **Judgement**. |
| F29 | medium | `MainHeader.tsx:16-17` | `isCartIconAvailable` is true on `/checkout/success` → cart icon hidden exactly when it would be empty; nav elements `invisible` (still focusable/announced). | `hidden` instead of `invisible`, or render conditionally. | **Mechanical** (a11y). |
| F30 | nit | `bet/[id]:483,497` | `text-md` does not exist → no-op. Bet bar renders at inherited 16px. | `text-base`. | **Mechanical**. |
| F32 | nit | `edit/raffle:369`, `edit/bet:448` | `cursor-none` (invalid Tailwind class) intending "not-allowed". | `cursor-not-allowed`. | **Mechanical**. |
| F33 | nit | `bet/[id]:498` | `disabled:opacity-55` — not in Tailwind's scale (55 ≠ 50/60) → silently dropped. | `disabled:opacity-50`. | **Mechanical**. |
| F34 | nit | `quickTicket/play:279` (audit originally cited `bet/[id]:171`, which is now clean) | `bg-gradient-to-r` + `bg-blue-500` both set → flat bg is dead code. | Remove `bg-blue-500`. | **Mechanical**. |
| F35 | nit | `Modal.tsx:24` | `focus:outline-none` removes the only focus cue on the close button. | Remove it; add the shared focus recipe. | **Mechanical**. |
| F36 | nit | `DeleteRaffleModal.tsx:16`, cart ×2, header ×2 | PNG icons recoloured with `filter: invert` — breaks if the asset has any colour. | Replace with inline SVG `currentColor` (cart already has the svg commented out). | **Judgement** (asset work). |
| F37 | nit | `accessibility` ×3 only (`aria-label`) | Only 3 `aria-label`s in the whole app. | See component patterns. | — |
| F38 | nit | `ImageModal.tsx:32-37` | Proof image `64×96` with default `object-fit:fill` → stretched receipts. | `object-cover` + `rounded`. | **Mechanical**. |
| F39 | nit | `globals.css:16-18` | Create-next-app scaffold vars (`--foreground-rgb` etc.) still present. | Remove with F2. | **Mechanical**. |
| F40 | nit | `Cards.tsx:42` vs `<h2>` at 67 | Image alt duplicates the adjacent heading. | `alt=""` (title is already text). | **Judgement** (SEO may prefer alt). |

**Totals: 4 blockers · 10 high · 15 medium · 11 nit.**

---

## 3b. Reconciled status — 2026-10-21 (verified against code)

Every finding below was re-checked by reading the current source, not taken on
trust from the original table. Counts are of the ORIGINAL 40; F23 is added here
as a new item surfaced by the e2e work.

### Already fixed (17)

| # | Evidence |
|---|---|
| F1 | `RaffleDetailsButton.tsx:22` uses `text-ink-900` on `brand-cta`; requirement recorded on the gradient tokens in `tailwind.config.ts`. |
| F6 | `--color-warning-500: #f59e0b` exists in `:root`; `OfferStar.tsx:17` reads it. |
| F8 | `SaleCard`/`BetSaleCard` confirm/reject use `bg-success-700` / `bg-danger-700`. |
| F13 | `.random-ticket-button:hover` uses `var(--color-brand-600)` / `var(--color-accent-500)`. |
| F40 | `Cards.tsx:45` image is `alt=""` (title renders as the adjacent `<h2>`). |
| F30 | `BetPageClient.tsx:483,497` `text-md` replaced with `text-base`; verified by grep (no `text-md` remains). |
| F31 | `user/cart/page.tsx:154` checkout CTA is `w-full`; grep confirms no `w-ful` typo remains anywhere in `app/`. |
| F32 | `admin/edit/bet:483` and `admin/edit/raffle:390` now use `cursor-not-allowed`; grep confirms no `cursor-none` remains in `app/` (tsc clean). |
| F33 | `bet/[id]/BetPageClient.tsx:497` `disabled:opacity-55` replaced with `disabled:opacity-50`; grep confirms no `opacity-55` remains in `app/`. |
| F34 | `quickTicket/play/page.tsx:279` keeps only `bg-gradient-to-r from-blue-500 to-green-500`; the dead `bg-blue-500` was removed (grep confirms no stacked `bg-blue-500` beside a gradient). |
| F5 | `user/cart/page.tsx:154` checkout CTA is now `bg-brand-600 text-white` (was `bg-yellow-500 text-white`, 1.92:1); grep confirms no `bg-yellow-500` remains in the page. |
| F22 | `@media (prefers-reduced-motion: reduce)` guard added to globals.css (approved 2026-10-22). |
| F35 | `Modal.tsx` close button `focus:outline-none` removed; base focus ring now applies. |
| F23 | `fetchRaffleData` returns an `error` flag and `RafflePageServer` renders a danger-styled error card instead of a plausible empty page (verified in app/raffle/[id]/page.tsx). |
| F7 | All 10 loader sites (8 listed + `raffle/[id]/page:110`, `RafflePageClient.tsx:65`) switched from `var(--color-ink-inverse)` to `var(--color-brand-700)` (#1d4ed8, verified in globals.css); grep confirms none remain. tsc clean. |
| F2 / F39 | `-rgb` scaffold vars (`--foreground-rgb`, `--background-start-rgb`, `--background-end-rgb`) and the `prefers-color-scheme: dark` block deleted from `globals.css`; `body { color: var(--color-ink-900); background-color: #ffffff }` — grep confirms no `-rgb` vars remain. tsc clean, 10/10 e2e pass. |

### Partially fixed (4) — still needs work

| # | What remains |
|---|---|
| F3 | FIXED 2026-10-22: base `button/a/[role=button]:focus-visible` recipe added in `@layer components` (globals.css); `.focus-ring` stays for opt-in use. |
| F18 | RESOLVED 2026-10-22: both call sites now use `formatDate`/`formatDateTime`; grep confirms 0 `toLocaleDateString`/`toLocaleString` remain in `app/`. |
| F27 | `AddToCartButton` is `bg-brand-600` + `disabled:bg-brand-300` + `rounded-pill`, but the stale commented-out class string above it still shows the old `disabled:bg-gray-500` recipe. |
| F29 | Cart now hides via `hidden` (not `invisible`), so it is no longer focusable — but `isCartIconAvailable` still returns true on `/checkout/success`, which is exactly when the empty cart would be useful. |

### Still open (21)

| # | Sev | Location | What's wrong | Fix |
|---|---|---|---|---|
| F3 | blocker | most buttons | No shared keyboard focus recipe (see partial above). | Base rule in `@layer components`. |
| F4 | blocker | `user/cart/page.tsx:67,80,96,130`, `bet/[id]/BetPageClient.tsx:335-343` | `<div onClick>` / `<li onClick>`: not focusable, no role. | `<button>`/`<a>`, or `role="button" tabIndex={0} onKeyDown`. |
| F9 | high | `raffle/[id]/RafflePageClient.tsx:156` | Raw `<img>`: it DOES have `object-cover` + fixed `h-64` now (the old `object-fill` distortion is gone), but no aspect ratio and no `next/image`. | Lower severity than written: artwork is no longer distorted. Add `aspect-[4/3]` or leave. **Assessed 2026-10-22: leave as-is** (fixed h-64 + object-cover crops cleanly on all breakpoints; aspect-ratio swap would change card heights); `next/image` blocked by unlisted Firestore hosts. Needs Daniel's ok to close or change. |
| F10 | high | `bet/page.tsx:103,116,127,132` | `bg-gray-800` cards with white text inside the light layout. | Storefront card recipe (`bg-white rounded-card shadow-card border-ink-100`). |
| F11 | high | `Modal.tsx`, `DeleteRaffleModal.tsx`, `admin/bets` EditBetModal | No `role="dialog"`, no `aria-modal`, no Esc, no focus trap, no scroll lock. | Shared `Dialog` primitive. |
| F12 | high | `admin/sales`, `admin/salesBets` | Tabs signalled by colour only; no `role="tablist"`/`aria-selected`. | ARIA roles + underline indicator. |
| F14 | high | `tailwind.config.ts:85-93` vs `layout.tsx:6` | `fontFamily.sans` is the system stack while the app loads Inter. `font-sans` would be a lie. | `sans: ['var(--font-inter)', ...system]` and pass `variable: "--font-inter"`. |
| F24 | high | `user/cart/page.tsx:67,118` | `w-screen` inside the `max-w-7xl` container → horizontal scroll on wide screens. | `w-full`. |
| F26 | high | `quickTicket/play/page.tsx:112,198,202`, `admin/quickTickets/active:159` | English leaked into customer-visible screens ("Ticket ID", "No ticket found", "Please try again later", "Set Active"). | Translate the customer-facing strings. |
| F15 | medium | 4 radii families in live use | Cards 1rem, bet 0.75rem, admin 0.5rem, chips 0.375rem — contradicts ratified A3b. | Re-map to the A3b ladder. |
| F16 | medium | `.random-ticket-button` (1.5rem) vs `rounded-pill` CTA | Two primary-button shapes live. A3b ratified keeping 1.5rem, so this is intentional — but it still reads as drift on screen. | Confirm as intended (then close) or unify. |
| F17 | medium | `globals.css:57` | `font-size: 1.1rem` is the only raw font size outside Tailwind. | `text-lg`. |
| F19 | medium | `admin/bets:288,293,324,336,348` | Prices interpolated as `$${value}` / `parseFloat(...)` instead of `formatPrice`. | Route through `formatPrice`. |
| F20 | `layout.tsx:10` "en linea"→"en línea"; `RafflePageClient.tsx:119` toast "Listo! tu numero"→"¡Listo! Tu número". The other cited spots (`admin/page.tsx`, terms page) already carry correct accents in current source. |
| F21 | medium | `checkout/transfer` vs storefront | *usted* on checkout, *tú* on the shop. | Pick one (Q6, still open). |
| F25 | medium | admin area | Half dark, half light historically; A4a ratified light everywhere, but check each admin route actually got converted. | Verify `admin/create/bet` and `admin/bets` render light. |
| F28 | medium | `TicketButton.tsx:72-73` | `bg-yellow-400` means both "in cart" and "selected". | Distinct treatments. |
| F36 | nit | cart ×2, `DeleteRaffleModal:17`, `MainHeader:34` | PNG icons recoloured with `filter: invert`. | Inline SVG with `currentColor`. |
| F37 | nit | app-wide | 8 `aria-label`s total. | Component-by-component pass. |
| F38 | nit | `ImageModal.tsx` | Proof image sizing/`object-fit` not verified in current source. | Re-check before fixing. |

### Suggested fixed sets

- **Accessibility pass (blockers):** F3, F4, F35, plus F29's `isCartIconAvailable`.
- **Invisible-primary-action pass:** F5, F7 — both are "the main thing you need to click is barely visible".
- **Zero-risk typo pass:** F30, F31, F32, F33, F34 — all silently-dropped classes.
- **F23 first among highs:** it is the one that hides real failures instead of merely looking wrong.

---

## 4. Decisions needing a human

These are **not** applied and must not be guessed.

> **2026-10-21 — Daniel ratified A1a, A2a, A3b, A4a, A5a** (plus the B-series
> implementation work). See **§4.1 Decision log** for the record of what was
> decided and what shipped on branch `design/ratified-decisions`. The Q-text
> below is preserved as the original framing; Q1–Q5 are now answered there.

**Q1 — The `#355b6e` question.** It was the storefront CTA colour for ~22 months and was retired in `70b4d5f` without a stated rationale.
Options: (a) confirm retirement, gradient stands; (b) reinstate as a distinct "deep teal" secondary/brand-accent colour (`#355b6e` fails AA with white at 6.9:1 — actually it *passes*; it would be your only fully-AA dark brand surface); (c) keep it only for modal chrome / success page.

**Q2 — Can the primary gradient carry white text?** Currently 1.86:1 at the teal end.
(a) keep gradient, switch text to `ink-900` (9.59:1 at teal end) — changes the CTA from "bright" to "dark-on-mint";
(b) darken gradient to `brand-600 → accent-600` and keep white (min 3.74:1 — **still fails** 14px AA);
(c) flat `brand-600` + accent as a 2px bottom border (5.17:1, safe, quieter);
(d) keep as-is and accept AA failure (defensible only if you treat this as decoration, which it isn't — it's the buy button).

**Q3 — Which single radius system?** `card 1rem` + `pill 9999px` (current storefront), or 0.5/1/1.5rem ladder that keeps the `.random-ticket-button` 1.5rem shape. This determines F15/F16/F27.

**Q4 — Admin: light or dark?** `create/bet` and `bets` are dark; dashboard/sales/edit are light. Pick one and convert the outliers.

**Q5 — Currency presentation.** `$50` / `$50.00` / `$50.00 MXN` / `$ 50` — the terms page already says "MXN", the UI never does. Also: decimals on whole-peso prices?

**Q6 — Voice.** *tú* (storefront) or *usted* (checkout)? They currently collide inside one funnel.

**Q7 — Emoji as UI icons.** 15 emoji in customer-facing chrome. Keep (matches the WhatsApp-native audience) or replace with a 16px icon set?

**Q8 — Do `success`/`warning`/`danger` become the required semantic palette?** They're declared but unused; admin still uses stock `green-500`/`red-500`. Adopting them fixes F8 mechanically.

### 4.1 Decision log (ratified)

| # | Decision | Ratified choice | Status | Date | Shipped in |
|---|---|---|---|---|---|
| A1a | Text on the CTA gradient (was Q2) | Keep the gradient. Text **on gradient surfaces** becomes `ink-900` (#0f172a, 9.59:1 at the teal end). White stays on solid fills (`bg-danger-700 text-white` = 5.48:1). Requirement documented on the gradient tokens in `tailwind.config.ts`. | **ratified** | 2026-10-21 | `design: ratify A1a dark-on-gradient text` |
| A2a | `#355b6e` (was Q1) | **Confirmed dead.** It stays retired; no code may re-introduce it. | **ratified** | 2026-10-21 | (verification only) |
| A3b | Radius ladder (was Q3/Q4 of §2.2) | Four steps: `rounded-sm` 0.5rem (inputs/buttons/chips), `rounded-card` 1rem (cards/modals), `rounded-md` 1.5rem (feature containers), `rounded-pill` 9999px (primary CTAs). `.random-ticket-button` keeps its 1.5rem shape. | **ratified** | 2026-10-21 | `design: A3b radius ladder` |
| A4a | Admin theme (was Q4 here) | **Light everywhere.** `admin/create/bet` and `admin/bets` converted as a palette swap (structure/behaviour untouched, hand-rolled EditBet modal restyled only). | **ratified** | 2026-10-21 | `design: A4a admin light surface` |
| A5a | Currency format (was Q5) | **`$50`** — es-MX/MXN formatting, zero fraction digits, no visible currency suffix; grouping kept (`$1,250`). **Open tension:** the terms page copy still promises MXN while the UI no longer prints it; copy deliberately not changed. | **ratified** | 2026-10-21 | `feat: A5a $50 price format` |
| B1derive | `tickets_left` | Computed server-side in `getAllRaffles` from the `tickets` collection (`sold === true` subtracted from `numberOfTickets`); no-ticket raffles report full stock. Capped N+1 (2 `count()` reads per raffle, max 50), cost documented in code. | **ratified** | 2026-10-21 | `feat: B1derive tickets_left in getAllRaffles` |
| B2delete | Unauthenticated admin routes | `app/api/admin/**` deleted after grep proved zero callers. | **ratified** | 2026-10-21 | `chore: B2delete remove unauthenticated admin routes` |

Still open from §4: **Q6 voice** (tú vs usted), **Q7 emoji icons**, and the
terms-page/MXN wording flagged under A5a.

### 4.2 Radius audit — before/after (A3b)

152 radius utilities across 32 files in `app/**` were remapped 1:1 onto the
ladder; no file gained or lost a radius declaration (the count per file is
identical before and after — the change is which token each one uses).

| File | Before | After |
|---|---|---|
| `app/admin/bets/page.tsx` | 21 | 21 |
| `app/admin/create/bet/page.tsx` | 14 | 14 |
| `app/checkout/transfer/page.tsx` | 10 | 10 |
| `app/admin/edit/raffle/page.tsx` | 10 | 10 |
| `app/admin/edit/bet/page.tsx` | 10 | 10 |
| `app/admin/create/raffle/page.tsx` | 8 | 8 |
| `app/admin/quickTickets/active/page.tsx` | 7 | 7 |
| `app/components/SaleCard.tsx` / `BetSaleCard.tsx` / `app/bet/[id]/BetPageClient.tsx` | 6 each | 6 each |
| `app/user/cart/page.tsx`, `app/quickTicket/play/page.tsx` | 5 each | 5 each |
| 11 more files | 1–4 each | 1–4 each |
| **Total** | **152** | **152** |
| Distinct radii in use | `rounded`, `none`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `card`, `pill` + 1.5rem literal | `sm`, `card`, `md`, `pill` (+ the literal 1.5rem in `.random-ticket-button`) |

Mapping rule used: `rounded`/`sm` → `sm`; `md`/`lg`/`xl`/`3xl` → `card`;
`2xl` → `md`; inputs/buttons/CTAs/narrow badges → `sm` (primary CTAs → `pill`);
cards/modals → `card`; hero/feature containers → `md`. No `rounded-[…]`
utilities or inline `borderRadius` values existed in `app/**`.


---

## 5. Appendix — what was verified vs assumed

- **Verified by reading code + git history:** all hex values, all class strings, the `#355b6e` lineage (commits `0db2447` → `7943af3` → `70b4d5f` → `edfea52`), token existence, contrast ratios (computed with the WCAG 2.1 relative-luminance formula from the literal hex).
- **Verified by running:** `npx tsc --noEmit` → exit 0; `npm run lint` → exit 0, **60 warnings, 0 errors** (baseline, before my changes).
- **Not verified (no browser render):** actual rendered appearance, `prefers-color-scheme` behaviour on a real dark-mode OS, whether `next/font` Inter actually loads in production, and the real-world default of `<img>` with `object-fill` at partial widths. Contrast numbers are computed from hex, not sampled from a screenshot.
- **Assumed:** that `#355b6e` was picked by eye (no design doc exists to confirm); that `--color-ink-inverse` on spinners was intended to read on a light card (it can't).
